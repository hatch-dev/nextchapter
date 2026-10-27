#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   exec-readiness-diff.js — is the ported program the same program?
   ─────────────────────────────────────────────────────────────
   exec-readiness-smoke.js answers "does every page work". This
   answers the question that actually matters about a port: does every
   page say the same thing it said in the build it came from.

   Both apps are loaded into their own stub-DOM sandbox — the reference
   from enterprises/dev/executive-readiness-prototype (a complete standalone copy of
   the whole application) and the module from this tree — given the SAME
   workspace document, and then asked for the same 35 pages. The markup
   comes back as strings, and the strings are compared.

   Reading a diff of steps.js against the reference cannot tell you
   this. The port renames every function, repoints every handler,
   rewrites every media path and drops the pages into a different shell;
   the text is expected to differ. What must not differ is what the
   reader ends up looking at.

   ── The known, intended differences ───────────────────────────
   Five, and they are normalised away rather than ignored, so that a
   sixth one shows up as a failure:

     ER.foo(…)      handlers carry the module's namespace here, because
                    the shell has its own renderStep12 and the two must
                    not collide (see tools/port-exec-readiness.js).
     media paths    the reference was a flat folder, and now points at
                    ../../../assets/media/exec-readiness/ — the same folder
                    reached from enterprises/dev/executive-readiness-prototype/, where
                    the review copy is served. The module reaches it from
                    <base href="/apps/">, so it writes the path with no hops.
     page ids       go('readiness') / 'phaseHome' are go('pipeline') /
                    'phase' — the names every module in this suite
                    shares. The tab still reads "Readiness".
     badge markup   badge() is the SHELL's, shared by all twelve
                    programs, and it moved from a per-call inline style
                    to `class="bg bg-tinted" style="--c:…"` with the
                    tint in CSS (.bg-tinted, assets/css/styles.css).
                    The reference still writes background:#XXXXXX18 by
                    hand. This is the one normalisation that is not a
                    pure rename: the CSS mixes the text colour 50% into
                    --paper, so a badge is a little lighter here than in
                    the reference. That is the shell's decision, made
                    for legibility in dark mode, and changing it back
                    would change every program's badges. Normalised
                    because it is not this program's content — but it is
                    the reason a badge is not pixel-identical.
     sign-off       every done button here carries `disabled` and a
                    .done-helper line, because a step belongs to its
                    assignee and, unassigned, to the administrator
                    (ruled 9 Sep 2026). The reference build has no team
                    model at all, so it cannot have them. This is the one
                    difference the module ADDS rather than renames; it is
                    grafted by a PATCH in the port script.

   Anything else is a real difference in what the program shows, and it
   is printed with the first character that differs and the text either
   side of it.

   Usage:  node tools/exec-readiness-diff.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REF_DIR = path.join(ROOT, 'enterprises', 'dev', 'executive-readiness-prototype');
const VERBOSE = process.argv.indexOf('-v') >= 0;

/* Both realms run on one frozen clock. Half these pages print a day count off
   the program start date, and two runs either side of midnight would differ for
   a reason that has nothing to do with the port. */
const RealDate = Date;
const CANON = new RealDate(2026, 6, 7, 12, 0, 0).getTime();
const FrozenDate = class extends RealDate {
  constructor(...a) { a.length === 0 ? super(CANON) : super(...a); }
  static now() { return CANON; }
};

const STEPS = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4',
  '3.1', '3.2', '3.3', '3.4', '3.5', '4.1', '4.2', '4.3', '4.4', '5.2', '5.3'];
const OUTCOMES = ['out-readiness', 'out-inventory', 'out-riskmap', 'out-structure',
  'out-collab', 'out-competency', 'out-fluency', 'out-decisions', 'out-mmprinciples',
  'out-values', 'out-rhythm', 'out-evalplan', 'out-review'];

/* ── Stub browser ──────────────────────────────────────────────
   The same shape as tools/exec-readiness-smoke.js, and deliberately a separate
   copy: this file has to build TWO independent sandboxes, and sharing element
   identity between them would let one app's writes show up in the other's
   render. */
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

