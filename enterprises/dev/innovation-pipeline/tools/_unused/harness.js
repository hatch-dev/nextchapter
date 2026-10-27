#!/usr/bin/env node
/* ── CANONICAL CLOCK ────────────────────────────────────────────
   seedData() anchors the sample org at (today − 70 days). The capital
   ledger identities in this harness were hand-derived (July 6–7, 2026)
   under a late-April anchor; whenever (today − 70) crosses a month
   boundary the month-anchored window math shifts and ~25 identity pins
   go stale — first observed July 10, 2026 (anchor Apr 30 → May 1).
   Fix: both realms (harness + app sandbox) run on a clock frozen at
   2026-07-07 12:00, the re-derivation date (seed anchor Apr 28). Pins
   constructed with explicit date arguments are unaffected; zero-arg
   `new Date()` and `Date.now()` return the canonical instant. The
   identities themselves are untouched. */
const __RealDate = Date;
const __CANON = new __RealDate(2026, 6, 7, 12, 0, 0).getTime();
const __FrozenDate = class extends __RealDate {
  constructor(...a) { a.length === 0 ? super(__CANON) : super(...a); }
  static now() { return __CANON; }
};
Date = __FrozenDate; // eslint-disable-line no-global-assign
/* ─────────────────────────────────────────────────────────────
   harness.js — behavioral harness for the AI Innovation Pipeline
   Rebuilt in the new environment per Handoff Briefing §5.

   Pattern (as specified): load app.js into a Node `vm` context with
   Proxy-element DOM stubs, a permissive document.getElementById,
   stubbed confirm/alert/addEventListener, an in-memory localStorage,
   then bootstrap an org and call seedData()/emptyData() and assert on
   rendered HTML strings and on `data` mutations.

   Grows with every change. A failing assertion is investigated in
   BOTH directions — the app may be wrong, or the assertion may be.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* app.js was split into per-screen / per-feature modules (js/*.js, js/features,
   js/steps, js/pages, js/dev) — all still plain global scripts. shell.html is the
   single source of truth for the load order, so read the <script src> list from
   there rather than pinning a list here that drifts.

   shell.html, not index.html: the app is served through a front controller now
   (index.php resolves /apps/{role}/{module} and renders shell.html with the
   route injected). The markup deliberately stayed in a plain .html file so this
   harness, which has no PHP, can still read the script list straight off disk. */
const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');
const APP_FILES = (html.match(/<script\s+src="([^"]+)"/g) || [])
  .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
  .filter(s => !/^https?:/.test(s))
  .map(s => path.join(ROOT, s))
  .filter(p => fs.existsSync(p));

/* The roles and their modules live in config/catalogue.json. In the browser the
   front controller injects it as window.APP_CATALOGUE before registry.js runs;
   here we read the file and hand it over the same way, so the harness exercises
   the real registry rather than a stand-in. */
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'catalogue.json'), 'utf8'));

/* The active program module's code is NOT in shell.html: js/modules/boot.js
   document.writes it at parse time, because which program is running isn't
   known until the URL has been resolved (js/modules/registry.js). The harness
   has no document.write, so it resolves the same list the same way boot.js
   would — by asking the registry — and splices it in right after boot.js, which
   is where the browser would have inserted it. Default module (no APP_BOOT, no
   ?module= and no stored preference) = the Pipeline, which is what these tests
   cover. */
function moduleScriptsFor(id) {
  const regPath = path.join(ROOT, 'js', 'modules', 'registry.js');
  if (!fs.existsSync(regPath)) return [];
  const box = {
    window: { APP_CATALOGUE: CATALOGUE.roles },
    location: { search: '' }, localStorage: { getItem: () => null }
  };
  box.window.location = box.location; box.window.localStorage = box.localStorage;
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(regPath, 'utf8'), box, { filename: 'js/modules/registry.js' });
  const entry = box.window.Modules.byId(id);
  return (entry ? entry.scripts || [] : []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p));
}
{
  const bootAt = APP_FILES.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  const mods = moduleScriptsFor('pipeline');
  if (bootAt >= 0) APP_FILES.splice(bootAt + 1, 0, ...mods);
  else APP_FILES.unshift(...mods);
}
const SOURCES = APP_FILES.map(p => ({
  filename: path.relative(ROOT, p).replace(/\\/g, '/'),
  code: fs.readFileSync(p, 'utf8')
}));

/* ── assertion plumbing ─────────────────────────────────────── */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; failures.push(label); }
}
function eq(actual, expected, label) {
  ok(JSON.stringify(actual) === JSON.stringify(expected),
     label + '  (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')');
}
function has(str, sub, label) {
  ok(typeof str === 'string' && str.indexOf(sub) >= 0, label + '  (missing "' + sub + '")');
}
function nonEmptyStr(v, label) {
  ok(typeof v === 'string' && v.length > 0, label + '  (not a non-empty string)');
}
function noThrow(fn, label) {
  try { const r = fn(); pass++; return r; }
  catch (e) { fail++; failures.push(label + '  (threw: ' + (e && e.message) + ')'); return undefined; }
}

/* ── DOM / browser stubs ────────────────────────────────────── */
const NUM = {scrollTop:1,scrollHeight:1,scrollLeft:1,scrollWidth:1,offsetTop:1,offsetLeft:1,
  offsetWidth:1,offsetHeight:1,clientTop:1,clientLeft:1,clientWidth:1,clientHeight:1,
  selectionStart:1,selectionEnd:1,length:1,childElementCount:1};
const STR = {innerHTML:1,outerHTML:1,textContent:1,innerText:1,value:1,className:1,id:1,
  name:1,type:1,href:1,src:1,title:1,placeholder:1,tagName:1,nodeName:1};

function classList() {
  const s = Object.create(null);
  return {
    add()    { for (let i=0;i<arguments.length;i++) s[arguments[i]]=1; },
    remove() { for (let i=0;i<arguments.length;i++) delete s[arguments[i]]; },
    toggle(c,f){ const want = (f===undefined) ? !s[c] : !!f; if(want){s[c]=1;return true;} delete s[c]; return false; },
    contains(c){ return !!s[c]; }
  };
}
/* ── live-string DOM views (attribute + id selectors only) ──────
   The screen modules build their markup by parsing a template string
   and then writing through [data-*] hooks — nav.js is the clearest
   case: it lifts [data-region="right"] out of nav.html, injects it
   into #navRight, then fills [data-slot="more-menu"], flips classes
   on [data-act="more"], and sets the text of [data-slot="theme-label"].
   Against the permissive stub every one of those querySelector calls
   returned a throwaway element, so none of the writes were observable
   and the harness could not see the rendered nav at all.

   A LIVE VIEW fixes that without pulling in a DOM library: it re-locates
   its element inside the host's innerHTML on every access and splices
   writes back into that string. Offsets can never go stale because
   nothing is cached. Only [attr="value"] and #id selectors are
   supported — that is all these modules use; anything else falls back
   to the permissive throwaway element, so existing pins are untouched. */
const VOID_TAGS = {area:1,base:1,br:1,col:1,embed:1,hr:1,img:1,input:1,link:1,meta:1,param:1,source:1,track:1,wbr:1};
const rxEsc = s => String(s).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

function parseSel(sel) {
  const s = String(sel == null ? '' : sel).trim();
  let m = /^\[([\w:.-]+)="([^"]*)"\]$/.exec(s);
  if (m) return { attr: m[1], val: m[2] };
  m = /^#([\w:.-]+)$/.exec(s);
  if (m) return { attr: 'id', val: m[1] };
  return null;
}

/* Locate <tag ... attr="val" ...> … </tag> and report its boundaries. */
function locate(html, attr, val) {
  html = html || '';
  const open = new RegExp('<([a-zA-Z][\\w-]*)\\b[^>]*\\s' + rxEsc(attr) + '="' + rxEsc(val) + '"[^>]*>');
  const m = open.exec(html);
  if (!m) return null;
  const tag = m[1], openStart = m.index, innerStart = m.index + m[0].length;
  if (/\/>$/.test(m[0]) || VOID_TAGS[tag.toLowerCase()]) {
    return { tag, openTag:m[0], openStart, innerStart, innerEnd:innerStart, closeEnd:innerStart };
  }
  const scan = new RegExp('<' + tag + '\\b[^>]*>|</' + tag + '\\s*>', 'g');
  scan.lastIndex = innerStart;
  let depth = 1, t;
  while ((t = scan.exec(html))) {
    if (t[0].charAt(1) === '/') {
      if (--depth === 0) return { tag, openTag:m[0], openStart, innerStart, innerEnd:t.index, closeEnd:t.index + t[0].length };
    } else if (!/\/>$/.test(t[0])) depth++;
  }
  return null; // unbalanced — treat as no match
}

function liveView(host, attr, val) {
  const loc = () => locate(host.innerHTML || '', attr, val);
  const openTag = () => { const l = loc(); return l ? l.openTag : ''; };
  const setOpen = nt => { const l = loc(); if (!l) return; const h = host.innerHTML || '';
                          host.innerHTML = h.slice(0, l.openStart) + nt + h.slice(l.innerStart); };
  const getAttr = n => { const m = new RegExp('\\s' + rxEsc(n) + '="([^"]*)"').exec(openTag()); return m ? m[1] : null; };
  const setAttr = (n, v) => { const o = openTag(); if (!o) return;
    const re = new RegExp('\\s' + rxEsc(n) + '="[^"]*"');
    setOpen(re.test(o) ? o.replace(re, ' ' + n + '="' + v + '"') : o.replace(/\s*\/?>$/, m0 => ' ' + n + '="' + v + '"' + m0.trim())); };
  const cls = () => (getAttr('class') || '').split(/\s+/).filter(Boolean);

  const view = {
    nodeType: 1,
    get tagName() { const l = loc(); return l ? l.tag.toUpperCase() : 'DIV'; },
    get innerHTML() { const l = loc(); return l ? (host.innerHTML || '').slice(l.innerStart, l.innerEnd) : ''; },
    set innerHTML(v) { const l = loc(); if (!l) return; const h = host.innerHTML || '';
                       host.innerHTML = h.slice(0, l.innerStart) + (v == null ? '' : v) + h.slice(l.innerEnd); },
    get textContent() { return view.innerHTML.replace(/<[^>]*>/g, ''); },
    set textContent(v) { view.innerHTML = String(v == null ? '' : v).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); },
    get className() { return getAttr('class') || ''; },
    set className(v) { setAttr('class', v); },
    getAttribute: getAttr,
    setAttribute: setAttr,
    hasAttribute: n => getAttr(n) !== null,
    removeAttribute(n) { const o = openTag(); if (o) setOpen(o.replace(new RegExp('\\s' + rxEsc(n) + '="[^"]*"'), '')); },
    classList: {
      contains: c => cls().indexOf(c) >= 0,
      add(...cs) { const s = cls(); cs.forEach(c => { if (s.indexOf(c) < 0) s.push(c); }); setAttr('class', s.join(' ')); },
      remove(...cs) { setAttr('class', cls().filter(c => cs.indexOf(c) < 0).join(' ')); },
      toggle(c, f) { const s = cls(), had = s.indexOf(c) >= 0, want = (f === undefined) ? !had : !!f;
                     if (want && !had) s.push(c); if (!want && had) s.splice(s.indexOf(c), 1);
                     setAttr('class', s.join(' ')); return want; }
    },
    /* style writes land on the inline style attribute so they stay visible */
    style: new Proxy({}, {
      get: (_, k) => { const m = new RegExp('(?:^|;)\\s*' + rxEsc(String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase())) + '\\s*:\\s*([^;]*)').exec(getAttr('style') || ''); return m ? m[1].trim() : ''; },
      set: (_, k, v) => { const prop = String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase());
        const cur = (getAttr('style') || '').split(';').map(x => x.trim()).filter(Boolean).filter(x => x.split(':')[0].trim() !== prop);
        if (v !== '' && v != null) cur.push(prop + ':' + v);
        setAttr('style', cur.join(';')); return true; }
    }),
    querySelector(sel) { const p = parseSel(sel);
      return (p && locate(view.innerHTML, p.attr, p.val)) ? liveView(view, p.attr, p.val) : el(); },
    querySelectorAll() { return []; },
    closest: () => null, matches: () => false,
    addEventListener(){}, removeEventListener(){},
    scrollIntoView(){}, focus(){}, blur(){}, click(){},
    appendChild: a => a, insertBefore: a => a, removeChild: a => a,
    getBoundingClientRect: () => ({top:0,left:0,right:0,bottom:0,width:0,height:0}),
    get dataset() { const d = {}; const o = openTag();
      (o.match(/\sdata-[\w-]+="[^"]*"/g) || []).forEach(a => {
        const mm = /\sdata-([\w-]+)="([^"]*)"/.exec(a);
        if (mm) d[mm[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = mm[2];
      }); return d; }
  };
  return view;
}

function el(tag) {
  const t = {
    style: new Proxy({}, { get:(o,k)=> (k in o ? o[k] : ''), set:(o,k,v)=>{o[k]=v;return true;} }),
    classList: classList(), dataset: {}, children: [], childNodes: [],
    tagName: (tag||'div').toUpperCase(), nodeName: (tag||'div').toUpperCase(),
    nodeType: 1, value: '', innerHTML: '', textContent: '', className: '', id: ''
  };
  return new Proxy(t, {
    get(o, k) {
      if (typeof k === 'symbol') return o[k];
      if (k in o) return o[k];
      if (k === 'parentNode' || k === 'parentElement' || k === 'firstChild' ||
          k === 'lastChild' || k === 'nextSibling' || k === 'previousSibling') return null;
      if (k === 'files') return [];
      if (NUM[k]) return 0;
      if (STR[k]) return '';
      // If this element actually holds markup and the selector matches inside
      // it, hand back a live view so writes are observable (see liveView).
      // Otherwise keep the old permissive throwaway element.
      if (k === 'querySelector') return (sel) => {
        const p = parseSel(sel);
        return (p && locate(o.innerHTML || '', p.attr, p.val)) ? liveView(o, p.attr, p.val) : el();
      };
      if (k === 'querySelectorAll') return () => [];
      if (k === 'closest' || k === 'matches') return () => null;
      if (k === 'getBoundingClientRect') return () => ({top:0,left:0,right:0,bottom:0,width:0,height:0});
      if (k === 'getAttribute') return () => null;
      if (k === 'cloneNode') return () => el();
      if (k === 'appendChild' || k === 'insertBefore' || k === 'replaceChild') return (a)=>a;
      return () => el();                       // permissive no-op method → chainable
    },
    set(o, k, v) { o[k] = v; return true; }
  });
}

const _byId = Object.create(null);
const documentStub = {
  getElementById(id){ if(!_byId[id]){ _byId[id]=el(); _byId[id].id=id; } return _byId[id]; },
  querySelector(){ return el(); },
  querySelectorAll(){ return []; },
  createElement(t){ return el(t); },
  createDocumentFragment(){ return el(); },
  createTextNode(){ return el(); },
  addEventListener(){}, removeEventListener(){},
  readyState:'complete', activeElement:null,
  body: el('body'), documentElement: el('html'), head: el('head'), title:''
};

const _ls = new Map();
const localStorageStub = {
  getItem(k){ return _ls.has(k) ? _ls.get(k) : null; },
  setItem(k,v){ _ls.set(k, String(v)); },
  removeItem(k){ _ls.delete(k); },
  clear(){ _ls.clear(); },
  key(i){ return Array.from(_ls.keys())[i] || null; },
  get length(){ return _ls.size; }
};

/* sessionStorage is a second, independent bucket — Store keeps the
   "signed in until the browser closes" tier there, separate from prefs. */
const _ss = new Map();
const sessionStorageStub = {
  getItem(k){ return _ss.has(k) ? _ss.get(k) : null; },
  setItem(k,v){ _ss.set(k, String(v)); },
  removeItem(k){ _ss.delete(k); },
  clear(){ _ss.clear(); },
  key(i){ return Array.from(_ss.keys())[i] || null; },
  get length(){ return _ss.size; }
};

/* ── synchronous thenable (fetch only) ──────────────────────────
   Enough of the Promise surface for the app's fetch chains
   (.then(a,b) / .then(a).catch(b), thenable-returning handlers),
   but settled inline so a fetch failure and its fallback happen in
   the same tick. Used only by the fetch stub — real Promises
   elsewhere are untouched. */
function syncSettled(state, val) {
  const self = {
    then(onOk, onErr) {
      try {
        if (state === 'ok') return onOk ? syncAdopt(onOk(val)) : self;
        return onErr ? syncAdopt(onErr(val)) : self;
      } catch (e) { return syncSettled('err', e); }
    },
    catch(onErr) { return self.then(null, onErr); },
    finally(fn) { try { if (fn) fn(); } catch (e) { } return self; }
  };
  return self;
}
function syncAdopt(v) { return (v && typeof v.then === 'function') ? v : syncSettled('ok', v); }
function syncRejected(e) { return syncSettled('err', e); }

let alerts = [];
const sandbox = {
  console,
  /* The roles and their modules, exactly as the front controller injects them.
     APP_BOOT is deliberately absent: with no resolved route the registry takes
     its file:// path and falls back to the default module (the Pipeline), which
     is the program these tests cover. */
  APP_CATALOGUE: CATALOGUE.roles,
  localStorage: localStorageStub,
  sessionStorage: sessionStorageStub,
  document: documentStub,
  /* The split modules (auth.js, nav.js, chat.js, app.js) read location at
     top level to decide file:// vs served mode; the harness is the file://
     case, which is what the pre-split monolith assumed. */
  location: { href:'file:///index.html', protocol:'file:', host:'', hostname:'', port:'',
              pathname:'/index.html', search:'', hash:'', origin:'null',
              assign(){}, replace(){}, reload() {} },
  history: { pushState(){}, replaceState(){}, back(){}, forward(){}, go(){}, length:1, state:null },
  navigator: { userAgent:'harness', language:'en-US', languages:['en-US'], onLine:false,
               clipboard:{ writeText: () => Promise.resolve() } },
  URL: { createObjectURL: () => 'blob:harness', revokeObjectURL(){} },
  Blob: function(){},
  btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
  atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
  matchMedia: () => ({ matches:false, media:'', addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }),
  addEventListener(){}, removeEventListener(){},
  open(){ return null; },
  scrollTo(){},
  confirm: () => true,               // seedData() is gated on confirm()
  alert: (m) => { alerts.push(String(m)); },
  prompt: () => null,
  setTimeout: () => 0, clearTimeout(){},
  setInterval: () => 0, clearInterval(){},
  requestAnimationFrame: () => 0, cancelAnimationFrame(){},
  FileReader: function(){ this.readAsText=()=>{}; this.readAsDataURL=()=>{}; this.addEventListener=()=>{}; },
  /* The harness runs with no PHP API behind it, so every fetch is a network
     failure — which is the branch the app is written to survive (Auth falls
     back to the device-local roster, chat keeps its buffer, and so on).
     A REAL rejected Promise would defer those fallbacks to a microtask, and
     the adapter pins below assert same-tick answers; so fetch hands back a
     synchronous thenable that runs .then/.catch inline. Same code path, no
     scheduler in the middle. */
  fetch: () => syncRejected(new Error('harness: no server')),
  getComputedStyle: () => ({ getPropertyValue: () => '' })
};
vm.createContext(sandbox);
sandbox.Date = __FrozenDate; // canonical clock in the app realm too — see header
sandbox.window = sandbox;            // window.* resolves onto the same global
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

/* ── LOAD ───────────────────────────────────────────────────── */
SOURCES.forEach(s => {
  noThrow(() => vm.runInContext(s.code, sandbox, { filename:s.filename }),
          'LOAD: ' + s.filename + ' executes top-level (render + init IIFEs) without throwing');
});

const G = sandbox;   // the app's globals live here

/* ── BOOTSTRAP: org → seed ──────────────────────────────────── */
let boot;
noThrow(() => { boot = G.createOrg('Harness Org', {name:'Owner', username:'owner', passcode:'1234'}); },
        'BOOT: createOrg() succeeds');
if (boot) { G.currentUserId = boot.userId; }
noThrow(() => { if (typeof G.applyTeamRoster === 'function') G.applyTeamRoster(); },
        'BOOT: applyTeamRoster()');
noThrow(() => G.seedData(), 'BOOT: seedData() runs (incl. its internal render())');

const d = G.data;
ok(d && typeof d === 'object', 'BOOT: data is populated after seed');

/* ── SEED INTEGRITY (verifiable against Briefing §3) ────────── */
eq((d.ideas||[]).length, 20, 'SEED: 20 ideas');
eq((d.ideas||[]).filter(x=>x && x.when==='future').length, 6, 'SEED: 6 ideas marked future');
eq(d.selected, [0,1,2,3,4,11,12,13,14,15,16,17], 'SEED: selected = [0,1,2,3,4,11..17]');
eq(d.expSelected, [0,1,4,11,12,13], 'SEED: expSelected = [0,1,4,11,12,13] (launched stay in expSelected)');
eq(d.launched, [0,1,4], 'SEED: launched = [0,1,4]');
ok(d.projects && d.projects[3] && d.projects[3].viable === false, 'SEED: project 3 is No-Go (viable===false)');
ok(!(d.projects[3] && d.projects[3].objectives), 'SEED: No-Go project 3 has no Go objectives');
ok(d.projects[16] && d.projects[16].viable !== true && d.projects[16].viable !== false,
   'SEED: project 16 awaiting verdict (no viable flag)');
// project 17 is selected + has a triage assessment but no deep projects[] record yet →
// awaiting the 2.4 verdict (this is what "awaiting verdict" means in the app: _res24 is false)
(function(){
  const pr17 = (d.projects||{})[17] || {};
  const res17 = pr17.viable === true ? !!pr17.objectives : pr17.viable === false ? !!pr17.noGoReason : false;
  ok((d.selected||[]).indexOf(17) >= 0, 'SEED: project 17 is selected');
  ok(res17 === false, 'SEED: project 17 awaiting verdict (no completed Go/No-Go)');
  ok((d.assessments||{})[17] && (d.assessments[17].priority != null),
     'SEED: project 17 has a triage assessment');
})();
ok(!(d.projects[16] && (Number(G.costNum(d.projects[16].startupCost))||Number(G.costNum(d.projects[16].runningCost)))),
   'SEED: project 16 deliberately costless');
ok(G.costNum(d.capital && d.capital.aiBudget) === 2400000,
   'SEED: aiBudget parses to $3.5M  (raw ' + JSON.stringify(d.capital && d.capital.aiBudget) + ')');

/* ── FISCAL: FY start month (Ruling 5) ──────────────────────── */
const fym = noThrow(() => G.periodStartMonth(), 'FISCAL: periodStartMonth() callable');
eq(fym, new Date(Date.parse(G.data.capital.periodStart)).getMonth() + 1, 'FISCAL: quarters count from the period start month (Ruling 5 subsumption)');
noThrow(() => G.nextReviewInfo(), 'FISCAL: nextReviewInfo() callable without throwing');
noThrow(() => G.thisQuarterConsumption(), 'FISCAL: thisQuarterConsumption() callable without throwing');

/* ── STAGE MODEL (derived, never stored — §6) ───────────────── */
let stages;
noThrow(() => { stages = G.getStages(); }, 'STAGES: getStages() callable');
ok(stages && typeof stages === 'object', 'STAGES: returns an object');
if (stages) {
  // operational == launched (minus archived); seed has no archived launched
  eq((stages.operational||[]).slice().sort((a,b)=>a-b), [0,1,4], 'STAGES: operational = launched [0,1,4]');
  // experiment == expSelected minus operational minus archived → [11,12,13]
  eq((stages.experiment||[]).slice().sort((a,b)=>a-b), [11,12,13], 'STAGES: experiment (Development) = [11,12,13]');
  ok((stages.noGo||[]).indexOf(3) >= 0, 'STAGES: noGo contains project 3');
  // Blue Sky Now-only: future ideas must not appear in the Now stage (Ruling 10)
  const bsHasFuture = (stages.bluesky||[]).some(i => d.ideas[i] && d.ideas[i].when === 'future');
  // bluesky may include future as a separate fold; the canonical Now subset is bsNowList()
  if (typeof G.bsNowList === 'function') {
    const now = noThrow(() => G.bsNowList(stages), 'STAGES: bsNowList(stages) callable') || [];
    ok(now.every(i => !(d.ideas[i] && d.ideas[i].when === 'future')),
       'STAGES: bsNowList(stages) excludes Future ideas (Now-only canonical)');
  } else {
    ok(true, 'STAGES: bsNowList absent — skipped Now-only check');
  }
}

/* ── SCORING PRECEDENCE: rescore3Done → rescoreDone → triage ── */
noThrow(() => G.getScore(0), 'SCORE: getScore() callable');
(function(){
  // pick a project with a triage assessment; verify precedence by injection
  const i = 11;
  const p = d.projects[i] = d.projects[i] || {};
  const savedRescore = p.rescore, savedR3 = p.rescore3, savedRD = p.rescoreDone, savedR3D = p.rescore3Done;
  // baseline: triage
  p.rescore = null; p.rescore3 = null; p.rescoreDone = false; p.rescore3Done = false;
  const base = G.getScore(i);
  // deepened confirmed → rescore wins (sum = 25)
  p.rescore = {priority:5,risk:5,value:5,costScore:5,difficulty:5}; p.rescoreDone = true;
  const dep = G.getScore(i);
  // post-experiment confirmed → rescore3 wins over rescore (sum = 5)
  p.rescore3 = {priority:1,risk:1,value:1,costScore:1,difficulty:1}; p.rescore3Done = true;
  const post = G.getScore(i);
  eq(dep, 25, 'SCORE: rescoreDone measurement (all 5s) sums to 25');
  eq(post, 5, 'SCORE: rescore3Done measurement (all 1s) sums to 5 — takes precedence over rescore');
  ok(typeof base === 'number', 'SCORE: falls back to triage (a number) when no rescore');
  // restore
  p.rescore = savedRescore; p.rescore3 = savedR3; p.rescoreDone = savedRD; p.rescore3Done = savedR3D;
})();

/* ── CAPITAL ENGINE: derived, no ledger (Rulings 1,3,4,7) ───── */
let com0, av0;
noThrow(() => { com0 = G.capCommitments(); }, 'CAPITAL: capCommitments() callable');
noThrow(() => { av0 = G.capAvailable(); }, 'CAPITAL: capAvailable() callable');
ok(com0 && typeof com0.total === 'number' && com0.total >= 0, 'CAPITAL: commitments.total is a non-negative number');
ok(av0 && typeof av0.available === 'number', 'CAPITAL: available.available is a number');
// available === budget − committed − killPot (Ruling: available = budget − committed − pot)
ok(av0 && Math.abs(av0.available - (av0.budget - av0.committed - av0.killPot)) < 1,
   'CAPITAL: available === budget − committed − killPot  (' + JSON.stringify(av0 && {a:av0.available,b:av0.budget,c:av0.committed,p:av0.killPot}) + ')');
ok(av0 && Math.abs(av0.committed - com0.total) < 1, 'CAPITAL: available.committed matches capCommitments().total (single source)');
eq(com0.total, 3246249, 'CAPITAL: seed ledger under the SINGLE MODEL (Paul, July 6; re-derived July 7 for the 1/4/13 reshape: 2,816,249 + 430,000 \u2013 each item gained twelve in-window sustainment months at 180K/110K/140K per year) = every live plan in-window, dev+roll+sus over 36 months; re-derived from 1,975,000 under the retired staged event ledger; offsets still retired whole per July 4 ruling');
// Kill pot deducts from Available (Ruling 3 / kill pot)
(function(){
  const saved = d.capital.killCosts;
  d.capital.killCosts = '$100K';
  const a2 = G.capAvailable();
  ok(Math.abs((av0.available - a2.available) - 100000) < 1, 'CAPITAL: a $100K kill pot lowers available by exactly 100k');
  d.capital.killCosts = saved;
  ok(Math.abs(G.capAvailable().available - av0.available) < 1, 'CAPITAL: restoring the pot restores available (no ledger drift)');
})();
// Killing an Operational item releases its commitment immediately (Sell = kill, Ruling 3)
(function(){
  const i = 4; // operational (launched)
  const before = G.capCommitments().total;
  if (!d.tracking) d.tracking = {};
  const savedTrk = d.tracking[i] ? JSON.parse(JSON.stringify(d.tracking[i])) : undefined;
  d.tracking[i] = d.tracking[i] || {};
  d.tracking[i].status = 'killed';           // the derived engine releases on this flag
  const after = G.capCommitments().total;
  ok(after <= before, 'CAPITAL: killing operational item 4 does not increase commitments');
  ok(after < before || G.projCosts(i).run + G.projCosts(i).start === 0,
     'CAPITAL: killing operational item 4 releases its commitment (or it was costless)');
  if (savedTrk) d.tracking[i] = savedTrk; else delete d.tracking[i];
  ok(Math.abs(G.capCommitments().total - before) < 1,
     'CAPITAL: un-killing restores commitments exactly (derived, reversible)');
})();

/* ── FORCING FUNCTION / NO BYPASS (Ruling 2) ────────────────── */
noThrow(() => G.progContracted(11), 'FORCING: progContracted() callable (gatesDefined retired, P4 July 5)');
(function(){
  // A project with no gate rows must report gates NOT defined.
  const i = 17; // awaiting verdict, no gates
  ok(G.progContracted(i) === false, 'FORCING: project 17 has no funded, contracted program \u2192 not contracted');
  // advanceWithGates on an unqualified project must not silently push it into Development
  const expBefore = (G.data.expSelected||[]).slice();
  noThrow(() => G.advanceWithGates(17), 'FORCING: advanceWithGates(17) on unqualified project does not throw');
  const expAfter = (G.data.expSelected||[]);
  ok(expAfter.indexOf(17) < 0, 'FORCING: unqualified project 17 was NOT advanced (no bypass)');
  eq(expAfter.slice().sort((a,b)=>a-b), expBefore.slice().sort((a,b)=>a-b),
     'FORCING: expSelected unchanged by a refused advance');
})();

/* ── RENDER STRINGS: renderers return HTML and never throw ──── */
/* String renderers: called with no arguments, must hand back HTML.
   renderInsights is NOT one of these any more — it became a screen module
   that mounts into a container (renderInsights(container), async via
   Screens.mount) and returns nothing. It is pinned in the INSIGHTS block. */
const RENDER_FNS = [
  'renderPipeline','renderStep13','renderStep24','renderStep31','renderStepCap','renderStepAlloc','renderStepExp',
  'renderStep43','renderStep44','renderCapHub','renderNavDash','renderOutBluesky',
  'renderOutCapplan','renderOutExploreEnhanced','renderOutOperFull','renderOutReport'
];
RENDER_FNS.forEach(fn => {
  if (typeof G[fn] === 'function') {
    const out = noThrow(() => G[fn](), 'RENDER: ' + fn + '() runs');
    nonEmptyStr(out, 'RENDER: ' + fn + '() returns non-empty HTML');
  } else {
    ok(false, 'RENDER: ' + fn + ' is defined');
  }
});
// Capital Snapshot naming (Ruling 13: Capital Plan → Capital Snapshot)
(function(){
  const snap = (typeof G.renderOutCapplan === 'function') ? G.renderOutCapplan() : '';
  has(snap, 'Snapshot', 'RENDER: Capital Snapshot page carries "Snapshot" framing (Ruling 13)');
})();
// 4.4 shows both the next-period picture and the annual envelope (two-number rule)
(function(){
  const r44 = (typeof G.renderStep44 === 'function') ? G.renderStep44() : '';
  const twoNumbers = /NEXT PERIOD/i.test(r44) && /ANNUAL ENVELOPE/i.test(r44);
  ok(twoNumbers, 'RENDER: 4.4 shows NEXT PERIOD + ANNUAL ENVELOPE (forward-looking two-number rule)');
})();

/* ── EMPTY STATE: emptyData() is a clean slate ──────────────── */
(function(){
  const e = G.emptyData();
  eq((e.ideas||[]).length, 0, 'EMPTY: emptyData() has no ideas');
  eq((e.selected||[]).length, 0, 'EMPTY: emptyData() has no selections');
  eq((e.launched||[]).length, 0, 'EMPTY: emptyData() has nothing launched');
})();

/* ── VISUAL-PASS BATCH (July 2, new account) ─────────────────── */
// Module overview: strip now has 4 tiles, no Culture Score, with a start-date line
(function(){
  const strip = (typeof G.vizStatStrip === 'function') ? G.vizStatStrip() : '';
  const tiles = (strip.match(/viz-stat-cell/g) || []).length;
  eq(tiles, 4, 'OVERVIEW: stat strip renders exactly 4 tiles (Culture Score removed)');
  ok(strip.indexOf('Culture Score') < 0, 'OVERVIEW: Culture Score tile is gone from the strip');
  has(strip, 'Steps Complete', 'OVERVIEW: Steps Complete tile still present');
  has(strip, 'Module start date', 'OVERVIEW: "Module start date" line present above the tiles');
  // the date shown is derived from data.startDate (seed sets a specific day)
  ok(/Module start date/.test(strip) && /\b20\d\d\b/.test(strip),
     'OVERVIEW: start-date line shows a formatted year');
})();
// Module overview: Four Pillars box removed
(function(){
  const ov = (typeof G.renderPipelineOverview === 'function') ? G.renderPipelineOverview() : '';
  ok(ov.indexOf('THE FOUR PILLARS') < 0, 'OVERVIEW: Four Pillars box removed');
})();
// Phase 1 landing: Steps Complete /3 (was Sections Done /5)
(function(){
  const p1 = (typeof G.renderPhaseLandingPipe === 'function')
    ? noThrow(() => G.renderPhaseLandingPipe(1), 'PHASE1: renderPhaseLandingPipe(1) runs') : '';
  has(p1, 'Steps Complete', 'PHASE1: stat tile relabeled "Steps Complete"');
  ok(p1.indexOf('Sections Done') < 0, 'PHASE1: "Sections Done" label gone');
  has(p1, '/3', 'PHASE1: steps counted out of 3');
})();
// Step 1.1 seed: knowledge dropdowns use option-string values (so they select)
(function(){
  const k = d.knowledge || {};
  ok(['none','basic','moderate','advanced'].indexOf(k.usage) >= 0,
     'SEED: knowledge.usage is a valid dropdown value (' + JSON.stringify(k.usage) + ')');
  ok(['none','limited','moderate','strong'].indexOf(k.resources) >= 0,
     'SEED: knowledge.resources is a valid dropdown value (' + JSON.stringify(k.resources) + ')');
  ok(['none','informal','some','systematic'].indexOf(k.learning) >= 0,
     'SEED: knowledge.learning is a valid dropdown value (' + JSON.stringify(k.learning) + ')');
  ok(typeof k.awareness === 'number', 'SEED: knowledge.awareness stays numeric (Likert)');
  // and the rendered 1.1 dropdowns actually mark them selected
  const savedSec = G.UI.sec; G.UI.sec = '1.2';
  const s12 = (typeof G.renderStep11 === 'function') ? G.renderStep11() : '';
  has(s12, 'value="moderate" selected', 'SEED: 1.2 usage dropdown shows a selected option');
  G.UI.sec = savedSec;
})();
// Innovation Audit copy updated
(function(){
  const savedSec = G.UI.sec; G.UI.sec = '1.4';
  const s14 = (typeof G.renderStep11 === 'function') ? G.renderStep11() : '';
  has(s14, 'Inventory every AI initiative that existed anywhere in your enterprise on day one',
      'AUDIT: Innovation Audit explanatory text updated');
  ok(s14.indexOf('>Inventory every initiative.<') < 0, 'AUDIT: old terse copy gone');
  G.UI.sec = savedSec;
})();

/* ── VISUAL-PASS BATCH 2 (advance flow, Blue Sky editing, copy) ── */
// Brainstorm lead + example button + Aurora intro
(function(){
  G.UI.showEx.aurora = true;
  const s12 = (typeof G.renderStep12 === 'function') ? noThrow(() => G.renderStep12(), 'B2: renderStep12 runs') : '';
  has(s12, 'How can AI address your friction points or advance your organizational purpose?', 'B2: Brainstorm lead rewritten');
  ok(s12.indexOf('Could AI address your friction points?') < 0, 'B2: old Brainstorm lead gone');
  ok(s12.indexOf('Aurora Example') < 0, 'B2: 1.2 button no longer says "Aurora Example"');
  has(s12, '\u25be Example</button>', 'B2: 1.2 button says "Example" (open state)');
  has(s12, 'Aurora Windows</strong> is a 35-year-old', 'B2: Aurora Windows introduction present in the box');
  has(s12, 'how-to-build-an-ai-innovation-pipeline-that-creates-real-long-term-value', 'B2: intro links the faisalhoque.com background article');
  G.UI.showEx.aurora = false;
  const s24 = (typeof G.renderStep24 === 'function') ? G.renderStep24() : '';
  ok(s24.indexOf('Aurora Example') < 0, 'B2: 2.4 button no longer says "Aurora Example"');
})();
// 1.3: instruction text, button rename, helper sentence
// (the advance button and score bars render only for FEASIBLE ideas — the seed's two
// unselected Now ideas have deliberately blank gates — so qualify idea 18 first)
(function(){
  const i = 18;
  if (!G.data.assessments) G.data.assessments = {};
  const saved = G.data.assessments[i] ? JSON.parse(JSON.stringify(G.data.assessments[i])) : undefined;
  G.data.assessments[i] = Object.assign({}, saved, {techCapable:true,resourcesAvailable:true,culturalFit:true,purposeAligned:true,affordable:true});
  G.UI.expanded['fr13_'+i] = true; // 1.3 cards collapse to bars by default since July 6
  const s13 = (typeof G.renderStep13 === 'function') ? G.renderStep13() : '';
  G.UI.expanded['fr13_'+i] = false;
  has(s13, 'Is this idea compatible with your organization\u2019s current state across the following five dimensions? Click a dimension once for yes and twice for no. A single no disqualifies the idea until the relevant circumstances change.',
      'B2: 1.3 five-dimension instruction present');
  has(s13, 'Advance to Exploration Portfolio', 'B2: 1.3 button renamed (feasible card)');
  has(s13, 'askAdvanceIdea(', 'B2: 1.3 button routes through the confirm flow');
  ok(s13.indexOf('Selecting moves this idea') < 0, 'B2: no helper sentence beside the 1.3 button (popup replaced it)');
  ok(s13.indexOf('onclick="toggleSelect(') < 0, 'B2: no direct toggleSelect buttons remain at 1.3');
  // legend renders once at least one idea is scored or disqualified
  const vs = (typeof G.vizScores === 'function') ? G.vizScores() : '';
  has(vs, 'Qualified', 'B2: score-distribution legend shows Qualified');
  has(vs, 'Disqualified', 'B2: score-distribution legend shows Disqualified');
  ok(vs.indexOf('>Now</span>') < 0 && vs.indexOf('>Future</span>') < 0, 'B2: legend no longer shows Now/Future chips');
  // Blue Sky page shows the renamed button on the same feasible card (button lives in the OPEN card body)
  G.UI.expanded['bs'+i] = true;
  const ob = (typeof G.renderOutBluesky === 'function') ? G.renderOutBluesky() : '';
  has(ob, 'Advance to Exploration Portfolio', 'B2: Blue Sky button renamed (open feasible card)');
  ok(ob.indexOf('onclick="toggleSelect(') < 0, 'B2: Blue Sky button routes through confirm flow');
  ok(ob.indexOf('Selecting moves this idea') < 0, 'B2: no helper sentence beside the Blue Sky button (popup replaced it)');
  G.UI.expanded['bs'+i] = false;
  if (saved) G.data.assessments[i] = saved; else delete G.data.assessments[i];
})();
// toggleGate really is once-for-yes, twice-for-no (the copy must be true)
(function(){
  const i = 18; // an unselected seed idea
  if (!G.data.assessments) G.data.assessments = {};
  const saved = G.data.assessments[i] ? JSON.parse(JSON.stringify(G.data.assessments[i])) : undefined;
  G.data.assessments[i] = {};
  G.toggleGate(i,'techCapable');
  eq(G.data.assessments[i].techCapable, true, 'B2: first click on a dimension = yes');
  G.toggleGate(i,'techCapable');
  eq(G.data.assessments[i].techCapable, false, 'B2: second click = no');
  G.toggleGate(i,'techCapable');
  ok(G.data.assessments[i].techCapable === undefined, 'B2: third click clears');
  if (saved) G.data.assessments[i] = saved; else delete G.data.assessments[i];
})();
// Advance confirm flow: No leaves state untouched, Yes advances
(function(){
  const i = 18;
  const before = (G.data.selected||[]).slice();
  noThrow(() => G.askAdvanceIdea(i), 'B2: askAdvanceIdea callable');
  eq(G.currentModal, 'advance', 'B2: modal state set to advance');
  G.confirmAdvanceIdea(false);
  ok((G.data.selected||[]).indexOf(i) < 0, 'B2: No button does not advance the idea');
  eq(G.currentModal, null, 'B2: modal closed after No');
  G.askAdvanceIdea(i);
  G.confirmAdvanceIdea(true);
  ok((G.data.selected||[]).indexOf(i) >= 0, 'B2: Yes button advances the idea (toggleSelect ran)');
  // restore: pull it back out of selected (test hygiene; freshProjectSlate already cleared downstream)
  G.data.selected = before;
  // future ideas still refuse the flow
  const fut = G.data.ideas.findIndex(x => x && x.when === 'future');
  const selBefore = (G.data.selected||[]).length;
  G.askAdvanceIdea(fut);
  ok(G.currentModal !== 'advance', 'B2: askAdvanceIdea refuses Future ideas (no modal)');
  eq((G.data.selected||[]).length, selBefore, 'B2: Future idea not advanced');
})();
// Blue Sky portfolio: editable form on cards
(function(){
  // open one Now card and the Future fold
  const bsNow = G.bsNowList(G.getStages());
  const iNow = bsNow[0];
  G.UI.expanded['bs'+iNow] = true;
  G.UI.expanded.bsFold = true;
  const iFut = G.data.ideas.findIndex(x => x && x.when === 'future');
  G.UI.expanded['bsf'+iFut] = true;
  const ob = (typeof G.renderOutBluesky === 'function') ? noThrow(() => G.renderOutBluesky(), 'B2: renderOutBluesky runs with cards open') : '';
  has(ob, 'bsic_'+iNow+'_name', 'B2: open Now card shows editable Name field');
  has(ob, 'bsic_'+iNow+'_when', 'B2: open Now card shows editable When select');
  has(ob, 'bsic_'+iFut+'_desc', 'B2: open Future card shows editable Description field');
  G.UI.expanded['bs'+iNow] = false; G.UI.expanded['bsf'+iFut] = false; G.UI.expanded.bsFold = false;
})();
// bsic save branch: writes through to the idea record; when-switch moves the card
(function(){
  const bsNow = G.bsNowList(G.getStages());
  const i = bsNow[0];
  const savedDesc = G.data.ideas[i].desc, savedWhen = G.data.ideas[i].when;
  G.fldSave('bsic_'+i+'_desc', 'Harness edited description');
  eq(G.data.ideas[i].desc, 'Harness edited description', 'B2: bsic field save writes to the idea record');
  G.fldSave('bsic_'+i+'_name', '   ');
  ok(G.data.ideas[i].name && G.data.ideas[i].name.trim().length > 0, 'B2: blank name is ignored (idea keeps its name)');
  G.fldSave('bsic_'+i+'_when', 'future');
  eq(G.data.ideas[i].when, 'future', 'B2: when-switch saves');
  ok(G.UI.expanded['bsf'+i] === true, 'B2: when->future follows the idea into the fold');
  G.fldSave('bsic_'+i+'_when', 'now');
  eq(G.data.ideas[i].when, 'now', 'B2: when-switch back to now saves');
  G.fldSave('bsic_'+i+'_bogusfield', 'x');
  ok(G.data.ideas[i].bogusfield === undefined, 'B2: unknown fields are rejected');
  G.data.ideas[i].desc = savedDesc; G.data.ideas[i].when = savedWhen;
})();
// Assessment report: gap marker is now a double exclamation mark
(function(){
  const rep = (typeof G.renderOutReport === 'function') ? G.renderOutReport() : '';
  ok(rep.indexOf('\u25b3') < 0, 'B2: report no longer uses the triangle gap marker');
  has(rep, '\u203c', 'B2: report uses the double exclamation mark for gaps');
})();

/* ── VISUAL-PASS BATCH 3 (2.1 viz, 2.2 depth, 2.3 attendees, 3.1 fold) ── */
// 2.1: ownership-completeness viz fully removed
(function(){
  const s21 = (typeof G.renderStep21 === 'function') ? noThrow(() => G.renderStep21(), 'B3: renderStep21 runs') : '';
  ok(s21.indexOf('Ownership Completeness') < 0, 'B3: 2.1 no longer shows Ownership Completeness');
  ok(typeof G.vizOwnership === 'undefined', 'B3: vizOwnership function removed');
  ok(typeof G.refreshOwViz === 'undefined', 'B3: refreshOwViz removed');
  noThrow(() => G.fldSave('ow_authority', 'test authority'), 'B3: ow_ field save survives without the viz tail');
  eq(G.data.ownership.authority, 'test authority', 'B3: ownership field still saves');
  G.data.ownership.authority = 'Full budget authority for AI portfolio under $2M per initiative.';
})();
// 2.2: deeper box, two-structure placeholder
(function(){
  const s22 = (typeof G.renderStep22 === 'function') ? G.renderStep22() : '';
  has(s22, 'rows="5"', 'B3: 2.2 current-structure box is 5 rows deep');
  has(s22, 'Sales \u2013 quarterly commission', 'B3: placeholder shows a sales incentive structure');
  has(s22, 'Engineering \u2013 annual bonus', 'B3: placeholder shows a second, different structure');
  ok(s22.indexOf('Measured on delivery KPIs only') < 0, 'B3: old one-line placeholder gone');
})();
// 2.3: attendee list — seed, mechanics, legacy normalization
(function(){
  eq(G.data.rhythm.attendees, ['Shalini Mehta','Vincent Lau','Harriet Rivers'], 'B3: seed attendees are three named people');
  const s23 = (typeof G.renderStep23 === 'function') ? G.renderStep23() : '';
  has(s23, 'rhAtt_0', 'B3: 2.3 renders per-person attendee inputs');
  has(s23, '+ Add attendee', 'B3: 2.3 has an Add attendee button');
  ok(s23.indexOf('id="rh_attendees"') < 0, 'B3: old free-text attendees box gone');
  eq(G.rhAttNames(), ['Shalini Mehta','Vincent Lau','Harriet Rivers'], 'B3: rhAttNames returns the named list');
  G.addAttendee();
  eq(G.rhAttList().length, 4, 'B3: addAttendee appends a blank row');
  ok(G.rhAttNames().length === 3, 'B3: blank rows do not count toward the gate');
  G.removeAttendee(3);
  eq(G.rhAttList().length, 3, 'B3: removeAttendee removes the row');
  // legacy string normalizes without data loss
  const saved = G.data.rhythm.attendees;
  G.data.rhythm.attendees = 'Innovation Council + Phase Owners, CFO';
  eq(G.rhAttNames(), ['Innovation Council','Phase Owners','CFO'], 'B3: legacy string splits into discrete entries');
  G.data.rhythm.attendees = saved;
})();
// Dashboard: Next Innovation Session lists the people
(function(){
  const nd = (typeof G.renderNavDash === 'function') ? noThrow(() => G.renderNavDash(), 'B3: renderNavDash runs') : '';
  has(nd, 'Shalini Mehta, Vincent Lau, Harriet Rivers', 'B3: dashboard session box lists the attendees');
})();
// 3.1: project-card fold, matching the 3.3 pattern
(function(){
  const goP = G.getStages().explore.filter(i => (G.data.projects[i]||{}).viable === true);
  ok(goP.length > 0, 'B3: seed has Go projects at Exploration for 3.1');
  const i = goP[0];
  G.UI.expanded['pc31'+i] = false;
  let s31 = G.renderStep31();
  has(s31, 'Project card</button>', 'B3: 3.1 cards carry the Project card fold button');
  ok(s31.indexOf('Objectives') < 0 || (G.data.projects[i]||{}).objectives === undefined,
     'B3: fold content hidden while collapsed');
  G.UI.expanded['pc31'+i] = true;
  s31 = G.renderStep31();
  has(s31, 'Objectives', 'B3: expanded fold shows the 2.4 project card (Objectives)');
  G.UI.expanded['pc31'+i] = false;
})();

/* ── VISUAL-PASS BATCH 4 (cost echo, checklist, seniors, RACI move) ── */
// Cost echo semantics
(function(){
  eq(typeof G.costEchoTxt, 'undefined', 'B4: the Reads-as echo helper is retired (July 9) \u2013 parseBudget/fmtMoney remain the money readers');
  G.UI.ap = 17; // item 16 now carries a seeded budget plan, so the cost boxes live on 17
  const s24 = (typeof G.renderStep24 === 'function') ? G.renderStep24() : '';
  ok(s24.indexOf('costEcho_') < 0, 'B4: 2.4 cost boxes carry no echo slots (retired July 9)');
  // live write-through preserves the record; restore project 16 to costless
  const before17 = G.data.projects[17] ? G.data.projects[17].startupCost : undefined;
  G.fldSave('expl_17_cS', '$100K');
  eq((G.data.projects[17]||{}).startupCost, '$100K', 'B4: cost field saves through fldSave');
  if (before17 === undefined) delete G.data.projects[17].startupCost; else G.data.projects[17].startupCost = before17;
  ok(!(G.costNum((G.data.projects[17]||{}).startupCost)), 'B4: project 17 restored to costless');
  ok(G.bpHasDev(16), 'B4: item 16 carries a dev plan, so its simple cost field is superseded (write refused by design)');
})();
// Org Readiness checklist
(function(){
  const or_ = (typeof G.renderOutOrgReady === 'function') ? noThrow(() => G.renderOutOrgReady(), 'B4: renderOutOrgReady runs') : '';
  has(or_, 'First deep assessments completed', 'B4: checklist relabeled');
  ok(or_.indexOf('Deep assessment completed<') < 0 && or_.indexOf('>Deep assessment completed') < 0, 'B4: old label gone');
  ok(or_.indexOf('Communication plan in place') < 0, 'B4: communication-plan item removed');
})();
// 2.1: Engaged Senior Leaders + editable RACI in the freed space
(function(){
  eq((G.data.ownership.seniors||[]).map(x=>x.name), ['Imogen Whitfield','Daniel Reyes'], 'B4: seed seniors present');
  const s21 = G.renderStep21();
  has(s21, 'Engaged Senior Leaders', 'B4: 2.1 has the seniors card');
  has(s21, 'senior_0_name', 'B4: senior name inputs render');
  has(s21, 'Imogen Whitfield', 'B4: seed senior shows in the card');
  has(s21, 'raci_0:owner', 'B4: editable RACI matrix lives at 2.1 (identity-keyed cells)');
  has(s21, '<select id="raci_', 'B4: 2.1 matrix cells are selects (editable)');
  // add/remove mechanics
  G.addSenior();
  eq((G.data.ownership.seniors||[]).length, 3, 'B4: addSenior appends a row');
  G.removeSenior(2);
  eq((G.data.ownership.seniors||[]).length, 2, 'B4: removeSenior removes it');
})();
// RACI roles include seniors, in order, capped, with Finance last
(function(){
  eq(G.raciRoles(), ['Shalini Mehta','Vincent Lau','Harriet Rivers','Imogen Whitfield','Daniel Reyes','Finance'],
     'B4: raciRoles = owner + leads + seniors + Finance');
})();
// Output page: static, printable, no editors; dead stub gone
(function(){
  const out = (typeof G.renderOutRaciFull === 'function') ? G.renderOutRaciFull() : '';
  ok(out.indexOf('<select') < 0, 'B4: output RACI page has no editable cells');
  has(out, 'printRaci()', 'B4: output RACI page has a PDF button');
  has(out, 'Imogen Whitfield', 'B4: output matrix includes senior-leader columns');
  has(out, 'Step 2.1', 'B4: output page points at 2.1 as the editor');
  ok(typeof G.renderOutRaci === 'undefined', 'B4: dead renderOutRaci stub removed');
  ok(typeof G.printRaci === 'function', 'B4: printRaci exists');
  // seed letters render as static text (seed raci 0-0 = R)
  has(out, '>R</span>', 'B4: recorded letters render statically');
})();

/* ── RACI IDENTITY KEYING (Paul's ruling: letters follow the person) ── */
(function(){
  const snapOw = JSON.parse(JSON.stringify(G.data.ownership));
  const snapRaci = JSON.parse(JSON.stringify(G.data.raci));
  const ld1 = G.data.ownership.leads[0].id, ld2 = G.data.ownership.leads[1].id;
  ok(!!ld1 && !!ld2 && ld1 !== ld2, 'RACI: seed leads carry distinct ids');
  ok(Object.keys(G.data.raci).every(k => k.indexOf(':') > 0), 'RACI: all seed cells use identity keys');
  eq(G.data.raci['0:owner'], 'A', 'RACI: seed \u2013 the owner is Accountable for approving experiments (full matrix seeded July 7)');
  (function(){var acts=7;for(var ai=0;ai<acts;ai++){var aCount=0;Object.keys(G.data.raci).forEach(function(k){if(k.indexOf(ai+':')===0&&G.data.raci[k]==='A')aCount++});eq(aCount,1,'RACI: exactly one A on activity '+ai);}})();
  has(G.renderOutRaciFull(), '\u270E Edit', 'RACI: the output page carries the edit toggle (Paul, July 7)');
  G.UI.expanded.raciEdit = true;
  has(G.renderOutRaciFull(), 'saveRaci(', 'RACI: toggled, the output renders the live editable matrix');
  G.UI.expanded.raciEdit = false;
  eq(G.data.raci['1:'+ld1], 'R', 'RACI: seed lead cell recorded against Marcus\u2019s id');
  // The old bug: removing lead[0] shifted lead[1]'s letters onto the wrong person. Now:
  G.data.raci['0:'+ld2] = 'C';                       // give Elena a letter
  G.removeLead(0);                                    // remove Marcus
  eq(G.data.raci['0:'+ld2], 'C', 'RACI: Elena\u2019s letter survives Marcus\u2019s removal (follows the person)');
  ok(Object.keys(G.data.raci).every(k => k.indexOf(':'+ld1) < 0), 'RACI: removed person\u2019s cells are purged');
  const outAfter = G.renderOutRaciFull();
  ok(outAfter.indexOf('Vincent Lau') < 0, 'RACI: removed person leaves the matrix columns');
  has(outAfter, 'Harriet Rivers', 'RACI: remaining people keep their columns');
  // restore
  G.data.ownership = JSON.parse(JSON.stringify(snapOw));
  G.data.raci = JSON.parse(JSON.stringify(snapRaci));
  eq(G.raciRoles(), ['Shalini Mehta','Vincent Lau','Harriet Rivers','Imogen Whitfield','Daniel Reyes','Finance'], 'RACI: state restored after removal test');
})();
// Legacy migration: position-keyed cells map onto whoever holds the column now
(function(){
  const snapRaci = JSON.parse(JSON.stringify(G.data.raci));
  const ld1 = G.data.ownership.leads[0].id;
  const elena = G.data.ownership.leads[1].id;
  G.data.raci = { '0-0':'R', '0-2':'I', '3-9':'A' };  // owner col, Elena's col (index 2), out-of-range
  G.ensureRaciModel();
  eq(G.data.raci['0:owner'], 'R', 'RACI-MIG: column 0 letter lands on the owner key');
  eq(G.data.raci['0:'+elena], 'I', 'RACI-MIG: column 2 letter lands on Elena\u2019s id');
  ok(G.data.raci['3-9'] === undefined && G.data.raci['0-0'] === undefined && G.data.raci['0-2'] === undefined,
     'RACI-MIG: legacy keys removed; out-of-range letters dropped');
  ok(Object.keys(G.data.raci).every(k => !/^\d+-\d+$/.test(k)), 'RACI-MIG: no positional keys remain');
  G.data.raci = JSON.parse(JSON.stringify(snapRaci));
})();
// Id backfill: people without ids get them; new rows are born with ids
(function(){
  const lead = G.data.ownership.leads[0];
  const savedId = lead.id;
  delete lead.id;
  G.ensureRaciModel();
  ok(!!lead.id, 'RACI: ensureRaciModel backfills a missing lead id');
  lead.id = savedId;
  G.addLead();
  const added = G.data.ownership.leads[G.data.ownership.leads.length-1];
  ok(!!added.id, 'RACI: addLead creates the row with an id');
  G.removeLead(G.data.ownership.leads.length-1);
  const snapS = G.data.ownership.seniors.length;
  G.addSenior();
  ok(!!G.data.ownership.seniors[snapS].id, 'RACI: addSenior creates the row with an id');
  G.removeSenior(snapS);
})();

/* ── ALLOCATE CAPITAL BATCH (committed sources, Committed Sums, relayout) ── */
// Cost sources: stage field wins, 2.4 estimate is the fallback
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const snapExp = JSON.parse(JSON.stringify(G.data.experiments||{}));
  const snapOps = JSON.parse(JSON.stringify(G.data.opsData||{}));
  G.ensureCapCostModel();
  // Backfill: seed dev items carry 2.4 estimates; the experiment budget now holds them
  ok(!!String((G.data.experiments[11]||{}).budget||'').trim(), 'CAP: backfill copies dev estimate into Development Costs');
  eq(G.costNum(G.data.experiments[11].budget), G.projCosts(11).start, 'CAP: backfilled budget equals the 2.4 estimate');
  ok(!!String((G.data.opsData[0]||{}).runCost||'').trim(), 'CAP: backfill copies ops estimate into Annual Sustainment Costs');
  eq(G.costNum(G.data.opsData[0].runCost), G.projCosts(0).run, 'CAP: backfilled sustainment equals the 2.4 estimate');
  // Override: the stage field is authoritative once set
  const before = G.capCommitments().total;
  const prevBudget = G.data.experiments[11].budget;
  G.data.experiments[11].budget = '$999K';
  eq(G.devCost(11), 999000, 'CAP: devCost reads the Development Costs override');
  eq(G.capCommitments().total, before - G.costNum(prevBudget) + 999000, 'CAP: commitments move with the override');
  G.data.experiments[11].budget = prevBudget;
  // Fallback: blank stage field falls back to the estimate
  G.data.experiments[11].budget = '';
  eq(G.devCost(11), G.projCosts(11).start, 'CAP: blank Development Costs falls back to the estimate');
  G.data.experiments = JSON.parse(JSON.stringify(snapExp)); G.ensureCapCostModel();
  const prevRun = G.data.opsData[0].runCost;
  G.data.opsData[0].runCost = '$500K';
  eq(G.opsSustainCost(0), 500000, 'CAP: opsSustainCost reads the sustainment override');
  G.data.opsData[0].runCost = prevRun;
  G.data.opsData = JSON.parse(JSON.stringify(snapOps)); G.ensureCapCostModel();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();
// Committed Sums: operational first, new labels
(function(){
  const com = G.capCommitments();
  ok(com.rows.length > 0, 'CAP: seed has committed rows');
  eq(com.rows[0].stage, 'Operational', 'CAP: operational rows come first');
  ok(com.rows.filter(r => r.stage === 'Development').every(r => r.label.indexOf('Full plan') === 0), 'CAP: development rows carry the full-plan label (single model)');
  ok(com.rows.filter(r => r.stage === 'Operational').every(r => r.label.indexOf('Full plan') === 0), 'CAP: operational rows carry the full-plan label (single model)');
  ok(com.rows.every(r => r.label !== 'startup' && r.label !== 'running'), 'CAP: no old lowercase labels remain');
  eq(com.total, com.dev + com.op, 'CAP: total = dev + op');
})();
// doLaunch copies the sustainment estimate into the ops card
(function(){
  const snapL = (G.data.launched||[]).slice();
  const snapOps = JSON.parse(JSON.stringify(G.data.opsData||{}));
  const snapStale = G.data.capStale;
  delete (G.data.opsData||{})[11];
  G.doLaunchGo(11);
  eq((G.data.opsData[11]||{}).runCost, G.data.projects[11].runningCost, 'CAP: doLaunch initializes Annual Sustainment Costs');
  G.data.launched = snapL; G.data.opsData = JSON.parse(JSON.stringify(snapOps)); G.data.capStale = snapStale; G.saveData();
})();
// Refresh bug: capital money fields re-render on blur
(function(){
  const realRender = G.render; let calls = 0;
  G.render = function(){ calls++; };
  const prev = (G.data.capital||{}).aiBudget;
  G.fldSave('cap_aiBudget', '$10M');
  eq(G.data.capital.aiBudget, '$10M', 'CAP: budget saves');
  ok(calls >= 1, 'CAP: blur on the budget field re-renders (stale-figures fix)');
  calls = 0;
  G.fldSave('cap_aiBudget', '$9M', true);
  eq(calls, 0, 'CAP: live keystrokes do not re-render');
  G.data.capital.aiBudget = prev; G.saveData();
  G.render = realRender;
})();
// Surfaces
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const _bud0=[G.data.capital.aiBudget,G.data.capital.budgetY2,G.data.capital.budgetY3];
  G.data.capital.aiBudget='$10M';G.data.capital.budgetY2='$10M';G.data.capital.budgetY3='$10M';G.data.capStale=true; // no-warn frame: stashed plans front-load lumps that breach the tightened seed budget
  G.UI.capTab = 2; G.UI.expanded['acRef'] = true;
  const t1 = G.renderStepAlloc();
  has(t1, 'Advance queue', 'CAP: the queue leads Commit & Advance (July 4 redesign)');
  // redesign pins: live ticks on the queue, staged-first sort, batch-aware calendar, folds
  G.UI.capSim = {15: true};
  const t1s = G.renderStepAlloc();
  has(t1s, '>Staged<', 'CAP: staged badge on ticked queue rows');
  ok(t1s.indexOf('Logistics Route Optimizer') < t1s.indexOf('Sales Knowledge Graph'), 'CAP: staged candidates sort first');
  has(t1s, 'staged batch included', 'CAP: the calendar card carries the batch');
  has(t1s, 'this month (batch)', 'CAP: batch segments itemized on the commit tab too');
  G.UI.expanded['acCum'] = true;
  const t1c = G.renderStepAlloc();
  has(t1c, 'Cumulative commitments stay under cumulative capacity', 'CAP: the fit verdict sits with the cumulative chart');
  G.UI.expanded['acCum'] = false;
  has(t1s, 'Development costs', 'CAP: cost panel written out (July 5)');
  has(t1s, 'Sustainment costs', 'CAP: sustainment line on the panel');
  ok(t1s.indexOf('>dev ') < 0, 'CAP: the minimal dev-rollup span is gone');
  has(t1s, 'Including the staged batch', 'CAP: the capital strip updates with the ticks');
  ok(t1s.indexOf(G.fmtMoney(G.capProjectWindow(15, G.capAssumedExtra(15).anchor).inW)) >= 0, 'CAP: the staged sentence carries the candidate\u2019s full in-window plan (single model)');
    has(t1s, 'full plans committed on advancing', 'CAP: staged sentence states the whole-plan doctrine');
  has(t1s, 'Change the mix'.replace('C','c'), 'CAP: mix stays editable here');
  G.UI.capSim = {};
  const t1e = G.renderStepAlloc();
  has(t1e, '\u25b8 Capacity Breach Funding Plan', 'CAP: funding plan folds when nothing warns (retitled July 5)');
  ok(t1e.indexOf('staged batch included') < 0, 'CAP: calendar reverts to baseline copy when unstaged');
  G.UI.expanded['fpA'] = false; G.UI.expanded['acCum'] = false; G.UI.expanded['acSwim'] = false;
  G.UI.expanded['acRef'] = true;
  ok(G.renderStepAlloc().indexOf('score-num-go') < 0, 'CAP: the duplicated big cells are retired from 3.3 \u2013 availability lives in the tabbed band (Paul, July 6)');
  G.UI.expanded['acRef'] = false;
  const tCap0 = G.renderStepCap();
  ok(tCap0.indexOf('Dates and Fiscal Calculations') < 0, 'CAP: fiscal fold retired from Plan Capacity (Paul ruling, July 4)');
  ok(tCap0.indexOf('costEcho_budget') < 0 && tCap0.indexOf('Reads as') < 0, 'CAP: no echo lines on the capacity fields');
  has(t1, 'Committed Sums', 'CAP: readout retitled (inside the reference fold)');
  has(t1, 'Project Kill/Phase-Out Pot', 'CAP: pot section retitled in white with a plain subtitle (Paul, July 5)');
  ok(tCap0.indexOf('How the dates and money work') < 0, 'CAP: old fold name gone from Plan Capacity');
  ok(t1.indexOf('What\u2019s in this pot') < 0 && t1.indexOf("What's in this pot") < 0, 'CAP: old pot label gone');
  ok(t1.indexOf('What the committed sum contains') < 0, 'CAP: old readout title gone');
  ok(t1.indexOf('Commitments are derived live') < 0, 'CAP: redundant explainer paragraph cut (its unique opening is gone; the carousel keeps its own one-off-plan line)');
  const s24 = G.renderStep24();
  has(s24, 'Estimated development costs', 'CAP: 2.4 development label');
  has(s24, 'Estimated rollout costs', 'CAP: 2.4 rollout field present');
  has(s24, 'Estimated annual sustainment costs', 'CAP: 2.4 sustainment label');
  const s33 = G.renderStepExp();
  has(s33, 'Development Budget', 'CAP: budget box is Development Budget (Paul, July 6)');
  ok(s33.indexOf('budEcho_') < 0, 'CAP: the 3.3 budget echo is retired (July 9)');
  G.UI.expanded['oe11'] = true;
  const dev = G.renderOutExpbriefsFull();
  has(dev, 'Idea card', 'CAP: Development card has the idea fold');
  has(dev, 'Project card', 'CAP: Development card has the project-card fold');
  has(dev, 'Development Budget', 'CAP: Development card budget renamed (Paul, July 6)');
  G.UI.expanded['oe11'] = false;
  G.UI.expanded['oo0'] = true;
  const ops = G.renderOutOperFull();
  has(ops, 'Annual Sustainment Costs', 'CAP: ops card has the prominent sustainment box');
  has(ops, 'ops_0_runCost', 'CAP: sustainment field id present');
  ok(ops.indexOf('susEcho_0') < 0, 'CAP: the sustainment echo is retired (July 9)');
  has(ops, 'Development card', 'CAP: ops card folds to the DEVELOPMENT card \u2013 the stale experiment card retired (Paul, July 7); history now runs idea \u2192 project \u2192 development');
  has(ops, 'Idea card', 'CAP: ops card has the idea fold');
  has(ops, 'Project card', 'CAP: ops card has the project-card fold');
  G.UI.expanded['oo0'] = false;
  G.UI.hubTab = 1; // readout and stage lists live on the Commitments tab (hub tabs, July 5)
  const hub = G.renderCapHub();
  has(hub, 'Committed Sums', 'CAP: Hub shows the shared Committed Sums card');
  has(hub, 'Development (Development Costs committed)', 'CAP: Hub development list retitled (Paul wording, July 5)');
  has(hub, 'committed costs', 'CAP: Hub operational list retitled');
  ok(hub.indexOf("What's in this pot") < 0, 'CAP: Hub top card no longer carries the pot');
  ok(hub.indexOf('Dates and Fiscal Calculations') < 0, 'CAP: Hub fold retired too');
  G.UI.hubTab = 0;
  const snap = G.renderOutCapplan();
  has(snap, 'est. rollout', 'CAP: Snapshot dev rows carry the rollout estimate');
  has(snap, 'Full plan', 'CAP: snapshot rows carry the full-plan label (single model, July 6)');
  // year-two behavior: backdate a launch and the label flips to sustainment-only
  const _od0 = JSON.parse(JSON.stringify(G.data.opsData[0]||{}));
  G.data.opsData[0].launchDate = new Date(Date.now() - 86400000*500).toISOString().slice(0,10);
  const com2 = G.capCommitments();
  const r0 = com2.rows.find(r => r.i === 0);
  ok(r0.label.indexOf('Full plan') === 0, 'CAP: single model – the row is the full plan regardless of launch year');
  eq(r0.amt, G.capProjectWindow(0).inW, 'CAP: the amount is the whole in-window plan');
  G.data.opsData[0] = _od0; G.saveData();
  // ops sustainment field routes through fldSave
  const prevRC = (G.data.opsData[0]||{}).runCost;
  G.fldSave('ops_0_runCost', '$75K');
  eq(G.data.opsData[0].runCost, '$75K', 'CAP: ops sustainment field saves through fldSave');
  G.data.opsData[0].runCost = prevRC; G.saveData();
  G.data.capital.aiBudget=_bud0[0];G.data.capital.budgetY2=_bud0[1];G.data.capital.budgetY3=_bud0[2];G.data.capStale=true;
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();
// Three-field model: rollout backfill, year-1 math, surfaces
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  G.ensureCapCostModel();
  ok(!!String((G.data.opsData[0]||{}).rolloutCost||'').trim(), 'CAP3: backfill copies the rollout estimate into the ops card');
  eq(G.costNum(G.data.opsData[0].rolloutCost), G.projCosts(0).roll, 'CAP3: backfilled rollout equals the 2.4 estimate');
  eq(G.opsRolloutCost(0), G.projCosts(0).roll, 'CAP3: opsRolloutCost reads the ops-card figure');
  const com = G.capCommitments();
  ok(!com.rows.some(r => r.label.indexOf('first year') >= 0), 'CAP3: staged first-year labels retired (single model, July 6)');
  ok(!com.rows.some(r => r.label === 'startup' || r.label === 'Startup Costs'), 'CAP3: no startup labels remain');
  const or0 = com.rows.find(r => r.i === 0);
  eq(or0.amt, G.capProjectWindow(0).inW, 'CAP3: an operational row commits its full in-window plan');
  const lensI = G.capLens();
  const sumY = lensI.years.reduce((a,r)=>a+r.committed,0);
  ok(Math.abs(com.total - sumY) <= 5, 'CAP3: IDENTITY – ledger total equals the per-year committed sums, one model  (got ' + com.total + ' vs ' + sumY + ')');
  // doLaunch also initializes rollout
  const snapL=(G.data.launched||[]).slice(); const snapOps=JSON.parse(JSON.stringify(G.data.opsData||{})); const snapStale=G.data.capStale;
  delete (G.data.opsData||{})[11];
  G.doLaunchGo(11);
  eq((G.data.opsData[11]||{}).rolloutCost, G.data.projects[11].rolloutCost, 'CAP3: doLaunch initializes Rollout Costs');
  G.data.launched=snapL; G.data.opsData=JSON.parse(JSON.stringify(snapOps)); G.data.capStale=snapStale; G.saveData();
  // ops card surfaces
  G.UI.expanded['oo0']=true;
  const ops=G.renderOutOperFull();
  has(ops, 'Rollout Costs', 'CAP3: ops card has the Rollout Costs box');
  has(ops, 'ops_0_rolloutCost', 'CAP3: rollout field id present');
  ok(ops.indexOf('rollEcho_0') < 0, 'CAP3: the rollout echo is retired (July 9)');
  G.UI.expanded['oo0']=false;
  // rollout field routes through fldSave
  const prevRoll=(G.data.opsData[0]||{}).rolloutCost;
  G.fldSave('ops_0_rolloutCost', '$55K');
  eq(G.data.opsData[0].rolloutCost, '$55K', 'CAP3: ops rollout field saves through fldSave');
  G.data.opsData[0].rolloutCost=prevRoll; G.saveData();
  // no old vocabulary on the money surfaces
  G.UI.capTab = 2; G.UI.expanded['acRef'] = true; // rows now live inside the Committed Sums fold (July 6)
  const t1=G.renderStepAlloc();
  G.UI.expanded['acRef'] = false;
  ok(t1.indexOf('Start-Up Budget') < 0, 'CAP3: Start-Up Budget gone from 3.2');
  has(t1, 'OVER THE PROGRAM', 'CAP3: ledger rows carry the figure cells (mini-dashboard, July 5)');
  ok(t1.indexOf('SUSTAINMENT') >= 0 && t1.indexOf('(EST.)') < 0 && t1.indexOf('not yet committed') < 0, 'CAP3: no estimate dimming \u2013 the full plan is committed at advance (single model, July 6)');
  has(t1, 'border-radius:50%', 'CAP3: status dot renders');
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

// expCardRO renders the recorded brief
(function(){
  const x = G.expCardRO(11);
  has(x, 'Development Costs', 'CAP: expCardRO shows the Development Costs');
  ok(typeof G.fiscalFold === 'function' && typeof G.fiscalHelpBox === 'function', 'CAP: fiscal fold + card wrapper both exist');
})();

/* ── BUDGET PLANS (redesign chunk A) ─────────────────────────── */
// Roll-up math on seed plans (sums must equal the carved simple figures)
(function(){
  eq(G.bpDevTotal(4), 150000, 'BP: item 4 dev roll-up');
  eq(G.bpRollTotal(4), 270000, 'BP: item 4 rollout roll-up');
  eq(G.bpSusSteady(4), 110000, 'BP: item 4 steady-state sustainment');
  eq(G.bpFirstOpMonth(4), 15, 'BP: first operational month follows the last step (rollout ends month 14 \u2013 reshaped July 7)');
  eq(G.bpSusStartOpYear(4), 1, 'BP: sustainment continuous from rollout\u2019s end');
  eq(G.bpSusOpYear(4,2), 110000, 'BP: a fully covered op year reads the annual rate');
  eq(G.bpSusYear(4,3), 110000, 'BP: project year 3 fully covered reads the annual rate (sustainment from month 15, reshaped July 7)');
  eq(G.bpPeakMonth(4), 5, 'BP: peak spending month');
  eq(G.bpLifetime(4), 150000+270000+201667, 'BP: lifetime = steps + sustainment inside the horizon (months 15\u201336 = 22 months at 110K/yr = 201,667)');
  [1,4,13].forEach(function(i){
    eq(G.bpDevTotal(i), G.costNum(G.data.projects[i].startupCost), 'BP: plan dev equals simple figure (item '+i+')');
    eq(G.bpRollTotal(i), G.costNum(G.data.projects[i].rolloutCost), 'BP: plan rollout equals simple figure (item '+i+')');
    eq(G.bpSusSteady(i), G.costNum(G.data.projects[i].runningCost), 'BP: plan steady sustainment equals simple figure (item '+i+')');
  });
})();
// Engine precedence + save guards
(function(){
  eq(G.devCost(13), G.bpDevTotal(13), 'BP: devCost reads the plan');
  const prev = G.data.experiments[13].budget;
  G.data.experiments[13].budget = '$999K';
  eq(G.devCost(13), 200000, 'BP: the plan outranks the simple field');
  G.data.experiments[13].budget = prev;
  G.fldSave('exp_13_budget', '$1M');
  eq(G.data.experiments[13].budget, prev, 'BP: locked experiment-card save is refused');
  const prevRC = (G.data.opsData[4]||{}).runCost;
  G.fldSave('ops_4_runCost', '$1M');
  eq((G.data.opsData[4]||{}).runCost, prevRC, 'BP: locked ops sustainment save is refused');
  const prevCS = G.data.projects[13].startupCost;
  G.fldSave('expl_13_cS', '$1M');
  eq(G.data.projects[13].startupCost, prevCS, 'BP: locked estimate save is refused');
  const prevN = (G.data.opsData[0]||{}).notes;
  G.fldSave('ops_0_notes', 'still works');
  eq(G.data.opsData[0].notes, 'still works', 'BP: unlocked ops fields still save');
  if(prevN===undefined) delete G.data.opsData[0].notes; else G.data.opsData[0].notes=prevN; G.saveData();
})();
// Operational-year windows + the gap
(function(){
  const snapOd = JSON.parse(JSON.stringify(G.data.opsData[1]||{}));
  const snapBp = JSON.parse(JSON.stringify(G.data.budgetPlans[1]));
  const snapPS = G.data.capital.periodStart;
  const snapAdv = G.data.projects[1].advancedAt;
  const d31 = new Date(); d31.setDate(1); d31.setMonth(d31.getMonth() - 30);
  G.data.capital.periodStart = d31.toISOString().slice(0, 10);
  G.data.projects[1].advancedAt = Date.parse(G.data.capital.periodStart);
  eq(G.opYear(1), 2, 'BP: thirty-one program months past its anchor lands in operational year 2 (first op month now 19; op year 1 = months 19\u201330 \u2013 reshaped July 7)');
  eq(G.opsSustainCost(1), 180000, 'BP: the first sustainment year covers the full annual rate');
  let r1 = G.capCommitments().rows.find(r => r.i === 1);
  ok(r1.label.indexOf('Full plan') === 0, 'BP: single model \u2013 the row is the full plan, launch year irrelevant');
  eq(r1.amt, G.capProjectWindow(1).inW, 'BP: the amount is the whole in-window plan');
  G.data.budgetPlans[1].sus[0].from = '43'; G.saveData();
  eq(G.bpSusStartOpYear(1), 3, 'BP: pushing the phase to month 43 moves the start to op year 3 (op years count from month 19 now)');
  eq(G.opsSustainCost(1), 0, 'BP: the gap year commits nothing');
  r1 = G.capCommitments().rows.find(r => r.i === 1);
  ok(r1.label.indexOf('Full plan') === 0, 'BP: single model \u2013 a sustainment gap does not change the row\u2019s basis');
  eq(r1.amt, G.capProjectWindow(1).inW, 'BP: the gap-adjusted amount still equals the whole in-window plan');
  G.data.opsData[1] = snapOd; G.data.budgetPlans[1] = snapBp;
  G.data.capital.periodStart = snapPS; G.data.projects[1].advancedAt = snapAdv; G.saveData();
})();
// Building and clearing a plan moves the engine live (UI handlers arrive in chunk C)
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const before = G.devCost(11);
  const pl = G.bpEnsure(11);
  pl.dev.push({id:'t1',name:'Test step',desc:'',from:'1',to:'2',cost:'$10K'}); G.saveData();
  eq(G.devCost(11), 10000, 'BP: a single step takes over the committed figure');
  pl.sus.push({id:'t2',name:'Run',from:'3',to:'ongoing',items:[{id:'t3',name:'Hosting',cost:'$5K'}]}); G.saveData();
  eq(G.bpHasSus(11), true, 'BP: a phase with items registers');
  eq(G.bpSusSteady(11), 5000, 'BP: phase items feed the steady rate');
  delete G.data.budgetPlans[11]; G.data.capStale = false; G.saveData();
  eq(G.devCost(11), before, 'BP: removing the plan restores the simple field');
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();
// Surfaces: locks live, year-bucket UI gone
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const s24 = G.renderStep24();
  ok(s24.indexOf('Cost Profile (multi-year)') < 0, 'BP: the year-bucket fold is gone from 2.4');
  G.UI.expanded['oe13'] = true; G.UI.expanded['oe11'] = true;
  const dev = G.renderOutExpbriefsFull();
  has(dev, 'Derived from budget plan', 'BP: note under the locked budget box, no article, 10px (Paul, July 6)');
  ok(dev.indexOf('exp_11_budget') >= 0 && dev.indexOf('budEcho_11') < 0, 'BP: planless items keep the editable box; the echo is retired (July 9)');
  ok(dev.indexOf('cp_13_startup_0') < 0, 'BP: grid cells are gone');
  G.UI.expanded['oe13'] = false; G.UI.expanded['oe11'] = false;
  G.UI.expanded['oo4'] = true;
  const ops = G.renderOutOperFull();
  has(ops, 'Derived from budget plan', 'BP: locked note on the ops card');
  has(ops, '>$110K</textarea>', 'BP: locked sustainment shows the steady rate; a continuous start needs no year label');
  G.UI.expanded['oo4'] = false;
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── TABBED CARDS (redesign chunk B) ────────────────────────── */
(function(){
  const s24 = G.renderStep24();
  has(s24, 'Project Budgeting', 'TB: 2.4 carries the budgeting tab');
  has(s24, 'Project Details', 'TB: 2.4 carries the details tab');
  G.UI.cardTab = G.UI.cardTab || {};
  // Naked Details/Budgeting tab pair removed from Dev/Ops/3.3 cards (Paul ruling, July 5): bpBudgetTab is reached through the Project card fold
  const dev = G.bpBudgetTab(13);
  has(dev, 'across 3 years', 'TB: stat band on the budget editor');
  ok(G.bpTabBar('tbprobe', 11).indexOf('lifetime') < 0, 'TB: the lifetime roll-up is off the tab button (Paul ruling, July 4)');
  has(dev, 'Vision model development', 'TB: step list renders');
  has(dev, 'over the length of the project period', 'TB: intro line on the budget editor');
  G.UI.expanded['oe13'] = true;
  const dev1 = G.renderOutExpbriefsFull();
  has(dev1, 'Portfolio Position', 'TB: the Development card keeps its brief body (vocabulary: position, July 10)');
  has(dev1, 'Derived from', 'TB: headline locks live on the card');
  has(dev1, 'Project card', 'TB: the Project card fold sits on the Development card');
  ok(dev1.indexOf('Choose what you want to work on') < 0, 'TB: no naked tab pair on the Development card');
  G.UI.expanded['oe13'] = false;
  const ops = G.bpBudgetTab(4);
  has(ops, 'Annual sustainment costs', 'TB: stat band on the ops budget editor');
  has(ops, 'Ongoing operation', 'TB: sustainment phase listed');
  has(ops, 'With 10% contingency', 'TB: contingency line renders when set');
  const s33 = G.renderStepExp();
  has(s33, 'Project card', 'TB: 3.3 briefs reach budgeting through the Project card fold');
  ok(s33.indexOf('Choose what you want to work on') < 0, 'TB: no naked tab pair on the 3.3 briefs');
  const dev11 = G.bpBudgetTab(11);
  has(dev11, 'Project Budgeting', 'TB: budget editor renders for planless items');
})();

/* ── PLAN EDITING (redesign chunk C) ───────────────────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  // Step lifecycle through the handlers
  G.bpAddStep(11,'dev');
  const pl = G.data.budgetPlans[11];
  eq(pl.dev.length, 1, 'PE: add step creates a row');
  const rid = pl.dev[0].id;
  G.bpRowSave(11,'dev',rid,'name','Build');
  G.bpRowSave(11,'dev',rid,'from','2');
  G.bpRowSave(11,'dev',rid,'to','4');
  G.bpRowSave(11,'dev',rid,'cost','$10K');
  eq(G.devCost(11), 10000, 'PE: saved step feeds the engine');
  eq(G.bpStepSpan(pl.dev[0]).join(','), '2,4', 'PE: the step span reads back');
  G.bpRowSave(11,'dev',rid,'from','6');
  eq(pl.dev[0].to, '6', 'PE: raising From clamps To');
  // Ghost rows become real on first input
  G.bpGhostSave(11,'roll','name','Deploy');
  eq(pl.roll.length, 1, 'PE: ghost row becomes real on input');
  G.bpGhostSave(11,'roll','name','   ');
  eq(pl.roll.length, 1, 'PE: blank input does not create rows');
  // Phases and line items
  G.bpGhostPhase(11,'name','Run');
  eq(pl.sus.length, 1, 'PE: ghost phase becomes real');
  eq(pl.sus[0].to, 'ongoing', 'PE: new phases default to Ongoing');
  const phid = pl.sus[0].id;
  G.bpPhSave(11,phid,'from','7');
  G.bpGhostItem(11,phid,'cost','$6K');
  eq(G.bpPhaseAnnual(pl.sus[0]), 6000, 'PE: ghost item feeds the phase rate');
  eq(G.bpSusSteady(11), 6000, 'PE: an ongoing phase sets the steady rate');
  G.bpItemSave(11,phid,pl.sus[0].items[0].id,'name','Hosting');
  eq(pl.sus[0].items[0].name, 'Hosting', 'PE: item saves');
  G.bpDelItem(11,phid,pl.sus[0].items[0].id);
  eq(pl.sus[0].items.length, 0, 'PE: item deletes');
  G.bpDelPhase(11,phid);
  eq(pl.sus.length, 0, 'PE: phase deletes');
  G.bpDelStep(11,'dev',rid);
  eq(G.bpHasDev(11), false, 'PE: deleting the step releases the lock');
  // Notes ride fldSave; meta rides bpMetaSave
  G.fldSave('bpn_11_dev','check assumptions');
  eq(G.data.budgetPlans[11].notes.dev, 'check assumptions', 'PE: notes save through fldSave');
  G.bpMetaSave(11,'horizon','5');
  eq(G.bpHorizon(11), 5, 'PE: lifetime selector saves');
  G.bpMetaSave(11,'contingency','15');
  eq(G.data.budgetPlans[11].contingency, '15', 'PE: contingency saves');
  delete G.data.budgetPlans[11]; G.data.capStale = false; G.saveData();
  // Surfaces
  G.UI.cardTab = G.UI.cardTab || {};
  const dev = G.bpBudgetTab(13);
  has(dev, 'DEVELOPMENT PHASES', 'PE: dev table renders (steps\u2192phases \u2013 Paul, July 6)');
  has(dev, 'ESTIMATED PROJECT LIFETIME', 'PE: lifetime selector renders');
  has(dev, 'CONTINGENCY %', 'PE: contingency field renders');
  has(dev, 'bps_13_dev_bp13a_name', 'PE: step inputs carry ids');
  has(dev, 'bpn_13_dev', 'PE: notes box renders');
  // Item 4's deliberate month-5 overlap draws the amber advisory
  const ops = G.bpBudgetTab(4);
  has(ops, 'is this correct?', 'PE: rollout-overlap advisory shows on item 4 \u2013 formal register (Paul ruling, July 5)');
  has(ops, 'Ongoing</option>', 'PE: sustainment To offers Ongoing');
  // Ghost rows on an empty plan
  const d11 = G.bpBudgetTab(11);
  has(d11, 'e.g. Build and validate model', 'PE: ghost rows teach by placeholder');
  has(d11, 'e.g. Ongoing operation', 'PE: ghost phase renders');
  if(G.data.budgetPlans[11]) { delete G.data.budgetPlans[11]; G.saveData(); }
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── PLAN CHARTS (redesign chunk D) ────────────────────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const sh = G.bpChartShape(4);
  ok(sh.indexOf('<svg') === 0, 'CH: spend shape renders as inline SVG');
  has(sh, '#45A188', 'CH: development series present (new palette)');
  ok(G.bpChartShape(4).indexOf('rgba(245,242,236,.12)') < 0, 'CH: the per-bar band is retired (Paul ruling)');
  has(G.bpChartWaterfall(4), 'with 10% contingency', 'CH: contingency lives on the waterfall end column now');
  const ln = G.bpChartLanes(4);
  has(ln, 'Line 1 instrumentation', 'CH: swimlane labels carry step names');
  const wf = G.bpChartWaterfall(4);
  has(wf, 'Sustainment yr 3', 'CH: waterfall carries sustainment years');
  has(wf, G.fmtMoney(G.bpLifetime(4)), 'CH: waterfall ends at the lifetime total');
  const cm = G.bpChartCum(4);
  has(cm, '= ' + G.fmtMoney(110000) + '/yr', 'CH: cumulative curve annotates the steady slope (Continuing costs beyond year N \u2013 Paul, July 6)');
  eq(G.bpChartShape(11), '', 'CH: no plan, no chart');
  // Ghost state teaches the payoff behind empty tables
  G.UI.cardTab = G.UI.cardTab || {};
  const d11 = G.bpBudgetTab(11);
  has(d11, 'pictures your plan will draw', 'CH: ghost caption teaches the payoff');
  // Charts sit on the budgeting tab after the tables
  const ops = G.bpBudgetTab(4);
  has(ops, 'MONTHLY SPEND SHAPE', 'CH: spend shape on the budgeting tab');
  has(ops, 'STEP TIMELINE', 'CH: swimlanes on the budgeting tab');
  has(ops, 'lifetime, including ongoing sustainment', 'CH: cumulative chart titled with the lesson');
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── BUDGET SHEET (redesign chunk E) ───────────────────────── */
(function(){
  const sh = G.renderBudgetSheetFor(4);
  has(sh, 'Project Budget Sheet', 'SH: sheet header');
  has(sh, 'Estimate \u00b7', 'SH: estimate stamp');
  has(sh, 'Operational', 'SH: stage named');
  has(sh, 'estimates of commitments, not tracked spend', 'SH: doctrine footer');
  has(sh, '90 Days to an AI Innovation Pipeline', 'SH: attribution');
  has(sh, 'Line 1 instrumentation', 'SH: compact step table carries step names');
  has(sh, G.fmtMoney(G.bpLifetime(4)), 'SH: lifetime on the band');
  has(sh, 'With 10% contingency', 'SH: contingency line');
  ok(sh.indexOf('rgba(245,242,236,.25)') < 0, 'SH: chart ink swapped for paper');
  has(sh, 'rgba(26,22,18', 'SH: dark ink present');
  has(sh, '#45A188', 'SH: category colors survive to print (new palette)');
  has(sh, 'Sensor &amp; gateway upkeep', 'SH: sustainment line items listed');
  // the print button rides the budget editor (reached through the Project card fold since July 5)
  has(G.bpBudgetTab(4), 'printBudgetSheet(4)', 'SH: print button on the budget editor');
})();

/* ── STEP RESTRUCTURE (org chunk G) ───────────────────────── */
(function(){
  const cap = G.renderStepCap();
  has(cap, 'Step 2: Plan Capacity', 'ST: the capacity step exists at 3.2');
  has(cap, 'Year 1 budget', 'ST: the year fields live on Plan Capacity (envelope header retired)');
  ok(cap.indexOf('cap_fyStartMonth') < 0, 'ST: the fiscal-year override does NOT live on Plan Capacity (relocated to the review date band \u2013 Paul, July 7; supersedes Ruling 5 via the July 7 return)');
  has(G.renderStep44(), 'cap_fyStartMonth', 'ST: the override lives in the review surface \u2013 align future reviews at review time');
  has(G.renderStep44(), 'Same as planning period', 'ST: it defaults to deriving from the period start');
  // FY override: display convention only \u2013 quarters move, money does not
  (function(){
    const fyWas = G.data.capital.fyStartMonth;
    G.data.capital.fyStartMonth = 1; G.Store.commit('capital');
    eq(G.fyQuarterOf(new Date(2026, 6, 15)).q, 3, 'FY: with a January fiscal year, July sits in Q3 (was Q2 on the April period start)');
    eq(Math.round(G.capCommitments().total), 3246249, 'FY: the override never touches money \u2013 the committed identity holds');
    if (fyWas === undefined) delete G.data.capital.fyStartMonth; else G.data.capital.fyStartMonth = fyWas;
    G.Store.commit('capital');
    eq(G.fyQuarterOf(new Date(2026, 6, 15)).q, 2, 'FY: cleared, quarters derive from the period start again (April \u2192 July is Q2)');
  })();
  has(cap, 'saveDoneCap()', 'ST: capacity has its own done gate');
  G.UI.capTab = 2; G.UI.expanded['acRef'] = true;
  const al = G.renderStepAlloc();
  has(al, 'Step 3: Allocate Capital', 'ST: Allocate renumbered to 3.3');
  ok(G.renderStepAlloc().indexOf('set at Step 3.2 (Plan Capacity)') < 0, 'ST: the fiscal-context pointer retired with the duplicate reference card (July 6)');
  ok(al.indexOf('BUDGET ENVELOPE') < 0, 'ST: the envelope is gone from Allocate');
  ok(al.indexOf('cap_aiBudget') < 0, 'ST: the budget field is gone from Allocate');
  const ex = G.renderStepExp();
  has(ex, 'Step 4: Map Development Track', 'ST: 3.4 rebuilt as Define Development Program (P2, July 5)');
  eq(G.CAROUSEL_CONTENT['3.2'][0].kind, 'Why', 'ST: new capacity carousel in place');
  ok(!!G.CAROUSEL_CONTENT['3.4'], 'ST: experiments carousel re-keyed to 3.4');
  has(G.CAROUSEL_CONTENT['3.4'][1].body, 'funded this cohort at Allocate Capital', 'ST: 3.4 carousel carries the approved redraft (Paul, July 6)');
  ok(!!G.MILESTONES['3.4'], 'ST: milestone follows the bump');
  G.UI.sec = '1.4';
  const bat = G.renderStep11();
  has(bat, 'AI Innovation Audit', 'ST: audit renamed');
  ok(bat.indexOf('au_0_cost') < 0, 'ST: audit cost column dropped');
  has(bat, 'au_0_status', 'ST: audit status column survives');
  G.UI.sec = '1.1';
})();

/* ── CAPACITY PLAN (org chunk H) ─────────────────────────── */
(function(){
  const cap = G.renderStepCap();
  has(cap, '>Planning</h3>', 'CY: planning card renders (Paul, July 6 \u2013 shape select retired)');
  has(cap, 'cap_periodStart', 'CY: period start input');
  ok(cap.indexOf('cap_programEnd') < 0 && cap.indexOf('cap_programShape') < 0, 'CY: shape and end-date controls fully retired (Paul, July 6 \u2013 year-granular cut ruled useless)');
  has(cap, '>1 year<', 'CY: the planning period offers a single year, singular label');
  has(cap, '>5 years<', 'CY: the planning period runs to five years');
  // WN: identity holds on a narrowed window
  (function(){
    const eyW = G.data.capital.envYears;
    G.data.capital.envYears = '2'; G.Store.commit('capital');
    eq(G.envYearsOf(), 2, 'WN: a two-year window is now selectable');
    const comW = G.capCommitments(); const lensW = G.capLens();
    const sumW = lensW.years.reduce((a,r)=>a+r.committed,0);
    ok(Math.abs(comW.total - sumW) <= 5, 'WN: IDENTITY holds on the narrowed window  (got ' + comW.total + ' vs ' + sumW + ')');
    ok(lensW.years.length === 2 && comW.total < 3246249, 'WN: two year rows, and Committed drops as the window narrows');
    G.data.capital.envYears = eyW; G.Store.commit('capital');
    eq(G.capCommitments().total, 3246249, 'WN: restoring the window restores the single-model constant');
  })();
  has(cap, 'Sustainment Cap', 'CY: cap field present');
  ok(cap.indexOf('University Cooperation Fund') < 0 && cap.indexOf('Offset pots') < 0 && cap.indexOf('Offset Pots') < 0, 'CY: no pots anywhere on 3.2 (offsets retired by ruling, July 4)');
  has(cap, 'cap_reserveY2', 'CY: reserve inputs on the envelope');
  has(cap, 'Capacity Picture', 'CY: picture card renders');
  has(cap, 'Intake reserve within capacity', 'CY: picture legend');
  has(cap, 'Sustainment cap 40%', 'CY: cap line in the legend');
  ok(cap.indexOf('evenly across its twelve months') < 0, 'CY: the flat-spread sentence is retired from the picture (Paul, July 4)');
  eq(G.envReserveYear(2), 700000, 'CY: reserve reads');
  // singleton saves through fldSave
  const prevPS = G.data.capital.periodStart;
  G.fldSave('cap_periodStart', '2026-02-01');
  eq(G.data.capital.periodStart, '2026-02-01', 'CY: period start saves through fldSave');
  G.data.capital.periodStart = prevPS; G.saveData();
  // fixed-term machinery fully removed (Paul, July 6 — year-granular cut ruled useless)
  const snap = JSON.parse(JSON.stringify(G.data.capital));
  // gate names both requirements (clear the seed completion so the hint can render)
  const prevDone = G.data.completedSteps['3.2'];
  G.data.completedSteps['3.2'] = false;
  G.data.capital.periodStart = '';
  const gate = G.renderStepCap();
  has(gate, 'year-one budget and the period start date', 'CY: gate names both requirements (reworded \u2013 copy pass, July 6)');
  G.data.completedSteps['3.2'] = prevDone;
  G.data.capital = JSON.parse(JSON.stringify(snap)); G.saveData();
})();

/* ── LEGACY INTAKE (org chunk I) ──────────────────────────── */
(function(){
  G.UI.capPlanTab = 2;
  const t2 = G.renderStepCap();
  has(t2, 'Legacy Projects', 'LG: tab 2 renders (header slimmed, July 4)');
  has(t2, 'Assigned to this budget?', 'LG: assign question is a header above the list');
  ok(t2.indexOf('funded elsewhere') < 0 && t2.indexOf('Funded elsewhere') < 0, 'LG: the select is just yes or no');
  ok(t2.indexOf('Legacy Projects \u2013 the opening position') < 0, 'LG: the meta-commentary header is gone');
  // yes items collected at the top (July 4): seed audit = yes,yes,no,no,yes -> Predictive maintenance precedes Document classification
  ok(t2.indexOf('Predictive maintenance') < t2.indexOf('Document classification'), 'LG: yes projects sort above the rest');
  has(t2, 'AI-assisted customer triage', 'LG: audit items listed');
  has(t2, 'legacyAssign(', 'LG: assignment selects wired');
  has(t2, 'does it draw on your AI transformation budget', 'LG: intro asks the one question (renamed budget, Paul July 7)');
  has(t2, 'stays off the organizational charts', 'LG: a no answer is explained');
  has(t2, '>Legacy<', 'LG: linked seed items wear the badge on their rows');
  // assignment roundtrip
  const prevA = G.data.audit[2].assigned;
  G.legacyAssign(2, 'yes');
  eq(G.data.audit[2].assigned, 'yes', 'LG: assignment saves');
  G.legacyAssign(2, prevA);
  // dynamic intake at Operational
  const nIdeas = G.data.ideas.length;
  G.addAudit();
  const ai = G.data.audit.length - 1;
  G.data.audit[ai].name = 'Test legacy system';
  G.UI.legacyStage[ai] = 'operational';
  G.data.capStale = true;
  const beforeC = G.capAvailable().committed;
  G.legacyIntake(ai);
  const idx = G.data.ideas.length - 1;
  eq(G.data.ideas.length, nIdeas + 1, 'LG: intake creates the idea');
  eq(G.data.projects[idx].legacy, true, 'LG: project carries the legacy flag');
  ok(G.data.launched.indexOf(idx) >= 0, 'LG: operational intake lands in launched');
  eq(G.data.audit[ai].projIdx, idx, 'LG: audit item links to the card');
  eq(G.opFirstYear(idx), false, 'LG: legacy operational is never first-year');
  // forward-only plan: sustainment from month 1, $12K a year
  G.data.budgetPlans[idx] = { horizon:'3', sus:[ {id:'lgt1', name:'Run', from:'1', to:'ongoing', items:[ {id:'lgti1', name:'Hosting', cost:'$12K'} ]} ] };
  G.data.capStale = true;
  eq(G.opsSustainCost(idx), 12000, 'LG: legacy sustainment reads the plan at full annual rate');
  G.data.capStale = true;
  eq(G.capAvailable().committed, beforeC + 36000, 'LG: the promise lands across the whole window \u2013 12,000/yr \u00d7 3 years (single model)');
  const ops = G.renderOutOperFull();
  has(ops, '>Legacy<', 'LG: operational card head wears the badge');
  // the fold embeds the budget form with the forward-only note
  G.UI.expanded['lgb' + idx] = true;
  const t2b = G.renderStepCap();
  has(t2b, 'money spent before the period began', 'LG: fold carries the forward-only note in plain words');
  has(t2b, 'bpm_' + idx + '_horizon', 'LG: the budgeting editor is embedded on tab 2');
  delete G.UI.expanded['lgb' + idx];
  // full cleanup – idx is last everywhere it was pushed
  G.data.ideas.pop();
  G.data.launched = G.data.launched.filter(function(x){return x !== idx});
  G.data.expSelected = G.data.expSelected.filter(function(x){return x !== idx});
  G.data.selected = G.data.selected.filter(function(x){return x !== idx});
  delete G.data.projects[idx];
  delete G.data.budgetPlans[idx];
  delete G.data.opsData[idx];
  G.data.audit.pop();
  G.data.capStale = true;
  eq(G.capAvailable().committed, beforeC, 'LG: cleanup restores the committed sum');
  // gate blocks on an unanswered named item
  G.addAudit();
  G.data.audit[G.data.audit.length - 1].name = 'Unanswered thing';
  eq(G.capAuditAnswered(), false, 'LG: an unanswered named item blocks the gate');
  const prevDone = G.data.completedSteps['3.2'];
  G.data.completedSteps['3.2'] = false;
  const gate = G.renderStepCap();
  has(gate, 'budget question for every legacy initiative', 'LG: gate hint names the requirement (reworded \u2013 copy pass, July 6)');
  G.data.completedSteps['3.2'] = prevDone;
  G.data.audit.pop();
  eq(G.capAuditAnswered(), true, 'LG: seed inventory is fully answered');
  G.UI.capPlanTab = 1;
  G.saveData();
})();

/* ── CALENDAR ENGINE (org chunk J1) ───────────────────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const near = (x, y, tol, label) => ok(Math.abs(x - y) <= (tol || 1), label + ' (got ' + x + ', want ~' + y + ')');
  // controlled state – save everything touched
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  G.data.capital.periodStart = '2026-01-01';
  eq(G.progMonthOf('2026-03-15'), 3, 'JB: program month of a date');
  const set = G.orgCommittedSet();
  ok(set.some(e => e.i === 13) && set.some(e => e.i === 0), 'JB: committed set holds dev and ops members');
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  set.forEach(e => { if (!G.bpHasAny(e.i) && e.i !== 0) { G.data.projects[e.i] = G.data.projects[e.i] || {}; G.data.projects[e.i].advancedAt = Date.parse('2025-01-01'); } });
  G.data.projects[13].advancedAt = Date.parse('2026-03-01');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.projects[4].advancedAt = Date.parse('2026-01-01');
  G.data.projects[0].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2026-02-01';
  // anchors
  eq(G.anchorMonth(13), 3, 'JB: anchor from advancedAt');
  G.data.projects[13].legacy = true;
  eq(G.anchorMonth(13), 1, 'JB: legacy anchors at the period start');
  delete G.data.projects[13].legacy;
  G.data.projects[13].startDate = '2026-05-01';
  eq(G.anchorMonth(13), 5, 'JB: a human-stated start date outranks advancedAt');
  delete G.data.projects[13].startDate;
  // the series, hand-computed from the seed
  const s = G.orgMonthly();
  near(s[2].dev, 130166.67, 1, 'JB: month-3 development stacks three plans, gross (16,666.67 + 86,000 + 27,500 \u2013 offsets retired July 4)');
  near(s[0].dev, 230000, 1, 'JB: month-1 development includes the no-plan lump');
  near(s[1].roll, 50000, 1, 'JB: no-plan rollout lands whole at launch');
  near(s[13].sus - s[12].sus, 5000, 1, 'JB: no-plan sustainment starts a twelfth per month, a year after launch');
  let dv = 0, rl = 0, su = 0; s.forEach(x => { dv += x.dev; rl += x.roll; su += x.sus; });
  near(dv, 1200000, 1, 'JB: development total – 680 + 150 + 200 + 170 lump (gross; offsets retired)');
  near(rl, 800000, 1, 'JB: rollout total');
  near(su, 796666.67, 1, 'JB: sustainment total (366,666.67 + 430,000 \u2013 the 1/4/13 reshape\u2019s added in-window sustainment, July 7)');
  eq(G.capMonthlyLine(1), G.envBudgetYear(1), 'JB: ANNUAL STEP \u2013 the full year budget lands in month 1 (Paul, July 7)');
  eq(G.capMonthlyLine(2), 0, 'JB: no accrual mid-year \u2013 the staircase is flat until the next year begins');
  eq(G.capMonthlyLine(13), G.envBudgetYear(2), 'JB: year 2\u2019s step lands in month 13');
  near(G.capSusCapLine(1), 2400000 / 12 * 0.4, 1, 'JB: cap line is 40% of it');
  // breaches: cumulative semantics
  G.data.capital.aiBudget='$10M';G.data.capital.budgetY2='$10M';G.data.capital.budgetY3='$10M';G.data.capStale=true; // the frame's lumps breach the tightened seed budget by design
  eq(G.capBreaches().overCapMonth, 0, 'JB: a roomy envelope holds – no breach in the controlled frame');
  G.data.capital.aiBudget = '$50K'; G.data.capital.budgetY2 = '$50K'; G.data.capital.budgetY3 = '$50K';
  eq(G.capBreaches().overCapMonth, 1, 'JB: tiny capacity breaches in month 1');
  G.data.capital = JSON.parse(JSON.stringify(cap0)); G.data.capital.periodStart = '2026-01-01';
  G.data.capital.susCap = '1';
  eq(G.capBreaches().capYears, [2, 3], 'JB: a 1% cap flags years two and three');
  G.data.capital = JSON.parse(JSON.stringify(cap0)); G.data.capital.periodStart = '2026-01-01';
  // legacy fixed-term data is ignored gracefully (machinery removed July 6)
  G.data.capital.programShape = 'fixed'; G.data.capital.programEnd = '2027-01-01';
  const s2 = G.orgMonthly();
  ok(s2[12].dev + s2[12].roll + s2[12].sus > 0, 'JB: a stale programEnd field no longer truncates anything');
  G.data.capital = JSON.parse(JSON.stringify(cap0)); G.data.capital.periodStart = '2026-01-01';
  // the editor and its read-only form
  const ed = G.bpBudgetTab(13);
  ok(ed.indexOf('OFFSETS') < 0 && ed.indexOf('bpOffSave') < 0, 'JB: no offsets section anywhere on the editor (retired by ruling, July 4)');
  const ro = G.bpBudgetTab(13, true);
  ok(ro.indexOf('OFFSETS') < 0, 'JB: nor on the read-only view');
  // the as-committed snapshot
  const sn = G.bpSnapshot(13);
  eq(sn.startDate, '2026-03-01', 'JB: snapshot records the committed start date');
  eq(sn.horizon, 3, 'JB: snapshot horizon');
  eq(sn.lifetime, G.bpLifetime(13), 'JB: snapshot lifetime matches the plan');
  eq(sn.years.length, 3, 'JB: snapshot carries per-project-year figures');
  eq(sn.dev, G.devCost(13), 'JB: snapshot per-category totals');
  // the hook fires at the real commit moment
  G.data.ideas.push({ name: 'Snapshot probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx);
  G.data.projects[idx] = { viable: true };
  G.data.portfolio[idx] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.advanceToDevFromExplore(idx);
  ok(G.data.expSelected.indexOf(idx) >= 0, 'JB: probe project advanced');
  ok(!!(G.data.projects[idx].committedSnap && G.data.projects[idx].committedSnap.at), 'JB: advance takes the as-committed snapshot');
  eq(String(G.data.projects[idx].committedSnap.startDate).length, 10, 'JB: snapshot start date is a date');
  // cleanup
  G.data.ideas.pop();
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx);
  G.data.selected = G.data.selected.filter(x => x !== idx);
  delete G.data.projects[idx]; delete G.data.portfolio[idx]; delete G.data.experiments[idx]; delete G.data.capAlloc[idx];
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── QUARTERS ON THE PROGRAM CALENDAR (org chunk J2a) ─────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const set = G.orgCommittedSet();
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  G.data.capital.periodStart = '2026-01-01';
  set.forEach(e => { if (!G.bpHasAny(e.i) && e.i !== 0) { G.data.projects[e.i] = G.data.projects[e.i] || {}; G.data.projects[e.i].advancedAt = Date.parse('2025-01-01'); } });
  G.data.projects[13].advancedAt = Date.parse('2026-03-01');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.projects[4].advancedAt = Date.parse('2026-01-01');
  G.data.projects[0].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2026-02-01';
  const w = G.capPeriod(new Date(2026, 2, 1), new Date(2026, 5, 1));
  ok(w.ps === true, 'JQ: capPeriod reads the program calendar');
  ok(Math.abs(w.total - 361929) <= 2, 'JQ: three-month slice sums the anchored series, gross (was 347,643 net; delta 14,285.7 = 0.25 \u00d7 item 13\u2019s netted 57,142.86 in the slice \u2013 offsets retired July 4) (got ' + w.total + ')');
  ok(w.rows.some(r => r.label.indexOf('program Months 3\u20135') >= 0), 'JQ: rows carry the calendar window');
  ok(w.rows.every(r => r.i !== 0), 'JQ: a project with nothing in the window has no row');
  eq(G.opFirstYear(1), true, 'JQ: anchored plan keeps item 1 in its one-time era (development and rollout underway)');
  eq(G.opYear(1), 1, 'JQ: op-year derives from the anchor and the plan');
  G.data.projects[1].advancedAt = Date.parse('2023-01-01');
  G.data.capital.periodStart = '2023-01-01';
  eq(G.opFirstYear(1), false, 'JQ: an old anchor ages the item past its first year \u2013 no launch date needed');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.capital.periodStart = '2026-01-01';
  G.data.capital.periodStart = '';
  const w2 = G.capPeriod(new Date(2026, 2, 1), new Date(2026, 5, 1));
  ok(w2.ps === false && w2.total === 0, 'JQ: without a period start the window is honestly empty');
  eq(G.thisQuarterConsumption().p.total, 0, 'JQ: This Quarter degrades honestly too');
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.saveData();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── ALLOCATE CAPITAL RESTRUCTURE (org chunk K) ─────────────── */
(function(){
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  G.data.capital.periodStart = '2026-01-01';
  // two tabs
  G.UI.capTab = 1;
  const sb = G.renderStepAlloc();
  has(sb, '1 \u00b7 Sandbox', 'KA: sandbox tab named');
  has(sb, '2 \u00b7 Commit & Advance', 'KA: commit tab named');
  has(sb, 'nothing is saved', 'KA: sandbox doctrine stated');
  // a dynamic Go candidate for the whole flow
  G.data.ideas.push({ name: 'Sandbox probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx);
  G.data.projects[idx] = { viable: true, startupCost: '$60K' };
  G.data.portfolio[idx] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.data.capAlloc[idx] = { gateRows: [ { d: 'Pilot gate', a: '$10K', w: 'wk 4' } ] };
  // extras engine: a hypothetical anchored at month 7 adds exactly its lump
  const base7 = G.orgMonthly()[6].dev;
  eq(Math.round(G.orgMonthly([{ i: idx, anchor: 7 }])[6].dev - base7), 60000, 'KA: a sandbox extra lands its development lump at its assumed anchor');
  // ticked batch draws the charts
  G.UI.capSim[idx] = true;
  const sb2 = G.renderStepAlloc();
  has(sb2, 'Staged batch (1)', 'KA: staged batch card renders (retitled July 4)');
  has(sb2, 'assumed start for every ticked candidate is next month (program Month ', 'KA: assumed-start sentence leads with next month, computed month in brackets (Paul, July 7)');
  has(sb2, '<svg', 'KA: the batch draws the charts');
  G.UI.capSim[idx] = false;
  // commit flow: start date, landing line, snapshot precedence
  G.UI.capTab = 2;
  // date inputs save silently on change; render is deferred to blur (July 5 crash fix)
  let _dr = 0; const _rr = G.render; G.render = () => { _dr++; };
  G.capStartSave(idx, '2026-04-01');
  eq(_dr, 0, 'KA: capStartSave no longer renders mid-edit \u2013 date segments survive');
  G.render = _rr;
  eq(G.data.projects[idx].startDate, '2026-04-01', 'KA: the assumed start date saves');
  const ca = G.renderStepAlloc();
  has(ca, 'prj_' + idx + '_startDate', 'KA: commit card carries the date input');
  has(ca, 'Plan Month 1 lands program Month 4', 'KA: the landing line reads the calendar');
  ok(ca.indexOf('Shown, never gated') < 0, 'KA: meta voice purged from the landing line');
  ok(ca.indexOf('Advance queue') >= 0 && ca.indexOf('Advance queue') < ca.indexOf('On the calendar'), 'KA: the queue precedes the calendar (July 4 redesign)');
  G.advanceWithGates(idx);
  ok(G.data.expSelected.indexOf(idx) >= 0, 'KA: the probe advanced');
  eq(G.data.projects[idx].committedSnap.startDate, '2026-04-01', 'KA: the snapshot records the human-stated date, not the advance moment');
  eq(G.anchorMonth(idx), 4, 'KA: the stated date is the anchor');
  // a second probe with no date gets the stated default assumption
  G.data.ideas.push({ name: 'Default-date probe', desc: '', when: 'now' });
  const idx2 = G.data.ideas.length - 1;
  G.data.selected.push(idx2);
  G.data.projects[idx2] = { viable: true, startupCost: '$10K' };
  G.data.portfolio[idx2] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.data.capAlloc[idx2] = { gateRows: [ { d: 'Gate', a: '$5K', w: 'wk 2' } ] };
  G.advanceWithGates(idx2);
  const dDef = new Date(); dDef.setDate(1); dDef.setMonth(dDef.getMonth() + 1);
  eq(G.data.projects[idx2].startDate, dDef.toISOString().split('T')[0], 'KA: a dateless commit assumes the first of next month \u2013 recorded, not implied');
  // breach opens the override path, and the record survives
  G.data.capital.aiBudget = '$50K'; G.data.capital.budgetY2 = '$50K'; G.data.capital.budgetY3 = '$50K';
  ok(G.capBreaches().overCapMonth > 0, 'KA: tiny capacity breaches');
  const cb = G.renderStepAlloc();
  has(cb, 'PROCEED ANYWAY \u2013 RECORDED OVERRIDE', 'KA: the override path opens on breach');
  has(cb, 'cap_overrideReason', 'KA: the reason field is there');
  G.capOverrideRecord('running hot \u2013 year-two reserve absorbs it if intake lags');
  eq((G.data.capital.overrides || []).length, 1, 'KA: the override is recorded');
  ok(G.data.capital.overrides[0].month > 0 && !!G.data.capital.overrides[0].at, 'KA: the record carries the breach month and the moment');
  has(G.renderStepAlloc(), 'year-two reserve absorbs it', 'KA: the paper trail renders');
  G.capOverrideRecord('   ');
  eq(G.data.capital.overrides.length, 1, 'KA: a blank reason records nothing');
  // cleanup – idx2 then idx are the last two everywhere
  G.data.ideas.pop(); G.data.ideas.pop();
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx && x !== idx2);
  G.data.selected = G.data.selected.filter(x => x !== idx && x !== idx2);
  [idx, idx2].forEach(k => { delete G.data.projects[k]; delete G.data.portfolio[k]; delete G.data.capAlloc[k]; delete G.data.experiments[k]; delete G.UI.capSim[k]; });
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
})();

/* ── LAUNCH CONFIRM-OR-REVISE + ANCHOR LINE (org chunk L) ───────── */
(function(){
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  // deterministic clock: period start six months back, anchor at period start → plan month now = 7
  const d6 = new Date(); d6.setDate(1); d6.setMonth(d6.getMonth() - 6);
  G.data.capital.periodStart = d6.toISOString().split('T')[0];
  G.data.ideas.push({ name: 'Launch probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx); G.data.expSelected.push(idx);
  G.data.projects[idx] = { viable: true, startDate: G.data.capital.periodStart };
  G.data.portfolio[idx] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.data.tracking[idx] = { status: 'complete' };
  G.data.budgetPlans[idx] = { horizon: '3',
    dev: [ { id: 'ld1', name: 'Build', from: '1', to: '2', cost: '$20K' } ],
    roll: [ { id: 'lr1', name: 'Deploy', from: '3', to: '4', cost: '$8K' } ],
    sus: [ { id: 'ls1', name: 'Run', from: '5', to: 'ongoing', items: [ { id: 'lsi1', name: 'Host', cost: '$6K' } ] } ] };
  eq(G.planMonthNow(idx), 7, 'LN: plan month now reads the anchor');
  // the button opens the panel; nothing launches yet
  G.doLaunch(idx);
  ok((G.data.launched || []).indexOf(idx) < 0, 'LN: doLaunch no longer launches – it opens the panel');
  ok(G.UI.expanded['lp' + idx] === true, 'LN: panel state set');
  G.UI.expanded['oe' + idx] = true;
  const dev = G.renderOutExpbriefsFull();
  has(dev, 'CONFIRM OR REVISE – LAUNCH', 'LN: the panel renders inline at the button');
  has(dev, 'plan Month 5; the launch is happening at plan Month 7 (2 months late)', 'LN: divergence stated');
  has(dev, 'Rows that have not yet run are listed', 'LN: only unrun rows are listed');
  ok(dev.indexOf('lp_' + idx + '_dev_ld1_f') < 0, 'LN: an elapsed development step is not listed');
  ok(dev.indexOf('lp_' + idx + '_roll_lr1_f') < 0, 'LN: an elapsed rollout step is not listed');
  has(dev, 'lp_' + idx + '_sus_ls1_f', 'LN: the not-yet-started sustainment phase is listed with its dropdown');
  // revise through the embedded dropdown handler, then confirm
  G.bpPhSave(idx, 'ls1', 'from', '8');
  eq(G.data.budgetPlans[idx].sus[0].from, '8', 'LN: the panel dropdown edits the real plan');
  G.capLaunchConfirm(idx);
  ok((G.data.launched || []).indexOf(idx) >= 0, 'LN: confirm launches');
  has(G.data.opsData[idx].launchConfirm.note, 'confirmed against actual launch', 'LN: the confirmation is recorded');
  ok(G.UI.expanded['lp' + idx] === false, 'LN: panel closes');
  // on-schedule wording (fresh probe state: pretend not launched, anchor moved so pm === firstOp)
  G.data.launched = G.data.launched.filter(x => x !== idx);
  delete G.data.opsData[idx];
  const d2 = new Date(d6); d2.setMonth(d2.getMonth() + 4); // anchor 4 months in → pm = 3... recompute below
  G.data.projects[idx].startDate = d2.toISOString().split('T')[0];
  // pm = 7 - anchor(5) + 1 = 3; firstOp = 5 → still divergent (early); set anchor 2 months in → pm = 5 = firstOp
  const d3 = new Date(d6); d3.setMonth(d3.getMonth() + 2);
  G.data.projects[idx].startDate = d3.toISOString().split('T')[0];
  eq(G.planMonthNow(idx), 5, 'LN: re-anchoring moves the plan month');
  G.doLaunch(idx);
  const dev2 = G.renderOutExpbriefsFull();
  has(dev2, 'On schedule: the plan expected the first operational month exactly now (plan Month 5). One click.', 'LN: on-schedule is one click');
  G.UI.expanded['lp' + idx] = false;
  // the anchor line on the budgeting tab
  const bt = G.bpBudgetTab(idx);
  has(bt, 'MONTHS COUNT FROM', 'LN: anchor line renders for a committed item');
  has(bt, 'program Month 3', 'LN: anchor line states the program month');
  has(bt, 'already passed since this date', 'LN: elapsed advisory present');
  has(bt, 'repositions the whole plan', 'LN: ruling-3 advisory in functional voice');
  // an uncommitted item shows no anchor line
  ok(G.bpBudgetTab(2).indexOf('MONTHS COUNT FROM') < 0, 'LN: exploration items carry no anchor line');
  // cleanup
  G.data.ideas.pop();
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx);
  G.data.selected = G.data.selected.filter(x => x !== idx);
  delete G.data.projects[idx]; delete G.data.portfolio[idx]; delete G.data.tracking[idx];
  delete G.data.budgetPlans[idx]; delete G.data.opsData[idx]; delete G.data.experiments[idx];
  delete G.UI.expanded['lp' + idx]; delete G.UI.expanded['oe' + idx];
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
})();

/* ── REVIEW SNAPSHOT (org chunk M) ───────────────────────── */
(function(){
  // seed state: reserves render, nothing else has drifted
  const r44 = G.renderStep44();
  has(r44, 'Review Snapshot</h3>', 'REVSNAP: title rolled back to Review Snapshot (Paul, July 7) \u2013 sectioned card, no meta gloss');
  ['Start Date Drift','Launch Variance','Overrides','Sustainment Cap','Intake Reserve'].forEach(function(t){has(r44, t + '</div>', 'REVSNAP: section heading \u201c' + t + '\u201d renders');});
  has(r44, '>\u2014</p>', 'REVSNAP: empty sections show a dash');
  has(r44, 'intake reserve', 'MB: reserve line renders');
  has(r44, 'is intake keeping pace?', 'MB: replenishment question has teeth');
  // controlled drift
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const d6 = new Date(); d6.setDate(1); d6.setMonth(d6.getMonth() - 6);
  G.data.capital.periodStart = d6.toISOString().split('T')[0];
  G.data.ideas.push({ name: 'Drift probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx); G.data.expSelected.push(idx);
  G.data.projects[idx] = { viable: true, startDate: '2026-04-01', committedSnap: { at: 1, by: '', startDate: '2026-02-01', horizon: 3, lifetime: 0, dev: 0, roll: 0, sus: 0, years: [], contingency: '' } };
  const r2 = G.renderStep44();
  has(r2, 'start date: committed at 2026-02-01, now says 2026-04-01', 'MB: start-date drift reads committed vs now');
  // launch drift through the real confirmation
  G.data.projects[idx].startDate = G.data.capital.periodStart; // anchor at period start \u2192 pm = 7
  G.data.budgetPlans[idx] = { horizon: '3',
    dev: [ { id: 'md1', name: 'Build', from: '1', to: '2', cost: '$10K' } ],
    roll: [ { id: 'mr1', name: 'Deploy', from: '3', to: '4', cost: '$5K' } ],
    sus: [ { id: 'ms1', name: 'Run', from: '5', to: 'ongoing', items: [ { id: 'msi1', name: 'Host', cost: '$3K' } ] } ] };
  G.capLaunchConfirm(idx);
  eq(G.data.opsData[idx].launchConfirm.expectedFo, 5, 'MB: confirmation records the expected first-op month');
  eq(G.data.opsData[idx].launchConfirm.actualPm, 7, 'MB: confirmation records the actual plan month');
  const r3 = G.renderStep44();
  has(r3, 'launch: expected plan Month 5, launched at 7 (2 months late)', 'MB: launch drift reads the record');
  // an override surfaces with its reason
  G.data.capital.overrides = [ { id: 'ov1', at: Date.now(), by: '', month: 3, reason: 'running hot into the year-two reserve' } ];
  has(G.renderStep44(), 'running hot into the year-two reserve', 'MB: overrides surface at the review');
  // cleanup
  G.data.ideas.pop();
  G.data.launched = G.data.launched.filter(x => x !== idx);
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx);
  G.data.selected = G.data.selected.filter(x => x !== idx);
  delete G.data.projects[idx]; delete G.data.budgetPlans[idx]; delete G.data.opsData[idx]; delete G.data.experiments[idx];
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
})();

/* ── VISUAL DASHBOARD (org chunk V) ──────────────────────── */
(function(){
  const yWas = G.UI.capYear; G.UI.capYear = 'T'; // donuts follow the year tabs; pin the Total view
  const an = G.renderCapAnalytics();
  has(an, 'Committed, all years', 'VD: KPI strip renders (follows the year tabs; frame pins the Total view)');
  has(an, 'The Committed Calendar', 'VD: swimlanes card renders');
  has(an, 'Committed Costs by Project', 'VD: composition donut retitled (Paul, July 5)');
  has(an, 'all years combined', 'VD: donut center names the horizon plainly (offsets-era \u201cnet\u201d fossil retired)');
  ok(an.indexOf('whole horizon, net') < 0, 'VD: no stale center label');
  G.UI.capYear = yWas;
  has(an, 'Sustainment Load by Year', 'VD: sustainment-load card renders (plateau vocabulary retired \u2013 Paul, July 5)');
  const _vb=G.data.capital.aiBudget;G.data.capital.aiBudget='$10M';G.data.capStale=true;
  has(G.renderCapHub(), '&lt;1% of budget', 'VD: sub-1% sustainment reads <1%, never a false 0% (controlled roomy budget; Paul, July 5)');
  G.data.capital.aiBudget=_vb;G.data.capStale=true;
  ok(an.indexOf('>0% of budget') < 0, 'VD: no zero-percent label while money is committed');
  has(G.renderCapHub(), 'Quarter Runway', 'VD: quarter strip renders in the Hub\u2019s review-quarter section (dashboard tab)');
  ok(an.indexOf('Offset Pots') < 0 && an.indexOf('University Cooperation Fund') < 0, 'VD: no pot bars, no pot names (offsets retired July 4)');
  ok((an.match(/<svg/g) || []).length >= 4, 'VD: the dashboard is drawn, not described (got ' + (an.match(/<svg/g) || []).length + ' svgs)');
  // swimlanes carry the committed seed items and the new palette
  const sw = G.orgSwimlanes();
  has(sw, 'Quality Inspection Vision', 'VD: a committed lane is named');
  has(sw, '#45A188', 'VD: lanes wear the new palette');
  ok(sw.indexOf('#8B5E3C') < 0, 'VD: no brown in the lanes');
  // donut total equals the series total (relational – wall-clock safe)
  const srs = G.orgMonthly();
  const tot = Math.round(srs.reduce((a, r) => a + r.dev + r.roll + r.sus, 0));
  (function(){var yw=G.UI.capYear;G.UI.capYear='T';has(G.orgCompositionDonut(), G.fmtMoney(tot), 'VD: donut center equals the series total (Total view)');G.UI.capYear=yw})();
  // sandbox extras draw dashed hypothetical lanes
  has(G.orgSwimlanes([{ i: 0, anchor: 5 }]), 'stroke-dasharray="3,2"', 'VD: hypothetical lanes are dashed');
  ok(typeof G.reviewMixBar === 'undefined', 'VD: the decision-mix bar is retired whole (Paul, July 7 \u2013 not useful once decisions are underway)');
  // outcome page carries the charts
  const oc = G.renderOutCapplan();
  has(oc, 'The Committed Calendar', 'VD: Capital Snapshot outcome carries the swimlanes');
  G.saveData();
})();

/* ── 2.4 + BUDGETING TAB UI PASS (Paul, July 3) ──────────────── */
(function(){
  const s24 = G.renderStep24();
  has(s24, 'AVAILABLE PROJECTS', 'UI: project pills are headed');
  has(s24, 'Project Name: </span>', 'UI: card leads with the labeled name');
  has(s24, 'Choose what you want to work on:', 'UI: the tab pair is introduced');
  const bt = G.bpBudgetTab(1);
  has(bt, 'Lifetime cost', 'UI: statband labels per spec (spend\u2192cost \u2013 doctrine fix, copy pass July 6: the module never tracks spend)');
  has(bt, 'Development costs', 'UI: development labeled');
  has(bt, 'Rollout costs', 'UI: rollout labeled');
  has(bt, 'Annual sustainment costs', 'UI: sustainment labeled');
  has(bt, 'Monthly costs peak at Month ', 'UI: peak line in words (doctrine fix, July 6)');
  has(bt, 'First operational month occurs at Month ', 'UI: first-op line in words');
  ok(bt.indexOf('Mo ') < 0, 'UI: no Mo abbreviation anywhere on the tab');
  // seeded deepened example (Field Service Assistant, item 16) – full detail, no verdict, no rescore
  const p16 = G.data.projects[16] || {};
  ok(['objectives','deliverables','timeline','resources','risks','metrics','partInt','partExt'].every(k => String(p16[k] || '').length > 20), 'UI: item 16 detail boxes are all filled');
  ok(p16.gap && ['skillsH','skillsN','resourcesH','resourcesN','technologyH','technologyN'].every(k => String(p16.gap[k] || '').length > 10), 'UI: item 16 gap analysis filled');
  ok(p16.swot && ['strengths','weaknesses','opportunities','threats'].every(k => String(p16.swot[k] || '').length > 10), 'UI: item 16 SWOT filled');
  ok(G.bpHasAny(16) && G.bpLifetime(16) > 0, 'UI: item 16 carries a full budget plan');
  eq(G.bpFirstOpMonth(16), 12, 'UI: item 16 first operational month');
  ok(p16.viable === undefined && !p16.rescoreDone, 'UI: item 16 awaits its verdict – no Go/No Go, no rescore');
  // contingency: off the spend shape, onto the waterfall and cumulative (Paul ruling)
  const shp = G.bpChartShape(16);
  ok(shp.indexOf('rgba(245,242,236,.12)') < 0, 'UI: no per-bar band on the spend shape');
  const wf16 = G.bpChartWaterfall(16);
  has(wf16, 'with 10% contingency', 'UI: waterfall end column shows the ask figure');
  has(wf16, ' base<', 'UI: base lifetime labeled beneath it');
  has(wf16, '+10% contingency on ', 'UI: per-step contingency caps titled');
  const cum16 = G.bpChartCum(16);
  has(cum16, 'with 10% contingency', 'UI: cumulative carries the contingent figure');
  has(cum16, 'stroke-dasharray="4,3"', 'UI: contingent curve is dashed');
})();

/* ── ORG CONTINGENCY CURVE, TWO-TIER WARNINGS (Paul ruling) ─────── */
(function(){
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const set = G.orgCommittedSet();
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  const ct1 = G.data.budgetPlans[1].contingency;
  G.data.capital.periodStart = '2026-01-01';
  G.data.capital.aiBudget = '$800K'; G.data.capital.budgetY2 = '$800K'; G.data.capital.budgetY3 = '$800K';
  set.forEach(e => { if (e.i !== 1) { G.data.projects[e.i] = G.data.projects[e.i] || {}; G.data.projects[e.i].advancedAt = Date.parse('2020-01-01'); } });
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2020-02-01';
  const snapT0 = JSON.parse(JSON.stringify(G.data.tracking[0]||{}));
  G.data.tracking[0] = Object.assign({}, snapT0, {status:'killed'}); // its launch-based sustainment would rightly chart from month 1 otherwise
  G.data.budgetPlans[1].contingency = '60';
  // relational: the contingent series scales month 1 by the factor
  eq(Math.round(G.orgMonthly(null, true)[0].dev - G.orgMonthly()[0].dev), 24000, 'CT: month-1 contingent delta is 60% of the 40K step');
  const br = G.capBreaches();
  eq(br.overCapMonth, 0, 'CT: base commitments stay under capacity');
  eq(br.ctOverCapMonth, 11, 'CT: with a 60% contingency the cumulative curve crosses inside month 11 under ANNUAL STEP \u2013 1.6\u00d7 committed first exceeds the year-1 step (2.4M available from month 1) before year 2\u2019s step arrives at month 13; re-derived from month 3 under the retired pro-rata line (July 7)');
  const ctM = br.ctOverCapMonth;
  const cc = G.orgCumChart();
  has(cc, '#E8D48B', 'CT: the contingent curve is drawn in light yellow');
  has(cc, 'with contingencies \u2013 month ' + ctM, 'CT: light-yellow marker at the contingent crossing (render matches engine)');
  has(cc, 'stated contingency', 'CT: legend explains the pale curve');
  G.UI.capTab = 2;
  has(G.renderStepAlloc(), 'stated contingencies would cross it in Month ' + ctM, 'CT: funding plan carries the light-yellow warning');
  has(G.renderCapAnalytics(), 'would cross capacity in Month ' + ctM, 'CT: flags card carries it too');
  // amber tier untouched: shrink capacity so the base breaches
  G.data.capital.aiBudget = '$50K'; G.data.capital.budgetY2 = '$50K'; G.data.capital.budgetY3 = '$50K';
  ok(G.capBreaches().overCapMonth > 0, 'CT: base breach still ambers');
  // restore
  G.data.tracking[0] = snapT0;
  G.data.budgetPlans[1].contingency = ct1;
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.data.capStale = true;
  G.saveData();
})();

/* ── TABBED PROJECT CARD (Paul, July 4): RO tabs + edit swap ─────── */
(function(){
  G.UI.pcTab = {}; G.UI.pcEdit = {};
  const c0 = G.projCardRO(16);
  ['Overview', 'Analyses', 'Budget'].forEach(t => has(c0, t, 'PC: tab – ' + t));
  has(c0, 'pcEditToggle(16)', 'PC: Edit button present');
  has(c0, 'Lifetime cost', 'PC: overview leads with the stat band');
  has(c0, 'Pilot an on-site troubleshooting assistant', 'PC: overview carries the detail boxes');
  G.pcTabSet(16, 1);
  const c1 = G.projCardRO(16);
  has(c1, 'Gap Analysis', 'PC: analyses tab – gap analysis');
  has(c1, 'SWOT', 'PC: analyses tab – SWOT');
  has(c1, 'Rich ticket history', 'PC: SWOT strengths render');
  ok(c1.indexOf('Lifetime cost') < 0, 'PC: stat band stays on its own tabs');
  G.pcTabSet(16, 2);
  const c2 = G.projCardRO(16);
  has(c2, 'Project Budgeting', 'PC: budget tab renders the read-only budget');
  ok(c2.indexOf('bpRowSave') < 0, 'PC: budget tab is read-only – no editable rows');
  G.pcEditToggle(16);
  const ce = G.projCardRO(16);
  has(ce, 'PROJECT CARD – EDITING', 'PC: edit mode banner');
  has(ce, 'Done editing', 'PC: edit mode exit');
  has(ce, 'expl_16_obj', 'PC: edit mode is the full editable card');
  G.pcEditToggle(16);
  ok(G.projCardRO(16).indexOf('expl_16_obj') < 0, 'PC: Done returns to the read-only card');
  // edit mode carries exactly one tab bar (assessBlock's own – the wrapper's duplicate was cut)
  G.UI.pcEdit[16] = true;
  const ce2 = G.projCardRO(16);
  eq(ce2.split('Choose what you want to work on').length - 1, 1, 'PC: one tab bar in edit mode, not two');
  G.UI.pcEdit = {};
  // stat band on every Overview, matching the budget tab (Paul, July 4)
  has(G.projCardRO(3), 'Lifetime cost', 'PC: overview stat band renders even without a plan (dashes)');
  // seeded plans for the 3.1 trio, faithful to their simple estimates
  ok(G.bpHasAny(2) && G.bpHasAny(14) && G.bpHasAny(15), 'PC: Sales Knowledge Graph, Churn Model, Route Optimizer carry seeded plans');
  eq(G.devCost(2), 250000, 'PC: SKG plan development matches the $250K estimate it supersedes');
  eq(G.bpSusSteady(14), 55000, 'PC: Churn sustainment matches the $55K/yr estimate');
  ok(G.bpLifetime(15) > 0 && !G.bpHasRoll(15), 'PC: Route Optimizer plan – no rollout section, faithful to its estimates');
  G.UI.pcTab = {}; G.UI.pcEdit = {};
})();

/* ── EXPLORATION PORTFOLIO RESTRUCTURE (Paul, July 4) ───────────── */
(function(){
  G.UI.pcTab = {}; G.UI.pcEdit = {};
  const pg = G.renderOutExploreEnhanced();
  // seed spread: 2 graded; 14/15 Go-ungraded; 16/17 unresolved; 3 is No-Go (Not Advancing)
  has(pg, 'Structured Portfolio (1)', 'OX: the Structured Portfolio counts the graded set only');
  has(pg, 'Not Yet Positioned (2)', 'OX: Go-but-not-yet-positioned sit in their own section (vocabulary: position, July 10)');
  has(pg, 'Incomplete (2)', 'OX: unresolved sit under Incomplete');
  ok(pg.indexOf('Awaiting verdict') < 0, 'OX: the awaiting-verdict badge is gone');
  ok(pg.indexOf('In Exploration (') < 0, 'OX: the old flat header is gone');
  ok(pg.indexOf('Stage Gates') < 0 && pg.indexOf('gateTable') < 0, 'OX: no stage gates on this page (parked for the Development rework)');
  has(pg, 'Graded projects only', 'OX: balance panel plots the actual portfolio');
  ok(pg.indexOf('provisional') < 0, 'OX: the provisional layer is gone');
  has(pg, '2 awaiting portfolio grading', 'OX: balance queue counts the ungraded');
  // open a graded card: read-only tabbed card with Edit; grading section reworded
  G.UI.expanded['ox2'] = true;
  const pg2 = G.renderOutExploreEnhanced();
  has(pg2, 'Portfolio assessment complete', 'OX: graded badge reworded (July 4, second pass)');
  has(pg2, 'pcEditToggle(2)', 'OX: verdict-holders get the read-only card with Edit');
  has(pg2, 'Portfolio Position</h4>', 'OX: positioning section reworded (vocabulary: position, July 10)');
  G.UI.expanded['ox2'] = false;
  // open an incomplete card: still the editable page
  G.UI.expanded['ox17'] = true;
  has(G.renderOutExploreEnhanced(), 'expl_17_obj', 'OX: incomplete items default to the editable card');
  G.UI.expanded['ox17'] = false;
  // 3.1: balance panel there is also actual-only; notes slimmed
  const s31 = G.renderStep31();
  has(s31, 'Graded projects only', 'OX: 3.1 balance panel matches');
  has(s31, 'rows="1"', 'OX: 3.1 notes box slimmed');
  ok(s31.indexOf('form-label">Notes') < 0, 'OX: 3.1 notes label is no longer the bright form label');
})();

/* ── GAP ANALYSIS: NEED / HAVE / GAP items (Paul, July 4) ────────── */
(function(){
  // migration from legacy free text: semicolon-split, H items arrive covered
  const gi = G.gapItemsOf(16);
  eq(gi.skills.length, 3, 'GA: item 16 skills migrate to 3 items (2 have + 1 need)');
  eq(gi.skills.filter(x => x.have).length, 2, 'GA: legacy Have items arrive covered');
  eq(gi.skills.filter(x => !x.have).length, 1, 'GA: the gap is need minus have');
  ok(!((G.data.projects[16] || {}).gapItems), 'GA: pure read – migration does not write');
  // lifecycle on a clean project
  G.gapAdd(17, 'skills', 'GPU capacity');
  const g17 = G.data.projects[17].gapItems;
  eq(g17.skills.length, 1, 'GA: add lands in Need');
  ok(!g17.skills[0].have, 'GA: new needs start uncovered');
  G.gapHave(17, 'skills', g17.skills[0].id);
  ok(g17.skills[0].have, 'GA: marking covered moves it to Have');
  G.gapUnHave(17, 'skills', g17.skills[0].id);
  ok(!g17.skills[0].have, 'GA: unmarking returns it to the gap');
  G.gapDel(17, 'skills', g17.skills[0].id);
  eq(g17.skills.length, 0, 'GA: delete removes the need entirely');
  delete G.data.projects[17].gapItems; G.saveData();
  // editable card: three tabs, item editor on Analyses
  G.UI.cardTab = G.UI.cardTab || {}; G.UI.cardTab['bta16'] = 3;
  const ae = G.assessBlock(16);
  has(ae, 'Analyses', 'GA: editable card has the Analyses tab');
  has(ae, 'gapAdd(16', 'GA: needs are added as items');
  has(ae, 'Mark a need as covered', 'GA: Have is selected from the needs, not typed');
  has(ae, 'GAP – need minus have', 'GA: derived gap column');
  has(ae, 'SWOT Analysis', 'GA: SWOT lives on the Analyses tab');
  G.UI.cardTab['bta16'] = 1;
  ok(G.assessBlock(16).indexOf('gapAdd(') < 0, 'GA: details tab no longer carries the analyses');
  // read-only card: gap table + quadrant graphic
  G.UI.pcTab = {16: 1};
  const ro = G.projCardRO(16);
  ['NEED', 'HAVE', 'GAP'].forEach(c => has(ro, c, 'GA: RO gap column – ' + c));
  has(ro, '+ STRENGTHS', 'GA: SWOT quadrant labels');
  ok(ro.indexOf('HELPFUL') < 0 && ro.indexOf('INTERNAL (top)') < 0, 'GA: quadrant axis labels retired (Paul ruling, July 4)');
  G.UI.pcTab = {};
  // Aurora example fold mirrors the new card (July 4 overhaul)
  G.UI.showEx = G.UI.showEx || {}; G.UI.showEx.aurora24 = true;
  const ax = G.aurora24Example();
  ['Project Details', 'Gap Analysis', 'NEED', 'HAVE', 'GAP', '+ STRENGTHS'].forEach(t => has(ax, t, 'GA: example fold – ' + t));
  ok(ax.indexOf('<em>Have:</em>') < 0, 'GA: legacy have/need prose form is gone from the example');
  ok(ax.indexOf('HELPFUL') < 0, 'GA: example quadrant carries no axis labels either');
  G.UI.showEx.aurora24 = false;
})();

/* ── PER-YEAR SUSTAINMENT CAP OVERRIDES (Paul ratified, July 4) ───── */
(function(){
  eq(G.susCapOf(2), 40, 'SC: a blank override inherits the single cap');
  G.data.capital.susCapY2 = '60';
  eq(G.susCapOf(2), 60, 'SC: a year override wins for its year');
  eq(G.susCapOf(1), 40, 'SC: other years still inherit');
  G.data.capStale = true;
  const yt = G.orgYearTotals();
  eq(yt[1].scpY, 60, 'SC: the year ledger carries the year cap');
  eq(yt[0].scpY, 40, 'SC: year 1 unchanged');
  const pic = G.capacityPicture();
  has(pic, 'Sustainment cap – per year', 'SC: legend switches when caps vary');
  has(pic, 'Sustainment cap 60%', 'SC: the year-2 line titles its own figure');
  const t1sc = G.renderStepCap();
  has(t1sc, 'cap_susCapY2', 'SC: override boxes render on the cap card');
  has(t1sc, 'PER-YEAR OVERRIDES', 'SC: override row labeled');
  delete G.data.capital.susCapY2; G.saveData(); G.data.capStale = true;
  has(G.capacityPicture(), 'Sustainment cap 40%', 'SC: uniform legend returns when the override clears');
})();

/* ── SANDBOX BASELINE + ASSUMED START DATES (Paul, July 4) ──────── */
(function(){
  G.UI.capTab = 1; G.UI.capSim = {};
  const sb0 = G.renderStepAlloc();
  has(sb0, 'The standing baseline', 'BL: charts draw with nothing ticked');
  has(sb0, 'tick candidates above to stage the batch on top', 'BL: baseline explains itself');
  ok(sb0.indexOf('Tick candidates above to draw the batch.') < 0, 'BL: the empty placeholder is gone');
  // a ticked candidate with a start date charts at it; the copy says so
  G.UI.capSim = {2: true};
  G.data.projects[2].startDate = '2027-01-15';
  const sb1 = G.renderStepAlloc();
  has(sb1, 'Unless otherwise specified', 'BL: the one assumed-start sentence covers dated and undated alike');
  has(sb1, 'capStartSave(2', 'BL: date input on the sandbox line');
  // each ticked candidate is an itemized segment with its own legend swatch (July 4)
  has(sb1, 'this month (batch)', 'BL: candidate segments carry itemized tooltips');
  has(sb1, 'Batch: ', 'BL: batch legend maps colors to names');
  has(sb1, 'Sales Knowledge Graph', 'BL: the candidate is named in the legend');
  delete G.data.projects[2].startDate; G.saveData();
  G.UI.capSim = {}; G.UI.capTab = 1;
  // exploration portfolio: Allocate Capital tab embeds the 3.3 core without the step apparatus
  G.UI.oxTab = 2;
  const oxa = G.renderOutExploreEnhanced();
  has(oxa, 'Sandbox', 'OXA: sandbox reachable from the portfolio');
  has(oxa, 'Commit & Advance', 'OXA: commit tab reachable from the portfolio');
  has(oxa, 'The standing baseline', 'OXA: baseline charts render there too');
  ok(oxa.indexOf('saveDoneAlloc') < 0, 'OXA: no step done-button on the portfolio surface');
  ok(oxa.indexOf('V-3.3.1') < 0, 'OXA: no step video on the portfolio surface');
  G.UI.oxTab = 1;
  has(G.renderOutExploreEnhanced(), 'Structured Portfolio (', 'OXA: tab 1 is the structured portfolio');
})();

/* ── SEED PLANS FOR COMMITTED ITEMS (Paul's go, July 5) ─────── */
(function(){
  // New plans for 0/11/12 supersede their simple estimates with IDENTICAL category totals,
  // so the committed ledger holds. Hand checks: 0 dev 110+60=170; 11 dev 85+120=205; 12 dev 80.
  eq(G.devCost(0), 170000, 'SD: Triage plan dev total equals the superseded estimate');
  eq(G.opsRolloutCost(0), 50000, 'SD: Triage rollout total held');
  eq(G.bpSusOpYear(0, 1), 60000, 'SD: Triage sustainment rate held (35+25) \u2013 full rate from rollout\u2019s end');
  eq(G.devCost(11), 205000, 'SD: Procurement plan dev total equals the superseded estimate');
  eq(G.opsRolloutCost(11), 55000, 'SD: Procurement rollout total held');
  eq(G.bpSusOpYear(11, 1), 70000, 'SD: Procurement sustainment rate held (40+30) \u2013 full rate from rollout\u2019s end');
  eq(G.devCost(12), 80000, 'SD: Invoice plan dev total equals the superseded estimate');
  eq(G.opsRolloutCost(12), 10000, 'SD: Invoice rollout total held');
  eq(G.bpSusOpYear(12, 1), 25000, 'SD: Invoice sustainment rate held \u2013 full rate from rollout\u2019s end');
  // Doctrine conformance: every committed plan starts sustainment the month rollout ends (continuity ruled July 5)
  [0,1,4,11,12,13].forEach(i => eq(G.bpSusStartOpYear(i), 1, 'SD: item ' + i + ' sustainment continuous from rollout\u2019s end'));
  eq(G.capCommitments().total, 3246249, 'SD: the committed ledger is unmoved by the reshape (single-model constant)');
  // a plan may leave a gap between rollout and sustainment; it draws as a labeled, neutral bridge (continuity ruled July 5)
  const _g0 = G.data.budgetPlans[0].sus[0].from; G.data.budgetPlans[0].sus[0].from = '29'; G.saveData();
  const sw = G.orgSwimlanes();
  has(sw, 'nothing charted between the end of rollout and the start of sustainment', 'SD: a user-authored gap draws the bridge on the lanes');
  has(sw, 'thin bar = a gap the plan leaves', 'SD: bridge named in the legend');
  G.data.budgetPlans[0].sus[0].from = _g0; G.saveData();
  eq(G.bpSusStartOpYear(0), 1, 'SD: seed restored to continuity after the gap probe');
})();

/* ── BUDGET ENVELOPE (chunk 2) ──────────────────────────────── */
(function(){
  eq(G.envYearsOf(), 3, 'ENV: seed horizon is 3 years');
  eq(G.envBudgetYear(1), G.costNum(G.data.capital.aiBudget), 'ENV: year 1 is the live annual budget');
  eq(G.envBudgetYear(2), 2600000, 'ENV: seed year 2');
  eq(G.envBudgetYear(3), 2800000, 'ENV: seed year 3');
  // saves ride the cap singleton path and re-render on blur
  const realRender = G.render; let calls = 0; G.render = function(){ calls++; };
  const prev = G.data.capital.budgetY2;
  G.fldSave('cap_budgetY2', '$4M');
  eq(G.data.capital.budgetY2, '$4M', 'ENV: year box saves');
  ok(calls >= 1, 'ENV: blur on a year box re-renders the strip');
  calls = 0; G.fldSave('cap_budgetY2', '$4.1M', true);
  eq(calls, 0, 'ENV: live keystrokes do not re-render');
  G.data.capital.budgetY2 = prev; G.render = realRender; G.saveData();
  // strip renders on both surfaces; horizon selector honored
  const t1 = G.renderStepCap();
  has(t1, 'Year 1 budget', 'ENV: year fields on Plan Capacity, year 1 first');
  has(t1, 'cap_budgetY2', 'ENV: year-2 box on tab 1');
  ok(t1.indexOf('costEcho_bY3') < 0, 'ENV: year echoes retired');
  ok(t1.indexOf('cap_budgetY4') < 0, 'ENV: 3-year horizon hides year 4');
  G.UI.hubTab = 2; // envelope lives on the Plan & Funding tab (hub tabs, July 5)
  const hub = G.renderCapHub();
  has(hub, 'Year 1 budget', 'ENV: year fields on the Hub (single source, no duplicate annual box)');
  G.UI.hubTab = 0;
  const prevN = G.data.capital.envYears;
  G.data.capital.envYears = '5';
  const t5 = G.renderStepCap();
  has(t5, 'cap_budgetY5', 'ENV: 5-year horizon shows year 5');
  G.data.capital.envYears = prevN; G.saveData();
})();

/* ── MULTI-YEAR PROJECTION (chunk 3) ────────────────────────── */
// Per-year accessors: profile placement where profiled, simple shape otherwise
(function(){
  eq(G.prjDevYear(13,1), 200000, 'PRJ: planned dev lands per its month placement');
  eq(G.prjDevYear(13,2), 0, 'PRJ: no dev money in later years');
  eq(G.prjRollYear(13,2), 190000, 'PRJ: planned rollout spreads through its covered period (the 4-month wave, months 13\u201316, sits wholly in year 2 \u2013 reshaped July 7)');
  eq(G.prjSusYear(13,2), 93333, 'PRJ: sustainment prorates in its start year (months 17\u201324 = 8 of 12 at 140K \u2013 reshaped July 7)');
  eq(G.prjSusYear(13,3), 140000, 'PRJ: steady state from project year 3');
  eq(G.prjDevYear(11,1), 205000, 'PRJ: simple dev lands in year 1');
  eq(G.prjRollYear(11,1), 31429, 'PRJ: planned rollout year-1 slice (8 of 14 months of $55K \u2013 plan added July 5)');
  eq(G.prjDevYear(11,2), 0, 'PRJ: simple dev is one-off');
  eq(G.prjSusYear(11,1), 0, 'PRJ: no sustainment in year 1');
  eq(G.prjSusYear(11,4), 70000, 'PRJ: simple sustainment holds steady state');
})();
// Calendar per-year totals under controlled anchors (supersedes the retired capProjection)
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const set = G.orgCommittedSet();
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  G.data.capital.periodStart = '2026-01-01';
  G.data.projects[11].advancedAt = Date.parse('2025-01-01'); // parked out of the window
  G.data.projects[12].advancedAt = Date.parse('2026-06-01');
  G.data.projects[13].advancedAt = Date.parse('2026-03-01');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.projects[4].advancedAt = Date.parse('2026-01-01');
  G.data.projects[0].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2026-02-01';
  const yt = G.orgYearTotals();
  eq(yt.length, 3, 'PRJ: one reading per envelope year');
  const near = (x, y, tol, label) => ok(Math.abs(x - y) <= (tol || 1), label + ' (got ' + x + ')');
  near(yt[0].dev, 1180000, 1, 'PRJ: year-1 development on the calendar (580 + 150 + 200 + 170 lump + 80 lump, gross \u2013 offsets retired July 4; a dev-stage item\u2019s undated rollout does not chart)');
  near(yt[0].roll, 315000, 1, 'PRJ: year-1 rollout on the calendar (180,000 + 45,000 + 40,000 + 50,000 \u2013 item 4\u2019s wave now 2 of 4 months in year 1; reshaped July 7)');
  eq(yt[0].sus, 0, 'PRJ: year-1 sustainment is zero by construction');
  near(yt[0].total, 1495000, 2, 'PRJ: year-1 total (gross; 1,180,000 dev + 315,000 roll)');
  eq(yt[0].budget, 2400000, 'PRJ: year-1 capacity from the envelope');
  near(yt[0].headroom, 905000, 2, 'PRJ: year-1 headroom (gross; 2,400,000 \u2212 1,495,000)');
  ok(yt[0].budgetSet && yt[1].budgetSet && yt[2].budgetSet, 'PRJ: envelope years flagged as set');
  ok(yt[2].sus > 0 && yt[2].dev === 0, 'PRJ: year 3 carries no development');
  eq(yt[2].roll, 0, 'PRJ: no year-3 rollout \u2013 continuity now comes from early sustainment, not stretched tails (reshaped July 7)');
  eq(yt[2].susShare, 1, 'PRJ: year 3 is pure sustainment under these anchors (490,000 of 490,000: 180K + 110K + 140K full years + item 0\u2019s simple 60K \u2013 reshaped July 7)');
  yt.forEach(r => eq(r.headroom, r.budget - r.total, 'PRJ: headroom = capacity \u2212 total (year ' + r.y + ')'));
  // killed items leave the calendar
  if(!G.data.tracking) G.data.tracking = {};
  const snapT = JSON.parse(JSON.stringify(G.data.tracking[12]||{}));
  G.data.tracking[12] = Object.assign({}, snapT, {status:'killed'});
  near(G.orgYearTotals()[0].total, 1415000, 2, 'PRJ: killing item 12 removes its month-6 lump (gross base; 1,495,000 \u2212 80,000)');
  G.data.tracking[12] = snapT;
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.saveData();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── CAPITAL ANALYTICS (chunk 4) ────────────────────────────── */
(function(){
  ok(typeof G.phaseStrip === 'undefined', 'AN: phaseStrip retired with the Phase Timelines card (chunk N)');
  // the analytics surface
  const an = G.renderCapAnalytics();
  has(an, 'Capacity Waterfall', 'AN: the waterfall card renders');
  has(an, 'Cumulative vs Capacity', 'AN: the cumulative card renders');
  has(an, 'Overviews by Year', 'AN: the year overviews render (retitled \u2013 Paul, July 5)');
  has(an, 'HEADROOM', 'AN: headroom column in the year readings table');
  has(an, 'Committed = Development', 'AN: the sub-line names itself as the committed split (July 4)');
  has(an, 'of the year\u2019s budget \u2013 cap', 'AN: crowding-out reads sustainment against the year budget, per the cap');
  has(an, 'NET OF RESERVE', 'AN: year readings carry labeled columns (July 4 redesign)');
  // 4.4 review card: flat-slice headroom replaced by the running annual position (Paul ratified, July 4)
  const r44 = G.renderStep44();
  ok(r44.indexOf('Budget slice') < 0, 'AN: the flat quarterly slice is gone from the review card');
  has(r44, 'Committed consumption, this period', 'AN: the period consumption figure stays');
  has(r44, 'Committed, Year 1', 'AN: running annual position \u2013 committed of budget');
  has(r44, 'Headroom, Year 1', 'AN: running annual position \u2013 year headroom');
  has(an, 'available budget that can still be assigned', 'AN: headroom glossed via the asterisk footnote (Paul wording, July 5)');
  ok(an.indexOf('divided evenly across twelve months') < 0, 'AN: the flat monthly capacity line is retired from the waterfall (Paul ruling, July 5)');
  has(an, 'run-cost ceiling for the year, at its monthly rate', 'AN: the dashed cap line survives with its rate-vs-rate gloss');
  ok(an.indexOf('Multi-Year Projection vs Envelope') < 0, 'AN: the projection card is retired');
  const hub = G.renderCapHub();
  has(hub, 'Capacity Waterfall', 'AN: the calendar charts live on the Hub');
  // the old timing block is gone from the cards
  G.UI.expanded['oe13'] = true;
  const dev = G.renderOutExpbriefsFull();
  ok(dev.indexOf('PHASE TIMING') < 0, 'AN: the separate timing block is gone');
  G.UI.expanded['oe13'] = false;
})();

/* ── COPY PASS (chunk 5) ────────────────────────────────────── */
(function(){
  const c = G.CAROUSEL_CONTENT['3.3'][1].bullets;
  has(c[0].text, 'development, rollout, and sustainment costs', 'COPY: the Sandbox bullet speaks the three fields');
  has(c[1].text, 'assumed start date', 'COPY: the commit bullet states the anchor');
  has(G.CAROUSEL_CONTENT['3.2'][1].body, 'one-to-five-year horizon', 'COPY: the envelope teaching lives on the capacity carousel (copy pass July 9)');
  G.UI.expanded['fyhelp32'] = true;
  const t1 = G.renderStepCap();
  ok(t1.indexOf('Dates and Fiscal Calculations') < 0, 'COPY: the alloc fold is gone whole \u2013 its surviving truths move to the Help tab (TODOS)');
  ok(true, 'COPY: start-year nuance moved out with the fold; the doctrine line lives in the engine comment and the Help-tab TODO');
  G.UI.capTab = 2;
  const tAl = G.renderStepAlloc();
  ok(tAl.indexOf('commits its entire planned spend') < 0, 'COPY: the note stays behind the folds until opened');
  G.UI.expanded['acRef'] = true; G.UI.expanded['csNotes'] = true;
  const nf = G.renderStepAlloc();
  has(nf, 'commits its entire planned spend from the moment it is advanced', 'COPY: the Notes fold states the single-model doctrine (Paul\u2019s wording, July 6)');
  has(nf, 'releases funds for phases that have not yet begun back to the budget', 'COPY: the kill sentence keeps committed/released vocabulary consistent (Paul, July 6)');
  G.UI.expanded['csNotes'] = false; G.UI.expanded['acRef'] = false;
  G.UI.expanded['fyhelp32'] = false;
  G.UI.expanded['oo4'] = true;
  const ops = G.renderOutOperFull();
  ok(G.renderOutOperFull().indexOf('Both feed Committed Sums') < 0, 'COPY: the feed-Committed-Sums sentence and its red box are gone from the ops card (Paul, July 7); the timing nuance lives in the derived echoes and 3.3');
  G.UI.expanded['oo4'] = false;
})();

/* ── CONSISTENCY FIXES (post-chunk sweep) ───────────────────── */
(function(){
  // archived list shows the committed figure, not the raw estimate
  if(!G.data.archivedItems) G.data.archivedItems = {};
  const snap = JSON.parse(JSON.stringify(G.data.archivedItems));
  G.data.archivedItems[11] = {stage:'Development'};
  G.UI.hubTab = 1; // archived list lives on the Commitments tab (hub tabs, July 5)
  const hub = G.renderCapHub();
  has(hub, 'Archived \u2013 costs no longer committed', 'FIX: archived card renders');
  has(hub, '$205K', 'FIX: archived figure is the committed Development Costs');
  G.UI.hubTab = 0;
  G.data.archivedItems = snap; G.saveData();
})();

/* ── HUB TABS (Paul ruling, July 5): dashboard / commitments / plan & funding ── */
(function(){
  G.UI.hubTab = 0;
  const d = G.renderCapHub();
  ['Dashboard','Commitments','Plan & Funding'].forEach(t => has(d, t, 'HT: tab strip offers ' + t));
  has(d, 'The Quarterly Review', 'HT: quarterly-review section sits on the dashboard tab (retitled July 5)');
  has(d, 'a way of reading the plan, not budgets', 'HT: plain-language framing \u2013 quarters read the plan, never cap it (July 5)');
  has(d, 'one quarter of the annual budget is', 'HT: even-spread comparison in plain language (July 5)');
  ok(d.indexOf('Quarterly budget slice') < 0, 'HT: the old slice label is gone from the Hub');
  has(d, 'Capacity Waterfall', 'HT: the chart suite leads the dashboard tab');
  ok(d.indexOf('Committed Sums') < 0 && d.indexOf('Funding Plan') < 0, 'HT: ledger and funding live off the dashboard tab');
  ok(G.renderCapAnalytics().indexOf('Quarter Runway') < 0, 'HT: the runway left the analytics suite for the ghetto');
  G.UI.hubTab = 2;
  const pf = G.renderCapHub();
  has(pf, 'Budget Envelope', 'HT: envelope card on Plan & Funding');
  has(pf, 'Single source with Step 3.2', 'HT: envelope names its single source');
  has(pf, 'Funding Plan', 'HT: funding plan card on Plan & Funding (line items \u2013 Paul, July 5)');
  G.UI.hubTab = 0;
  G.UI.expanded['acRef'] = true; // the fiscal-context cell lives behind the reference fold (allocCore)
  const al = G.renderStepAlloc();
  ok(G.renderStepAlloc().indexOf('Level pace: ') < 0, 'HT: the level-pace line retired with the duplicate reference card (July 6)');
  ok(al.indexOf('Quarterly budget slice') < 0, 'HT: old label gone from Allocate Capital too');
  G.UI.expanded['acRef'] = false;
})();


/* ── PG: development-program kill calculus (P1, July 5) ──────
   Doctrine (Paul ruling): money enters a phase at its start month
   (or when marked running/complete or its gate is taken) and does
   not come back; a kill releases every phase not yet entered;
   entered phases stay committed and charted, frozen at kill time
   (killSunkIds). Plan-less kills still release everything.
   Controlled clock: periodStart 2026-01-01, item 13 advanced
   2026-06-01 -> anchor 6; run date July 2026 -> program month 7 ->
   plan month 2. bp13a (m1-3, $50K) entered; bp13b (m3-9, $150K) not.
   Hand-derived ledger: 1,975,000 - 200,000 (item 13 dev commit)
   + 50,000 (entered phase held) = 1,825,000. */
{
  const snapTrk = JSON.stringify(G.data.tracking[13] || {});
  const snapPrj = JSON.stringify(G.data.projects[13] || {});
  const snapPS = G.data.capital.periodStart;
  const snapKR = G.data.capital.killRows;
  const snapStale = G.data.capStale;
  G.data.capital.periodStart = '2026-01-01';
  G.data.projects[13].advancedAt = Date.parse('2026-06-01');
  delete G.data.projects[13].startDate;

  const baseP = G.capCommitments().total;
  const w13 = G.capProjectWindow(13, null).inW;
  const prev = G.killReleasePreview(13);
  eq(prev.sunk, 0, 'PG: STATUS BASIS (Paul, July 7) \u2013 no phase marked begun, nothing held; the plan clock no longer enters phases');
  eq(prev.released, w13, 'PG: with nothing begun, the whole in-window plan comes back \u2013 development, rollout, and sustainment');
  ok(prev.phases.length === 2 && prev.phases[0].entered === false && prev.phases[1].entered === false, 'PG: entered flags are false until work is marked begun');

  const rows13 = G.bpRows(13, 'dev');
  rows13[1].pstatus = 'running';
  eq(G.killReleasePreview(13).sunk, 150000, 'PG: a running mark alone enters a phase (bp13b, $150K)');
  delete rows13[1].pstatus;

  rows13[0].pstatus = 'running'; // bp13a begun in fact \u2013 the freeze chain below holds it
  G.fldSave('trk_13_status', 'killed', true);
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'PG: kill freezes the entered set at kill time');
  eq(G.killSunkDev(13), 50000, 'PG: sunk development derives from the frozen ids');
  const com = G.capCommitments();
  eq(com.total, baseP - w13 + 50000, 'PG: ledger = base \u2212 full in-window plan + entered phase held (relative, single model)');
  const row13 = com.rows.filter(r => r.i === 13)[0];
  ok(!!row13 && /entered phases held/.test(row13.label || ''), 'PG: ledger row names the held phases');
  ok(G.orgCommittedSet().some(e => e.i === 13 && e.sunk === true), 'PG: committed set carries the sunk marker');
  const ser = G.orgProjectMonthly(13, false, 36, 1, true);
  let sd13 = 0, srs = 0;
  for (let m = 0; m < 36; m++) { sd13 += ser[m].dev; srs += ser[m].roll + ser[m].sus; }
  eq(Math.round(sd13), 50000, 'PG: sunk series charts only the entered phase');
  eq(srs, 0, 'PG: sunk series carries no rollout or sustainment');

  const kp0 = G.costNum(G.data.capital.killCosts);
  G.data.capital.killRows = [{ d: 'Contractor exit - Visual QC', a: '$25K' }];
  eq(G.killPotTotal(), kp0 + 25000, 'PG: pot = legacy figure + line items');
  eq(G.capAvailable().killPot, kp0 + 25000, 'PG: capAvailable deducts the line-item pot');

  G.fldSave('trk_13_status', '', true);
  ok(!G.data.tracking[13].killSunkIds, 'PG: un-killing via status clears the frozen set');
  eq(G.capCommitments().total, baseP, 'PG: ledger restores to the pre-kill base');

  G.fldSave('trk_13_status', 'killed', true);
  const rr = G.render; G.render = function () {};
  try { G.reviveProject(13); } finally { G.render = rr; }
  ok(!G.data.tracking[13].killSunkIds && G.data.tracking[13].status === '', 'PG: reviveProject clears status and the frozen set');

  delete G.bpRows(13, 'dev')[0].pstatus;
  G.data.tracking[13] = JSON.parse(snapTrk);
  G.data.projects[13] = JSON.parse(snapPrj);
  G.data.capital.periodStart = snapPS;
  if (snapKR === undefined) delete G.data.capital.killRows; else G.data.capital.killRows = snapKR;
  G.data.capStale = snapStale;
  G.saveData();
}


/* ── S34: Define Development Program (P2, July 5) ───────────
   One list, two lenses: phases ARE the plan's dev rows; this page
   adds the contract (owner/metric/exit criteria via bpRowSave).
   Done-bar: every advanced project contracted = every dev row
   funded + all three contract fields. Unfunded template rows
   deliberately block done and don't flip the simple estimate. */
(function(){
  const snapStale = G.data.capStale;
  const r13 = G.bpRows(13, 'dev');
  const st13 = r13.map(function(r){ return { po: r.powner, pm: r.pmetric, px: r.pexit }; });
  r13.forEach(function(r){ delete r.powner; delete r.pmetric; delete r.pexit; });
  const pg = G.renderStepExp();
  has(pg, 'Step 4: Map Development Track', 'S34: step retitled');
  has(pg, 'Project Development Program', 'S34: program header white and renamed (Paul, July 6)');
  has(pg, 'Delete phase', 'S34: labeled delete control on each phase card (Paul, July 6)');
  ok(typeof G.pgDelPhase==='function', 'S34: phase delete goes through the confirm guard');
  has(pg, 'bps_13_dev_bp13a_name', 'S34: phase money rows reuse the plan-editor ids');
  has(pg, 'pgf_13__bp13a__powner', 'S34: contract fields carry pgf ids');
  has(pg, 'Exit gate criteria', 'S34: exit criteria labeled as the gate (Paul, July 6)');
  has(pg, 'calculated from these phases', 'S34: committed-sum advisory \u2013 accurate live-recalculation wording (July 7)');
  has(pg, 'review headroom at Allocate Capital (Step 3.3)', 'S34: the advisory still points at headroom');
  ok(pg.indexOf('gates release') < 0 && pg.indexOf('STAGE GATES') < 0, 'S34: gate-release tranches retired from 3.4 (absorbed by phase contracts)');
  ok(pg.indexOf('ic33') < 0 && pg.indexOf('pc33') < 0, 'S34: fossil keys retired with the rebuild');
  has(pg, 'Development Track Set \u2014 Ready for Phase 4', 'S34: done bar uses the track vocabulary (Paul, July 7)');
  has(pg, 'phases defined', 'S34: mid-state badge shows once phases exist but gates are unfilled (Paul, July 6)');
  ok(!G.progContracted(13), 'S34: funded phases alone are not a contract');
  r13.forEach(function(r){ r.powner = 'Maya Chen'; r.pmetric = 'Defect catch-rate \u2265 95%'; r.pexit = 'Four clean weeks on line A'; });
  ok(G.progContracted(13), 'S34: budget + owner + metric + exit criteria = contracted');
  has(G.renderStepExp(), '>gates defined<', 'S34: card badge reads gates defined when every phase contract is complete (Paul, July 6)');
  r13.forEach(function(r, x){ if (st13[x].po === undefined) delete r.powner; else r.powner = st13[x].po;
    if (st13[x].pm === undefined) delete r.pmetric; else r.pmetric = st13[x].pm;
    if (st13[x].px === undefined) delete r.pexit; else r.pexit = st13[x].px; });
  // template path on a stashed plan: creation seeds phases without money
  const p11 = G.data.budgetPlans[11]; delete G.data.budgetPlans[11];
  G.addProgDefault(11);
  eq(G.bpRows(11, 'dev').length, 2, 'S34: two-phase default seeds two phases');
  eq(G.bpRows(11, 'dev')[0].name, 'Design & build experiment', 'S34: default keeps the module\u2019s experiment path');
  ok(!G.bpHasDev(11), 'S34: unfunded template phases do not outrank the simple estimate');
  G.addProgPhase(11, 3);
  eq(G.bpRows(11, 'dev')[2].name, 'Pilot', 'S34: template names the added phase');
  ok(!G.progContracted(11), 'S34: unfunded phases block the contract');
  if (p11 === undefined) delete G.data.budgetPlans[11]; else G.data.budgetPlans[11] = p11;
  G.data.capStale = snapStale;
  G.saveData();
})();

/* ── PD: program dashboard on the Development portfolio (P3) ─
   Controlled clock as in PG. Seam advisory in the formal register
   (Paul ruling, July 5); kill intercepted by the inline confirm
   panel; gates are decision records; the terminal gate's Go is the
   launch decision (opens the existing launch confirm). */
(function(){
  const snapTrk = JSON.stringify(G.data.tracking[13] || {});
  const snapPrj = JSON.stringify(G.data.projects[13] || {});
  const snapPS = G.data.capital.periodStart;
  const snapKR = G.data.capital.killRows;
  const snapStale = G.data.capStale;
  const snapLaunched = (G.data.launched || []).length;
  G.data.capital.periodStart = '2026-01-01';

  // seam advisory: plan month 4, phase 2 open, phase 1 gate untaken
  G.data.projects[13].advancedAt = Date.parse('2026-04-01');
  delete G.data.projects[13].startDate;
  G.UI.expanded['oe13'] = true;
  G.bpRows(13,'dev').forEach(function(r){ if(r) G.UI.expanded['phx_13_'+r.id] = true; }); // phase bars collapse by default since July 6
  let rd = G.renderOutExpbriefsFull();
  has(rd, 'Development Phases', 'PD: phase dashboard section renders on the card (Paul, July 6)');
  has(rd, 'Camera trials', 'PD: phases come from the plan rows (name is HTML-escaped, so pin the unambiguous prefix)');
  has(rd, 'EXIT GATE DECISION', 'PD: undecided phase shows the open gate panel (default-open \u2013 Paul, July 6)');
  has(rd, '0/2 phases', 'PD: collapsed strip counts progress');
  has(rd, 'devStatusSave(13', 'PD: status select routes through the kill intercept');
  has(rd, 'overlap is intentional', 'PD: seam advisory in plain English (Paul, July 6)');
  ok(rd.indexOf('gates release') < 0 && rd.indexOf('CAPITAL & GATES') < 0, 'PD: gate-release tranches retired from the card');

  // kill intercept + confirm panel figures: plan month 2 (bp13a entered only)
  G.data.projects[13].advancedAt = Date.parse('2026-06-01');
  G.bpRows(13, 'dev')[0].pstatus = 'running'; // status basis: held requires a begun phase (July 7)
  G.devStatusSave(13, { value: 'killed' });
  ok(G.UI.expanded['kp13'] === true && (G.data.tracking[13] || {}).status !== 'killed', 'PD: choosing Killed opens the panel without killing');
  rd = G.renderOutExpbriefsFull();
  has(rd, 'CONFIRM KILL', 'PD: kill confirm panel renders');
  has(rd, 'Killing releases', 'PD: panel shows the released figure');
  has(rd, 'stay committed and charted', 'PD: panel shows the held doctrine');
  has(rd, 'kill & phase-out pot', 'PD: panel offers the pot line');
  const kr0 = (G.data.capital.killRows || []).length;
  G.document.getElementById('kd_13').value = 'Contractor exit';
  G.document.getElementById('ka_13').value = '$25K';
  G.progKillConfirm(13);
  G.document.getElementById('kd_13').value = '';
  G.document.getElementById('ka_13').value = '';
  eq((G.data.tracking[13] || {}).status, 'killed', 'PD: confirm executes the kill');
  delete G.bpRows(13, 'dev')[0].pstatus; // clean the status-basis mark
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'PD: confirm stamps the entered set');
  const krows = G.data.capital.killRows || [];
  eq(krows.length, kr0 + 1, 'PD: the pot question lands as a line item');
  ok(/^Contractor exit \u2013 /.test((krows[krows.length - 1] || {}).d || ''), 'PD: pot line is project-tagged');
  eq((krows[krows.length - 1] || {}).a, '$25K', 'PD: pot line carries the amount');
  ok(G.UI.expanded['kp13'] === false, 'PD: panel closes on confirm');
  G.fldSave('trk_13_status', '', true);

  // gate kill-routing stamps the phase on confirm
  G.progGate(13, 'bp13a', 'kill');
  eq(G.UI.expanded['kp13'], 'bp13a', 'PD: a gate Kill routes to the confirm panel carrying the phase');
  G.progKillConfirm(13);
  eq(G.bpRows(13, 'dev')[0].gateDec, 'kill', 'PD: confirming a gate kill stamps the phase');
  eq((G.data.capital.killRows || []).length, kr0 + 1, 'PD: empty pot inputs add no phantom line');
  G.fldSave('trk_13_status', '', true);
  const r13 = G.bpRows(13, 'dev');
  r13.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; delete r.pgnote; });

  // gates as decision records; terminal Go is the launch decision
  G.progGate(13, 'bp13a', 'go');
  eq(r13[0].gateDec, 'go', 'PD: Go stamps the gate');
  eq(r13[0].pstatus, 'complete', 'PD: Go completes the phase');
  ok(!G.UI.expanded['lp13'], 'PD: a non-terminal Go does not launch');
  G.progGate(13, 'bp13b', 'hold');
  eq(r13[1].gateDec, 'hold', 'PD: Hold recorded');
  G.progGateClear(13, 'bp13b');
  ok(!r13[1].gateDec, 'PD: retake clears the record');
  G.progGate(13, 'bp13b', 'go');
  eq((G.data.tracking[13] || {}).status, 'complete', 'PD: terminal Go completes the project');
  ok(G.UI.expanded['lp13'] === true, 'PD: terminal Go opens the launch confirm');
  eq((G.data.launched || []).length, snapLaunched, 'PD: launch still waits for the existing confirm');

  // restore
  r13.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; delete r.pgnote; });
  G.data.tracking[13] = JSON.parse(snapTrk);
  G.data.projects[13] = JSON.parse(snapPrj);
  G.data.capital.periodStart = snapPS;
  if (snapKR === undefined) delete G.data.capital.killRows; else G.data.capital.killRows = snapKR;
  G.data.capStale = snapStale;
  G.UI.expanded['oe13'] = false; G.UI.expanded['kp13'] = false; G.UI.expanded['lp13'] = false;
  G.saveData();
})();

/* ── R41: Run Development Track (P4, July 5) ──────────────────────
   Armed-machine done bar: gates cannot be scheduled, readiness
   can. State-controlled (stash/restore contract fields) so later
   seed changes cannot break these pins. */
(function(){
  G.UI.expanded['re41_13'] = true; // 4.1 collapses armed cards by default since the July 6 dashboard rebuild
  const pg = G.renderStep41();
  has(pg, 'Step 1: Run Development Track', 'R41: step retitled (Map/Run Development Track \u2013 Paul, July 5)');
  has(G.renderStep41(), 'Gates Current \u2014 Nothing Overdue', 'R41: done bar in overdue language (Paul, July 7 \u2013 the set-gate condition was vacuous after 3.4)');
  has(pg, 'Infrastructure learnings', 'R41: dual-purpose tracking survives the rebuild');
  has(pg, 'phases complete', 'R41: header carries the plain x-of-y phase count (manual status select removed \u2013 Paul, July 6; kill intercept still pinned on the data-bank card in PD)');
  const r13 = G.bpRows(13, 'dev');
  const stash = r13.map(function(r){ return { po: r.powner, px: r.pexit }; });
  r13.forEach(function(r){ delete r.powner; delete r.pexit; });
  ok(!G.progArmed(13), 'R41: an unowned next gate is not armed');
  ok(G.progNextGate(13) === r13[0], 'R41: next gate = earliest ungated, uncompleted phase');
  has(G.renderStep41(), 'not yet set', 'R41: unset-gate advisory in set language (Paul, July 6)');
  r13[0].powner = 'Maya Chen'; r13[0].pexit = 'Four clean weeks on line A';
  ok(G.progArmed(13), 'R41: dates + owner + exit criteria on the next gate arm the program');
  r13[0].gateDec = 'go'; r13[0].pstatus = 'complete';
  ok(G.progNextGate(13) === r13[1], 'R41: a taken gate advances the next-gate pointer');
  ok(!G.progArmed(13), 'R41: the pointer moves and the new next gate must be owned too');
  r13[1].gateDec = 'go'; r13[1].pstatus = 'complete';
  ok(G.progArmed(13) && G.progNextGate(13) === null, 'R41: all gates taken \u2192 armed, terminal Go pending');
  r13.forEach(function(r, x){ delete r.gateDec; delete r.gateAt; delete r.pstatus;
    if (stash[x].po === undefined) delete r.powner; else r.powner = stash[x].po;
    if (stash[x].px === undefined) delete r.pexit; else r.pexit = stash[x].px; });
  const snapTrk = JSON.stringify(G.data.tracking[13] || {});
  G.fldSave('trk_13_status', 'killed', true);
  ok(G.progArmed(13), 'R41: killed programs do not block the armed bar');
  G.data.tracking[13] = JSON.parse(snapTrk);
  G.saveData();
})();

/* ── SP: Aurora seed programs (P5, July 5) ──────────────────
   Contracts recycled from existing seed material: owners from the
   experiment briefs, exit criteria absorbed from the retired
   gateRows, metrics derived from the brief success metrics. */
ok(G.progContracted(11) && G.progContracted(12) && G.progContracted(13), 'SP: seed development programs are contracted');
ok(G.progContracted(0), 'SP: item 0 carries a contracted program (its Buy path is preserved)');
ok(G.progArmed(13) && G.progArmed(11) && G.progArmed(12), 'SP: seed programs arm the 4.1 machine');
ok(!((G.data.capAlloc || {})[13] || {}).gateRows, 'SP: seed gateRows absorbed into phase exit criteria');
has(G.bpRows(13, 'dev')[1].pexit, 'Pilot detection', 'SP: gate criteria live on the phases now');
eq(G.capCommitments().total, 3246249, 'SP: contract fields carry no money \u2013 the ledger holds at the single-model constant');

/* ── HZ: hub copy pass + chart zoom (Paul feedback, July 5) ── */
(function(){
  G.UI.hubTab = 0;
  const d = G.renderCapHub();
  ok(d.indexOf('against the capacity line') < 0, 'HZ: stale waterfall caption gone (the waterfall has no capacity line \u2013 verified in orgWaterfallChart)');
  has(d, 'stacked by category: Development, Rollout, Sustainment', 'HZ: waterfall caption describes what is drawn');
  has(d, 'Sustainment vs cap', 'HZ: KPI tile de-jargoned');
  has(d, '% of budget', 'HZ: per-year bars read as a share of budget');
  has(d, 'HEADROOM*', 'HZ: headroom carries the asterisk');
  has(d, 'an even-spread reference, not a limit', 'HZ: runway caption in plain language');
  ok(d.indexOf('a slice, not a schedule') < 0 && d.indexOf('is not slack') < 0, 'HZ: consultant-speak retired');
  has(d, "UI.chartZoom='wf'", 'HZ: enlarge control on the chart cards');
  G.UI.chartZoom = 'wf';
  const z = G.renderCapHub() + G.chartZoomOverlay(); // overlay now appended at the root composition point (July 5)
  has(z, '\u2715 Close', 'HZ: zoom overlay renders with a close control');
  ok(z.split('Capacity Waterfall').length >= 3, 'HZ: overlay carries a second, larger render of the chart');
  const hub2 = G.renderCapHub();
  has(hub2, 'Capital Planning <em>Hub</em>', 'HZ: hub renamed to Capital Planning Hub (Paul, July 5)');
  has(hub2, 'border-top:2px dashed var(--warn-text)', 'HZ: waterfall legend carries a dash sample for the cap line (tokenized with the warning register, July 10 \u2013 the sample now tracks the themed line in both modes)');
  has(hub2, 'Committed Costs by Category', 'HZ: category donut card renders beside the project donut (Paul, July 5)');
  const srs = G.orgMonthly(); let tt = 0;
  for (let m = 0; m < srs.length; m++) tt += srs[m].dev + srs[m].roll + srs[m].sus;
  var _ywc=G.UI.capYear;G.UI.capYear='T';const cat = G.orgCategoryDonut();G.UI.capYear=_ywc;
  has(cat, G.fmtMoney(Math.round(tt)), 'HZ: category donut center = the same whole-horizon total as the engine series');
  has(cat, 'Sustainment', 'HZ: category legend rows render');
  G.UI.chartZoom = 'cat';
  has(G.renderCapHub() + G.chartZoomOverlay(), '\u2715 Close', 'HZ: the category donut zooms like the others');
  G.UI.chartZoom = null;
})();

/* ── CT: Commitments-tab rework (Paul feedback, July 5) ────── */
(function(){
  G.UI.hubTab = 1;
  const t = G.renderCapHub();
  has(t, 'Committed Sums</h3>', 'CT: heading plain \u2013 asterisks retired (Paul, July 5)');
  ok(t.indexOf(' Notes</button>') < t.indexOf('DEVELOPMENT<'), 'CT: notes fold sits above the rows');
  ok(t.indexOf('if launched') < 0, 'CT: per-row \u201cif launched\u201d retired \u2013 nothing pends at launch (single model, July 6)');
  ok(t.indexOf('if all development projects launch') < 0, 'CT: the pending aggregate retired with the staged ledger');
  has(t, '>ANNUAL<', 'CT: sustainment splits into ANNUAL');
  has(t, '>OVER THE PROGRAM<', 'CT: and OVER THE PROGRAM sub-cells');
  has(t, 'title="Sustainment is charted from the month rollout ends"', 'CT: the charting rule moved into the tooltip');
  has(t, 'you will be offered the opportunity to add a line here automatically', 'CT: pot sentence per Paul dictation');
  has(t, 'Potential: Development', 'CT: exploration line capitalized');
  ok(t.indexOf('not yet committed') < 0, 'CT: no not-yet-committed language survives on the rows');
  has(t, 'charted from the month rollout ends', 'CT: operational rows name the committed sustainment stream');
  has(t, 'Exploration (potential projects, no financial commitments yet)', 'CT: exploration list retitled \u2013 parenthetical form matched across all three (Paul, July 5)');
  has(t, 'Operational (all costs committed)', 'CT: operational list retitled');
  has(t, ' Notes</button>', 'CT: notes fold present');
  ok(t.indexOf('held out of Available') < 0, 'CT: obscure pot phrasing retired');
  has(t, 'subtracted from the Available figure', 'CT: pot subtitle explains the deduction plainly');
})();

/* ── S0: quick-win seed enters sustainment at month 9 (Paul, July 5) ──
   Item 0's plan reshaped: rollout m3-8, sustainment from m9. Category
   totals unchanged, so the gross ledger holds; the PRJ/JQ/JB frames
   stash item 0's plan (no-plan path), so no hand-derived pin moves. */
eq(G.capCommitments().total, 3246249, 'S0: ledger unmoved by the item-0 reshape (category totals identical)');
eq(G.bpFirstOpMonth(0), 9, 'S0: item 0 first operational month is 9');
ok(G.bpRows(0,'roll')[0].to === '8' && G.bpRows(0,'sus')[0].from === '9', 'S0: rollout ends m8, sustainment opens m9 \u2013 continuous by construction');

/* ── FL: funding-plan lines + authorize/revoke (Paul ruling, July 5) ──
   Lines are funding SOURCES with a target year; Authorize is the auditable
   step that adds the amount to that year's envelope (getter sums base +
   authorized additions). Authorized lines are read-only until revoked. */
(function(){
  const cap0 = JSON.stringify(G.data.capital);
  const stale0 = G.data.capStale;
  eq(G.envBudgetYear(1), 2400000, 'FL: seed year-1 envelope is the base budget');
  const av0 = G.capAvailable().available;
  const hd0 = G.orgYearTotals()[0].headroom;
  G.flAdd();
  const ln = G.fundLines()[G.fundLines().length - 1];
  G.flSave(ln.id, 'd', 'Reallocate from the marketing automation line');
  G.flSave(ln.id, 'a', '$150K');
  G.flSave(ln.id, 'y', '1');
  eq(ln.st, 'planned', 'FL: new lines are planned, not yet money');
  eq(G.envBudgetYear(1), 2400000, 'FL: a planned line adds nothing to the envelope');
  G.flAuth(ln.id);
  eq(ln.st, 'auth', 'FL: authorize flips the status');
  ok(!!ln.at, 'FL: authorization is stamped');
  eq(G.envBudgetYear(1), 2550000, 'FL: the year-1 envelope now sums base + authorized addition');
  eq(G.capAvailable().available, av0 + 150000, 'FL: Available rises by the authorized amount');
  eq(G.orgYearTotals()[0].headroom, hd0 + 150000, 'FL: year-1 headroom rises with it');
  G.flSave(ln.id, 'a', '$1M');
  eq(ln.a, '$150K', 'FL: authorized lines are read-only (revoke to edit)');
  const _n0 = G.fundLines().length;
  G.flDel(ln.id);
  eq(G.fundLines().length, _n0, 'FL: authorized lines cannot be deleted');
  eq(G.fundLines().filter(x => x.st === 'planned').length, 3, 'FL: the three seed lines arrive planned (legacy texts converted, July 5)');
  ok(!(G.data.capital.reallocation || '').trim() && !(G.data.capital.gapPlan || '').trim(), 'FL: legacy free-texts emptied in the seed');
  G.UI.hubTab = 2;
  const pf = G.renderCapHub();
  has(pf, 'added to Year 1', 'FL: authorized line names where the money went');
  has(pf, 'Authorized additions now in the budget: Year 1 +$150K', 'FL: card totals the authorized additions');
  has(G.renderStepCap ? G.renderStepCap() : '', 'authorized funding-plan additions', 'FL: 3.2 names the composition beside the base fields');
  G.flRevoke(ln.id);
  eq(ln.st, 'planned', 'FL: revoke returns the line to planned (confirm stubbed true)');
  eq(G.envBudgetYear(1), 2400000, 'FL: the envelope drops back on revoke');
  G.flAdd();
  const ln2 = G.fundLines()[G.fundLines().length - 1];
  G.flAuth(ln2.id);
  eq(ln2.st, 'planned', 'FL: an empty line cannot be authorized');
  G.flSave(ln.id, 'y', '2');
  G.flAuth(ln.id);
  eq(G.fundAddsYear(2), 150000, 'FL: additions target their own year');
  eq(G.fundAddsYear(1), 0, 'FL: year 1 carries none of it');
  G.data.capital = JSON.parse(cap0);
  G.data.capStale = stale0;
  G.saveData();
})();

/* ── PN: pause guidance follows the control (Paul, July 5) ────── */
(function(){
  if(!G.data.tracking) G.data.tracking = {};
  const t0 = JSON.parse(JSON.stringify(G.data.tracking[11]||{}));
  G.data.tracking[11] = Object.assign({}, t0, {status:'paused'});
  G.UI.expanded['re41_11'] = true; // open the collapsed-by-default card
  has(G.renderStep41(), 'financial commitment to this project remains in place', 'PN: pause note renders on the 4.1 card (reworded \u2013 Paul, July 6)');
  G.UI.expanded['oe11'] = true;
  has(G.renderOutExpbriefsFull(), 'add them to the paused phase', 'PN: pause note renders on the expanded data-bank development card');
  G.UI.expanded['oe11'] = false;
  G.data.tracking[11] = t0;
  ok(G.renderStep41().indexOf('financial commitment to this project remains in place') < 0, 'PN: note gone when nothing is paused');
})();

/* ── ZB: zoom on the 3.3 and 3.4 charts (Paul, July 5) ────────── */
(function(){
  G.UI.capTab = 2; G.UI.expanded['acCum'] = true;
  has(G.renderStepAlloc(), "UI.chartZoom='ac_cum'", 'ZB: enlarge control beside the cumulative fold at Commit & Advance');
  G.UI.expanded['acCum'] = false;
  G.UI.capTab = 1;
  has(G.renderStepAlloc(), "UI.chartZoom='ac_wf'", 'ZB: enlarge control on the staging chart card');
  has(G.bpCharts(0), "UI.chartZoom='bpshape_0'", 'ZB: enlarge control on the plan spend-shape chart');
  G.UI.capSim = {15: true};
  G.UI.chartZoom = 'ac_cum';
  const o = G.chartZoomOverlay();
  has(o, 'Cumulative vs Capacity \u2013 staged batch included', 'ZB: overlay titles the staged frame');
  has(o, '\u2715 Close', 'ZB: overlay closes');
  G.UI.capSim = {};
  G.UI.chartZoom = 'bpshape_0';
  const o2 = G.chartZoomOverlay();
  has(o2, 'Monthly Spend Shape \u2013 AI-Assisted Customer Triage', 'ZB: plan chart zooms under the project name');
  G.UI.chartZoom = null;
  eq(G.chartZoomOverlay(), '', 'ZB: overlay empty when closed');
})();

/* ── MG: Module Management hub (Paul, July 5) ──────────────────
   Controlled frame: start 35 days back, two stamped completions at
   days 7 and 20 (weeks 2 and 3), one overdue deadline. Hand-derived:
   done 2/15; velocity bars in W2 and W3; delta negative (2 < ideal). */
(function(){
  const snap = {};
  ['completedSteps','stepDoneAt','stepDue','assigns'].forEach(k => snap[k] = JSON.stringify(G.data[k] || null));
  const sd0 = G.data.startDate;
  const iso = d => new Date(d).toISOString().split('T')[0];
  const sd = Date.now() - 35 * 86400000;
  G.data.startDate = iso(sd);
  G.data.completedSteps = { '1.1': true, '1.2': true };
  G.data.stepDoneAt = { '1.1': iso(sd + 7 * 86400000), '1.2': iso(sd + 20 * 86400000) };
  G.data.stepDue = { '1.3': iso(Date.now() - 2 * 86400000), '2.1': iso(Date.now() + 3 * 86400000) };
  G.data.assigns = { '1.1': [G.USERS[0] ? G.USERS[0].id : 'x'], '2.2': [G.USERS[0] ? G.USERS[0].id : 'x'] };
  const st = G.mgStats();
  eq(st.total, 15, 'MG: fifteen countable steps (phase 5 excluded)');
  eq(st.done, 2, 'MG: done count from the flags');
  ok(st.delta < 0, 'MG: two done at day ~35 is behind the ideal pace');
  eq(st.overdue, 1, 'MG: one overdue deadline');
  G.UI.mgTab = 1;
  const pg = G.renderMgmtHub();
  G.UI.mgTab = 0;
  const pgA = G.renderMgmtHub();
  has(pg, 'TODAY \u00b7 2/15', 'MG: burn-up TODAY dot carries the count');
  has(pg, 'behind</span>' === '' ? 'x' : 'behind the ideal pace', 'MG: pace verdict below the burn-up');
  has(pg, 'Module Velocity', 'MG: velocity card renders');
  has(pg, 'Workload by Member', 'MG: workload card on Analytics (renamed from Team Load; open vs complete)');
  ok(pgA.indexOf("mgDueSave('1.1'") < 0, 'MG: completed steps have no clickable deadline input');
  ok(pgA.indexOf("mgDueSave('2.1'") >= 0, 'MG: open steps keep the deadline input');
  has(pgA, 'overdue \u00b7 was due', 'MG: overdue badge on the step row (Assignments tab)');
  has(pgA, 'This Week', 'MG: week panel renders on the Assignments tab');
  ok(pgA.indexOf('90-Day Burn-up') < 0, 'MG: burn-up lives on Analytics only');
  has(pg, 'Signals', 'MG: signals card renders');
  has(pg, '1 open \u00b7 1 complete', 'MG: workload splits open vs complete per member (hand-set: 1.1 done, 2.2 open)');
  const wk = pgA.slice(pgA.indexOf('This Week'), pgA.indexOf('Phase 1'));
  ok(wk.indexOf('assign-add') >= 0 && wk.indexOf('grid-template-columns:minmax(160px,1fr) 300px 240px') >= 0, 'MG: week rows share the phase-box layout, assignment cluster included');
  has(pg, '1 met \u00b7 0 missed' === '' ? 'x' : 'steps with an owner', 'MG: coverage signal renders');
  const vel = G.mgVelocity();
  ok(vel.indexOf('Week 2: 1 step') >= 0 && vel.indexOf('Week 3: 1 step') >= 0, 'MG: velocity buckets land in weeks 2 and 3 (days 7 and 20)');
  G.mgDueSave('2.2', iso(Date.now() + 86400000));
  eq(G.data.stepDue['2.2'], iso(Date.now() + 86400000), 'MG: deadline saves');
  G.mgDueSave('2.2', '');
  ok(!G.data.stepDue['2.2'], 'MG: empty value clears the deadline');
  const u0 = G.USERS[0];
  if (u0) {
    G.mgAssignToggle('2.1', u0.id);
    ok((G.data.assigns['2.1'] || []).indexOf(u0.id) >= 0, 'MG: assignment toggles on');
    G.mgAssignToggle('2.1', u0.id);
    ok((G.data.assigns['2.1'] || []).indexOf(u0.id) < 0, 'MG: assignment toggles off');
  }
  G.UI.assignOpen = '2.2';
  const pgP = G.renderMgmtHub();
  const pop = pgP.slice(pgP.indexOf('assign-pop'));
  ok(pop.indexOf('assign-row') >= 0 && pop.indexOf('opacity:.55') >= 0, 'MG: picker greys the unassigned rows');
  const u0n = G.USERS[0] ? G.USERS[0].name : '';
  const u1n = G.USERS[1] ? G.USERS[1].name : '';
  ok(!u0n || !u1n || pop.indexOf(u0n) < pop.indexOf(u1n), 'MG: assigned member sorts to the top of the picker (u0 holds 2.2 in this frame)');
  has(pgP, 'title="Assign members"', 'MG: the circle-plus trigger is always present');
  G.UI.assignOpen = null;
  // CN: chat & notes are data-backed (July 6) — empty org stays clean, seed populates.
  // The message thread moved to the MySQL API (chat.js: chatMessages, filled by
  // GET /messages over the WebSocket relay), so chatArr() is retired; the roster
  // side still reads straight off `data`. Neither is a literal.
  ok(Array.isArray(G.chatMessages) && typeof G.gchatMembers==='function', 'CN: chat reads members from data and messages from the server buffer, not literals');
  (function(){
    const rSave=G.data.roster, cSave=G.data.chatMsgs, mSave=G.chatMessages;
    G.data.roster=[]; G.data.chatMsgs=[]; G.chatMessages=[];
    ok(G.gchatMembers().length===0 && G.chatMessages.length===0, 'CN: cleared org has no chat members and no messages');
    G.data.roster=rSave; G.data.chatMsgs=cSave; G.chatMessages=mSave;
  })();
  ok((G.data.chatMsgs||[]).length>=5 && JSON.stringify(G.data.chatMsgs).indexOf('Lauren')<0, 'CN: seed thread present, legacy personas gone');
  ok((G.data.notes||[]).length===3 && JSON.stringify(G.data.notes).indexOf('sourcing copilot')>=0, 'CN: three seed notes tied to the live seed state');
  // GT: gate decision semantics (Paul, July 6) — Go/Recycle/Kill; Hold removed; recycle forces the re-plan
  (function(){
    const rr = G.bpRows(13,'dev').filter(function(x){return x&&!x.gateDec})[0];
    if(rr){
      const gp = G.progGateUI(13, rr, false);
      ok(gp.indexOf('Hold') < 0 && gp.indexOf('Recycle') >= 0, 'GT: Hold is gone from the gate; Recycle remains');
      has(gp, 'take no decision', 'GT: caption teaches that an open gate needs no button');
      const snap = JSON.parse(JSON.stringify(G.data.budgetPlans[13]));
      G.progGate(13, rr.id, 'recycle');
      const r2 = G.bpRows(13,'dev').filter(function(x){return x&&x.id===rr.id})[0];
      ok(r2.gateDec==='recycle' && r2.pstatus==='running' && G.UI.expanded['pde_13_'+rr.id]===true, 'GT: recycle returns the phase to Running and opens edit for the re-plan');
      const oeWas = G.UI.expanded['oe13']; G.UI.expanded['oe13'] = true;
      has(G.renderOutExpbriefsFull(), 'revisit the phase budget', 'GT: recycled phase carries the persistent re-plan reminder');
      G.UI.expanded['oe13'] = oeWas;
      G.data.budgetPlans[13] = snap; G.Store.commit('budgetPlans',13);
      G.UI.expanded['pde_13_'+rr.id] = false; G.UI.expanded['phx_13_'+rr.id] = false;
    } else { ok(false, 'GT: frame expected an ungated phase on project 13'); }
  })();
  // HZ: horizon-mismatch warning (Paul, July 6) — persistent red until reconciled
  (function(){
    const i = 11;
    const bpWas = G.data.budgetPlans[i] ? JSON.parse(JSON.stringify(G.data.budgetPlans[i])) : undefined;
    G.data.budgetPlans[i].horizon = '5'; G.Store.commit('budgetPlans', i);
    ok(G.hzMismatch(i) === 3, 'HZ: lifetime 5 vs envelope 3 trips the mismatch (seed has planning started)');
    has(G.bpStatBand(i), 'financial planning horizon of 3 years', 'HZ: full red sentence on the project card stat band');
    has(G.renderStep41(), '\u26a0', 'HZ: compact badge reaches the 4.1 header bar');
    has(G.renderStepCap(), 'assigned lifetimes longer than this planning horizon', 'HZ: 3.2 reconcile panel lists the offenders (Paul, July 6)');
    has(G.renderStepCap(), '(5 years)', 'HZ: the list names the assigned lifetime');
    has(G.bpBudgetTab(i), 'shorten it here or extend the horizon at Step 3.2', 'HZ: inline warning beside the lifetime select at the moment of setting (Paul, July 6)');
    G.data.budgetPlans[i].horizon = '3'; G.Store.commit('budgetPlans', i);
    ok(G.hzMismatch(i) === 0, 'HZ: warning clears when the lifetime is brought into line');
    ok(G.bpStatBand(i).indexOf('financial planning horizon') < 0, 'HZ: stat band silent when reconciled');
    if (bpWas !== undefined) { G.data.budgetPlans[i] = bpWas; G.Store.commit('budgetPlans', i); }
    const abWas = G.data.capital.aiBudget, eyWas = G.data.capital.envYears;
    G.data.capital.aiBudget = ''; G.data.capital.envYears = '';
    ok(!G.hzPlanStarted() && G.hzMismatch(11) === 0, 'HZ: silent before capacity planning has begun (no fictional horizon)');
    G.data.capital.aiBudget = abWas; G.data.capital.envYears = eyWas;
  })();
  // WL: window-limited Committed (Paul, July 6) — only in-window months count; the tail is noted
  (function(){
    const i = 13;
    const sdWas = (G.data.projects[i]||{}).startDate;
    const base = G.capCommitments().total;
    const w13a = G.capProjectWindow(13, null);
    if(!G.data.projects[i]) G.data.projects[i] = {};
    G.data.projects[i].startDate = '2029-02-01'; // program month 35 of a 36-month window
    G.Store.commit('projects', i);
    const w = G.capDevWindow(i);
    eq(w.inW, 33333, 'WL: two in-window months of the month-35 project count (50K phase averaged over 3 months, 2 land inside)');
    eq(w.beyond, 166667, 'WL: the tail beyond the window is the remainder of the full 200K development cost');
    const w13b = G.capProjectWindow(13, null);
    eq(G.capCommitments().total, base - (w13a.inW - w13b.inW), 'WL: the ledger drops by exactly the in-window delta of the moved anchor (whole plan, single model)');
    const tabWas = G.UI.capTab; G.UI.capTab = 2; // envelope cells live on Commit & Advance
    has(G.renderStepAlloc(), 'beyond the planning window: ' + G.fmtMoney(G.capLens().beyond), 'WL: the note figure equals the lens\u2019s beyond-window sum (render matches engine)');
    has(G.renderStepAlloc(), 'are not counted above', 'WL: the note says plainly what the figure means');
    ok(G.capCommitments().rows.some(function(r){return String(r.label).indexOf('(within the planning window)')>=0}), 'WL: the split ledger row is labeled as window-limited');
    G.UI.capTab = tabWas;
    if (sdWas === undefined) delete G.data.projects[i].startDate; else G.data.projects[i].startDate = sdWas;
    G.Store.commit('projects', i);
    eq(G.capCommitments().total, base, 'WL: restoring the anchor restores the full ledger (seed carries no beyond-window months)');
  })();
  // AC: audit CSV (Paul, July 6) — the single model as one exportable table
  (function(){
    const csv = G.buildAuditCSV();
    ok(!!csv && csv.indexOf('project_id,project_name,stage,program_month,calendar_month,development,rollout,sustainment,month_total') >= 0, 'AC: project-months header present');
    ok(csv.indexOf('ENVELOPE BY YEAR') >= 0 && csv.indexOf('year,budget,committed,kill_pot,available') >= 0, 'AC: envelope section present');
    const env = csv.split('ENVELOPE BY YEAR')[1].split('\n').filter(l => /^\d+,/.test(l));
    eq(env.length, G.envYearsOf(), 'AC: one envelope row per year');
    const sumCsv = csv.split('\n').filter(l => /^\d+,/.test(l) && l.split(',').length >= 9).reduce((a,l)=>a+parseInt(l.split(',').pop(),10),0);
    ok(Math.abs(sumCsv - G.capLens().tot.committed) <= G.envYearsOf()*40, 'AC: CSV month totals reconcile to the lens committed total  (got ' + sumCsv + ' vs ' + G.capLens().tot.committed + ')');
  })();
  // FP: funding-plan headline reads the lens, not the retired shim (Paul's catch, July 6)
  (function(){
    G.UI.capTab = 2; G.UI.expanded['fpA'] = true;
    const t2 = G.renderStepAlloc();
    ok(t2.indexOf('Available budget: ') < 0, 'FP: the mixed-basis Available budget line is gone');
    has(t2, 'Available by year: ', 'FP: the per-year strip renders on the funding card (Paul, July 6)');
    has(t2, 'whole window ', 'FP: the strip closes with the whole-window figure');
    G.UI.expanded['fpA'] = false; G.UI.capTab = 1;
  })();
  // ORD: Commit & Advance page order (Paul, July 7)
  (function(){
    G.UI.capTab = 2;
    const t = G.renderStepAlloc();
    const seq = ['On the calendar', 'Cumulative commitments vs capacity', 'Capacity Breach Funding Plan', 'The committed calendar (swimlanes)', 'Committed Sums & Kill Pot'];
    let last = -1, okOrder = true;
    seq.forEach(m => { const ix = t.indexOf(m); if (ix < 0 || ix < last) okOrder = false; last = ix; });
    ok(okOrder, 'ORD: charts \u2192 funding plan \u2192 swimlanes fold \u2192 committed sums, in that order');
    ok(t.indexOf('acCum') < 0, 'ORD: the cumulative chart is open \u2013 no toggle, its breach warning always visible');
    has(t, 'Cumulative commitments', 'ORD: the cumulative section renders with its verdict line');
    G.UI.capTab = 1;
  })();
  // SC: sus-cap line year boundary (December off-by-one fixed July 7)
  (function(){
    const c0 = JSON.parse(JSON.stringify(G.data.capital));
    G.data.capital.susCapY1 = 20; G.data.capital.susCapY2 = 40; G.data.capStale = true;
    const y1b = G.envBudgetYear(1);
    eq(G.capSusCapLine(12), y1b / 12 * 20 / 100, 'SC: month 12 uses YEAR 1\u2019s cap percentage against year 1\u2019s budget \u2013 the line steps at month 13, not 12');
    eq(G.capSusCapLine(13), G.envBudgetYear(2) / 12 * 40 / 100, 'SC: month 13 opens year 2\u2019s percentage');
    G.data.capital = c0; G.data.capStale = true;
  })();

  // NT: email notifications (Paul, July 7) — client-complete, AWS-inert
  (function(){
    const u0 = G.USERS.slice(); const n0 = JSON.parse(JSON.stringify(G.data.notifications || []));
    const co0 = JSON.parse(JSON.stringify(G.data.completedSteps || {})); const sd0 = JSON.parse(JSON.stringify(G.data.stepDoneAt || {}));
    const du0 = JSON.parse(JSON.stringify(G.data.stepDue || {})); const as0 = JSON.parse(JSON.stringify(G.data.assigns || {}));
    const r70 = JSON.parse(JSON.stringify(G.data.remind7 || {}));
    G.USERS.length = 0;
    G.USERS.push({ id: 'uA', name: 'Ada', role: 'Program Lead', admin: true, email: 'ada@aurora.example', color: '#2D5A8E', initials: 'A' }); // flag-based admin (ruled July 9): the role text no longer qualifies anyone
    G.USERS.push({ id: 'uB', name: 'Ben', role: 'Engineering', email: 'ben@aurora.example', color: '#1B6B5A', initials: 'B' });
    G.USERS.push({ id: 'uC', name: 'Cy', role: 'Product', email: '', color: '#8B5E3C', initials: 'C' });
    delete G.data.stepDoneAt['2.3']; G.data.notifications = [];
    G.stampStepDone('2.3');
    const q = (G.data.notifications || [])[0];
    ok(!!q && q.kind === 'step-complete' && q.to.length === 2 && q.to.indexOf('ada@aurora.example') >= 0, 'NT: step completion queues the analytics report to every member with an email');
    has(q.status, 'pending', 'NT: with no endpoint configured, the notification queues as pending');
    ok(q.pdf === true, 'NT: completion notifications ask the service for the PDF attachment');
    G.stampStepDone('2.3');
    eq((G.data.notifications || []).length, 1, 'NT: re-stamping a completed step does not re-queue');
    has(G.notifyEmailHtml(q), 'analytics', 'NT: the completion email carries the Module Management analytics page');
    const soon = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    G.data.stepDue = { '3.1': soon }; G.data.assigns = { '3.1': ['uB'] };
    G.data.remind7 = {}; delete G.data.completedSteps['3.1']; G.data.notifications = [];
    G.notifySweepDeadlines();
    const r = (G.data.notifications || [])[0];
    ok(!!r && r.kind === 'deadline-reminder' && r.to.indexOf('ada@aurora.example') >= 0 && r.to.indexOf('ben@aurora.example') >= 0, 'NT: one week out, the reminder goes to the administrator and the assignee');
    G.notifySweepDeadlines();
    eq((G.data.notifications || []).length, 1, 'NT: the reminder fires once per deadline (remind7 stamp)');
    G.data.stepDue['3.2'] = soon; G.data.assigns['3.2'] = []; G.data.remind7 = {}; G.data.notifications = [];
    G.notifySweepDeadlines();
    ok(!(G.data.notifications || []).some(function(n){ return n.stepId === '3.2'; }), 'NT: deadlines without assignees do not send reminders');
    // Every page's PDF control was unified into pdfBtn() (app.js): the label is
    // now the compact "↓ PDF" and the old wording moved to the tooltip.
    has(G.renderMgmtHub(), 'title="Download this page as a PDF"', 'NT: the analytics page carries the PDF button');
    has(G.renderMgmtHub(), 'onclick="printMgmtAnalytics()"', 'NT: the analytics PDF button is wired to printMgmtAnalytics');
    ok(G.renderMgmtHub().indexOf('Email Notifications') < 0, 'NT: the outbox card is unmounted \u2013 demo-clean (Paul, July 7); notifications record in data only');
    ok(typeof G.notifyOutboxCard === 'function', 'NT: the outbox card builder is kept for remounting once AWS is wired');
    ok(typeof G.printMgmtAnalytics === 'function' && G.NOTIFY_ENDPOINT === '', 'NT: print hook exists; the dispatch endpoint ships empty for the dev team');
    G.USERS.length = 0; u0.forEach(function(u){ G.USERS.push(u); });
    G.data.notifications = n0; G.data.completedSteps = co0; G.data.stepDoneAt = sd0;
    G.data.stepDue = du0; G.data.assigns = as0; G.data.remind7 = r70;
  })();

  // OD: 4.1 done gate — nothing overdue (Paul, July 7)
  (function(){
    const psWas = G.data.capital.periodStart;
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 3);
    G.data.capital.periodStart = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; // program month is always 4
    G.Store.commit('capital');
    const row = G.bpRows(13, 'dev').filter(r => r.id === 'bp13a')[0];
    const decWas = row.gateDec;
    delete row.gateDec; G.Store.commit('budgetPlans');
    ok(G.progOverdue(13) >= 1, 'OD: a phase ended without a gate decision counts as overdue');
    G.UI.expanded['re41_13'] = true;
    const od41 = G.renderStep41();
    has(od41, 'Record the gate decision for every phase that has ended', 'OD: the done hint names the overdue requirement');
    has(od41, 'ended in Month ', 'OD: the overdue phase carries a visible row warning (Paul, July 7)');
    // KP: the kill panel renders under the row that triggered it
    G.UI.expanded['kp13'] = 'bp13a';
    const kpRow = G.renderStep41();
    const rowsK = G.bpRows(13, 'dev');
    const nmA = (rowsK.filter(r => r.id === 'bp13a')[0] || {}).name || '';
    const nmB = (rowsK.filter(r => r.id === 'bp13b')[0] || {}).name || '';
    const ck = kpRow.indexOf('Confirm kill');
    ok(ck > kpRow.indexOf(nmA) && (kpRow.indexOf(nmB) < 0 || ck < kpRow.lastIndexOf(nmB)), 'KP: gate-triggered kill panel sits directly under the triggering row (Paul, July 7)');
    G.UI.expanded['kp13'] = true;
    has(G.renderStep41(), 'Confirm kill', 'KP: status-select kill keeps its panel');
    G.UI.expanded['kp13'] = false;
    row.gateDec = 'go'; G.Store.commit('budgetPlans');
    ok(G.progOverdue(13) === 0 || G.bpRows(13, 'dev').some(r => { const sp = G.bpStepSpan(r); return sp && sp[1] < 4 && !r.gateDec; }) === false, 'OD: recording the decision clears the overdue count for that phase');
    if (decWas === undefined) delete row.gateDec; else row.gateDec = decWas;
    G.data.capital.periodStart = psWas; G.Store.commit('capital');
  })();
  // RV: review decisions unclick; rows expand to the status card (Paul, July 7)
  (function(){
    const riWas = JSON.stringify((G.data.review && G.data.review.items && G.data.review.items[13]) || null);
    G.setReviewDecision(13, 'hold');
    eq(((G.data.review.items || {})[13] || {}).decision, 'hold', 'RV: a decision records');
    G.setReviewDecision(13, 'hold');
    ok(!((G.data.review.items || {})[13] || {}).decision, 'RV: clicking the active decision unclicks it');
    G.setReviewDecision(13, 'sell');
    ok((G.data.tracking[13] || {}).status !== 'killed' && G.UI.expanded['kp13'] === true && !((G.data.review.items || {})[13] || {}).decision, 'RV: sell on a dev item opens the kill confirm panel \u2013 nothing kills, nothing records, until confirm (parity, Paul July 7)');
    G.progKillConfirm(13);
    ok((G.data.tracking[13] || {}).status === 'killed' && ((G.data.review.items || {})[13] || {}).decision === 'sell', 'RV: confirming the panel kills AND records the Sell decision');
    G.setReviewDecision(13, 'sell');
    ok(!((G.data.review.items || {})[13] || {}).decision && (G.data.tracking[13] || {}).status === '', 'RV: unclicking sell revives \u2013 status and the frozen set clear (programmatic path; the UI offers Revive since July 10)');
    ok(G.renderStep44().indexOf(' Card</button>') < 0, 'RV: the Card button is gone \u2013 the whole row head toggles, portfolio-style (Paul, July 7)');
    has(G.renderStep44(), 'flx-row-mb xh', 'RV: decision-row heads carry the clickable expand pattern');
    ok(G.renderStep44().indexOf('Step 3.4 before scaling') < 0, 'RV: the impossible 3.4 gate is gone from exploration Buy \u2013 advance criteria only');
    G.UI.expanded['rv13'] = true;
    const rv = G.renderStep44();
    has(rv, 'In development', 'RV: the row badges the stage, not the raw status');
    ok(rv.indexOf('trk_13_results') >= 0 && rv.indexOf('Portfolio Position') >= 0, 'RV: an in-development row expands to the FULL live development card \u2013 status, results, program dashboard, position (Paul, July 7; vocabulary: position, July 10)');
    G.UI.expanded['rv13'] = false;
    if (riWas === 'null') { if (G.data.review && G.data.review.items) delete G.data.review.items[13]; }
    else G.data.review.items[13] = JSON.parse(riWas);
    G.Store.commit('review'); G.Store.commit('tracking');
  })();
  // NV: the shared review surface (Paul, July 7)
  (function(){
    const s44 = G.renderStep44();
    has(s44, 'setReviewDecision(', 'NV: 4.4 still runs the review through the shared surface');
    const closed = G.renderNavDash();
    has(closed, 'Portfolio Review', 'NV: Navigate carries the review natively');
    has(closed, 'Run the review', 'NV: closed state offers the run control beside the next-review line');
    ok(closed.indexOf('setReviewDecision(') < 0, 'NV: closed state stays a pointer \u2013 no machinery rendered');
    G.UI.expanded.navRev = true;
    const openN = G.renderNavDash();
    has(openN, 'setReviewDecision(', 'NV: open, Navigate mounts the same decision machinery');
    has(openN, 'Portfolio Learnings', 'NV: the full surface travels \u2013 the merged learnings card included (renamed from Portfolio Replenishment, Paul July 7)');
    has(openN, 'rev_nextCycle', 'NV: all five learning boxes ride in the one card');
    G.UI.expanded.navRev = false;
  })();
  // RVL: review list population and stage precedence (Paul, July 7)
  (function(){
    const wasL = (G.data.launched || []).slice();
    if (!G.data.launched) G.data.launched = [];
    if (G.data.launched.indexOf(13) < 0) G.data.launched.push(13);
    G.Store.commit('launched');
    const r = G.renderStep44();
    ok(r.indexOf('Operational') >= 0, 'RVL: a launched item badges Operational even while it remains in the development selection \u2013 operational wins precedence');
    has(r, 'Exploration', 'RVL: exploration rows restored to the decision list (Paul, July 7; badge matches the stat-band vocabulary) \u2013 the Buy path pulls them forward');
    const _xp = (G.data.selected || []).filter(function(i){ return (G.data.expSelected || []).indexOf(i) < 0 && (G.data.launched || []).indexOf(i) < 0 && ((G.data.projects || {})[i] || {}).viable === true; })[0];
    if (_xp !== undefined) {
      G.UI.expanded['rv' + _xp] = true;
      has(G.renderStep44(), 'Re-score (deepened)', 'RVL: an exploration row expands to the FULL live exploration card (re-score, advance gate)');
      G.UI.expanded['rv' + _xp] = false;
    } else { ok(typeof G.expPortBody === 'function', 'RVL: expPortBody exists (no seed exploration item to render against)'); }
    if (_xp !== undefined) {
      G.setReviewDecision(_xp, 'sell');
      const oxK = G.renderOutExploreEnhanced();
      ok(oxK.indexOf('>Killed<') >= 0 && oxK.indexOf('line-through') >= 0, 'RVL: a sold exploration item stays on the Exploration Portfolio, struck through with the Killed badge (Paul, July 7 \u2013 badge simplified from Sold \u00b7 killed)');
      G.setReviewDecision(_xp, 'sell'); // unclick revives and clears
    }
    G.UI.expanded['rv13'] = true;
    const rvOp = G.renderStep44();
    ok(rvOp.indexOf('Development card') >= 0 && rvOp.indexOf('Project card') >= 0 && rvOp.indexOf('Idea card') >= 0, 'RVL: an operational row expands to the full operational card with the nested development/project/idea folds');
    G.UI.expanded['rv13'] = false;
    has(r, 'Portfolio Balance</h3>', 'RVL: balance card retitled, re-grade suffix gone');
    has(r, 'operational or in development to take account of the most recent evidence', 'RVL: explainer sentence per Paul');
    G.data.launched = wasL; G.Store.commit('launched');
  })();
  G.saveDone13();
  eq(G.data.stepDoneAt['1.3'], iso(Date.now()), 'MG: saveDone stamps the completion date');
  ok(G.mgStats().overdue === 0, 'MG: completing the step clears its overdue flag');
  ['completedSteps','stepDoneAt','stepDue','assigns'].forEach(k => { const v = JSON.parse(snap[k]); if (v === null) delete G.data[k]; else G.data[k] = v; });
  G.data.startDate = sd0;
  G.saveData();
})();

/* ── SU: management seed (July 5) ─────────────────────────────── */
(function(){
  ok((G.data.roster || []).length >= 9, 'SU: seed roster carries the eight named members plus the owner');
  ok(G.USERS.some(u => u.name === 'Vincent Lau') && G.USERS.some(u => u.name === 'Arvind Nair'), 'SU: roster applied to USERS');
  eq((G.data.assigns['3.4'] || []).join(','), 'su1,su2', 'SU: assignments seeded per step');
  ok(!!G.data.stepDoneAt['4.1'] && !G.data.stepDoneAt['4.2'], 'SU: completion dates only on completed steps');
  const st = G.mgStats();
  eq(st.done, 12, 'SU: twelve of fifteen steps complete on the seed');
  eq(st.overdue, 0, 'SU: no overdue deadlines on the seed (dues sit in days 76\u201388)');
  G.UI.mgTab = 1;
  has(G.renderMgmtHub(), 'TODAY \u00b7 12/15', 'SU: seed burn-up carries the count (Analytics)');
  G.UI.mgTab = 0;
  has(G.renderMgmtHub(), 'due ', 'SU: upcoming deadlines render (Assignments default)');
})();

/* ── MG2: hub registered like cap-hub (July 5) ── */
ok(!G.PH[4].outcomes.some(o => o.id === 'mgmt-hub'), 'MG2: management hub is NOT a phase-5 output (Paul ruling: module-wide tool, top bar only)');
(function(){
  const page0 = G.currentPage;
  G.go('mgmt-hub');
  eq(G.currentPage, 'mgmt-hub', 'MG2: go() routes to the hub');
  G.UI.navMore = true; G.render();   // Track Program moved under More (Faisal, July 10)
  const nrEl = (typeof G.$ === 'function') ? G.$('navRight') : null;
  if (nrEl && typeof nrEl.innerHTML === 'string') {
    has(nrEl.innerHTML, 'Track Program</button>', 'MG2: the More-menu item reads Track Program (renamed from Manage, Paul July 7; moved under More, Faisal July 10)');
    ok(nrEl.innerHTML.indexOf('? Help') < nrEl.innerHTML.indexOf('Track Program'), 'MG2: Help (top bar) precedes the Track Program menu item in the markup');
    ok(nrEl.innerHTML.indexOf('Light Mode') >= 0 || nrEl.innerHTML.indexOf('Dark Mode') >= 0, 'MG2: the theme toggle holds the old top-bar slot');
    has(nrEl.innerHTML, 'nav-more-item nav-action-on', 'MG2: the menu item lights up while on the hub');
  } else {
    ok(true, 'MG2: nav element not inspectable in this stub \u2013 covered by browser QA');
  }
  G.UI.navMore = false;
  G.go(page0 || 'home');
})();

/* ── REPORT ─────────────────────────────────────────────────── */
console.log('\n──────────────────────────────────────────');
/* ─── Y2 SEED (July 8): year-2-end sample – identity hand-derived by the +Δ method ───
   Base 3,246,249 preserved under the uniform 19-month shift (window and offsets move together);
   Δ = −49,583 (invoice copilot kill: sunk bp12a 80,000 replaces the 129,583 full in-window plan)
       +279,583 (churn intake, month-16 anchor: dev 180,000 + roll 40,000 + 13 sustainment months at 55K/yr)
       +(260,000 − 353,333) (procurement copilot deferred to month 19: dev 205,000 + roll 55,000 wholly
        in window under the base anchor become dev 205,000 + roll partial + sustainment tail under m19)
   ⇒ 3,382,916. Every figure derived from seed rows with independent arithmetic (derive_y2.js) before pinning. */
(function(){
  const _snapAll = JSON.stringify(G.data);
  noThrow(() => G.seedDataY2(), 'Y2: seedDataY2() runs (incl. its internal render())');
  const m = G.progMonthOf(new Date());
  ok(m === 22 || m === 23, 'Y2: "today" sits late in envelope year 2 (month 22–23), got ' + m);
  eq(G.envYearsOf(), 3, 'Y2: envelope stays 3 years');
  ok(Math.abs(G.capCommitments().total - 3382916) <= 2, 'Y2: in-window ledger identity 3,382,916 ±2 (hand-derived)');
  eq(G.anchorMonth(11), 19, 'Y2: procurement copilot anchor follows the deferred startDate (Start Date Drift)');
  eq(G.anchorMonth(14), 16, 'Y2: churn model anchors at the month-16 advance');
  eq(G.capBreaches([]).capYears, [3], 'Y2: sustainment plateau breaches year 3 only (545K vs 18% of 2.8M)');
  eq(G.capBreaches([]).overCapMonth, 0, 'Y2: no annual budget breach (year totals inside composed envelopes)');
  eq(G.envBudgetYear(1), 3100000, 'Y2: year-1 envelope composed with the three authorized funding lines');
  const st = G.getStages();
  eq(st.operational, [0,1,4,13], 'Y2: operational = the base three launches + quality vision');
  eq(st.experiment, [11,12,14], 'Y2: development row = deferred copilot, killed invoice item, churn intake');
  eq((G.data.tracking[12]||{}).status, 'killed', 'Y2: invoice copilot killed');
  eq((G.data.tracking[12]||{}).killSunkIds, ['bp12a'], 'Y2: kill froze the entered phase (status basis)');
  ok(Math.abs(G.killSunkDev(12) - 80000) <= 1, 'Y2: sunk dev on the killed item = the entered phase, 80K');
  eq((G.data.capital.killRows||[]).length, 1, 'Y2: one wind-down line in the kill & phase-out pot');
  eq((G.data.reviewCycles||[]).length, 1, 'Y2: one closed review cycle in history');
  eq(G.data.reviewCycles[0].review.items['13'].decision, 'buy', 'Y2: the cycle records the Buy that launched quality vision');
  eq(G.data.reviewCycles[0].review.items['14'].decision, 'buy', 'Y2: the cycle records the Buy that advanced the churn model');
  ok(!!(G.data.opsData[13]||{}).launchConfirm, 'Y2: the launch carries the review-decision confirm stamp');
  eq(G.data.ideas.length, 25, 'Y2: five new ideas entered the funnel');
  ok(st.explore.indexOf(20) >= 0 && st.explore.indexOf(21) >= 0, 'Y2: two new ideas sit in exploration');
  ok(st.explore.indexOf(14) < 0, 'Y2: the churn model left exploration on advance');
  eq(Object.keys(G.data.completedSteps).length, 15, 'Y2: all fifteen module steps complete');
  // restore completely (frame discipline: an incomplete restore silently poisons every later block)
  G.data = JSON.parse(_snapAll);
  G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'Y2: restore returns the base seed identity 3,246,249');
})();

/* ─── AUTH (Directive 2 Oct 2026, Parts 5 and 6; live 6 Oct 2026) ───
   Sign-in is a username and a password checked by the SERVER, which answers
   with a session cookie. The browser holds no password and has no offline
   door: a sign-in that cannot reach the server is refused, never decided
   locally. These pins freeze the client half of that contract against a fake
   API (the harness has no PHP behind it): what is sent, what each answer
   does, the rule, the refusal wording, and that no password lands in storage. */
(function(){
  const _cu = G.currentUserId, _ia = G.isAppAdmin, _org = G.currentOrgId;
  const _rem = G.Store.getRemember(), _sess = G.Store.getSession();
  const _fetch = G.fetch;
  const calls = [];
  let answer = () => ({ status: 404, body: { success: false } });
  G.fetch = (url, opts) => {
    calls.push({ url: String(url), method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null, credentials: opts && opts.credentials });
    const a = answer(String(url), opts || {});
    return syncAdopt({ status: a.status, json: () => syncAdopt(a.body) });
  };
  const PW = 'Harbour!Lamp42';
  try {
    /* 5.1: the rule, the same in every module */
    ok(G.passwordProblem('Ab1!') !== '', 'AUTH 5.1: fewer than 8 characters is refused');
    ok(/number/.test(G.passwordProblem('abcdefgh!')), 'AUTH 5.1: a password needs a number');
    ok(/special/.test(G.passwordProblem('abcdefg12')), 'AUTH 5.1: a password needs a special character');
    ok(/special/.test(G.passwordProblem('Пароль12')), 'AUTH 5.1: letters in any script are letters, not special characters');
    ok(/common/.test(G.passwordProblem('Password1!')), 'AUTH 6.1.5: a common password is refused (any case)');
    ok(G.passwordProblem('a1!' + 'x'.repeat(126)) !== '', 'AUTH 5.1: more than 128 characters is refused');
    eq(G.passwordProblem(PW), '', 'AUTH 5.1: a password meeting the rule passes');

    /* A.5.3: an unknown username and a wrong password read the same */
    eq(G.authRefusal({ reason: 'no-user' }, ''), G.authRefusal({ reason: 'bad-password' }, ''), 'AUTH A.5.3: no-user and bad-password are worded alike');
    eq(G.authRefusal({ reason: 'locked' }, ''), 'Too many attempts. Try again in 15 minutes.', 'AUTH A.5.4: the lockout message');
    ok(/administrator/.test(G.authRefusal({ reason: 'no-credential' }, '')), 'AUTH A.5.12: no sign-in yet points to the administrator');

    /* No server: refused, never decided on this device */
    G.fetch = _fetch;
    let n1; G.Auth.signIn('vlau', PW, false, r => { n1 = r; });
    ok(n1 && n1.ok === false && n1.reason === 'network', 'AUTH: with no server, sign-in is refused (no offline door)');
    G.fetch = (url, opts) => { calls.push({ url: String(url), method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null, credentials: opts && opts.credentials }); const a = answer(String(url), opts || {}); return syncAdopt({ status: a.status, json: () => syncAdopt(a.body) }); };

    /* What a sign-in sends */
    answer = () => ({ status: 401, body: { success: false, message: 'That username and password do not match.', reason: 'bad-password' } });
    let b1; G.Auth.signIn('vlau', 'Wrong!pass1', true, r => { b1 = r; });
    const sent = calls[calls.length - 1];
    ok(/\/session$/.test(sent.url) && sent.method === 'POST', 'AUTH 6.2: sign-in is POST /session');
    ok(sent.body.username === 'vlau' && sent.body.password === 'Wrong!pass1' && sent.body.remember === true && !('pin' in sent.body), 'AUTH 6.2: it sends username, password and remember — no PIN');
    eq(sent.credentials, 'same-origin', 'AUTH 6.1.3: the request carries the session cookie');
    ok(b1 && b1.ok === false && b1.reason === 'bad-password', 'AUTH: the server\'s refusal comes back with its reason');

    /* A verified sign-in opens the workspace the server NAMED, by public id */
    const org = G.getOrg(G.currentOrgId); const me = G.USERS.filter(u => u.username === 'vlau')[0];
    const _osid = org.serverId, _usid = me && me.serverId;
    org.serverId = 'org_srv_h1'; G.saveOrgs(G.getOrgs().map(o => o.id === org.id ? org : o));
    me.serverId = 'usr_srv_h1'; G.persistRoster();
    answer = (url) => /\/session$/.test(url) ? { status: 200, body: { success: true, data: { ok: true, orgId: 'org_srv_h1', userId: 'usr_srv_h1', mustChange: false, user: { id: 'usr_srv_h1', username: 'vlau' }, organization: { id: 'org_srv_h1' } } } } : { status: 404, body: { success: false } };
    let s1; G.Auth.signIn('vlau', PW, false, r => { s1 = r; });
    ok(s1 && s1.ok === true && s1.orgId === org.id && s1.userId === me.id, 'AUTH: a verified sign-in opens the member the server named');

    /* 5.5 / 6.1.6: a temporary password opens nothing until it is replaced */
    answer = () => ({ status: 200, body: { success: true, data: { ok: true, orgId: 'org_srv_h1', userId: 'usr_srv_h1', mustChange: true, user: { id: 'usr_srv_h1' }, organization: { id: 'org_srv_h1' } } } });
    calls.length = 0;
    let m1; G.Auth.signIn('vlau', PW, false, r => { m1 = r; });
    ok(m1 && m1.ok === true && m1.mustChange === true && m1.data && m1.data.userId === 'usr_srv_h1', 'AUTH 5.5: mustChange comes back with the verified ids');
    eq(calls.length, 1, 'AUTH 6.1.6: and nothing else is requested before the new password');

    /* The other requests (6.2) */
    calls.length = 0; answer = () => ({ status: 200, body: { success: true, data: { ok: true } } });
    G.Auth.signInAdmin('admin', 'NextChapter2026!', () => { });
    G.Auth.changePassword('Old!pass12', PW, () => { });
    G.Auth.changeAdminPassword('Old!pass12', PW, () => { });
    G.Auth.setTemporaryPassword('org_srv_h1', 'usr_srv_h1', PW, () => { });
    G.Auth.currentSession(() => { });
    G.Auth.serverSignOut(() => { });
    const sig = calls.map(c => c.method + ' ' + c.url.replace(/^.*?\/?api/, '') + ' ' + Object.keys(c.body || {}).sort().join(','));
    eq(sig.join(' | '), 'POST /admin-session password,username | POST /password current,next | POST /admin/password current,next | POST /admin/temporary-password orgId,temporary,userId | GET /session  | POST /sign-out ', 'AUTH 6.2: the six requests, with exactly these fields');

    /* No password is ever written to storage */
    const stored = JSON.stringify([...(G.localStorage._m ? G.localStorage._m.values() : []), G.sessionStorage.getItem && Array.from({ length: G.sessionStorage.length }, (_, i) => G.sessionStorage.getItem(G.sessionStorage.key(i)))]);
    let leaked = false; for (let i = 0; i < G.localStorage.length; i++) { const v = G.localStorage.getItem(G.localStorage.key(i)) || ''; if (v.indexOf(PW) >= 0 || v.indexOf('Wrong!pass1') >= 0) leaked = true; }
    for (let i = 0; i < G.sessionStorage.length; i++) { const v = G.sessionStorage.getItem(G.sessionStorage.key(i)) || ''; if (v.indexOf(PW) >= 0 || v.indexOf('Wrong!pass1') >= 0) leaked = true; }
    ok(!leaked && stored !== undefined, 'AUTH 6.1.2: no password is in localStorage or sessionStorage');

    /* Start-up: the server decides whether a restored session stands */
    G.currentUserId = me.id; G.isAppAdmin = false;
    answer = () => ({ status: 200, body: { success: true, data: { ok: false } } });
    const _ra = G.Router; G.Router = undefined;
    G.confirmSessionWithServer();
    ok(G.currentUserId === null && G.UI.entry && G.UI.entry.step === 'login', 'AUTH 6.1.3: a session the server no longer holds is signed out at start-up');
    G.currentUserId = me.id; G.UI.entry = null;
    answer = () => ({ status: 200, body: { success: true, data: { ok: true, orgId: 'org_srv_h1', userId: 'usr_srv_h1', mustChange: false } } });
    G.confirmSessionWithServer();
    eq(G.currentUserId, me.id, 'AUTH: a session the server confirms is kept');
    answer = () => ({ status: 200, body: { success: true, data: { ok: true, orgId: 'org_srv_h1', userId: 'someone_else', mustChange: false } } });
    G.confirmSessionWithServer();
    eq(G.currentUserId, null, 'AUTH: a server session for somebody else is not this one');
    G.currentUserId = me.id; G.UI.entry = null; G.fetch = _fetch;
    G.confirmSessionWithServer();
    eq(G.currentUserId, me.id, 'AUTH: a network failure at start-up changes nothing');
    G.Router = _ra;

    /* Sign-up asks for the setup code and the password twice (5.9) */
    const base = { account_type: 'enterprise', organization_name: 'Acme', name: 'Maria', email: 'm@acme.example', username: 'maria', setup_code: 'ABCXYZ', password: PW, confirm: PW };
    eq(Object.keys(G.Entry.validateSetup(base)).length, 0, 'AUTH 5.9: a complete sign-up passes');
    ok(!!G.Entry.validateSetup(Object.assign({}, base, { setup_code: '' })).setup_code, 'AUTH 5.9: the setup code is required');
    ok(!!G.Entry.validateSetup(Object.assign({}, base, { password: 'short', confirm: 'short' })).password, 'AUTH 5.1: sign-up applies the password rule');
    ok(!!G.Entry.validateSetup(Object.assign({}, base, { confirm: PW + 'x' })).confirm, 'AUTH 5.9: the two passwords must match');

    /* The entry templates */
    const T = G.__LOCAL_TEMPLATES || {};
    ok(/id="loginPassword"[^>]*type="password"/.test(T.login) && !/loginPin|inputmode="numeric"/.test(T.login), 'AUTH: sign-in has a password field and no PIN box');
    ok(/id="adminUser"/.test(T['admin-login']) && /id="adminPassword"[^>]*type="password"/.test(T['admin-login']), 'AUTH 5.12: the administrator signs in with a username and a password');
    ok(/id="setupCode"/.test(T.setup) && /id="setupPassword"/.test(T.setup) && /id="setupConfirm"/.test(T.setup) && !/setupPin/.test(T.setup), 'AUTH 5.9: sign-up asks for the setup code and the password twice');
    ok(/id="newPassword"/.test(T['choose-password'] || '') && /id="confirmPassword"/.test(T['choose-password'] || ''), 'AUTH 5.5: Choose a new password is bundled');

    /* Kept for generated program code; they mint nothing now */
    eq(G.Auth.defaultPasscode(), '', 'AUTH 5.2.2: there is no default password');
    const u1 = { passcode: '1234' }; G.Auth.ensurePasscode(u1);
    ok(!('passcode' in u1), 'AUTH: ensurePasscode removes a password rather than minting one');

    /* Session semantics */
    G.Auth.setSession('probe-user');
    eq(G.currentUserId, 'probe-user', 'AUTH: setSession writes the session');
    G.Auth.setAdminSession(true);
    eq(G.isAppAdmin, true, 'AUTH: setAdminSession raises the admin flag');
    G.Auth.clearSession();
    ok(G.currentUserId === null && G.isAppAdmin === false && G.Store.getRemember() === null, 'AUTH: clearSession clears user, admin flag, and remember-me');

    org.serverId = _osid; G.saveOrgs(G.getOrgs().map(o => o.id === org.id ? org : o));
    if (_usid) me.serverId = _usid; else delete me.serverId; G.persistRoster();
  } finally {
    G.fetch = _fetch;
    G.Store.setRemember(_rem || null); G.Store.setSession(_sess || null);
    G.currentOrgId = _org; G.currentUserId = _cu; G.isAppAdmin = _ia; G.UI.entry = null;
  }
  eq(G.currentUserId, _cu, 'AUTH: session restored for downstream blocks');
})();

/* ─── MULTI-USER PREP (July 8): revisioned writes, refresh, stale recovery ───
   These pins freeze the client contract for ~6 simultaneous users: every
   persisted blob carries schemaVersion + a monotonic rev (mirrored in a tiny
   rev record so polling never parses the blob); refreshOrg adopts a newer
   stored blob; handleStaleWrite re-pulls and overlays the local dirty records
   (record-level last-writer-wins, per the blob-PUT ruling). */
(function(){
  const _oid = G.currentOrgId;
  const _snap = JSON.stringify(G.data);
  const _rev0 = G.data.rev || 0;

  G.Store.commit('purpose');
  ok((G.data.rev||0) === _rev0 + 1, 'MU: each persisted write increments rev');
  eq(G.data.schemaVersion, G.Store.schemaVersion(), 'MU: blobs carry the schemaVersion stamp');
  eq(G.Store.orgRev(_oid), G.data.rev, 'MU: the mirrored rev record tracks the blob');
  eq(G.Store.refreshOrg(), false, 'MU: refreshOrg is a no-op when nothing newer is stored');

  const remote = JSON.parse(JSON.stringify(G.data));
  remote.purpose = remote.purpose || {}; remote.purpose.mission = 'REMOTE EDIT';
  G.Store.writeOrg(_oid, remote); // simulates another tab: stored rev now ahead
  ok(G.Store.orgRev(_oid) > (G.data.rev||0), 'MU: a foreign write leaves the in-memory replica behind');
  eq(G.Store.checkRemote(), true, 'MU: the change signal adopts the newer blob');
  eq(G.data.purpose.mission, 'REMOTE EDIT', 'MU: the adopted blob is live in the replica');
  eq(G.data.rev, G.Store.orgRev(_oid), 'MU: revs agree after adoption');

  const fresh = { rev: 9, tracking: { 1: { status: 'remote' } }, governance: { meeting: 'R' } };
  const local = { tracking: { 0: { status: 'mine' }, 1: { status: 'stale-mine' } }, capital: { susCap: '7' } };
  G.Store.mergeDirtyInto(fresh, local, ['tracking::0', 'capital']);
  eq(fresh.tracking[0].status, 'mine', 'MU: merge overlays my dirty record onto the fresh blob');
  eq(fresh.tracking[1].status, 'remote', 'MU: merge keeps records I did not touch');
  eq(fresh.capital.susCap, '7', 'MU: merge overlays collection-level dirty keys');

  // stale-write recovery end to end: my committed record survives, the other
  // writer's data survives, revs advance, the dirty set clears
  const remote2 = JSON.parse(JSON.stringify(G.data));       // cloned BEFORE my edit
  remote2.governance = remote2.governance || {}; remote2.governance.threshold = '$9M-REMOTE';
  G.Store.clearDirty();
  G.data.purpose.mission = 'MY DIRTY EDIT'; G.Store.commit('purpose');
  G.Store.writeOrg(_oid, remote2);                          // server-authoritative newer blob
  ok(G.Store.handleStaleWrite(_oid) === true, 'MU: stale-write recovery runs');
  eq(G.data.purpose.mission, 'MY DIRTY EDIT', 'MU: recovery reapplies my in-flight record');
  eq(G.data.governance.threshold, '$9M-REMOTE', 'MU: recovery keeps the other writer data');
  eq(G.data.rev, remote2.rev + 1, 'MU: recovery persists one rev past the authoritative blob');
  eq(G.Store.dirtyRecords().length, 0, 'MU: recovery clears the dirty set');

  // restore completely
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'MU: restore returns the base seed identity');
})();

/* ─── THREE-WAY SYNC MERGE: the 5s poll must never cost anyone an edit ───
   The poll used to download the server's document and replace ours with it,
   taking every unflushed local change with it. Store.mergeDocs(base, mine,
   theirs) is what replaced that: base is what the server last confirmed, mine
   is this browser (unsent edits and all), theirs is what the server holds now.
   These pins freeze the rules — what merges silently, what is reported as a
   conflict, and the one thing that must never happen: losing MINE. */
(function(){
  const M = (b,m,t) => G.Store.mergeDocs(b,m,t);

  // 1. Nothing local to protect → the server's document is taken whole.
  {
    const base = { a: { x: 1 } };
    const r = M(base, { a: { x: 1 } }, { a: { x: 2 }, b: 'new' });
    eq(r.doc.a.x, 2, 'MERGE: an untouched key takes the server value');
    eq(r.doc.b, 'new', 'MERGE: a key only the server has is adopted');
    eq(r.conflicts.length, 0, 'MERGE: adopting is not a conflict');
  }

  // 2. Two users, two different keys. Both survive — this is the whole point.
  {
    const base = { purpose: { mission: 'old' }, governance: { meeting: 'old' } };
    const mine = { purpose: { mission: 'MINE, unsent' }, governance: { meeting: 'old' } };
    const theirs = { purpose: { mission: 'old' }, governance: { meeting: 'THEIRS, saved' } };
    const r = M(base, mine, theirs);
    eq(r.doc.purpose.mission, 'MINE, unsent', 'MERGE: my unsent edit survives the poll');
    eq(r.doc.governance.meeting, 'THEIRS, saved', 'MERGE: their saved edit arrives');
    eq(r.conflicts.length, 0, 'MERGE: different keys never collide');
  }

  // 3. The SAME record, different fields. Still no collision.
  {
    const base = { projects: { p1: { name: 'P', owner: 'a', score: 1 } } };
    const mine = { projects: { p1: { name: 'P', owner: 'ME', score: 1 } } };
    const theirs = { projects: { p1: { name: 'P', owner: 'a', score: 9 } } };
    const r = M(base, mine, theirs);
    eq(r.doc.projects.p1.owner, 'ME', 'MERGE: my field of a shared record is kept');
    eq(r.doc.projects.p1.score, 9, 'MERGE: their field of the same record is taken');
    eq(r.conflicts.length, 0, 'MERGE: different fields of one record merge cleanly');
  }

  // 4. The same field, two different values → a conflict, and MINE stands.
  {
    const base = { purpose: { mission: 'old' } };
    const r = M(base, { purpose: { mission: 'MINE' } }, { purpose: { mission: 'THEIRS' } });
    eq(r.doc.purpose.mission, 'MINE', 'MERGE: a contested value keeps the local edit');
    eq(r.conflicts.length, 1, 'MERGE: the collision is reported, not swallowed');
    eq(r.conflicts[0].kind, 'both-edited', 'MERGE: the report says what happened');
    ok(/purpose\.mission$/.test(r.conflicts[0].path), 'MERGE: the report names the field');
  }

  // 5. Record ARRAYS (the Leaders programs): rows merge by id.
  {
    const base = { decisions: [ { id: 'd1', title: 'one', note: '' }, { id: 'd2', title: 'two' } ] };
    const mine = { decisions: [ { id: 'd1', title: 'one', note: 'MY NOTE' }, { id: 'd2', title: 'two' }, { id: 'd3', title: 'mine, new' } ] };
    const theirs = { decisions: [ { id: 'd1', title: 'RETITLED', note: '' }, { id: 'd2', title: 'two' }, { id: 'd4', title: 'theirs, new' } ] };
    const r = M(base, mine, theirs);
    const by = {}; r.doc.decisions.forEach(d => by[d.id] = d);
    eq(Object.keys(by).length, 4, 'MERGE: rows added by both writers all survive');
    eq(by.d1.note, 'MY NOTE', 'MERGE: my field on a shared row is kept');
    eq(by.d1.title, 'RETITLED', 'MERGE: their field on the same row is taken');
    eq(by.d3.title, 'mine, new', 'MERGE: my new row is not dropped by the poll');
    eq(by.d4.title, 'theirs, new', 'MERGE: their new row arrives');
    eq(r.conflicts.length, 0, 'MERGE: row-level edits do not collide');
    eq(r.doc.decisions[0].id, 'd1', 'MERGE: server order leads, so rows do not jump');
  }

  // 6. Deletion by one side, untouched by the other → the deletion stands.
  {
    const base = { ideas: { i1: { t: 'a' }, i2: { t: 'b' } } };
    const r1 = M(base, { ideas: { i1: { t: 'a' } } }, { ideas: { i1: { t: 'a' }, i2: { t: 'b' } } });
    ok(!('i2' in r1.doc.ideas), 'MERGE: what I deleted stays deleted');
    const r2 = M(base, { ideas: { i1: { t: 'a' }, i2: { t: 'b' } } }, { ideas: { i1: { t: 'a' } } });
    ok(!('i2' in r2.doc.ideas), 'MERGE: what they deleted is removed here too');
    eq(r1.conflicts.length + r2.conflicts.length, 0, 'MERGE: an uncontested delete is not a conflict');
  }

  // 7. Deleted there, edited here → reported, and my edit is not thrown away.
  {
    const base = { ideas: { i1: { t: 'a' } } };
    const r = M(base, { ideas: { i1: { t: 'MY EDIT' } } }, { ideas: {} });
    eq(r.doc.ideas.i1.t, 'MY EDIT', 'MERGE: a remote delete cannot take my unsaved edit');
    eq(r.conflicts[0].kind, 'deleted-remotely', 'MERGE: delete-vs-edit is reported');
  }

  // 8. Bookkeeping fields are not content and never read as a conflict.
  {
    const r = M({ rev: 1, schemaVersion: 1, a: 1 }, { rev: 4, schemaVersion: 1, a: 1 }, { rev: 9, schemaVersion: 1, a: 2 });
    eq(r.conflicts.length, 0, 'MERGE: rev/schemaVersion never conflict');
    eq(r.doc.rev, 9, 'MERGE: the local rev counter only goes up');
    eq(r.doc.a, 2, 'MERGE: real content still merges around them');
  }

  // 9. Key ORDER is not a change. (A stringify comparison would call this one.)
  {
    const r = M({ a: 1, b: 2 }, { b: 2, a: 1 }, { a: 1, b: 3 });
    eq(r.conflicts.length, 0, 'MERGE: reordered keys are not edits');
    eq(r.doc.b, 3, 'MERGE: the real change still lands');
  }

  // 10. The guarantee, stated once: whatever else happens, mine is still there.
  {
    const base = { a: { v: 1 }, list: [ { id: 'r1', n: 1 } ] };
    const mine = { a: { v: 1, mineOnly: 'KEEP ME' }, list: [ { id: 'r1', n: 1, mineOnly: 'KEEP ME' }, { id: 'r2', n: 2 } ] };
    const theirs = { a: { v: 2 }, list: [ { id: 'r1', n: 7 } ], theirsOnly: 1 };
    const r = M(base, mine, theirs);
    eq(r.doc.a.mineOnly, 'KEEP ME', 'MERGE: no local key is lost to a server document');
    eq(r.doc.list.find(x => x.id === 'r1').mineOnly, 'KEEP ME', 'MERGE: no local field is lost inside a shared row');
    ok(r.doc.list.some(x => x.id === 'r2'), 'MERGE: no local row is lost');
    eq(r.doc.a.v, 2, 'MERGE: and the server changes still arrive');
    eq(r.doc.theirsOnly, 1, 'MERGE: including keys only they have');
  }

  // 11. deepEq underpins all of it — cheap sanity that it is structural.
  ok(G.Store.deepEq({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), 'MERGE: deepEq matches by structure');
  ok(!G.Store.deepEq({ a: 1 }, { a: 1, b: undefined }), 'MERGE: deepEq counts an extra key');
  ok(G.Store.deepEq([], []), 'MERGE: deepEq handles empty arrays');
})();

/* ─── COLLISION NOTICES: the four things the lock layer failed to SAY ───
   Reported against multi-user editing, Sep 2026, and all four are about the
   gap between what the machinery knew and what a person on the screen could
   find out:

     1. a released lock freed the FIELDS but not the VALUES — for up to one
        poll the other person's work was in the database and the older copy was
        on screen, editable, so the collision the lock prevented happened a
        second after it cleared;
     2. "you overwrote something" named neither the field nor the value, and
        the person whose saved edit was replaced was told nothing at all;
     3. "Locked · X is editing" was one small line beside a field that is
        usually off-screen;
     4. and on step 1.1's AI Innovation Audit that line was inserted INSIDE the
        row, which is display:flex, so it became a row item and shoved the
        name box sideways.

   The machinery is unchanged. What is new is a ledger of what this browser
   sent, a settling state on release, and two surfaces that name things.      */
(function () {
  const _snap = JSON.stringify(G.data);

  /* ── 1. the leaf walk: what one save actually wrote ── */
  (function () {
    const before = { purpose: { mission: 'old', goals: 'g' }, audit: [{ name: 'a' }] };
    const after = { purpose: { mission: 'new', goals: 'g' }, audit: [{ name: 'a' }] };
    const d = G.Store.leafDiff(before, after);
    eq(d.length, 1, 'NOTICE: the leaf walk reports one changed field, not the whole record');
    eq(d[0].path, '.purpose.mission', 'NOTICE: and names it by its document path');
    eq(d[0].to, 'new', 'NOTICE: carrying the value that was written');

    eq(G.Store.leafDiff({ a: 1 }, { a: 1 }).length, 0, 'NOTICE: an identical document is not a change');
    eq(G.Store.leafDiff({ rev: 1, schemaVersion: 2, a: 1 }, { rev: 9, schemaVersion: 2, a: 1 }).length, 0,
      'NOTICE: rev and schemaVersion are bookkeeping, never reported as edits');

    // Record arrays are walked per row, so one row's field is one line.
    const rd = G.Store.leafDiff(
      { decisions: [{ id: 'd1', title: 'x' }, { id: 'd2', title: 'y' }] },
      { decisions: [{ id: 'd1', title: 'X!' }, { id: 'd2', title: 'y' }] });
    eq(rd.length, 1, 'NOTICE: a record array is walked by row, not replaced whole');
    ok(/\[d1\]\.title$/.test(rd[0].path), 'NOTICE: the row is addressed by its id');
  })();

  /* ── 2. the replacement nobody was told about ──
     I save; somebody holding an older copy saves over it. On my next poll base
     and mine agree (mine IS saved), so the merge takes theirs as "only they
     moved it" and says nothing. The ledger is what turns that into news. */
  (function () {
    G.Store.forgetAuthored();
    const confirmed = { purpose: { mission: 'the old one' } };
    const sent = { purpose: { mission: 'MY SENTENCE' } };
    G.Store.noteAuthored(confirmed, sent);
    ok(G.Store.authoredCount() >= 1, 'NOTICE: a save is remembered as this browser own work');

    // Their document, holding an older copy, arrives and wins the merge.
    const theirs = { purpose: { mission: 'THEIR SENTENCE' } };
    const over = G.Store.authoredOverwrites(sent, theirs);
    eq(over.length, 1, 'NOTICE: a saved edit replaced by someone else is detected');
    eq(over[0].lost, 'MY SENTENCE', 'NOTICE: and the report carries the text that was lost');
    eq(over[0].incoming, 'THEIR SENTENCE', 'NOTICE: alongside the value that replaced it');

    // Said once. A second poll of the same document is not a second event.
    eq(G.Store.authoredOverwrites(sent, theirs).length, 0, 'NOTICE: the same replacement is reported once');

    // If I have typed over it myself since, it is not their doing.
    G.Store.forgetAuthored();
    G.Store.noteAuthored(confirmed, sent);
    eq(G.Store.authoredOverwrites({ purpose: { mission: 'I MOVED ON' } }, theirs).length, 0,
      'NOTICE: a value I have since changed myself is not reported as theirs');

    // And an adoption that changes nothing of ours says nothing.
    G.Store.forgetAuthored();
    G.Store.noteAuthored(confirmed, sent);
    eq(G.Store.authoredOverwrites(sent, sent).length, 0, 'NOTICE: an adoption that agrees with us is silent');
    G.Store.forgetAuthored();
  })();


  /* ── 2b. and the whole path, not only the parts ──
     The ledger, the question and the report can each be right while nothing
     joins them: an ARRIVING document is what has to produce the notice. So this
     drives the take-in path itself.

     Run against a scratch organization rather than the one on screen, because
     adoptDoc() writes the mirror and the baseline and repaints, and none of that
     belongs in the middle of another test's fixture. It also puts the case in
     its exact shape, which is the point: my edit is already SAVED, so base and
     mine agree, so the merge takes theirs as "only they moved it" and reports no
     conflict at all. That is the silence this ledger exists to break. */
  (function () {
    const org = 'org-notice-probe';
    const _oro = G.onRemoteOverwrite;
    const _osc = G.onSyncConflict;
    let told = null, conflicted = null;
    /* reportOverwrites() also warns to the console, which is right in a browser
       and noise in a green test run. */
    const _warn = console.warn; console.warn = () => { };
    G.onRemoteOverwrite = (items) => { told = items; };
    G.onSyncConflict = (c) => { conflicted = c; };
    try {
      const confirmed = { purpose: { mission: 'the old one' } };
      const sent = { purpose: { mission: 'MY SENTENCE' } };

      // My edit, saved and confirmed: the mirror and the baseline both say it.
      G.Store.writeOrg(org, JSON.parse(JSON.stringify(sent)));
      G.Store.adoptDoc(org, JSON.parse(JSON.stringify(sent)), 5);
      G.Store.forgetAuthored();
      G.Store.noteAuthored(confirmed, sent);
      conflicted = null;

      // Their document arrives. They were holding the OLD copy.
      G.Store.adoptDoc(org, { purpose: { mission: 'THEIR SENTENCE' } }, 6);

      ok(!!told && told.length === 1, 'NOTICE: a document landing on our saved edit raises the notice');
      eq((told || [{}])[0].lost, 'MY SENTENCE', 'NOTICE: naming the sentence that was lost');
      eq((told || [{}])[0].incoming, 'THEIR SENTENCE', 'NOTICE: and the one that replaced it');
      eq(conflicted, null, 'NOTICE: the merge itself sees no conflict here — which is why the ledger is needed');
      eq(((G.Store.readOrg(org) || {}).purpose || {}).mission, 'THEIR SENTENCE',
        'NOTICE: and their value still stands — telling the user is not undoing it');
    } finally {
      G.onRemoteOverwrite = _oro;
      G.onSyncConflict = _osc;
      console.warn = _warn;
      G.Store.forgetAuthored();
      try { G.Store.removeOrg(org); } catch (e) { }
    }
  })();

  /* ── 3. a conflict can now be undone, so it must say WHERE ──
     The panel offers to put the other person's value back, which needs the
     path as data rather than as a display string. */
  (function () {
    const base = { purpose: { mission: 'base' } };
    const mine = { purpose: { mission: 'MINE' } };
    const theirs = { purpose: { mission: 'THEIRS' } };
    const r = G.Store.mergeDocs(base, mine, theirs);
    eq(r.conflicts.length, 1, 'NOTICE: the collision is still reported');
    ok(Array.isArray(r.conflicts[0].keys), 'NOTICE: and now carries the path as keys, so it can be restored');
    eq(r.conflicts[0].keys.join('/'), 'purpose/mission', 'NOTICE: the keys address the field exactly');

    const rowBase = { decisions: [{ id: 'd1', t: 'b' }] };
    const rowMine = { decisions: [{ id: 'd1', t: 'MINE' }] };
    const rowTheirs = { decisions: [{ id: 'd1', t: 'THEIRS' }] };
    const rr = G.Store.mergeDocs(rowBase, rowMine, rowTheirs);
    eq(rr.conflicts.length, 1, 'NOTICE: a contested row field is one conflict');
    eq(JSON.stringify(rr.conflicts[0].keys), '["decisions",{"id":"d1"},"t"]',
      'NOTICE: a row is addressed by id in the keys, not by position');
  })();

  /* ── 4. saying it in words a reader recognises ── */
  (function () {
    eq(G.collabPathLabel('.purpose.mission'), 'Purpose (1.1) › Mission',
      'NOTICE: a path becomes the record screen name and the field');
    eq(G.collabPathLabel('.audit'), 'AI Innovation Audit (1.1)',
      'NOTICE: the audit is named as step 1.1 calls it');
    eq(G.collabPathLabel('.decisions[d1].title'), 'Decision Rights (1.1) › Title',
      'NOTICE: row ids are dropped, they identify nothing to a reader');
    eq(G.collabPathLabel('.projects.3.objectives'), 'Projects › Objectives',
      'NOTICE: so are array indexes');
    eq(G.collabPathLabel('.someNewThing.subKey'), 'Some New Thing › Sub Key',
      'NOTICE: an unlisted key still reads as words, never as punctuation');

    eq(G.collabValueText(''), '(empty)', 'NOTICE: cleared is stated, not shown blank');
    eq(G.collabValueText([1, 2, 3]), '3 rows', 'NOTICE: a list is summarised by size');
    eq(G.collabValueText(true), 'Yes', 'NOTICE: a flag reads as a word');
    eq(G.collabValueText('x'.repeat(400)).length, 221, 'NOTICE: long text is cut, not dumped into the panel');
  })();

  /* ── 4b. every program's document keys have a NAME ──
     collabPathLabel() falls back to spacing out the camelCase key, which is a
     reasonable last resort and a poor label: Executive Readiness's document
     alone produced "Values Arch", "Mm Activation", "Op Rhythm" and "Dep Scan".
     A conflict notice naming a record like that tells the reader less than the
     path did.

     So the table is swept against the real documents. The other two Enterprise
     programs are not loaded in this realm — the harness boots the Pipeline —
     so their emptyData() is read off disk, the same way this file already reads
     shell.html and catalogue.json for the load order. A new top-level key in
     any of the three reds this until somebody names it. */
  (function () {
    const path = require('path'), fs = require('fs');
    const ROOT = path.resolve(__dirname, '..', '..');
    const src = fs.readFileSync(path.join(ROOT, 'js', 'features', 'collab-notices.js'), 'utf8');
    const open = src.indexOf('COLLAB_RECORD_LABELS = {');
    const block = src.slice(open, src.indexOf('\n};', open));
    const labelled = new Set([...block.matchAll(/(?:^|[{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m => m[1]));
    ok(labelled.size > 20, 'LABELS: the record-label table was found and parsed');

    const fromModule = (rel) => {
      let s = '';
      try { s = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return null; }
      const m = /emptyData: function \(\) \{[\s\S]*?\n    \}/.exec(s);
      if (!m) return null;
      /* Top-level keys only, as the Pipeline's check below reads Object.keys: a nested
         literal (settings: { aiGuide, voice }, 7 Oct 2026) is one record, not three. */
      const body = m[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const at = body.indexOf('return {'); if (at < 0) return null;
      let depth = 0, top = '';
      for (const ch of body.slice(at + 7)) { if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') { depth--; if (depth === 0) break; } else if (depth === 1) top += ch; }
      return [...top.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(x => x[1]);
    };

    [['Responsible AI Governance', 'js/modules/ai-governance/module.js'],
    ['Executive Readiness', 'js/modules/exec-readiness/module.js']].forEach(([name, rel]) => {
      const keys = fromModule(rel);
      if (!keys || !keys.length) { ok(false, 'LABELS: could not read ' + name + '’s emptyData()'); return; }
      const missing = keys.filter(k => !labelled.has(k));
      ok(missing.length === 0,
        'LABELS: every ' + name + ' record has a screen name' +
        (missing.length ? ' — unnamed: ' + missing.join(', ') : ''));
    });

    /* And the Pipeline's, which IS loaded here, so it is asked of the running
       program rather than of its source. */
    const mine = Object.keys(G.Modules.emptyData() || {});
    const missingMine = mine.filter(k => !labelled.has(k));
    ok(missingMine.length === 0,
      'LABELS: every AI Innovation Pipeline record has a screen name' +
      (missingMine.length ? ' — unnamed: ' + missingMine.join(', ') : ''));
  })();

  /* ── 5. the marker may not push a row about ──
     lockMarkTarget answers "before which element does the caption go". Inside a
     flex or grid row the answer is the ROW; anywhere else it is the field, which
     is what it always was. Built on plain objects with a stubbed
     getComputedStyle, because the point of the function IS the layout question
     and the test DOM has no layout. */
  (function () {
    const rootEl = { tag: 'root' };
    const mk = (display, parent) => ({ _d: display, parentNode: parent });
    const _gcs = G.getComputedStyle;
    G.getComputedStyle = (n) => ({ display: (n && n._d) || '' });
    try {
      // step 1.1's audit row: input inside .u-820b58c { display:flex }
      const row = mk('flex', mk('block', rootEl));
      const input = mk('inline-block', row);
      eq(G.lockMarkTarget(input, rootEl), row,
        'NOTICE: in a flex row the caption goes above the ROW, not inside it');

      // an ordinary stacked field is unchanged
      const plain = mk('inline-block', mk('block', rootEl));
      eq(G.lockMarkTarget(plain, rootEl), plain,
        'NOTICE: a field in a normal block keeps the old placement');

      // a grid cell hoists too
      const cell = mk('inline-block', mk('grid', mk('block', rootEl)));
      eq(G.lockMarkTarget(cell, rootEl)._d, 'grid',
        'NOTICE: a grid row hoists the caption the same way');

      // and it cannot climb out of the page
      let deep = rootEl;
      for (let i = 0; i < 9; i++) deep = mk('flex', deep);
      const buried = mk('inline-block', deep);
      ok(!!G.lockMarkTarget(buried, rootEl), 'NOTICE: the climb is bounded and always answers something');
    } finally { G.getComputedStyle = _gcs; }
  })();

  /* ── 6. a released lock does not go live until the values have arrived ──
     The whole point of the first report: unlocking used to hand back fields
     still showing the older document. applyLockUI now spots the release, holds
     the fields, and asks the store. */
  (function () {
    const lk = 'pipeline-locks::' + G.currentOrgId;
    const _cr = G.Store.checkRemote;
    let asked = 0;
    G.Store.checkRemote = function () { asked++; return false; };
    try {
      localStorageStub.setItem(lk, JSON.stringify({ audit: { id: 'other-user', name: 'Ravi Menon', at: Date.now() } }));
      G.applyLockUI(true);
      ok(!!G.Collab.lockedByOther('audit'), 'NOTICE: the fixture lock is held by someone else');

      localStorageStub.removeItem(lk);           // they let go
      G.applyLockUI(true);
      eq(asked, 1, 'NOTICE: letting go asks the store for their changes at once, not on the next poll');
    } finally {
      G.Store.checkRemote = _cr;
      localStorageStub.removeItem(lk);
      try { G.applyLockUI(true); } catch (e) { }
    }
  })();


  /* ── 6b. and the window REFUSES writes, not just typing ──
     Disabling the field stops the keyboard. It does not stop a button — every
     "+ Add" and every row action writes through its own
     `if (Collab.lockedByOther(...)) return` guard — and during the settle window
     those would have gone through against the older document, which is the same
     lost edit the window exists to prevent. So the window lives inside
     Collab.lockedByOther() rather than beside it, and every guard in the app
     and in all twelve programs honours it without being told.

     Checked through fldSave(), which is the shell's own write path, so the
     assertion is about behaviour and not about a flag. */
  (function () {
    const before = G.data.ideas[18].desc;
    try {
      G.Collab.beginSettle(['ideas::18'], { 'ideas::18': 'Ravi Menon' });
      ok(!!G.Collab.lockedByOther('ideas::18'), 'NOTICE: a settling record still reads as held');
      eq((G.Collab.lockedByOther('ideas::18') || {}).settling, true, 'NOTICE: and says WHY it is held');
      G.fldSave('bsic_18_desc', 'WRITTEN DURING THE SETTLE');
      eq(G.data.ideas[18].desc, before, 'NOTICE: a write inside the settle window is refused, not merely disabled');
      ok(G.lockBlocked('ideas::18'), 'NOTICE: the button guard refuses it too');

      G.Collab.endSettle(['ideas::18']);
      ok(!G.Collab.lockedByOther('ideas::18'), 'NOTICE: the window closes once the changes have landed');
      G.fldSave('bsic_18_desc', 'MINE NOW');
      eq(G.data.ideas[18].desc, 'MINE NOW', 'NOTICE: and the same write then goes through');
    } finally {
      G.Collab.endSettle(['ideas::18']);
      G.data.ideas[18].desc = before;
    }
  })();

  /* ── 7. and the notices reach a surface ──
     onSyncConflict/onRemoteOverwrite decide WHAT happened; showSyncReport
     decides how it is said. The seam is checked by standing in for it, since the
     panel itself is DOM the stub cannot lay out. */
  (function () {
    const _ssr = G.showSyncReport;
    let seen = null;
    G.showSyncReport = (rows) => { seen = rows; };
    try {
      G.onSyncConflict([{ path: '.purpose.mission', keys: ['purpose', 'mission'], kind: 'both-edited', mine: 'MINE', theirs: 'THEIRS' }]);
      eq(seen.length, 1, 'NOTICE: a conflict reaches the report');
      eq(seen[0].kind, 'kept', 'NOTICE: labelled as the side that was kept');
      eq(seen[0].label, 'Purpose (1.1) › Mission', 'NOTICE: named for the reader');
      eq(seen[0].theirs, 'THEIRS', 'NOTICE: carrying the value that was overwritten');
      eq(seen[0].restore, 'THEIRS', 'NOTICE: which is what the restore button puts back');

      seen = null;
      G.onRemoteOverwrite([{ path: '.audit', keys: ['audit'], lost: [{ name: 'mine' }], incoming: [] }]);
      eq(seen[0].kind, 'replaced', 'NOTICE: a replacement is a different kind of news');
      eq(seen[0].label, 'AI Innovation Audit (1.1)', 'NOTICE: and names the record it happened to');
      eq(JSON.stringify(seen[0].restore), '[{"name":"mine"}]', 'NOTICE: restoring puts OUR value back, not theirs');

      // A deleted-remotely collision must not claim they still hold a value.
      seen = null;
      G.onSyncConflict([{ path: '.audit', keys: ['audit'], kind: 'deleted-remotely', mine: [{ name: 'x' }], theirs: undefined }]);
      eq(G.collabValueText(seen[0].theirs), '(empty)', 'NOTICE: a remote delete reads as removed, not as a value');
    } finally { G.showSyncReport = _ssr; }
  })();

  G.data = JSON.parse(_snap);
})();

/* ─── IN-PROGRESS TYPING: a sync repaint must not cost the reader a word ───
   The merge above protects the DOCUMENT. It cannot protect what has not
   reached the document yet — a sub-field that saves when focus leaves it, a
   program that harvests its page on navigation — and the repaint that follows
   an adoption rebuilds #app from the document, so that is exactly what it used
   to erase, every five seconds, whenever anyone else was working in the module.
   Three seams close it and each is pinned here.                            */
(function () {
  const _snap = JSON.stringify(G.data);

  // 1. The store asks the app whether somebody is typing, to decide how long to
  //    hold the save for. Typing gets a longer, extending window; a click does
  //    not, so a score or an Add still saves on the short one.
  G._lastInputAt = 0;
  eq(G.appIsTyping(), false, 'TYPING: an idle page is not typing');
  G._lastInputAt = Date.now();
  eq(G.appIsTyping(), true, 'TYPING: a keystroke just now is');
  G._lastInputAt = Date.now() - 5000;
  eq(G.appIsTyping(), false, 'TYPING: five seconds ago is not');
  G._lastInputAt = 0;

  // 2. A render asked for from inside a live commit is held, not run: rebuilding
  //    the page under someone mid-sentence is the thing being avoided.
  G._renderWanted = false; G._suppressRender = 1;
  G.render();
  eq(G._renderWanted, true, 'TYPING: a render inside a live commit is held');
  G._suppressRender = 0;
  G.render();
  eq(G._renderWanted, false, 'TYPING: and released by the next real render');

  // 3. The repaint puts back every field that was being typed into, and the
  //    caret with it. Only `value` fields — writing `value` on a checkbox would
  //    change what it submits rather than what it shows.
  ok(G.isValueField({ tagName: 'TEXTAREA', value: '' }), 'TYPING: a textarea is restorable');
  ok(!G.isValueField({ tagName: 'INPUT', type: 'checkbox', value: 'on' }), 'TYPING: a checkbox is not');
  ok(!G.isValueField({ tagName: 'DIV' }), 'TYPING: and neither is anything without a value');

  const box = G.document.getElementById('pjr_0');
  box.tagName = 'INPUT'; box.type = 'text'; box.value = 'half a sen';
  G._liveEdits = { pjr_0: 'half a sen' };
  G._pageEdited = true;
  box.value = 'the stored value';               // what the repaint would paint
  G.repaintAfterSync();
  eq(box.value, 'half a sen', 'TYPING: a sync repaint gives back what was being typed');
  eq(G._liveEdits.pjr_0, 'half a sen', 'TYPING: and still counts it as unbanked');
  eq(G._pageEdited, false, 'TYPING: the repainted page has nothing left to harvest');
  G._liveEdits = {};

  // 4. bankOpenPage is what puts on-screen work into the document BEFORE the
  //    merge reads it. It runs the program's harvest — and only when the reader
  //    actually typed, or a page they merely looked at would write the values it
  //    happens to be showing back over a colleague's change.
  const _hook = G.Modules.hook; let harvested = 0;
  G.Modules.hook = (n) => (n === 'harvestOpenPage' ? (() => { harvested++; }) : _hook(n));
  G._pageEdited = false; G.bankOpenPage();
  eq(harvested, 0, 'BANK: a page nobody touched is not harvested');
  G._pageEdited = true; G.bankOpenPage();
  eq(harvested, 1, 'BANK: a page that was typed on is');
  G.Modules.hook = _hook; G._pageEdited = false;

  // 5. The funding-line boxes were the one editable surface with no id at all,
  //    so nothing could give their text back. They have one now, and it maps to
  //    the record their save already locks on.
  eq(G.idToRecordKey('fl_abc_d'), 'capital', 'TYPING: a funding-line box locks with the capital record');

  G.data = JSON.parse(_snap); G.saveData();
})();

/* ─── ASYNC BOOT LOADER (July 8): readiness seam + double-boot guard ─── */
(function(){
  let s=false; G.Store.ready(()=>{ s=true; });
  ok(s===true, 'BOOT2: Store.ready fires in the same tick locally (boot unchanged)');
  eq(typeof G.bootApp, 'function', 'BOOT2: the boot sequence is a callable unit');
  eq(G.bootApp(), false, 'BOOT2: bootApp is idempotent – a duplicate ready signal is a no-op');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'BOOT2: the rejected re-boot touched nothing');
})();

/* ─── SEED ORDER (July 8): seeding is order-independent ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  G.seedDataY2(); G.seedData();
  eq((G.data.reviewCycles||[]).length, 0, 'SEED: base seed over Y2 leaves no review-cycle residue (fixed July 8)');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'SEED: base-over-Y2 ledger is the base identity');
  eq(G.data.ideas.length, 20, 'SEED: base-over-Y2 idea count is the base count');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'SEED: restore returns the base seed identity');
})();

/* ─── RULINGS (July 8, close-out): passcode unification + literal seed overwrite ───
   The passcode half of the July 8 ruling is REVERSED. It said an empty roster
   PIN should default to 1234 through applyTeamRoster, which was reasonable while
   the roster was the credential store. It is not any more: PINs exist only as
   bcrypt hashes in the database, and Core\DocPrivacy strips them from the
   workspace document in both directions, so a blank PIN on the roster means
   "the server holds this one" and must stay blank. Minting a fake one made the
   member editor show 1234 as though it were real and then send it to
   /users/update, resetting the member's actual PIN. The literal-seed-overwrite
   half of the ruling stands untouched. */
(function(){
  const _snap = JSON.stringify(G.data);
  G.data.roster[0].passcode = ''; G.applyTeamRoster();
  ok(!('passcode' in G.USERS[0]) && !('passcode' in G.data.roster[0]), 'RULINGS: applyTeamRoster never mints a PIN — and now removes the field entirely (Directive 2 Oct 2026, 5.2.1)');
  G.data.roster[0].passcode = '1234'; G.applyTeamRoster();
  ok(!('passcode' in G.USERS[0]) && !('passcode' in G.data.roster[0]), 'AUDIT 5.2.1: a PIN cached or seeded before Part 5 is dropped from the roster');
  const _exp = G.dataWithoutPasswords({ roster: [{ id: 'x', passcode: '1', password: 'p', passwordHash: 'h', mustChange: true }], members: [{ passcode: '2' }] });
  ok(!/passcode|password|mustChange/.test(JSON.stringify(_exp)), 'AUDIT 5.8.9: Export state carries no password-bearing field');
  G.localStorage.setItem('pipeline-admin', JSON.stringify({ passcode: '4321' }));
  G.localStorage.setItem('pipeline-org-data::audit_probe', JSON.stringify({ roster: [{ id: 'a', passcode: '9999' }], ideas: [] }));
  G.scrubStoredPasswords();
  ok(G.localStorage.getItem('pipeline-admin') === null, 'AUDIT 5.2.3: the old browser-held administrator code is removed at start-up');
  ok(G.localStorage.getItem('pipeline-org-data::audit_probe').indexOf('passcode') < 0, 'AUDIT 5.8.9: cached workspaces lose any stored PIN');
  G.localStorage.removeItem('pipeline-org-data::audit_probe');
  ok(typeof G.adminCreds === 'undefined' && typeof G.setAdminCreds === 'undefined' && typeof G.Store.getAdmin === 'undefined', 'AUDIT 5.2.5: adminCreds, setAdminCreds and the stored admin record are gone');
  G.data.notifications = [{at:1,kind:'x',subject:'JUNK',to:['a'],status:'x'}];
  G.data.remind7 = {'9.9':true}; G.data.archivedItems = {'5':true};
  G.data.chatMsgs = [{who:'F',name:'X',ts:1,text:'JUNK'}];
  G.saveData(); G.seedData();
  ok((G.data.notifications||[]).length===0 && !Object.keys(G.data.remind7||{}).length
     && !Object.keys(G.data.archivedItems||{}).length && JSON.stringify(G.data.chatMsgs||[]).indexOf('JUNK')<0,
     'RULINGS: re-seeding clears notifications, reminders, and archives, and replaces chat with the seed conversation (overwrite is literal)');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'RULINGS: the cleared re-seed lands on the base identity');
  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
  ok(!G.USERS[0].passcode, 'RULINGS: roster and session state restored for downstream blocks (and the roster carries no password — Directive 2 Oct 2026, Part 5)');
})();

/* ─── TEMPORARY PASSWORDS: the Team member editor (Directive 2 Oct 2026, Part 5.7) ───
   An administrator never sees or keeps a member's password. Adding someone they
   give a temporary one (required); editing someone, empty leaves the password
   alone. It is never put back on screen, never travels with the profile, and is
   sent once, separately, to POST /admin/temporary-password. Your own password is
   Change password, so your own editor has no such field (5.10). */
(function(){
  const _snap = JSON.stringify(G.data);
  const _modal = G.currentModal, _edit = G.UI.orgEdit, _admin = G.isAppAdmin;
  const u = G.USERS.filter(x => x.id !== G.currentUserId)[0];
  G.isAppAdmin = true;   /* an administrator's editor */

  const shown = (who, serverId) => {
    who.serverId = serverId;
    who.passcode = '4321';                 // whatever is in memory must not surface
    G.currentModal = 'org'; G.UI.orgEdit = who.id; G.UI.orgEditErrors = {}; G.UI.orgEditBusy = false;
    G.renderOrgModal();
    const html = G.document.getElementById('modalRoot').innerHTML || '';
    const m = new RegExp('<input[^>]*id="ru_' + who.id + '_temporary"[^>]*>').exec(html);
    return { input: m ? m[0] : '', html };
  };

  const existing = shown(u, 'usr_known');
  ok(existing.input !== '', 'TEMP PW 5.7: an administrator editing someone sees a Temporary password field');
  ok(/type="password"/.test(existing.input) && /autocomplete="new-password"/.test(existing.input), 'TEMP PW: it is a password field');
  ok(existing.input.indexOf('4321') < 0 && existing.input.indexOf('value=""') >= 0, 'TEMP PW: it opens empty and never echoes anything');
  ok(existing.input.indexOf('Leave empty to keep their password') >= 0, 'TEMP PW: for an existing member, empty means unchanged — and says so');
  ok(existing.html.indexOf('At least 8 characters, including a number and a special character such as ! or #.') >= 0, 'TEMP PW 5.1: the rule is stated under it');
  ok(existing.html.indexOf('choose their own password the next time they sign in') >= 0, 'TEMP PW 5.7: and what happens next');
  ok(existing.html.indexOf('_passcode"') < 0, 'TEMP PW: no Passcode field is left');

  const meU = G.getCurrentUser();
  const mine = meU ? shown(meU, meU.serverId || 'usr_me') : { input: '' };
  ok(!!meU && mine.input === '', 'TEMP PW 5.10: your own editor has no temporary password (yours is Change password)');

  const full = {name:'A Member', username:'amember', role:'Lead', scope:'All', email:'a@b.com', dept:'Ops', temporary:''};
  ok(!G.validateMemberFields(full, u.id, false).temporary, 'TEMP PW: empty is accepted for an existing member');
  ok(!!G.validateMemberFields(full, u.id, true).temporary,  'TEMP PW 5.7.2: empty is refused for a new member');
  ok(!!G.validateMemberFields(Object.assign({}, full, {temporary:'1234'}), u.id, false).temporary, 'TEMP PW 5.1: a typed one must meet the rule');
  ok(!G.validateMemberFields(Object.assign({}, full, {temporary:'Harbour!Lamp42'}), u.id, true).temporary, 'TEMP PW: a good one passes');

  u.passcode = '5678'; u.temporary = 'x';
  const p = G.memberPayload(u);
  ok(!('passcode' in p) && !('password' in p) && !('temporary' in p), 'TEMP PW 6.1.2: no password ever travels with a profile');

  G.currentModal = _modal; G.UI.orgEdit = _edit; G.isAppAdmin = _admin;
  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
})();

/* ─── INSIGHTS (July 9, sweep item 1): page renders, tabs switch ───
   Insights moved to the per-screen module pattern: templates/insights.html
   carries the static hero + tab bar + section slots, and js/insights.js
   fills the [data-slot] lists from arrays that now live INSIDE the module
   IIFE. Its documented public API is renderInsights(container) alone —
   insightsTab / setInsightsTab / LATEST_THOUGHTS / CONVERGENCE_EPISODES /
   WORTH_YOUR_TIME / INSIGHT_SOURCES are deliberately private, and
   Screens.mount() is async and gated on a signed-in user, so the old
   "call it, get a string back" pins cannot be re-expressed against a
   synchronous stub DOM. What IS observable is re-pinned below; the
   card-content assertions need a real DOM (see the harness TODO). */
(function(){
  const _snap = JSON.stringify(G.data);
  eq(typeof G.renderInsights, 'function', 'INSIGHTS: renderInsights(container) is the screen module public API');
  noThrow(() => G.renderInsights(G.document.getElementById('app')), 'INSIGHTS: mounting the screen does not throw');
  const tpl = (G.__LOCAL_TEMPLATES || {}).insights || '';
  ok(tpl.length > 500, 'INSIGHTS: the insights screen template ships in the local bundle');
  has(tpl, 'data-itab="latest"', 'INSIGHTS: the latest tab is present in the shipped template');
  has(tpl, 'data-itab="conversations"', 'INSIGHTS: the conversations tab is present in the shipped template');
  has(tpl, 'data-itab="worth"', 'INSIGHTS: the worth-your-time tab is present in the shipped template');
  has(tpl, 'data-slot="latest"', 'INSIGHTS: the latest list has a hydration slot');
  has(tpl, 'data-slot="conversations"', 'INSIGHTS: the conversations list has a hydration slot');
  has(tpl, 'data-slot="worth"', 'INSIGHTS: the worth-your-time list has a hydration slot');
  G.seedDataY2();
  noThrow(() => G.renderInsights(G.document.getElementById('app')), 'INSIGHTS: mounting under the Y2 fixture does not throw');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'INSIGHTS: restore returns the base identity');
})();

/* ─── REFRESH (July 9, sweep item 2): recheck path agrees with its render twin ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _page = G.currentPage, _step = G.currentStep, _sec = G.UI.sec, _qs = G.document.querySelector;
  const btn = {disabled:'unset', style:{}}, helper = {style:{}};
  G.document.querySelector = function(sel){ return sel==='.done-btn' ? btn : (sel==='.done-helper' ? helper : _qs(sel)); };
  G.currentPage = 'step';

  /* 2a — 4.1: overdue undecided phase disables Done on BOTH paths; deciding the gate arms both */
  const exp = (G.getStages().experiment||[]).filter(function(i){ return !G.isArchived(i) && ((G.data.tracking||{})[i]||{}).status !== 'killed'; });
  ok(exp.length >= 2, 'REFRESH: base seed provides two live development items to work with');
  const i = exp[0];
  G.data.expSelected = [i];
  if (G.data.completedSteps) { delete G.data.completedSteps['4.1']; delete G.data.completedSteps['4.4']; }
  const rows = G.progOrdered(i);
  ok(rows.length >= 1, 'REFRESH: item carries dev plan rows');
  rows.forEach(function(r, x){ if (x === 0) { r.from='1'; r.to='1'; delete r.gateDec; r.pstatus='running'; } else { r.gateDec='go'; r.pstatus='complete'; } });
  ok(G.progOverdue(i) > 0, 'REFRESH 2a: constructed state is overdue-undecided');
  has(G.renderStep41(), 'Record the gate decision', 'REFRESH 2a: render path disables Done (helper present) while a gate is overdue');
  G.currentStep = '4.1'; btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, true, 'REFRESH 2a: recheck path agrees — a field-save leaves Done disabled while a gate is overdue');
  rows[0].gateDec = 'go';
  ok(G.progOverdue(i) === 0 && G.progArmed(i), 'REFRESH 2a: deciding the gate clears overdue and arms the program');
  ok(G.renderStep41().indexOf('Record the gate decision') < 0, 'REFRESH 2a: render path enables Done once gates are current');
  btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, false, 'REFRESH 2a: recheck path agrees — the same field-save now arms Done');

  /* 2b — 4.4: an archived undecided item blocks Done in NEITHER path */
  const k = exp[1];
  G.data.expSelected = [i, k];
  G.data.selected = [];
  if (!G.data.review) G.data.review = {};
  G.data.review.items = {}; G.data.review.items[i] = {decision:'hold'};
  if (!G.data.archivedItems) G.data.archivedItems = {};
  G.data.archivedItems[k] = {stage:'experiment'};
  ok(G.renderStep44().indexOf('Decide Buy, Sell, or Hold') < 0, 'REFRESH 2b: render path — archived undecided item does not block Done');
  G.currentStep = '4.4'; btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, false, 'REFRESH 2b: recheck path agrees — archived undecided item does not jam Done on a field-save');

  /* 2c — 1.4 (ruled July 9): an empty audit is a valid completion on BOTH paths */
  G.data.audit = [];
  if (G.data.completedSections) delete G.data.completedSections['1.4'];
  G.currentStep = '1.1'; G.UI.sec = '1.4';
  ok(G.renderStep11().indexOf('done-helper') < 0, 'REFRESH 2c: render path — sub-1.4 Done is enabled with zero audit rows');
  btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, false, 'REFRESH 2c: recheck path agrees — empty audit satisfies 1.4');
  G.saveSection14();
  eq(!!(G.data.completedSections||{})['1.4'], true, 'REFRESH 2c: completing with an empty audit marks the section complete');

  G.document.querySelector = _qs; G.currentPage = _page; G.currentStep = _step; G.UI.sec = _sec;
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'REFRESH: restore returns the base identity');
})();

/* ─── ADMIN GUARDS (July 9, sweep items 3-4): colorless avatars, delete-current-org ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const av = noThrow(() => G.userAv({initials:'X'}), 'ADMIN: userAv survives a record with no color');
  has(av, '#888888', 'ADMIN: colorless avatar falls back to the neutral swatch');
  G.data.roster.push({id:'qa_nocolor', name:'No Color', initials:'NC'});
  G.saveData();
  const _cm0 = G.currentModal; G.currentModal = 'admin';
  noThrow(() => G.renderAdminModal(), 'ADMIN: the admin console survives an org containing a colorless user');
  G.currentModal = _cm0;
  /* The admin console is database-backed now: the org list arrives from
     GET /organizations into UI.adminData, rows are keyed by the DATABASE
     public id (not the local registry id), and the delete posts to
     /organizations/delete rather than touching Store. So the guard is
     driven through that seam. The rule itself is unchanged (July 9):
     you cannot delete the org you are currently in. */
  const _adminData = G.UI.adminData;
  // getOrg() hands back a fresh copy off the store each call, so the serverId
  // link has to be written back through saveOrgs() to stick.
  const _orgs0 = JSON.parse(JSON.stringify(G.getOrgs()));
  G.saveOrgs(G.getOrgs().map(function(o){
    return o.id === G.currentOrgId ? Object.assign({}, o, { serverId:'srv-current' }) : o;
  }));
  G.UI.adminData = [
    { id:'srv-current', name:'Harness Org',  created_at:'2026-07-01 09:00:00',
      users:[{ public_id:'u1', name:'Owner', username:'owner', is_admin:true }] },
    { id:'srv-other',   name:'QA Guard Org', created_at:'2026-07-02 09:00:00',
      users:[{ public_id:'u2', name:'Guard', username:'guard', is_admin:true }] }
  ];
  eq(G.orgServerId(), 'srv-current', 'ADMIN: the current org resolves to its database id');
  const _cm = G.currentModal; G.currentModal = 'admin';
  G.renderAdminModal();
  const modal = G.document.getElementById('modalRoot').innerHTML || '';
  G.currentModal = _cm;
  ok(modal.indexOf("adminDeleteOrg('srv-current')") < 0, 'ADMIN: the current org row renders no delete control');
  ok(modal.indexOf("adminDeleteOrg('srv-other')") >= 0, 'ADMIN: other org rows keep their delete control');
  const _ia10 = G.isAppAdmin; G.isAppAdmin = true;   /* Sweep 4R item 10: the console's functions are the app administrator's */
  alerts.length = 0;
  G.adminDeleteOrg('srv-current');
  eq(alerts.length, 1, 'ADMIN: deleting the current org is blocked (ruled July 9) — one explanation, no request');
  has(alerts[0], "can't delete the organization you're currently in", 'ADMIN: the block explains itself');
  eq(G.UI.adminData.length, 2, 'ADMIN: the blocked delete left the org list untouched');
  alerts.length = 0;
  G.adminDeleteOrg('srv-other');
  ok(alerts.every(function(m){ return m.indexOf('currently in') < 0; }),
     'ADMIN: a non-current org clears the guard (guard is narrow) — it only fails past it because the harness has no server');
  G.isAppAdmin = _ia10;
  G.UI.adminData = _adminData;
  G.saveOrgs(_orgs0);
  G.data = JSON.parse(_snap); G.saveData();
})();

/* ─── REVIVE (July 9, sweep item 5): noGo revive returns to bluesky, not to the void ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const bl = G.getStages().bluesky.slice(), ng = G.getStages().noGo.slice();
  ok(ng.length >= 1 && bl.length >= 1, 'REVIVE: base seed provides noGo and bluesky items');
  const b = bl[0];
  G.archiveItem(b); G.reviveItem(b);
  ok(G.getStages().bluesky.indexOf(b) >= 0, 'REVIVE: bluesky-archived revive behavior is unchanged');
  const n = ng[0];
  G.archiveItem(n);
  eq(((G.data.archivedItems||{})[n]||{}).stage, 'noGo', 'REVIVE: archive records the noGo stage');
  G.reviveItem(n);
  ok(G.getStages().bluesky.indexOf(n) >= 0, 'REVIVE: a noGo revive lands the item in bluesky');
  ok((G.data.selected||[]).indexOf(n) < 0, 'REVIVE: the revived item is out of selected');
  ok(!(G.data.projects||{})[n], 'REVIVE: the revived item carries no stale project verdict');
  G.toggleSelect(n);
  ok((G.data.selected||[]).indexOf(n) >= 0, 'REVIVE: the item is re-selectable on 1.3');
  eq(((G.data.projects||{})[n]||{}).viable, undefined, 'REVIVE: re-selection arrives at 2.4 unresolved via a fresh slate');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'REVIVE: restore returns the base identity');
})();

/* ─── KILLTIME (July 9, sweep item 6): gate-path kills never convert unspent to spent ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const rows = G.bpRows(13, 'dev');
  ok(rows.length >= 2, 'KILLTIME: item 13 carries a multi-row dev plan');
  rows.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; });
  if (G.data.tracking && G.data.tracking[13]) { G.data.tracking[13].status = ''; delete G.data.tracking[13].killSunkIds; }

  /* flow rule: an unstarted phase's gate offers no Kill */
  const ui0 = G.progGateUI(13, rows[0], false);
  ok(ui0.indexOf("'go'") >= 0 && ui0.indexOf("'recycle'") >= 0, 'KILLTIME: unstarted gate still offers Go and Recycle');
  ok(ui0.indexOf("'kill'") < 0, 'KILLTIME: unstarted gate offers no Kill (flow rule, July 9)');
  ok(ui0.indexOf('Kill opens the kill panel') < 0, 'KILLTIME: the gate copy drops the Kill sentence with the button');
  rows[0].pstatus = 'running';
  const ui1 = G.progGateUI(13, rows[0], false);
  ok(ui1.indexOf("'kill'") >= 0 && ui1.indexOf('Kill opens the kill panel') >= 0, 'KILLTIME: a running phase offers Kill, copy restored');

  /* accounting rule: disclosed preview equals post-confirm reality on a gate-path kill */
  const pv = G.killReleasePreview(13);
  const enteredIds = pv.phases.filter(function(p){ return p.entered; }).map(function(p){ return p.id; });
  eq(JSON.stringify(enteredIds), '["bp13a"]', 'KILLTIME: preview discloses exactly the running phase as entered');
  const before = G.capCommitments().total;
  G.document.getElementById('kd_13').value = ''; G.document.getElementById('ka_13').value = '';
  G.progGate(13, 'bp13a', 'kill');
  eq(G.UI.expanded['kp13'], 'bp13a', 'KILLTIME: the gate Kill routes to the confirm panel');
  G.progKillConfirm(13);
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), JSON.stringify(enteredIds), 'KILLTIME: killSunkIds equals the disclosed entered set — the decision itself sinks nothing');
  eq(G.bpRows(13, 'dev')[0].gateDec, 'kill', 'KILLTIME: the gate record still ends kill-decided');
  const after = G.capCommitments().total;
  ok(Math.abs((before - after) - pv.released) <= 1, 'KILLTIME: the ledger drop equals the disclosed released figure');

  /* unchanged paths: status-select kill and review Sell */
  G.fldSave('trk_13_status', '', true);
  ok(!G.data.tracking[13].killSunkIds, 'KILLTIME: un-kill clears the frozen set (prior behavior)');
  delete G.bpRows(13, 'dev')[0].gateDec; delete G.bpRows(13, 'dev')[0].gateAt;
  G.fldSave('trk_13_status', 'killed', true);
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'KILLTIME: the status-select kill freezes the entered set as before');
  G.fldSave('trk_13_status', '', true);
  G.UI.reviewSellPending = 13; G.UI.expanded['kp13'] = true;
  G.progKillConfirm(13);
  eq(((G.data.review||{}).items||{})[13] && G.data.review.items[13].decision, 'sell', 'KILLTIME: the review Sell path records the decision as before');
  ok(!G.bpRows(13, 'dev')[0].gateDec, 'KILLTIME: a Sell-path kill writes no gate record');
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'KILLTIME: the Sell-path kill freezes the same entered set');

  delete G.UI.reviewSellPending; G.UI.expanded['kp13'] = false;
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'KILLTIME: restore returns the base identity');
})();

/* ─── SEEDROSTER (July 9, sweep items 7-8): F3 resets the roster; admins are flag-based ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  /* dirty the roster the way a testing session does */
  const su2 = G.data.roster.filter(function(u){ return u && u.id === 'su2'; })[0];
  ok(!!su2, 'SEEDROSTER: canonical member present before the test');
  su2.name = 'Renamed In Testing';
  const su3 = G.data.roster.filter(function(u){ return u && u.id === 'su3'; })[0];
  su3.email = 'left-over@aurora.example';
  G.data.roster.push({id:'qa_stray', name:'Stray Tester', username:'stray', role:'Domain Administrator', initials:'ST'});
  G.saveData();
  const adminCount = G.data.roster.filter(function(u){ return u && u.admin === true; }).length;
  ok(adminCount >= 1, 'SEEDROSTER: the org carries a flagged administrator account');
  G.seedData();
  eq(G.data.roster.length, adminCount + 8, 'SEEDROSTER: F3 base returns admin account(s) + su1-su8, nothing else');
  eq(G.data.roster.filter(function(u){ return u && u.id === 'su2'; })[0].name, 'Harriet Rivers', 'SEEDROSTER: a testing-session rename does not survive the reseed');
  ok(!G.data.roster.filter(function(u){ return u && u.id === 'su3'; })[0].email, 'SEEDROSTER: a testing-session email edit does not survive');
  ok(!G.data.roster.some(function(u){ return u && u.id === 'qa_stray'; }), 'SEEDROSTER: a stray member does not survive');
  /* dirty again, prove the same through the Y2 order */
  G.data.roster.push({id:'qa_stray2', name:'Stray Two', username:'stray2', role:'Tester', initials:'S2'});
  G.saveData();
  G.seedDataY2();
  eq(G.data.roster.length, adminCount + 8, 'SEEDROSTER: F3 Year-2 resets the roster identically (shared buildSeedBase)');
  ok(!G.data.roster.some(function(u){ return u && u.id === 'qa_stray2'; }), 'SEEDROSTER: the Y2 order drops strays too');

  /* item 8 was "the flag is the rule, role text is cosmetic" (ruled 9 Jul 2026).
     SUPERSEDED by the notification directive of 3 Sep 2026, Part 4 correction B:
     a deadline reminder now also reaches anyone whose ROLE TEXT contains
     "admin", because that is how the Governance app had always behaved and the
     family is brought into line with it. The flag still qualifies on its own,
     so the organization's creator can never drop off reminders. */
  G.seedData();
  G.applyTeamRoster();
  const admins = G.notifyAdmins();
  ok(admins.length >= 1, 'SEEDROSTER: notifyAdmins finds at least the flagged account');
  ok(admins.every(function(u){ return u && (u.admin === true || /admin/i.test(u.role || '')); }),
     'SEEDROSTER: and nobody who is neither flagged nor titled an admin');
  /* The case the directive names in its own acceptance test 4: a member whose
     role text says Administrator but whose flag is NOT set must receive the
     reminder. Two spellings, because the match is case-insensitive and the
     word is usually embedded in a longer title. */
  G.USERS.push({id:'qa_roletext', name:'Role Text Only', role:'Domain Administrator', email:'roletext@aurora.example'});
  ok(G.notifyAdmins().some(function(u){ return u.id === 'qa_roletext'; }),
     'SEEDROSTER: a role containing “Admin” qualifies without the flag (directive 3 Sep 2026)');
  G.USERS.pop();
  G.USERS.push({id:'qa_rolelower', name:'Lower Case', role:'sysadmin', email:'lower@aurora.example'});
  ok(G.notifyAdmins().some(function(u){ return u.id === 'qa_rolelower'; }),
     'SEEDROSTER: the role match is case-insensitive');
  G.USERS.pop();
  /* …and it must not swallow the whole roster: a role with no “admin” in it
     and no flag stays out, which is the half that makes the rule mean anything. */
  G.USERS.push({id:'qa_plain', name:'Plain Member', role:'Program Lead', email:'plain@aurora.example'});
  ok(G.notifyAdmins().every(function(u){ return u.id !== 'qa_plain'; }),
     'SEEDROSTER: an ordinary role still does not qualify');
  G.USERS.pop();
  const adminU = G.notifyAdmins()[0];
  adminU.email = 'owner@aurora.example';
  const su1 = G.USERS.filter(function(u){ return u && u.id === 'su1'; })[0];
  su1.email = 'vlau@aurora.example';
  const soon = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  G.data.stepDue = {'3.1': soon}; G.data.assigns = {'3.1': ['su1']};
  G.data.remind7 = {}; if (G.data.completedSteps) delete G.data.completedSteps['3.1'];
  G.data.notifications = [];
  G.notifySweepDeadlines();
  const rem = (G.data.notifications || [])[0];
  ok(!!rem && rem.to.indexOf('owner@aurora.example') >= 0 && rem.to.indexOf('vlau@aurora.example') >= 0, 'SEEDROSTER: the base-seed reminder addresses the flagged admin plus the assignee');
  ok(String(rem.status||'').indexOf('no administrator') < 0, 'SEEDROSTER: the no-admin suffix never appears while a flagged admin exists');

  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'SEEDROSTER: restore returns the base identity');
})();

/* ─── DATED (July 9, sweep item 9): span-less costed rows never silently zero the ledger ───
   Hand-derived fixture (equivalent shape; scenario-1 rows slot in when they arrive):
   dev A $100,000 m1-4 dated · dev B $50,000 undated · roll C $20,000 m5-6 dated
   dated-only dev = 100,000 · plan full = 120,000 · after dating B (m2-3) full = 170,000 */
(function(){
  const _snap = JSON.stringify(G.data);
  if (!G.data.budgetPlans) G.data.budgetPlans = {};
  if (!G.data.experiments) G.data.experiments = {};

  /* undated-only: the simple estimate carries, never $0 */
  G.data.budgetPlans[97] = { dev: [{id:'ua', name:'Alpha build', cost:'$60,000'}] };
  G.data.experiments[97] = { budget: '$40,000' };
  ok(G.bpHasDev(97) === true, 'DATED: money without dates still claims the display surfaces (lock basis unchanged)');
  ok(G.bpPlanLive(97) === false, 'DATED: money without dates does not make the plan live for the ledger');
  eq(G.devCost(97), 40000, 'DATED: with no dated rows, committed development falls back to the simple estimate — not $0');
  const w0 = G.capProjectWindow(97, 1);
  eq(w0.inW + w0.beyond, 40000, 'DATED: the project window carries the simple figure');
  has(G.bpBudgetTab(97, true), 'Phase date ranges not set – Alpha build', 'DATED: the 3.4 budgeting panel warns per undated costed row');
  const hb = G.bpHeadlineBudget(97, {});
  has(hb, 'Derived from budget plan', 'DATED: the derived headline still shows (display basis unchanged)');
  has(hb, 'Phase date ranges not set – Alpha build', 'DATED: the 3.3 card carries the same warning');

  /* dating the row switches the ledger to plan figures and clears the warning */
  G.data.budgetPlans[97].dev[0].from = '1'; G.data.budgetPlans[97].dev[0].to = '4';
  ok(G.bpPlanLive(97) === true, 'DATED: a dated costed row makes the plan live');
  eq(G.devCost(97), 60000, 'DATED: the ledger switches to the plan figure once dates exist');
  ok(G.bpBudgetTab(97, true).indexOf('Phase date ranges not set') < 0, 'DATED: the warning clears when every costed row is dated');

  /* partial plan: dated rows count, undated rows are excluded and named */
  G.data.budgetPlans[97] = { dev: [
      {id:'pa', name:'Discovery', cost:'$100,000', from:'1', to:'4'},
      {id:'pb', name:'Pilot integration', cost:'$50,000'}
    ], roll: [ {id:'pc', name:'Rollout wave 1', cost:'$20,000', from:'5', to:'6'} ] };
  eq(G.devCost(97), 100000, 'DATED: partial plan — committed development counts only the dated rows');
  const w1 = G.capProjectWindow(97, 1);
  eq(w1.inW + w1.beyond, 120000, 'DATED: partial plan — the window totals dated development plus dated rollout');
  const warn = G.bpBudgetTab(97, true);
  ok(warn.indexOf('Pilot integration is not contributing') >= 0 && warn.indexOf('Discovery is not contributing') < 0, 'DATED: the warning names exactly the undated rows');

  /* full plan: the hand-derived exact figure */
  G.data.budgetPlans[97].dev[1].from = '2'; G.data.budgetPlans[97].dev[1].to = '3';
  eq(G.devCost(97), 150000, 'DATED: dating the last row brings its money into committed development');
  const w2 = G.capProjectWindow(97, 1);
  eq(w2.inW + w2.beyond, 170000, 'DATED: the fully dated plan reads $170,000 exactly — hand-derived: 100,000 + 50,000 + 20,000');
  ok(G.bpBudgetTab(97, true).indexOf('Phase date ranges not set') < 0, 'DATED: no warning on a fully dated plan');

  delete G.data.budgetPlans[97]; delete G.data.experiments[97];
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'DATED: restore returns the base identity');
})();

/* ─── READS (July 9, sweep item 10): no Reads-as echo anywhere; locks and blur re-renders stay ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const pages = [G.renderStep24(), G.renderStepExp(), G.renderStepCap(), G.renderOutOperFull(), G.renderStep44()].join('');
  ok(pages.indexOf('Reads as') < 0, 'READS: no money surface echoes Reads-as on the base fixture');
  has(pages, 'Derived from budget plan', 'READS: the derivation lock label survives the echo removal');
  G.seedDataY2();
  const pagesY2 = [G.renderStep24(), G.renderStepExp(), G.renderStepCap(), G.renderOutOperFull()].join('');
  ok(pagesY2.indexOf('Reads as') < 0, 'READS: no Reads-as on the Y2 fixture either');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'READS: restore returns the base identity');
})();

/* ─── CONFIRM (July 9, sweep item 11): completion asks first; cancel touches nothing ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _cf = G.confirm;
  G.confirm = function(){ return false; };

  if (G.data.completedSteps) delete G.data.completedSteps['1.2'];
  if (G.data.stepDoneAt) delete G.data.stepDoneAt['1.2'];
  G.data.notifications = [];
  G.saveDone12();
  ok(!(G.data.completedSteps||{})['1.2'], 'CONFIRM: cancelling the step dialog leaves the step incomplete');
  eq((G.data.notifications||[]).length, 0, 'CONFIRM: a cancelled completion queues no notification');
  ok(!(G.data.stepDoneAt||{})['1.2'], 'CONFIRM: a cancelled completion writes no timestamp');

  if (G.data.completedSections) delete G.data.completedSections['1.4'];
  G.saveSection14();
  ok(!(G.data.completedSections||{})['1.4'], 'CONFIRM: cancelling the section dialog leaves the section incomplete');

  const rows = G.bpRows(13, 'dev');
  ok(rows.length >= 2, 'CONFIRM: item 13 carries a multi-row plan for the gate walk');
  rows.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; });
  G.progGate(13, rows[0].id, 'go');
  ok(!rows[0].gateDec, 'CONFIRM: cancelling a non-terminal gate Go records nothing');
  G.bpRowSave(13, 'dev', rows[0].id, 'pstatus', 'complete');
  ok(String(rows[0].pstatus||'') === '', 'CONFIRM: cancelling the phase-status dialog keeps the phase unstarted – the re-render repaints the select from data');
  G.progGate(13, rows[0].id, 'recycle');
  eq(rows[0].gateDec, 'recycle', 'CONFIRM: Recycle needs no dialog – the confirms cover completion actions only');
  rows.forEach(function(r,x){ delete r.gateDec; delete r.gateAt; if (x < rows.length - 1) { r.gateDec = 'go'; r.pstatus = 'complete'; } });
  const last = rows[rows.length - 1];
  G.progGate(13, last.id, 'go');
  eq(last.gateDec, 'go', 'CONFIRM: terminal Go passes uninterrupted to the launch panel – no double confirm');

  G.confirm = function(){ return true; };
  rows.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; });
  if (G.data.tracking && G.data.tracking[13]) { G.data.tracking[13].status = ''; delete G.data.tracking[13].killSunkIds; }
  G.saveDone12();
  ok(!!(G.data.completedSteps||{})['1.2'] && !!(G.data.stepDoneAt||{})['1.2'], 'CONFIRM: accepting completes the step and stamps it');
  G.bpRowSave(13, 'dev', rows[0].id, 'pstatus', 'complete');
  eq(rows[0].pstatus, 'complete', 'CONFIRM: accepting the phase-status dialog commits the phase');

  G.confirm = _cf;
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'CONFIRM: restore returns the base identity');
})();

/* ─── HARTWELL (July 9, item 9 acceptance): scenario 1, engine-verified in the QA chat (S2-J) ───
   Fresh org · period start 2026-01-01 · 3-year window · anchor month 1 · one project.
   Plan: dev $60K m1-3 + dev $40K m4-6 + roll $30K m7-12 + sus $20K/yr m13-ongoing.
   Verified: bpFirstOpMonth 13 · monthly {dev 100000, roll 30000, sus 40000} · window {inW 170000, beyond 0} · total 170000. */
(function(){
  const curOrg = G.currentOrgId, orgs0 = G.getOrgs().length;
  G.createOrg('Hartwell Mutual', null);
  const hw = G.currentOrgId;
  ok(hw !== curOrg, 'HARTWELL: fixture runs in its own fresh org');
  G.data.ideas = [{name:'Claims Triage Pilot', when:'now'}];
  G.data.selected = [0]; G.data.expSelected = [0];
  G.data.projects = {0:{viable:true, objectives:'Cut triage time', startDate:'2026-01-01'}};
  G.data.experiments = {0:{budget:'$100,000'}};
  G.data.opsData = {0:{rolloutCost:'$30,000', runCost:'$20,000'}};
  G.data.capital = {aiBudget:'$1,200,000', periodStart:'2026-01-01', envYears:'3'};
  G.data.budgetPlans = {0:{
    dev: [ {id:'h1', name:'Design & build experiment', from:'1', to:'3', cost:'$60,000'},
           {id:'h2', name:'Run & evaluate', from:'4', to:'6', cost:'$40,000'} ],
    roll: [ {id:'h3', name:'Production rollout', from:'7', to:'12', cost:'$30,000'} ],
    sus: [ {id:'h4', name:'Operational sustainment', from:'13', to:'ongoing', items:[{id:'s1', name:'Ops', cost:'$20,000'}]} ]
  }};
  G.data.capStale = true; G.saveData();

  eq(G.bpFirstOpMonth(0), 13, 'HARTWELL: first operational month lands at 13');
  const mm = G.bpMonthly(0); let md=0, mr=0, ms=0;
  mm.forEach(function(r){ md+=r.dev; mr+=r.roll; ms+=r.sus; });
  ok(Math.abs(md-100000)<=1 && Math.abs(mr-30000)<=1, 'HARTWELL: monthly dev 100,000 and rollout 30,000');
  ok(Math.abs(ms-40000)<=1, 'HARTWELL: sustainment spreads 24 in-window months at $20K/12 – 40,000');
  const w = G.capProjectWindow(0);
  ok(Math.abs(w.inW-170000)<=1 && Math.round(w.beyond)===0, 'HARTWELL: project window {inW 170000, beyond 0}');
  eq(Math.round(G.capCommitments().total), 170000, 'HARTWELL: committed total reads 170,000 exactly (engine-verified S2-J)');
  eq(Math.round(G.capLens().tot.committed), 170000, 'HARTWELL: the lens every money surface consumes carries 170,000 \u2013 Hub, Commit & Advance, and Capital Snapshot agree by construction');

  /* guard side (S2-J Q2): same rows, costs but no spans → simple path carries, warning shows */
  ['h1','h2'].forEach(function(id){ var r=G.bpRows(0,'dev').filter(function(x){return x.id===id})[0]; r.from=''; r.to=''; });
  (function(){ var r=G.bpRows(0,'roll')[0]; r.from=''; r.to=''; })();
  (function(){ var p=G.bpRows(0,'sus')[0]; p.from=''; })();
  G.data.capStale = true; G.saveData();
  ok(G.bpPlanLive(0)===false, 'HARTWELL Q2: costs without spans leave the plan not-live');
  eq(G.devCost(0), 100000, 'HARTWELL Q2: committed development falls back to the simple $100K – not $0');
  eq(Math.round(G.capCommitments().total), 100000, 'HARTWELL Q2: total reads the simple estimate, 100,000');
  const warn = G.bpBudgetTab(0, true);
  ok(warn.indexOf('Phase date ranges not set')>=0 && warn.indexOf('Design &amp; build experiment is not contributing')>=0, 'HARTWELL Q2: the visible warning names the undated costed rows');

  /* all fields empty (addProgDefault default state): simple path, no warning */
  G.bpRows(0,'dev').forEach(function(r){ r.cost=''; });
  G.bpRows(0,'roll')[0].cost='';
  G.bpRows(0,'sus')[0].items[0].cost='';
  G.data.capStale = true; G.saveData();
  eq(Math.round(G.capCommitments().total), 100000, 'HARTWELL Q2: the default empty plan leaves the simple path in charge');
  ok(G.bpBudgetTab(0, true).indexOf('Phase date ranges not set')<0, 'HARTWELL Q2: no warning when no row holds money');

  G.switchToOrg(curOrg);
  // adminDeleteOrg() is the console's SERVER delete (posts to /organizations/delete
  // and keys off the database id). Dropping a local fixture org from the device
  // registry is deleteOrgById().
  G.deleteOrgById(hw);
  eq(G.getOrgs().length, orgs0, 'HARTWELL: the fixture org is cleaned up');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'HARTWELL: the seed org identity is untouched');
})();

/* ── BF12: loading saved data must never notify ──────────────────
   loadData() runs a one-time housekeeping pass (data.bf12) that
   back-fills the 1.2 / 1.3 completion flags for orgs saved before
   those flags existed. Two of its guards were missing their braces,
   so the stampStepDone() calls sat OUTSIDE the condition and ran on
   every load — recording a completion date for steps the team had
   not finished AND queueing a "step complete" email through
   notifyStepComplete(). Worse, because a step can only be stamped
   once, the genuine email never fired when the step was really done.

   The pass now writes the date inline and never calls stampStepDone,
   because opening an org is not an event anyone should be mailed
   about. Both halves are pinned below: the non-qualifying org must
   be left completely alone, and the qualifying org must still be
   back-filled but still stay silent. */
(function(){
  const _snap = JSON.stringify(G.data);
  const _org = G.currentOrgId, _uid = G.currentUserId, _users = G.USERS.slice();
  const _orgs0 = G.getOrgs().length;
  const fix = G.createOrg('BF12 Fixture', {name:'BF12 Owner', username:'bf12owner', passcode:'1234'});

  // notifyStepComplete() bails out early when no member carries an email, so
  // without this the assertions below would pass even with the bug present.
  const member = { id:'bf12u', name:'BF12 Member', username:'bf12m', initials:'BM',
                   color:'#1B6B5A', email:'member@bf12.example', admin:true, passcode:'1234' };
  G.USERS.length = 0; G.USERS.push(member);
  ok(G.notifyMemberEmails().length > 0,
     'BF12: precondition — a member email is reachable, so a step-complete email COULD queue');

  function loadFixture(mut) {
    const fx = G.emptyData();
    fx.roster = [JSON.parse(JSON.stringify(member))];
    fx.completedSteps = {};
    mut(fx);
    delete fx.bf12;                       // pre-migration blob: the pass must run
    G.Store.writeOrg(fix.orgId, fx);
    G.setCurrentOrg(fix.orgId);
    G.USERS.length = 0; G.USERS.push(member);   // loadData() reads USERS for the mail list
    G.loadData();
  }

  /* ── an org that has NOT finished 1.2 or 1.3 ── */
  loadFixture(fx => { fx.ideas = [{name:'Only one idea'}]; fx.selected = []; });
  ok(!(G.data.completedSteps || {})['1.2'], 'BF12: fewer than 3 ideas leaves 1.2 not complete');
  ok(!(G.data.completedSteps || {})['1.3'], 'BF12: nothing selected leaves 1.3 not complete');
  ok(!(G.data.stepDoneAt || {})['1.2'], 'BF12: an unfinished 1.2 gets no completion date');
  ok(!(G.data.stepDoneAt || {})['1.3'], 'BF12: an unfinished 1.3 gets no completion date');
  eq((G.data.notifications || []).filter(n => n && n.kind === 'step-complete').length, 0,
     'BF12: loading an org with unfinished steps queues no step-complete email');

  /* ── an org that DOES qualify: back-fill, but still silent ── */
  loadFixture(fx => { fx.ideas = [{name:'A'},{name:'B'},{name:'C'}]; fx.selected = [0]; });
  eq((G.data.completedSteps || {})['1.2'], true, 'BF12: three or more ideas still back-fills 1.2');
  eq((G.data.completedSteps || {})['1.3'], true, 'BF12: a selection still back-fills 1.3');
  ok(/^\d{4}-\d{2}-\d{2}$/.test((G.data.stepDoneAt || {})['1.2'] || ''), 'BF12: the back-fill records 1.2’s date inline');
  ok(/^\d{4}-\d{2}-\d{2}$/.test((G.data.stepDoneAt || {})['1.3'] || ''), 'BF12: the back-fill records 1.3’s date inline');
  eq((G.data.notifications || []).filter(n => n && n.kind === 'step-complete').length, 0,
     'BF12: even a qualifying back-fill sends no email — loading data never notifies');

  // restore
  G.deleteOrgById(fix.orgId);
  G.setCurrentOrg(_org); G.currentUserId = _uid;
  G.data = JSON.parse(_snap); G.saveData();
  G.USERS.length = 0; _users.forEach(u => G.USERS.push(u));
  eq(G.getOrgs().length, _orgs0, 'BF12: the fixture org is cleaned up');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'BF12: the seed org identity is untouched');
})();

/* ─── SIGN-OFF: who may mark a step complete ─────────────────────
   Reported Sep 2026: members could mark sections complete that were not
   assigned to them. Two separate faults sat behind it.

   1. POLICY. A step with nobody assigned was open to the whole team, on the
      reasoning that work must not stall waiting for an admin. Ruled the other
      way (9 Sep 2026): unassigned is ADMIN-ONLY, so a member can only ever
      complete work with their name on it.

   2. ENFORCEMENT. stepCompleteLock() was consulted in exactly ONE place —
      doneBtn(), which greys the button out — and in none of the twenty-odd
      handlers that write the completion. A disabled button is a statement, not
      a gate: a page drawn before the assignment arrived still had a live
      button, and the handler behind it wrote the completion without asking
      anybody. Same lesson the record locks learned.

   So these assertions go through the REAL handlers (saveSection15, saveSection12),
   never through the rendered markup alone. A greyed button that still writes is
   exactly the bug, and only a behavioural test can tell the two apart.        */
(function () {
  const _snap = JSON.stringify(G.data);
  const _users = G.USERS.map(u => JSON.parse(JSON.stringify(u)));
  const _uid = G.currentUserId, _page = G.currentPage, _step = G.currentStep, _sec = G.UI.sec;
  /* confirm() is stubbed true in this realm, so a completion that gets past the
     gate really does land — which is what makes "refused" and "allowed"
     distinguishable below. alert() is counted, not shown. */
  let alerts = [];
  const _alert = G.alert;
  G.alert = m => { alerts.push(String(m)); };

  /* Two members and an admin, on the roster this program reads identity from. */
  G.USERS.length = 0;
  G.USERS.push({ id: 'mem1', name: 'Ravi Menon', role: 'Analyst', admin: false, email: 'ravi@s.example', color: '#4866A0', initials: 'RM' });
  G.USERS.push({ id: 'mem2', name: 'Ada Kern', role: 'Analyst', admin: false, email: 'ada@s.example', color: '#2D5A8E', initials: 'AK' });
  G.USERS.push({ id: 'boss', name: 'Tamsin Doyle', role: 'Owner', admin: true, email: 'tam@s.example', color: '#B8892A', initials: 'TD' });

  G.currentPage = 'step'; G.currentStep = '1.1'; G.UI.sec = '1.1';

  const reset = () => {
    G.data.completedSteps = {}; G.data.completedSections = {}; G.data.stepDoneAt = {};
    G.data.assigns = {}; alerts = [];
  };
  const stepDone = () => !!(G.data.completedSteps || {})['1.1'];
  const secDone = k => !!(G.data.completedSections || {})[k];
  /* Step 1.1 has no button of its own: the save of its last section completes
     it. So the step-level sign-off is asserted through that real handler,
     with the other four sections marked directly. */
  const allFive = () => { G.data.completedSections = { '1.1': true, '1.2': true, '1.3': true, '1.4': true, '1.5': true }; };
  const fifth = () => { delete G.data.completedSections['1.5']; G.UI.sec = '1.5'; G.saveSection15(); };

  /* ── 1. unassigned is now the ADMIN's to sign off, not the team's ── */
  reset(); allFive();
  G.currentUserId = 'mem1';
  fifth();
  ok(!stepDone(), 'SIGNOFF: a member cannot complete a step nobody is assigned to');
  ok(/nobody is assigned/i.test(alerts.join(' ')), 'SIGNOFF: and is told why, not just refused');

  reset(); allFive();
  G.currentUserId = 'boss';
  fifth();
  ok(stepDone(), 'SIGNOFF: an administrator still completes an unassigned step');

  /* ── 2. assigned to me / assigned to somebody else ── */
  reset(); allFive();
  G.data.assigns = { '1.1': ['mem1'] };
  G.currentUserId = 'mem1';
  fifth();
  ok(stepDone(), 'SIGNOFF: the assigned member completes their own step');

  reset(); allFive();
  G.data.assigns = { '1.1': ['mem1'] };
  G.currentUserId = 'mem2';
  fifth();
  ok(!stepDone(), 'SIGNOFF: another member cannot complete somebody else’s step');
  ok(/Ravi Menon/.test(alerts.join(' ')), 'SIGNOFF: the refusal names who it belongs to');

  reset(); allFive();
  G.data.assigns = { '1.1': ['mem1'] };
  G.currentUserId = 'boss';
  fifth();
  ok(stepDone(), 'SIGNOFF: an administrator can always unblock a step');

  /* ── 3. the SECTION buttons are gated too, by their STEP's assignment ──
     1.1's five sections are all signed off under step 1.1, so the section id
     has to be reduced to its step before the rule is asked — ask it about
     '1.2' and you are asking about a different step entirely. */
  reset();
  G.data.assigns = { '1.1': ['mem1'] };
  G.currentUserId = 'mem2';
  G.saveSection12();
  ok(!secDone('1.2'), 'SIGNOFF: a section is gated by the step it sits on, not by its own number');

  reset();
  G.data.assigns = { '1.1': ['mem1'] };
  G.currentUserId = 'mem1';
  G.saveSection12();
  ok(secDone('1.2'), 'SIGNOFF: and the assigned member signs its sections off');

  /* A step assigned to somebody else must not leak in through a section whose
     number happens to match an unassigned step. */
  reset();
  G.data.assigns = { '1.2': ['mem1'] };      // step 1.2 is a DIFFERENT step
  G.currentUserId = 'mem2';
  G.saveSection12();
  ok(!secDone('1.2'), 'SIGNOFF: an assignment on step 1.2 does not unlock step 1.1’s section 1.2');

  /* ── 4. the write is refused, not merely the button greyed ──
     The whole of the old enforcement was doneBtn() rendering `disabled`. This
     asserts the two are now independent: with the markup never rendered at all,
     the handler still refuses. */
  reset(); allFive();
  G.data.assigns = { '1.1': ['mem1'] };
  G.currentUserId = 'mem2';
  ok(G.completeBlocked('1.1'), 'SIGNOFF: completeBlocked() answers for a step that is not yours');
  fifth();
  ok(!stepDone(), 'SIGNOFF: and the handler refuses with no render in between');
  eq((G.data.stepDoneAt || {})['1.1'], undefined, 'SIGNOFF: a refused completion stamps no date');

  /* ── 5. the two cases the rule must NOT catch ── */
  reset(); allFive();
  G.currentUserId = null;                      // nobody signed in: the rule has no subject
  ok(!G.completeBlocked('1.1'), 'SIGNOFF: signed out, the assignment rule has nothing to say');

  reset(); allFive();
  G.currentUserId = 'mem1';
  const _ph = G.Modules.PH;
  G.Modules.PH = () => [];                     // a Leaders program: nothing can ever be assigned
  try {
    ok(!G.completeBlocked('1.1'), 'SIGNOFF: a program with no assignment system is not gated by it');
  } finally { G.Modules.PH = _ph; }

  /* ── 6. and the button still explains itself ──
     The message doneBtn() prints and the message the handler alerts are the
     same sentence from the same function, so a member is never refused for a
     reason the page did not already give them. */
  reset(); allFive();
  G.data.assigns = { '1.1': ['mem1'] };
  G.currentUserId = 'mem2';
  delete G.data.completedSections['1.5']; G.UI.sec = '1.5';   // the open section carries the reason now
  const lock = G.stepCompleteLock('1.1');
  has(G.renderStep11(), G.esc(lock), 'SIGNOFF: the open section’s disabled button carries the same reason the refusal gives');

  G.alert = _alert;
  G.USERS.length = 0; _users.forEach(u => G.USERS.push(u));
  G.currentUserId = _uid; G.currentPage = _page; G.currentStep = _step; G.UI.sec = _sec;
  G.data = JSON.parse(_snap); G.saveData();
})();

/* ── S11: step 1.1 completes itself on its fifth section ─────────
   1.1 has five sections and no Step Complete button of its own. It once
   derived 'done' from the sections and never stamped a date or sent the
   email; then it got a button (saveDone11) that teams missed, leaving 1.1
   open on Track Program. The 15 Oct 2026 ruling: saving the last of the
   five sections, in whichever order, records the step, its date, and one
   team email. Organizations that finished the sections under the button
   are recorded complete on load, with no date and no email. */
(function(){
  const _snap = JSON.stringify(G.data);
  const _users = G.USERS.map(u => JSON.parse(JSON.stringify(u)));
  const _page = G.currentPage, _step = G.currentStep, _sec = G.UI.sec, _uid = G.currentUserId;

  // notifyStepComplete() bails out when no member carries an email, so without
  // this every "no email" assertion below would pass for the wrong reason.
  G.USERS.forEach(u => { if (!u.email) u.email = (u.username || 'x') + '@s11.example'; });
  ok(G.notifyMemberEmails().length > 0, 'S11: precondition — a member email is reachable, so an email COULD queue');

  G.currentPage = 'step'; G.currentStep = '1.1';
  // Leave 1.1 unassigned and act as nobody in particular, so the assignment
  // rule is out of the picture and what is under test is the five-section rule.
  if (G.data.assigns) delete G.data.assigns['1.1'];
  G.currentUserId = null;
  const msgs = []; const _confirm = G.confirm; G.confirm = m => { msgs.push(String(m)); return true; };
  const fresh = secs => {
    G.data.completedSections = {}; secs.forEach(k => { G.data.completedSections[k] = true; });
    delete (G.data.completedSteps || {})['1.1']; delete (G.data.stepDoneAt || {})['1.1'];
    G.data.notifications = []; msgs.length = 0;
  };
  const sent = () => (G.data.notifications || []).filter(n => n && n.kind === 'step-complete' && n.stepId === '1.1').length;

  /* ── four of five: no step button, step still open ── */
  fresh(['1.1', '1.2', '1.3', '1.4']); G.UI.sec = '1.5';
  let s11 = G.renderStep11();
  ok(s11.indexOf('saveDone11()') < 0, 'S11: step 1.1 renders no Step Complete button of its own');
  ok(G.isStepDone('1.1') === false, 'S11: four sections in, the step is still open');
  ok(G.lastBatterySection('1.5'), 'S11: section 1.5 is known to be the last one outstanding');
  ok(!G.lastBatterySection('1.4'), 'S11: a section already done is not the last one');

  /* ── the fifth section, saved in order ── */
  noThrow(() => G.saveSection15(), 'S11: saving the fifth section runs');
  ok(G.isStepDone('1.1') === true, 'S11: saving the fifth section completes the step');
  eq((G.data.completedSteps || {})['1.1'], true, 'S11: the step is recorded in completedSteps');
  ok(/^\d{4}-\d{2}-\d{2}$/.test((G.data.stepDoneAt || {})['1.1'] || ''), 'S11: the completion date is recorded');
  eq(sent(), 1, 'S11: exactly one step-complete email is sent');
  ok(/completes Step 1\.1 and notifies the team/.test(msgs.join(' ')), 'S11: the last section\u2019s confirm says it completes the step and notifies the team');

  /* ── saving an already-complete section again sends nothing ── */
  noThrow(() => G.saveSection15(), 'S11: saving a completed section again runs');
  eq(sent(), 1, 'S11: saving it again does not send a second email');

  /* ── out of order: 1.5 before 1.4, completed once, on 1.4 ── */
  fresh(['1.1', '1.2', '1.3']); G.UI.sec = '1.5';
  G.saveSection15();
  ok(G.isStepDone('1.1') === false, 'S11: four sections (1.5 before 1.4) leave the step open');
  eq(sent(), 0, 'S11: and send no email');
  ok(!/completes Step 1\.1/.test(msgs.join(' ')), 'S11: a section that is not the last asks the plain confirm');
  G.UI.sec = '1.4'; G.saveSection14();
  ok(G.isStepDone('1.1') === true, 'S11: whichever section is last completes the step');
  ok(/^\d{4}-\d{2}-\d{2}$/.test((G.data.stepDoneAt || {})['1.1'] || ''), 'S11: out of order, the date is still recorded');
  eq(sent(), 1, 'S11: out of order, exactly one email');

  /* ── finished under the button and never pressed: backfilled on load ── */
  fresh(['1.1', '1.2', '1.3', '1.4', '1.5']); G.data.bf11 = true;   // the older one-time backfill already ran
  G.saveData(); G.loadData();
  eq((G.data.completedSteps || {})['1.1'], true, 'S11: an org that finished all five sections loads with 1.1 complete');
  eq((G.data.stepDoneAt || {})['1.1'], undefined, 'S11: the backfill records no date');
  eq(sent(), 0, 'S11: the backfill sends no email');
  fresh(['1.1', '1.2', '1.3', '1.4']); G.saveData(); G.loadData();
  ok(!(G.data.completedSteps || {})['1.1'], 'S11: four sections do not backfill');

  G.confirm = _confirm;

  // restore
  G.currentPage = _page; G.currentStep = _step; G.UI.sec = _sec; G.currentUserId = _uid;
  G.data = JSON.parse(_snap); G.saveData();
  G.USERS.length = 0; _users.forEach(u => G.USERS.push(u));
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'S11: the seed org identity is untouched');
})();

/* ── LOCK: every editable field is inside the Collab lock system ──
   A field is "connected" to record locking iff idToRecordKey() maps its
   DOM id to a record key — the focusin/focusout handlers, applyLockUI()
   and fldSave()'s own guard all consult nothing else. Four prefixes were
   outside it: bsic (Blue Sky project-card fields), pgf and pgTpl (program
   phase rows), and prj (assumed start date). bsic was the damaging one:
   because fldSave() gates on idToRecordKey(), an unmapped prefix meant
   the write went through even while someone else held the card. The
   sweep at the end is the durable guard — any new editable field that
   forgets its mapping reds this test. */
(function(){
  const _snap = JSON.stringify(G.data);
  const _exp = JSON.parse(JSON.stringify(G.UI.expanded || {}));
  const _sec = G.UI.sec, _ap = G.UI.ap, _page = G.currentPage, _step = G.currentStep;

  /* ── the four prefixes that were missing, keyed to the record their
        save handler already guards on ── */
  eq(G.idToRecordKey('bsic_18_desc'), 'ideas::18', 'LOCK: Blue Sky card fields lock per idea');
  eq(G.idToRecordKey('bsic_3_when'), 'ideas::3', 'LOCK: the card’s When select locks with the rest of the card');
  eq(G.idToRecordKey('pgf_11__bp11a__powner'), 'budgetPlans::11', 'LOCK: program phase fields lock with their budget plan (bpRowSave’s key)');
  eq(G.idToRecordKey('pgTpl_11'), 'budgetPlans::11', 'LOCK: the add-phase template picker locks with its plan (addProgPhase’s key)');
  eq(G.idToRecordKey('prj_0_startDate'), 'projects::0', 'LOCK: the assumed start date locks with its project (capStartSave’s key)');
  eq(G.idToRecordKey('rhAg_0'), 'rhythm', 'LOCK: 2.3 agenda rows lock with the rhythm record (saveAgendaItems’ key)');
  // and the deliberate exclusion stays excluded
  ok(G.idToRecordKey('ic_name') === null, 'LOCK: new-idea draft fields stay out — UI state, not a shared record');

  /* ── behaviour: a card another user holds refuses the write ── */
  (function(){
    const lk = 'pipeline-locks::' + G.currentOrgId;
    const before = G.data.ideas[18].desc;
    localStorageStub.setItem(lk, JSON.stringify({ 'ideas::18': { id:'another-user', name:'Other User', at: Date.now() } }));
    ok(!!G.Collab.lockedByOther('ideas::18'), 'LOCK: the fixture lock is seen as held by someone else');
    G.fldSave('bsic_18_desc', 'HIJACKED');
    eq(G.data.ideas[18].desc, before, 'LOCK: a write to a card another user holds is refused (no last-write-wins)');
    localStorageStub.removeItem(lk);
    ok(!G.Collab.lockedByOther('ideas::18'), 'LOCK: clearing the lock releases the card');
    G.fldSave('bsic_18_desc', 'MINE NOW');
    eq(G.data.ideas[18].desc, 'MINE NOW', 'LOCK: once released, the same write goes through');
    G.data.ideas[18].desc = before;
  })();

  /* ── sweep: render everything and check every field id maps ── */
  (function(){
    const ids = new Map();
    const harvest = (html, where) => {
      if (typeof html !== 'string') return;
      for (const m of html.matchAll(/<(?:input|select|textarea)\b[^>]*\sid="([^"]+)"/g))
        if (!ids.has(m[1])) ids.set(m[1], where);
    };
    (G.data.ideas || []).forEach((_, i) => ['bs','bsf','pc31','op','ex','oper','exp'].forEach(p => { G.UI.expanded[p+i] = true; }));
    G.UI.expanded.bsFold = true; G.UI.expanded.raciEdit = true;
    Object.keys(G.UI.expanded).forEach(k => { G.UI.expanded[k] = true; });

    Object.keys(G).filter(k => /^(render|viz)/.test(k) && typeof G[k] === 'function').forEach(fn => {
      ['1.1','1.2','1.3','1.4','1.5'].forEach(sec => {
        G.UI.sec = sec;
        [null, 11, 16, 17].forEach(ap => { G.UI.ap = ap; try { harvest(G[fn](), fn); } catch (e) { } });
      });
    });
    (G.PH || []).forEach(p => (p.steps || []).forEach(s => {
      G.currentPage = 'step'; G.currentStep = s.id;
      try { harvest(G.renderStepContent(), 'step ' + s.id); } catch (e) { }
    }));
    (G.data.ideas || []).forEach((_, i) => { try { harvest(G.bpBudgetTab(i, true), 'bpBudgetTab'); } catch (e) { } });

    ok(ids.size > 250, 'LOCK: the sweep rendered a representative field population (' + ids.size + ' ids)');
    const unmapped = [];
    ids.forEach((where, id) => { let rk = null; try { rk = G.idToRecordKey(id); } catch (e) { } if (!rk) unmapped.push(id + ' [' + where + ']'); });
    // ic_* are the only fields deliberately outside the system.
    const leaks = unmapped.filter(s => s.slice(0, 3) !== 'ic_');
    eq(leaks, [], 'LOCK: every editable field on every surface maps to a lockable record');
    ok(unmapped.length === leaks.length + 10, 'LOCK: the ten new-idea draft fields are the only exclusions');
  })();

  // restore
  G.UI.expanded = _exp; G.UI.sec = _sec; G.UI.ap = _ap;
  G.currentPage = _page; G.currentStep = _step;
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'LOCK: the seed org identity is untouched');
})();

/* ── SIGNUP: one sign-up for all twelve, and it asks which space ──
   Sign-IN still belongs to a program — /apps/{role}/{program}/login wears
   that program's name and colours, and the role space comes with the
   address. Sign-UP does not: there is one screen at /apps/signup for all
   twelve, so "Enterprise or Leaders?" went back onto the FORM, and with it
   the two things that answer used to be read off the URL for — whether an
   Organization is asked for, and which programs the account starts with.

   The rules this pins down:
     · the choice is a field, and a blank one is refused rather than
       defaulted. The two spaces hold different programs and an account
       cannot be moved between them afterwards, so the form has to ask
       again rather than quietly make an Enterprise organization;
     · an ENTERPRISE account still names its organization (half of its
       members' sign-in credential);
     · a LEADER account names none — the server derives the workspace name
       from the person's — so the same form must pass without one;
     · nothing on the form picks PROGRAMS any more. An account gets its
       whole role space, and SetupController::entitlementFor builds that
       list from the catalogue, so a modules key in a request is not a
       thing the client gets to decide. */
(function(){
  const V = G.Entry && G.Entry.validateSetup;
  const tpl = (G.__LOCAL_TEMPLATES || {}).setup || '';
  const person = { name:'Maria Torres', email:'maria@acme.com', username:'maria', setup_code:'ABCXYZ', password:'Harbour!Lamp42', confirm:'Harbour!Lamp42' };

  /* ── the choice is on the form, unanswered ── */
  has(tpl, 'name="setupAccountType"', 'SIGNUP: the sign-up form carries the Enterprise/Leaders picker');
  has(tpl, 'value="enterprise"', 'SIGNUP: Enterprise is one of the two choices');
  has(tpl, 'value="leader"', 'SIGNUP: Leaders is the other');
  has(tpl, 'data-err="account_type"', 'SIGNUP: the picker has an error slot to paint into');
  ok(tpl.indexOf('checked') < 0,
     'SIGNUP: neither role is pre-selected — a default nobody looked at is how an account lands in the wrong space');

  /* ── and answering it is required ── */
  has((V(Object.assign({}, person)) || {}).account_type || '', 'Enterprise or Leaders',
      'SIGNUP: a form with no role chosen is refused');
  has((V(Object.assign({}, person, { account_type:'' })) || {}).account_type || '', 'Enterprise or Leaders',
      'SIGNUP: an empty role is refused too, not treated as enterprise');
  has((V(Object.assign({}, person, { account_type:'admin' })) || {}).account_type || '', 'Enterprise or Leaders',
      'SIGNUP: a role that is not one of the two is refused');

  /* ── each space is asked for what it actually has ── */
  has((V(Object.assign({}, person, { account_type:'enterprise' })) || {}).organization_name || '', 'organization name',
      'SIGNUP: an Enterprise account must name its organization');
  eq(Object.keys(V(Object.assign({}, person, { account_type:'leader' })) || {}), [],
     'SIGNUP: a Leader account passes with no organization at all');
  eq(Object.keys(V(Object.assign({}, person, { account_type:'leader', organization_name:'' })) || {}), [],
     'SIGNUP: and an empty one is not held against them');
  eq(Object.keys(V(Object.assign({}, person, { account_type:'enterprise', organization_name:'Acme' })) || {}), [],
     'SIGNUP: a complete Enterprise form passes');

  /* ── one question at a time ──
     An unanswered role owes no organization. "Not a Leader, so name your
     organization" refuses a question nobody was put, against a field the
     screen has not even shown yet — and the picker above is already asking
     the only thing that can be answered. The SERVER still requires an
     organization of anything that is not a Leader, because it has to judge
     requests that never came from this form; this is the narrower rule for
     the case where there is a person to ask. */
  eq(Object.keys(V(Object.assign({}, person)) || {}), ['account_type'],
     'SIGNUP: with no role chosen, the role is the only thing wrong — no organization error against a hidden field');

  /* ── nothing here picks programs ── */
  ok(tpl.indexOf('data-field="modules"') < 0 && tpl.indexOf('name="setupModules"') < 0,
     'SIGNUP: the form offers no program picker — an account gets its whole role space');
  eq(Object.keys(V(Object.assign({}, person, { account_type:'leader', modules:[] })) || {}), [],
     'SIGNUP: an empty program list is not a client-side failure, because the client no longer chooses');
})();

/* ── SETUP: a new org cannot be created without an email ─────────
   The setup form collected org name / name / username / PIN only, so
   every new organization started with an owner who had no address —
   and notifyMemberEmails() reads exactly that field, so every
   notification for that org was silently dropped from day one. The
   email is now required by the same rule the admin member editor uses
   and lands on the roster record, which is where emails live when they
   are added later. The last block ties it to Fix 3 end to end. */
(function(){
  const _snap = JSON.stringify(G.data);
  const _org = G.currentOrgId, _uid = G.currentUserId, _users = G.USERS.slice();
  const _orgs0 = G.getOrgs().length;

  /* ── the form asks for it ── */
  const tpl = (G.__LOCAL_TEMPLATES || {}).setup || '';
  has(tpl, 'id="setupEmail"', 'SETUP: the org setup form carries an email input');
  has(tpl, 'data-field="email"', 'SETUP: the email input is bound to the setup handler');
  has(tpl, 'data-err="email"', 'SETUP: the email input has an error slot to paint into');

  /* ── it is required, and validated ── */
  const V = G.Entry && G.Entry.validateSetup;
  eq(typeof V, 'function', 'SETUP: the setup validator is reachable');
  const base = { account_type:'enterprise', organization_name:'Acme Manufacturing', name:'Maria Torres', username:'maria', setup_code:'ABCXYZ', password:'Harbour!Lamp42', confirm:'Harbour!Lamp42' };
  has((V(Object.assign({}, base)) || {}).email || '', 'required', 'SETUP: a missing email blocks org creation');
  has((V(Object.assign({}, base, { email:'maria-at-acme' })) || {}).email || '', 'valid email', 'SETUP: a malformed email blocks org creation');
  eq(Object.keys(V(Object.assign({}, base, { email:'maria@acme.com' })) || {}), [], 'SETUP: a complete form with a valid email passes');
  // the other rules still stand, so the email check did not replace them.
  // account_type is named because the org rule now hangs off it — see the
  // SIGNUP block above for why an unanswered role owes no organization.
  has((V({ account_type:'enterprise', email:'maria@acme.com' }) || {}).organization_name || '', 'organization name', 'SETUP: the existing rules are untouched');

  /* ── it is stored where emails live, and reaches the mail list ── */
  const made = G.createOrg('Email Fixture Org', { name:'Maria Torres', username:'maria', passcode:'1234', email:'maria@acme.com' });
  const owner = (G.data.roster || [])[0] || {};
  eq(owner.email, 'maria@acme.com', 'SETUP: the email is saved on the owner’s roster record');
  ok(G.USERS.some(u => u.email === 'maria@acme.com'), 'SETUP: applyTeamRoster carries it through to USERS');
  ok(G.notifyMemberEmails().indexOf('maria@acme.com') >= 0, 'SETUP: the new org has a reachable notification address');

  /* ── end to end with Fix 3: the new account gets the step email ── */
  G.currentUserId = made.userId;
  G.data.completedSections = {'1.1':true,'1.2':true,'1.3':true,'1.4':true}; G.UI.sec = '1.5';
  G.data.notifications = [];
  noThrow(() => G.saveSection15(), 'SETUP: the new org can complete step 1.1');
  const sent = (G.data.notifications || []).filter(n => n && n.kind === 'step-complete' && n.stepId === '1.1');
  eq(sent.length, 1, 'SETUP: completing 1.1 in a brand-new org sends exactly one step-complete email');
  ok(sent.length === 1 && sent[0].to.indexOf('maria@acme.com') >= 0,
     'SETUP: that email is addressed to the owner captured at setup');

  /* ── the contrast: an owner with no email is why this mattered ── */
  G.deleteOrgById(made.orgId);
  const bare = G.createOrg('No Email Org', { name:'Nobody', username:'nobody', passcode:'1234' });
  eq(G.notifyMemberEmails(), [], 'SETUP: an owner with no address has no reachable recipients (the old behaviour)');
  G.currentUserId = bare.userId;
  G.data.completedSections = {'1.1':true,'1.2':true,'1.3':true,'1.4':true}; G.UI.sec = '1.5';
  G.data.notifications = [];
  G.saveSection15();
  eq((G.data.notifications || []).length, 0, 'SETUP: …and the step-complete email is silently dropped — what the required field prevents');
  G.deleteOrgById(bare.orgId);

  // restore
  G.setCurrentOrg(_org); G.currentUserId = _uid;
  G.data = JSON.parse(_snap); G.saveData();
  G.USERS.length = 0; _users.forEach(u => G.USERS.push(u));
  eq(G.getOrgs().length, _orgs0, 'SETUP: the fixture orgs are cleaned up');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'SETUP: the seed org identity is untouched');
})();

/* ─── ORGDET: the organization screen asks for a NAME and nothing else ───
   Seven fields were required — industry, headcount, region, website, maturity,
   sponsor, objective — so a new account could not get past this screen without
   inventing seven answers, several of which ("AI maturity", "Executive
   sponsor") a person signing up has no reason to have decided yet. Ruled
   optional on 10 Sep 2026.

   Optional is not unchecked, which is the half worth testing: every length and
   shape rule still applies to whatever IS filled in. And the same rules live in
   api/controllers/OrganizationController.php, which is the half that actually
   has to be true — this file runs in a browser and can be edited — so the two
   are compared against each other at the end.                              */
(function () {
  const V = G.validateOrgDetails;
  eq(typeof V, 'function', 'ORGDET: the validator is reachable');

  const only = (o) => Object.keys(V(Object.assign({ name: 'Acme Manufacturing' }, o)) || {});

  /* ── a name on its own is a complete form ── */
  eq(only({}), [], 'ORGDET: a name and nothing else passes');
  eq(only({ industry: '', size: '', region: '', website: '', maturity: '', sponsor: '', objective: '' }), [],
    'ORGDET: every other field explicitly blank still passes');

  /* ── the name is the one thing still demanded ── */
  ok(!!(V({}) || {}).name, 'ORGDET: no name is refused');
  ok(!!(V({ name: 'A' }) || {}).name, 'ORGDET: a one-character name is refused');
  ok(!!(V({ name: 'x'.repeat(151) }) || {}).name, 'ORGDET: an over-long name is refused');

  /* ── none of the seven is demanded any more ── */
  ['industry', 'size', 'region', 'website', 'maturity', 'sponsor', 'objective'].forEach(f => {
    ok(only({}).indexOf(f) < 0, 'ORGDET: "' + f + '" is optional');
  });

  /* ── but what IS given is still checked ── */
  ok(only({ website: 'not a website' }).indexOf('website') >= 0, 'ORGDET: a malformed website is still refused');
  eq(only({ website: 'acme.com' }), [], 'ORGDET: a bare domain is accepted');
  eq(only({ website: 'https://acme.com/x' }), [], 'ORGDET: so is a full URL');
  ok(only({ industry: 'x'.repeat(121) }).indexOf('industry') >= 0, 'ORGDET: an over-long industry is refused');
  ok(only({ region: 'x'.repeat(121) }).indexOf('region') >= 0, 'ORGDET: an over-long region is refused');
  ok(only({ sponsor: 'x'.repeat(121) }).indexOf('sponsor') >= 0, 'ORGDET: an over-long sponsor is refused');
  ok(only({ objective: 'x'.repeat(1001) }).indexOf('objective') >= 0, 'ORGDET: an over-long objective is refused');

  /* ── and the SERVER agrees ──
     The browser copy is advisory; api/controllers/OrganizationController.php is
     the enforcement. If one side drops a rule the other keeps, a form that
     passes here is rejected there — which is exactly what "make it optional"
     looked like when only the client had been changed: the errors moved from
     the field to the response. Read as source because PHP does not run in this
     realm, the same way the collab label sweep reads the other modules. */
  (function () {
    const path = require('path'), fs = require('fs');
    const ROOT = path.resolve(__dirname, '..', '..');
    let php = '';
    try { php = fs.readFileSync(path.join(ROOT, 'api', 'controllers', 'OrganizationController.php'), 'utf8'); } catch (e) { }
    ok(!!php, 'ORGDET: the server controller was found');
    const rules = php.slice(php.indexOf('$validator = new Validator('), php.indexOf('if ($validator->fails())'));
    ok(rules.indexOf("'name'") >= 0, 'ORGDET: the server rule block was found');

    /* Each server field, and whether its rule list carries 'required'. */
    const serverRequires = f => {
      const m = new RegExp("'" + f + "'\\s*=>\\s*\\[([^\\]]*)\\]").exec(rules);
      return m ? /'required'/.test(m[1]) : null;
    };
    eq(serverRequires('name'), true, 'ORGDET: the server still requires the name');
    [['industry', 'industry'], ['company_size', 'size'], ['region', 'region'], ['website', 'website'],
    ['ai_maturity', 'maturity'], ['executive_sponsor', 'sponsor'], ['objective', 'objective']].forEach(pair => {
      eq(serverRequires(pair[0]), false,
        'ORGDET: the server does not require "' + pair[0] + '" either — client and server agree');
    });
  })();

  /* ── the panel has TWO framings, and which one it wears matters ──
     Straight after sign-up it is a welcome: the "let's get set up" eyebrow,
     "Set Up Your Organization & Team", and the line saying the name is all that
     is needed to continue. Opened later from the More menu it is an edit
     screen: "Organization & Team". Welcoming somebody to an app they have been
     using for a fortnight reads as a bug, and an edit screen at first run reads
     as a form nobody explained — so both are pinned. */
  (function () {
    const _modal = G.currentModal, _uid = G.currentUserId, _setup = G.orgSetupMode;
    try {
      G.USERS.push({ id: 'orgdet_admin2', name: 'Org Admin', admin: true, initials: 'OA', color: '#B8892A' });
      G.currentUserId = 'orgdet_admin2';

      const html = () => (G.document.getElementById('modalRoot') || {}).innerHTML || '';

      G.openOrgSetup();
      const setup = html();
      has(setup, 'let’s get set up', 'ORGDET: the first-run panel opens with the welcome eyebrow');
      has(setup, 'Set Up Your Organization', 'ORGDET: and the set-up heading');
      has(setup, 'organization name is required to continue', 'ORGDET: and says the name is all that is needed');
      has(setup, 'Get Started', 'ORGDET: and carries the Get Started button');
      /* No backdrop dismiss in setup mode — the panel is answered, not shrugged
         off. The name is prefilled from sign-up, so Get Started always works. */
      ok(setup.indexOf('modal-bg" onclick') < 0, 'ORGDET: the first-run panel is not dismissed by a backdrop click');

      G.openOrg();
      const edit = html();
      has(edit, 'Organization &amp; Team', 'ORGDET: opened from the menu it is the edit screen');
      ok(edit.indexOf('let’s get set up') < 0, 'ORGDET: with no welcome eyebrow');
      ok(edit.indexOf('Set Up Your Organization') < 0, 'ORGDET: and no set-up heading');
      has(edit, 'Get Started', 'ORGDET: the button reads the same either way');
      ok(edit.indexOf('modal-bg" onclick') >= 0, 'ORGDET: and the edit screen IS dismissed by a backdrop click');

      /* The wiring, not just the renderer: the panel bootApp raises after
         sign-up must be the welcome one. openOrgSetup() was orphaned for
         months precisely because nothing asserted who called it. */
      const app = require('fs').readFileSync(
        require('path').resolve(__dirname, '..', '..', 'js', 'app.js'), 'utf8');
      const calls = (app.match(/takeOpenProfile\(\)[^\n]*/g) || []).join('\n');
      ok(/openOrgSetup\(\)/.test(calls),
        'ORGDET: the post-sign-up open calls openOrgSetup()');
      ok(!/takeOpenProfile\(\)[^\n]*\bopenOrg\(\)/.test(calls),
        'ORGDET: and not openOrg(), which would drop the welcome framing');
    } finally {
      G.USERS = G.USERS.filter(function (u) { return u && u.id !== 'orgdet_admin2'; });
      G.currentUserId = _uid; G.orgSetupMode = _setup; G.currentModal = _modal; G.renderOrgModal();
    }
  })();

  /* ── the button says what it does ──
     "Get Started" rather than "Done": this screen is the first thing a new
     account meets, and the button's job is to let them in. */
  (function () {
    const _modal = G.currentModal, _uid = G.currentUserId;
    try {
      /* The modal renders read-only for anyone who cannot manage the org, and
         this realm is signed out — without an admin on screen the assertions
         below would be about the Close button, not the save button. */
      G.USERS.push({ id: 'orgdet_admin', name: 'Org Admin', admin: true, initials: 'OA', color: '#B8892A' });
      G.currentUserId = 'orgdet_admin';
      G.currentModal = 'org';
      G.renderOrgModal();
      /* G.document: the stub DOM lives in the vm realm, not in this file's scope. */
      const html = (G.document.getElementById('modalRoot') || {}).innerHTML || '';
      has(html, 'Get Started', 'ORGDET: the button reads “Get Started”');
      has(html, 'doneOrgDetails(', 'ORGDET: and still runs the save that validates and posts to MySQL');
      /* One star, on the name. Starring an optional field is the form lying
         about what it wants, which is what the reported screen was doing. */
      const stars = (html.match(/>\*</g) || []).length;
      eq(stars, 1, 'ORGDET: exactly one required marker is painted, on the name');
    } finally {
      G.USERS = G.USERS.filter(function (u) { return u && u.id !== 'orgdet_admin'; });
      G.currentUserId = _uid; G.currentModal = _modal; G.renderOrgModal();
    }
  })();
})();

/* ─── NOTIFY: the email notification component, per the 3 Sep 2026 directive ───
   The component was built in July and has been inert ever since, waiting for
   the AWS service. What is pinned here is everything that must be true BEFORE
   somebody sets the URL, because after that a mistake is an email nobody meant
   to send — or, worse, one program's notifications posted to another's path.

   The shape the directive assumes — one app file, one constant — is not the
   shape here. This shell is shared: the Pipeline, Executive Readiness and
   Responsible AI Governance all run js/features/email.js, so there is one
   constant for three programs. The body does not name the app it came from
   (Part 6 forbids changing the fields), so the app is named in the PATH, which
   is what Part 3 point 3 prescribes.                                        */
(function () {
  const _snap = JSON.stringify(G.data);
  const _ep = G.NOTIFY_ENDPOINT;

  /* ── 1. it ships INERT ──
     The one thing that must hold on every commit until the service is live.
     A URL left in the file by accident is the failure this catches. */
  eq(G.NOTIFY_ENDPOINT, '', 'NOTIFY: the endpoint ships empty — the component is inert until deliberately switched on');
  eq(G.notifyEndpoint(), '', 'NOTIFY: and resolves to no URL, so dispatch returns before any fetch');

  /* ── 2. each program posts to its OWN path ──
     One shared component, three programs. Getting this wrong sends Governance's
     completion reports to the Pipeline's queue, which the service cannot detect
     because the body carries no app name. */
  const activeId = G.Modules.activeId();
  try {
    G.NOTIFY_ENDPOINT = 'https://notify.example.com/notify';
    eq(G.notifyEndpoint(), 'https://notify.example.com/notify/' + (G.NOTIFY_PATHS[activeId] || activeId),
      'NOTIFY: the active program is named in the path');

    /* A trailing slash on the base must not double up. Compared against the
       slash-free answer rather than searched for '//', which matches the
       protocol's own slashes and fails for a reason that has nothing to do
       with the base. */
    G.NOTIFY_ENDPOINT = 'https://notify.example.com/notify';
    const clean = G.notifyEndpoint();
    G.NOTIFY_ENDPOINT = 'https://notify.example.com/notify/';
    eq(G.notifyEndpoint(), clean, 'NOTIFY: a trailing slash on the base gives the same URL, not a doubled one');

    /* The service's names are its own: renaming a path must not mean touching
       the dispatch logic, so the map is the seam and it is honoured. */
    G.NOTIFY_ENDPOINT = 'https://notify.example.com/notify';
    const _paths = G.NOTIFY_PATHS[activeId];
    G.NOTIFY_PATHS[activeId] = 'renamed-by-the-service';
    eq(G.notifyEndpoint(), 'https://notify.example.com/notify/renamed-by-the-service',
      'NOTIFY: the path name comes from NOTIFY_PATHS, not from the module id');
    G.NOTIFY_PATHS[activeId] = _paths;

    /* Every live program must have a path. An unlisted one falls back to its
       module id, which is safe but silent — so the three are pinned by name. */
    ['pipeline', 'exec-readiness', 'ai-governance'].forEach(id => {
      ok(!!G.NOTIFY_PATHS[id], 'NOTIFY: "' + id + '" has a service path of its own');
    });
  } finally { G.NOTIFY_ENDPOINT = _ep; }

  /* ── 3. the request body is EXACTLY the eight fields of Part 3 ──
     "Do not change the JSON fields the app sends, their names, or the order in
     which things happen." So the body is asserted field by field, against a
     captured request rather than by reading the source. */
  (function () {
    const _fetch = G.fetch;
    let sent = null;
    G.NOTIFY_ENDPOINT = 'https://notify.example.com/notify';
    G.fetch = (url, opts) => {
      sent = { url: url, opts: opts };
      /* The dispatcher reads r.ok, then commits and renders. A thenable that
         settles synchronously keeps this in the same tick, the way the rest of
         this harness treats fetch. */
      return { then: function (f) { try { f({ ok: true, status: 200 }); } catch (e) { } return { catch: function () { } }; } };
    };
    try {
      G.data.enterprise = { name: 'Aurora Glass' };
      G.data.notifications = [];
      G.notifyQueue('step-complete', 'Step 1.1 – Assessment Battery complete – analytics report',
        ['a@x.example', 'b@x.example'], '1.1', true);

      ok(!!sent, 'NOTIFY: a queued notification is dispatched');
      ok(/^https:\/\//.test(sent.url), 'NOTIFY: over https — a browser blocks plain http from an https page');
      eq(sent.opts.method, 'POST', 'NOTIFY: by POST');
      eq(sent.opts.headers['Content-Type'], 'application/json', 'NOTIFY: as JSON');

      const body = JSON.parse(sent.opts.body);
      eq(Object.keys(body).sort().join(','), 'html,kind,orgName,pdf,sentAt,stepId,subject,to',
        'NOTIFY: the body carries exactly the eight fields of Part 3, and no others');
      eq(body.kind, 'step-complete', 'NOTIFY: kind');
      eq(body.stepId, '1.1', 'NOTIFY: stepId');
      eq(body.orgName, 'Aurora Glass', 'NOTIFY: orgName is the organization as entered');
      eq(body.pdf, true, 'NOTIFY: a completion report asks for the PDF');
      ok(/^\d{4}-\d{2}-\d{2}T.*Z$/.test(body.sentAt), 'NOTIFY: sentAt is an ISO 8601 string');
      ok(Array.isArray(body.to) && body.to.length === 2, 'NOTIFY: `to` is a list of addresses');
      ok(!('apiKey' in body) && !('module' in body) && !('app' in body),
        'NOTIFY: nothing was added to the body — the app is named in the URL, not the payload');
      ok(!sent.opts.headers.Authorization && !sent.opts.headers['X-Api-Key'],
        'NOTIFY: no authentication header — a key belongs in the URL (Part 3 point 1)');

      /* Part 3 point 2: a 2xx is 'sent'. */
      eq((G.data.notifications[G.data.notifications.length - 1] || {}).status, 'sent',
        'NOTIFY: a 2xx response records the notification as sent');
    } finally { G.fetch = _fetch; G.NOTIFY_ENDPOINT = _ep; }
  })();

  /* ── 4. a dead service must not break the app (Part 5, test 5) ── */
  (function () {
    const _fetch = G.fetch;
    G.NOTIFY_ENDPOINT = 'https://no-such-host.invalid/notify';
    G.fetch = () => { throw new Error('DNS failure'); };
    try {
      G.data.notifications = [];
      let threw = false;
      try { G.notifyQueue('step-complete', 'Step 1.2 complete – analytics report', ['a@x.example'], '1.2', true); }
      catch (e) { threw = true; }
      ok(!threw, 'NOTIFY: a service that cannot be reached does not throw into the app');
      eq((G.data.notifications[0] || {}).status, 'failed',
        'NOTIFY: the failure is recorded rather than shown to the user');
    } finally { G.fetch = _fetch; G.NOTIFY_ENDPOINT = _ep; }
  })();

  /* ── 5. while unconfigured, the outbox says so ── */
  G.data.notifications = [];
  G.notifyQueue('step-complete', 'Step 1.3 complete – analytics report', ['a@x.example'], '1.3', true);
  eq((G.data.notifications[0] || {}).status, 'pending – endpoint not configured',
    'NOTIFY: with no endpoint the record says exactly that — the string Part 5 tells a tester to look for');
  ok(G.data.notifications.length === 1, 'NOTIFY: and it is still recorded, so nothing is lost while the service is down');

  G.NOTIFY_ENDPOINT = _ep;
  G.data = JSON.parse(_snap); G.saveData();
})();

/* ── MAIL: the step-complete email is always the analytics report ──
   notifyEmailHtml() built its body from a bare mgmtHubContent(), which
   renders whichever Track Program tab UI.mgTab happens to hold in this
   browser. Leaving the page on Assignments therefore mailed the
   assignment list under a subject line promising the analytics report.
   mgmtHubContent now takes a forceTab, and the email pins tab 1. */
(function(){
  const _tab = G.UI.mgTab;
  const mail = () => G.notifyEmailHtml({ kind:'step-complete', subject:'Step 1.1 complete', stepId:'1.1', at: Date.now() });
  // markers unique to each tab's body
  const ANALYTICS = ['90-Day Burn-up','Module Velocity','Workload by Member','Signals'];

  /* ── the reported case: Assignments left open on screen ── */
  G.UI.mgTab = 0;
  const fromAssignments = mail();
  ANALYTICS.forEach(m => has(fromAssignments, m, 'MAIL: with Assignments on screen, the email still carries "' + m + '"'));
  // "This Week" and its subtitle are assignments-only; phase names appear on
  // BOTH tabs (the analytics Signals card lists per-phase completion), so they
  // are not a discriminator.
  ok(fromAssignments.indexOf('This Week') < 0, 'MAIL: the assignment tab’s body is not in the email');
  ok(fromAssignments.indexOf('Steps overdue or due within seven days') < 0, 'MAIL: the assignment tab’s due list is not in the email');
  eq(G.UI.mgTab, 0, 'MAIL: building the email does not disturb the tab the user has open');

  /* ── and it is the same email from the analytics tab ── */
  G.UI.mgTab = 1;
  const fromAnalytics = mail();
  ANALYTICS.forEach(m => has(fromAnalytics, m, 'MAIL: with Analytics on screen, the email carries "' + m + '"'));
  eq(fromAssignments, fromAnalytics, 'MAIL: the email is identical whichever tab is open — it no longer depends on the browser');

  /* ── the tab switcher is dead UI in an email ── */
  ok(fromAssignments.indexOf('UI.mgTab=') < 0, 'MAIL: the email carries no tab-switch buttons');

  /* ── the other notification kind is unaffected ── */
  const reminder = G.notifyEmailHtml({ kind:'deadline-reminder', subject:'Step 4.2 due', stepId:'4.2', at: Date.now() });
  ok(reminder.indexOf('90-Day Burn-up') < 0, 'MAIL: a deadline reminder still carries no hub body');
  has(reminder, 'due within one week', 'MAIL: the deadline reminder keeps its own copy');

  /* ── on screen, the tabs still work ── */
  G.UI.mgTab = 0;
  const screen0 = G.renderMgmtHub();
  has(screen0, 'This Week', 'MAIL: on screen, the Assignments tab still shows its own body');
  has(screen0, 'UI.mgTab=1', 'MAIL: on screen, the tab switcher is still rendered');
  G.UI.mgTab = 1;
  const screen1 = G.renderMgmtHub();
  has(screen1, '90-Day Burn-up', 'MAIL: on screen, the Analytics tab still shows its own body');
  ok(screen1.indexOf('This Week') < 0, 'MAIL: the two tabs still render different bodies on screen');

  G.UI.mgTab = _tab;
})();

/* ── PDFBTN: one PDF control, one form, everywhere ───────────────
   Every PDF/print control routes through pdfBtn() rather than sizing
   its own btn(), so the label, size and placement cannot drift apart
   per page. This pins the emitted markup exactly and sweeps every
   surface for a print control that bypassed the helper. */
(function(){
  const _sec = G.UI.sec, _ap = G.UI.ap;
  const DOCK   = '<button class="pdf-btn pdf-btn-dock" onclick="printReport()" title="Download this page as a PDF">▾ Save as PDF</button>';
  const INLINE = '<button class="pdf-btn pdf-btn-inline" onclick="printReport()" title="Download this page as a PDF">▾ Save as PDF</button>';
  eq(G.pdfBtn('printReport()'), DOCK, 'PDFBTN: the docked control is the standard ▾ Save as PDF button');
  eq(G.pdfBtn('printReport()', true), INLINE, 'PDFBTN: the inline variant differs only in its placement class');

  const variants = new Map(), strays = [];
  const harvest = h => {
    if (typeof h !== 'string') return;
    for (const m of h.matchAll(/<button[^>]*class="pdf-btn[^"]*"[^>]*>[^<]*<\/button>/g))
      variants.set(m[0].replace(/onclick="[^"]*"/, 'onclick="X"'), 1);
    // a print/PDF control that did NOT come from pdfBtn()
    for (const m of h.matchAll(/<button(?![^>]*class="pdf-btn)[^>]*>[^<]*(?:PDF|Print this|↓ )[^<]*<\/button>/gi))
      strays.push(m[0].slice(0, 120));
  };
  Object.keys(G).filter(k => /^(render|viz)/.test(k) && typeof G[k] === 'function').forEach(fn => {
    ['1.1','1.5'].forEach(s => { G.UI.sec = s; [null, 11, 17].forEach(ap => { G.UI.ap = ap; try { harvest(G[fn]()); } catch (e) { } }); });
  });
  (G.data.ideas || []).forEach((_, i) => { try { harvest(G.bpBudgetTab(i, true)); } catch (e) { } });

  ok(variants.size > 0, 'PDFBTN: the sweep found PDF controls to check');
  eq([...variants.keys()].sort(), [
    '<button class="pdf-btn pdf-btn-dock" onclick="X" title="Download this page as a PDF">▾ Save as PDF</button>',
    '<button class="pdf-btn pdf-btn-inline" onclick="X" title="Download this page as a PDF">▾ Save as PDF</button>'
  ], 'PDFBTN: every rendered PDF control is one of the two standard forms — no per-page variation');
  eq(strays, [], 'PDFBTN: no print/PDF control bypasses the pdfBtn() helper');

  G.UI.sec = _sec; G.UI.ap = _ap;
})();

/* ── TOKENS: the :root / [data-theme="dark"] blocks hold together ──
   The family standard is that these two blocks stay identical across
   modules. Without the spec file in this workspace the harness cannot
   diff against it, so it pins the invariants that ARE checkable from
   here: every --*-rgb triplet is the exact channel decomposition of its
   hex partner, every colour that carries alpha washes has a triplet,
   and the two blocks agree on which tokens are theme-variant. That is
   what catches a drifted or missing token mechanically. */
(function(){
  const cssPath = path.join(ROOT, 'assets', 'css', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const blockOf = (start) => { const i = css.indexOf(start); const j = css.indexOf('}', i); return css.slice(i, j); };
  const parse = (t) => { const m = {}; for (const x of t.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) m[x[1]] = x[2].trim().replace(/\s+/g, ' '); return m; };
  const root = parse(blockOf(':root {'));
  const dark = parse(blockOf('[data-theme="dark"] {'));

  ok(Object.keys(root).length > 40, 'TOKENS: the :root token block parsed (' + Object.keys(root).length + ' tokens)');
  ok(Object.keys(dark).length > 25, 'TOKENS: the dark token block parsed (' + Object.keys(dark).length + ' tokens)');

  /* every triplet is exactly its hex partner's channels */
  const hex2rgb = h => h.replace('#','').match(/../g).map(x => parseInt(x, 16)).join(', ');
  [['--ink','--bg-rgb'], ['--paper','--fg-rgb'], ['--text-faint','--faint-rgb'], ['--gold','--gold-rgb']].forEach(([hexT, rgbT]) => {
    [['light', root], ['dark', dark]].forEach(([nm, o]) => {
      if (o[hexT] === undefined || !/^#/.test(o[hexT])) return;
      if (o[rgbT] === undefined) { ok(nm === 'dark', 'TOKENS: ' + nm + ' defines ' + rgbT + ' for ' + hexT); return; }
      eq(o[rgbT], hex2rgb(o[hexT]), 'TOKENS: ' + nm + ' ' + rgbT + ' is the channel triplet of ' + hexT + ' (' + o[hexT] + ')');
    });
  });

  /* the gold wash token exists and matches the literal used throughout the file */
  eq(root['--gold-rgb'], '232, 98, 26', 'TOKENS: --gold-rgb is present and equals --gold’s channels');
  /* The washes are TOKENISED, not literal. They used to be written
     rgba(232, 98, 26, …) — the Pipeline's orange, hard-coded — which was
     harmless while every program shared one accent and became the reason
     a themed program still had orange hovers and orange rails. The
     literal must not come back: assets/css/themes.css re-points
     --gold-rgb per program, and a literal is exactly what it cannot
     reach. Comments may still name the colour, so strip those first. */
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(cssNoComments.indexOf('rgba(var(--gold-rgb),') > 0,
     'TOKENS: the accent alpha washes are written against --gold-rgb');
  eq((cssNoComments.match(/rgba\(\s*232\s*,\s*98\s*,\s*26/g) || []).length, 0,
     'TOKENS: no accent wash is hard-coded to the Pipeline’s orange');
  ok(dark['--gold'] === undefined && dark['--gold-rgb'] === undefined,
     'TOKENS: gold stays theme-invariant — neither --gold nor --gold-rgb is overridden on dark');

  /* the two blocks agree on what is theme-variant: every token the dark
     block overrides must exist in :root, or dark is inventing a token */
  const orphan = Object.keys(dark).filter(k => root[k] === undefined);
  eq(orphan, [], 'TOKENS: the dark block overrides only tokens that :root defines');

  /* PAPER IS ALWAYS LIGHT. @media print re-declares the light values so a print
     taken from the dark theme is dark type on white, not light type on nothing.
     That matters most on Safari, which does not paint backgrounds unless the
     reader asks it to — the dark fills drop out and light text is left on bare
     white. So every token the dark block overrides has to be answered in the
     print block; one missed token is one element printing its dark value. */
  const paper = parse(blockOf(':root[data-theme="dark"] {'));
  ok(Object.keys(paper).length > 25, 'PRINT: the @media print token block parsed (' + Object.keys(paper).length + ' tokens)');
  eq(Object.keys(dark).filter(k => paper[k] === undefined), [],
     'PRINT: every token the dark theme overrides is put back to a light value for paper');
  eq(paper['--paper'], root['--paper'], 'PRINT: --paper on paper is the light theme’s, not the dark theme’s');
  ok(/print-color-adjust:\s*exact/.test(css), 'PRINT: phase colours and tints are asked for rather than dropped');
  ok(/html\.is-printing\s+body>\*:not\(#pdfPrintRoot\)/.test(css.replace(/\s*>\s*/g, '>')),
     'PRINT: the ↓ PDF export root is the only thing that prints while exporting');

  /* no token is left empty or referencing itself */
  Object.keys(root).forEach(k => {
    ok(root[k] !== '' && root[k].indexOf('var(' + k + ')') < 0, 'TOKENS: ' + k + ' has a usable value');
  });
})();

/* ── THEME: dark default, toggle, persistence, reseed immunity ──
   The app boots DARK and only goes light once the user asks for it
   (app.js: `UI.theme = (t === 'light') ? 'light' : 'dark'`, and the
   pre-paint stamp in index.html reads the same way). The expectations
   below follow the dark-first order — boot dark, toggle into light,
   setTheme back to dark. Every check is preserved. */
(function(){
  eq(G.UI.theme, 'dark', 'THEME: boots dark by default');
  ok(localStorageStub.getItem('pipeline-theme') !== 'light', 'THEME: no light preference written until the user chooses (the session seal stores the dark default, Part S, 2 Oct 2026)');
  has(G.printThemeTokens(), '--paper:#1E2530', 'THEME: print windows define the light tokens');
  has(G.printThemeTokens(), "--mono:'DM Mono'", 'THEME: print tokens carry the font faces');
  noThrow(() => G.toggleTheme(), 'THEME: toggleTheme() runs (incl. its render())');
  eq(G.UI.theme, 'light', 'THEME: toggle flips dark to light');
  eq(localStorageStub.getItem('pipeline-theme'), 'light', 'THEME: light preference persists to pipeline-theme');
  noThrow(() => G.seedData(), 'THEME: reseed runs under light');
  eq(G.UI.theme, 'light', 'THEME: seedData() leaves the theme untouched');
  eq(localStorageStub.getItem('pipeline-theme'), 'light', 'THEME: reseed leaves the stored preference untouched');
  // The nav renders only behind the entry gate, so borrow a seeded identity
  // (same fixture pattern as the harness bootstrap) for the menu assertions.
  const _prevUser = G.currentUserId;
  G.currentUserId = (G.USERS[0] || {}).id || null;
  ok(!!G.getCurrentUser(), 'THEME: menu fixture signs in a seeded user');
  G.UI.navMore = true; G.render();
  has(G.document.getElementById('navRight').innerHTML, 'Dark Mode', 'THEME: the top-bar toggle offers dark from light');
  G.setTheme('dark');
  eq(G.UI.theme, 'dark', 'THEME: setTheme restores dark');
  eq(localStorageStub.getItem('pipeline-theme'), 'dark', 'THEME: dark preference persists');
  G.UI.navMore = true; G.render();
  has(G.document.getElementById('navRight').innerHTML, 'Light Mode', 'THEME: the top-bar toggle offers the return path from dark');
  has(G.document.getElementById('navRight').innerHTML, 'Track Program</button>', 'THEME: Track Program lives in the More menu');
  /* Sign-in applies the reader's OWN choice (login / setup / admin all route
     through applyLoginTheme). It used to force dark and overwrite the stored
     preference with it, so choosing Light Mode lasted one session and the next
     login silently undid it. Every program now ships a light palette built and
     contrast-checked beside its dark one (assets/css/themes.css), so the
     preference is worth keeping — and a preference that does not survive the
     thing you do most often is not a preference. */
  G.setTheme('light');
  noThrow(() => G.applyLoginTheme(), 'THEME: applyLoginTheme() runs');
  eq(G.UI.theme, 'light', 'THEME: a sign-in keeps the reader’s chosen light mode');
  eq(localStorageStub.getItem('pipeline-theme'), 'light', 'THEME: signing in does not overwrite the stored preference');
  /* …and dark is still the default for anyone who has never chosen. */
  localStorageStub.removeItem('pipeline-theme');
  G.applyLoginTheme();
  eq(G.UI.theme, 'dark', 'THEME: with no preference stored, a sign-in lands in dark');
  G.UI.navMore = false; G.currentUserId = _prevUser; G.render();
})();

/* ── MODSW: program modules — registry, switcher, isolation ──
   The app runs several 90-day programs over one shared shell. The registry
   (js/modules/registry.js) says which exist and which is running; the switcher
   in the header is the only way between them. What must hold: exactly one
   module is live at a time, the shell takes its phases/data/greeting from that
   module, the Pipeline's storage keys and API calls are untouched by any of
   this, and a module with no code yet can be listed without being enterable. */
(() => {
  const M = G.Modules;
  ok(!!M, 'MODSW: the module registry loads');
  const list = M.list();
  ok(list.length >= 2, 'MODSW: the registry carries every program module');
  eq(new Set(list.map(m => m.id)).size, list.length, 'MODSW: module ids are unique');
  ok(list.every(m => m.name && m.sub && m.title && m.logo), 'MODSW: every module has a name, blurb, title and wordmark');
  eq(M.activeId(), 'pipeline', 'MODSW: with no ?module= and no preference, the Pipeline runs');
  eq(M.active().id, 'pipeline', 'MODSW: the active entry resolves');
  eq(M.isActive('exec-readiness'), false, 'MODSW: only one module is active at a time');
  eq(!!M.byId('exec-readiness'), true, 'MODSW: Executive Readiness is registered');
  eq(M.byId('nope'), null, 'MODSW: an unknown id resolves to nothing');

  // The shell reads the program's content off the active module, not off itself.
  ok(!!M.runtime(), 'MODSW: the active module registered its runtime');
  eq(M.runtime().id, 'pipeline', 'MODSW: the runtime is the active module\'s');
  eq(G.PH, M.PH(), 'MODSW: the shell\'s phases come from the module');
  eq(G.PH.length, 5, 'MODSW: the Pipeline still has its five phases');
  eq(G.MILESTONES['1.1'], M.MILESTONES()['1.1'], 'MODSW: milestones come from the module');
  eq(G.PHASE_WRAPUPS[1], M.PHASE_WRAPUPS()[1], 'MODSW: phase wrap-ups come from the module');
  ok('ideas' in G.emptyData() && 'capital' in G.emptyData(), 'MODSW: emptyData() is the module\'s document shape');
  has(G.coachMsgs[0].text, 'AI Innovation Pipeline', 'MODSW: the AI Guide opens in the module\'s voice');

  // Storage: the Pipeline keeps the keys it has always used, so no workspace
  // saved before the app had a second program moves or is orphaned.
  eq(G.Store.orgKey('org1'), 'pipeline-org-data::org1', 'MODSW: the Pipeline\'s workspace key is unsuffixed');
  eq(M.templatePath('home'), 'templates/home.html', 'MODSW: the Pipeline reads the shared templates');
  eq(M.templateKey('learn'), 'learn', 'MODSW: the Pipeline\'s bundle keys are unprefixed');
  eq(M.templatePath('nav'), 'templates/nav.html', 'MODSW: shell chrome is never module-scoped');

  // The nav only renders behind the entry gate — borrow a seeded identity.
  const _prevUser = G.currentUserId;
  G.currentUserId = (G.USERS[0] || {}).id || null;
  G.UI.navModules = false; G.render();
  const closed = G.document.getElementById('navRight').innerHTML;
  has(closed, 'AI Innovation Pipeline', 'MODSW: the trigger names the running module');
  ok(closed.indexOf('nav-module-menu') < 0, 'MODSW: the menu stays shut until asked for');

  noThrow(() => G.toggleNavModules(), 'MODSW: toggleNavModules() runs');
  eq(G.UI.navModules, true, 'MODSW: the toggle opens the menu');
  const open = G.document.getElementById('navRight').innerHTML;
  has(open, 'nav-module-menu', 'MODSW: the open menu renders');
  has(open, 'Executive Readiness', 'MODSW: the other module is offered');
  has(open, 'data-module="exec-readiness"', 'MODSW: each row carries its module id');
  has(open, 'nav-module-item-on', 'MODSW: the running module is marked');
  has(open, '>Current<', 'MODSW: the running module says so');
  has(open, 'aria-expanded="true"', 'MODSW: the trigger reports its open state');

  // Opening the module menu closes the More menu — they overlap in the bar.
  G.UI.navMore = true; G.UI.navModules = false;
  G.toggleNavModules();
  eq(G.UI.navMore, false, 'MODSW: opening the switcher closes the More menu');

  // Picking the running module is a no-op beyond closing the menu.
  const _href = G.location.href;
  noThrow(() => M.select('pipeline'), 'MODSW: selecting the running module runs');
  eq(G.UI.navModules, false, 'MODSW: selecting closes the menu');
  eq(G.location.href, _href, 'MODSW: selecting the running module does not reload');

  // Switching is a reload of the same shell with ?module=, so only one
  // program's code is ever on the page. The choice is remembered.
  M.select('exec-readiness');
  has(G.location.href, '?module=exec-readiness', 'MODSW: switching reloads into the other module');
  eq(localStorageStub.getItem('pipeline-module'), 'exec-readiness', 'MODSW: the chosen module is remembered');
  G.location.href = _href;

  // A module that is listed but has no code yet is shown and refused.
  list.push({ id: 'tmp-soon', name: 'Not Built Yet', sub: 'Placeholder.', title: 'x', logo: {}, scripts: [] });
  G.UI.navModules = true; G.render();
  const withSoon = G.document.getElementById('navRight').innerHTML;
  has(withSoon, 'nav-module-item-soon', 'MODSW: an unbuilt module is dimmed');
  has(withSoon, '>Soon<', 'MODSW: an unbuilt module is labelled Soon');
  has(withSoon, 'disabled', 'MODSW: an unbuilt module is not clickable');
  M.select('no-such-module');   // must not throw or navigate
  eq(G.location.href, _href, 'MODSW: an unknown id does nothing');
  list.pop();

  G.UI.navModules = false; G.currentUserId = _prevUser; G.render();
})();

/* ── ASGN: the account menu and My Assignments ──────────────
   The signed-in chip used to sign out on first click. It is now a menu —
   Org Profile · View Assignments · Sign Out — and the middle item is the
   only new surface: the steps data.assigns names this user on, as a modal
   and as a card under the 90-day timeline (js/features/my-assignments.js).

   What must hold: the chip opens a menu instead of signing out; the menu is
   offered only where there is something behind it; the list is ordered and
   sectioned by the rules that were ruled on (dated soonest-first, undated
   after in program order, completed greyed at the foot); the card gates on
   OPEN work; and an open modal repaints from a render so a step somebody
   else completed moves itself. */
(() => {
  const _prevUser = G.currentUserId, _prevDoc = JSON.stringify(G.data);
  G.seedData();
  const me = (G.USERS[0] || {}).id, other = (G.USERS[1] || {}).id || 'nobody';
  G.currentUserId = me;
  ok(!!G.getCurrentUser(), 'ASGN: fixture signs in a seeded user');

  const steps = G.mgSteps();
  const [s1, s2, s3, s4] = steps;
  const day = n => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
  /* Step names reach the markup escaped — 'Filter & Rank' is 'Filter &amp; Rank'
     there — so every position check below looks for the escaped form. */
  const [n1, n2, n3, n4] = [s1, s2, s3, s4].map(x => G.esc(x.name));

  /* ── the chip is a menu, not a sign-out button ── */
  G.UI.userMenu = false; G.render();
  const shut = G.document.getElementById('navRight').innerHTML;
  has(shut, 'data-act="usermenu"', 'ASGN: the chip opens the account menu');
  ok(shut.indexOf('nav-user-chip" data-act="signout"') < 0, 'ASGN: the chip no longer signs out on first click');
  ok(shut.indexOf('nav-more-menu') < 0, 'ASGN: the menu stays shut until asked for');
  has(shut, 'aria-expanded="false"', 'ASGN: the shut chip reports its state');

  noThrow(() => G.toggleUserMenu(), 'ASGN: toggleUserMenu() runs');
  eq(G.UI.userMenu, true, 'ASGN: the toggle opens the menu');
  const open = G.document.getElementById('navRight').innerHTML;
  has(open, 'nav-user-wrap', 'ASGN: the menu hangs from its own wrapper');
  has(open, 'nav-user-chip-on', 'ASGN: the open chip is marked');
  has(open, 'Org Profile</button>', 'ASGN: item 1 is Org Profile');
  has(open, 'View Assignments</button>', 'ASGN: item 2 is View Assignments');
  has(open, 'Sign Out</button>', 'ASGN: item 3 is Sign Out');
  ok(open.indexOf('Org Profile') < open.indexOf('View Assignments')
    && open.indexOf('View Assignments') < open.indexOf('Sign Out'), 'ASGN: the three items are in order');
  has(open, 'data-act="close-usermenu"', 'ASGN: a backdrop closes the menu');
  /* The outside-click closer in app.js finds the More menu with
     querySelector('.nav-more-wrap') — the FIRST match in the document. A second
     element carrying that class would make every click inside the More menu
     read as a click outside it, so the account menu must not borrow it. */
  eq((open.match(/nav-more-wrap/g) || []).length, 1, 'ASGN: the account menu does not borrow .nav-more-wrap');

  /* Opening one nav menu closes the others — they overlap in the bar. */
  G.UI.navMore = true; G.UI.userMenu = false;
  G.toggleUserMenu();
  eq(G.UI.navMore, false, 'ASGN: opening the account menu closes the More menu');
  /* …and the reverse: the More menu and the switcher close the account menu.
     Its backdrop covers their triggers, so this is only reachable from script —
     but a dropdown left open behind another one is the next bug. */
  G.UI.userMenu = true; G.toggleNavMore();
  eq(G.UI.userMenu, false, 'ASGN: opening the More menu closes the account menu');
  G.UI.navMore = false; G.UI.userMenu = true; G.toggleNavModules();
  eq(G.UI.userMenu, false, 'ASGN: opening the module switcher closes the account menu');
  G.UI.navModules = false;
  noThrow(() => G.closeUserMenu(), 'ASGN: closeUserMenu() runs');
  eq(G.UI.userMenu, false, 'ASGN: the backdrop action shuts the menu');

  /* ── offered only where there is an assignment system ── */
  const rt = G.Modules.runtime(), _ph = rt.PH;
  rt.PH = [];   // a Leaders program: one decision at a time, no phase spine
  eq(G.asgnAvailable(), false, 'ASGN: a program with no phases has no assignments list');
  G.UI.userMenu = true; G.render();
  ok(G.document.getElementById('navRight').innerHTML.indexOf('View Assignments') < 0,
    'ASGN: and is not offered the menu item');
  rt.PH = _ph;
  G.UI.userMenu = false; G.render();
  eq(G.asgnAvailable(), true, 'ASGN: a phased program is offered the list');

  /* ── the list: empty, open, ordered, completed ── */
  G.data.assigns = {}; G.data.stepDue = {}; G.data.completedSteps = {};
  G.openAssignments();
  eq(G.currentModal, 'assignments', 'ASGN: opening sets the modal flag');
  const none = G.document.getElementById('modalRoot').innerHTML;
  has(none, 'My Assignments', 'ASGN: the modal is headed My Assignments');
  has(none, G.getCurrentUser().name, 'ASGN: it names the signed-in user');
  has(none, 'No assignments yet.', 'ASGN: no assignments at all reads as such');

  /* s1 undated, s2 due next week, s3 overdue, s4 assigned to somebody else. */
  G.data.assigns[s1.id] = [me];
  G.data.assigns[s2.id] = [me];
  G.data.assigns[s3.id] = [me];
  G.data.assigns[s4.id] = [other];
  G.data.stepDue[s2.id] = day(7);
  G.data.stepDue[s3.id] = day(-3);
  G.renderAssignmentsModal();
  const list = G.document.getElementById('modalRoot').innerHTML;
  has(list, n1, 'ASGN: an assigned step is listed');
  ok(list.indexOf(n4) < 0, 'ASGN: another member\'s assignment is not');
  has(list, 'Phase ' + s1.ph.id, 'ASGN: each row carries its phase');
  has(list, 'Due ' + G.fmtDate(day(7)), 'ASGN: a dated task shows its due date');
  has(list, 'Overdue · ' + G.fmtDate(day(-3)), 'ASGN: a past date reads as overdue');
  has(list, '#9B2D3F', 'ASGN: and is red');
  ok(list.indexOf(n3) >= 0 && list.indexOf(n3) < list.indexOf(n2) && list.indexOf(n2) < list.indexOf(n1),
    'ASGN: dated soonest-first, undated after in program order');
  ok(list.indexOf('>Completed</div>') < 0, 'ASGN: no Completed section while nothing is complete');

  /* ── the overview card gates on OPEN work ── */
  has(G.renderPipelineOverview(), 'My Assignments', 'ASGN: the overview card appears with open work');
  ok(G.renderPipelineOverview().indexOf('90-Day Timeline') < G.renderPipelineOverview().indexOf('My Assignments'),
    'ASGN: the card sits under the 90-day timeline');

  /* ── completing a step moves it, and an open modal repaints ── */
  G.data.completedSteps[s3.id] = true;
  G.render();   // the adoption cycle's repaint — the reader touched nothing
  const done = G.document.getElementById('modalRoot').innerHTML;
  has(done, '>Completed</div>', 'ASGN: a completed assignment gets a Completed section');
  has(done, '✓ Done', 'ASGN: and is marked Done');
  ok(done.indexOf(n2) >= 0 && done.indexOf(n2) < done.indexOf('>Completed</div>') && done.indexOf('>Completed</div>') < done.indexOf(n3),
    'ASGN: completed rows sit at the foot of the list');
  has(done, 'asgnGo(\'' + s3.id + '\')', 'ASGN: a completed row still opens its step');
  ok(done.indexOf('Overdue') < 0, 'ASGN: a completed assignment is no longer overdue');

  G.data.completedSteps[s1.id] = true;
  G.data.completedSteps[s2.id] = true;
  G.render();
  const allDone = G.document.getElementById('modalRoot').innerHTML;
  has(allDone, 'No open assignments.', 'ASGN: completed-only reads as no open assignments');
  has(allDone, '>Completed</div>', 'ASGN: the completed work is still listed');
  ok(G.renderPipelineOverview().indexOf('My Assignments') < 0,
    'ASGN: the overview card withdraws when the last open task completes');

  /* ── clicking a row lands on the step ── */
  noThrow(() => G.asgnGo(s1.id), 'ASGN: asgnGo() runs');
  eq(G.currentModal, null, 'ASGN: it closes the modal');
  eq(G.currentStep, s1.id, 'ASGN: and lands on the step');

  /* ── a program says which of its steps are assignable ── */
  const _as = rt.assignSteps;
  rt.assignSteps = () => [s1];   // Executive Readiness drops its individual-track steps
  eq(G.asgnSteps().length, 1, 'ASGN: a program can narrow the assignable step list');
  if (_as === undefined) delete rt.assignSteps; else rt.assignSteps = _as;
  eq(G.asgnSteps().length, steps.length, 'ASGN: and the shell\'s own list is the default');

  /* ── the app administrator is nobody in particular ── */
  G.isAppAdmin = true;
  eq(G.asgnAvailable(), false, 'ASGN: the app admin has no assignments list');
  G.UI.userMenu = true; G.render();
  const adm = G.document.getElementById('navRight').innerHTML;
  ok(adm.indexOf('View Assignments') < 0, 'ASGN: and is not offered it');
  ok(adm.indexOf('Org Profile') < 0, 'ASGN: nor Org Profile, which is not theirs either');
  has(adm, 'Sign Out</button>', 'ASGN: but can still sign out');
  G.isAppAdmin = false;

  G.UI.userMenu = false; G.currentModal = null;
  G.data = JSON.parse(_prevDoc); G.currentUserId = _prevUser; G.render();
})();

/* ── HELP: the "? Help" guide is per module, over shared blocks ──
   One overlay, one set of styles, in every program — but the content is the
   active module's (js/modules/<id>/help.js), and the parts that describe
   features every module has are written once in js/features/help.js and
   pulled in by reference. What must hold: the guide names the running
   program, its own sections render, the shared blocks render, a module can
   extend the shared tool list without forking it, every { shared } id a
   module references actually exists, and a module with no guide still gets
   a usable overlay rather than an empty box. */
(() => {
  const _prevUser = G.currentUserId;
  G.currentUserId = (G.USERS[0] || {}).id || null;

  noThrow(() => G.openHelp(), 'HELP: openHelp() runs');
  eq(G.currentModal, 'help', 'HELP: the modal flag is set');
  const h = G.document.getElementById('modalRoot').innerHTML;

  // The running module's own content.
  has(h, '90-Day AI Innovation Pipeline', 'HELP: the guide is titled for the running module');
  has(h, 'Faisal Hoque’s published frameworks', 'HELP: the module\'s intro renders');
  has(h, 'What This Is', 'HELP: a body section renders');
  has(h, 'The Five Phases', 'HELP: the phase list renders');
  has(h, 'Diagnose – Days 1–30', 'HELP: phases carry the module\'s own names');
  has(h, 'Blue Sky', 'HELP: the funnel strip renders');
  has(h, 'How the Money Works', 'HELP: module-specific mechanics render');

  // The shared blocks, by reference — not copied into the module.
  has(h, 'Signing In', 'HELP: the shared sign-in block renders');
  has(h, 'Switching Modules', 'HELP: the shared module-switching block renders');
  has(h, 'Track Program', 'HELP: the shared Track Program block renders');
  has(h, 'Data &amp; Privacy', 'HELP: the shared privacy block renders');
  has(h, 'stored centrally on the program’s servers', 'HELP: privacy text reflects the server-backed workspace');
  has(h, 'Got It', 'HELP: the guide can be dismissed');

  // A module extends the shared tool list rather than forking it.
  has(h, '≡ Team Chat', 'HELP: shared tools render');
  has(h, 'Pipeline commands', 'HELP: the module\'s extra tool entries are appended');
  ok(h.indexOf('≡ Team Chat') < h.indexOf('Pipeline commands'), 'HELP: module extras follow the shared entries');

  // Every { shared: … } a module names must exist, or the section renders blank.
  const doc = G.Modules.help();
  const sharedIds = (doc.sections || []).filter(s => s.shared).map(s => s.shared);
  ok(sharedIds.length > 0, 'HELP: the module leans on the shared blocks');
  ok(sharedIds.every(id => !!G.HELP_SHARED[id]), 'HELP: every shared block a module references exists');

  // Structure: no section is empty (a typo'd kind would render a bare title).
  const kinds = ['body', 'rows', 'phases', 'funnel', 'tools'];
  ok((doc.sections || []).every(s => s.shared || kinds.some(k => s[k])), 'HELP: every section carries content');

  // A module with no guide of its own still gets the shared shell described.
  const rt = G.Modules.runtime(), _help = rt.help;
  rt.help = null;
  G.openHelp();
  const bare = G.document.getElementById('modalRoot').innerHTML;
  has(bare, 'AI Innovation Pipeline', 'HELP: a module with no guide is still named');
  has(bare, 'Signing In', 'HELP: a module with no guide still documents the shared shell');
  ok(bare.indexOf('The Five Phases') < 0, 'HELP: and claims no program content it does not have');
  rt.help = _help;

  G.closeModal();
  eq(G.document.getElementById('modalRoot').innerHTML, '', 'HELP: closing clears the overlay');
  G.currentUserId = _prevUser;
})();


/* ── WARN: warning register themed for light mode (July 10) ── */
(() => {
  has(G.printThemeTokens(), '--warn-text:#8F6A00', 'WARN: print windows carry the light warning-text token');
  has(G.printThemeTokens(), '--warn-pale:#7E6A00', 'WARN: print windows carry the pale warning token');
  G.seedData();
  const p = G.renderStepAlloc() + G.renderCapHub();
  has(p, 'stroke="#E8D48B"', 'WARN: the contingency line keeps its literal stroke for the SVG remap (dark bit-identical)');
  has(p, 'stroke="#D4A017"', 'WARN: the capacity line keeps its literal stroke for the SVG remap');
})();

/* ── QA batch items 12–13 (July 10) ─────────────────────────── */
(() => {
  // Item 12: 1.3 empty state branches on WHY the grid is empty.
  G.seedData();
  G.getStages().bluesky.forEach(i => { G.data.ideas[i].when = 'future'; });
  const sParked = G.renderStep13();
  has(sParked, 'All remaining ideas are parked as Future', 'QA12: Future-parked-only empty state names the parked path');
  ok(sParked.indexOf('advanced to Step 2.4') === -1, 'QA12: the parked state does not render the advanced clause');
  G.seedData();
  G.getStages().bluesky.forEach(i => { if (G.data.selected.indexOf(i) < 0) G.data.selected.push(i); });
  const sAdv = G.renderStep13();
  has(sAdv, 'Selected ideas have advanced to Step 2.4', 'QA12: all-advanced empty state names the intake path');
  ok(sAdv.indexOf('parked as Future') === -1, 'QA12: the advanced state does not render the parked clause');
  // Item 13: third badge branch reads a real label; no literal undefined in 3.4's visible text.
  G.seedData();
  if (G.data.budgetPlans) delete G.data.budgetPlans[11];
  const sx = G.renderStepExp();
  has(sx, 'no program yet', 'QA13: a project with no defined phases badges as no program yet');
  ok(sx.replace(/<[^>]*>/g, ' ').indexOf('undefined') === -1, 'QA13: visible-text oracle \u2013 no literal undefined on 3.4 in the pre-fill state');
  G.seedData();
})();

// ===== PW: phase-complete wrap-up boxes (July 10) =====
(function(){
  const _page = G.currentPage, _step = G.currentStep, _ph = G.currentPhase;
  G.seedData();
  G.data.completedSteps = Object.assign({}, G.data.completedSteps, {'2.1':true,'2.2':true,'2.3':true,'2.4':true});
  G.currentPage = 'step'; G.currentPhase = G.PH.find(function(p){ return p.id === 2; }); G.currentStep = '2.4';
  const p24 = G.renderStep();
  has(p24, 'Phase 2 Complete', 'PW: the final step of a complete phase renders the phase-complete box');
  has(p24, 'machinery now exists', 'PW: the box carries the Phase 2 wrap-up copy');
  G.currentStep = '2.1';
  const p21 = G.renderStep();
  ok(p21.indexOf('Phase 2 Complete') === -1, 'PW: a non-final step of the complete phase does not render the box');
  const land = G.renderPhaseLandingPipe(2);
  has(land, 'Phase 2 Complete', 'PW: the phase landing shows the wrap-up at 100%');
  delete G.data.completedSteps['2.3']; G.currentStep = '2.4';
  const p24b = G.renderStep();
  ok(p24b.indexOf('Phase 2 Complete') === -1, 'PW: an incomplete phase renders no box');
  const landB = G.renderPhaseLandingPipe(2);
  ok(landB.indexOf('Phase 2 Complete') === -1, 'PW: the landing shows no wrap-up below 100%');
  G.seedData(); G.currentPage = _page; G.currentStep = _step; G.currentPhase = _ph;
})();

// ===== RVB: Revive replaces Sell on killed review rows (July 10) =====
(function(){
  G.seedData();
  if(!G.data.review)G.data.review={}; if(!G.data.review.items)G.data.review.items={};
  G.data.review.items[13]={decision:'sell'};
  if(!G.data.tracking)G.data.tracking={}; G.data.tracking[13]={status:'killed',killSunkIds:['x']};
  const r1 = G.renderStep44();
  has(r1, 'reviveReviewItem(13)', 'RVB: a killed row offers the green Revive button in Sell\u2019s slot');
  ok(r1.indexOf("setReviewDecision(13,'sell')") === -1, 'RVB: the Sell button is absent while killed');
  G.reviveReviewItem(13);
  ok(G.data.tracking[13].status === '' && !G.data.tracking[13].killSunkIds && !((G.data.review.items||{})[13]||{}).decision, 'RVB: Revive clears the kill, the frozen set, and the Sell decision');
  const r2 = G.renderStep44();
  ok(r2.indexOf("setReviewDecision(13,'sell')") >= 0 && r2.indexOf('reviveReviewItem(13)') === -1, 'RVB: after revive, Sell returns and Revive is gone');
  G.seedData();
})();

// ===== RST: Reset all data clears the program, not the organization =====
/* The workspace document caches org-level truth — the team, the company
   profile, the setup flag — inside every module's own copy, so a wholesale
   emptyData() reset read as "delete my organization": the roster went with it,
   which takes the signed-in user out of USERS and makes bootApp treat a valid
   session as stale. See clearData(), js/app.js. */
(function(){
  G.seedData();
  const _s = JSON.stringify(G.data);
  G.data.orgSetup = true;
  const roster0 = JSON.stringify(G.data.roster), ent0 = JSON.stringify(G.data.enterprise);
  const orgs0 = G.getOrgs().length;
  { const _ia10 = G.isAppAdmin; G.isAppAdmin = true; G.clearData(); G.isAppAdmin = _ia10; }   /* Sweep 4R item 10: Reset all data is an administrator's */
  ok((G.data.ideas||[]).length === 0 && Object.keys(G.data.projects||{}).length === 0,
     'RST: the program’s own content is cleared');
  ok(JSON.stringify(G.data.roster) === roster0, 'RST: the team roster survives the reset');
  ok(JSON.stringify(G.data.enterprise) === ent0, 'RST: the organization profile survives the reset');
  ok(G.data.orgSetup === true, 'RST: first-run setup is not re-armed');
  ok(G.getOrgs().length === orgs0, 'RST: no organization is removed');
  ok(G.USERS.length > 0 && JSON.stringify(G.USERS.map(u => u.id)) === JSON.stringify(JSON.parse(roster0).map(u => u.id)),
     'RST: USERS still holds the same team, so the session is not read as stale');
  const stored = G.Store.readOrg(G.currentOrgId) || {};
  ok((stored.ideas||[]).length === 0 && JSON.stringify(stored.roster) === roster0,
     'RST: what was persisted is the cleared document WITH the roster');
  G.data = JSON.parse(_s); G.saveData(); G.seedData();
})();


/* ── SEAL (Directive 2 Oct 2026, Part S; live, AI Innovation Pipeline only): nothing survives a change of organization or user ── */
(function(){
  const sorted = function(o){ return JSON.stringify(o, function(k, v){ return (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce(function(a, x){ a[x] = v[x]; return a; }, {}) : v; }); };
  const expectUI = Object.assign(JSON.parse(G.UI_PRISTINE), {theme:'dark', zoom:1});
  const dirty = function(){
    G.UI.aNewKey = {x:1}; G.UI.sec = '4.2'; G.UI.theme = 'light'; G.UI.zoom = 1.5;
    G.Store.setPref('theme', 'light'); G.Store.setPref('zoom', 1.5); G.Store.setPref('sidebar-min', '1');
    G.sidebarMinimized = true;
    G.coachMsgs.push({role:'user', text:'carry me over'});
    G.gchatUnreadCount = 4; G.currentPage = 'insights'; G.orgSetupMode = true;
  };
  const sealed = function(via){
    const ui = Object.assign({}, G.UI); delete ui.entry;
    Object.keys(ui).forEach(function(k){ if (!(k in expectUI) && (ui[k] === false || ui[k] === null)) delete ui[k]; });   /* a redraw after the seal writes closed states (navDrawer:false): not carried over */
    eq(sorted(ui), sorted(expectUI), 'SEAL ' + via + ': UI is exactly as first created (dark, zoom 1)');
    eq(JSON.stringify(G.coachMsgs), G.COACH_MSGS_PRISTINE, 'SEAL ' + via + ': the AI Guide conversation is back at its opening message');
    eq(G.gchatUnreadCount, 0, 'SEAL ' + via + ': the Team Chat unread count is 0');
    eq(G.currentPage, 'home', 'SEAL ' + via + ': the page is Home');
    eq(G.sidebarMinimized, false, 'SEAL ' + via + ': the sidebar is open');
    eq(G.orgSetupMode, false, 'SEAL ' + via + ': no setup wizard is left open');
    eq(G.Store.getPref('theme'), 'dark', 'SEAL ' + via + ': the stored theme is the default (dark)');
    eq(String(G.Store.getPref('zoom')), '1', 'SEAL ' + via + ': the stored zoom is 1');
    eq(G.Store.getPref('sidebar-min'), '0', 'SEAL ' + via + ': the stored sidebar is open');
  };
  const curOrg = G.currentOrgId, user0 = G.currentUserId, orgs0 = G.getOrgs().length, _cf = G.confirm, theme0 = G.Store.getPref('theme');
  G.confirm = function(){ return true; };
  ok(G.sealApplies() === true, 'SEAL: the harness runs the Pipeline, where the seal applies');

  dirty(); noThrow(() => G.signOut(), 'SEAL signOut: runs'); sealed('signOut');
  dirty(); noThrow(() => G.switchToOrg(curOrg), 'SEAL switchToOrg (sign-in, the admin console\'s Open): runs'); sealed('switchToOrg');
  let made = null;
  dirty(); noThrow(() => { made = G.createOrg('Seal Fixture', {name:'Seal Owner', username:'sealowner'}); }, 'SEAL createOrg: runs'); sealed('createOrg');
  dirty(); G.deleteOrgById(made.orgId); sealed('deleteOrgById (the organization being viewed)');
  eq(G.getOrgs().length, orgs0, 'SEAL: the fixture org is cleaned up');

  /* not for deleting another organization; not on another program's page; not at start-up */
  G.switchToOrg(curOrg);
  const other = G.createOrg('Seal Fixture 2', {name:'Seal Owner 2', username:'sealowner2'}).orgId;
  G.switchToOrg(curOrg);
  G.UI.aNewKey = {x:1}; G.gchatUnreadCount = 4;
  G.deleteOrgById(other);
  ok(G.UI.aNewKey && G.gchatUnreadCount === 4, 'SEAL: deleting an organization other than the one being viewed does not seal');
  const _isActive = G.Modules.isActive; G.Modules.isActive = function(){ return false; };
  G.sealSession();
  ok(G.UI.aNewKey && G.gchatUnreadCount === 4, 'SEAL: on another program\'s page the seal does nothing (Pipeline, Executive Readiness and Responsible AI Governance only)');
  G.Modules.isActive = _isActive;

  /* 7 Oct 2026: Executive Readiness and Responsible AI Governance too; their own state through the module's sealSession hook */
  G.Modules.isActive = function(id){ return id === 'exec-readiness'; };
  ok(G.sealApplies() === true, 'SEAL: the seal applies on an Executive Readiness page (its directive, 7 Oct 2026)');
  G.Modules.isActive = function(id){ return id === 'ai-governance'; };
  ok(G.sealApplies() === true, 'SEAL: the seal applies on a Responsible AI Governance page (its directive, 7 Oct 2026)');
  ok(fs.readFileSync(path.join(ROOT, 'js/modules/ai-governance/module.js'), 'utf8').indexOf('sealSession: function () { if (RG.insightsTabReset) RG.insightsTabReset(); }') >= 0
     && fs.readFileSync(path.join(ROOT, 'js/modules/ai-governance/program.js'), 'utf8').indexOf('RG.insightsTabReset = insightsTabReset;') >= 0,
     'SEAL: Responsible AI Governance resets its own Insights tab through the module\'s sealSession hook');
  G.Modules.isActive = _isActive;
  const _hook = G.Modules.hook; let hookRan = 0;
  G.Modules.hook = function(n){ return n === 'sealSession' ? function(){ hookRan++; } : _hook(n); };
  G.sealSession();
  G.Modules.hook = _hook;
  eq(hookRan, 1, 'SEAL: the active program\'s sealSession hook runs once per seal');
  const erMod = fs.readFileSync(path.join(ROOT, 'js/modules/exec-readiness/module.js'), 'utf8');
  const erSteps = fs.readFileSync(path.join(ROOT, 'js/modules/exec-readiness/steps.js'), 'utf8');
  ok(/sealSession:\s*function\s*\(\)\s*\{[^}]*ER\.resetSessionBuffers\(\)/.test(erMod)
     && /function resetSessionBuffers\(\) \{ _orgTaggedValues = null; \}/.test(erSteps) && /ER\.resetSessionBuffers = resetSessionBuffers;/.test(erSteps),
     'SEAL: Executive Readiness hands its role-form buffer reset (resetSessionBuffers) to the seal');

  /* the panels, Team Chat and Notes state: nothing of the organization before */
  G.chatMessages = [{ id: 1, body: 'SEAL CHAT MARKER' }]; G.chatLastId = 1; G.notesData = [{ id: 'n', body: 'SEAL NOTE MARKER' }];
  ['notesPanel', 'coachPanel', 'gchatPanel'].forEach(function(id){ const p = G.document.getElementById(id); if (p) p.innerHTML = 'SEAL PANEL MARKER'; });
  G.sealSession();
  ok(G.chatMessages.length === 0 && G.chatLastId === 0, 'SEAL: Team Chat\'s loaded messages are gone (it draws what it has before reloading)');
  ok(G.notesData.length === 0, 'SEAL: the signed-in person\'s loaded notes are gone');
  ok(['notesPanel', 'coachPanel', 'gchatPanel'].every(function(id){ const p = G.document.getElementById(id); return !p || (p.innerHTML || '') === ''; }),
     'SEAL: the closed Notes, AI Guide and Team Chat panels hold no markup from before');
  delete G.UI.aNewKey; G.gchatUnreadCount = 0;
  ok(!/sealSession\s*\(|switchToOrg\s*\(/.test(G.restoreSession.toString()) && !/sealSession\s*\(|switchToOrg\s*\(/.test(G.bootApp.toString()), 'SEAL S.4: start-up restores a session without sealSession or switchToOrg');
  G.UI.entry = {step:'login', remember:true};
  G.switchToOrg(curOrg);
  ok(G.UI.entry && G.UI.entry.remember === true, 'SEAL: the sign-in screen\'s own state survives the switch it is making (auth.js reads UI.entry right after)');

  G.confirm = _cf; G.UI.entry = null;
  G.switchToOrg(curOrg); G.currentUserId = user0;
  if (theme0 == null) localStorageStub.removeItem('pipeline-theme'); else G.Store.setPref('theme', theme0);
  G.render();
})();


/* ── AI FEATURES (Directive 2 Oct 2026, Part 2; live, AI Innovation Pipeline only): off by default, switched on per organization ── */
(function(){
  const $ = (id) => G.document.getElementById(id);
  const calls = []; const _fetch = G.fetch;
  G.fetch = function(url){ calls.push(String(url)); return Promise.resolve({ ok:true, json:()=>Promise.resolve({content:[{text:'(reply)'}]}) }); };
  let srMade = 0, srStops = 0;
  G.SpeechRecognition = function(){ srMade++; this.start = function(){}; this.stop = function(){ srStops++; }; };
  const curOrg = G.currentOrgId, user0 = G.currentUserId, _appAdmin = G.isAppAdmin, orgs0 = G.getOrgs().length;
  const admin = G.USERS.filter(u => u.admin === true)[0], member = G.USERS.filter(u => u.admin !== true)[0];
  ok(!!admin && !!member, 'AI fixture: the organization has an administrator and an ordinary member');
  G.isAppAdmin = false; G.currentUserId = admin.id;
  const saved = G.data.settings; delete G.data.settings;
  const voiceIn = () => { G.UI.navMore = true; G.render(); const s = $('navRight').innerHTML; G.UI.navMore = false; G.render(); return s.indexOf('data-act="voice"') >= 0; };

  eq(JSON.stringify(G.emptyData().settings), '{"aiGuide":false,"voice":false}', 'AI 2.2.1: the Pipeline\'s emptyData() carries settings, both off');
  ok(G.aiGuideOn() === false && G.voiceOn() === false, 'AI 2.2.1: data without settings counts as both off');
  G.render();
  eq($('coachFab').style.display, 'none', 'AI off: the AI Guide button is not shown');
  eq($('fabPulse').style.display, 'none', 'AI off: its pulse is not shown');
  ok(!voiceIn(), 'AI off: the More menu offers no Voice');
  G.toggleCoach(); eq(G.coachOpen, false, 'AI off: toggleCoach() does not open the AI Guide');
  const m0 = G.coachMsgs.length; $('coachInput').value = 'hello'; G.sendCoach(); G.sendCoachPreset('Where do I start?');
  ok(calls.length === 0 && G.coachMsgs.length === m0, 'AI off: no request to the AI service, nothing added to the conversation');
  G.toggleVoice(); eq(srMade, 0, 'AI off: toggleVoice() never starts speech recognition');
  const _go = G.go; G.go = function(){}; G.processVoice('open the guide'); G.go = _go;
  eq(G.coachOpen, false, 'AI off: the spoken "guide" does not open the AI Guide');

  G.UI.aiFoldOpen = undefined; G.openOrg();
  let mh = $('modalRoot').innerHTML;
  has(mh, '<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open"><summary>AI Features (off by default)</summary>', 'AI fold: on the Pipeline\'s Profile, closed by default (A.2.1)');
  has(mh, '<span>AI Guide</span></label><div class="ai-fold-note">When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.</div>', 'AI fold: A.2.2 and A.2.3');
  has(mh, "<span>Voice</span></label><div class=\"ai-fold-note\">When this is on, Voice uses the browser's own speech recognition. Some browsers send the recording to the browser maker to turn it into text.</div>", 'AI fold: A.2.4 and A.2.5');
  ok(mh.indexOf('Capture the enterprise context') < 0 && mh.indexOf('<h3>Organization &amp; Team</h3><div class="u-e6b5a04"></div>') >= 0, 'AI 2.2.8: the faded intro line is gone, its box kept');
  ok(mh.indexOf('<details') < mh.indexOf('Team Members'), 'AI fold: at the top of the page');
  G.currentUserId = member.id; G.renderOrgModal();
  ok($('modalRoot').innerHTML.indexOf('ai-fold') < 0, 'AI fold: a member without administrator rights does not see it');
  G.setAiFeature('aiGuide', true); eq(G.aiGuideOn(), false, 'AI: and cannot switch it');
  G.currentUserId = admin.id;

  G.UI.aiFoldOpen = true; G.setAiFeature('aiGuide', true);
  ok(G.aiGuideOn() && G.data.settings.aiGuide === true, 'AI on: the setting is in the organization\'s workspace document');
  eq($('coachFab').style.display, '', 'AI on: the AI Guide button appears at once');
  has($('modalRoot').innerHTML, '<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open" open>', 'AI fold: stays open across the redraw');
  G.closeModal(); G.toggleCoach(); eq(G.coachOpen, true, 'AI on: the AI Guide opens');
  const ph = $('coachPanel').innerHTML;
  ok(ph.indexOf('<div class="coach-ai-notice">You are talking to an AI assistant. It can make mistakes, so check anything important.</div>') > 0 && ph.indexOf('coach-ai-notice') > ph.indexOf('class="coach-header"') && ph.indexOf('coach-ai-notice') < ph.indexOf('coachMsgsEl'), 'AI on: the panel\'s first line under its header says it is an AI (A.2.6)');
  $('coachInput').value = 'What is a stage gate?'; G.sendCoach();
  /* AI Guide stage 1 (DEV COPY, 13 Oct 2026): the Pipeline's Guide asks POST /guide (Pinecone), not /claude */
  ok(calls.length === 1 && calls[0] === G.GUIDE_ENDPOINT, 'AI on: a question sends one request, to the AI Guide route');
  G.coachBusy = false;
  G.setAiFeature('aiGuide', false);
  ok(G.coachOpen === false && $('coachFab').style.display === 'none', 'AI switched off: the open panel closes and the button goes');
  $('coachInput').value = 'again'; G.sendCoach(); eq(calls.length, 1, 'AI switched off: no further request');

  G.setAiFeature('voice', true); ok(voiceIn(), 'Voice on: it appears in the More menu');
  G.toggleVoice(); eq(srMade, 1, 'Voice on: speech recognition starts');
  G.recognition.onstart(); G.setAiFeature('voice', false);
  ok(G.voiceActive === false && srStops === 1, 'Voice switched off: the microphone stops at once');
  ok(!voiceIn(), 'Voice switched off: it leaves the More menu');

  /* per organization; kept by Reset all data */
  G.setAiFeature('aiGuide', true);
  const keepCs = G.Store.commitSeed; G.Store.commitSeed = function(){};
  G.clearData();
  G.Store.commitSeed = keepCs;
  eq(G.aiGuideOn(), true, 'AI 4.2.2: Reset all data keeps the organization\'s AI settings');
  const other = G.createOrg('AI Fixture B', {name:'Bea Admin', username:'aifixb'}).orgId;
  ok(G.aiGuideOn() === false, 'AI: a new organization starts with both off');
  G.switchToOrg(curOrg); G.currentUserId = admin.id;
  eq(G.aiGuideOn(), true, 'AI 2.3.6: switching it on in one organization leaves another off');
  /* Part S follow-up (7 Oct 2026): an AI Guide reply still in flight across a seal never lands in the next
     organization's conversation. The reply is held by a hand-made thenable, so this stays synchronous. */
  {
    let fire = null; const _f2 = G.fetch;
    G.fetch = function(){ return { then: function(f1){ return { then: function(f2){ fire = function(){ f2(f1({ ok: true, json: function(){ return { answer: 'ORG A REPLY' }; } })); };   /* the Guide route's { answer } (stage 1) */ return { catch: function(){} }; } }; } }; };
    if (!G.coachOpen) G.toggleCoach();
    $('coachInput').value = 'Asked in org A'; G.sendCoach();
    ok(typeof fire === 'function', 'COACH: the question went out and its reply is held');
    G.switchToOrg(curOrg); G.currentUserId = admin.id; if (fire) fire();
    ok(JSON.stringify(G.coachMsgs) === G.COACH_MSGS_PRISTINE && $('coachPanel').innerHTML.indexOf('ORG A REPLY') < 0, 'COACH: a reply in flight across a change of organization does not land in the next conversation');
    fire = null; G.toggleCoach(); $('coachInput').value = 'Asked and answered'; G.sendCoach(); if (fire) fire();
    ok(G.coachMsgs.length === 3 && G.coachMsgs[2].text === 'ORG A REPLY' && $('coachPanel').innerHTML.indexOf('ORG A REPLY') >= 0, 'COACH: with no seal in between, the reply still arrives and is drawn');
    if (G.coachOpen) G.toggleCoach(); G.fetch = _f2;
  }
  G.deleteOrgById(other); eq(G.getOrgs().length, orgs0, 'AI: the fixture organization is cleaned up');

  /* Pipeline only (ruled 6 Oct 2026): every other program keeps today's behaviour */
  const _isActive = G.Modules.isActive; G.Modules.isActive = function(){ return false; };
  G.data.settings = {aiGuide:false, voice:false};
  ok(G.aiGuideOn() === true && G.voiceOn() === true && G.canSetAiFeatures() === false, 'AI: on another program the switches do not apply (both on, no fold)');
  /* Executive Readiness too (its own directive, 7 Oct 2026) */
  G.Modules.isActive = function(id){ return id === 'exec-readiness'; };
  ok(G.aiSwitchesApply() === true && G.aiGuideOn() === false && G.voiceOn() === false, 'AI: on an Executive Readiness page the switches apply (off until switched on)');
  G.currentUserId = admin.id;
  ok(G.canSetAiFeatures() === true, 'AI: and its administrators may set them');
  /* 16 Oct 2026: Executive Readiness has the Pipeline's Guide — POST /guide naming its module, no presets */
  {
    const sent = []; const _f3 = G.fetch, _ph = G.PH, _cs = G.currentStep, _cp = G.currentPhase;
    G.fetch = function(url, opts){ sent.push({ url: String(url), body: JSON.parse(opts.body) }); return { then: function(){ return { then: function(){ return { catch: function(){} }; } }; } }; };
    G.data.settings = {aiGuide:true, voice:false};
    G.PH = [{ id: 1, name: 'Assess', steps: [{ id: '1.1', name: 'Assessment Battery' }] }]; G.currentStep = '1.1'; G.currentPhase = G.PH[0];
    eq(G.guideModule(), 'exec-readiness', 'ER GUIDE: Executive Readiness uses the Pinecone Guide');
    G.toggleCoach();
    const erPanel = $('coachPanel').innerHTML;
    ok(erPanel.indexOf('coach-preset') < 0, 'ER GUIDE: the panel shows no preset questions');
    has(erPanel, '<div class="coach-where">Step 1.1 · Assessment Battery</div>', 'ER GUIDE: the header names the step');
    $('coachInput').value = 'Which step am I on?'; G.sendCoach();
    ok(sent.length === 1 && sent[0].url === G.GUIDE_ENDPOINT, 'ER GUIDE: a question sends one request, to the AI Guide route');
    eq(sent.length && sent[0].body.module, 'exec-readiness', 'ER GUIDE: the request names the program, so the server picks its assistant');
    eq(sent.length && sent[0].body.context, 'The user is on Step 1.1 (Assessment Battery) in Phase 1: Assess.', 'ER GUIDE: and says which step the user is on');
    G.coachBusy = false; G.coachMsgs = JSON.parse(G.COACH_MSGS_PRISTINE); G.toggleCoach();
    const tools = G.helpSectionHtml({ shared: 'tools', extra: [{ ic: '✦ AI Guide', d: 'ER OWN LINE' }] });
    ok(tools.split('✦ AI Guide').length === 2 && tools.indexOf('Purple button, bottom-right corner. It knows which step you are on') >= 0 && tools.indexOf('ER OWN LINE') < 0, 'ER GUIDE: Help has one AI Guide line, the Pinecone one');
    has(G.helpSectionHtml({ shared: 'privacy' }), G.HELP_PRIVACY_NEW, 'ER GUIDE: Help\'s privacy text says the Guide asks Pinecone');
    G.Modules.isActive = function(id){ return id === 'pipeline'; };
    G.fetch = function(url, opts){ sent.push({ url: String(url), body: JSON.parse(opts.body) }); return { then: function(){ return { then: function(){ return { catch: function(){} }; } }; } }; };
    G.toggleCoach(); $('coachInput').value = 'And here?'; G.sendCoach();
    eq(sent.length === 2 && sent[1].body.module, 'pipeline', 'GUIDE: the Pipeline\'s request names the Pipeline');
    G.coachBusy = false; G.coachMsgs = JSON.parse(G.COACH_MSGS_PRISTINE); G.toggleCoach();
    /* and Responsible AI Governance (16 Oct 2026): its own assistant, its own Help line, no presets */
    G.Modules.isActive = function(id){ return id === 'ai-governance'; };
    G.PH = [{ id: 1, name: 'Map', steps: [{ id: '1.1', name: 'Assessment Battery' }] }]; G.currentPhase = G.PH[0];
    eq(G.guideModule(), 'ai-governance', 'GOV GUIDE: Responsible AI Governance uses the Pinecone Guide');
    G.toggleCoach();
    ok($('coachPanel').innerHTML.indexOf('coach-preset') < 0, 'GOV GUIDE: the panel shows no preset questions');
    $('coachInput').value = 'Which step am I on?'; G.sendCoach();
    ok(sent.length === 3 && sent[2].url === G.GUIDE_ENDPOINT && sent[2].body.module === 'ai-governance', 'GOV GUIDE: the request goes to the AI Guide route and names the program');
    eq(sent.length === 3 && sent[2].body.context, 'The user is on Step 1.1 (Assessment Battery) in Phase 1: Map.', 'GOV GUIDE: and says which step the user is on');
    G.coachBusy = false; G.coachMsgs = JSON.parse(G.COACH_MSGS_PRISTINE); G.toggleCoach();
    const govTools = G.helpSectionHtml({ shared: 'tools', extra: [{ ic: '✦ AI Guide', d: 'GOV OWN LINE' }] });
    ok(govTools.split('✦ AI Guide').length === 2 && govTools.indexOf('Teal button, bottom-right corner.') >= 0 && govTools.indexOf('GOV OWN LINE') < 0, 'GOV GUIDE: Help has one AI Guide line, the Pinecone one');
    G.Modules.isActive = function(id){ return id === 'exec-readiness'; };
    G.fetch = _f3; G.PH = _ph; G.currentStep = _cs; G.currentPhase = _cp; G.data.settings = {aiGuide:false, voice:false};
  }
  ok(/coachGreeting: 'Welcome to Responsible AI Governance\. I\\'m your AI Guide\./.test(fs.readFileSync(path.join(ROOT, 'js/modules/ai-governance/module.js'), 'utf8')), 'GOV GUIDE: the greeting is the Guide\'s');
  ok(/coachGreeting: 'Welcome to Executive Readiness\. I\\'m your AI Guide\./.test(fs.readFileSync(path.join(ROOT, 'js/modules/exec-readiness/module.js'), 'utf8')), 'ER GUIDE: the greeting is the Guide\'s');
  G.Modules.isActive = function(id){ return id === 'ai-governance'; };
  ok(G.aiSwitchesApply() === true && G.aiGuideOn() === false && G.voiceOn() === false, 'AI: on a Responsible AI Governance page the switches apply (its directive, 7 Oct 2026; off until switched on)');
  ok(G.canSetAiFeatures() === true, 'AI: and its administrators may set them');
  G.Modules.isActive = _isActive;
  ok(/orgSetup: false,\s*settings: \{ aiGuide: false, voice: false \}/.test(fs.readFileSync(path.join(ROOT, 'js/modules/exec-readiness/module.js'), 'utf8')),
     'AI 2.2.1: Executive Readiness\'s emptyData() carries settings, both off');
  ok(/orgSetup: false,\s*settings: \{ aiGuide: false, voice: false \}/.test(fs.readFileSync(path.join(ROOT, 'js/modules/ai-governance/module.js'), 'utf8')),
     'AI 2.2.1: Responsible AI Governance\'s emptyData() carries settings, both off');
  ok(!/CLAUDE_API_URL|api\.anthropic\.com|fetchLiveInsights/.test(fs.readFileSync(path.join(ROOT, 'js/modules/ai-governance/program.js'), 'utf8')),
     'AI 2.2.5: Responsible AI Governance\'s own program code sends nothing to the AI service (its AI Guide is the shell\'s, which is guarded)');

  if (saved === undefined) delete G.data.settings; else G.data.settings = saved;
  G.fetch = _fetch; delete G.SpeechRecognition;
  G.isAppAdmin = _appAdmin; G.currentUserId = user0; G.closeModal(); G.render();
})();


/* ── SAMPLE TAB (Directive 2 Oct 2026, Part 3; live, AI Innovation Pipeline only): a private sample organization, opened from Demo ── */
(function(){
  const $ = (id) => G.document.getElementById(id);
  const nrq = (sel) => G.document.getElementById('navRight').querySelector(sel);
  const ls = localStorageStub;
  const opened = []; const _open = G.open; G.open = function(u, t){ opened.push([u, t]); return null; };
  const loc0 = G.location; G.location = Object.assign({}, loc0, { pathname: '/apps/enterprises/innovation-pipeline', search: '' });
  const curOrg = G.currentOrgId, user0 = G.currentUserId, orgs0 = JSON.stringify(G.getOrgs()), ptr0 = G.Store.getCurrentOrg();
  const remember = {orgId: curOrg, userId: 'someone'}; G.Store.setRemember(remember);
  const admin = G.USERS.filter(u => u.admin === true)[0];
  G.currentUserId = admin.id; G.UI.navMore = true; G.render();
  let nr = $('navRight').innerHTML;

  /* the person's own tab, on the Pipeline */
  ok(nrq('#sampleNavBtn') && nrq('#sampleNavBtn').style.display === '' && nrq('#notesNavBtn').style.display === 'none', 'SAMPLE 3.3.7: on the Pipeline, Demo takes the Notes button\'s place in the top bar');
  ok(/id="sampleNavBtn"[^>]*data-act="demo"[^>]*>[^<]*Demo<\/button>/.test(nr), 'SAMPLE 3.3.7: the Demo button (A.3.1)');
  const nAt = nr.indexOf('data-act="notes-more"'), pAt = nr.indexOf('data-act="profile"');
  ok(nAt > 0 && nAt < pAt, 'SAMPLE 3.3.8: Notes is in the More menu, above Org & Team');
  has(nr, 'Notes <span class="notes-count">', 'SAMPLE 3.3.8: with its count');
  ok(nr.indexOf('data-act="seed"') > 0, 'SAMPLE 3.2.9: the existing sample items stay in a client organization\'s More menu');
  ok(nr.indexOf('sample-restart') < 0, 'SAMPLE: Start again and Close appear only in the sample tab');
  const _isActive = G.Modules.isActive; G.Modules.isActive = function(){ return false; }; G.render();
  ok(nrq('#sampleNavBtn').style.display === 'none' && nrq('#notesNavBtn').style.display === '' && $('navRight').innerHTML.indexOf('notes-more') < 0, 'SAMPLE: on another program the top bar keeps Notes and has no Demo (Pipeline only)');
  G.Modules.isActive = _isActive; G.UI.navMore = false; G.render();

  /* Executive Readiness has the sample tab too (its directive, 7 Oct 2026), but keeps Reset all data until its Part 4 */
  const _aid = G.Modules.activeId; G.Modules.isActive = function(id){ return id === 'exec-readiness'; }; G.Modules.activeId = function(){ return 'exec-readiness'; };
  ok(G.sampleAppliesHere() === true && G.resetMovedToConsole() === true, 'SAMPLE: Executive Readiness has the sample tab; since its Part 4 (7 Oct 2026) its Reset all data is the admin console\'s too');
  const _op = opened.length; G.openSampleTab();
  ok(opened.length === _op + 1 && (function(u, m){ return u === m + (m.indexOf('?') >= 0 ? '&' : '?') + 'sample=1'; })(opened[_op][0], G.Router.moduleUrl('exec-readiness')), 'SAMPLE 3.3.1: on Executive Readiness, Demo opens its own program address in sample mode');
  opened.length = _op; ls.removeItem('sample-tab-pass');
  /* Responsible AI Governance too (its directive, 7 Oct 2026); its Reset all data stays in More until its Part 4 */
  G.Modules.isActive = function(id){ return id === 'ai-governance'; }; G.Modules.activeId = function(){ return 'ai-governance'; };
  ok(G.sampleAppliesHere() === true && G.resetMovedToConsole() === true, 'SAMPLE: Responsible AI Governance has the sample tab (its directive, 7 Oct 2026); since its Part 4 (same day) its Reset all data is the admin console\'s too');
  const _opG = opened.length; G.openSampleTab();
  ok(opened.length === _opG + 1 && (function(u, m){ return u === m + (m.indexOf('?') >= 0 ? '&' : '?') + 'sample=1'; })(opened[_opG][0], G.Router.moduleUrl('ai-governance')), 'SAMPLE 3.3.1: on Responsible AI Governance, Demo opens its own program address in sample mode');
  opened.length = _opG; ls.removeItem('sample-tab-pass');
  ok(/Modules\.isActive\('pipeline'\) \|\| Modules\.isActive\('exec-readiness'\) \|\| Modules\.isActive\('ai-governance'\)( \|\| Modules\.isActive\('ai-architecture'\))?\)\); \} catch \(e\) \{ return false; \} \}\)\(\);/.test(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8')),
     'SAMPLE: a Responsible AI Governance address with ?sample=1 is a sample tab from the first line (SAMPLE_TAB_ADDR: its Store stays in this browser)');
  G.Modules.isActive = _isActive; G.Modules.activeId = _aid;
  ok(/var q = \(window\.SAMPLE_MODE \|\| window\.SAMPLE_TAB_ADDR\) \? '\?sample=1' : '';\s*try \{ history\.replaceState\(null, '', moduleUrl\(id, page, step\) \+ q\); \}/.test(fs.readFileSync(path.join(ROOT, 'js/router.js'), 'utf8')),
     'SAMPLE: the router keeps ?sample=1 on a sample tab\'s address (a reload after a click must not load the real workspace)');
  ok(String(G.prepareSampleData).indexOf("Modules.seeds().filter(function (x) { return x.id === 'sample'; })[0]") >= 0, 'SAMPLE 3.2.4: the copy comes from the running program\'s own built-in sample (Modules.seeds)');

  /* Demo */
  G.currentUserId = null; G.openSampleTab(); ok(opened.length === 0, 'SAMPLE 3.3.1: nobody signed in, nothing opens');
  G.currentUserId = admin.id; G.openSampleTab();
  ok(opened.length === 1 && /[?&]sample=1$/.test(opened[0][0]) && opened[0][0].indexOf(G.Router.moduleUrl('pipeline')) === 0 && opened[0][1] === '_blank', 'SAMPLE 3.3.1: Demo opens the Pipeline in a new tab, in sample mode', opened);
  ok(!!JSON.parse(ls.getItem('sample-tab-pass') || 'null'), 'SAMPLE 3.3.1: with a one-time pass');

  /* the sample tab starts */
  const bootAsSampleTab = () => { G.SAMPLE_TAB_ADDR = true; G._bootDone = false; G.currentUserId = null; G.currentOrgId = null; return G.bootApp(); };
  ok(bootAsSampleTab() === true && G.SAMPLE_MODE && !G.SAMPLE_REFUSED, 'SAMPLE 3.3.2: the pass is accepted and the tab starts');
  eq(ls.getItem('sample-tab-pass'), null, 'SAMPLE 3.3.2: the pass is used up');
  eq(G.currentOrgId, 'org_sample_local', 'SAMPLE 3.3.2: the tab works on org_sample_local');
  eq(G.Store.getCurrentOrg(), ptr0, 'SAMPLE 3.3.2: the person\'s stored organization pointer is untouched');
  eq(JSON.stringify(G.getOrgs()), orgs0, 'SAMPLE 3.3.3: the sample is not added to the organization list');
  const stored = JSON.parse(ls.getItem('pipeline-org-data::org_sample_local') || 'null');
  ok(stored && stored.roster && stored.roster.length >= 8 && stored.ideas.length > 0, 'SAMPLE 3.2.4: the copy is the built-in sample, kept in this browser under its own key');
  ok(stored.roster.every(u => !('passcode' in u)) && G.USERS.every(u => !('passcode' in u)), 'SAMPLE 3.2.4: the sample people have no passwords (stored and in memory)');
  G.applyTeamRoster(); ok(G.USERS.every(u => !('passcode' in u)), 'SAMPLE 3.2.4: and applyTeamRoster does not give them one');
  eq(JSON.stringify(stored.settings), '{"aiGuide":false,"voice":false}', 'SAMPLE 3.3.2: its AI settings are off');
  ok(G.currentUserId === G.USERS[0].id && !G.UI.entry && G.isAppAdmin === false, 'SAMPLE 3.2.4: the tab enters as the first sample person; nobody signs in');

  G.data.settings = {aiGuide: true, voice: true};
  ok(G.aiGuideOn() === false && G.voiceOn() === false, 'SAMPLE 3.3.4: the AI Guide and Voice are off whatever the settings say');
  G.render(); eq($('coachFab').style.display, 'none', 'SAMPLE 3.3.4: no AI Guide button');
  G.toggleGChat(); eq(G.gchatOpen, false, 'SAMPLE 3.3.4: Team Chat refuses to open');
  G.data.settings = {aiGuide: false, voice: false};

  G.UI.navMore = true; G.render(); nr = $('navRight').innerHTML;
  ok(nrq('#sampleNavBtn').style.display === 'none' && nrq('#gchatNavBtn').style.display === 'none', 'SAMPLE 3.2.7: no Demo and no Team Chat in the sample tab');
  /* no program switcher in the sample tab: checked in the browser (the stub DOM cannot reach it by class) */
  ok(nr.indexOf('data-act="usermenu"') >= 0, 'SAMPLE (Sweep 4R item 9.2, amends Part 3): the sample person\'s chip opens the account menu');
  ok(nr.indexOf('data-act="export"') < 0 && nr.indexOf('data-act="import"') < 0, 'SAMPLE (Sweep 4R item 9.1, amends Part 3): no Export state or Import state in the sample tab\'s More menu');
  G.UI.userMenu = true; G.render();
  { const um = $('navRight').innerHTML; ok(um.indexOf('data-act="signout"') >= 0 && um.indexOf('data-act="user-profile"') < 0 && um.indexOf('data-act="user-assignments"') < 0, 'SAMPLE (Sweep 4R item 9.2): the sample\'s account menu holds only Sign Out'); }
  G.UI.userMenu = false; G.render();
  { const _cs = G.closeSample, _u = G.currentUserId; let n = 0; G.closeSample = function () { n++; }; G.signOut(); G.closeSample = _cs;
    ok(n === 1 && G.currentUserId === _u && !G.UI.entry, 'SAMPLE (Sweep 4R item 9.2): signOut in the sample tab closes the sample; nobody is signed out, no sign-in screen'); }
  G.UI.navMore = true; G.render(); nr = $('navRight').innerHTML;
  has(nr, 'data-act="sample-restart"><span class="nav-more-ic">&#8635;</span> Start the sample again</button>', 'SAMPLE 3.2.7: Start the sample again (A.3.3)');
  has(nr, 'data-act="sample-close"><span class="nav-more-ic">&#10005;</span> Close the sample</button>', 'SAMPLE 3.2.7: Close the sample (A.3.5)');
  ok(['notes-more', 'data-act="profile"', 'data-act="admin"', 'data-act="seed"', 'data-act="reset"'].every(s => nr.indexOf(s) < 0), 'SAMPLE 3.2.7: no Notes, Org & Team, Admin, sample items or Reset');
  G.UI.navMore = false; G.render();

  G.Collab.acquire('purpose');
  eq(ls.getItem('pipeline-locks::org_sample_local'), null, 'SAMPLE 3.3.3: no locks are taken');
  const _f = G.fetch; const sent = []; G.fetch = function(u){ sent.push(u); return Promise.resolve({ok:true, json:()=>Promise.resolve({})}); };
  G.notifyDispatch({kind:'step', subject:'x', to:['a@b.c'], stepId:'1.1'});
  eq(sent.length, 0, 'SAMPLE 3.2.6: no email is sent'); G.fetch = _f;
  G.signOut();
  ok(G.currentUserId && JSON.stringify(G.Store.getRemember()) === JSON.stringify(remember), 'SAMPLE: sign-out does nothing in the sample tab (the person\'s remembered sign-in survives)');

  const first = G.data.ideas[0].name; G.data.ideas[0].name = 'Changed in the sample tab'; G.saveData();
  G.restartSample(); eq(G.data.ideas[0].name, first, 'SAMPLE 3.4.5: Start the sample again brings back the original');
  G.data.ideas[0].name = 'Kept'; G.saveData();
  G.SAMPLE_MODE = false; ls.setItem('sample-tab-pass', JSON.stringify({t: Date.now()})); bootAsSampleTab();
  eq(G.data.ideas[0].name, 'Kept', 'SAMPLE 3.3.3: the person\'s copy is kept in their browser between openings');

  G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; ls.removeItem('sample-tab-pass'); bootAsSampleTab();
  ok(G.SAMPLE_REFUSED === true && !G.currentUserId, 'SAMPLE 3.2.2: without a pass or a signed-in opener the tab is refused');
  eq($('app').innerHTML, '<div class="sample-refused"><p>Sign in to your organization, then open Demo from the top bar.</p></div>', 'SAMPLE 3.2.2: it shows only A.3.6');
  ls.setItem('sample-tab-pass', JSON.stringify({t: Date.now() - 121000})); G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; bootAsSampleTab();
  ok(G.SAMPLE_REFUSED === true, 'SAMPLE 3.3.2: a pass older than two minutes is refused');
  G.opener = { currentUserId: 'u1', SAMPLE_MODE: false }; G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; bootAsSampleTab();
  ok(G.SAMPLE_REFUSED === false && G.currentOrgId === 'org_sample_local', 'SAMPLE 3.3.2: a signed-in opener is accepted without a pass');
  delete G.opener;

  /* back to the harness's own tab */
  G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; G.SAMPLE_TAB_ADDR = false;
  G.currentOrgId = curOrg; G.loadData(); G.applyTeamRoster(); G.currentUserId = user0;
  ls.removeItem('pipeline-org-data::org_sample_local'); ls.removeItem('pipeline-org-rev::org_sample_local');
  G.Store.setRemember(null); G.open = _open; G.location = loc0;
  const navEl = G.document.querySelector('nav'); if (navEl && navEl.style) navEl.style.display = '';
  G.render();
})();


/* ── RESET DATA (Directive 2 Oct 2026, Part 4; live): the admin console's per-organization reset ── */
(function(){
  const fs = require('fs'), path = require('path');
  const $ = (id) => G.document.getElementById(id);
  const ROOT = path.resolve(__dirname, '..', '..');

  /* the server writes the Pipeline's fresh document from api/config/empty-docs.json: it must be the program's own emptyData() */
  let tmpl = null; try { tmpl = JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'config', 'empty-docs.json'), 'utf8')).pipeline; } catch (e) { }
  eq(JSON.stringify(tmpl), JSON.stringify(G.emptyData()), 'EMPTY DOCS: api/config/empty-docs.json is the Pipeline\'s emptyData() (if this fails: node tools/build-empty-docs.js)');
  /* and Executive Readiness's (Part 4, 7 Oct 2026): the reset writes its document too. Its module is not loaded in
     this realm, so its emptyData() is taken from module.js the same way build-empty-docs.js takes it. */
  let erT = null, erE = null;
  try {
    erT = JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'config', 'empty-docs.json'), 'utf8'))['exec-readiness'];
    const defs = {}; const sb = { Modules: { define: (id, def) => { defs[id] = def; } }, console }; sb.window = sb;
    require('vm').createContext(sb); require('vm').runInContext(fs.readFileSync(path.join(ROOT, 'js', 'modules', 'exec-readiness', 'module.js'), 'utf8'), sb);
    erE = defs['exec-readiness'].emptyData();
  } catch (e) { }
  ok(!!erT && JSON.stringify(erT) === JSON.stringify(erE), 'EMPTY DOCS: api/config/empty-docs.json carries Executive Readiness\'s emptyData() (if this fails: node tools/build-empty-docs.js)');
  let govT = null, govE = null;
  try {
    govT = JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'config', 'empty-docs.json'), 'utf8'))['ai-governance'];
    const defsG = {}; const sbG = { Modules: { define: (id, def) => { defsG[id] = def; } }, console }; sbG.window = sbG;
    require('vm').createContext(sbG); require('vm').runInContext(fs.readFileSync(path.join(ROOT, 'js', 'modules', 'ai-governance', 'module.js'), 'utf8'), sbG);
    govE = defsG['ai-governance'].emptyData();
  } catch (e) { }
  const noDate = (o) => JSON.stringify(Object.assign({}, o, { startDate: '' }));   /* emptyData() stamps today; the file holds the day it was built */
  ok(!!govT && !!govE && noDate(govT) === noDate(govE), 'EMPTY DOCS: api/config/empty-docs.json carries Responsible AI Governance\'s emptyData() (7 Oct 2026; if this fails: node tools/build-empty-docs.js)');
  ok(!/passcode|'1234'|ensurePasscode|defaultPasscode/i.test(fs.readFileSync(path.join(ROOT, 'js', 'modules', 'exec-readiness', 'steps.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js', 'modules', 'exec-readiness', 'module.js'), 'utf8')),
     'PASSWORDS 5.2.5: Executive Readiness\'s own code handles no passcode (its seed people have none; 7 Oct 2026)');
  ok(!/passcode|'1234'|ensurePasscode|defaultPasscode|adminCreds|setAdminCreds/i.test(['program.js', 'module.js', 'help.js'].map(function (f) { return fs.readFileSync(path.join(ROOT, 'js', 'modules', 'ai-governance', f), 'utf8'); }).join('\n')),
     'PASSWORDS 5.2.5: Responsible AI Governance\'s own code handles no passcode (its seed people have none; 7 Oct 2026)');
  const erSteps7 = fs.readFileSync(path.join(ROOT, 'js', 'modules', 'exec-readiness', 'steps.js'), 'utf8'), erMod7 = fs.readFileSync(path.join(ROOT, 'js', 'modules', 'exec-readiness', 'module.js'), 'utf8');
  ok(/group:'Individual People'/.test(erSteps7) && /function personalRecordDoc\(id\)/.test(erSteps7) && /ER\.personalRecordDoc = personalRecordDoc;/.test(erSteps7) && /'Personal record: '/.test(erSteps7),
     'PERSON (Part 7, 7 Oct 2026): Executive Readiness\'s Report Manager carries Individual People and the personal record');
  ok(/reports: page\(function \(\) \{ preloadPersonSources\(\); return ER\.renderReports\(\); \}\)/.test(erMod7), 'PERSON: the Report Manager loads Team Chat and the signed-in person\'s own notes as it opens (kept on the server here)');
  ok(/private const RESET_MODULES = \['pipeline', 'exec-readiness', 'ai-governance', 'ai-architecture'\];/.test(fs.readFileSync(path.join(ROOT, 'api', 'controllers', 'OrganizationController.php'), 'utf8')), 'RESET: the server\'s Reset data covers the Pipeline, Executive Readiness, Responsible AI Governance (7 Oct 2026) and AI-Ready Architecture (21 Oct 2026)');

  const posts = []; const _post = G.postJSON, _confirm = G.confirm, _admin = G.isAppAdmin, _pc = G.Auth.adminPasscode;
  G.postJSON = function(url, body, ok){ posts.push({url, body}); };
  const asked = []; G.confirm = function(m){ asked.push(m); return true; };
  G.isAppAdmin = true; G.Auth.adminPasscode = function(){ return 'the-admin-passcode'; };

  G.adminResetOrg('org_x1');
  eq(asked[0], 'Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone.', 'RESET 4.2.2: it asks A.4.1 first');
  ok(posts.length === 1 && /\/organizations\/reset$/.test(posts[0].url) && posts[0].body.id === 'org_x1' && !('passcode' in posts[0].body), 'RESET 4.3: one request to /organizations/reset, authorised by the app administrator\'s session (no passcode sent — Part 6)', posts);
  G.confirm = function(){ return false; }; G.adminResetOrg('org_x1');
  eq(posts.length, 1, 'RESET: declining A.4.1 sends nothing');
  G.confirm = function(){ return true; }; G.isAppAdmin = false; G.adminResetOrg('org_x1');
  eq(posts.length, 1, 'RESET: only the app administrator can reset');
  G.isAppAdmin = true;

  /* the buttons */
  G.UI.adminData = [{ id: 'org_a1', name: 'Org A', users: [{public_id: 'usr_a', name: 'A', is_admin: 1}], modules: [] }, { id: 'org_b1', name: 'Org B', users: [], modules: [] }];
  G.currentModal = 'admin'; G.renderAdminModal();
  const mh = $('modalRoot').innerHTML;
  ok(mh.indexOf('adminResetOrg(\'org_a1\')">Reset data</button>') > 0 && mh.indexOf('adminResetOrg(\'org_b1\')">Reset data</button>') > 0, 'RESET 4.2.2: Reset data on every organization\'s row of the Admin panel');
  G.closeModal(); G.UI.adminData = null;
  const _getOrgs = G.getOrgs; G.getOrgs = function(){ return [{id: 'org_c1', name: 'Org C', serverId: 'org_c1', created: Date.now()}]; };
  G.UI.entry = {step: 'admin'}; const _cu = G.currentUserId; G.currentUserId = null; G.render();
  ok($('app').innerHTML.indexOf('adminResetOrg(\'org_c1\')">Reset data</button>') > 0, 'RESET 4.2.2: Reset data on every row of the full-screen console');
  /* the console's Delete goes to the server (it used to remove only the browser's copy) */
  const _dbOrg = G.Store.dbOrg; G.Store.dbOrg = function(){ return {users: [{public_id: 'usr_c', is_admin: 1}]}; };
  const _getOrg = G.getOrg; G.getOrg = function(id){ return id === 'org_c1' ? {id: 'org_c1', name: 'Org C', serverId: 'org_c1'} : null; };
  posts.length = 0; G.adminConsoleDelete('org_c1');
  ok(posts.length === 1 && /\/organizations\/delete$/.test(posts[0].url) && posts[0].body.id === 'org_c1' && posts[0].body.actor_id === 'usr_c', 'DELETE 4.1: the full-screen console\'s Delete deletes on the server', posts);
  G.getOrgs = _getOrgs; G.getOrg = _getOrg; G.Store.dbOrg = _dbOrg; G.UI.entry = null; G.currentUserId = _cu;

  /* 4.2.3: Reset all data leaves the Pipeline's More menu (other programs keep it) */
  const _u2 = G.currentUserId; G.currentUserId = G.USERS[0].id;   /* a signed-in member: the top bar is drawn only then */
  G.isAppAdmin = false; G.UI.navMore = true; G.render();
  ok($('navRight').innerHTML.indexOf('data-act="more"') > 0 && $('navRight').innerHTML.indexOf('data-act="reset"') < 0, 'RESET 4.2.3: the Pipeline\'s More menu no longer offers Reset all data');
  const _sa = G.resetMovedToConsole; G.resetMovedToConsole = function(){ return false; }; G.render();   /* as on a program whose Reset has not moved to the console */
  ok($('navRight').innerHTML.indexOf('data-act="reset"') > 0, 'RESET 4.2.3: another program keeps it (Pipeline only)');
  G.resetMovedToConsole = _sa; G.UI.navMore = false; G.currentUserId = _u2;

  G.postJSON = _post; G.confirm = _confirm; G.isAppAdmin = _admin; G.Auth.adminPasscode = _pc;
  G.render();
})();

/* ── SWEEP 4R item 1 (addendum 5 Oct 2026, Paul's decision): sign-in by the username only, ignoring capitals and every space ── */
(function(){
  const um = fs.readFileSync(path.join(ROOT, 'api', 'models', 'User.php'), 'utf8');
  const ac = fs.readFileSync(path.join(ROOT, 'api', 'controllers', 'AuthController.php'), 'utf8');
  const sg = fs.readFileSync(path.join(ROOT, 'api', 'core', 'SignInGuard.php'), 'utf8');
  ok(/FROM users WHERE LOWER\(REPLACE\(username, \\' \\', \\'\\'\)\) = :username/.test(um) && um.indexOf("preg_replace('/\\s+/u', '', $username)") >= 0, 'S4R-1: the sign-in lookup matches the USERNAME only (never a name), ignoring capitals and every space');
  ok(ac.indexOf("preg_replace('/\\s+/u', '', (string) ($in['username'] ?? ''))") >= 0, 'S4R-1: POST /session strips every space from the typed username');
  ok(sg.indexOf("preg_replace('/\\s+/u', '', $u)") >= 0, 'S4R-1: the lockout counts one username however its spaces are typed');
})();

/* ── SWEEP 4R item 2 (addendum 5 Oct 2026): administrators make administrators; never none ── */
(function(){
  const MSG = 'An organization needs at least one administrator. Make someone else an administrator first.';
  ok(G.LAST_ADMIN_MSG === MSG, 'S4R-2: A.5.30 word for word');
  ok(/<label class="admin-tick"><input type="checkbox" id="x" checked\/> <span>Administrator<\/span><\/label>/.test(G.adminTickHtml('x', true)), 'S4R-2: the tick box reads Administrator (A.5.29)');
  const keepUsers = G.USERS.slice(), keepMe = G.currentUserId, keepAlert = G.alert, keepAdminOrg = G.adminOrgById, keepAppAdmin = G.isAppAdmin;
  const said = []; G.alert = (m) => { said.push(String(m)); };
  G.isAppAdmin = false;
  G.USERS.length = 0; G.USERS.push({ id: 'm1', name: 'Ann Admin', username: 'annadm', admin: true }, { id: 'm2', name: 'Ben Member', username: 'benmem' });
  G.currentUserId = 'm1';
  G.document.getElementById('ru_m1_admin').checked = false;
  said.length = 0; G.saveProfile('m1');
  ok(said[0] === MSG && G.USERS[0].admin === true && !('m1' in G._pendingAdmin), 'S4R-2: the Profile page refuses to untick the last administrator, before anything changes');
  said.length = 0; G.removeProfile('m1');
  ok(said[0] === MSG && G.USERS.length === 2, 'S4R-2: the Profile page refuses to remove the last administrator');
  G._pendingAdmin['m2'] = true;
  ok(G.memberPayload(G.USERS[1]).is_admin === true, 'S4R-2: a promotion an administrator asked for travels as is_admin');
  delete G._pendingAdmin['m2'];
  ok(!('is_admin' in G.memberPayload(G.USERS[1])), 'S4R-2: otherwise no is_admin is sent (a stale roster can never demote anyone)');
  G.currentUserId = 'm2';
  G._pendingAdmin['m2'] = true;
  ok(!('is_admin' in G.memberPayload(G.USERS[1])), 'S4R-2: from an ordinary member, no is_admin is ever sent');
  delete G._pendingAdmin['m2'];
  G.adminOrgById = () => ({ users: [{ public_id: 'p1', name: 'Ann Admin', is_admin: true }, { public_id: 'p2', name: 'Ben Member', is_admin: false }] });
  G.isAppAdmin = true;   /* Sweep 4R item 10: the console is the app administrator's (restored at the end) */
  said.length = 0; G.adminDeleteUser('org1', 'p1');
  ok(said[0] === MSG, 'S4R-2: the console refuses to remove the last administrator');
  ok(/id="au_admin" checked/.test(G.adminUserEditorHtml('org1', { public_id: 'p1', name: 'Ann Admin', is_admin: true })), 'S4R-2: the console\'s person editor has the box, ticked for an administrator');
  ok(/onclick="adminDeleteUser\('org1','p1'\)"/.test(G.adminUserEditorHtml('org1', { public_id: 'p1', name: 'Ann Admin', is_admin: true })), 'S4R-2: an administrator\'s Delete is offered (it is refused only for the last one)');
  const uc = fs.readFileSync(path.join(ROOT, 'api', 'controllers', 'UserController.php'), 'utf8');
  ok((uc.split("['reason' => 'last-admin']").length - 1) === 2, 'S4R-2: the server refuses demoting and removing the last administrator (UserController::update and ::delete)');
  G.USERS.length = 0; keepUsers.forEach(u => G.USERS.push(u)); G.currentUserId = keepMe; G.alert = keepAlert; G.adminOrgById = keepAdminOrg; G.isAppAdmin = keepAppAdmin;
})();

/* ── SWEEP 4R item 3 (addendum 5 Oct 2026): only administrators edit the organization's details ── */
(function(){
  const NOTE = '<p class="ent-ro-note">Only administrators can change the organization’s details.</p>';
  const keepUsers = G.USERS.slice(), keepMe = G.currentUserId, keepAppAdmin = G.isAppAdmin, keepModal = G.currentModal;
  G.isAppAdmin = false;
  G.USERS.length = 0; G.USERS.push({ id: 'd1', name: 'Dee Admin', username: 'deeadm', admin: true }, { id: 'd2', name: 'Moe Member', username: 'moemem' });
  G.currentModal = 'org';
  G.currentUserId = 'd2'; G.renderOrgModal();
  let mh = G.document.getElementById('modalRoot').innerHTML;
  ok(mh.indexOf(NOTE) > mh.indexOf('Organization Details</div>') && mh.indexOf('Organization Details</div>') > 0, 'S4R-3: an ordinary member sees A.5.31 directly after the Organization Details heading');
  ok(/id="ent_name"[^>]* disabled/.test(mh) && /id="ent_objective"[^>]* disabled/.test(mh) && mh.indexOf('onchange="saveEnterprise()"') < 0, 'S4R-3: and every details field disabled, with no save handler');
  G.currentUserId = 'd1'; G.renderOrgModal();
  mh = G.document.getElementById('modalRoot').innerHTML;
  ok(mh.indexOf(NOTE) < 0 && !/id="ent_name"[^>]* disabled/.test(mh), 'S4R-3: an administrator sees the details editable, with no A.5.31');
  const dp = fs.readFileSync(path.join(ROOT, 'api', 'core', 'DocPrivacy.php'), 'utf8'), wc = fs.readFileSync(path.join(ROOT, 'api', 'controllers', 'WorkspaceController.php'), 'utf8');
  ok(/private const ADMIN_ONLY = \['enterprise', 'settings'\];/.test(dp) && /\$mayEditAdmin = \$this->isAppAdmin\(\) \|\| \(int\) \(\$actor\['is_admin'\] \?\? 0\) === 1;/.test(wc) && wc.indexOf('$removed       = $privacy->removable($removed);') >= 0,
     'S4R-3: the server keeps a workspace\'s organization details from anyone but an administrator (save, patch and a patch\'s removed list)');
  G.USERS.length = 0; keepUsers.forEach(u => G.USERS.push(u)); G.currentUserId = keepMe; G.isAppAdmin = keepAppAdmin; G.currentModal = keepModal;
})();

/* ── SWEEP 4R item 10 (addendum 5 Oct 2026): rights inside the functions; called by an ordinary member, each changes nothing ── */
(function(){
  const keep = { users: G.USERS.slice(), me: G.currentUserId, app: G.isAppAdmin, modal: G.currentModal, $: G.$, post: G.postJSON, confirm: G.confirm, prompt: G.prompt, alert: G.alert, commit: G.Store.commitSeed, more: G.UI.navMore, settings: JSON.stringify(G.data.settings || null) };
  G.isAppAdmin = false;
  G.USERS.length = 0; G.USERS.push({ id: 'd1', name: 'Dee Admin', username: 'deeadm', admin: true }, { id: 'd2', name: 'Moe Member', username: 'moemem' });
  G.currentUserId = 'd2'; G.currentModal = null;
  ok(!G.canManageOrg() && !G.isAppAdmin, 'S4R-10 fixture: an ordinary member is signed in');
  /* every field an attacker could fill before calling, and every way out to the server, watched */
  const field = { value: 'HACKED', checked: true, focus: function () { } };
  G.$ = function (id) { return /^(ent_|au_|nao_|ano_|ru_|adminNewUsername|pw)/.test(String(id)) ? field : keep.$(id); };
  const out = []; G.postJSON = function (url) { out.push(String(url)); }; G.Store.commitSeed = function () { out.push('commitSeed'); };
  G.confirm = function () { return true; }; G.prompt = function () { return 'HACKED NAME'; }; G.alert = function () { };
  const snap = () => JSON.stringify({ data: G.data, users: G.USERS, ui: G.UI, modal: G.currentModal, org: G.currentOrgId, me: G.currentUserId, orgs: G.getOrgs() });
  const org = G.currentOrgId || 'o1';
  [['adminConsoleOpen', () => G.adminConsoleOpen(org)], ['adminConsoleDelete', () => G.adminConsoleDelete(org)], ['adminConsoleNewOrg', () => G.adminConsoleNewOrg()],
   ['adminAddOrg', () => G.adminAddOrg()], ['adminRenameOrg', () => G.adminRenameOrg(org)], ['adminOpenOrg', () => G.adminOpenOrg('p_org')], ['adminDeleteOrg', () => G.adminDeleteOrg('p_org')],
   ['adminEditUser', () => G.adminEditUser('p_org', 'd1')], ['adminAddUser', () => G.adminAddUser('p_org')], ['adminSaveUser', () => G.adminSaveUser('p_org', 'd1')], ['adminDeleteUser', () => G.adminDeleteUser('p_org', 'd1')],
   ['adminChangePasscode', () => G.adminChangePasscode()], ['openChangeUsername', () => G.openChangeUsername()], ['doChangeUsername', () => G.doChangeUsername()],
   ['adminNewOrgOpen', () => G.adminNewOrgOpen()], ['adminNewOrgSave', () => G.adminNewOrgSave()], ['adminResetOrg', () => G.adminResetOrg('p_org')],
   ['clearData', () => G.clearData()], ['setAiFeature', () => G.setAiFeature('aiGuide', true)],
   ['addProfile', () => G.addProfile()], ['editProfile (someone else)', () => G.editProfile('d1')], ['saveProfile (someone else)', () => G.saveProfile('d1')], ['removeProfile', () => G.removeProfile('d1')], ['saveEnterprise', () => G.saveEnterprise()]
  ].forEach(function (c) {
    const before = snap(); out.length = 0; let err = '';
    try { c[1](); } catch (e) { err = String(e && e.message || e); }
    ok(snap() === before && out.length === 0 && !err, 'S4R-10: ' + c[0] + ', called by an ordinary member, changes nothing' + (out.length ? ' (sent: ' + out.join(', ') + ')' : '') + (err ? ' (threw: ' + err + ')' : ''));
  });
  /* Reset all data is not offered to a member */
  G.UI.navMore = true; G.render();
  ok(G.document.getElementById('navRight').innerHTML.indexOf('data-act="reset"') < 0, 'S4R-10: Reset all data is not in an ordinary member\'s More menu');
  G.UI.navMore = keep.more; G.render();
  /* the control: an administrator's clearData does reach the server */
  G.currentUserId = 'd1'; out.length = 0; G.clearData();
  ok(out.indexOf('commitSeed') >= 0, 'S4R-10 control: an administrator\'s Reset all data goes through');
  G.USERS.length = 0; keep.users.forEach(u => G.USERS.push(u)); G.currentUserId = keep.me; G.isAppAdmin = keep.app; G.currentModal = keep.modal;
  G.$ = keep.$; G.postJSON = keep.post; G.confirm = keep.confirm; G.prompt = keep.prompt; G.alert = keep.alert; G.Store.commitSeed = keep.commit;
})();

/* ── SWEEP 4R item 4 (addendum 5 Oct 2026): a lock belongs to a session (this tab), not a person ── */
(function(){
  const keepTab = G.TAB_ID, keepPage = G.currentPage, keepUser = G.currentUserId;
  ok(typeof G.TAB_ID === 'string' && /^tab_[a-z0-9]+$/.test(G.TAB_ID), 'S4R-4: this page has its own tab id');
  G.currentPage = 'home';
  if (!G.currentUserId && G.USERS.length) G.currentUserId = G.USERS[0].id;   /* a lock needs someone signed in */
  ok(!!G.currentUserId && !!G.currentOrgId, 'S4R-4 fixture: someone is signed in to an organization');
  G.TAB_ID = 'tab_hA';
  ok(G.Collab.acquire('s4r4::rec') === true, 'S4R-4: tab A takes a record');
  G.TAB_ID = 'tab_hB';   /* the same person, another tab (the browser's lock store is shared) */
  ok(!!G.Collab.lockedByOther('s4r4::rec') && G.Collab.acquire('s4r4::rec') === false, 'S4R-4: the same person in another tab sees the lock and is refused');
  G.Collab.release('s4r4::rec');
  G.TAB_ID = 'tab_hA';
  ok(G.Collab.lockedByOther('s4r4::rec') === null && G.Collab.acquire('s4r4::rec') === true, 'S4R-4: another tab cannot release it, and the holding tab\'s own lock does not block it');
  G.Collab.release('s4r4::rec');
  const app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  ok(app.indexOf('body.tab = sid();') >= 0 && app.indexOf("'&tab=' + encodeURIComponent(sid())") >= 0 && app.indexOf("sid: l.mine ? sid() : ('other:'") >= 0, 'S4R-4: claims, releases and the lock list carry the tab, and the server\'s "mine" is this tab\'s');
  const wl = fs.readFileSync(path.join(ROOT, 'api', 'models', 'WorkspaceLock.php'), 'utf8');
  ok(wl.indexOf("$same = '(user_public_id = VALUES(user_public_id) AND tab_id = VALUES(tab_id))';") >= 0 && /AND user_public_id = \? AND tab_id = \?/.test(wl), 'S4R-4: the server holds a lock by person AND tab (claim, release)');
  G.TAB_ID = keepTab; G.currentPage = keepPage; G.currentUserId = keepUser;
})();

/* ── SWEEP 4R item 5 (addendum 5 Oct 2026): Team Chat's unread badge counts ── */
(function(){
  const keep = { msgs: G.chatMessages, last: G.chatLastId, seen: G.gchatSeenId, open: G.gchatOpen, actor: G.actorId, sample: G.SAMPLE_MODE, watching: G.chatWatching };
  G.actorId = () => 'usr_me'; G.gchatOpen = false; G.gchatSeenId = null;
  G.chatMessages = [{ id: 1, user_public_id: 'usr_col' }]; G.chatLastId = 1;
  G.gchatRecount();
  eq(G.gchatUnreadCount, 0, 'S4R-5: what is in the room when it is first read counts as seen (signing in starts at zero)');
  G.chatMessages.push({ id: 2, user_public_id: 'usr_col' }, { id: 3, user_public_id: 'usr_me' }); G.chatLastId = 3; G.chatOnNew();
  eq(G.gchatUnreadCount, 1, 'S4R-5: a colleague\'s message raises the badge; one\'s own does not');
  G.chatMessages.push({ id: 4, user_public_id: 'usr_col' }, { id: 5, user_public_id: 'usr_col2' }); G.chatLastId = 5; G.chatOnNew();
  eq(G.gchatUnreadCount, 3, 'S4R-5: it counts messages, not batches (two in one fetch add two)');
  G.gchatOpen = true; G.gchatRecount();
  eq(G.gchatUnreadCount, 0, 'S4R-5: opening the panel clears it');
  G.gchatOpen = false; G.gchatRecount();
  eq(G.gchatUnreadCount, 0, 'S4R-5: closed again, messages already seen do not reappear');
  G.chatMessages.push({ id: 6, user_public_id: 'usr_col' }); G.chatLastId = 6; G.chatOnNew();
  eq(G.gchatUnreadCount, 1, 'S4R-5: the next colleague\'s message counts once');
  G.chatShutdown();
  ok(G.gchatUnreadCount === 0 && G.gchatSeenId === null && G.chatWatching === false, 'S4R-5: the seal (chatShutdown) starts the next session at zero');
  G.SAMPLE_MODE = true; G.chatWatch();
  ok(G.chatWatching === false, 'S4R-5: the sample tab never starts listening (it makes no request to any server)');
  ok(/function render\(\) \{\n  try \{ if \(currentOrgId && currentUserId && window\.chatWatch\) chatWatch\(\); \} catch \(e\) \{ \}/.test(fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8')), 'S4R-5: Team Chat listens from sign-in (render starts chatWatch), not from the first open');
  G.chatMessages = keep.msgs; G.chatLastId = keep.last; G.gchatSeenId = keep.seen; G.gchatOpen = keep.open; G.actorId = keep.actor; G.SAMPLE_MODE = keep.sample; G.chatWatching = keep.watching;
})();

/* ── S4R-7 (Sweep 4R item 7, 7 Oct 2026): the console's Change password; an unchanged password answers A.5.10 ── */
(function(){
  const keep = { $: G.$, pw: G.UI.pwDialog, cap: G.Auth.changeAdminPassword, modal: G.currentModal };
  const f = {}; const field = id => (f[id] = f[id] || { value: '', focus: function () { } });
  G.$ = function (id) { return (id === 'pwCurrent' || id === 'pwNew' || id === 'pwConfirm') ? field(id) : null; };
  const calls = []; let answer = null;
  G.Auth.changeAdminPassword = function (cur, next, cb) { calls.push([cur, next]); cb(answer); };
  const run = (cur, p1, p2, ans) => { G.UI.pwDialog = { kind: 'admin', err: '', done: '', busy: false }; field('pwCurrent').value = cur; field('pwNew').value = p1; field('pwConfirm').value = p2; answer = ans; calls.length = 0; G.doChangePassword(); return G.UI.pwDialog; };
  let st = run('NextChapter2026!', 'NextChapter2026!', 'NextChapter2026!', { ok: false, reason: 'same' });
  ok(calls.length === 1 && calls[0][0] === 'NextChapter2026!' && calls[0][1] === 'NextChapter2026!' && st.err === 'Choose a password different from your current one.', 'S4R-7: an unchanged password goes to the server even when it breaks the rule (the published default does), and shows A.5.10');
  st = run('password1!', 'password1!', 'password1!', { ok: false, reason: 'bad-current' });
  ok(calls.length === 1 && st.err === 'Your current password is not correct.', 'S4R-7: a wrong current password retyped as the new one is still A.5.15 (the server\'s order)');
  st = run('Good#Cur2026x', 'password1!', 'password1!', null);
  ok(calls.length === 0 && st.err === 'That password is too common. Choose another.', 'S4R-7: a different new password still meets the rule in the browser first');
  st = run('', 'Next#Good2026x', 'Next#Good2026x', null);
  ok(calls.length === 0 && st.err === 'Enter your current password.', 'S4R-7: never a new password without the current one');
  st = run('Good#Cur2026x', 'Next#Good2026x', 'Next#Good2026x', { ok: true });
  ok(calls.length === 1 && calls[0][0] === 'Good#Cur2026x' && st.done === 'Your password has been changed.', 'S4R-7: a good change is sent as (current, next) and saves');
  G.$ = keep.$; G.UI.pwDialog = keep.pw; G.Auth.changeAdminPassword = keep.cap; G.currentModal = keep.modal;
})();

/* ── INVITE (7 Oct 2026, ruled by the user): a new member's temporary password travels WITH the add and into the access email ── */
(function(){
  const calls = []; const _post = G.postJSON, _osid = G.orgServerId, _persist = G.persistRoster;
  G.postJSON = function (url, body, okCb) { calls.push({ url: String(url), body: body }); okCb({ data: { id: 'usr_inv1', invite: { status: 'sent' } } }); };
  G.orgServerId = function () { return 'org_srv_inv'; }; G.persistRoster = function () { };
  const u = { id: 'loc_inv1', name: 'Ines New', username: 'inesnew', role: 'Analyst', scope: 'All', email: 'ines@example.test', dept: 'Risk' };
  let res = null; G.syncMemberToServer(u, function (r) { res = r; }, 'Kestrel#4417pane');
  ok(calls.length === 1 && /\/users$/.test(calls[0].url) && calls[0].body.temporary === 'Kestrel#4417pane' && res && res.ok && u.serverId === 'usr_inv1', 'INVITE: adding a member sends its temporary password with POST /users (the server puts it in the access email)');
  ok(!('temporary' in u) && JSON.stringify(u).indexOf('Kestrel') < 0, 'INVITE: the password is never kept on the member record');
  calls.length = 0; G.syncMemberToServer(u, function () { }, 'Other#1234pane');
  ok(calls.length === 1 && /\/users\/update$/.test(calls[0].url) && !('temporary' in calls[0].body), 'INVITE: an edit never carries a password in the profile (a new temporary one goes to /admin/temporary-password)');
  G.postJSON = _post; G.orgServerId = _osid; G.persistRoster = _persist;
  eq(G.inviteMessage({ status: 'sent' }, { name: 'Ines', email: 'ines@example.test' }, true), 'Access email sent to ines@example.test, with their temporary password.', 'INVITE: the admin is told the email carried the temporary password');
  ok(/a retry will not carry it/.test(G.inviteMessage({ status: 'send-failed', error: 'x' }, { name: 'Ines' }, true)), 'INVITE: when the email fails, the admin is told to pass the password on (the stored copy withholds it)');
  const inv = fs.readFileSync(path.join(ROOT, 'api', 'core', 'MemberInvite.php'), 'utf8');
  ok(/'body_html'\s*=> \$storedHtml/.test(inv) && /'body_text'\s*=> \$storedText/.test(inv), 'INVITE 6.1.1: mail_outbox stores the copy with the password withheld; only the SMTP send carries it');
})();

/* ── FONTS (Directive 2 Oct 2026, Part 1): our own fonts on the Pipeline (6 Oct), Executive Readiness and Responsible AI Governance (7 Oct) ── */
(function(){
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const php = rd('index.php');
  /* Every program since 12 Oct 2026 (page speed): the swap is unconditional, so it covers these three and the
     Leaders programs alike — no program list in front of it to fall out of date. */
  ok(/\n\$html = \(string\) preg_replace\(\s*'#<link\\s\+href="https:\/\/fonts\\\.googleapis\\\.com\/css2/.test(php)
     && !/in_array\(\(\$boot\['module'\]\['id'\] \?\? ''\), \['pipeline'/.test(php),
     'FONTS: index.php swaps the Google link for fonts/fonts.css on every page, for every program');
  const gov = rd('js/modules/ai-governance/program.js');
  ok(!/fonts\.(googleapis|gstatic)\.com/.test(gov), 'FONTS: Responsible AI Governance\'s own print window (program.js) names no Google font server');
  ok(/new URL\('fonts\/print-governance\.css', document\.baseURI \|\| location\.href\)/.test(gov), 'FONTS: it links fonts/print-governance.css resolved against document.baseURI (<base href="/apps/">)');
  const er = rd('js/modules/exec-readiness/steps.js');
  ok(!/fonts\.(googleapis|gstatic)\.com/.test(er), 'FONTS: Executive Readiness\'s own print window (steps.js) names no Google font server');
  ok(/new URL\('fonts\/print\.css', document\.baseURI \|\| location\.href\)/.test(er), 'FONTS: it links fonts/print.css resolved against document.baseURI (<base href="/apps/">)');
  const app = rd('js/app.js');
  ok(/\(Modules\.isActive\('exec-readiness'\) \|\| Modules\.isActive\('ai-governance'\)\)\) \? '<link rel="stylesheet" href="'\+\(function\(\)\{try\{return new URL\('fonts\/print\.css'/.test(app),
     'FONTS: the shell\'s print window also uses fonts/print.css on an Executive Readiness or Responsible AI Governance page');
  const faces = f => (rd('fonts/' + f).match(/@font-face\{[^}]*\}/g) || []).map(r => /font-family:'([^']+)'/.exec(r)[1] + ' ' + /font-style:(\w+)/.exec(r)[1] + ' ' + /font-weight:(\d+)/.exec(r)[1])
    .filter((v, i, a) => a.indexOf(v) === i).sort().join(', ');
  eq(faces('print.css'), 'Cormorant Garamond normal 400, Cormorant Garamond normal 600, DM Mono normal 400, DM Mono normal 500, DM Sans normal 400, DM Sans normal 600, DM Sans normal 700, DM Sans normal 800',
     'FONTS: fonts/print.css is exactly the print window\'s Google weights');
  eq(faces('print-governance.css'), 'Cormorant Garamond italic 400, Cormorant Garamond normal 300, Cormorant Garamond normal 400, Cormorant Garamond normal 600, DM Mono normal 300, DM Mono normal 400',
     'FONTS: fonts/print-governance.css is exactly Responsible AI Governance\'s print window\'s Google weights');
  const missing = ['fonts.css', 'print.css', 'print-governance.css'].map(f => (rd('fonts/' + f).match(/url\('([^']+)'\)/g) || []).map(u => u.slice(5, -2))).reduce((a, b) => a.concat(b), [])
    .filter(u => !fs.existsSync(path.join(ROOT, 'fonts', u)));
  ok(missing.length === 0, 'FONTS: every file fonts.css, print.css and print-governance.css name is in fonts/' + (missing.length ? ' (missing ' + missing.join(', ') + ')' : ''));
})();

console.log('Behavioral harness (rebuilt) — ' + (pass+fail) + ' assertions');
console.log('  PASS: ' + pass);
console.log('  FAIL: ' + fail);
if (alerts.length) console.log('  (app alert() calls captured: ' + alerts.length + ')');
if (fail) {
  console.log('\nFailing assertions:');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exitCode = 1;
} else {
  console.log('  ✓ all green');
}
console.log('──────────────────────────────────────────');
