#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   field-notes-check.js — every Enterprise program can place a change note
   ─────────────────────────────────────────────────────────────
   When somebody else replaces a value you had saved, the shell says so twice:
   in the corner panel, and as a line UNDER the field it happened to — "Navdeep
   changed this · yours / now stored". The second one needs to find the box,
   which means turning a reported collision (`.assessments.purpose.mission`)
   back into a field id. idToDocPath answers that.

   The shell's own table is the PIPELINE's. Every other program has its own
   field naming, so without a table of its own it falls back to one where `p_`
   is purpose and `exp_` is an experiment — and a note lands under the wrong
   field, or against a path the program does not have. That is worse than no
   note, and it is silent. Exactly the fault idToRecordKey had before each
   program was given its own, in its own js/modules/<id>/module.js.

   So this asks every Enterprise program three things:

     1. does it answer at all — is there a table, or is it falling through to
        the Pipeline's;
     2. does every path it returns name a section that program actually HAS,
        checked against its own emptyData();
     3. does it refuse the ids it cannot resolve, rather than guessing.

   Everything is stubbed; no server, no database.

   Usage:  node tools/field-notes-check.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;

/* The Enterprise programs with code of their own. A program with none uses the
   shell's table, which is right for the Pipeline: the shell IS the Pipeline. */
const PROGRAMS = ['pipeline', 'exec-readiness', 'ai-governance'];

/* Fields taken from each program's own save path, with where that path puts
   them. The point of writing them out rather than deriving them is that a
   derived expectation would be the same mistake twice: these were read off
   fldSave (js/app.js), harvestFields (exec-readiness/steps.js) and
   saveABFields / the `data.<store>[f] = val(<pre>_f)` families
   (ai-governance/program.js). */
const KNOWN = {
  'pipeline': [
    ['p_mission', 'purpose.mission'],
    ['k_awareness', 'knowledge.awareness'],
    ['cap_aiBudget', 'capital.aiBudget'],
    ['bsic_0_name', 'ideas.0.name'],          // an idea card: a row with no id
    ['trk_7_status', 'tracking.7.status']
  ],
  'exec-readiness': [
    ['ap_mission', 'assessments.purpose.mission'],
    ['af_tools', 'assessments.fluency.tools'],
    ['ad_gaps', 'assessments.structure.gaps'],
    ['st_ownerModel', 'structure.ownerModel'],
    ['cl_touchCustomer', 'collabLab.touchCustomer'],
    ['ll_ownershipGap', 'landscapeNotes.ownershipGap']
  ],
  'ai-governance': [
    ['exp_departments', 'assessmentBattery.aiExposure.departments'],
    ['ctrl_policies', 'assessmentBattery.existingControls.policies'],
    ['eg_principles', 'assessmentBattery.ethicalGovernance.principles'],
    ['dr_owner', 'decisionRights.owner'],
    ['gc_tone', 'govCulture.tone'],
    ['is_plan90', 'incentivesSkills.plan90']
  ]
};

/* Ids every program must REFUSE. A path built from one of these would be a
   guess: the suffix is translated on the way in, or a row id sits in the
   middle, or nobody has mapped the prefix at all. */
const REFUSED = ['expl_3_obj', 'ops_3_perf', 'pt_0_name', 'ru_abc_name', 'nosuchprefix_x', 'read1', ''];

/* The individual track in Executive Readiness is one leader's own work, kept
   per member and redacted by Core\DocPrivacy. It must resolve to nothing here,
   so that nothing on this path can address another leader's slot. */
const PRIVATE_ER = ['ms_theme1', 'md_reflection', 'ma_fears', 'cr_constants', 'ldev_goal'];

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
    then(ok, err) { try { return state === 'ok' ? (ok ? adopt(ok(val)) : self) : (err ? adopt(err(val)) : self); } catch (e) { return settled('err', e); } },
    catch(err) { return self.then(null, err); }, finally(fn) { try { if (fn) fn(); } catch (e) { } return self; }
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
  if (!mod) throw new Error('no such module in the catalogue: ' + moduleId);
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
    navigator: { userAgent: 'field-notes-check', language: 'en-US', languages: ['en-US'], onLine: false, clipboard: { writeText: () => Promise.resolve() } },
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
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), G, { filename: path.relative(ROOT, p).replace(/\\/g, '/') }); }
    catch (e) { errs.push(path.basename(p) + ': ' + ((e && e.message) || e)); }
  });
  return { G, errs };
}

/* ── Run ───────────────────────────────────────────────────────── */
const failures = [];
let checks = 0;
function check(label, ok, detail) {
  checks += 1;
  if (VERBOSE || !ok) console.log('  ' + String(label).padEnd(72) + (ok ? 'ok' : 'FAILED — ' + detail));
  if (!ok) failures.push(label + ' — ' + detail);
}

console.log('\nchecking...');
PROGRAMS.forEach(moduleId => {
  const { G, errs } = boot(moduleId);
  errs.forEach(e => failures.push(moduleId + ' — load ' + e));
  if (!G.Modules || G.Modules.activeId() !== moduleId) {
    failures.push(moduleId + ' — wrong active module');
    return;
  }
  if (VERBOSE) console.log('\n' + moduleId);

  const pathOf = (id) => {
    const p = G.idToDocPath(id);
    return p ? p.join('.') : null;
  };

  /* 1. Every field this program's own save path writes resolves to where it
        writes it. */
  const sections = Object.keys(G.Modules.emptyData() || {});
  (KNOWN[moduleId] || []).forEach(([id, want]) => {
    const got = pathOf(id);
    check(moduleId + ': ' + id + ' resolves to ' + want, got === want, 'got ' + JSON.stringify(got));
    /* 2. …and that path names a section the program actually has. A table that
          survives (1) by agreeing with itself and points at a key nobody
          stores would place notes against nothing, silently. */
    if (got) {
      check(moduleId + ': ' + want.split('.')[0] + ' is a section this program has',
        sections.indexOf(want.split('.')[0]) >= 0,
        'emptyData() has no ' + want.split('.')[0] + ' — it has ' + sections.slice(0, 8).join(', ') + '…');
    }
  });

  /* 3. The ids it cannot resolve are refused, not guessed at. */
  REFUSED.forEach(id => {
    check(moduleId + ': refuses ' + (id || '(empty)'), pathOf(id) === null, 'resolved to ' + JSON.stringify(pathOf(id)));
  });

  if (moduleId === 'exec-readiness') {
    PRIVATE_ER.forEach(id => {
      check('exec-readiness: the individual track stays unaddressable — ' + id,
        pathOf(id) === null, 'resolved to ' + JSON.stringify(pathOf(id)));
    });
  }
});

console.log('\n──────────────────────────────────────────');
console.log('Placing a change note under the field it happened to');
console.log('  programs checked:', PROGRAMS.length);
console.log('  assertions      :', checks);
if (failures.length) {
  console.log('  BROKEN          :', failures.length);
  console.log('──────────────────────────────────────────');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('  ✓ every program resolves its OWN field ids, not the Pipeline\'s');
console.log('  ✓ every path it returns names a section that program really has');
console.log('  ✓ and an id it cannot place resolves to nothing, rather than to a guess');
console.log('──────────────────────────────────────────');