function makeSandbox(search, catalogue) {
  const byId = Object.create(null);
  const sandbox = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: catalogue || undefined,
    localStorage: storage(), sessionStorage: storage(),
    document: {
      getElementById(id) { if (!byId[id]) { byId[id] = el(); byId[id].id = id; } return byId[id]; },
      querySelector() { return el(); }, querySelectorAll() { return []; },
      createElement(t) { return el(t); }, createDocumentFragment() { return el(); },
      createTextNode() { return el(); },
      addEventListener() { }, removeEventListener() { },
      readyState: 'complete', activeElement: null,
      body: el('body'), documentElement: el('html'), head: el('head'), title: ''
    },
    location: {
      href: 'file:///index.html' + search, protocol: 'file:', host: '', hostname: '', port: '',
      pathname: '/index.html', search: search, hash: '', origin: 'null',
      assign() { }, replace() { }, reload() { }
    },
    history: { pushState() { }, replaceState() { }, back() { }, forward() { }, go() { }, length: 1, state: null },
    navigator: { userAgent: 'diff', language: 'en-US', languages: ['en-US'], onLine: false, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:diff', revokeObjectURL() { } },
    Blob: function () { },
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    matchMedia: () => ({ matches: false, media: '', addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
    addEventListener() { }, removeEventListener() { },
    open() { return null; }, scrollTo() { }, print() { },
    confirm: () => true, alert() { }, prompt: () => null,
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    FileReader: function () { this.readAsText = () => { }; this.readAsDataURL = () => { }; this.addEventListener = () => { }; },
    fetch: () => settled('err', new Error('diff: no server')),
    getComputedStyle: () => ({ getPropertyValue: () => '' })
  };
  vm.createContext(sandbox);
  sandbox.Date = FrozenDate;
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  return sandbox;
}

function run(sandbox, files) {
  files.forEach(p => {
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: path.basename(p) }); }
    catch (e) { console.error('LOAD ' + path.basename(p) + ': ' + ((e && e.message) || e)); process.exit(1); }
  });
}

/* ── The workspace both apps are given ─────────────────────────
   One document, deep-copied into each realm, so every page has the same
   leaders, roles, scores and completions to draw. Anything a page derives from
   this must derive identically on both sides or the port has changed it. */
