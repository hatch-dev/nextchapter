#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   leader-module-smoke.js — render every page of a Leaders program
   and pull every trigger on it
   ─────────────────────────────────────────────────────────────
   The pages are generated (tools/port-leader-module.js lifts them
   out of the reference build), and a generated port fails in two
   specific ways that reading the diff will not show you:

     1. A page renders down to the line that reads a name nobody
        brought across, and dies there. Nothing says so until someone
        opens that one screen.
     2. A page renders perfectly and a button does nothing, because
        its handler lives inside an onclick STRING and the name in
        that string was never repointed at DL / EE.

   So this walks every page the module registers and then EVALUATES
   every inline handler in the markup each one produced. A handler is
   code the browser will run later; the only way to know it resolves
   is to run it.

   Three times over: against an empty workspace (every null guard —
   the state a new account is actually in), one with a decision open
   at every section of the flow, and the program's own sample data.

   Then the three things that make a workspace THIS program's:

     the seed    builds this program's document — decisions with
                 their flow, an assessment, a history — and none of
                 the Pipeline's
     the export  names the program it came out of
     the save    reaches /workspace naming the right module

   Failures are narrowed to the port's own failure modes — a name
   that resolves to nothing. A handler that throws for a reason of its
   own (an element the stub DOM does not have) is counted separately.

   Usage:  node tools/leader-module-smoke.js [decision-lab|ethics-engine|all] [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'catalogue.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');

/* ── The programs ──────────────────────────────────────────────
   `pages` is written out rather than read from the module's own registration,
   so a page quietly disappearing from it shows up here as a missing renderer
   rather than as a shorter run nobody notices. `ns` is the global the ported
   code hangs off; `emptyIsOk` are pages that legitimately paint almost nothing
   when there is no decision open yet. */
const PROGRAMS = {
  'decision-lab': {
    ns: 'DL',
    pages: ['assess', 'lab', 'dashboard', 'insights', 'detail'],
    /* The eight sections of the flow. The detail page is rendered once per
       section, because each paints a different card set and a different set of
       handlers — rendering it once would test one eighth of the program. */
    sections: ['problem', 'thecase', 'biascheck', 'stress', 'provisional', 'challenge', 'final', 'debrief'],
    /* A decision with every field filled, so the branches that only exist once
       there is something to show are reached. Field names are the reference's
       own (createDec, DL-app.js) — a fixture with the wrong ones fails inside
       the renderer and reads exactly like a broken port. */
    decision: function (uid) {
      return {
        id: uid, title: 'Accept the VP offer at Acme', description: 'Two years in; the offer doubles scope.',
        category: 'Career', leaning: 'Take it', createdAt: 1, resolved: false, resolvedAt: null,
        flow: {
          options: 'Three: take it, stay, negotiate.', caseFor: 'Scope and pay.', caseAgainst: 'Team is mid-rebuild.',
          friendTest: 'I would tell them to negotiate.', confirmation: 'I only asked people who would say yes.',
          sunkCost: 'Two years is not a reason.', anchoring: 'The first number set my range.',
          wwhbt: 'The rebuild would have to hold without me.', premortem: 'It fails if the rebuild stalls.',
          earlyWarning: 'Two missed milestones.', provisional: 'Negotiate, then take it.',
          challengeAI: 'You have not priced the rebuild risk.', challengeResponse: 'Fair — I will stage the handover.',
          finalCall: 'Negotiating, then accepting.', debriefKnow: 'I knew the team could hold.',
          debriefSurprise: 'The handover took longer.', debriefNextTime: 'Ask the team first.',
          completed: {}
        },
        notes: [], _coachMsgs: []
      };
    },
    seedWants: ['decisions', 'assessment', 'assessmentHistory']
  },
  'ethics-engine': {
    ns: 'EE',
    pages: ['assess', 'lab', 'dashboard', 'insights', 'drills', 'detail'],
    sections: ['situation', 'stake', 'people', 'principle', 'identity', 'caseagainst', 'verdict', 'lookback'],
    decision: function (uid) {
      return {
        id: uid, title: 'The report that flatters the client', description: 'The numbers hold; the framing does not.',
        category: 'Work & Career', createdAt: 1, resolved: false, resolvedAt: null,
        flow: {
          instinct: 'Send it as written.', stake: 'The renewal lands this quarter.',
          chair: 'They would want the caveat.', others: 'Their operations team acts on this.',
          principle: 'Frame favourably whenever the numbers allow.', identity: 'Someone who reads the room over the record.',
          caseAgainst: 'The caveat is the finding.', verdict: 'adjust', betterPath: 'Send it with the caveat up front.',
          theCall: 'Adding the caveat and walking them through it.', whatHappened: 'They thanked me for it.',
          instinctTrust: 'No — the instinct was protecting me.', brokeLens: 'people', verdictAt: 2,
          completed: {}
        },
        notes: [], _coachMsgs: []
      };
    },
    seedWants: ['decisions', 'assessment', 'assessmentHistory']
  }
};