const WORKSPACE = {
  leaders: [
    { id: 'L1', name: 'Ada Kern', role: 'CEO', fluency: 'developing', changeExp: 'strong', bandwidth: 'stretched', engagement: 'champion', scope: 'Whole organization' },
    { id: 'L2', name: 'Ravi Menon', role: 'CTO', fluency: 'fluent', changeExp: 'moderate', bandwidth: 'available', engagement: 'supportive', scope: 'Engineering' },
    { id: 'L3', name: 'Jo Baptiste', role: 'COO', fluency: 'novice', changeExp: 'limited', bandwidth: 'overloaded', engagement: 'sceptical', scope: 'Operations' }
  ],
  orgChart: [
    { id: 'board', name: 'Board', level: 0, parentId: '', occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: ['L1'], source: 'addition' },
    { id: 'R1', name: 'Chief Executive', level: 1, parentId: 'board', occupantLeaderId: 'L1', guidingConcepts: 'Sets the pace.', taggedValues: ['v1'], members: [], source: 'leader' },
    { id: 'R2', name: 'Chief Technology', level: 2, parentId: 'R1', occupantLeaderId: 'L2', guidingConcepts: '', taggedValues: [], members: [], source: 'leader' },
    { id: 'R3', name: 'Chief Operating', level: 2, parentId: 'R1', occupantLeaderId: 'L3', guidingConcepts: '', taggedValues: [], members: [], source: 'leader' }
  ],
  assessments: {
    purpose: { clarity: 4, aiAlignment: 3, coherence: 4, mission: 'Ship trustworthy systems.', priorities: 'Trust, speed, margin.', aiStrategy: 'Augment judgment.' },
    fluency: { foundational: 3, failureModes: 2, costRisk: 3, strategic: 4, handsOn: 2, engagement: 'Weekly', tools: 'Claude, internal copilot' },
    change: { trackRecord: 3, fatigue: 4, middleMgmt: 2, psySafety: 4, learningCulture: 3, recentChange: 'ERP migration, 2025.' },
    structure: { crossCollab: 3, mmRole: 2, ownership: 'ceo', boardOversight: 'full', crossFunc: 'council', decisionStructure: 'Council recommends, CEO decides.', gaps: 'No data owner.' },
    ethical: { identity: 4, evidence: 3, commitments: 3, assumptions: 2, workforce: 'No involuntary reductions.', lines: 'No automated dismissals.' }
  },
  completedSections: { A: true, B: true, C: true },
  completedSteps: { '1.1': true, '1.2': true, '1.3': true, '2.1': true },
  stepDoneAt: { '1.1': '2026-05-04', '1.2': '2026-05-12', '1.3': '2026-05-20', '2.1': '2026-06-02' },
  stepDue: { '2.2': '2026-07-20', '2.3': '2026-07-28' },
  risks: [{ id: 'zillow', likelihood: 3, impact: 4 }, { id: 'cigna', likelihood: 2, impact: 5 }],
  riskNotes: { zillow: 'Our pricing model has the same shape.' },
  landscapeNotes: { ownershipGap: 'No single owner below the CEO.', mmAssessment: 'Thin in operations.' },
  structure: { ownerModel: 'ceo', ownerWho: 'Ada Kern', boardStructure: 'committee', seniorDecisionRights: 'Council recommends.' },
  collabPrinciples: { aiVoice: 'Advisory only.', touchpoints: 'Triage, drafting, research.' },
  collabLab: { touchCustomer: 'Support triage', personaBoundaries: 'Never speaks as a person.', aiFreeZones: 'Performance reviews.' },
  competencyFramework: { scores: { L1_orchestration: 3, L2_hybrid: 4, L3_composure: 2 }, definitions: { orchestration: 'Directing hybrid teams.' } },
  valuesArch: [{ id: 'v1', principle: 'Evidence over instinct', domain: 'epistemological' }, { id: 'v2', principle: 'Name the cost', domain: 'ethical' }],
  valuesDiscussion: { divergences: 'Speed vs. certainty.', embedding: 'Into the review template.' },
  decisionSims: { autonomous_response: 'Escalate to the council.', autonomous_premortem: 'Who is harmed first?', ethical_premortem: 'Whose consent did we assume?' },
  fluencySprint: { project: 'Support triage', projectWorkflow: 'Draft then review.', filter: 'Judgment stays human.', leaderTasks: { L1: { task1: 'Drafted the brief' }, L2: { task1: 'x', task2: 'y' } } },
  mmActivation: { workflows: ['Triage', 'Escalation'], humanOnly: ['Terminations'], logCadence: 'weekly', evalCriteria: 'Quality of escalation.' },
  opRhythm: { agenda: 'Monthly AI review', agendaOwner: 'Ada', peerStructure: 'Trios', simFreq: 'quarterly' },
  rhythm: { cadence: 'monthly' },
  evaluation: { criteria: 'AI-readiness indicators' },
  evalSuccession: { indicators: 'Judgment under uncertainty', bench: 'Two deep at every seat', boardFluency: 'One director fluent.' },
  leadershipReview: { structWorking: 'The council works.', structRevision: 'Give ops a data owner.', leaders: { L1: { assessment: 'Strong', notes: 'Keep pace.' } } },
  slowThinking: [{ date: '2026-07-01', note: 'Held the decision a week.' }],
  practiceLog: {}, practicePeriod: '2026-07',
  indivDone: { L1: { '1.4': true } },
  mindsetStudy: { L1: { theme1: 'Agency', dwAgents: 'Delegation without abdication.' } },
  mindsetDepth: { L1: { val1: 'Honesty', case1: 'The pricing call.' } },
  mindsetApp: { L1: { atrophySkill: 'Writing from scratch', practice: 'One unaided draft a week.' } },
  composure: { L1: { constants: 'We tell people first.', stop1: 'Name the decision.' } },
  depScan: [], decisions: [], scenarios: [], fluencyLog: [], competencies: {},
  review: {}, roles: [], notes: [], assigns: {}, members: [], enterprise: {}, orgSetup: false
};