/* ── Stub DOM ──────────────────────────────────────────────────
   Deliberately permissive: every unknown property answers with something
   chainable, so the pages get all the way through their markup instead of
   stopping at the first DOM call the stub does not implement. Lifted from
   tools/exec-readiness-smoke.js, whose header explains the reasoning. */
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
   server.enabled. */
function makeSandbox(moduleId, served) {
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
  const q = '?module=' + moduleId;
  const sandbox = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: CATALOGUE.roles,
    /* No APP_BOOT — nothing resolved a route. The registry falls back to
       ?module=, which is how this picks the program under test. */
    localStorage: storage(), sessionStorage: storage(),
    document: documentStub,
    location: served
      ? {
        href: 'http://localhost/apps/' + q, protocol: 'http:', host: 'localhost',
        hostname: 'localhost', port: '', pathname: '/apps/', search: q,
        hash: '', origin: 'http://localhost', assign() { }, replace() { }, reload() { }
      }
      : {
        href: 'file:///index.html' + q, protocol: 'file:', host: '', hostname: '',
        port: '', pathname: '/index.html', search: q, hash: '', origin: 'null',
        assign() { }, replace() { }, reload() { }
      },
    history: { pushState() { }, replaceState() { }, back() { }, forward() { }, go() { }, length: 1, state: null },
    navigator: { userAgent: 'smoke', language: 'en-US', languages: ['en-US'], onLine: false, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:smoke', revokeObjectURL() { } },
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

/* ── Load order ────────────────────────────────────────────────
   shell.html is the single source of truth. The module's own scripts are not
   in it — boot.js document.writes them once the URL has been resolved — so they
   are spliced in where the browser would have put them, right after boot.js. */
/** The role space a module belongs to — 'leader' for both of these. */
function roleOf(moduleId) {
  const role = (CATALOGUE.roles || []).filter(r =>
    (r.modules || []).some(m => m.id === moduleId))[0];
  return role ? role.key : 'enterprise';
}

function filesFor(moduleId) {
  const app = (html.match(/<script\s+src="([^"]+)"/g) || [])
    .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
    .filter(s => !/^https?:/.test(s))
    .map(s => path.join(ROOT, s))
    .filter(p => fs.existsSync(p));
  const entry = (CATALOGUE.roles || []).reduce((found, role) =>
    found || (role.modules || []).filter(m => m.id === moduleId)[0], null);
  if (!entry) throw new Error('no such module in the catalogue: ' + moduleId);
  const mod = (entry.scripts || []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p));
  if (mod.length !== (entry.scripts || []).length) {
    throw new Error(moduleId + ': the catalogue names a script that is not on disk');
  }
  const at = app.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  app.splice(at >= 0 ? at + 1 : 0, 0, ...mod);
  return app;
}

/* ── One program ───────────────────────────────────────────────── */
function run(moduleId) {
  const cfg = PROGRAMS[moduleId];
  const broken = [];
  const other = new Map();
  let handlersRun = 0, pagesRendered = 0;

  const PORT_FAILURE = /is not defined|is not a function|Cannot read propert(y|ies) of undefined/;
  function record(where, e) {
    const msg = (e && e.message) || String(e);
    if (PORT_FAILURE.test(msg)) broken.push(where + ' → ' + msg);
    else other.set(msg, (other.get(msg) || 0) + 1);
  }

  const FILES = filesFor(moduleId);
  const sandbox = makeSandbox(moduleId, false);
  FILES.forEach(p => {
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: rel }); }
    catch (e) { broken.push('LOAD ' + rel + ' → ' + ((e && e.message) || e)); }
  });
  const G = sandbox;

  if (!G.Modules || G.Modules.activeId() !== moduleId) {
    broken.push('the active module is ' + (G.Modules && G.Modules.activeId()) + ' — expected ' + moduleId);
    return { moduleId, broken, other, handlersRun, pagesRendered };
  }
  if (!G[cfg.ns]) {
    broken.push('window.' + cfg.ns + ' was never created — program.js did not load');
    return { moduleId, broken, other, handlersRun, pagesRendered };
  }

  /* Every on*="…" in the page, evaluated with the `this` and `event` an inline
     attribute would have had. `data` is snapshotted and restored around each
     one: these are real handlers — they really do delete decisions and mark
     sections complete — and one running first would change what the next is
     testing. */
  function pullEveryTrigger(markup, where) {
    const found = markup.match(/\son[a-z]+="([^"]*)"/g) || [];
    const snapshot = JSON.stringify(G.data);
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
      try { G.data = JSON.parse(snapshot); } catch (e) { }
    });
    return found.length;
  }

  /* Through go(), not straight to the renderer: go() is what runs the module's
     beforeNavigate hook — which is where `activeId`, the open section and the
     Assess position are set — and then picks the page. All of it is part of
     what is being tested. */
  function renderOne(page, step, section, label) {
    const where = label + ' ' + page + (step ? ':' + (section || step) : '');
    let markup = '';
    try {
      G.go(page, step);
      if (section) G.currentTab = section;
      const fn = G.Modules.page(page);
      if (!fn) { broken.push(where + ' → the module claims no such page'); return; }
      markup = fn();
      /* The modal layer the shell asks this module for on every render. */
      const mm = G.Modules.hook('renderModal');
      if (mm) markup += mm();
    } catch (e) { if (process.env.SMOKE_STACK) console.log(e.stack); record(where + ' render', e); return; }

    pagesRendered++;
    if (typeof markup !== 'string' || markup.length < 200) {
      broken.push(where + ' → rendered ' + (typeof markup === 'string' ? markup.length + ' chars' : typeof markup));
      return;
    }
    const n = pullEveryTrigger(markup, where);
    if (VERBOSE) console.log('  ' + where.padEnd(34) + String(markup.length).padStart(7) + ' chars  ' + String(n).padStart(4) + ' handlers');
  }

  function renderEvery(label, decisionId) {
    cfg.pages.forEach(p => {
      if (p !== 'detail') { renderOne(p, undefined, null, label); return; }
      if (!decisionId) return;               // nothing to open
      cfg.sections.forEach(s => renderOne('detail', decisionId, s, label));
    });
    /* The drill board needs a drill id in the same slot the detail page uses
       for a decision; without one it is the cabinet's job, already covered. */
    if (cfg.pages.indexOf('drills') >= 0 && G.DRILLS && G.DRILLS.length) {
      renderOne('drill', G.DRILLS[0].id, null, label);
    }
  }

  try {
    /* The fourth argument is the ROLE SPACE, and it matters more than it
       looks: every workspace request asks moduleId(org) which module this
       account may open, and an org stamped 'enterprise' is answered with the
       first Enterprise program — so a Leaders document would be saved under
       exec-readiness. That is what a real sign-up records from the role picker
       (templates/setup.html); the fixture has to record it too. */
    const boot = G.createOrg('Smoke Leader', { name: 'Owner', username: 'owner', passcode: '1234' }, {}, roleOf(moduleId));
    G.currentUserId = boot.userId;
    if (typeof G.applyTeamRoster === 'function') G.applyTeamRoster();
  } catch (e) { broken.push('BOOT createOrg → ' + ((e && e.message) || e)); }

  /* Pass 1 — a brand-new workspace. No decisions, no assessment: the state the
     first person to open the program is actually in, and the one that finds a
     page reading .length off something that is not there yet. */
  if (VERBOSE) console.log('\n' + moduleId + ' · empty workspace');
  G.data = G.Modules.emptyData();
  renderEvery('empty', null);

  /* Pass 2 — the document the SHARED PLACEHOLDER left behind. While these
     modules were catalogued but not built, a Leader account opening one got
     js/modules/_placeholder/module.js, which saves the Pipeline's empty
     document under this module's key — and in the Pipeline's document
     `decisions` is an id-keyed OBJECT, not the array this program works in.
     Those rows are in the database now. An unrepaired one renders a dashboard
     off `undefined.length` and dies on the first "New Decision", so the module
     normalises the shape before anything reads it (module.js → normalize()).
     This is the pass that proves it. */
  if (VERBOSE) console.log('\n' + moduleId + ' · placeholder-shaped workspace');
  G.data = {
    ideas: [], selected: [], assessments: {}, projects: {}, completedSteps: {},
    decisions: {}, notes: [], assigns: {}, roster: [], enterprise: { name: 'Legacy' },
    members: [], orgSetup: true, startDate: '2026-08-03', schemaVersion: 1, rev: 4
  };
  renderEvery('placeholder', null);
  if (!Array.isArray(G.data.decisions)) {
    broken.push('MIGRATION: a placeholder document was left with decisions as an ' +
      (G.data.decisions === null ? 'null' : typeof G.data.decisions));
  }
  try {
    /* The first thing such an account does. Before the repair this was
       "data.decisions.unshift is not a function". */
    G.currentModal = 'new';
    G.document.getElementById('f-t').value = 'A first decision';
    G[cfg.ns].createDec();
    if (!G.data.decisions.length) broken.push('MIGRATION: creating the first decision saved nothing');
  } catch (e) { record('MIGRATION createDec', e); }

  /* Pass 3 — one decision with every field written, so the branches that only
     exist once there is something to show are reached. */
  if (VERBOSE) console.log('\n' + moduleId + ' · populated workspace');
  G.data = G.Modules.emptyData();
  const d = cfg.decision('smokedec1');
  cfg.sections.forEach(s => { d.flow.completed[s] = true; });
  G.data.decisions = [d];
  G.data.assessment = { answers: { q0: 0, q1: 50, q2: 100 }, scores: { head_gut: 50, fast_slow: 25, bold_cautious: 40, solo_social: 60, opt_prag: 50 }, completedAt: 2 };
  G.data.assessmentHistory = [G.data.assessment];
  renderEvery('populated', d.id);

  /* Pass 4 — the program's own sample workspace. Seeding is the module's, not
     the shell's: the More menu offers whatever Modules.seeds() lists, and each
     seed builds its own program's document. What is checked is that this seed
     produces THIS program's — the failure it guards against is the shell's
     Pipeline seed filling a Leaders workspace with ideas and projects. */
  const seeds = G.Modules.seeds();
  if (seeds.length !== 1 || seeds[0].id !== 'sample') {
    broken.push('SEEDS: expected one seed named "sample", got ' + JSON.stringify(seeds.map(s => s.id)));
  } else {
    if (VERBOSE) console.log('\n' + moduleId + ' · seeded workspace');
    G.data = G.Modules.emptyData();
    /* The roster is the account's, and it lives in this document. If the seed
       replaces the document wholesale, applyTeamRoster() rebuilds USERS from
       nothing, getCurrentUser() answers with nobody and render() puts the
       reader on the sign-in screen — mid-seed, session apparently gone. */
    G.data.roster = [{ id: G.currentUserId, name: 'Owner', username: 'owner', passcode: '1234', admin: true, initials: 'O', color: '#B8892A' }];
    try { seeds[0].run(); } catch (e) { record('SEEDS run', e); }
    if (!G.data || !Array.isArray(G.data.roster) || !G.data.roster.length) {
      broken.push('SEEDS: seeding dropped the account\'s roster — the reader is signed out');
    }
    const doc = G.data || {};
    cfg.seedWants.forEach(k => {
      const v = doc[k];
      const filled = Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0);
      if (!filled) broken.push('SEEDS: the sample workspace has no ' + k);
    });
    ['ideas', 'projects', 'portfolio', 'capital'].forEach(k => {
      if (doc[k] !== undefined) broken.push('SEEDS: the sample workspace carries the Pipeline\'s "' + k + '"');
    });
    const first = (doc.decisions || [])[0];
    renderEvery('seeded', first && first.id);
  }

  /* ── Element hosts ─────────────────────────────────────────────
     The port lifts the program's CODE. It does not lift the reference build's
     index.html, and that file was doing real work: it declared the elements
     the program writes into. shell.html has most of them under the same names
     — #app, #navTabs, #notesPanel, #coachPanel, #voiceToast — but not all, and
     a missing one is invisible to every other check here.

     #focusBg / #focusCard / #focusInner is the case this exists for. That is
     the overlay every card's OPEN → flips into. Nothing in the markup names
     it, so the handler audit passes; the stub DOM invents an element for any
     id asked of it, so the render passes; and in a browser flipOpen() reaches
     for `null.classList` and every card on the board is dead on click. The
     module now puts the layer up itself (module.js → ensureFocusLayer).

     So: every id the program looks up as a LITERAL has to be provided by
     something — shell.html, the module's own bootstrap, or markup the program
     itself builds. Ids assembled at runtime ('card-' + key) are not literals
     and are not checked; they belong to markup this program wrote. */
  (function () {
    const read = new Set();
    const provided = new Set();
    const add = (into, src, re) => {
      let m; re.lastIndex = 0;
      while ((m = re.exec(src))) into.add(m[1]);
    };
    const progSrc = (CATALOGUE.roles || []).reduce((f, r) =>
      f || (r.modules || []).filter(m => m.id === moduleId)[0], null).scripts
      .map(s => { try { return fs.readFileSync(path.join(ROOT, s), 'utf8'); } catch (e) { return ''; } });

    progSrc.forEach(s => {
      add(read, s, /getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g);
      add(read, s, /(?<![A-Za-z0-9_$.])\$\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g);
      // …and everything they build markup for, which provides ids of its own
      add(provided, s, /\bid=\\?["']([A-Za-z0-9_-]+)\\?["']/g);
      add(provided, s, /\.id\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g);
    });
    add(provided, html, /\bid="([A-Za-z0-9_-]+)"/g);
    ['home', 'learn'].forEach(t => {
      try {
        add(provided, fs.readFileSync(path.join(ROOT, 'templates', 'modules', moduleId, t + '.html'), 'utf8'),
          /\bid="([A-Za-z0-9_-]+)"/g);
      } catch (e) { }
    });
    /* The shell's own screens and features add a few more at runtime. */
    ['js/nav.js', 'js/auth.js', 'js/features/notes.js', 'js/features/coach.js',
      'js/features/help.js', 'js/features/chat.js', 'js/features/voice.js', 'js/app.js'
    ].forEach(f => {
      try { add(provided, fs.readFileSync(path.join(ROOT, f), 'utf8'), /\bid="([A-Za-z0-9_-]+)"/g); } catch (e) { }
    });

    const orphans = [...read].filter(id => !provided.has(id)).sort();
    if (orphans.length) {
      broken.push('HOST: the program writes into ' + orphans.map(o => '#' + o).join(', ') +
        ', which nothing on the page provides — shell.html has no such element and the module does not create one');
    }
  })();

  /* ── The seams the shell asks this module for ────────────────
     Each is called by shell code that has no idea which program is running, so
     a missing one is a TypeError in the header or the notes panel rather than
     on any page the passes above visit. */
  ['tabFor', 'beforeNavigate', 'renderModal', 'noteScope', 'noteScopeLabel', 'coachContext'].forEach(h => {
    if (!G.Modules.hook(h)) broken.push('SEAM: the module defines no ' + h + '() hook');
  });
  try {
    const presets = G.Modules.coachPresets();
    if (!presets || !presets.length) broken.push('SEAM: coachPresets() gave nothing');
    if (!G.Modules.coachSystem()) broken.push('SEAM: coachSystem() gave nothing');
    const scope = G.Modules.hook('noteScope')();
    if (!scope || typeof scope.key !== 'string') broken.push('SEAM: noteScope() did not answer with a {key,label}');
  } catch (e) { record('SEAM', e); }
  /* The tab the header lights up has to be one the catalogue actually shows,
     or the program renders with no tab selected at all. */
  try {
    const tabs = Object.keys(G.Modules.active().tabs || {});
    cfg.pages.concat(cfg.pages.indexOf('drills') >= 0 ? ['drill'] : []).forEach(p => {
      const t = G.Modules.hook('tabFor')(p);
      if (t && tabs.indexOf(t) < 0) broken.push('SEAM: tabFor("' + p + '") named "' + t + '", which is not a tab in the catalogue');
    });
  } catch (e) { record('SEAM tabFor', e); }

  /* ── Export ────────────────────────────────────────────────── */
  let exported = null;
  G.URL.createObjectURL = blob => { exported = blob; return 'blob:smoke'; };
  try { G.exportState(); } catch (e) { record('EXPORT', e); }
  if (!exported) broken.push('EXPORT: produced no file');
  else {
    let doc = null;
    try { doc = JSON.parse(exported.text || ''); } catch (e) { }
    if (!doc) broken.push('EXPORT: the payload is not readable JSON');
    else {
      if (doc.module !== moduleId) broken.push('EXPORT: stamped module="' + doc.module + '", expected "' + moduleId + '"');
      if (!doc.data || !Array.isArray(doc.data.decisions)) broken.push('EXPORT: the payload carries no workspace');
    }
  }

  /* ── What reaches the database ─────────────────────────────────
     The workspace table is keyed (organization_id, module), so a save that
     names the wrong module files a program's document under another program.
     Server mode is decided by location.protocol, so a second sandbox is loaded
     in served mode with a fetch that RECORDS instead of sending. Nothing leaves
     the process and no database is touched; what is asserted is the request the
     browser would have made. */
  const sent = [];
  const S = makeSandbox(moduleId, true);
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
  FILES.forEach(p => {
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), S, { filename: path.relative(ROOT, p).replace(/\\/g, '/') }); }
    catch (e) { broken.push('DB LOAD ' + path.basename(p) + ' → ' + ((e && e.message) || e)); }
  });
  try {
    const b = S.createOrg('DB Check', { name: 'Owner', username: 'owner', passcode: '1234' }, {}, roleOf(moduleId));
    S.currentUserId = b.userId;
    const orgs = S.Store.getOrgs();
    orgs.forEach(o => { if (o.id === S.currentOrgId) o.serverId = S.currentOrgId; });
    S.Store.setOrgs(orgs);
    S.USERS.forEach(u => { if (u.id === S.currentUserId) u.serverId = 'usr_dbcheck'; });
    S.data = S.Modules.emptyData();
    sent.length = 0;                    // ignore whatever booting sent; watch the seed only
    S.runSeed('sample');
  } catch (e) { record('DB seed', e); }

  const saves = sent.filter(r => /\/workspace$/.test(r.url) && r.method === 'POST');
  if (!saves.length) broken.push('DB: seeding sent no workspace save');
  else saves.forEach(s => {
    if (!s.body) { broken.push('DB: a workspace save carried no body'); return; }
    if (s.body.module !== moduleId) {
      broken.push('DB: a workspace save named module="' + s.body.module + '", expected "' + moduleId + '"');
    }
    if (s.body.base_rev !== null) broken.push('DB: the seed save was not a force-save (base_rev=' + s.body.base_rev + ')');
    if (!s.body.doc || !Array.isArray(s.body.doc.decisions) || !s.body.doc.decisions.length) {
      broken.push('DB: the saved document is not this program\'s');
    }
  });

  /* ── Concurrent edits ──────────────────────────────────────────
     `decisions` is an ARRAY of records, not the id-keyed object every
     Enterprise program's collections are, and Store.commit names one by id
     either way. Before mergeDirtyInto learned the array shape, a 409 overlay
     wrote decisions['<id>'] onto an array — a property JSON.stringify drops,
     so the record the user had just edited vanished on the next save with
     nothing in the console. */
  try {
    const fresh = { decisions: [{ id: 'a', title: 'theirs' }] };
    const local = { decisions: [{ id: 'a', title: 'theirs' }, { id: 'b', title: 'mine' }] };
    const merged = S.Store.mergeDirtyInto(fresh, local, ['decisions::b']);
    const round = JSON.parse(JSON.stringify(merged));
    const kept = (round.decisions || []).filter(r => r && r.id === 'b')[0];
    if (!kept || kept.title !== 'mine') {
      broken.push('MERGE: a stale-write overlay lost the record this browser had edited');
    }
  } catch (e) { record('MERGE', e); }

  return { moduleId, broken, other, handlersRun, pagesRendered };
}

/* ── Run ───────────────────────────────────────────────────────── */
const which = process.argv.filter(a => !a.startsWith('-'))[2] || 'all';
const targets = which === 'all' ? Object.keys(PROGRAMS) : [which];
if (targets.some(t => !PROGRAMS[t])) {
  console.error('usage: node tools/leader-module-smoke.js [' + Object.keys(PROGRAMS).join('|') + '|all] [-v]');
  process.exit(2);
}

let failed = false;
targets.forEach(id => {
  const r = run(id);
  console.log('\n──────────────────────────────────────────');
  console.log(id + ' page smoke');
  console.log('  pages rendered  :', r.pagesRendered);
  console.log('  handlers pulled :', r.handlersRun);
  if (r.other.size) {
    const total = [...r.other.values()].reduce((a, b) => a + b, 0);
    console.log('  handler noise   :', total, 'in', r.other.size, 'kinds (not port failures' + (VERBOSE ? '' : '; -v to list') + ')');
    if (VERBOSE) [...r.other.entries()].sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log('      ' + String(n).padStart(5) + '  ' + m));
  }
  if (r.broken.length) {
    failed = true;
    console.log('  BROKEN          :', r.broken.length);
    console.log('──────────────────────────────────────────');
    r.broken.slice(0, 60).forEach(b => console.log('  ✗ ' + b));
    if (r.broken.length > 60) console.log('  … and ' + (r.broken.length - 60) + ' more');
  } else {
    console.log('  ✓ every page renders and every handler resolves');
    console.log('──────────────────────────────────────────');
  }
});
process.exit(failed ? 1 : 0);