/* ── The two realms ────────────────────────────────────────────── */
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'catalogue.json'), 'utf8'));

/* Reference: its own index.html names its scripts, so read them from there
   rather than pinning a list that could drift from the file it documents. */
/* index.html — the build's own entry page, which names its scripts. It was
   Exec-Readiness-index.html while these lived in a shared example-apps/ folder
   and every file needed a program prefix to stay distinct; each build has its
   own directory now. */
const refIndex = path.join(REF_DIR, 'index.html');
if (!fs.existsSync(refIndex)) {
  console.error('the reference build is not at ' + path.relative(ROOT, REF_DIR) + '.');
  console.error('If the review builds moved again, update REF_DIR here and in tools/port-exec-readiness.js.');
  process.exit(1);
}
const refHtml = fs.readFileSync(refIndex, 'utf8');
const REF_FILES = (refHtml.match(/<script\s+src="([^"]+)"/g) || [])
  .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
  .filter(s => !/^https?:/.test(s))
  .map(s => path.join(REF_DIR, s))
  .filter(p => fs.existsSync(p));

/* Module: shell.html plus the program's own scripts, spliced in where boot.js
   would have written them. */
const shellHtml = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');
const MOD_FILES = (shellHtml.match(/<script\s+src="([^"]+)"/g) || [])
  .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
  .filter(s => !/^https?:/.test(s))
  .map(s => path.join(ROOT, s))
  .filter(p => fs.existsSync(p));
{
  const mod = (CATALOGUE.roles || []).reduce((f, r) => f || (r.modules || []).filter(m => m.id === 'exec-readiness')[0], null);
  const at = MOD_FILES.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  MOD_FILES.splice(at >= 0 ? at + 1 : 0, 0,
    ...(mod.scripts || []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p)));
}

const REF = makeSandbox('', null);
run(REF, REF_FILES);
const MOD = makeSandbox('?module=exec-readiness', CATALOGUE.roles);
run(MOD, MOD_FILES);

function boot(G, label) {
  try {
    const b = G.createOrg(label + ' Org', { name: 'Owner', username: 'owner', passcode: '1234' });
    G.currentUserId = b.userId;
    if (typeof G.applyTeamRoster === 'function') G.applyTeamRoster();
  } catch (e) { console.error(label + ' boot: ' + ((e && e.message) || e)); process.exit(1); }
}
boot(REF, 'Reference');
boot(MOD, 'Module');

/* The workspace both realms are given, deep-copied so neither can reach the
   other's. The start date is pinned along with the clock: half these pages print
   "Day n of 90" off it, and a different start date would move every timeline
   marker for a reason that has nothing to do with the port. */
function loadWorkspace(doc) {
  [REF, MOD].forEach(G => {
    G.data = JSON.parse(JSON.stringify(doc));
    G.data.startDate = '2026-04-28';
    try { G.applyTeamRoster(); } catch (e) { }
  });
  levelShell();   // applyTeamRoster() has just rebuilt USERS — see below
}

/* ── Levelling the shell underneath ────────────────────────────
   Two pieces of shared machinery answer differently in the two realms, and
   neither is this program's content. Pinned to the same answer on both sides so
   that what remains to compare is the program.

   USERS — the signed-in team. Built by applyTeamRoster() out of the workspace
   roster, and the two apps' versions of that function differ (the suite's knows
   about organizations and module membership; the reference's does not). Any
   page with a "link me to a leader" picker lists it, so an unequal roster looks
   like an unequal page.

   assignBtn — the suite's step-assignment control, and a generation newer here
   than in the reference (.assign-wrap and a class-based popover, versus inline
   styles). Shared by all twelve programs, so its markup is not a thing this
   port is allowed to change; replaced with a marker on both sides.

   Re-applied after every workspace load, because applyTeamRoster() rebuilds
   USERS from the document and the two apps rebuild it differently — the suite's
   falls back to a default team of six, the reference's leaves it empty. Pinning
   it once at boot looked like it worked and was silently undone on the next
   load, which showed up as three phantom differences on every page carrying a
   "link me to a leader" picker. */
const TEAM = [
  { id: 'u1', name: 'Ada Kern', username: 'ada', initials: 'AK', color: '#4E7FA6', passcode: '1234', role: 'owner' },
  { id: 'u2', name: 'Ravi Menon', username: 'ravi', initials: 'RM', color: '#8B5E3C', passcode: '1234', role: 'member' },
  { id: 'u3', name: 'Jo Baptiste', username: 'jo', initials: 'JB', color: '#6B4C8A', passcode: '1234', role: 'member' }
];
function levelShell() {
  [REF, MOD].forEach(G => {
    G.USERS.length = 0;
    TEAM.forEach(u => G.USERS.push(JSON.parse(JSON.stringify(u))));
    G.currentUserId = 'u1';
    G.assignBtn = () => '[ASSIGN-CONTROL]';
  });
}
levelShell();

/* ── Normalisation ─────────────────────────────────────────────
   The three intended differences, and nothing else. Kept as narrow rules rather
   than a general scrub so that an unintended difference cannot hide inside one
   of them. */
const MEDIA_PREFIX = 'assets/media/exec-readiness/';
function normalise(html) {
  return String(html)
    .replace(/\bER\./g, '')                       // the module's namespace
    .replace(new RegExp('(?:\\.\\./)*' + MEDIA_PREFIX, 'g'), '')  // the media folder, with the review copy's hops out of its own directory
    .replace(/(['"])pipeline\1/g, '$1readiness$1')// the shared page ids
    .replace(/(['"])phase\1/g, '$1phaseHome$1')
    /* The shell's badge, both spellings collapsed to the colour it is tinted
       with. The colour is not always a hex: badge() also takes var(--text-body),
       which the reference concatenated '18' onto — `background:var(--text-body)18`,
       an invalid declaration the browser dropped, so those badges had no
       background at all there. The shell's color-mix() form gives them one. */
    .replace(/class="bg bg-tinted" style="--c:([^"]+)"/g, 'BADGE[$1]')
    .replace(/class="bg" style="background:(.+?)18;color:\1"/g, 'BADGE[$1]')
    /* The step sign-off graft. The reference build has no team model, so its
       done button is always live; here a step belongs to whoever it is
       assigned to, and to the administrator when it is assigned to nobody
       (ruled 9 Sep 2026). tools/port-exec-readiness.js grafts that on as a
       PATCH, so every done button in the module carries `disabled` and a
       .done-helper line the reference cannot have. It is the one difference
       the module ADDS rather than renames - the reason it is normalised
       rather than ignored is that everything else on those 50 screens still
       has to match. */
    .replace(/(class="btn bd done-btn"[^>]*?) disabled/g, '$1')
    .replace(/<p class="done-helper">[\s\S]*?<\/p>/g, '');
}

/* ── What gets compared ────────────────────────────────────────
   One render per address is not one render per screen. Six of these steps are
   tab strips over quite different bodies — 1.1 alone has five sections, and
   opening the second one is where a port that got the first one right can still
   be wrong. So each tabbed step is compared once per tab, with the tab set taken
   from the step's own `order` array rather than guessed at.

   The Lead tab is compared twice more: with a role selected on the org chart
   (the detail panel) and with the chart in edit mode (the role form). */
const TABS = {
  '1.1': ['sec', ['A', 'B', 'C', 'D', 'E']],
  '1.2': ['llPage', ['inventory', 'hierarchy']],
  '1.4': ['mfTab', ['intro', 'workforce', 'atrophy']],
  '2.1': ['structSec', ['ownership', 'board', 'senior', 'middle', 'crossfunc']],
  '2.2': ['collabSec', ['touchpoints', 'models', 'personas', 'aifree', 'translation']],
  '3.4': ['vaTab', ['principles', 'synthesis', 'tagging']],
  '4.4': ['crTab', ['reflections', 'stop', 'slowlog']]
};

const PAGES = [{ id: 'overview' }]
  .concat([1, 2, 3, 4].map(n => ({ id: 'phase-' + n, phase: n })))
  .concat([{ id: 'dashboard' }])
  .concat([{ id: 'dashboard (role selected)', ui: { orgSelected: 'R2' } }])
  .concat([{ id: 'dashboard (role form)', ui: { orgEditId: 'R2' } }])
  .concat([{ id: 'dashboard (add role)', ui: { orgAddForm: true } }])
  .concat(STEPS.reduce((acc, s) => {
    const t = TABS[s];
    if (!t) return acc.concat([{ id: 'step ' + s, step: s }]);
    return acc.concat(t[1].map(v => ({ id: 'step ' + s + ' · ' + v, step: s, ui: { [t[0]]: v } })));
  }, []))
  .concat(OUTCOMES.map(o => ({ id: o, outcome: o })));

/* Each side is asked for a page the way that app asks for it. The reference has
   one flat set of globals; the module publishes the same renderers on ER and
   reaches the step and outcome shells through its page table. */
function renderRef(G, p) {
  if (p.id === 'overview') return G.renderOverview();
  if (p.phase) return G.renderPhaseHome(p.phase);
  if (p.id === 'dashboard') return G.renderDashboard();
  if (p.step) { G.currentPage = 'step'; setStep(G, p.step); return G.renderStep(); }
  G.currentPage = 'outcome'; setStep(G, p.outcome); return G.renderOutcomePage();
}
function renderMod(G, p) {
  if (p.id === 'overview') return G.Modules.page('pipeline')();
  if (p.phase) { G.currentPhase = null; G.currentStep = String(p.phase); return G.Modules.page('phase')(); }
  if (p.id === 'dashboard') return G.Modules.page('phase5')();
  if (p.step) { G.currentPage = 'step'; setStep(G, p.step); return G.Modules.page('step')(); }
  G.currentPage = 'outcome'; setStep(G, p.outcome); return G.Modules.page('outcome')();
}
/* currentStep/currentPhase are set directly rather than through go(), which
   differs between the two apps by design (the module's runs a harvest hook and
   pushes a different history stack). What is under test is the page, not the
   router. */
function setStep(G, id) {
  G.currentStep = id;
  G.currentPhase = null;
  const PH = G.PH || [];
  for (let i = 0; i < PH.length; i++) {
    if ((PH[i].steps || []).some(s => s.id === id) || (PH[i].outcomes || []).some(o => o.id === id)) { G.currentPhase = PH[i]; break; }
  }
}

/* Both realms start each page from the same view state, so a page that opens on
   a tab cannot differ because the previous page left a different one behind. */
function resetUi(G) {
  G.UI.sec = 'A'; G.UI.ctxOpen = {}; G.UI.addForm = false; G.UI.editIdx = null;
  G.UI.orgAddForm = false; G.UI.orgEditId = null; G.UI.orgSelected = null; G.UI.orgZoom = 1;
  G.UI.llPage = 'inventory'; G.UI.llZoom = 1; G.UI.structSec = 'ownership';
  G.UI.collabSec = 'touchpoints'; G.UI.vaTab = null;
  G.UI.mfTab = 'intro'; G.UI.crTab = 'reflections'; G.UI.addLeaderOpen = false;
}

/* ── Every differing region, not just the first ─────────────────
   Reporting only the first divergence is how a second one hides behind a fix
   for the first: the assignment bar sits near the top of every step page, so
   for a while it was the only thing this tool could see, and anything below it
   was invisible.

   So: walk forward together, and on a mismatch look for the next place the two
   line up again — the next window of SYNC identical characters that occurs at
   the same relative position in both. Not a minimal diff, and it does not need
   to be. It needs to show every place they disagree. */
const SYNC = 48;
function hunksBetween(a, b, max) {
  max = max || 6;
  const hunks = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length && hunks.length < max) {
    if (a[i] === b[j]) { i++; j++; continue; }
    const start = { i, j };
    // Widen a window on both sides until the tails line up again, or we run out.
    let found = false;
    for (let d = 1; d < 4000 && !found; d++) {
      for (const [di, dj] of [[d, d], [d, 0], [0, d]]) {
        if (i + di + SYNC > a.length || j + dj + SYNC > b.length) continue;
        if (a.substr(i + di, SYNC) === b.substr(j + dj, SYNC)) {
          hunks.push({
            at: start.i,
            ref: a.slice(Math.max(0, start.i - 50), i + di).slice(-190),
            mod: b.slice(Math.max(0, start.j - 50), j + dj).slice(-190)
          });
          i += di; j += dj; found = true; break;
        }
      }
    }
    if (!found) {
      hunks.push({ at: start.i, ref: a.slice(start.i, start.i + 190), mod: b.slice(start.j, start.j + 190) });
      break;
    }
  }
  if (!hunks.length && a.length !== b.length) {
    const at = Math.min(a.length, b.length);
    hunks.push({ at, ref: a.slice(at, at + 190), mod: b.slice(at, at + 190) });
  }
  return hunks;
}

let same = 0, compared = 0;
const differ = [];
const errors = [];

function comparePass(label) {
  if (VERBOSE) console.log('\n' + label);
  PAGES.forEach(p => {
    let a, b;
    const where = label + ' · ' + p.id;
    compared++;
    resetUi(REF); resetUi(MOD);
    if (p.ui) [REF, MOD].forEach(G => Object.keys(p.ui).forEach(k => { G.UI[k] = p.ui[k]; }));
    try { a = renderRef(REF, p); } catch (e) { errors.push('reference ' + where + ' → ' + ((e && e.message) || e)); return; }
    try { b = renderMod(MOD, p); } catch (e) { errors.push('module ' + where + ' → ' + ((e && e.message) || e)); return; }

    const na = normalise(a), nb = normalise(b);
    if (na === nb) {
      same++;
      if (VERBOSE) console.log('  = ' + p.id.padEnd(24) + String(a.length).padStart(7) + ' chars');
      return;
    }
    differ.push({ id: where, lenRef: na.length, lenMod: nb.length, hunks: hunksBetween(na, nb) });
  });
}

/* Both halves of the program: the workspace a team has been working in, and the
   one the first person to open it sees. The empty pass is not a formality — it
   is where the null guards live, and a page can be identical with data in it and
   differ completely without. */
loadWorkspace(WORKSPACE);
comparePass('populated');
loadWorkspace(MOD.Modules.emptyData());
comparePass('empty');

console.log('\n──────────────────────────────────────────');
console.log('Executive Readiness — module vs reference build');
console.log('  renders compared:', compared);
console.log('  identical       :', same);
if (errors.length) {
  console.log('  ERRORED        :', errors.length);
  errors.forEach(e => console.log('    ! ' + e));
}
if (differ.length) {
  console.log('  DIFFERENT      :', differ.length);
  console.log('──────────────────────────────────────────');
  differ.forEach(d => {
    console.log('\n  ✗ ' + d.id + '   (reference ' + d.lenRef + ' chars, module ' + d.lenMod + ')  '
      + d.hunks.length + ' differing region' + (d.hunks.length === 1 ? '' : 's'));
    d.hunks.forEach(h => {
      console.log('      at ' + h.at);
      console.log('        reference: …' + h.ref.replace(/\n/g, '\\n') + '…');
      console.log('        module   : …' + h.mod.replace(/\n/g, '\\n') + '…');
    });
  });
  process.exit(1);
}
if (errors.length) process.exit(1);
console.log('  ✓ every page renders byte-identical markup');
console.log('──────────────────────────────────────────');
