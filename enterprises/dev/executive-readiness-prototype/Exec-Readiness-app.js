/* ═══ DATA & STATE ═══ */
var SK = 'exec-readiness-v1.2';
function emptyData() { return { assessments: {}, leaders: [], risks: [], depScan: [], structure: {}, roles: [], collabPrinciples: {}, competencies: {}, valuesArch: [], fluencyLog: [], decisions: [], scenarios: [], rhythm: {}, evaluation: {}, review: {}, slowThinking: [], completedSteps: {}, completedSections: {}, notes: [], landscapeNotes: {}, assigns: {}, roster: null, members: [], orgSetup: false, enterprise: {}, settings: { aiGuide: false, voice: false } }; }
var data = emptyData();
/* Item-13 (F-13, ruled 27 July): adoption-render harvest narrowing flag.
   undefined = ordinary local render, harvest-all (unchanged behavior);
   a field id = adoption render with that field focused, harvest it alone;
   false = adoption render with nothing focused, harvest nothing. */
var __adoptHarvestOnly;

/* ============================================================
   Store - the single persistence seam (Phase 1: server-prep).
   Every durable read/write goes through this module. Backed by
   localStorage today; to move to a server, the dev team repoints
   the ADAPTER block below (raw get/set/del, the org-blob methods,
   and the discrete-op methods) at their API - call sites do not
   change.

   Local backing preserves today's behavior: readOrg/writeOrg move
   the whole org record (localStorage has no partial write). The
   discrete ops (patch / setPath / removeRec) are the server-shaped
   write vocabulary; Phase 2 reroutes the field/record write helpers
   onto them so a server can apply each as a PATCH on one record
   instead of rewriting the blob.
   ============================================================ */
var Store = (function () {
  /* -- ADAPTER: the one place to repoint to a server -- */
  function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function readJSON(k, f) { var s = rawGet(k); if (s == null) return f; try { return JSON.parse(s); } catch (e) { return f; } }
  function writeJSON(k, v) { return rawSet(k, JSON.stringify(v)); }

  /* -- keys (one source of truth) -- */
  var LEGACY_KEY = 'exec-readiness-v1.2', ORGS_KEY = 'exec-readiness-orgs', CURRENT_ORG_KEY = 'exec-readiness-current-org',
    REMEMBER_KEY = 'exec-readiness-remember';
  function orgKey(id) { return 'exec-readiness-org-data::' + id; }
  function prefKey(name) { return 'exec-readiness-' + name; }

  /* -- org data blob (wholesale today; the future server record) -- */
  function readOrg(id) { return readJSON(orgKey(id), null); }
  function orgRaw(id) { return rawGet(orgKey(id)); }
  /* -- revisioned writes (multi-user prep, July 8) --------------------
     Every persisted blob carries schemaVersion and a monotonic rev. The
     local store never rejects a write; the server enforces optimistic
     concurrency: PUT {baseRev, blob} → 200 {rev: baseRev+1} when its
     stored rev === baseRev, else 409 {stale:true, rev} – and on a 409
     the server adapter calls handleStaleWrite() below. revKey mirrors
     the blob's rev in a tiny record so change-polling never parses the
     whole blob (server equivalent: GET /org/{id}/rev). */
  var SCHEMA_VERSION = 1;
  function revKey(id) { return 'exec-readiness-org-rev::' + id; }
  function orgRev(id) { var v = parseInt(rawGet(revKey(id)), 10); return isNaN(v) ? 0 : v; }
  function writeOrg(id, obj) {
    if (obj && typeof obj === 'object') { obj.schemaVersion = SCHEMA_VERSION; obj.rev = (obj.rev || 0) + 1; }
    var okW = writeJSON(orgKey(id), obj);
    if (okW && obj) rawSet(revKey(id), String(obj.rev || 0));
    return okW;
  }
  function removeOrg(id) { rawDel(orgKey(id)); rawDel(revKey(id)); }

  /* -- discrete write vocabulary (server-shaped; Phase 2 targets) --
     Local impl mutates the active replica `data`, then persists it
     whole; a server maps each call to a PATCH on one record. */
  /* dirty-record set: commit() marks which record changed, then persists.
     Locally the whole blob is rewritten (localStorage has no partial write);
     a server adapter flushes the dirty records and calls clearDirty(), so each
     write - and each lock - is scoped to a single record. Scaffolding the devs
     can build on or replace. */
  var _dirty = {};
  function recKey(collection, id) { return collection + (id == null ? '' : ('::' + id)); }
  function persistActive() { if (typeof currentOrgId !== 'undefined' && currentOrgId) writeOrg(currentOrgId, data); }
  function commit(collection, id) { _dirty[recKey(collection, id)] = true; persistActive(); }
  function patch(collection, id, fields) {
    if (!data[collection]) data[collection] = {};
    var rec = (id == null) ? data[collection] : (data[collection][id] || (data[collection][id] = {}));
    for (var k in fields) { if (Object.prototype.hasOwnProperty.call(fields, k)) rec[k] = fields[k]; }
    commit(collection, id);
  }
  function setPath(path, value) {
    var parts = ('' + path).split('.'), o = data, i;
    for (i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = value; commit(parts[0], parts.length > 1 ? parts[1] : null);
  }
  function removeRec(collection, id) { if (data[collection]) delete data[collection][id]; commit(collection, id); }

  /* -- multi-user client machinery (July 8) ---------------------------
     refreshOrg(): adopt a newer stored blob for the active org without
     losing the edit in progress. The focused field's value and caret are
     captured before the re-render and restored after, so a user typing
     mid-refresh keeps typing and their value commits on blur exactly as
     it would have. Reuses loadData() so the schema-normalization
     migrations run on every adopted blob. Returns true when a newer
     blob was adopted. */
  function captureFocus() {
    try {
      var a = document.activeElement;
      if (!a || !a.id || !('value' in a)) return null;
      return {
        id: a.id, value: a.value,
        s: (typeof a.selectionStart === 'number') ? a.selectionStart : null,
        e: (typeof a.selectionEnd === 'number') ? a.selectionEnd : null
      };
    } catch (e) { return null; }
  }
  function restoreFocus(f) {
    try {
      if (!f) return; var el = document.getElementById(f.id); if (!el) return;
      el.value = f.value; el.focus();
      if (f.s != null && el.setSelectionRange) el.setSelectionRange(f.s, f.e == null ? f.s : f.e);
    } catch (e) { }
  }
  function refreshOrg() {
    if (typeof currentOrgId === 'undefined' || !currentOrgId) return false;
    if (orgRev(currentOrgId) <= ((data && data.rev) || 0)) return false;
    var f = captureFocus();
    loadData(); applyTeamRoster();
    __adoptHarvestOnly = (f && f.id) ? f.id : false; /* Item-13 (F-13): narrow the harvest on this adoption render */
    _adoptPaint = true;
    try { render(); } catch (e) { }
    _adoptPaint = false;
    __adoptHarvestOnly = undefined;
    restoreFocus(f);
    return true;
  }

  /* stale-write recovery: re-pull, overlay the local dirty records onto
     the fresh blob, persist, clear the dirty set. Unreachable in local
     mode (the local store never rejects a write); the server adapter
     calls it on a 409. Record-level last-writer-wins, per the blob-PUT
     ruling – optimize only if contention demands. The dirty set means
     'changed since the last successful sync': the server adapter clears
     it on every 200 (locally it is scaffolding and accumulates). */
  function mergeDirtyInto(fresh, local, dirtyKeys) {
    (dirtyKeys || []).forEach(function (k) {
      var i = k.indexOf('::');
      if (i < 0) { fresh[k] = local[k]; }
      else {
        var col = k.slice(0, i), id = k.slice(i + 2);
        if (!fresh[col] || typeof fresh[col] !== 'object') fresh[col] = {};
        fresh[col][id] = (local[col] || {})[id];
      }
    });
    return fresh;
  }
  function handleStaleWrite(id) {
    var fresh = readOrg(id); if (!fresh) return false;
    mergeDirtyInto(fresh, data, Object.keys(_dirty));
    data = fresh;
    var okW = writeOrg(id, data);
    if (okW) _dirty = {};
    try { applyTeamRoster(); render(); } catch (e) { }
    return okW;
  }

  /* change signal: storage events are the local channel (another tab's
     write fires them); polling is the fallback. A server build pushes
     the same nudge over the Collab channel (its read/write adapter
     lines) and keeps this polling as the fallback. Cheap: compares the
     mirrored rev record, never the blob. Both hooks no-op in the test
     probe, where addEventListener and setInterval are stubs. */
  var CHANGE_POLL_MS = 5000;
  function checkRemote() {
    try {
      if (typeof currentOrgId === 'undefined' || !currentOrgId) return false;
      if (orgRev(currentOrgId) > ((data && data.rev) || 0)) return refreshOrg();
    } catch (e) { }
    return false;
  }
  function startChangeSignal() {
    try {
      window.addEventListener('storage', function (ev) {
        try { if (ev && currentOrgId && (ev.key === orgKey(currentOrgId) || ev.key === revKey(currentOrgId))) checkRemote(); } catch (e) { }
      });
    } catch (e) { }
    try {
      setInterval(function () {
        try { if (typeof document !== 'undefined' && document.hidden) return; } catch (e) { }
        checkRemote();
      }, CHANGE_POLL_MS);
    } catch (e) { }
  }

  /* -- boot readiness (async loader, July 8) --------------------------
     ready(cb) is the seam the boot sequence waits on. Local mode:
     localStorage needs no fetch, so cb fires synchronously in the same
     tick and boot is the shipped behavior unchanged (the harness
     depends on this). Server mode: warm an in-memory cache here – the
     org list, the current org blob and its rev, the remember record,
     the admin record – then fire cb. Every synchronous Store getter
     serves from that warm cache afterward, so no other call site
     changes. Device-local prefs (getPref/setPref: zoom, sidebar state)
     stay on localStorage in every mode and may be read at eval time. */
  function ready(cb) { cb(); }

  return {
    raw: { get: rawGet, set: rawSet, del: rawDel },
    orgKey: orgKey,
    readOrg: readOrg, orgRaw: orgRaw, writeOrg: writeOrg, removeOrg: removeOrg,
    patch: patch, setPath: setPath, removeRec: removeRec, commit: commit, persistActive: persistActive,
    dirtyRecords: function () { return Object.keys(_dirty); }, clearDirty: function () { _dirty = {}; },
    refreshOrg: refreshOrg, orgRev: orgRev, checkRemote: checkRemote, startChangeSignal: startChangeSignal, ready: ready,
    mergeDirtyInto: mergeDirtyInto, handleStaleWrite: handleStaleWrite,
    schemaVersion: function () { return SCHEMA_VERSION; },
    getOrgs: function () { return readJSON(ORGS_KEY, []); },
    setOrgs: function (list) { return writeJSON(ORGS_KEY, list); },
    getCurrentOrg: function () { return rawGet(CURRENT_ORG_KEY); },
    setCurrentOrg: function (id) { id ? rawSet(CURRENT_ORG_KEY, id) : rawDel(CURRENT_ORG_KEY); },
    getRemember: function () { return readJSON(REMEMBER_KEY, null); },
    setRemember: function (o) { o ? writeJSON(REMEMBER_KEY, o) : rawDel(REMEMBER_KEY); },
    getPref: function (name, f) { var v = rawGet(prefKey(name)); return v == null ? f : v; },
    setPref: function (name, v) { rawSet(prefKey(name), v); },
    legacyRaw: function () { return rawGet(LEGACY_KEY); }
  };
})();

var currentPage = 'home', currentStep = null, currentPhase = null; var gateArmed = false, _lastGateStep = null;
var coachOpen = false, notesOpen = false;
var UI = { sec: 'A', ctxOpen: {}, addForm: false, editIdx: null, assignOpen: null, orgAddForm: false, orgEditId: null, orgSelected: null, orgZoom: 1, zoom: 1, navMore: false, navOpen: undefined, _navPageKey: null, mfTab: 'intro', crTab: 'reflections' };
var UI_PRISTINE = JSON.stringify(UI); /* the session's starting state, for sealSession */
var coachMsgs = [{ role: 'ai', text: 'Welcome to Executive Readiness. I\u2019m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.' }];
var COACH_MSGS_PRISTINE = JSON.stringify(coachMsgs); /* the AI Guide's opening, for sealSession */

/* ═══ USERS & AUTH ═══ */
var ORG_PALETTE = ['#4E7FA6', '#4866A0', '#458363', '#8158A0', '#8B5E3C', '#6B4C8A', '#9B2D3F', '#2D5A8E'];
var USERS = [];

/* ═══════════════════════════════════════════════════════════════
   CLAUDE API ENDPOINT
   ─────────────────────────────────────────────────────────────
   Default: direct to Anthropic. Works inside Anthropic's hosted
   environment (Claude Artifacts), which injects the API key and
   handles CORS automatically.

   For self-hosted deployment (your own server, faisalhoque.com,
   any static host), point this at your proxy that holds the API
   key server-side. See /proxy/server.js for a minimal Express
   example, or /proxy/cloudflare-worker.js for serverless.

   Example for a proxied deployment:
     var CLAUDE_API_URL = '/api/claude';
     // or
     var CLAUDE_API_URL = 'https://your-proxy.example.com/claude';
   ═══════════════════════════════════════════════════════════════ */
var CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

var currentUserId = null;
var currentOrgId = null; // assigned in bootApp() – reading the store is a boot-time act (async loader, July 8)
var isAppAdmin = false;
var SAMPLE_LOCAL_ID = 'org_sample_local'; var SAMPLE_MODE = false; /* Part 3: the private sample organization */

/* ═══════════════════════════════════════════════════════════════
   AUTH — sign-in requests (Part 5, 2 Oct 2026)
   ═══════════════════════════════════════════════════════════════
   The browser shows the screens, checks a proposed password against the rule so people get an immediate
   answer, sends passwords to the server over HTTPS, and never keeps them. The server (Part 6) stores and
   checks them. The browser does not hash: a hash made in the browser simply becomes the thing that is sent.
   AUTH_ENDPOINT is the server's base address. The dev build sets it from dev-auth-server.js, a stand-in
   that answers the same requests inside the browser and is never deployed. */
var AUTH_ENDPOINT = (typeof window !== 'undefined' && window.DEV_AUTH_ENDPOINT) || ''; // deployment: the sign-in server's address (Part 6.2)
/* -- PASSWORD RULES (1 Oct 2026): the same code in every module. The server applies the same rules again. -- */
var PASSWORD_MIN_LENGTH = 8;
var PASSWORD_MAX_LENGTH = 128;
var COMMON_PASSWORDS = ['password1!','password123!','p@ssw0rd','p@ssword1','pa$$w0rd','pa$$word1','passw0rd!','welcome1!','welcome123!','admin123!','admin@123','qwerty123!','qwerty1!','abc123!@#','changeme1!','letmein1!','iloveyou1!','monkey123!','dragon123!','football1!','baseball1!','sunshine1!','princess1!','test123!','user123!','hello123!','secret123!','company1!','1q2w3e4r!','1qaz2wsx!','zaq1@wsx','!qaz2wsx','summer2025!','winter2025!','summer2026!','winter2026!','spring2026!','autumn2026!','fall2026!','nextchapter1!','nextchapter2026!'];
function passwordLength(pw){ return Array.from(String(pw == null ? '' : pw)).length; }
function passwordProblem(pw){
  pw = String(pw == null ? '' : pw);
  var n = passwordLength(pw);
  if (n < PASSWORD_MIN_LENGTH) return 'Use at least ' + PASSWORD_MIN_LENGTH + ' characters.';
  if (n > PASSWORD_MAX_LENGTH) return 'Use no more than ' + PASSWORD_MAX_LENGTH + ' characters.';
  if (!/[0-9]/.test(pw)) return 'Include at least one number.';
  if (!/[^\p{L}\p{N}\s]/u.test(pw)) return 'Include at least one special character, such as ! or #.';
  if (COMMON_PASSWORDS.indexOf(pw.toLowerCase()) >= 0) return 'That password is too common. Choose another.';
  return '';
}
var SETUP_CODE = 'ABCXYZ'; /* 5.9: a placeholder until the voucher and registration system; the server checks it, never the browser alone */
/* The server's refusals in Appendix A's words (5.3). A password the server finds too common but this list does not still gets an answer. */
function authRefusal(res, pw) {
  var r = res && res.reason;
  if (r === 'no-user' || r === 'bad-password') return 'That username and password do not match.';
  if (r === 'no-credential') return 'This person has no sign-in yet. Ask your administrator to set a password.';
  if (r === 'locked') return 'Too many attempts. Try again in 15 minutes.';
  if (r === 'bad-current') return 'Your current password is not correct.';
  if (r === 'same') return 'Choose a password different from your current one.';
  if (r === 'weak' || r === 'common') return passwordProblem(pw) || 'That password is too common. Choose another.';
  if (r === 'taken') return 'That username is already taken. Choose another.';
  if (r === 'bad-code') return 'That setup code is not recognized.';
  return 'Could not reach the sign-in service. Try again.';
}
var Auth = (function () {
  /* One request each (Part 6.2), calling back with the server's answer; network failure answers {ok:false, reason:'network'}. */
  function req(method, path, body, cb) {
    var done = false;
    function fin(r) { if (done) return; done = true; if (cb) { try { cb(r && typeof r === 'object' ? r : { ok: false, reason: 'network' }); } catch (e) { try { console.error(e); } catch (_e) { } } } }
    try {
      var o = { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
      if (body !== undefined) o.body = JSON.stringify(body);
      fetch(AUTH_ENDPOINT + path, o).then(function (r) { return r.json(); }).then(fin, function () { fin(null); });
    } catch (e) { fin(null); }
  }
  function signIn(username, password, remember, cb) { req('POST', '/session', { username: username, password: password, remember: !!remember }, cb); }
  function signInAdmin(username, password, cb) { req('POST', '/admin-session', { username: username, password: password }, cb); }
  function currentSession(cb) { req('GET', '/session', undefined, cb); }
  function changePassword(current, next, cb) { req('POST', '/password', { current: current, next: next }, cb); }
  function changeAdminPassword(current, next, cb) { req('POST', '/admin/password', { current: current, next: next }, cb); }
  function setTemporaryPassword(orgId, userId, temporary, cb) { req('POST', '/admin/temporary-password', { orgId: orgId, userId: userId, temporary: temporary }, cb); }
  function signOut(cb) { req('POST', '/sign-out', {}, cb); }
  /* Not in 6.2 (for Param): setting up an organization with the setup code (5.9) and the administrator's username (5.12.3). */
  function setupOrganization(code, orgId, userId, username, password, remember, cb) { req('POST', '/setup', { code: code, orgId: orgId, userId: userId, username: username, password: password, remember: !!remember }, cb); }
  function changeAdminUsername(username, cb) { req('POST', '/admin/username', { username: username }, cb); }
  function usernameFree(username, orgId, userId, cb) { req('POST', '/username-check', { username: username, orgId: orgId, userId: userId }, cb); } /* Sweep 4R item 6 */

  /* -- this page's view of the session -- */
  function setSession(userId) { currentUserId = userId; }
  function setAdminSession(on) { isAppAdmin = !!on; }
  function clearSession() { currentUserId = null; isAppAdmin = false; try { Store.setRemember(null); } catch (e) { } }

  return {
    signIn: signIn, signInAdmin: signInAdmin, currentSession: currentSession, changePassword: changePassword,
    changeAdminPassword: changeAdminPassword, setTemporaryPassword: setTemporaryPassword, signOut: signOut,
    setupOrganization: setupOrganization, changeAdminUsername: changeAdminUsername, usernameFree: usernameFree,
    setSession: setSession, setAdminSession: setAdminSession, clearSession: clearSession
  };
})();

var currentModal = null; var orgSetupMode = false;
function getCurrentUser() { return USERS.find(function (u) { return u.id === currentUserId }) || null }

/* ================= Collab: live-collaboration seam ==================
   Record locks (and, later, presence + a shared timer) for multi-user use.
   The local implementation simulates a server using per-org localStorage,
   so the feature works and is testable now (two tabs, two users, one org).
   The dev team repoints read()/write() to the server's realtime channel;
   it is deliberately separate from Store, whose adapter points at the
   durable database - realtime state and durable state want different backends. */
var TAB_ID = 'tab_' + Math.random().toString(36).slice(2, 10);   /* Sweep 4R item 4 (addendum 5 Oct 2026): this tab's own id; two tabs of one person, or the app administrator's Open, lock each other out like anyone else */
var Collab = (function () {
  var LOCK_TTL = 15000;                       // a lock whose holder stops beating auto-releases
  function lKey() { return 'exec-readiness-locks::' + currentOrgId; }
  function read() { try { return JSON.parse(localStorage.getItem(lKey()) || '{}'); } catch (e) { return {}; } }   // Collab adapter -> server
  function write(o) { try { localStorage.setItem(lKey(), JSON.stringify(o)); } catch (e) { } }                    // Collab adapter -> server
  function me() { return currentUserId; }
  function sid() { return (typeof TAB_ID !== 'undefined' && TAB_ID) || 'tab'; }   /* Sweep 4R item 4: a lock belongs to this tab (session), not to the person */
  function fresh(t) { return t && (Date.now() - t) < LOCK_TTL; }
  function holder(rk) { if (!rk) return null; var h = read()[rk]; return (h && fresh(h.at)) ? h : null; }
  function lockedByOther(rk) { var h = holder(rk); return (h && h.sid !== sid()) ? h : null; }
  function acquire(rk) {
    if (SAMPLE_MODE || !currentOrgId || !me() || !rk) return true;
    var h = holder(rk); if (h && h.sid !== sid()) return false;
    var u = getCurrentUser() || {}, L = read(); L[rk] = { id: me(), sid: sid(), name: u.name || 'Someone', at: Date.now() }; write(L); return true;
  }
  function release(rk) { if (SAMPLE_MODE) return; var L = read(); if (rk && L[rk] && L[rk].sid === sid()) { delete L[rk]; write(L); } }
  function refreshMine() { if (SAMPLE_MODE || !currentOrgId || !me()) return; var L = read(), ch = false; for (var k in L) { if (L.hasOwnProperty(k) && L[k].sid === sid()) { L[k].at = Date.now(); ch = true; } } if (ch) write(L); }
  function leave() { if (SAMPLE_MODE || !currentOrgId || !me()) return; var L = read(), ch = false; for (var k in L) { if (L.hasOwnProperty(k) && L[k].sid === sid()) { delete L[k]; ch = true; } } if (ch) write(L); }
  function othersLocks() { var L = read(), out = []; for (var k in L) { if (L.hasOwnProperty(k) && fresh(L[k].at) && L[k].sid !== sid()) out.push({ key: k, name: L[k].name }); } return out; }
  return {
    acquire: acquire, release: release, holder: holder, lockedByOther: lockedByOther,
    refreshMine: refreshMine, leave: leave, othersLocks: othersLocks, LOCK_TTL: LOCK_TTL
  };
})();

function idToRecordKey(id) { /* item 2 (ruled July 16): donor pattern — prefix → collection; unmapped stays permissive */
  if (!id) return null;
  var i = id.indexOf('_'); if (i < 0) return null;                      // panel inputs (noteInput, gchatInput) and buttons: UI state, not shared records
  var pre = id.slice(0, i);
  var singles = {
    ap: 'assessments', af: 'assessments', ac: 'assessments', ad: 'assessments', ae: 'assessments',
    st: 'structure', cl: 'collabLab', ldr: 'leaders', org: 'enterprise', mm: 'mmActivation', dep: 'depScan',
    ov: 'valuesArch', risk: 'risks', or: 'orgChart', ru: 'roster', au: 'roster'
  };
  if (singles[pre]) return singles[pre];
  return null;                                                     // per-person surfaces (ma_/cr_/ldev_) and anything unmapped: no shared lock
}

/* Guard for button-driven writes: block and tell the user who holds the record.
   Wired blanket-wide 25 July (Paul's ruling): every button-driven write to a
   lock-mapped collection guards on the collection(s) it writes. Unmapped stores
   carry no guard by construction (no lock can exist on them); the admin console
   is excluded (cross-org writes vs the per-current-org lock channel — item 38). */
function lockBlocked(rk) { var h = Collab.lockedByOther(rk); if (!h) return false; try { alert('Locked \u2014 ' + ((h && h.name) || 'another user') + ' is editing this record. Try again when the lock clears.') } catch (e) { } return true }

/* Post-render pass: disable fields of records another user holds, mark who holds them.
   force=true always paints (fresh DOM after render); the tick uses force=false and skips
   when nothing changed, so it never flickers or fights typing. */
var _lockSig = '';
function applyLockUI(force) {
  try {
    var others = Collab.othersLocks(), sig = JSON.stringify(others);
    if (!force && sig === _lockSig) return; _lockSig = sig;
    var lockMap = {}; for (var m = 0; m < others.length; m++) lockMap[others[m].key] = others[m];
    var _roots = [document.getElementById('app'), document.getElementById('modalRoot')].filter(Boolean); if (!_roots.length) return;
    var root = { querySelectorAll: function (sel) { var out = []; for (var _r = 0; _r < _roots.length; _r++) { var _ns = _roots[_r].querySelectorAll(sel); for (var _n = 0; _n < _ns.length; _n++) out.push(_ns[_n]); } return out; } };
    var oldMarks = root.querySelectorAll('.collab-lock-mark'); for (var i = 0; i < oldMarks.length; i++) { if (oldMarks[i].parentNode) oldMarks[i].parentNode.removeChild(oldMarks[i]); }
    var wasLocked = root.querySelectorAll('[data-collab-locked]'); for (var j = 0; j < wasLocked.length; j++) { wasLocked[j].disabled = false; wasLocked[j].removeAttribute('data-collab-locked'); }
    var seen = {}, fields = root.querySelectorAll('input,select,textarea');
    for (var k = 0; k < fields.length; k++) {
      var el = fields[k], rk = idToRecordKey(el.id); if (!rk) continue; var h = lockMap[rk]; if (!h) continue;
      el.disabled = true; el.setAttribute('data-collab-locked', '1');
      if (!seen[rk]) {
        seen[rk] = true;
        var mk = document.createElement('div'); mk.className = 'collab-lock-mark';
        mk.style.cssText = 'font-size:11px;font-weight:600;color:#B8862E;margin:0 0 6px';
        mk.textContent = 'Locked \u00b7 ' + (h.name || 'Someone') + ' is editing';
        if (el.parentNode) el.parentNode.insertBefore(mk, el);
      }
    }
  } catch (e) { }
}

/* Acquire on focus, release when focus leaves all record fields (focusin handles field-to-field). */
var _heldLock = null;
var _adoptPaint = false; /* set by refreshOrg around its adoption render — see the re-inject rule at the end of render() */
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', function (e) {
    var t = e.target; if (!t || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName || '')) return;
    if (t.readOnly || t.disabled) return;
    var rk = idToRecordKey(t.id); if (!rk) return;
    if (Collab.lockedByOther(rk)) { if (t.blur) t.blur(); return; }
    if (_heldLock && _heldLock !== rk) { Collab.release(_heldLock); _heldLock = null; }
    if (Collab.acquire(rk)) _heldLock = rk;
  });
  document.addEventListener('focusout', function (e) {
    setTimeout(function () {
      var a = document.activeElement;
      var stillField = a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName || '') && idToRecordKey(a.id);
      if (_heldLock && !stillField) { Collab.release(_heldLock); _heldLock = null; }
    }, 60);
  });
  window.addEventListener('beforeunload', function () { try { Collab.leave(); } catch (e) { } });
  setInterval(function () { try { Collab.refreshMine(); applyLockUI(false); } catch (e) { } }, 4000);
}
/* ================= end Collab ================= */

// ── Individual-track login↔leader link ──────────────────────────────────────
// A leader record IS the individual; data.leaders[].userId links the logged-in
// roster user who "owns" that leader for the individual development track.
// One-to-one: linking a user to a leader strips that user from any other leader.
// Provenance (userLinkBy/userLinkAt) records who set the link and when — a
// lightweight accountability stamp, not a full audit log.
function linkUserToLeader(leaderId, userId, byUserId) {
  if (lockBlocked('leaders')) return;
  if (!data.leaders) return;
  // Strip this user from any other leader (enforce one-to-one).
  data.leaders.forEach(function (l) {
    if (l.userId === userId && l.id !== leaderId) { delete l.userId; delete l.userLinkBy; delete l.userLinkAt; }
  });
  var leader = data.leaders.filter(function (l) { return l.id === leaderId; })[0];
  if (!leader) return;
  if (userId) {
    leader.userId = userId;
    leader.userLinkBy = byUserId || (typeof currentUserId !== 'undefined' ? currentUserId : null) || null;
    leader.userLinkAt = Date.now();
  } else {
    // Empty selection clears the link on this leader.
    delete leader.userId; delete leader.userLinkBy; delete leader.userLinkAt;
  }
  saveData();
}
// The leader record owned by the currently logged-in user, or null if unlinked.
function getMyLeader() {
  if (typeof currentUserId === 'undefined' || !currentUserId) return null;
  return (data.leaders || []).filter(function (l) { return l.userId === currentUserId; })[0] || null;
}

function $(id) { return document.getElementById(id) }
function uid() { return Math.random().toString(36).slice(2, 10) }
function fmt(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function esc(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function val(id) { var e = $(id); return e ? e.value : '' }
function loadData() {
  if (!currentOrgId) { data = emptyData(); return; }
  try { var s = Store.orgRaw(currentOrgId); var base = emptyData(); if (s) { var d = JSON.parse(s); for (var k in d) base[k] = d[k]; } data = base; }
  catch (e) { data = emptyData(); }
}
function saveData() { if (!currentOrgId) return; try { Store.writeOrg(currentOrgId, data) } catch (e) { } }

/* ════════════ MULTI-ORG TENANCY + AUTH (ported from Innovation) ════════════ */
var ORGS_KEY = 'exec-readiness-orgs';
function getOrgs() { return Store.getOrgs(); }
function saveOrgs(list) { Store.setOrgs(list); }
function getOrg(id) { return getOrgs().filter(function (o) { return o.id === id; })[0] || null; }
function setCurrentOrg(id) { currentOrgId = id; Store.setCurrentOrg(id); }
function orgInitials(name) { var p = (name || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
function getOrgData(id) { return Store.readOrg(id) || emptyData(); }
function saveOrgData(id, d) { Store.writeOrg(id, d); if (id === currentOrgId) { data = d; applyTeamRoster(); } }

function createOrg(name, firstUser, keepSession, orgId) {
  var _owner = 'owner', _on = 1; while (usernameTaken(_owner)) _owner = 'owner' + (++_on); /* Sweep 4R item 6: a console-made organization's first person is owner, owner2 and so on, whichever is free */
  var id = orgId || 'org_' + Math.random().toString(36).slice(2, 9);
  var list = getOrgs(); list.push({ id: id, name: name || 'Untitled Organization', created: Date.now() }); saveOrgs(list);
  if (!keepSession) sealSession(); /* keepSession: the admin console adding an organization is not a change of organization (S.4) */
  setCurrentOrg(id);
  data = emptyData();
  data.startDate = new Date().toISOString().split('T')[0];
  data.enterprise = { name: name || '' };
  var owner = firstUser ? {
    id: firstUser.id || uid(), name: firstUser.name || 'Owner', username: (firstUser.username || '').trim(),
    role: firstUser.role || 'Administrator', initials: orgInitials(firstUser.name || 'Owner') || 'OW',
    color: '#4E7FA6', scope: 'All', email: (firstUser.email || '').trim(), admin: true
  } : { id: uid(), name: 'Owner', username: _owner, role: 'Administrator', initials: 'OW', color: '#4E7FA6', scope: 'All', admin: true };
  data.roster = [owner];
  saveData(); applyTeamRoster();
  return { orgId: id, userId: owner.id };
}
/* -- SESSION SEAL (2 Oct 2026): every organization is sealed. Nothing at all survives a change of organization or user: no carve-outs, preferences included. -- */
function sealSession(){
  try{ if(coachOpen) toggleCoach(); }catch(e){}
  try{ if(notesOpen) toggleNotes(); }catch(e){}
  try{ if(gchatOpen) toggleGChat(); }catch(e){}
  try{ closeModal(); }catch(e){}
  try{ if(carouselState && carouselState.timer) clearInterval(carouselState.timer); }catch(e){}
  try{ resetSessionBuffers(); }catch(e){}
  try{ ['notesPanel','coachPanel','gchatPanel'].forEach(function(id){ var p=$(id); if(p) p.innerHTML=''; }); }catch(e){} /* a closed panel keeps its markup; each redraws when opened, so empty them (Items 3+12, ruled 27 July: no stale panel after an org switch) */
  Object.keys(UI).forEach(function(k){ delete UI[k]; });
  var fresh = JSON.parse(UI_PRISTINE);
  Object.keys(fresh).forEach(function(k){ UI[k] = fresh[k]; });
  UI.theme = 'dark'; UI.zoom = 1; /* this module's default theme is dark (§5A.13, re-ruled 27 July); the directive's 'light' would override that ruling */
  try{ Store.raw.del('exec-readiness-theme'); Store.setPref('zoom', 1); Store.setPref('sidebar-min', '0'); }catch(e){} /* no stored theme = the default, as before the user first chooses */
  try{ document.documentElement.setAttribute('data-theme', 'dark'); }catch(e){}
  sidebarMinimized = false; sidebarOpen = true;
  currentPage = 'home'; currentStep = null; currentPhase = null;
  navHistory = [];
  insightsTab = 'latest';
  carouselState = {idx:0, timer:null, stepId:null, hover:false};
  gateArmed = false; _lastGateStep = null;
  coachMsgs = JSON.parse(COACH_MSGS_PRISTINE);
  gchatSeen = {}; /* the unread count at zero: this build derives it from the per-org seen marker (Item-12), so clearing the markers is the reset */
  orgSetupMode = false;
}
function switchToOrg(id) { sealSession(); setCurrentOrg(id); loadData(); applyTeamRoster(); Auth.setSession(null); }
function deleteOrgById(id) {
  var list = getOrgs().filter(function (o) { return o.id !== id; }); saveOrgs(list);
  try { Store.removeOrg(id); } catch (e) { }
  if (currentOrgId === id) { sealSession(); setCurrentOrg(null); Auth.setSession(null); data = emptyData(); USERS.length = 0; }
}
function migrateLegacyData() {
  if (getOrgs().length) return;
  var legacy = null; try { legacy = Store.legacyRaw(); } catch (e) { }
  if (!legacy) return; // no legacy, no invention (Paul, July 16): first-run goes to Setup
  var id = 'org_' + Math.random().toString(36).slice(2, 9);
  var d;
  if (legacy) { try { d = JSON.parse(legacy); } catch (e) { d = emptyData(); } } else { d = emptyData(); }
  if (!Array.isArray(d.roster)) { d.roster = []; /* normalize only — no auto-population (ruled July 16) */ }
  else { d.roster.forEach(function (u) { delete u.passcode; }); } /* Part 5: the organization's data holds no password */
  d.enterprise = d.enterprise || {}; if (!d.enterprise.name) d.enterprise.name = 'Executive Readiness';
  d.orgSetup = true;
  saveOrgs([{ id: id, name: d.enterprise.name || 'Executive Readiness', created: Date.now() }]);
  try { Store.writeOrg(id, d); } catch (e) { }
}
function fmtDate(ts) { try { return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
function fmt(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

/* -- PEOPLE AND PASSWORDS (Part 5, 2 Oct 2026) -- */
function unameKey(x) { return String(x == null ? '' : x).replace(/\s+/g, '').toLowerCase(); } /* Sweep 4R item 6 (addendum 5 Oct 2026): usernames compare ignoring capitals and every space */
function sameUsername(a, b) { return unameKey(a) === unameKey(b); }
/* 5.11 (Sweep 4R item 6): no two accounts share a username, ignoring capitals and every space, the app administrator's included; the server refuses again whatever the browser checked. */
function usernameTaken(username, exceptOrgId, exceptUserId) {
  if (!unameKey(username)) return false;
  if (exceptOrgId !== '__admin' && unameKey(username) === 'admin') return true; /* Sweep 4R item 6: the app administrator's username takes part, both ways; the browser knows only the default (Part 5.2), the server checks the stored one */
  var hit = false;
  getOrgs().forEach(function (o) {
    var r = (o.id === currentOrgId) ? USERS : ((Store.readOrg(o.id) || {}).roster || []);
    (r || []).forEach(function (m) { if (m && sameUsername(m.username, username) && !(o.id === exceptOrgId && m.id === exceptUserId)) hit = true; });
  });
  return hit;
}
/* Sweep 4R item 6: a person renamed in an editor is asked of the sign-in server first, which knows the administrator's stored
   username (adding a person and /setup are refused there already). No answer from the server lets the save go on. */
var _unameCleared=null;
function usernameServerCheck(username, orgId, userId, again, refuse){
  var k=orgId+'|'+userId+'|'+unameKey(username);
  if(_unameCleared===k){ _unameCleared=null; return false; }
  Auth.usernameFree(username, orgId, userId, function(r){ if(r && r.ok===false && r.reason==='taken') return refuse('That username is already taken. Choose another.'); _unameCleared=k; again(); });
  return true;
}
/* 5.10: only an organization's administrators, and the app administrator, manage its people. */
function canManagePeople() { var u = getCurrentUser(); return !SAMPLE_MODE && (!!isAppAdmin || !!(u && u.admin === true)); }
/* -- Sweep 4R item 2 (addendum 5 Oct 2026, Paul's decision; wording approved): administrators make administrators, and an organization always has one (A.5.29, A.5.30). -- */
var LAST_ADMIN_MSG='An organization needs at least one administrator. Make someone else an administrator first.';
function adminCountIn(list){return (list||[]).filter(function(x){return x&&x.admin===true}).length}
function adminTickHtml(id, on){ return '<label class="admin-tick"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'/> <span>Administrator</span></label>'; }
var _pendingCurrent = null; /* the password typed at sign-in, held in memory only until it is replaced (5.5) */
function pwRuleHtml() { return '<div class="pw-rule">At least 8 characters, including a number and a special character such as ! or #.</div>'; }
function tempPasswordFieldHtml(id) { return '<div><label class="org-flabel" for="' + id + '">Temporary password</label><input id="' + id + '" class="field-input" type="password" autocomplete="new-password"/>' + pwRuleHtml() + '<div class="pw-note">The person will be asked to choose their own password the next time they sign in.</div></div>'; }
function persistRoster() { data.roster = USERS.map(function (u) { return Object.assign({}, u); }); saveData(); }
function applyTeamRoster() {
  try {
    USERS.length = 0;
    if (Array.isArray(data.roster) && data.roster.length) {
      data.roster.forEach(function (u) { USERS.push(u); });
      if (Array.isArray(data.members) && data.members.length) {
        data.members.forEach(function (m) { USERS.push({ id: m.id || uid(), name: m.name || '', role: m.role || '', email: m.email || '', dept: m.dept || '', scope: '', initials: orgInitials(m.name) || '?', color: ORG_PALETTE[USERS.length % ORG_PALETTE.length] }); });
        data.members = [];
      }
    }
    USERS.forEach(function (u) { if (u) delete u.passcode; }); /* Part 5: the organization's data holds no password; this clears one left in old data */
    data.roster = USERS.map(function (u) { return Object.assign({}, u); });
  } catch (e) { }
}

/* ── Entry flow: username + password · setup · admin ── */
function loginKey(e) { if (e && e.key === 'Enter') doLogin(); }
function openMemberWorkspace(orgId, userId) { switchToOrg(orgId); Auth.setSession(userId); UI.entry = null; render(); }
function doLogin() {
  var un = $('loginUser'), pw = $('loginPassword');
  var username = un ? un.value.trim() : '', password = pw ? pw.value : '';   /* never cut a password short */
  if (pw) pw.value = '';
  UI.entry.user = username; // preserve the typed username across re-render
  var rc = $('loginRemember'); var remember = rc ? rc.checked : !!UI.entry.remember; UI.entry.remember = remember;
  if (!username) { UI.entry.err = 'Enter your username.'; render(); var u0 = $('loginUser'); if (u0) u0.focus(); return; }
  Auth.signIn(username, password, remember, function (res) {
    if (res && res.ok) {
      if (res.mustChange) { startChoosePassword('member', res.orgId, res.userId, password); return; }
      openMemberWorkspace(res.orgId, res.userId); return;
    }
    UI.entry.err = authRefusal(res, password); render();
    var p1 = $('loginPassword'); if (p1) p1.focus();
  });
}
function gotoSetup() { UI.entry = { step: 'setup', err: '' }; render(); }
function gotoLogin() { UI.entry = { step: 'login', err: '' }; render(); }
function gotoAdminLogin() { UI.entry = { step: 'admin-login', err: '' }; render(); }
/* ── Choose a new password (5.5): a temporary password, the administrator's first sign-in, or a stored password that breaks the rule ── */
function startChoosePassword(kind, orgId, userId, current) {
  _pendingCurrent = current;
  var sub = kind === 'admin' ? 'This password works only once. Choose your own to continue.'
    : (passwordProblem(current) ? 'Your password does not meet the current password rules. Choose a new one to continue.'
      : 'Your administrator set a temporary password. Choose your own to continue.');
  UI.entry = { step: 'choose-password', kind: kind, orgId: orgId || null, userId: userId || null, sub: sub, err: '' };
  render(); var f = $('newPassword'); if (f) f.focus();
}
function choosePasswordKey(e) { if (e && e.key === 'Enter') doChoosePassword(); }
function doChoosePassword() {
  var e = UI.entry; if (!e || e.step !== 'choose-password') return;
  var a = $('newPassword'), b = $('confirmPassword'), p1 = a ? a.value : '', p2 = b ? b.value : '';
  var prob = passwordProblem(p1);
  if (prob) { e.err = prob; render(); return; }
  if (p1 !== p2) { e.err = 'The two passwords do not match.'; render(); return; }
  if (a) a.value = ''; if (b) b.value = '';
  (e.kind === 'admin' ? Auth.changeAdminPassword : Auth.changePassword)(_pendingCurrent, p1, function (res) {
    if (res && res.ok) { _pendingCurrent = null; if (e.kind === 'admin') enterAppAsAdmin(); else openMemberWorkspace(e.orgId, e.userId); return; }
    e.err = authRefusal(res, p1); render();
  });
}
function leaveChoosePassword() { _pendingCurrent = null; Auth.signOut(); gotoLogin(); }
/* ── Set up a new organization (5.9): the setup code, then the first person's own password (5.7.4: not temporary) ── */
function doSetup() {
  function v(id) { var el = $(id); return el ? el.value : ''; }
  var code = v('setupCode').trim(), orgName = v('setupOrg').trim(), name = v('setupName').trim(), username = v('setupUser').trim(), email = v('setupEmail').trim(), password = v('setupPassword'), confirmPw = v('setupConfirm');
  var rc = $('setupRemember'), remember = rc ? rc.checked : false;
  UI.entry.keep = { code: code, org: orgName, name: name, user: username, email: email, remember: remember };
  function fail(m) { UI.entry.err = m; render(); }
  if (!code || !orgName || !name || !username || !password) return fail('Please complete all fields to continue.');
  if (code !== SETUP_CODE) return fail('That setup code is not recognized.');
  var prob = passwordProblem(password); if (prob) return fail(prob);
  if (password !== confirmPw) return fail('The two passwords do not match.');
  if (usernameTaken(username)) return fail('That username is already taken. Choose another.');
  var orgId = 'org_' + Math.random().toString(36).slice(2, 9), userId = uid();
  Auth.setupOrganization(code, orgId, userId, username, password, remember, function (res) {
    if (!res || !res.ok) return fail(authRefusal(res, password));
    createOrg(orgName, { id: userId, name: name, username: username, email: email, role: 'Administrator' }, false, orgId);
    Auth.setSession(userId);
    // Continue into the enterprise/team setup wizard
    UI.entry = null; orgSetupMode = true; currentModal = 'org'; render(); renderOrgModal();
  });
}
/* ── The app administrator (5.12): an account from installation, a username and a password ── */
function adminKey(e) { if (e && e.key === 'Enter') doAdminLogin(); }
function doAdminLogin() {
  var un = $('adminUser'), pw = $('adminPassword'), username = un ? un.value.trim() : '', password = pw ? pw.value : '';
  if (pw) pw.value = '';
  UI.entry.user = username;
  Auth.signInAdmin(username, password, function (res) {
    if (res && res.ok) { if (res.mustChange) { startChoosePassword('admin', null, null, password); return; } enterAppAsAdmin(); return; }
    UI.entry.err = authRefusal(res, password); render();
    var a = $('adminPassword'); if (a) a.focus();
  });
}
function enterAppAsAdmin() {
  Auth.setAdminSession(true);
  var orgs = getOrgs();
  if (!orgs.length) { UI.entry = { step: 'admin' }; render(); return; } // no orgs yet → console to create one
  var target = (currentOrgId && getOrg(currentOrgId)) ? currentOrgId : orgs[0].id;
  switchToOrg(target);
  Auth.setSession((USERS[0] && USERS[0].id) || null);
  if (!currentUserId) { UI.entry = { step: 'admin' }; render(); return; }
  UI.entry = null; render();
}
/* Item-10 (F-9, ruled 27 July): one guard, one behavior — the zero-roster alert is
   guidance, not navigation. Both admin Open paths alert the same string, restore the
   org/session the user came from, and repaint the surface they were on. */
function adminOpenGuard(prevOrg, prevUser, repaint) {
  alert('This organization has no members yet. Add one first.');
  if (prevOrg) { switchToOrg(prevOrg); Auth.setSession(prevUser || null); }
  if (typeof repaint === 'function') repaint();
}
function adminConsoleOpen(orgId) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  // Admin override: enter the org's workspace signed in as its first member
  var _pOrg = (typeof currentOrgId !== 'undefined') ? currentOrgId : null, _pUser = (typeof currentUserId !== 'undefined') ? currentUserId : null;
  switchToOrg(orgId);
  Auth.setSession((USERS[0] && USERS[0].id) || null);
  if (!currentUserId) { adminOpenGuard(_pOrg, _pUser, function () { UI.entry = { step: 'admin' }; render(); }); return; }
  try { Store.setRemember(null); } catch (e) { }
  UI.entry = null; render();
}
function adminConsoleDelete(orgId) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ var o = getOrg(orgId); if (!o) return; if (!confirm('Delete "' + o.name + '" and all of its data? This cannot be undone.')) return; deleteOrgById(orgId); UI.entry = { step: 'admin' }; render(); }
function adminConsoleNewOrg() { if (!isAppAdmin) return; UI.adminNewOrg = { err: '' }; currentModal = 'admin'; renderAdminModal(); } /* the Admin panel's form, over the console */
function exitAdmin() { Auth.signOut(); Auth.setAdminSession(false); UI.entry = { step: 'login', err: '' }; render(); }

/* ── Change password (5.6), and the administrator's username (5.12.3) ── */
function openChangePassword() { if (SAMPLE_MODE) return; UI.pwDialog = { kind: isAppAdmin ? 'admin' : 'member', err: '', done: '' }; currentModal = 'password'; renderPasswordModal(); var f = $('pwCurrent'); if (f) f.focus(); }
function openChangeUsername() { if (!isAppAdmin) return; UI.pwDialog = { kind: 'admin', err: '', done: '' }; currentModal = 'username'; renderPasswordModal(); var f = $('adminNewUsername'); if (f) f.focus(); }
function renderPasswordModal() {
  var mr = $('modalRoot'); if (!mr || (currentModal !== 'password' && currentModal !== 'username')) return;
  var s = UI.pwDialog || {};
  function fld(label, id, ac) { return '<label class="org-flabel" for="' + id + '">' + label + '</label><input id="' + id + '" class="field-input" type="password" autocomplete="' + ac + '"/>'; }
  var h = '<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal modal-narrow" role="dialog" aria-labelledby="pwTitle">';
  h += '<button class="modal-x" onclick="closeModal()" aria-label="Close">\u00D7</button>';
  if (currentModal === 'username') {
    h += '<h3 id="pwTitle">Change username</h3>';
    h += '<div class="pw-form"><label class="org-flabel" for="adminNewUsername">Username</label><input id="adminNewUsername" class="field-input" type="text" autocomplete="username"/></div>';
    if (s.err) h += '<div class="entry-err">' + esc(s.err) + '</div>';
    if (s.done) h += '<div class="pw-done" role="status">' + esc(s.done) + '</div>';
    h += '<div class="org-edit-actions"><button class="org-btn-save" onclick="doChangeUsername()">Save</button></div>';
  } else {
    h += '<h3 id="pwTitle">Change password</h3>';
    h += '<div class="pw-form">' + fld('Current password', 'pwCurrent', 'current-password') + fld('New password', 'pwNew', 'new-password') + pwRuleHtml() + fld('Confirm new password', 'pwConfirm', 'new-password') + '</div>';
    if (s.err) h += '<div class="entry-err">' + esc(s.err) + '</div>';
    if (s.done) h += '<div class="pw-done" role="status">' + esc(s.done) + '</div>';
    h += '<div class="org-edit-actions"><button class="org-btn-save" onclick="doChangePassword()">Save password</button></div>';
  }
  h += '</div></div>';
  mr.innerHTML = h;
}
function doChangePassword() {
  var s = UI.pwDialog || {}, c = $('pwCurrent'), a = $('pwNew'), b = $('pwConfirm');
  var cur = c ? c.value : '', p1 = a ? a.value : '', p2 = b ? b.value : '';
  function fail(m) { s.err = m; s.done = ''; renderPasswordModal(); }
  var prob = (p1 === cur) ? '' : passwordProblem(p1); if (prob) return fail(prob); /* Sweep 4R item 7: a new password equal to the current one goes to the server, which answers in its order: wrong current (A.5.15), then unchanged (A.5.10); the rule would otherwise answer first (the published default is on the common list) */
  if (p1 !== p2) return fail('The two passwords do not match.');
  [c, a, b].forEach(function (x) { if (x) x.value = ''; });
  (s.kind === 'admin' ? Auth.changeAdminPassword : Auth.changePassword)(cur, p1, function (res) {
    if (res && res.ok) { s.err = ''; s.done = 'Your password has been changed.'; renderPasswordModal(); return; }
    fail(authRefusal(res, p1));
  });
}
function doChangeUsername() { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var s = UI.pwDialog || {}, el = $('adminNewUsername'), u = el ? el.value.trim() : '';
  function fail(m) { s.err = m; s.done = ''; renderPasswordModal(); }
  if (!u) return fail('Enter your username.');
  if (usernameTaken(u, '__admin')) return fail('That username is already taken. Choose another.'); /* Sweep 4R item 6: not against itself */
  Auth.changeAdminUsername(u, function (res) {
    if (res && res.ok) { s.err = ''; s.done = 'Your username has been changed.'; renderPasswordModal(); return; }
    fail(authRefusal(res, ''));
  });
}
function updateAdminBar() {
  var bar = document.getElementById('adminViewBar');
  var show = isAppAdmin && currentUserId && getCurrentUser() && !UI.entry;
  if (show) {
    if (!bar) { bar = document.createElement('div'); bar.id = 'adminViewBar'; bar.className = 'admin-view-bar'; document.body.appendChild(bar); }
    var org = getOrg(currentOrgId); var u = getCurrentUser();
    bar.innerHTML = '<span class="admin-view-txt" title="Admin view \xb7 ' + esc(org ? org.name : '') + ' \xb7 acting as ' + esc(u.name || '') + '"><span class="admin-view-dot">\u25CF</span> Admin view \xb7 ' + esc(org ? org.name : '') + ' \xb7 acting as ' + esc(u.name || '') + '</span><button class="admin-view-btn" onclick="openAdmin()">Admin panel</button>';
  } else if (bar && bar.parentNode) { bar.parentNode.removeChild(bar); }
}
function orgRosterPreview(orgId) { var d = Store.readOrg(orgId); return (d && Array.isArray(d.roster)) ? d.roster : []; }

function renderEntry() {
  if (!UI.entry) UI.entry = { step: 'login' };
  var s = UI.entry.step;
  if (s === 'checking') return '<div class="login-screen" aria-busy="true"></div>'; /* start-up: asking the server whether this browser is signed in */
  if (s === 'choose-password') return renderChoosePassword();
  if (s === 'setup') return renderSetupScreen();
  if (s === 'admin-login') return renderAdminLogin();
  if (s === 'admin') return isAppAdmin ? renderAdminConsole() : renderAdminLogin();
  return renderLoginScreen();
}
function renderLoginScreen() {
  return '<div class="login-screen"><div class="login-card">'
    + '<div class="login-eyebrow">Executive Readiness</div>'
    + '<h1 class="login-title">Sign <em>in</em></h1>'
    + '<p class="login-sub">Enter your username and password to open your organization\'s workspace.</p>'
    + '<input id="loginUser" class="entry-text-input" type="text" autocomplete="username" placeholder="Username" value="' + esc(UI.entry.user || '') + '" onkeydown="loginKey(event)"/>'
    + '<input id="loginPassword" class="entry-text-input" type="password" autocomplete="current-password" placeholder="Password" onkeydown="loginKey(event)"/>'
    + (UI.entry.err ? '<div class="entry-err">' + esc(UI.entry.err) + '</div>' : '')
    + '<label class="entry-remember"><input type="checkbox" id="loginRemember"' + (UI.entry.remember ? ' checked' : '') + ' onchange="UI.entry.remember=this.checked"/> <span>Remember me on this device</span></label>'
    + '<button class="btn-gold login-btn" onclick="doLogin()">Sign In \u2192</button>'
    + '<div class="entry-foot"><button class="entry-foot-btn" onclick="gotoSetup()">Set up a new organization</button><button class="entry-foot-btn" onclick="gotoAdminLogin()">Admin</button></div>'
    + '</div></div>';
}
function renderSetupScreen() {
  var first = getOrgs().length === 0, k = UI.entry.keep || {};
  return '<div class="login-screen"><div class="login-card">'
    + (first ? '' : '<button class="entry-back" onclick="gotoLogin()">\u2190 Back to sign in</button>')
    + '<div class="login-eyebrow">Executive Readiness</div>'
    + '<h1 class="login-title">Set up your <em>organization</em></h1>'
    + '<p class="login-sub">Create your workspace and your account. You can add the rest of your team next.</p>'
    + (UI.entry.err ? '<div class="entry-err" style="margin-bottom:14px">' + esc(UI.entry.err) + '</div>' : '')
    + '<label class="entry-flabel" for="setupCode">Setup code</label>'
    + '<input id="setupCode" class="entry-text-input" type="text" autocomplete="off" placeholder="The code you were given" value="' + esc(k.code || '') + '"/>'
    + '<label class="entry-flabel" for="setupOrg">Organization name</label>'
    + '<input id="setupOrg" class="entry-text-input" type="text" autocomplete="off" placeholder="e.g. Acme Manufacturing" value="' + esc(k.org || '') + '"/>'
    + '<label class="entry-flabel" for="setupName">Your name</label>'
    + '<input id="setupName" class="entry-text-input" type="text" autocomplete="name" placeholder="e.g. Maria Torres" value="' + esc(k.name || '') + '"/>'
    + '<label class="entry-flabel" for="setupUser">Username</label>'
    + '<input id="setupUser" class="entry-text-input" type="text" autocomplete="username" placeholder="e.g. maria" value="' + esc(k.user || '') + '"/>'
    + '<label class="entry-flabel" for="setupEmail">Email</label>'
    + '<input id="setupEmail" class="entry-text-input" type="email" autocomplete="email" placeholder="e.g. maria@acme.com" value="' + esc(k.email || '') + '"/>'
    + '<label class="entry-flabel" for="setupPassword">Password</label>'
    + '<input id="setupPassword" class="entry-text-input" type="password" autocomplete="new-password"/>'
    + pwRuleHtml()
    + '<label class="entry-flabel" for="setupConfirm">Confirm new password</label>'
    + '<input id="setupConfirm" class="entry-text-input" type="password" autocomplete="new-password"/>'
    + '<label class="entry-remember"><input type="checkbox" id="setupRemember"' + (k.remember ? ' checked' : '') + '/> <span>Remember me on this device</span></label>'
    + '<button class="btn-gold login-btn" onclick="doSetup()">Create &amp; Continue \u2192</button>'
    + '</div></div>';
}
function renderAdminLogin() {
  return '<div class="login-screen"><div class="login-card entry-pass-card">'
    + '<button class="entry-back" onclick="gotoLogin()">\u2190 Back to sign in</button>'
    + '<div class="login-eyebrow">Administrator</div>'
    + '<h1 class="login-title">Admin <em>sign in</em></h1>'
    + '<p class="login-sub">Enter the administrator username and password to view all organizations and users.</p>'
    + '<input id="adminUser" class="entry-text-input" type="text" autocomplete="username" placeholder="Username" value="' + esc(UI.entry.user || '') + '" onkeydown="adminKey(event)"/>'
    + '<input id="adminPassword" class="entry-text-input" type="password" autocomplete="current-password" placeholder="Password" onkeydown="adminKey(event)"/>'
    + (UI.entry.err ? '<div class="entry-err">' + esc(UI.entry.err) + '</div>' : '')
    + '<button class="btn-gold login-btn" onclick="doAdminLogin()">Enter \u2192</button>'
    + '</div></div>';
}
function renderChoosePassword() {
  var e = UI.entry;
  return '<div class="login-screen"><div class="login-card">'
    + '<button class="entry-back" onclick="leaveChoosePassword()">\u2190 Back to sign in</button>'
    + '<div class="login-eyebrow">' + (e.kind === 'admin' ? 'Administrator' : 'Executive Readiness') + '</div>'
    + '<h1 class="login-title">Choose a new password</h1>'
    + '<p class="login-sub">' + esc(e.sub || '') + '</p>'
    + '<label class="entry-flabel" for="newPassword">New password</label>'
    + '<input id="newPassword" class="entry-text-input" type="password" autocomplete="new-password" onkeydown="choosePasswordKey(event)"/>'
    + pwRuleHtml()
    + '<label class="entry-flabel" for="confirmPassword">Confirm new password</label>'
    + '<input id="confirmPassword" class="entry-text-input" type="password" autocomplete="new-password" onkeydown="choosePasswordKey(event)"/>'
    + (e.err ? '<div class="entry-err">' + esc(e.err) + '</div>' : '')
    + '<button class="btn-gold login-btn" onclick="doChoosePassword()">Save password</button>'
    + '</div></div>';
}
function renderAdminConsole() {
  var orgs = getOrgs();
  var totalUsers = 0; orgs.forEach(function (o) { totalUsers += orgRosterPreview(o.id).length; });
  var h = '<div class="login-screen admin-screen"><div class="admin-console">'
    + '<div class="admin-console-head"><div><div class="login-eyebrow">Administrator</div><h1 class="login-title" style="margin:6px 0 0">All <em>organizations</em></h1></div>'
    + '<div class="admin-console-actions"><button class="org-btn-cancel" onclick="adminConsoleNewOrg()">+ New Organization</button><button class="entry-link" onclick="openChangePassword()">Change password</button><button class="entry-link" onclick="openChangeUsername()">Change username</button><button class="entry-link" onclick="exitAdmin()">Exit admin</button></div></div>'
    + '<p class="login-sub" style="margin-bottom:18px">' + orgs.length + ' organization' + (orgs.length === 1 ? '' : 's') + ' \xb7 ' + totalUsers + ' user' + (totalUsers === 1 ? '' : 's') + ' total. Each workspace is fully isolated.</p>'
    + '<div class="admin-console-list">';
  if (!orgs.length) { h += '<div class="entry-empty">No organizations yet.</div>'; }
  orgs.forEach(function (o) {
    var roster = orgRosterPreview(o.id);
    h += '<div class="admin-cardx"><div class="admin-cardx-head"><div class="entry-org-badge">' + esc((o.name || '?').slice(0, 1).toUpperCase()) + '</div>'
      + '<div class="admin-cardx-meta"><div class="admin-org-name">' + esc(o.name) + '</div>'
      + '<div class="admin-org-sub">' + roster.length + ' user' + (roster.length === 1 ? '' : 's') + ' \xb7 created ' + fmtDate(o.created) + '</div></div>'
      + '<div class="admin-org-actions"><button class="org-btn-cancel" onclick="adminConsoleOpen(\'' + o.id + '\')">Open</button>'
      + '<button class="org-btn-cancel" onclick="adminConsoleReset(\'' + o.id + '\')">Reset data</button>'
      + '<button class="org-btn-del" onclick="adminConsoleDelete(\'' + o.id + '\')">Delete</button></div></div>';
    if (roster.length) { h += '<div class="admin-users">'; roster.forEach(function (u) { h += '<div class="admin-user-row">' + userAv(u, 26) + '<span class="admin-user-name">' + esc(u.name || 'Unnamed') + '</span><span class="admin-user-uname">@' + esc(u.username || '\u2014') + '</span><span class="admin-user-role">' + esc(u.role || '') + '</span></div>'; }); h += '</div>'; }
    h += '</div>';
  });
  h += '</div></div></div>';
  return h;
}

/* ── In-app modals: Profile/Team + Admin ── */
function closeModal() { currentModal = null; var mr = $('modalRoot'); if (mr) mr.innerHTML = ''; }
function openOrg() { orgSetupMode = false; currentModal = 'org'; UI.orgEdit = null; renderOrgModal(); }
function openOrgSetup() { orgSetupMode = true; currentModal = 'org'; UI.orgEdit = null; renderOrgModal(); }
function openAdmin() { if (!isAppAdmin) { return; } currentModal = 'admin'; renderAdminModal(); }

/* ── The Admin panel's new organization (5.7.4): a first person with a temporary password ── */
function adminAddOrg() { if (!isAppAdmin) return; UI.adminNewOrg = { err: '' }; renderAdminModal(); }
function adminNewOrgFormHtml() {
  var s = UI.adminNewOrg || {}, k = s.keep || {};
  function f(label, id, val, ac) { return '<div><label class="org-flabel" for="' + id + '">' + label + '</label><input id="' + id + '" class="field-input" type="text" value="' + esc(val || '') + '" autocomplete="' + (ac || 'off') + '"/></div>'; }
  var h = '<div class="org-card editing admin-user-editor admin-new-org">';
  h += '<div class="org-edit-grid">' + f('Organization name', 'ano_org', k.org) + f('Name', 'ano_name', k.name) + f('Username', 'ano_user', k.user) + tempPasswordFieldHtml('ano_temp') + '</div>';
  if (s.err) h += '<div class="entry-err">' + esc(s.err) + '</div>';
  h += '<div class="org-edit-actions"><button class="org-btn-save" onclick="adminSaveNewOrg()">Save</button><button class="org-btn-cancel" onclick="UI.adminNewOrg=null;renderAdminModal()">Cancel</button></div>';
  return h + '</div>';
}
function adminSaveNewOrg() {
  if (!isAppAdmin) return;
  var s = UI.adminNewOrg || {}; function v(id) { var el = $(id); return el ? el.value : ''; }
  var orgName = v('ano_org').trim(), name = v('ano_name').trim(), username = v('ano_user').trim(), temp = v('ano_temp');
  var tEl = $('ano_temp'); if (tEl) tEl.value = '';
  s.keep = { org: orgName, name: name, user: username }; UI.adminNewOrg = s;
  function fail(m) { s.err = m; renderAdminModal(); }
  if (!orgName || !name || !username) return fail('Please complete all fields to continue.');
  if (usernameTaken(username)) return fail('That username is already taken. Choose another.');
  var prob = passwordProblem(temp); if (prob) return fail(prob);
  var keep = currentOrgId;
  var res = createOrg(orgName, { name: name, username: username, role: 'Administrator' }, true);   /* the session is kept (S.4) */
  setCurrentOrg(keep); if (keep) { loadData(); applyTeamRoster(); } else { data = emptyData(); USERS.length = 0; }
  Auth.setTemporaryPassword(res.orgId, res.userId, temp, function (r) {
    if (r && r.ok) { UI.adminNewOrg = null; if (UI.entry && UI.entry.step === 'admin') render(); renderAdminModal(); return; }
    deleteOrgById(res.orgId); fail(authRefusal(r, temp));   /* no organization is left without its first person's password */
  });
}
function adminRenameOrg(id) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ var o = getOrg(id); if (!o) return; var nm = prompt('Organization name:', o.name); if (nm === null) return; nm = (nm || '').trim(); if (!nm) return; saveOrgs(getOrgs().map(function (x) { return x.id === id ? Object.assign({}, x, { name: nm }) : x; })); var d = getOrgData(id); d.enterprise = d.enterprise || {}; d.enterprise.name = nm; saveOrgData(id, d); renderAdminModal(); }
function adminOpenOrg(id) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  try { Store.setRemember(null); } catch (e) { }
  var _pOrg = currentOrgId, _pUser = currentUserId;
  switchToOrg(id); Auth.setSession((USERS[0] && USERS[0].id) || null);
  if (!currentUserId) { adminOpenGuard(_pOrg, _pUser, renderAdminModal); return; }
  UI.adminUserEdit = null; closeModal(); render();
}
function adminDeleteOrg(id) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var o = getOrg(id); if (!o) return; if (id === currentOrgId) { alert("You can't delete the organization you're currently in. Switch to another organization first."); return; } // ruled July 9 (donor), adopted per revisit item 6
  if (getOrgs().length <= 1) { alert('You must keep at least one organization.'); return; } if (!confirm('Delete "' + o.name + '" and all of its data? This cannot be undone.')) return; var wasCurrent = (id === currentOrgId); deleteOrgById(id); if (wasCurrent) { var others = getOrgs(); if (others.length) { switchToOrg(others[0].id); Auth.setSession((USERS[0] && USERS[0].id) || null); } } renderAdminModal();
}
function adminEditUser(orgId, userId) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ UI.adminUserEdit = { orgId: orgId, userId: userId }; renderAdminModal(); }
function adminAddUser(orgId) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ UI.adminUserEdit = { orgId: orgId, userId: 'new' }; renderAdminModal(); }
function adminCancelUser() { UI.adminUserEdit = null; renderAdminModal(); }
function adminSaveUser(orgId, userId) {
  if (!isAppAdmin) return;   /* the app administrator's person editor (5.10) */
  var d = getOrgData(orgId); d.roster = d.roster || [];
  var fields = ['name', 'username', 'role', 'scope', 'email', 'dept'];
  var v = {}; fields.forEach(function (f) { var el = $('au_' + f); if (el) v[f] = el.value.trim(); });
  var _r6 = (d.roster || []).filter(function (x) { return x.id === userId })[0]; if (userId !== 'new' && v.username && _r6 && !sameUsername(v.username, _r6.username) && usernameServerCheck(v.username, orgId, userId, function () { adminSaveUser(orgId, userId); }, function (m) { var e6 = UI.adminUserEdit || { orgId: orgId, userId: userId }; e6.draft = v; e6.err = m; UI.adminUserEdit = e6; renderAdminModal(); })) return; /* Sweep 4R item 6 */
  var tEl = $('au_temporary'), temp = tEl ? tEl.value : ''; if (tEl) tEl.value = '';
  var ed = UI.adminUserEdit || { orgId: orgId, userId: userId }; ed.draft = v; UI.adminUserEdit = ed;
  var aEl = $('au_admin'), wantAdmin = aEl ? aEl.checked === true : null; if (wantAdmin !== null) v.admin = wantAdmin; /* Sweep 4R item 2 */
  if (userId !== 'new' && wantAdmin === false) { var _r0 = (d.roster || []).filter(function (x) { return x.id === userId })[0]; if (_r0 && _r0.admin === true && adminCountIn(d.roster) <= 1) { alert(LAST_ADMIN_MSG); v.admin = true; renderAdminModal(); return; } }
  function fail(m) { ed.err = m; renderAdminModal(); }
  var isNew = (userId === 'new');
  if (isNew && (!v.name || !v.username)) return fail('Please complete all fields to continue.');
  if (v.username && usernameTaken(v.username, orgId, isNew ? null : userId)) return fail('That username is already taken. Choose another.');
  if (isNew || temp) { var prob = passwordProblem(temp); if (prob) return fail(prob); }   /* 5.7.2: required when adding; empty keeps the password when editing */
  var id = isNew ? uid() : userId;
  if (isNew) { d.roster.push({ id: id, name: v.name || '', username: v.username || '', role: v.role || '', scope: v.scope || '', email: v.email || '', dept: v.dept || '', initials: orgInitials(v.name || '') || '?', color: ORG_PALETTE[d.roster.length % ORG_PALETTE.length] }); }
  else { var u = d.roster.filter(function (x) { return x.id === userId; })[0]; if (!u) return; fields.forEach(function (f) { u[f] = v[f]; }); u.initials = orgInitials(u.name || '') || u.initials; }
  if (wantAdmin !== null) { var _t = (d.roster || []).filter(function (x) { return x.id === id })[0]; if (_t) _t.admin = wantAdmin; } /* Sweep 4R item 2 */
  saveOrgData(orgId, d);
  if (!temp) { UI.adminUserEdit = null; renderAdminModal(); return; }
  Auth.setTemporaryPassword(orgId, id, temp, function (res) {
    if (res && res.ok) { UI.adminUserEdit = null; renderAdminModal(); return; }
    if (isNew) { var d2 = getOrgData(orgId); d2.roster = (d2.roster || []).filter(function (x) { return x.id !== id; }); saveOrgData(orgId, d2); }   /* nobody is added without a password */
    fail(authRefusal(res, temp));
  });
}
function adminDeleteUser(orgId, userId) { if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var _dr = (getOrgData(orgId).roster || []), _du = _dr.filter(function (x) { return x.id === userId })[0]; if (_du && _du.admin === true && adminCountIn(_dr) <= 1) { alert(LAST_ADMIN_MSG); return; } /* Sweep 4R item 2 (A.5.30) */
  if (orgId === currentOrgId && userId === currentUserId) { alert("You're signed in as this profile, so it can't be deleted here."); return; }
  var d = getOrgData(orgId); var u = (d.roster || []).filter(function (x) { return x.id === userId; })[0];
  if (!confirm('Delete ' + ((u && u.name) || 'this user') + '?')) return;
  d.roster = (d.roster || []).filter(function (x) { return x.id !== userId; });
  saveOrgData(orgId, d); UI.adminUserEdit = null; renderAdminModal();
}
function adminUserEditorHtml(orgId, u) {
  u = u || {};
  var _ed = UI.adminUserEdit || {}; if (_ed.draft) u = Object.assign({}, u, _ed.draft);
  function f(label, key, ph, type) { return '<div><label class="org-flabel">' + label + '</label><input id="au_' + key + '" class="field-input" type="' + (type || 'text') + '" value="' + esc(u[key] || '') + '" placeholder="' + esc(ph) + '" autocomplete="off"/></div>'; }
  var isNew = !u.id;
  var h = '<div class="org-card editing admin-user-editor">';
  h += '<div class="org-card-head">' + userAv(isNew ? { initials: '?', color: '#8A7B72' } : u, 36) + '<div class="org-card-headtxt">' + (isNew ? 'New user' : 'Editing user') + '</div></div>';
  h += '<div class="org-edit-grid">' + f('Name', 'name', 'Full name') + f('Username', 'username', 'e.g. maria') + f('Role / title', 'role', 'e.g. Program Lead') + f('Scope / focus', 'scope', 'e.g. Operations') + f('Email', 'email', 'name@company.com', 'email') + f('Department', 'dept', 'e.g. Strategy') + tempPasswordFieldHtml('au_temporary') + adminTickHtml('au_admin', u.admin === true) /* Sweep 4R item 2 (A.5.29) */ + '</div>';
  if (_ed.err) h += '<div class="entry-err">' + esc(_ed.err) + '</div>';
  h += '<div class="org-edit-actions"><button class="org-btn-save" onclick="adminSaveUser(\'' + orgId + '\',\'' + (u.id || 'new') + '\')">Save</button><button class="org-btn-cancel" onclick="adminCancelUser()">Cancel</button>' + (!isNew ? '<button class="org-btn-del" onclick="adminDeleteUser(\'' + orgId + '\',\'' + u.id + '\')">Delete</button>' : '') + '</div></div>';
  return h;
}
function renderAdminModal() {
  var mr = $('modalRoot'); if (!mr) return;
  if (currentModal !== 'admin') { mr.innerHTML = ''; return; }
  var orgs = getOrgs();
  var totalUsers = 0; orgs.forEach(function (o) { totalUsers += orgRosterPreview(o.id).length; });
  var ed = UI.adminUserEdit || null;
  var h = '<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal">';
  h += '<h3>Admin</h3>';
  h += '<div class="admin-acct-actions"><button class="entry-link" onclick="openChangePassword()">Change password</button><button class="entry-link" onclick="openChangeUsername()">Change username</button></div>';
  if (UI.adminNewOrg) h += adminNewOrgFormHtml();
  h += '<div style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:16px">All registered organizations and their users. ' + orgs.length + ' organization' + (orgs.length === 1 ? '' : 's') + ' \xb7 ' + totalUsers + ' user' + (totalUsers === 1 ? '' : 's') + '. Each workspace is fully isolated.</div>';
  h += '<div class="admin-mgr-list">';
  orgs.forEach(function (o) {
    var cur = (o.id === currentOrgId);
    var roster = orgRosterPreview(o.id);
    h += '<div class="admin-mgr-org' + (cur ? ' admin-org-current' : '') + '">';
    h += '<div class="admin-mgr-orghead"><div class="entry-org-badge">' + esc((o.name || '?').slice(0, 1).toUpperCase()) + '</div>';
    h += '<div class="admin-mgr-orgmeta"><div class="admin-org-name">' + esc(o.name) + (cur ? ' <span class="org-you">Current</span>' : '') + '</div>';
    h += '<div class="admin-org-sub">' + roster.length + ' user' + (roster.length === 1 ? '' : 's') + ' \xb7 created ' + fmtDate(o.created) + '</div></div>';
    h += '<div class="admin-mgr-orgactions"><button class="org-row-btn" title="Rename organization" onclick="adminRenameOrg(\'' + o.id + '\')">\u270E</button>';
    if (!cur) h += '<button class="org-btn-cancel admin-mini-btn" onclick="adminOpenOrg(\'' + o.id + '\')">Open</button>';
    h += '<button class="org-btn-cancel admin-mini-btn" onclick="adminResetOrg(\'' + o.id + '\')">Reset data</button>';
    h += '<button class="org-row-btn org-row-del" title="Delete organization" onclick="adminDeleteOrg(\'' + o.id + '\')">\xd7</button></div></div>';
    h += '<div class="admin-mgr-users">';
    roster.forEach(function (u) {
      if (ed && ed.orgId === o.id && ed.userId === u.id) { h += adminUserEditorHtml(o.id, u); return; }
      h += '<div class="admin-mgr-userrow">' + userAv(u, 28) + '<div class="admin-mgr-uinfo" title="' + esc(u.name || 'Unnamed') + '"><span class="admin-user-name">' + esc(u.name || 'Unnamed') + '</span> <span class="admin-user-uname">@' + esc(u.username || '\u2014') + '</span></div><span class="admin-user-role">' + esc(u.role || '') + '</span><button class="org-row-btn" title="Edit user" onclick="adminEditUser(\'' + o.id + '\',\'' + u.id + '\')">\u270E</button></div>';
    });
    if (ed && ed.orgId === o.id && ed.userId === 'new') { h += adminUserEditorHtml(o.id, {}); }
    else { h += '<button class="admin-adduser" onclick="adminAddUser(\'' + o.id + '\')">+ Add user</button>'; }
    h += '</div></div>';
  });
  h += '</div>';
  h += '<div style="display:flex;gap:10px;margin-top:18px;justify-content:space-between"><button class="org-btn-cancel" onclick="adminAddOrg()">+ New Organization</button><button class="btn-gold" onclick="closeModal()">Done</button></div>';
  h += '</div></div>';
  mr.innerHTML = h;
}

var __orgEditUI = null;
function scrollEditorIntoView(focus) { setTimeout(function () { var el = document.querySelector('.org-card.editing'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (focus) { var f = el.querySelector('input'); if (f) f.focus(); } } }, 60); }
function editProfile(id) { if (!(canManagePeople() || id === currentUserId)) return; UI.orgEdit = id; UI.orgDraft = null; UI.orgErr = ''; renderOrgModal(); scrollEditorIntoView(false); }
function cancelEditProfile() { UI.orgEdit = null; UI.orgDraft = null; UI.orgErr = ''; renderOrgModal(); }
/* 5.10: administrators manage the people; every member edits their own profile (their password: Change password). 5.7: a temporary password when adding. */
function saveProfile(id) {
  if (lockBlocked('roster')) return;
  var isNew = (id === 'new'), isMe = (id === currentUserId);
  if (!(canManagePeople() || isMe)) return;
  var v = {}; ['name', 'username', 'role', 'scope', 'email', 'dept'].forEach(function (f) { var el = $('ru_' + id + '_' + f); if (el) v[f] = el.value.trim(); });
  var _r6 = USERS.find(function (x) { return x.id === id }); if (!isNew && v.username && _r6 && !sameUsername(v.username, _r6.username) && usernameServerCheck(v.username, currentOrgId, id, function () { saveProfile(id); }, function (m) { UI.orgDraft = v; UI.orgErr = m; renderOrgModal(); })) return; /* Sweep 4R item 6 */
  var tEl = $('ru_' + id + '_temporary'), temp = (tEl && !isMe) ? tEl.value : ''; if (tEl) tEl.value = '';
  UI.orgDraft = v;
  var aEl = $('ru_' + id + '_admin'), wantAdmin = (aEl && canManagePeople()) ? aEl.checked === true : null; /* Sweep 4R item 2 */
  if (wantAdmin !== null) v.admin = wantAdmin;
  if (!isNew && wantAdmin === false) { var _was = USERS.find(function (x) { return x.id === id }); if (_was && _was.admin === true && adminCountIn(USERS) <= 1) { alert(LAST_ADMIN_MSG); v.admin = true; renderOrgModal(); return; } }
  function fail(m) { UI.orgErr = m; renderOrgModal(); }
  if (isNew && (!v.name || !v.username)) return fail('Please complete all fields to continue.');
  if (v.username && usernameTaken(v.username, currentOrgId, isNew ? null : id)) return fail('That username is already taken. Choose another.');
  if (isNew || temp) { var prob = passwordProblem(temp); if (prob) return fail(prob); }
  var u;
  if (isNew) { u = { id: uid(), name: '', username: '', role: '', scope: '', email: '', dept: '', initials: '?', color: ORG_PALETTE[USERS.length % ORG_PALETTE.length] }; USERS.push(u); }
  else { u = USERS.find(function (x) { return x.id === id }); if (!u) return; }
  Object.keys(v).forEach(function (f) { u[f] = v[f]; });
  if (u.name) u.initials = orgInitials(u.name);
  persistRoster();
  function done() { UI.orgEdit = null; UI.orgDraft = null; UI.orgErr = ''; render(); renderOrgModal(); }
  if (!temp) return done();
  Auth.setTemporaryPassword(currentOrgId, u.id, temp, function (res) {
    if (res && res.ok) return done();
    if (isNew) { var i = USERS.indexOf(u); if (i >= 0) USERS.splice(i, 1); persistRoster(); }   /* nobody is added without a password */
    UI.orgErr = authRefusal(res, temp); render(); renderOrgModal();
  });
}
function addProfile() {
  if (lockBlocked('roster')) return;
  if (!canManagePeople()) return;
  UI.orgEdit = 'new'; UI.orgDraft = null; UI.orgErr = '';   /* a draft: nothing is saved until it has a temporary password */
  renderOrgModal(); scrollEditorIntoView(true);
}
function removeProfile(id) {
  if (lockBlocked('roster')) return;
  if (id === 'new') { cancelEditProfile(); return; }
  if (!canManagePeople()) return;   /* 5.10 */
  var _ru = USERS.find(function (x) { return x.id === id }); if (_ru && _ru.admin === true && adminCountIn(USERS) <= 1) { alert(LAST_ADMIN_MSG); return; } /* Sweep 4R item 2 (A.5.30) */
  if (id === currentUserId) { alert("You're signed in as this profile, so it can't be deleted here. Switch to another user first, then delete it."); return; }
  var u = USERS.find(function (x) { return x.id === id }); var label = (u && u.name) ? (' \u2014 ' + u.name) : '';
  if (!confirm('Delete this team member' + label + '? They will also be removed from sign-in and task assignments.')) return;
  var i = USERS.findIndex(function (x) { return x.id === id }); if (i >= 0) USERS.splice(i, 1);
  if (UI.orgEdit === id) UI.orgEdit = null; persistRoster(); render(); renderOrgModal();
}
function saveEnterprise() { if (!canManagePeople()) return; /* Sweep 4R item 3: only administrators edit the organization's details */ if (lockBlocked('enterprise')) return; if (!data.enterprise) data.enterprise = {};['name', 'industry', 'size', 'region', 'website', 'maturity', 'sponsor', 'objective'].forEach(function (f) { var el = $('ent_' + f); if (el) data.enterprise[f] = el.value; }); saveData(); }
function finishOrgSetup() { saveEnterprise(); var nm = (data.enterprise && data.enterprise.name || '').trim(); if (!nm) { var el = $('ent_name'); if (el) el.focus(); alert('Please enter your organization name to continue.'); return; } data.orgSetup = true; saveData(); orgSetupMode = false; closeModal(); render(); }
function renderOrgModal() {
  var mr = $('modalRoot'); if (!mr) return;
  if (currentModal !== 'org') { mr.innerHTML = ''; return; }
  var e = data.enterprise || {};
  var sizeOpts = [['', 'Select size\u2026'], ['1\u201350', '1\u201350'], ['51\u2013200', '51\u2013200'], ['201\u20131,000', '201\u20131,000'], ['1,001\u20135,000', '1,001\u20135,000'], ['5,000+', '5,000+']];
  var matOpts = [['', 'Select stage\u2026'], ['Exploring', 'Exploring'], ['Piloting', 'Piloting'], ['Scaling', 'Scaling'], ['Operating', 'Operating']];
  var _entDis = canManagePeople() ? '' : ' disabled'; /* Sweep 4R item 3: everyone else sees the details, read-only */
  function einp(id, v, ph, type) { return '<input id="' + id + '" class="field-input" type="' + (type || 'text') + '" value="' + esc(v || '') + '" placeholder="' + esc(ph) + '" onchange="saveEnterprise()"'+_entDis+'/>'; }
  function esel(id, v, opts) { var s = '<select id="' + id + '" class="field-sel" onchange="saveEnterprise()"'+_entDis+'>'; opts.forEach(function (o) { s += '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }); return s + '</select>'; }
  function fl(label, ctrl) { return '<div><label class="form-label">' + esc(label) + '</label>' + ctrl + '</div>'; }
  var h = '<div class="modal-bg"' + (orgSetupMode ? '' : ' onclick="if(event.target===this)closeModal()"') + '><div class="modal">';
  if (orgSetupMode) { h += '<div class="org-setup-eyebrow">Welcome \u2014 let\u2019s get set up</div><h3>Set Up Your Organization &amp; Team</h3><div style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:16px">Before you start, tell us about your organization and confirm who\u2019s on the team. You can change any of this later from the <strong style="color:var(--paper)">Profile</strong> menu item. An organization name is required to continue.</div>'; }
  else { h += '<h3>Organization &amp; Team</h3><div style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:16px">Capture the enterprise context and the people driving the 90-day program.</div>'; if (canSetAiFeatures()) h += aiFeaturesFold(); }
  h += '<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Team Members <span style="color:var(--stone)">\xb7 ' + USERS.length + '</span></div>';
  h += '<p style="color:var(--stone);margin-bottom:14px;font-size:13px">These people appear in sign-in, task assignments, and team chat.</p>';
  h += '<div class="org-list">';
  (UI.orgEdit === 'new' ? USERS.concat([{ id: 'new', name: '', username: '', initials: '?', color: '#8A7B72' }]) : USERS).forEach(function (u0) {
    var u = (UI.orgEdit === u0.id && UI.orgDraft) ? Object.assign({}, u0, UI.orgDraft) : u0;
    var isMe = (u.id === currentUserId);
    if (UI.orgEdit === u.id) {
      h += '<div class="org-card editing"><div class="org-card-head">' + userAv(u, 40) + '<div class="org-card-headtxt">Editing profile</div></div><div class="org-edit-grid">';
      h += '<div><label class="org-flabel">Name</label><input id="ru_' + u.id + '_name" class="field-input" value="' + esc(u.name || '') + '" placeholder="Full name"/></div>';
      h += '<div><label class="org-flabel">Username</label><input id="ru_' + u.id + '_username" class="field-input" value="' + esc(u.username || '') + '" placeholder="e.g. maria" autocomplete="off"/></div>';
      h += '<div><label class="org-flabel">Role / title</label><input id="ru_' + u.id + '_role" class="field-input" value="' + esc(u.role || '') + '" placeholder="e.g. Program Lead"/></div>';
      h += '<div><label class="org-flabel">Scope / focus</label><input id="ru_' + u.id + '_scope" class="field-input" value="' + esc(u.scope || '') + '" placeholder="e.g. Operations"/></div>';
      h += '<div><label class="org-flabel">Email</label><input id="ru_' + u.id + '_email" class="field-input" type="email" value="' + esc(u.email || '') + '" placeholder="name@company.com"/></div>';
      h += '<div><label class="org-flabel">Department</label><input id="ru_' + u.id + '_dept" class="field-input" value="' + esc(u.dept || '') + '" placeholder="e.g. Strategy"/></div>';
      if (!isMe && canManagePeople()) h += tempPasswordFieldHtml('ru_' + u.id + '_temporary');
      if (canManagePeople()) h += adminTickHtml('ru_' + u.id + '_admin', u.admin === true); /* Sweep 4R item 2 (A.5.29): administrators only; new members too */
      h += '</div>';
      if (UI.orgErr) h += '<div class="entry-err">' + esc(UI.orgErr) + '</div>';
      h += '<div class="org-edit-actions"><button class="org-btn-save" onclick="saveProfile(\'' + u.id + '\')">Save</button><button class="org-btn-cancel" onclick="cancelEditProfile()">Cancel</button>' + (canManagePeople() ? '<button class="org-btn-del" onclick="removeProfile(\'' + u.id + '\')"' + (isMe ? ' disabled title="Signed-in profile \u2014 switch users to delete"' : '') + '>Delete</button>' : '') + '</div></div>';
    } else {
      var meta = [esc(u.role || ''), (u.scope && u.scope !== 'All') ? esc(u.scope) : ''].filter(Boolean).join(' \xb7 ');
      var sub = [esc(u.email || ''), esc(u.dept || '')].filter(Boolean).join(' \xb7 ');
      h += '<div class="org-row">' + userAv(u, 38) + '<div class="org-row-main"><div class="org-row-name" title="' + esc(u.name || 'Unnamed') + '">' + (esc(u.name) || '<span class="org-unnamed">Unnamed</span>') + (isMe ? ' <span class="org-you">You</span>' : '') + '</div>';
      if (meta) h += '<div class="org-row-meta">' + meta + '</div>';
      if (sub) h += '<div class="org-row-sub">' + sub + '</div>';
      h += '</div><div class="org-row-actions">' + ((canManagePeople() || isMe) ? '<button class="org-row-btn" title="Edit profile" aria-label="Edit" onclick="editProfile(\'' + u.id + '\')">\u270E</button>' : '') + (canManagePeople() ? '<button class="org-row-btn org-row-del" title="' + (isMe ? 'Signed-in profile \u2014 switch users to delete' : 'Delete profile') + '" aria-label="Delete" onclick="removeProfile(\'' + u.id + '\')"' + (isMe ? ' disabled' : '') + '>\xd7</button>' : '') + '</div></div>';
    }
  });
  h += '</div>' + (canManagePeople() ? btn('+ Add team member', 'addProfile()', 'bs') : '') + '</div>';
  h += '<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Organization Details</div>'+(_entDis ? '<p class="ent-ro-note">Only administrators can change the organization\u2019s details.</p>' : '')+'<div class="org-grid">';
  h += fl('Organization name' + (orgSetupMode ? ' *' : ''), einp('ent_name', e.name, 'e.g. Acme Manufacturing'));
  h += fl('Industry', einp('ent_industry', e.industry, 'e.g. Industrial / Pharma'));
  h += fl('Company size', esel('ent_size', e.size, sizeOpts));
  h += fl('Region / HQ', einp('ent_region', e.region, 'e.g. Boston, USA'));
  h += fl('Website', einp('ent_website', e.website, 'e.g. acme.com'));
  h += fl('AI maturity', esel('ent_maturity', e.maturity, matOpts));
  h += fl('Executive sponsor', einp('ent_sponsor', e.sponsor, 'e.g. CEO / CFO name'));
  h += '</div><div style="margin-top:14px">' + fl('Primary objective', '<textarea id="ent_objective" class="field-ta" rows="2" placeholder="What is the enterprise aiming to achieve with AI in the next 90 days?" onchange="saveEnterprise()"'+_entDis+'>' + esc(e.objective || '') + '</textarea>') + '</div></div>';
  h += '<div style="display:flex;justify-content:flex-end;margin-top:18px">' + (orgSetupMode ? '<button class="btn-gold" onclick="finishOrgSetup()">Get Started</button>' : '<button class="btn-gold" onclick="closeModal()">Done</button>') + '</div>';
  h += '</div></div>';
  mr.innerHTML = h;
}
/* ════════════ END MULTI-ORG / AUTH ════════════ */

/* ═══ PHASES ═══ */
var PH = [
  { id: 1, name: 'Assess', days: 'Days 1\u201325', color: '#1B6B5A', steps: [{ id: '1.1', name: 'Assessment Battery', icon: '\u25A3' }, { id: '1.2', name: 'Leadership Landscape', icon: '\u25C7' }, { id: '1.3', name: 'Risk Mapping', icon: '\u25CE' }, { id: '1.4', name: 'Mindset Foundations', icon: '\u25C8' }], outcomes: [{ id: 'out-readiness', name: 'Readiness Report' }, { id: 'out-inventory', name: 'Leadership Inventory' }, { id: 'out-riskmap', name: 'Risk Map' }], ldev: [] },
  { id: 2, name: 'Build', days: 'Days 26\u201350', color: '#2D5A8E', steps: [{ id: '2.1', name: 'Leadership Structure Lab', icon: '\u229E' }, { id: '2.2', name: 'AI Collaboration Lab', icon: '\u229C' }, { id: '2.3', name: 'Competency Framework', icon: '\u21BB' }, { id: '2.4', name: 'Mindset Depth', icon: '\u2299' }], outcomes: [{ id: 'out-structure', name: 'Leadership Structure' }, { id: 'out-collab', name: 'Collaboration Principles' }, { id: 'out-competency', name: 'Competency Framework' }], ldev: [] },
  { id: 3, name: 'Develop', days: 'Days 51\u201375', color: '#8B5E3C', steps: [{ id: '3.1', name: 'AI Fluency Sprint', icon: '\u25B7' }, { id: '3.2', name: 'Decision Simulations', icon: '\u229F' }, { id: '3.3', name: 'Middle Management', icon: '\u2297' }, { id: '3.4', name: 'Values Architecture', icon: '\u2299' }, { id: '3.5', name: 'Mindset Application', icon: '\u2197' }], outcomes: [{ id: 'out-fluency', name: 'Fluency Assessment' }, { id: 'out-decisions', name: 'Decision Analyses' }, { id: 'out-mmprinciples', name: 'MM Principles' }, { id: 'out-values', name: 'Values Architecture' }], ldev: [] },
  { id: 4, name: 'Embed', days: 'Days 76\u201390', color: '#9B2D3F', steps: [{ id: '4.1', name: 'Operating Rhythm', icon: '\u25A4' }, { id: '4.2', name: 'Evaluation & Succession', icon: '\u25FB' }, { id: '4.3', name: 'First Leadership Review', icon: '\u25B3' }, { id: '4.4', name: 'Composure & Resilience', icon: '\u21AF' }], outcomes: [{ id: 'out-rhythm', name: 'Operating Rhythm' }, { id: 'out-evalplan', name: 'Evaluation Plan' }, { id: 'out-review', name: 'Review Report' }], ldev: [] },
  { id: 5, name: 'Lead', days: 'Ongoing', color: '#6B4C8A', steps: [{ id: '5.1', name: 'Leadership Dashboard', icon: '\u2B21' }, { id: '5.2', name: 'L&D Hub', icon: '\u2261' }, { id: '5.3', name: 'My Development', icon: '\u25C8' }], outcomes: [], ldev: [] }
];



var PHASE_WRAPUPS = {
  1: "Phase 1 complete. You\u2019ve scored your leadership team\u2019s readiness across the five sections of the Assessment Battery, profiled every senior leader in the Leadership Landscape, and scored the seven risk scenarios for your organization. Next, in Phase 2, you design the leadership architecture that closes the gaps you\u2019ve mapped.",
  2: "Phase 2 complete. You\u2019ve designed the leadership structure that owns the transformation, set the rules for how people and AI collaborate, and defined the seven competencies your leaders will be measured against. The architecture is written down and agreed on. Next, your leaders build real capability against it.",
  3: "Phase 3 complete. You've built hands-on AI fluency, pressure-tested decisions in simulation, activated middle management's judgment role, and anchored the work in your values architecture. Capability is no longer theoretical. Next, you embed it in how the organization runs.",
  4: "Phase 4 complete. You've set the operating rhythm, rewired evaluation to reward the behaviors the transformation needs, and run the leadership review that closes the 90 days. The architecture now lives in how you operate. The Lead phase carries it forward, quarter after quarter."
};
var MILESTONES = {
  '1.1': 'Baseline established \u2014 readiness scored across all five sections of the battery.',
  '1.2': 'Landscape mapped \u2014 every senior leader profiled, gaps identified, transformation ownership assessed.',
  '1.3': 'Risks surfaced \u2014 concrete scenarios confronted and scored.',
  '1.4': 'Foundations laid \u2014 mindset shift begun, AI dependencies inventoried.',
  '2.1': 'Structure designed \u2014 ownership, governance, decision rights mapped.',
  '2.2': 'Collaboration principles articulated.',
  '2.3': 'Competency framework defined \u2014 seven domains with gap analyses.',
  '2.4': 'Mindset deepened \u2014 values architecture and philosophical proficiency.',
  '3.1': 'Fluency sprint complete \u2014 every leader using AI tools personally.',
  '3.2': 'Decisions rehearsed \u2014 four AI-era scenarios run, each with an ethical pre-mortem.',
  '3.3': 'Middle management activated with practical workflows.',
  '3.4': 'Shared organizational values architecture defined and ready for role tagging.',
  '3.5': 'Mindset applied \u2014 fears and hopes surfaced, a protected skill in practice, commitments written.',
  '4.1': 'Operating rhythm embedded \u2014 five mechanisms owned and scheduled.',
  '4.2': 'Evaluation rewired \u2014 AI-readiness indicators in evaluation, succession bench reassessed.',
  '4.3': 'First review complete \u2014 rescored and assessed.',
  '4.4': 'Composure foundations set \u2014 constants named, decision practices in place, slow-thinking log begun.'
};

/* ═══ HELPERS (identical to pipeline module) ═══ */
function badge(text, color) { return '<span class="bg" style="background:' + color + '18;color:' + color + '">' + esc(text) + '</span>' }
function card(inner, style, attrs) { return '<div class="cd"' + (attrs ? ' ' + attrs : '') + (style ? ' style="' + style + '"' : '') + '>' + inner + '</div>' }
function recBox(key, title, authors, outlet, url, desc, mt, label, pageRef) {
  var open = UI.ctxOpen[key];
  var h = '<div style="background:rgba(var(--gold-rgb),.04);border:1px solid rgba(var(--gold-rgb),.2);border-radius:6px;' + (mt ? 'margin-top:' + mt + ';' : '') + 'margin-bottom:16px;overflow:hidden">';
  h += '<div onclick="UI.ctxOpen[\'' + key + '\']=!UI.ctxOpen[\'' + key + '\'];render()" style="display:flex;align-items:center;gap:8px;padding:12px 16px;cursor:pointer">';
  h += '<span style="font-family:var(--mono);font-size:10px;color:var(--gold);letter-spacing:.08em;flex:1">\u25A1 ' + (label || 'RECOMMENDED READING') + '</span>';
  h += '<span style="font-size:11px;color:rgba(138,130,120,.6)">' + (open ? '\u25BE' : '\u25B8') + '</span></div>';
  if (open) {
    h += '<div style="padding:0 16px 14px">';
    h += '<a href="' + url + '" target="_blank" rel="noopener" style="display:block;font-size:13px;font-weight:700;color:var(--paper);line-height:1.4;text-decoration:none">\u201C' + esc(title) + '\u201D</a>';
    h += '<div style="font-size:12px;color:var(--text-body);line-height:1.5;margin-top:4px">' + (authors ? esc(authors) + ', ' : '') + '<em>' + esc(outlet) + '</em>' + (pageRef ? ', ' + esc(pageRef) : '') + '</div>';
    if (desc) h += '<div style="font-size:13px;color:var(--text-body);line-height:1.5;margin-top:6px">' + esc(desc) + '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}
// Expandable, collapsed-by-default reference block showing a Phase 1 assessment
// baseline answer beside the matching Phase 2 design question. Renders nothing if
// the source answer is empty, so users who skipped section D see no empty boxes.
function assessBaselineBox(key, heading, bodyHtml) {
  if (!bodyHtml) return '';
  var open = UI.ctxOpen[key];
  var h = '<div style="background:rgba(var(--gold-rgb),.04);border:1px solid rgba(var(--gold-rgb),.2);border-radius:6px;margin-bottom:14px;overflow:hidden">';
  h += '<div onclick="UI.ctxOpen[\'' + key + '\']=!UI.ctxOpen[\'' + key + '\'];render()" style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer">';
  h += '<span style="font-family:var(--mono);font-size:10px;color:var(--gold);letter-spacing:.08em;flex:1">\u25A1 ' + esc(heading) + '</span>';
  h += '<span style="font-size:11px;color:rgba(138,130,120,.6)">' + (open ? '\u25BE' : '\u25B8') + '</span></div>';
  if (open) { h += '<div style="padding:0 14px 12px;font-size:13px;color:var(--text-body);line-height:1.6">' + bodyHtml + '</div>'; }
  h += '</div>';
  return h;
}
function btn(label, onclick, cls, style, disabled) { return '<button class="btn ' + (cls || 'bp') + '"' + (onclick ? ' onclick="' + String(onclick).replace(/"/g, '&quot;') + '"' : '') + (style ? ' style="' + style + '"' : '') + (disabled ? ' disabled' : '') + '>' + label + '</button>' }
function ta(label, id, v, ph, rows, ro) { var _g = (!ro && /\*/.test(label)) ? ' gate-field' : ''; var _lbl = ro ? String(label).replace(/\s*\*\s*$/, '') : label; var _hnd = ro ? '' : ' oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';gateRepaint()"'; return '<div class="mb-4"><label class="form-label">' + esc(_lbl) + '</label><textarea id="' + id + '" rows="' + (rows || 3) + '" class="ta-helper' + _g + '"' + _hnd + (ro ? ' readonly' : '') + ' placeholder="' + esc(ph || '') + '">' + esc(v || '') + '</textarea></div>' }
// Like ta(), but persists the Mindset Foundations fields and re-renders on blur, so a
// tab's gated complete button unlocks once its fields are filled \u2014 the all-text analog
// of how the Assessment Battery's likert inputs refresh their gate. Used only by the
// Working with AI step's reflection fields.
function taGated(label, id, v, ph, rows) { var _g = (/\*/.test(label)) ? ' gate-field' : ''; return '<div class="mb-4"><label class="form-label">' + esc(label) + '</label><textarea id="' + id + '" rows="' + (rows || 3) + '" class="ta-helper' + _g + '" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';gateRepaint()" onblur="mfPersistFields();crPersistFields();deferRender()" placeholder="' + esc(ph || '') + '">' + esc(v || '') + '</textarea></div>' }
function sel(label, id, v, opts, gloss, extraChange) { var h = '<div class="mb-4"><label class="form-label">' + esc(label) + '</label>' + (gloss ? '<p class="t-faint-sm" style="margin:-2px 0 8px">' + esc(gloss) + '</p>' : '') + '<select id="' + id + '" class="sel-helper' + (/\*/.test(label) ? ' gate-field' : '') + '" onchange="gateRepaint()' + (extraChange ? ';' + extraChange : '') + '">'; opts.forEach(function (o) { h += '<option value="' + esc(o.v) + '"' + (v === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>' }); return h + '</select></div>' }
function likert(label, id, val, lo, hi, help) { var h = '<div class="mb-5"><label class="form-label-md">' + esc(label) + '</label>' + (help ? '<p class="t-faint-sm" style="margin:-4px 0 8px">' + esc(help) + '</p>' : '') + '<div class="flx-center gap-2' + (/\*/.test(label) ? ' gate-field gate-likert' : '') + '"><span class="lk-cap">' + esc(lo) + '</span>'; for (var n = 1; n <= 5; n++) { var s = val === n; h += '<button onclick="likSet(\'' + id + '\',' + n + ')" class="lk-btn' + (s ? ' sel' : '') + '">' + n + '</button>' } return h + '<span class="lk-cap lk-cap-r">' + esc(hi) + '</span></div></div>' }

function adOtherBox(field, val, show) { return '<div id="ad_' + field + 'OtherWrap" style="display:' + (show ? 'block' : 'none') + ';margin:-8px 0 16px"><label class="form-label">Please specify</label><input id="ad_' + field + 'Other" type="text" value="' + esc(val || '') + '" placeholder="Describe it briefly" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.05);color:var(--paper);font-size:14px;font-family:var(--sans);box-sizing:border-box"></div>' }
function milestone(sid) { var m = MILESTONES[sid]; if (!m || !isStepDone(sid)) return ''; return '<div class="milestone-card"><div class="milestone-label">\u2713 Milestone Reached</div><div class="milestone-text">' + esc(m) + '</div></div>' }
var CAROUSEL_CONTENT = {
  "1.1": [
    {
      kind: "Why", headline: "You can\u2019t develop what you haven\u2019t honestly measured.",
      body: "Most leadership teams believe they are more ready for AI than they are. The belief persists because readiness is rarely measured. Before you can develop the team, you need a baseline that shows where it really stands.",
      example: "The 90-day leadership plan in [Fast Company](https://www.fastcompany.com/91534223/ai-ready-leadership-team-90-day-plan) that serves as a companion to this module begins at the same point: the first task is an honest picture of where your leadership team stands, rather than where its members believe it stands."
    },
    {
      kind: "What", headline: "Five sections, one baseline.",
      body: "The battery scores your organization\u2019s readiness for AI-era leadership across five sections: Purpose & Clarity, AI Fluency, Change Capacity, Structure Baseline, and Ethical Readiness.",
      body2: "Completing all five generates your Readiness Report. That report is the baseline the First Leadership Review, in Phase 4, is scored against."
    },
    {
      kind: "How", headline: "Make it safe to score honestly.",
      body: "Scoring your own leadership team is socially awkward, because the people being scored are in the room. Make honesty safe by treating the scores as development inputs rather than verdicts on careers. A flattering baseline protects no one. It only delays the discovery of the gaps until they are more expensive to close.",
      example: "A team that rates its AI fluency a four because the CEO is in the room learns nothing from the exercise. Gather each leader\u2019s scores independently before discussing them together. The discussion starts from numbers the team can trust."
    },
    {
      kind: "Outcome", headline: "A scored Readiness Report for your organization.",
      body: "You leave with your Readiness Report: a scored picture of where your organization stands across all five sections of the battery.",
      body2: "Next, the Leadership Landscape profiles the individual leaders behind these organizational scores."
    }
  ],
  "1.2": [
    {
      kind: "Why", headline: "The technology has a manager. Does the change have a leader?",
      body: "AI transformation fails less often from missing talent than from missing ownership. In most organizations, someone runs the AI tools, but the cultural and organizational change the tools demand belongs to no one.",
      example: "An article in [MIT Sloan Management Review](https://faisalhoque.com/why-ai-demands-a-new-breed-of-leaders/) argues that most organizations focus on the technical side of AI because their leadership structure does, and that CIOs typically lack the bandwidth and authority to lead the cultural and organizational change that determines whether AI succeeds."
    },
    {
      kind: "What", headline: "Every leader profiled, two questions confronted.",
      body: "Three pieces of work, done honestly.",
      bullets: [
        { label: "Profiles", text: "every senior leader assessed for AI fluency, engagement, change leadership experience, current bandwidth, and scope of impact." },
        { label: "The ownership question", text: "who owns AI transformation in your organization, and whether anyone owns the cultural and organizational change rather than just the technology." },
        { label: "The middle-management question", text: "is middle management a cost to be cut, or the layer of human judgment your AI systems will depend on?" }
      ]
    },
    {
      kind: "How", headline: "Profile people, not job titles.",
      body: "Two leaders with the same title can sit at opposite ends of the fluency scale, and the busiest people on the chart often have the least real capacity for transformation work. Score what each person can actually do and carry, rather than what their title implies.",
      example: "A division head who has personally run AI experiments and a peer who has only read about them hold the same box on the org chart, but they need entirely different development plans."
    },
    {
      kind: "Outcome", headline: "A Leadership Inventory you can plan from.",
      body: "You leave with every senior leader profiled, the gaps identified, and the ownership question answered, or exposed as unanswered.",
      body2: "Both findings feed Phase 2 directly: the Leadership Structure Lab exists to fix what this step reveals."
    }
  ],
  "1.3": [
    {
      kind: "Why", headline: "Every scenario in this step has already happened to someone.",
      body: "These are not thought experiments. Real organizations have deployed AI before their leaders were ready, automated away human judgment, and let an AI speak for the company with no boundaries in place. The costs have included direct financial losses, damaged trust, and legal liability.",
      example: "When Air Canada\u2019s website chatbot invented a bereavement refund policy, a tribunal found that the airline was liable for its consequences \u2014 [rejecting the argument that](https://www.mccarthy.ca/en/insights/blogs/techlex/moffatt-v-air-canada-misrepresentation-ai-chatbot) the chatbot was a separate legal entity. The technology did what it was built to do. The leadership structures around it did not."
    },
    {
      kind: "What", headline: "Seven scenarios, three scores each.",
      body: "You work through seven risk scenarios, each grounded in real events. For every scenario, you score how likely it is in your organization, how severe it would be, and how soon it could arrive. The scores build your Risk Map."
    },
    {
      kind: "How", headline: "Make every score an argument, not a guess.",
      body: "The temptation is to rate everything a comfortable medium. Instead, tie each score to something you found in the first two steps: a fluency gap, an unowned decision, or a customer-facing AI that nobody reviews. A score you can defend with evidence gives you something to act on.",
      example: "\u201CAn AI speaks for the company with no boundaries\u201D rates very differently in an organization whose chatbot answers policy questions unreviewed than in one where every customer-facing system has an owner and an audit trail."
    },
    {
      kind: "Outcome", headline: "A Risk Map that sets the build order.",
      body: "You finish Phase 1\u2019s organizational work holding three documents: your Readiness Report, your Leadership Inventory, and your Risk Map.",
      body2: "The highest-scoring risks become Phase 2\u2019s priorities. The structure you design next exists to close them."
    }
  ],
  "1.4": [
    {
      kind: "Why", headline: "Working with AI is not just a faster way of working.",
      body: "It is tempting to treat AI as one more productivity tool, such as a better search box or a quicker way to draft. But working with AI changes more than speed. It changes how work gets done, which of your skills stay sharp, and the assumptions you absorb from the tools themselves. This step is a first introduction to that shift.",
      example: "[Microsoft researchers](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/) surveyed 319 knowledge workers across 936 real examples of AI use and found that the more confidence people placed in generative AI, the less critical thinking they reported applying. Confidence in their own abilities predicted the reverse: more critical thinking, not less."
    },
    {
      kind: "What", headline: "A first step into a new way of thinking.",
      body: "This is where the individual track begins. Before the organizational work asks you to redesign structures and roles, this step asks something simpler and more personal: that you start to see your own working relationship with AI clearly. What does it actually mean to work with these tools, day to day? What are they changing about you, and what do you want to hold on to?"
    },
    {
      kind: "How", headline: "Start with your own experience, then go wider.",
      body: "You begin from where most people actually are \u2014 using AI as an everyday tool \u2014 before the picture widens to the digital workforce and the skills that erode through dependence. The aim is not to master every idea at once, but to begin the shift in how you think about working alongside AI.",
      example: "Most leaders meet AI first as an assistant in their own work, long before they are managing teams of agents. Starting there, rather than with the most advanced case, helps the shift stick."
    },
    {
      kind: "Outcome", headline: "The foundations of the individual track.",
      body: "You leave with a clearer view of your own relationship with AI, an awareness of how the digital workforce changes what leadership asks of you, and your AI dependencies on the record.",
      body2: "From here, the individual track runs alongside everything else in the module, deepening in each phase."
    }
  ],
  "2.1": [
    {
      kind: "Why", headline: "AI transformation needs an owner.",
      body: "Phase 1 showed you whether AI transformation has an owner, what the board actually governs, and what middle management is for. This lab turns those open questions into designed answers, made in advance rather than under pressure.",
      example: "This article in [Fast Company](https://www.fastcompany.com/91548478/boards-of-directors-have-critical-new-responsibilities-in-the-ai-era) argues that AI introduces exactly the kind of foundational risk that boards exist to oversee. Most boards are not yet aware of these risks, let alone equipped to act on them."
    },
    {
      kind: "What", headline: "Five decisions, made deliberately.",
      bullets: [
        { label: "Ownership", text: "who owns AI transformation: a new chief role, an expanded existing one, or a cross-functional council?" },
        { label: "Board governance", text: "how the board oversees AI, and which decisions need its approval." },
        { label: "Decision rights", text: "who across the senior team can fund an AI initiative, and who can halt one." },
        { label: "Middle management", text: "a verdict for each category of middle management work: automate now, augment now and automate later, or keep human judgment permanently." },
        { label: "Coordination", text: "how functions work together, so AI becomes a shared capability rather than a new set of silos." }
      ]
    },
    {
      kind: "How", headline: "Decide on paper what you\u2019d otherwise decide in a crisis.",
      body: "Writing down who can halt an AI system feels bureaucratic until the day a system needs halting and the answer turns out to be a meeting. The decisions in this lab are ones your organization may otherwise have to make under pressure. The lab lets you make them ahead of time under calm conditions.",
      example: "A useful test for each decision: imagine a bad day, with the system misbehaving and a journalist calling, and ask whether the structure you just designed tells everyone what to do. If it does not, the design is not finished."
    },
    {
      kind: "Outcome", headline: "A Leadership Structure that exists before it\u2019s needed.",
      body: "You leave with ownership assigned, board governance defined, decision rights mapped, middle-management verdicts recorded, and a coordination model chosen.",
      body2: "This structure is the frame that later work attaches to, including, in Phase 3, the values your team commits to role by role."
    }
  ],
  "2.2": [
    {
      kind: "Why", headline: "The line between human and AI work is jagged \u2014 and it runs through every function.",
      body: "AI performs some tasks brilliantly and fails at others that look nearly identical. Choosing the right collaboration model, task by task and function by function, determines whether AI compounds your judgment or erodes it.",
      example: "A field experiment with 758 consultants, published as a [Harvard Business School working paper](https://www.hbs.edu/faculty/Pages/item.aspx?num=64700), mapped what the authors call the jagged technological frontier: tasks of seemingly similar difficulty fall inside or outside AI\u2019s capability, and performance depended on which side of the line the work sat."
    },
    {
      kind: "What", headline: "A thinking lab, not a configuration tool.",
      bullets: [
        { label: "Touchpoints", text: "map every point where AI meets humans in your organization, and choose the collaboration model for each: AI as advisor, AI handling parts of the workflow, AI acting autonomously within boundaries, or AI and humans working the same problem in parallel." },
        { label: "Personas", text: "design how your AI presents itself, to customers and to your own people." },
        { label: "AI-free zones", text: "declare the spaces that will stay exclusively human." },
        { label: "Translation layer", text: "the people and processes that turn algorithmic signals back into human meaning." }
      ]
    },
    {
      kind: "How", headline: "Declare what stays human, out loud and in writing.",
      body: "An AI-free zone only protects what it names. \u201cWe\u2019ll keep humans in the loop somewhere\u201d protects nothing. \u201cFinal hiring decisions, creative direction, and frontline customer recovery stay human\u201d is a boundary your whole organization can hold.",
      example: "When a vendor pitches automation for a declared AI-free zone, the conversation takes thirty seconds. The zone was declared precisely so that nobody has to relitigate it under sales pressure."
    },
    {
      kind: "Outcome", headline: "Collaboration Principles your whole organization can read.",
      body: "You leave with every AI-human touchpoint mapped to a model, personas designed, AI-free zones declared, and the translation layer defined.",
      body2: "These principles carry forward: they sit alongside the Leadership Structure you designed in 2.1 and inform the competencies you define next."
    }
  ],
  "2.3": [
    {
      kind: "Why", headline: "You can\u2019t develop toward a standard you haven\u2019t defined.",
      body: "\u201CBe better with AI\u201D is an aspiration, not a framework. Leaders develop when the target is specific: named competencies, described in behaviors you can observe, scored so the gaps are visible.",
      example: "The World Economic Forum\u2019s [Future of Jobs Report 2025](https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/) finds that employers expect 39% of workers\u2019 core skills to change by 2030, leadership skills included. A target moving that fast has to be defined deliberately, or development ends up aimed at yesterday\u2019s requirements."
    },
    {
      kind: "What", headline: "Seven competencies, in behaviors you could film.",
      body: "You define seven leadership competencies for the AI era, each described in terms of observable behaviors, and then score every leader against them. The gaps become visible, and they set the priorities for Phase 3\u2019s development work."
    },
    {
      kind: "How", headline: "If you can\u2019t observe it, you can\u2019t measure it.",
      body: "\u201cThinks strategically about AI\u201d cannot be measured. \u201cSponsored two AI experiments this quarter and killed one for cause\u201d can be. Write each competency as something a colleague could witness, and the scoring stops being a matter of opinion.",
      example: "For each competency, draft one sentence that begins \u201cYou would see this leader\u201d and ends with an action. If the sentence cannot be finished with something visible, the competency is not defined yet."
    },
    {
      kind: "Outcome", headline: "A framework that turns gaps into plans.",
      body: "You leave with seven competencies defined, every leader scored, and a gap analysis per person: the raw material for Phase 3\u2019s development work.",
      body2: "Phase 2\u2019s organizational build is now complete: a Leadership Structure, Collaboration Principles, and a Competency Framework, designed and written down."
    }
  ],
  "2.4": [
    {
      kind: "Why", headline: "Your AI strategy has a philosophy, chosen or inherited.",
      body: "Every AI tool arrives with built-in assumptions about what counts as evidence, what a good answer looks like, and what matters. Leaders who never examine their own assumptions end up running their organizations on someone else\u2019s.",
      example: "In [MIT Sloan Management Review](https://sloanreview.mit.edu/article/philosophy-eats-ai/), Michael Schrage and David Kiron argue that leaders are either making AI decisions that reflect their organization\u2019s philosophies \u2014 or defaulting to the philosophies built into the models and tools they use. The default choice has its drawbacks."
    },
    {
      kind: "What", headline: "A values architecture, built one position at a time.",
      body: "Each leader works through their own values architecture: what this organization really is, what counts as evidence inside it, where the ethical lines sit, and which positions they would defend even at real cost."
    },
    {
      kind: "How", headline: "Test commitments at their real cost.",
      body: "A value isn\u2019t just something you\u2019d like to be true. It\u2019s something you\u2019re prepared to pay for. For every stated commitment, ask what it would cost to keep when the pressure is real, and whether you\u2019d still keep it.",
      example: "The working test from this module: if a principle wouldn\u2019t survive losing ten percent of revenue, it isn\u2019t a commitment. It\u2019s a slogan."
    },
    {
      kind: "Outcome", headline: "Positions you can state before you need them.",
      body: "You leave with your personal values architecture drafted: the philosophical proficiency that turns reactive judgment into principled judgment.",
      body2: "In Phase 3, these individual positions become collective: the team forges them into shared principles that attach to every role."
    }
  ],
  "3.1": [
    {
      kind: "Why", headline: "You can\u2019t lead tools you\u2019ve never used.",
      body: "Fluency doesn\u2019t come from reading about AI. It comes from using it on work that matters, where the results count. A leadership team that has never personally worked with AI is making its AI decisions secondhand.",
      example: "Microsoft and LinkedIn\u2019s [2024 Work Trend Index](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part), surveying 31,000 people across 31 countries, found 66% of leaders would not hire someone without AI skills, and 71% would rather hire a less experienced candidate with AI skills than a more experienced one without them. The bar leaders set for others now applies to leaders themselves."
    },
    {
      kind: "What", headline: "Real work, real tools, written down.",
      bullets: [
        { label: "Individually", text: "every leader takes three tasks from their own real work and completes them with AI tools, recording what worked, what failed, and what they learned." },
        { label: "Together", text: "the team runs a shared project with several AI tools working in combination." }
      ]
    },
    {
      kind: "How", headline: "Real work or it doesn\u2019t count.",
      body: "A demo impresses. Redoing your own board memo with AI teaches. Pick tasks where you know what good looks like, because that is what lets you judge the tool honestly, including where it failed you.",
      example: "A leader who runs their actual quarterly forecast through an AI tool learns its strengths, its confident errors, and its blind spots in one afternoon. No vendor presentation can transfer that knowledge."
    },
    {
      kind: "Outcome", headline: "A Fluency Assessment grounded in use.",
      body: "You finish with every leader having worked with AI personally, the lessons documented, and a team project run with several AI tools in combination.",
      body2: "With fluency built, judgment comes next. The decision simulations put it under pressure."
    }
  ],
  "3.2": [
    {
      kind: "Why", headline: "Instinct is only as good as the practice behind it.",
      body: "The decisions AI will force on your leadership team are novel, which means the instincts your leaders trust were trained on a different world. Judgment for new territory has to be built deliberately, under conditions where mistakes are cheap enough to learn from.",
      example: "In [McKinsey Quarterly](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/strategic-decisions-when-can-you-trust-your-gut), Daniel Kahneman and Gary Klein agree that intuition deserves trust only where the environment has structure and the decision-maker has had real practice with feedback \u2014 and Kahneman warns that confidence reflects the coherence of the story, not its validity."
    },
    {
      kind: "What", headline: "Four calls most teams keep avoiding.",
      body: "Four simulations, each built to force a decision: when to let an AI system make a consequential call on its own; how to handle a workforce transition when automation reaches a department; what to do when a competitor deploys faster than you can respond; and how to answer when a profitable strategy collides with one of your own principles. Each simulation ends with an ethical pre-mortem: assume the decision went wrong. Who was harmed, and what did you miss?"
    },
    {
      kind: "How", headline: "Make the pre-mortem hurt a little.",
      body: "Run the pre-mortem as if the failure is already public. Assume the decision ran for six months before anyone noticed the harm. Then name who was hurt, what signal was ignored, and who in the room should have spoken. Comfort is the enemy of the exercise.",
      example: "Teams that finish a simulation feeling clever usually went too easy. The pre-mortems that change behavior are the ones where someone says \u201cthat could genuinely be us,\u201d and means it."
    },
    {
      kind: "Outcome", headline: "Judgment exercised before reality demands it.",
      body: "You finish with four Decision Analyses on the record: the calls rehearsed and the failure modes named before reality forces them.",
      body2: "Next, that judgment gets distributed: middle management takes ownership of the workflows where AI and humans meet daily."
    }
  ],
  "3.3": [
    {
      kind: "Why", headline: "The layer you\u2019re tempted to cut is the layer holding the judgment.",
      body: "Middle managers translate strategy into daily work, and in an AI-era organization they\u2019re the human judgment closest to where the systems actually operate. Treating them purely as a cost is how organizations automate away their own oversight.",
      example: "[Gallup\u2019s research](https://news.gallup.com/businessjournal/182792/managers-account-variance-employee-engagement.aspx) finds that managers account for at least 70% of the variance in employee engagement across business units. That makes the manager the single biggest lever on whether people bring judgment and care to their work."
    },
    {
      kind: "What", headline: "Workflow by workflow, the human role defined.",
      body: "Examine your managers\u2019 workflows one by one, defining what AI will do and what stays human. Then build a registry of decisions that remain exclusively human, with the reasons written down."
    },
    {
      kind: "How", headline: "Write the reasons down, not just the rules.",
      body: "\u201cThis decision stays human\u201d is a rule. \u201cThis decision stays human because it requires context the system can\u2019t see\u201d is a rule that survives staff turnover and budget season. Unexplained rules get optimized away by the next efficiency push.",
      example: "A registry entry that says \u201Cexception approvals stay human \u2014 the data underrepresents our newest customers\u201D will still be defensible in two years, to people who weren\u2019t in the room."
    },
    {
      kind: "Outcome", headline: "Managers as owners, not bystanders.",
      body: "You finish with middle management activated: workflows defined, the exclusively human decisions registered with their reasons, and the people closest to the work invested in the design.",
      body2: "With judgment distributed, the team turns to what binds it together: forging its values into shared principles."
    }
  ],
  "3.4": [
    {
      kind: "Why", headline: "Values that live on a poster die in a decision.",
      body: "Most organizations have official values. Very few have values that predict behavior. The difference isn\u2019t the words. It\u2019s whether the values are forged by the people who must live them and attached to the roles where decisions get made.",
      example: "Donald Sull and Charles Sull, writing in [MIT Sloan Management Review](https://sloanreview.mit.edu/article/how-leaders-champion-culture-six-essential-lessons/), studied nearly 700 large corporations, analyzing more than 1 million online employee reviews, and found virtually no correlation between the values companies officially emphasize and how employees rate them on those same values."
    },
    {
      kind: "What", headline: "From each leader\u2019s private answers to one shared architecture.",
      body: "The team takes the individual values work from Phase 2 and forges it into shared organizational principles \u2014 and a statement of collective commitments that attaches to every role in your leadership structure."
    },
    {
      kind: "How", headline: "Attach values to roles, not walls.",
      body: "A principle tagged to the CFO role gets read at budget time. A principle on the lobby wall gets read by visitors. Role tagging is what separates this step from the values exercises your team has sat through before.",
      example: "\u201cWe do not let AI make irreversible customer decisions\u201d means one thing as a poster, and something else entirely when it is attached to the role of every leader who can approve a deployment."
    },
    {
      kind: "Outcome", headline: "Commitments attached to roles.",
      body: "You finish with a shared values architecture defined and ready for role tagging: principles forged by the team, not handed down to it.",
      body2: "Next, each leader applies the whole mindset track to their own practice in Mindset Application."
    }
  ],
  "3.5": [
    {
      kind: "Why", headline: "Experience teaches only when you stop to read it.",
      body: "This step exercises practical wisdom, the capacity that separates the well-informed leader from the effective one. Practical wisdom doesn\u2019t come from accumulating more experience. It comes from deliberately working through the experience you already have.",
      example: "Research by Di Stefano, Gino, Pisano, and Staats, published as a [Harvard Business School working paper](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2414478), found that once people have accumulated experience with a task, deliberately articulating and codifying that experience improves performance more than simply accumulating additional experience does."
    },
    {
      kind: "What", headline: "Three exercises that make it personal.",
      bullets: [
        { label: "AI Concern Circles", text: "each leader shares one fear and one hope about AI in their work, heard without judgment." },
        { label: "Skill Atrophy Audit", text: "one skill at risk of atrophying through AI dependency, and a deliberate practice to maintain it." },
        { label: "Philosophical Commitments Statement", text: "a brief statement of each leader\u2019s commitments \u2014 what this organization is, what counts as evidence, where the ethical lines sit \u2014 which feeds the guiding concepts attached to their position in the Leadership Structure." }
      ]
    },
    {
      kind: "How", headline: "One fear, one hope, said out loud.",
      body: "The concern circle works because it makes the private public, safely. Anxiety named in the circle becomes a development conversation. Anxiety left unnamed becomes quiet resistance to the whole program. Follow up individually with anyone whose fear runs deep.",
      example: "\u201cI\u2019m afraid my expertise stops mattering\u201d is a sentence that, once spoken, can be answered with a development plan, a role design, or a candid conversation. Left unspoken, it never gets an answer."
    },
    {
      kind: "Outcome", headline: "The mindset track, applied.",
      body: "You finish with fears and hopes surfaced, one protected skill per leader with a practice attached, and personal commitments that feed the Leadership Structure itself.",
      body2: "Phase 3 ends with judgment exercised at every level. Phase 4 makes all of it permanent."
    }
  ],
  "4.1": [
    {
      kind: "Why", headline: "Governance that has no rhythm has no teeth.",
      body: "Everything built in the previous three phases will fade without a cadence for maintaining it. What separates transformations that hold from those that don\u2019t isn\u2019t the launch. It\u2019s sustained, repeated action across the whole life cycle.",
      example: "[McKinsey\u2019s research on transformations](https://www.mckinsey.com/capabilities/transformation/our-insights/why-do-most-transformations-fail-a-conversation-with-harry-robinson) finds that fewer than one-third succeed, and that the main differentiator between success and failure is not any single move but the number of actions a company takes throughout the transformation\u2019s entire life cycle."
    },
    {
      kind: "What", headline: "Five mechanisms, on the calendar.",
      bullets: [
        { label: "The standing item", text: "AI becomes a fixture of every senior leadership meeting, not something to skip when time runs short." },
        { label: "Peer pairs", text: "each leader paired with peers working through comparable decisions, on a defined schedule." },
        { label: "Recurring simulations", text: "the decision simulations from Phase 3 become a regular practice." },
        { label: "Frontier exposure", text: "structured contact with the state of the art, not the state of the market." },
        { label: "Board education", text: "a program of its own, so oversight stays substantive." }
      ]
    },
    {
      kind: "How", headline: "Protect the rhythm when business gets loud.",
      body: "The rhythm\u2019s first real test is the busy quarter when skipping feels reasonable. Treat the calendar as the control: the agenda item that survives a crisis week is the one that will still exist in two years.",
      example: "A useful rule of thumb: the AI agenda item can be shortened, moved, or delegated, but never deleted. Ten disciplined minutes beat a skipped hour."
    },
    {
      kind: "Outcome", headline: "Discipline with a date attached.",
      body: "You leave with the Operating Rhythm embedded: the standing agenda item, peer learning structures, the simulation cadence, frontier exposure, and board education, each owned and scheduled.",
      body2: "Next, the incentives catch up: evaluation and succession get rewired to match the rhythm."
    }
  ],
  "4.2": [
    {
      kind: "Why", headline: "What gets evaluated gets taken seriously.",
      body: "If AI readiness shows up nowhere in how leaders are judged, paid, and promoted, the work of the last eighty days will not change how anyone behaves. And the succession bench, built for the last decade\u2019s demands, is where unreadiness compounds into some of the most expensive mistakes an organization can make.",
      example: "Research published in [Harvard Business Review](https://hbr.org/2021/05/the-high-cost-of-poor-succession-planning) estimates that badly managed CEO and C-suite transitions destroy close to $1 trillion a year in market value among the S&P 1500 alone. That is the price of treating the bench as an afterthought."
    },
    {
      kind: "What", headline: "Rewire what counts, reassess who\u2019s next.",
      body: "A meaningful share of every leader\u2019s evaluation gets tied to AI readiness: the experiments they\u2019ve sponsored, the fluency they\u2019ve demonstrated, the talent they\u2019ve developed. And the succession bench is reassessed against what the next decade will demand, not the last one."
    },
    {
      kind: "How", headline: "Reassess the bench against the future, not the past.",
      body: "Yesterday\u2019s perfect successor profile may be missing the one capability the next decade demands. Re-rank the bench on tomorrow\u2019s criteria, and be honest about gaps in people you like. The kindest thing you can do for a promising leader is name their gap while there\u2019s still time to close it.",
      example: "A bench review that produces no changes at all is usually a review that wasn\u2019t honest: if the criteria genuinely changed, at least some rankings should too."
    },
    {
      kind: "Outcome", headline: "Incentives and pipeline, pointed the same way.",
      body: "You leave with evaluation rewired for the AI era and a succession bench rebuilt on evidence: the structural change that helps this module outlive its sponsors.",
      body2: "One thing remains: measuring, in your own numbers, how far the team has come."
    }
  ],
  "4.3": [
    {
      kind: "Why", headline: "Drift is a decision made by default.",
      body: "Without a deliberate review, leadership readiness doesn\u2019t hold steady. It drifts with whatever the technology and the quarter demand. The review is where your organization chooses its direction consciously, with evidence, instead of being shaped tool by tool.",
      example: "This article in [Fast Company](https://www.fastcompany.com/91462416/leaders-prepare-organization-2026-ai) warns against drift: organizations that treat AI adoption as something that happens to them, tool by tool and team by team, without strategic intent, end up shaped by the technology rather than shaping it."
    },
    {
      kind: "What", headline: "Same dimensions, ninety days later.",
      body: "You rescore every leader against their day-one baseline: the same dimensions, measured again. The results show who has developed, who is progressing, who needs support, and where a hard conversation is waiting. Then you set the actions for the quarter ahead."
    },
    {
      kind: "How", headline: "Read the rescore as a roster, not a report card.",
      body: "The point isn\u2019t to grade the last ninety days. It\u2019s to staff the next ninety. Every delta is an assignment: growth gets stretched, progress gets supported, and a flat line gets the honest conversation it has been asking for. Hard calls have a cost, but the evidence in front of you is exactly what makes them fair.",
      example: "A leader whose fluency jumped two points is ready to mentor. A leader whose engagement hasn\u2019t moved since day one needs a different conversation, and now you can have it with numbers instead of impressions."
    },
    {
      kind: "Outcome", headline: "Evidence where intuition used to be.",
      body: "You finish with the Review Report: before and after, leader by leader, with the quarter ahead planned. It is the first turn of a cycle that continues long after day ninety.",
      body2: "One step remains, and it belongs to each leader personally: the composure to sustain all of it."
    }
  ],
  "4.4": [
    {
      kind: "Why", headline: "Calm is a capability, not a temperament.",
      body: "The AI era hands leaders volatility on a schedule no one controls. Staying composed through it is not about feeling less. It is about practices, built in advance, that keep judgment working under pressure.",
      example: "This article makes [the case for calm](https://www.fastcompany.com/91511688/how-to-lead-when-nobody-knows-whats-coming): the urge to do something, anything, to feel a sense of control often reflects an absence of composure rather than the presence of leadership. Sometimes the disciplined move is to hold steady."
    },
    {
      kind: "What", headline: "Practices that hold under pressure.",
      body: "Each leader builds four habits: pausing before reacting; thinking in portfolios instead of single bets; naming what persists through change \u2014 purpose, identity, commitments; and keeping a monthly log of decisions where they deliberately slowed down."
    },
    {
      kind: "How", headline: "Slow is a practice, not a pace.",
      body: "Pick one decision a month and slow it on purpose. Then log what changed because you waited. The log isn\u2019t paperwork. It\u2019s the training record for a capacity you\u2019ll need on a day you don\u2019t get to choose.",
      example: "A leader\u2019s log entry might read: \u201cI delayed announcing the reorganization by two days, and in that time two of my assumptions turned out to be wrong.\u201d An entry like that teaches more about composure than any workshop. Entry by entry, the pause becomes a reflex."
    },
    {
      kind: "Outcome", headline: "The foundation everything else stands on.",
      body: "You finish the module with composure foundations set, and a personal practice that continues, month by month, in the My Development dashboard after day ninety.",
      body2: "The organization is ready, and its leaders are ready. The two dashboards \u2014 the Leadership Structure and the L&D Hub \u2014 now carry the system forward, quarter after quarter."
    }
  ]
};

/* Carousel state — one carousel per page, idx persists per step */
var carouselState = { idx: 0, timer: null, stepId: null, hover: false };

function carouselGo(idx, manual) {
  var slides = document.querySelectorAll('.vp-slide');
  var dots = document.querySelectorAll('.vp-dot');
  if (!slides.length) return;
  var n = slides.length;
  var prevIdx = carouselState.idx;
  carouselState.idx = ((idx % n) + n) % n;
  var anim = manual || carouselState.idx !== prevIdx;
  slides.forEach(function (s, i) { var on = i === carouselState.idx; s.classList.toggle('active', on); if (on) { if (anim) { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = 'vpSlideIn .4s ease'; } else { s.style.animation = 'none'; } } });
  dots.forEach(function (d, i) { d.classList.toggle('active', i === carouselState.idx) });
  if (manual) carouselReset();
}

function carouselTick() {
  carouselState.timer = setInterval(function () {
    if (currentModal) { return; }
    var n = document.querySelectorAll('.vp-slide').length;
    if (!n) { clearInterval(carouselState.timer); carouselState.timer = null; return; }
    carouselGo(carouselState.idx + 1);
  }, 15000);
}

function carouselReset() {
  if (carouselState.timer) { clearInterval(carouselState.timer); carouselState.timer = null; }
  if (!carouselState.hover) carouselTick();
}

function carouselInit() {
  var car = document.querySelector('.vp-carousel');
  if (!car) {
    if (carouselState.timer) { clearInterval(carouselState.timer); carouselState.timer = null; }
    carouselState.stepId = null;
    return;
  }
  var stepId = car.getAttribute('data-step');
  // Reset idx when switching steps
  if (carouselState.stepId !== stepId) {
    carouselState.idx = 0;
    carouselState.stepId = stepId;
  }
  carouselState.hover = false;
  var slides = document.querySelectorAll('.vp-slide');
  if (carouselState.idx >= slides.length) carouselState.idx = 0;
  carouselGo(carouselState.idx);
  if (carouselState.timer) clearInterval(carouselState.timer);
  carouselTick();
  // Pause on hover
  car.addEventListener('mouseenter', function () {
    carouselState.hover = true;
    if (carouselState.timer) { clearInterval(carouselState.timer); carouselState.timer = null; }
  });
  car.addEventListener('mouseleave', function () {
    carouselState.hover = false;
    if (!carouselState.timer) carouselTick();
  });
}
function richInline(s) {
  if (!s) return '';
  var out = esc(s);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="vp-link">$1</a>');
  return out;
}
function hexToRgba(hex, alpha) {
  var h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c }).join('');
  var r = parseInt(h.substr(0, 2), 16) || 0;
  var g = parseInt(h.substr(2, 2), 16) || 0;
  var b = parseInt(h.substr(4, 2), 16) || 0;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}
function phaseColorFor(stepId) {
  // Theme-aware program data: these hexes feed hexToRgba()/inline SVG, so they
  // cannot be CSS var() references (§5A.5). Dark returns the tint set, light the
  // phase base hues; both maps measured from the ER token blocks. Fallback
  // unchanged from the pre-branch form.
  var m = (typeof UI !== 'undefined' && UI.theme === 'dark')
    ? { '1': '#4FB39A', '2': '#6B9FE0', '3': '#C8956A', '4': '#E07788', '5': '#A688D0' }
    : { '1': '#1B6B5A', '2': '#2D5A8E', '3': '#8B5E3C', '4': '#9B2D3F', '5': '#6B4C8A' };
  return m[String(stepId).charAt(0)] || '#5A7D8A';
}
function vpSlideIcon(kind) {
  return { Why: '?', What: '\u25a0', How: '\u25b2', Outcome: '\u2605' }[kind] || '\u25cf';
}
function vpCarousel(code, title, dur, content) {
  if (!content || !content.length) {
    return '<div class="vp"><div class="vp-play"><span class="vp-play-icon">\u25b6</span></div><div><div class="vp-title">' + esc(title) + '</div><div class="vp-meta">' + esc(dur) + ' \xb7 ' + esc(code) + '</div></div></div>';
  }
  var stepId = code.replace(/^(V|ARCH|ER)-/, '').split('.').slice(0, 2).join('.');
  var phColor = phaseColorFor(stepId);
  var total = content.length;
  var slides = content.map(function (s, i) {
    var icon = vpSlideIcon(s.kind);
    var num = String(i + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    return '<div class="vp-slide' + (i === 0 ? ' active' : '') + '">'
      + '<div class="vp-slide-meta">'
      + '<div class="vp-slide-icon">' + icon + '</div>'
      + '<div class="vp-slide-eyebrow">' + esc(s.kind) + '</div>'
      + '<div class="vp-slide-num">' + num + '</div>'
      + '</div>'
      + '<h3 class="vp-slide-headline">' + esc(s.headline) + '</h3>'
      + '<p class="vp-slide-body">' + richInline(s.body) + '</p>'
      + (s.bullets && s.bullets.length ? '<ul class="vp-slide-bullets">' + s.bullets.map(function (b) { return '<li>' + (b.label ? '<span class="vp-bullet-label">' + esc(b.label) + ':</span> ' : '') + richInline(b.text) + '</li>'; }).join('') + '</ul>' : '')
      + (s.body2 ? '<p class="vp-slide-body vp-slide-body2">' + richInline(s.body2) + '</p>' : '')
      + (s.example ? '<div class="vp-slide-example"><div class="vp-example-text">' + richInline(s.example) + '</div></div>' : '')
      + '</div>';
  }).join('');
  var dots = content.map(function (_, i) {
    return '<button class="vp-dot' + (i === 0 ? ' active' : '') + '" onclick="carouselGo(' + i + ', true)" aria-label="Slide ' + (i + 1) + '"></button>';
  }).join('');
  return '<div class="vp-carousel" data-step="' + stepId + '" style="--ph:' + phColor + ';--ph-bg:' + hexToRgba(phColor, 0.10) + ';--ph-glow:' + hexToRgba(phColor, 0.18) + '">'
    + '<button class="vp-nav vp-prev" onclick="carouselGo(carouselState.idx-1, true)" aria-label="Previous slide" title="Previous slide">\u2039</button>'
    + '<button class="vp-nav vp-next" onclick="carouselGo(carouselState.idx+1, true)" aria-label="Next slide" title="Next slide">\u203a</button>'
    + '<div class="vp-slides">' + slides + '</div>'
    + '<div class="vp-dots">' + dots + '</div>'
    + '</div>';
}
function vp(code, title, dur) { var stepId = code.replace(/^(V|ARCH|ER)-/, '').split('.').slice(0, 2).join('.'); return vpCarousel(code, title, dur, (CAROUSEL_CONTENT || {})[stepId]) }
function doneBtn(onclick, disabled, label, taskId, sectionComplete) {
  var byTask = (typeof taskId === 'string' && isStepDone(taskId));
  var byFlag = (taskId === true) || (sectionComplete === true);
  var isComplete = byTask || byFlag;
  // Level-aware labels (ruled 25 July): a string taskId marks the step-level button,
  // the boolean form marks tab/section buttons — stacked identical labels confused both.
  var _step = (typeof taskId === 'string');
  if (isComplete) {
    return '<div class="done-wrap">' + btn(_step ? '\u2713 Step complete' : '\u2713 Section complete', onclick, 'bd done-btn done-btn-complete', '', false) + '</div>';
  }
  var helperMsg = (typeof sectionComplete === 'string') ? sectionComplete : 'Complete required fields (*) first.';
  return '<div class="done-wrap" onclick="gatePeek(event)">' + btn(label || (_step ? '\u2713 Mark step complete and continue \u2192' : '\u2713 Mark section complete and continue \u2192'), onclick, 'bd done-btn', '', disabled) + (disabled ? '<p class="done-helper">' + helperMsg + '</p>' : '') + '</div>';
}
function paintGates() { var els = document.querySelectorAll('.gate-field'); for (var i = 0; i < els.length; i++) { var el = els[i], empty; if (el.classList.contains('gate-likert')) { empty = !el.querySelector('.lk-btn.sel') } else { empty = !String(el.value || '').trim() } el.classList.toggle('gate-empty', empty) } }
function gatePeek(ev) { var w = ev && ev.currentTarget; var b = w && w.querySelector('.done-btn'); if (b && b.disabled) { gateArmed = true; paintGates(); } }
function gateRepaint() { if (typeof gateArmed !== 'undefined' && gateArmed) paintGates() }
function stepAssignBar(stepId) { if (!stepId) return ''; /* leaders gate dropped by ruling, 12 Aug 2026 — assignment targets the roster, which exists from day one */ return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:24px"><div style="font-family:var(--mono);font-size:10px;color:var(--stone);letter-spacing:.08em;text-transform:uppercase">Assigned to</div>' + assignBtn(stepId) + '</div>' }
function likSet(path, n) { if (path.split('.')[0] === 'assessments' && lockBlocked('assessments')) return; harvestFields(); var parts = path.split('.'); var obj = data; for (var i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]] } obj[parts[parts.length - 1]] = n; saveData(); render() }
function harvestFields() {
  /* Item-13 (F-13): on adoption renders only the focused field harvests — the
     still-stale DOM must never re-commit pre-refresh values over the adopted blob. */
  var $ = function (id) { if (__adoptHarvestOnly !== undefined && id !== __adoptHarvestOnly) return null; return document.getElementById(id); };
  var maps = { A: { base: 'assessments.purpose', fields: ['mission', 'priorities', 'aiStrategy'], prefix: 'ap_' }, B: { base: 'assessments.fluency', fields: ['engagement', 'tools'], prefix: 'af_' }, C: { base: 'assessments.change', fields: ['recentChange'], prefix: 'ac_' }, D: { base: 'assessments.structure', fields: ['ownership', 'ownershipOther', 'boardOversight', 'boardOversightOther', 'crossFunc', 'crossFuncOther', 'decisionStructure', 'gaps'], prefix: 'ad_' }, E: { base: 'assessments.ethical', fields: ['workforce', 'lines'], prefix: 'ae_' } };
  var m = maps[UI.sec];
  if (m) {
    var parts = m.base.split('.'); var obj = data; for (var i = 0; i < parts.length; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]] }
    m.fields.forEach(function (f) { var el = $(m.prefix + f); if (el) obj[f] = el.value });
  }
  // Also harvest landscape notes if on 1.2
  var ll1 = $('ll_ownershipGap'), ll2 = $('ll_mmAssessment');
  if (ll1 || ll2) { if (!data.landscapeNotes) data.landscapeNotes = {}; if (ll1) data.landscapeNotes.ownershipGap = ll1.value; if (ll2) data.landscapeNotes.mmAssessment = ll2.value }
  // Harvest risk notes if on 1.3
  var sids = ['zillow', 'calstate', 'aircanada', 'cigna', 'stigma', 'disruption', 'fatigue'];
  sids.forEach(function (sid) { var el = $('risk_' + sid + '_notes'); if (el) { if (!data.riskNotes) data.riskNotes = {}; data.riskNotes[sid] = el.value } });
  // Harvest mindset study reflections if on 1.4
  var ms1 = $('ms_theme1'), ms2 = $('ms_theme2'), msA = $('ms_dwAgents'), msM = $('ms_dwManaging'), msS = $('ms_selfAudit'), msR = $('read1');
  if (ms1 || ms2 || msA || msM || msS || msR) { var _msS = myIndivStore('mindsetStudy'); if (_msS) { if (ms1) _msS.theme1 = ms1.value; if (ms2) _msS.theme2 = ms2.value; if (msA) _msS.dwAgents = msA.value; if (msM) _msS.dwManaging = msM.value; if (msS) _msS.selfAudit = msS.value; for (var _ri = 1; _ri <= 5; _ri++) { var _re = $('read' + _ri); if (_re) _msS['read' + _ri] = _re.value; } } }
  // Harvest Phase 2 structure fields
  var stFields = ['ownerModel', 'ownerWho', 'ownerChange', 'boardStructure', 'boardStructureOther', 'boardExpertise', 'boardExpertiseGaps', 'boardDecisions', 'boardEducation', 'seniorDecisionRights', 'seniorAccountability', 'seniorAlignment', 'mmAutomate', 'mmAugment', 'mmHuman', 'coordMechanism', 'coordCadence', 'coordConflict', 'coordInfo'];
  stFields.forEach(function (f) { var el = $('st_' + f); if (el) { if (!data.structure) data.structure = {}; data.structure[f] = el.value } });
  // Harvest Phase 2 collab lab fields
  var clFields = ['touchCustomer', 'touchInternal', 'touchDecision', 'touchAgent', 'modelMapping', 'personaCustomer', 'personaInternal', 'personaBoundaries', 'aiFreeZones', 'proprietary', 'atrophyRisks', 'translators', 'transProcesses', 'transRisks'];
  clFields.forEach(function (f) { var el = $('cl_' + f); if (el) { if (!data.collabLab) data.collabLab = {}; data.collabLab[f] = el.value } });
  // Harvest competency definitions
  ['orchestration', 'philosophical', 'hybrid', 'change', 'composure', 'ecosystem', 'emotional'].forEach(function (id) { var el = $('cf_def_' + id); if (el) { if (!data.competencyFramework) data.competencyFramework = {}; if (!data.competencyFramework.definitions) data.competencyFramework.definitions = {}; data.competencyFramework.definitions[id] = el.value } });
  // Harvest mindset depth fields (2.4)
  var mdFields = ['val1', 'val2', 'val3', 'val4', 'val5', 'case1', 'case2', 'case3'];
  var _mdS = myIndivStore('mindsetDepth'); if (_mdS) mdFields.forEach(function (f) { var el = $('md_' + f); if (el) _mdS[f] = el.value });
  // Harvest Phase 3 fluency sprint (shared fields)
  ['project', 'projectWorkflow', 'projectJudgment', 'filter'].forEach(function (f) { var el = $('fl_' + f); if (el) { if (!data.fluencySprint) data.fluencySprint = {}; data.fluencySprint[f] = el.value } });
  // Harvest per-leader fluency tasks
  (data.leaders || []).forEach(function (l, i) { var lid = l.id; if (!lid) return;['task1', 'task2', 'task3'].forEach(function (f) { var el = $('fl_lt_' + lid + '_' + f); if (el) { if (!data.fluencySprint) data.fluencySprint = {}; if (!data.fluencySprint.leaderTasks) data.fluencySprint.leaderTasks = {}; if (!data.fluencySprint.leaderTasks[lid]) data.fluencySprint.leaderTasks[lid] = {}; data.fluencySprint.leaderTasks[lid][f] = el.value } }) });
  // Harvest Phase 3 decision sims
  ['autonomous', 'workforce', 'competitor', 'ethical'].forEach(function (id) { ['response', 'premortem'].forEach(function (f) { var el = $('ds_' + id + '_' + f); if (el) { if (!data.decisionSims) data.decisionSims = {}; data.decisionSims[id + '_' + f] = el.value } }) });
  // Harvest Phase 3 MM activation
  ['workflows', 'humanOnly', 'logTemplate', 'logCadence', 'evalCriteria', 'evalMetrics'].forEach(function (f) { var el = $('mm_' + f); if (el) { if (!data.mmActivation) data.mmActivation = {}; data.mmActivation[f] = el.value } });
  // Harvest Phase 3 mindset application
  var _maS = myIndivStore('mindsetApp'); if (_maS) ['atrophySkill', 'practice', 'commitments'].forEach(function (f) { var el = $('ma_' + f); if (el) _maS[f] = el.value });
  // Harvest Phase 4 operating rhythm
  ['agenda', 'agendaOwner', 'peerStructure', 'peerAgenda', 'simFreq', 'simDesign', 'frontier', 'boardEd'].forEach(function (f) { var el = $('or_' + f); if (el) { if (!data.opRhythm) data.opRhythm = {}; data.opRhythm[f] = el.value } });
  // Harvest Phase 4 eval & succession
  ['indicators', 'proportion', 'bench', 'benchChanges', 'boardFluency'].forEach(function (f) { var el = $('ev_' + f); if (el) { if (!data.evalSuccession) data.evalSuccession = {}; data.evalSuccession[f] = el.value } });
  // Harvest Phase 4 leadership review per-leader
  (data.leaders || []).forEach(function (l, i) { var lid = l.id; if (!lid) return;['assessment', 'notes'].forEach(function (f) { var el = $('rv_' + lid + '_' + f); if (el) { if (!data.leadershipReview) data.leadershipReview = {}; if (!data.leadershipReview.leaders) data.leadershipReview.leaders = {}; if (!data.leadershipReview.leaders[lid]) data.leadershipReview.leaders[lid] = {}; data.leadershipReview.leaders[lid][f] = el.value } }) });
  ['structWorking', 'structRevision'].forEach(function (f) { var el = $('rv_' + f); if (el) { if (!data.leadershipReview) data.leadershipReview = {}; data.leadershipReview[f] = el.value } });
  // Harvest Phase 4 composure
  var _crS = myIndivStore('composure'); if (_crS) ['stop1', 'stop2', 'stop3', 'constants', 'constantsComm', 'uncertaintyProcess', 'uncertaintyComms'].forEach(function (f) { var el = $('cr_' + f); if (el) _crS[f] = el.value });
  // Harvest Phase 3 Values Architecture standing fields (3.4). These are persistent
  // textareas (not the add-a-principle inputs), so they must survive navigation like
  // every other content area. ov_principle/ov_domain are deliberately excluded.
  var _ov1 = $('ov_divergences'), _ov2 = $('ov_embedding'), _ov3 = $('ov_collectiveCommitments');
  if (_ov1 || _ov2 || _ov3) { if (!data.valuesDiscussion) data.valuesDiscussion = {}; if (_ov1) data.valuesDiscussion.divergences = _ov1.value; if (_ov2) data.valuesDiscussion.embedding = _ov2.value; if (_ov3) data.valuesDiscussion.collectiveCommitments = _ov3.value; }
}

/* ═══ COMPLETION ═══ */
function isStepDone(id) {
  var cs = data.completedSteps || {};
  // 1.1–1.3 are flag-based (1.1: 25 July §19.28 conformance; 1.2/1.3: item-41 ruling, same day):
  // completion belongs to the discrete confirm→flag→stamp path, never derived from data state.
  // The old data conditions live on as the buttons' gates (1.2: ≥2 leaders; 1.3: ≥1 risk scored).
  if (id === '1.1') return !!cs['1.1'];
  if (id === '1.2') return !!cs['1.2'];
  if (id === '1.3') return !!cs['1.3'];
  // Individual-track steps: completion is per logged-in user's leader, not org-wide.
  if (INDIVIDUAL_TRACK_STEPS[id]) return indivStepDone(id);
  return !!cs[id];
}
// Per-leader completion for individual-track steps, keyed by the leader the
// current user is linked to. Unlinked users have nothing completed.
function indivStepDone(stepId) {
  var ml = getMyLeader(); if (!ml) return false;
  var d = (data.indivDone || {})[ml.id];
  return !!(d && d[stepId]);
}
function markIndivDone(stepId) {
  var ml = getMyLeader(); if (!ml) return;
  if (!data.indivDone) data.indivDone = {};
  if (!data.indivDone[ml.id]) data.indivDone[ml.id] = {};
  data.indivDone[ml.id][stepId] = true;
}
// Individual-track data stores (mindsetStudy, mindsetDepth, mindsetApp, composure)
// are keyed by the current user's leader id. These helpers return that leader's
// slice. Reads tolerate an unlinked user (return {}); writes no-op if unlinked
// (the step UI gates on a linked leader before showing the form).
function myIndivRead(name) {
  var ml = getMyLeader(); if (!ml) return {};
  return ((data[name] || {})[ml.id]) || {};
}
function myIndivStore(name) {
  var ml = getMyLeader(); if (!ml) return null;
  if (!data[name]) data[name] = {};
  if (!data[name][ml.id]) data[name][ml.id] = {};
  return data[name][ml.id];
}
// Steps belonging to the individual leadership-development track. These run per
// participant and are intentionally excluded from organization-level phase
// completion (org phases can read 100% without every individual finishing theirs).
var INDIVIDUAL_TRACK_STEPS = { '1.4': 1, '2.4': 1, '3.5': 1, '4.4': 1 };
function getProgress() { var t = 0, d = 0; for (var i = 0; i < 4; i++) { var ph = PH[i]; for (var j = 0; j < ph.steps.length; j++) { var sid = ph.steps[j].id; if (INDIVIDUAL_TRACK_STEPS[sid]) continue; t++; if (isStepDone(sid)) d++ } } return { total: t, done: d, pct: t ? Math.round(d / t * 100) : 0 } }

/* ═══ NAVIGATION ═══ */
var navHistory = [];
// §7A harvest-then-switch at navigation (family law, Rev K; applied to ER 25 July 2026).
// Element-guarded sweep of every static shared-field family: only fields present on the
// current page write, so a lean page never blanks stored values. The battery harvester
// stays UI.sec-scoped inside harvestFields; the individual-track persisters carry their
// own change-gated saves. Dynamic-row families (workflows, deps, org values, fluency rows)
// harvest in their own add/remove handlers per §7A; enterprise and per-record editors
// persist through their savers. st_/cl_ writes here are memory-level like harvestFields —
// the next saveData persists them.
function harvestOpenFields() {
  try {
    harvestFields();
    mfPersistFields(); crPersistFields();
    var FAM = [
      { store: 'structure', prefix: 'st_', fields: ['ownerModel', 'ownerWho', 'ownerChange', 'ownerName', 'boardStructure', 'boardStructureOther', 'boardExpertiseGaps', 'boardDecisions', 'boardEducation', 'seniorDecisionRights', 'seniorAccountability', 'seniorAlignment', 'mmAutomate', 'mmAugment', 'mmHuman', 'coordMechanism', 'coordCadence', 'coordConflict', 'coordInfo'] },
      { store: 'collabLab', prefix: 'cl_', fields: ['touchCustomer', 'touchInternal', 'touchDecision', 'touchAgent', 'modelMapping', 'personaCustomer', 'personaInternal', 'personaBoundaries', 'aiFreeZones', 'proprietary', 'atrophyRisks', 'translators', 'transProcesses', 'transRisks'] }
    ];
    FAM.forEach(function (fam) {
      fam.fields.forEach(function (f) { var el = $(fam.prefix + f); if (el) { if (!data[fam.store]) data[fam.store] = {}; data[fam.store][f] = el.value; } });
    });
  } catch (e) { }
}
function go(page, step) {
  harvestOpenFields();  // §7A: typed text never dies on a re-render — harvest before navigation
  // Push current state to history before navigating
  if (currentPage) navHistory.push({ page: currentPage, step: currentStep });
  if (navHistory.length > 50) navHistory = navHistory.slice(-50);
  if (step === undefined && page !== 'home' && page !== 'learn' && page !== 'readiness' && page !== 'insights' && page !== 'phase5') {
    var v = page;
    if (v.match(/^phase-(\d+)$/)) { page = 'phaseHome'; step = v.replace('phase-', ''); }
    else if (v.match(/^out-/)) { page = 'outcome'; step = v; }
    else if (v === '5.1') { page = 'phase5'; }
    else if (v.match(/^\d+\.\d/)) { page = 'step'; step = v; }
  }
  currentPage = page; currentPhase = null;
  if (step) currentStep = step; else if (page !== 'step' && page !== 'outcome') currentStep = null;
  if (currentStep) {
    for (var i = 0; i < PH.length; i++) {
      for (var j = 0; j < PH[i].steps.length; j++) { if (PH[i].steps[j].id === currentStep) { currentPhase = PH[i]; break } }
      if (!currentPhase && PH[i].outcomes) { for (var k = 0; k < PH[i].outcomes.length; k++) { if (PH[i].outcomes[k].id === currentStep) { currentPhase = PH[i]; break } } }
      if (currentPhase) break;
    }
  }
  render(); window.scrollTo(0, 0);
}
function goBack() {
  if (!navHistory.length) return;
  var prev = navHistory.pop();
  // Set state directly without pushing to history
  currentPage = prev.page; currentStep = prev.step; currentPhase = null;
  if (currentStep) {
    for (var i = 0; i < PH.length; i++) {
      for (var j = 0; j < PH[i].steps.length; j++) { if (PH[i].steps[j].id === currentStep) { currentPhase = PH[i]; break } }
      if (!currentPhase && PH[i].outcomes) { for (var k = 0; k < PH[i].outcomes.length; k++) { if (PH[i].outcomes[k].id === currentStep) { currentPhase = PH[i]; break } } }
      if (currentPhase) break;
    }
  }
  render(); window.scrollTo(0, 0);
}
function backBtn() { return navHistory.length ? '<button class="btn-ghost pad-chip-sm" onclick="harvestFields();saveData();goBack()">\u2190 Back</button>' : '' }
function goTo(stepId, anchor, tab) { if (tab) { if (tab.mf) UI.mfTab = tab.mf; if (tab.cr) UI.crTab = tab.cr; } go(stepId); setTimeout(function () { var el = $(anchor); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 50) }
/* Shared in-place Add Leader panel (ruled 16 July): any "+ Add New Leader" button opens this
   on the page it sits on — no navigation. Saving runs the normal saveLeader path, so the
   leader joins data.leaders and appears module-wide (inventory, charts, dashboards). */
function addLeaderPanel() {
  return card('<h3 class="h-sub-lg">Add Leader</h3>' + leaderFormFields({}) + '<div style="display:flex;gap:12px;margin-top:12px">' + btn('Save', 'saveLeader()', 'bp') + btn('Cancel', 'UI.addLeaderOpen=false;render()', 'bg2') + '</div>');
}
/* 1.2's own add/edit card. Edit opens inline below the clicked leader card; add opens in the button's slot (ruled 16 July). */
function leaderEditCard() {
  var leaders = data.leaders || [];
  var ed = UI.editIdx !== null ? (leaders[UI.editIdx] || {}) : { name: '', role: '', fluency: '', changeExp: '', bandwidth: '', engagement: '', scope: '' };
  return card('<h3 class="h-sub-lg">' + (UI.editIdx !== null ? 'Edit' : 'Add') + ' Leader</h3>' + leaderFormFields(ed) + '<div style="display:flex;gap:12px;margin-top:12px">' + btn('Save', 'saveLeader()', 'bp') + btn('Cancel', 'UI.addForm=false;UI.editIdx=null;render()', 'bg2') + '</div>');
}

function render() {
  try { notifySweepDeadlines() } catch (e) { }
  var _fEl = document.activeElement, _fid = _fEl && _fEl.id, _fsel = (_fEl && typeof _fEl.selectionStart === 'number') ? _fEl.selectionStart : null;
  // Preserve unsaved form values before re-render
  var _fc = {};
  var _fields = document.querySelectorAll('input[id],textarea[id],select[id]');
  for (var fi = 0; fi < _fields.length; fi++) { var f = _fields[fi]; if (f.id) _fc[f.id] = f.value }
  var navEl = document.querySelector('nav'), ftEl = $('appFooter');
  /* Sample tab (Part 3): never a sign-in form; a tab opened without a signed-in tab shows only A.3.6 */
  if (SAMPLE_MODE && (SAMPLE_REFUSED || !currentUserId || !getCurrentUser())) {
    var _ntS = $('navTabs'), _nrS = $('navRight'); if (_ntS) _ntS.innerHTML = ''; if (_nrS) _nrS.innerHTML = '';
    if (navEl) navEl.style.display = 'none'; if (ftEl) ftEl.style.display = 'none';
    var _sbS = $('pipSidebar'); if (_sbS) _sbS.style.display = 'none';
    var _tgS = $('sidebarToggle'); if (_tgS) _tgS.style.display = 'none';
    var _cfS = $('coachFab'); if (_cfS) _cfS.style.display = 'none';
    var _apS = $('app'); if (_apS) { _apS.className = 'main-content sidebar-collapsed'; _apS.innerHTML = '<div class="sample-refused"><p>Sign in to your organization, then open Demo from the top bar.</p></div>'; }
    return;
  }
  if (!currentOrgId || !currentUserId || !getCurrentUser()) {
    var _nt = $('navTabs'), _nr = $('navRight');
    if (_nt) _nt.innerHTML = ''; if (_nr) _nr.innerHTML = '';
    if (navEl) navEl.style.display = 'none';
    if (ftEl) ftEl.style.display = 'none';
    var _sb = $('pipSidebar'); if (_sb) _sb.style.display = 'none';
    var _stb = $('sidebarToggle'); if (_stb) _stb.style.display = 'none';
    /* Signed-out chrome (ruled 28 Jul, family-wide): the AI Guide FAB and its
       panel belong to the signed-in app only \u2014 suppress them on the gate. */
    coachOpen = false;
    var _cf = $('coachFab'); if (_cf) _cf.style.display = 'none';
    var _fp = $('fabPulse') || document.querySelector('.coach-fab-pulse'); if (_fp) _fp.style.display = 'none'; /* the pulse is shell markup with CSS animation; app.js never referenced it (28 Jul follow-up) */
    var _cp = $('coachPanel'); if (_cp) { _cp.className = 'coach-panel'; _cp.innerHTML = ''; }
    var _ap = $('app'); if (_ap) { _ap.className = 'main-content sidebar-collapsed'; _ap.innerHTML = renderEntry(); }
    var _ef = document.querySelector('.login-screen input'); if (_ef && document.activeElement !== _ef && !(UI.entry && UI.entry.err)) _ef.focus();
    updateAdminBar();
    repaintOpenPanels(); /* Items 3+12: all render paths repaint the open panels */
    return;
  }
  if (navEl) navEl.style.display = ''; if (ftEl) ftEl.style.display = '';
  var _cfR = $('coachFab'); if (_cfR) _cfR.style.display = ''; /* restore the AI Guide hidden by the gate (28 Jul) */
  var _fpR = $('fabPulse') || document.querySelector('.coach-fab-pulse'); if (_fpR) _fpR.style.display = '';
  try { applyAiFeatures(); } catch (e) { } /* Part 2: the AI Guide and Voice buttons follow the organization's settings on every render */
  // Capture any unsaved field input before the DOM is replaced, so clicking an
  // example, an Add button, or any other re-render trigger never clears typed text.
  // harvestFields() is fully guarded (no-ops on pages without matching fields).
  try { harvestFields(); } catch (e) { }
  renderNav();
  var h = '';
  // Screens migrated to <name>.html + <name>.js (see screen-loader.js).
  // Each entry maps a page id to its container-based render function.
  var SCREEN_MODULES = { home: window.renderHome, learn: window.renderLearn };
  var screenFn = SCREEN_MODULES[currentPage];
  if (screenFn) { screenFn($('app')); }
  else if (currentPage === 'insights') h = renderInsights();
  else if (currentPage === 'readiness') h = renderOverview();
  else if (currentPage === 'step') h = renderStep();
  else if (currentPage === 'phaseHome') h = renderPhaseHome(parseInt(currentStep));
  else if (currentPage === 'phase5') h = renderDashboard();
  else if (currentPage === 'outcome') h = renderOutcomePage();
  else if (currentPage === 'mgmt-hub') h = renderMgmtHub();
  else if (currentPage === 'reports') h = renderReports(); /* 14 Sep 2026: the Report Manager page */
  if (!screenFn) {
    var _zs = (UI.zoom && UI.zoom !== 1) ? (' style="zoom:' + UI.zoom + '"') : '';
    $('app').innerHTML = '<div class="zoom-wrap" id="zoomWrap"' + _zs + '>' + h + '</div>';
    if (_fid) { setTimeout(function () { try { var _fe2 = document.getElementById(_fid); if (_fe2 && typeof _fe2.focus === 'function') { _fe2.focus(); if (_fsel != null && typeof _fe2.setSelectionRange === 'function') _fe2.setSelectionRange(_fsel, _fsel) } } catch (_e) { } }, 0) }
  }
  // Scroll-to-editor (ruled 16 July): any edit card opened by clicking a tab or a
  // non-edit card scrolls into view after the repaint. Set-sites assign UI.scrollTo
  // to the wrapper id; the flag clears immediately so later re-renders stay put.
  if (UI.scrollTo) { (function (_sid) { setTimeout(function () { try { var _el = document.getElementById(_sid); if (_el && typeof _el.scrollIntoView === 'function') _el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_e) { } }, 30); })(UI.scrollTo); UI.scrollTo = null; }
  renderSidebar();
  carouselInit();
  syncNavHeight();
  updateNotesCount();
  repaintOpenPanels(); /* Items 3+12 (F-3/F-11/F-15, ruled 27 July): surfaces outside #app repaint on every render */
  updateAdminBar();
  var _gk = currentStep + '/' + (UI.sec || '') + '/' + (UI.mfTab || '') + '/' + (UI.crTab || ''); if (_gk !== _lastGateStep) { gateArmed = false; _lastGateStep = _gk; } if (gateArmed) paintGates();
  /* Re-inject preserved values into fields the fresh paint left empty — EXCEPT on
     adoption refreshes, where a field of a record this user does NOT hold must show
     the adopted state: re-injecting there resurrects a stale local value into a field
     a teammate may have just cleared, and the next save would commit it. Fields with
     no record mapping (rk null: panel inputs, draft forms) have no shared value to
     resurrect and always re-inject. */
  for (var fk in _fc) { var fe = document.getElementById(fk); if (fe && !fe.value) { var _ark = null; try { _ark = idToRecordKey(fk) } catch (e2) { } if (!_adoptPaint || _ark === null || _ark === _heldLock) fe.value = _fc[fk] } }
  applyLockUI(true);
  ensureSampleNote(); /* Part 3: the red note, on every page of the sample tab */
}

function renderNav() {
  var pages = [{ id: 'home', l: 'Home' }, { id: 'learn', l: 'Learn' }, { id: 'readiness', l: 'Readiness' }, { id: 'phase5', l: 'Lead' }, { id: 'insights', l: 'Insights' }];
  var _p5step = (currentPage === 'step' && String(currentStep || '').indexOf('5.') === 0); /* Item-2 (Fix Batch 1): the step's phase decides the tab — 5.x lights Lead */
  var th = ''; for (var i = 0; i < pages.length; i++) { var p = pages[i]; var act = currentPage === p.id || (_p5step ? (p.id === 'phase5') : ((currentPage === 'step' || currentPage === 'phaseHome' || currentPage === 'outcome') && p.id === 'readiness')); th += '<button class="nav-tab' + (act ? ' active' : '') + '" onclick="go(\'' + p.id + '\')">' + p.l + '</button>' }
  var nt = $('navTabs'); if (nt) nt.innerHTML = th;
  var cu = getCurrentUser();
  var _zz = UI.zoom || 1; var _zp = Math.round(_zz * 100);
  var navMoreHtml = UI.navMore ? (
    '<div class="nav-more-backdrop" onclick="closeNavMore()"></div>' +
    '<div class="nav-more-menu" role="menu">' +
    '<div class="nav-more-zoom">' +
    '<div class="nmz-head"><span class="nmz-lbl">View</span><span class="nmz-val">' + _zp + '%</span></div>' +
    '<div class="nmz-row">' +
    '<button class="nmz-btn" onclick="zoomOut()" title="Zoom out" aria-label="Zoom out"' + (_zz <= 0.5 ? ' disabled' : '') + '>\u2212</button>' +
    '<button class="nmz-btn" onclick="zoomIn()" title="Zoom in" aria-label="Zoom in"' + (_zz >= 2 ? ' disabled' : '') + '>+</button>' +
    '<button class="nmz-chip" onclick="zoomFit()" title="Fit page to screen">Fit</button>' +
    '<button class="nmz-chip" onclick="zoomReset()" title="Reset to 100%">Reset</button>' +
    '</div>' +
    '</div>' +
    '<div class="nav-more-sep"></div>' +
    '<button class="nav-more-item' + (currentPage === 'mgmt-hub' ? ' nav-action-on' : '') + '" role="menuitem" onclick="closeNavMore();go(\'mgmt-hub\')"><span class="nav-more-ic">\u25a6</span> Track Program</button>' +
    '<button class="nav-more-item' + (currentPage === 'reports' ? ' nav-action-on' : '') + '" role="menuitem" onclick="closeNavMore();go(\'reports\')"><span class="nav-more-ic">\u25a7</span> Report Manager</button>' + /* 14 Sep 2026 (Paul's ruling): the Report Manager's door */
    (voiceOn() ? '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleVoice()"><span class="nav-more-ic">&#9673;</span> Voice</button>' : '') +
    (SAMPLE_MODE ? '' : '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleNotes()"><span class="nav-more-ic">&#9998;</span> Notes <span id="notesCount" class="notes-count">' + ((data.notes || []).length) + '</span></button>') + /* Part 3.3.8: Notes moved here from the top bar, above Org & Team */
    (SAMPLE_MODE ? '' : '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openOrg()"><span class="nav-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span> Profile</button>' + (isAppAdmin ? '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openAdmin()"><span class="nav-more-ic">&#9638;</span> Admin</button>' : '')) +
    '<div class="nav-more-sep"></div>' +
    (SAMPLE_MODE ? '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();restartSample()"><span class="nav-more-ic">&#8635;</span> Start the sample again</button>' +
      '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();closeSample()"><span class="nav-more-ic">&#10005;</span> Close the sample</button>' :
    '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openChangePassword()"><span class="nav-more-ic">&#9679;</span> Change password</button>' +
    '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();seedData()"><span class="nav-more-ic">\u21BB</span> Seed sample data</button>') +
    (SAMPLE_MODE ? '' : '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();exportState()"><span class="nav-more-ic">&#8595;</span> Export state</button>' +
    '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();importState()"><span class="nav-more-ic">&#8593;</span> Import state</button>') + /* Sweep 4R item 9 (addendum 5 Oct 2026; amends Part 3): not in the sample tab */
    '</div>'
  ) : '';
  var nr = $('navRight');
  if (nr) nr.innerHTML = (cu ? '<div class="nav-user-chip" onclick="signOut()" title="Click to sign out">' /* Sweep 4R item 9: in the sample tab too, where Sign Out closes the sample */ + userAv(cu, 26) + '<div class="nav-user-name">' + esc(cu.name.split(" ")[0]) + '</div></div>' : '') +
    '<button class="btn-ghost pad-chip-md nav-action" onclick="openHelp()" title="Help">? Help</button>' +
    '<button class="btn-ghost pad-chip-md nav-action" onclick="toggleTheme()" title="Switch theme">\u25d0 ' + (UI.theme === 'dark' ? 'Light Mode' : 'Dark Mode') + '</button>' +
    (SAMPLE_MODE ? '' : '<button id="gchatNavBtn" class="btn-ghost pad-chip-md nav-action' + (gchatOpen ? ' nav-action-on' : '') + '" onclick="toggleGChat()">\u2261 Team Chat<span id="gchatUnread" class="gchat-unread" style="display:' + (gchatUnread() > 0 ? '' : 'none') + '">' + gchatUnread() + '</span></button>') +
    (SAMPLE_MODE ? '' : '<button id="sampleNavBtn" class="btn-ghost pad-chip-md nav-action" onclick="openSampleTab()">&#9673; Demo</button>') + /* Part 3.3.7: Demo takes the Notes button's place (Notes is in the More menu) */
    '<span class="nav-more-wrap"><button class="btn-ghost pad-chip-md nav-action' + (UI.navMore ? ' nav-action-on' : '') + '" onclick="toggleNavMore(event)" aria-haspopup="true" aria-expanded="' + (UI.navMore ? 'true' : 'false') + '" title="More">\u22EF More</button>' + navMoreHtml + '</span>';
}

function setZoom(val) { var z = Math.max(0.5, Math.min(2.0, Math.round(val * 100) / 100)); UI.zoom = z; try { Store.setPref('zoom', z) } catch (e) { } render(); }
function zoomIn() { setZoom((UI.zoom || 1) + 0.1) }
function zoomOut() { setZoom((UI.zoom || 1) - 0.1) }
function zoomReset() { setZoom(1) }
function zoomFit() { var w = document.getElementById('zoomWrap'); if (!w) return setZoom(1); var pz = w.style.zoom || ''; w.style.zoom = 1; var nh = w.scrollHeight; var vh = (window.innerHeight || 800) - 120; if (pz) w.style.zoom = pz; var fs = nh > 0 ? Math.max(0.5, Math.min(1, vh / nh)) : 1; setZoom(fs); }
function syncNavHeight() {
  var n = document.querySelector('nav');
  if (!n) return;
  var h = n.offsetHeight;
  if (h > 0) {
    var s = document.documentElement.style;
    s.setProperty('--nav-h', (h + 16) + 'px');    // main-content top padding: header height + 16px gap (unchanged)
    s.setProperty('--nav-h-exact', h + 'px');   // sidebar top: exact header bottom, so the sidebar sits flush and can never be underlapped
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', function () { syncNavHeight(); });
  // The header's height changes for reasons a window 'resize' never sees: web fonts swapping in after first
  // paint, the tabs/actions wrapping to a second line, browser zoom, and content changes. A ResizeObserver on
  // <nav> fires on all of them, so --nav-h / --nav-h-exact always track the real height with no timing gap.
  if (typeof ResizeObserver !== 'undefined') {
    var _navRO = new ResizeObserver(function () { syncNavHeight(); });
    var _watchNav = function () { var el = document.querySelector('nav'); if (el) { _navRO.observe(el); return true; } return false; };
    if (!_watchNav()) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _watchNav);
      else setTimeout(_watchNav, 0);
    }
  }
  // Font swap is the classic first-paint reflow; nudge once fonts are ready, as a fallback for any browser
  // where the observer would miss the very first layout.
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { syncNavHeight(); }); }
}
// When entering/leaving fullscreen on the org chart, repaint it so the bottom-right
// detail overlay appears (in fullscreen) or is dropped and the normal page re-syncs
// (on exit). Guarded so it only acts for the chart wrappers.
if (typeof document !== 'undefined') {
  var _orgFsHandler = function () {
    var fe = document.fullscreenElement || document.webkitFullscreenElement || null;
    if (fe && (fe.id === 'orgChartWrap' || fe.id === 'llChartWrap')) {
      // Repaint so the bottom-right detail overlay shows.
      if (typeof orgRepaintInPlace === 'function') orgRepaintInPlace();
    } else {
      // Left fullscreen: a full render() restores the normal detail panel + chrome.
      if (typeof render === 'function') render();
    }
  };
  document.addEventListener('fullscreenchange', _orgFsHandler);
  document.addEventListener('webkitfullscreenchange', _orgFsHandler);
}

// ── Drag-to-pan on the org board (ruled 25 July 2026) ─────────────────────────
// Delegated at the document level so it survives every re-render: press and drag
// anywhere on a board canvas (.org-board-canvas — the page board or the same element
// fullscreened) to pan its scroll container. A 4px threshold keeps plain role clicks
// intact; after a real drag a capture-phase suppressor eats the one click that
// follows, so a drag ending on a role never opens its panel. Interactive elements
// (buttons, links, form fields) never start a pan. Touch: native scroll fires
// pointercancel and takes over — the same pan, browser-owned.
// Pointer capture engages only AFTER the threshold: capturing at press retargets the
// following click to the canvas in real browsers (click is a PointerEvent honoring
// capture), which killed role-node clicks — found in Paul's browser pass, 26 July.
if (typeof document !== 'undefined') {
  var _boardPan = null, _panSuppress = false;
  document.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var t = e.target, cv = t && t.closest ? t.closest('.org-board-canvas') : null;
    if (!cv) return;
    if (t.closest('button,select,input,textarea,a,label')) return;
    _boardPan = { el: cv, x: e.clientX, y: e.clientY, sl: cv.scrollLeft, st: cv.scrollTop, moved: false };
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!_boardPan) return;
    var dx = e.clientX - _boardPan.x, dy = e.clientY - _boardPan.y;
    if (!_boardPan.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    if (!_boardPan.moved) { _boardPan.moved = true; _boardPan.el.classList.add('is-panning'); if (_boardPan.el.setPointerCapture && e.pointerId !== undefined) { try { _boardPan.el.setPointerCapture(e.pointerId) } catch (_pe) { } } }
    _boardPan.el.scrollLeft = _boardPan.sl - dx;
    _boardPan.el.scrollTop = _boardPan.st - dy;
    if (e.cancelable) e.preventDefault();
  }, true);
  var _endBoardPan = function () {
    if (!_boardPan) return;
    if (_boardPan.moved) { _panSuppress = true; setTimeout(function () { _panSuppress = false; }, 0); _boardPan.el.classList.remove('is-panning'); }
    _boardPan = null;
  };
  document.addEventListener('pointerup', _endBoardPan, true);
  document.addEventListener('pointercancel', _endBoardPan, true);
  document.addEventListener('click', function (e) {
    if (_panSuppress) { e.stopPropagation(); e.preventDefault(); _panSuppress = false; }
  }, true);
}

function minimizeSidebar() { sidebarMinimized = true; try { Store.setPref('sidebar-min', '1') } catch (e) { } sidebarOpen = true; render(); }
function maximizeSidebar() { sidebarMinimized = false; try { Store.setPref('sidebar-min', '0') } catch (e) { } sidebarOpen = true; render(); }
function toggleSidebarSize() { if (sidebarMinimized) maximizeSidebar(); else minimizeSidebar(); }

function activeNavPhaseId() {
  if (currentPage === 'phaseHome' && currentStep) return parseInt(currentStep);
  if (currentPage === 'phase5') return 5;
  if (currentPhase) return currentPhase.id;
  if (currentPage === 'step' && currentStep) return parseInt(String(currentStep).charAt(0));
  return null;
}
// Chevron handler: open/collapse this phase in place. Holds until the next navigation.
function toggleNavPhase(id) {
  var k = String(id); if (!UI.navOpenSet) UI.navOpenSet = {};
  UI.navOpenSet[k] = !UI.navOpenSet[k];
  var ss = document.querySelector('.sidebar-scroll'); var top = ss ? ss.scrollTop : 0;
  renderSidebar();
  var ss2 = document.querySelector('.sidebar-scroll'); if (ss2) ss2.scrollTop = top;
}
// Phase-row handler (the whole phase bar). Acts as a toggle:
//   collapsed -> open it and navigate to the phase
//   open      -> collapse it in place (stay where you are, don't navigate away)
// The chevron still opens/collapses without navigating in either direction.
function goPhase(id) {
  var k = String(id); if (!UI.navOpenSet) UI.navOpenSet = {};
  if (UI.navOpenSet[k]) {
    delete UI.navOpenSet[k];   // already open -> clasp shut in place
    var ss = document.querySelector('.sidebar-scroll'); var top = ss ? ss.scrollTop : 0;
    renderSidebar();
    var ss2 = document.querySelector('.sidebar-scroll'); if (ss2) ss2.scrollTop = top;
  } else {
    UI.navOpenSet[k] = true;  // collapsed -> open this phase (others stay open) and navigate to it
    go(id === 5 ? 'phase5' : 'phase-' + id);
  }
}
function toggleNavMore(e) { if (e && e.stopPropagation) e.stopPropagation(); UI.navMore = !UI.navMore; renderNav(); }
function closeNavMore() { if (UI.navMore) { UI.navMore = false; renderNav(); } }

/* ===== HOME =====  Home screen lives in home.html + home.js (Screens.mount; see screen-loader.js). */


var insightsTab = 'latest';

var INSIGHT_SOURCES = {
  hbr: { label: 'Harvard Business Review' },
  smr: { label: 'MIT Sloan Management Review' },
  fastco: { label: 'Fast Company' },
  imd: { label: 'I by IMD' },
  psych: { label: 'Psychology Today' },
  linkedin: { label: 'LinkedIn' }
};

var LATEST_THOUGHTS = [
  { src: 'hbr', title: 'Manage Your AI Investments Like a Portfolio', date: 'January 2026', url: 'https://faisalhoque.com/manage-your-ai-investments-like-a-portfolio/', excerpt: 'Why a disciplined, stage-gated portfolio approach is the difference between AI investments that compound and pilots that drain attention and resources.' },
  { src: 'hbr', title: 'Two Frameworks for Balancing AI Innovation and Risk', date: 'March 2025', url: 'https://faisalhoque.com/two-frameworks-for-balancing-ai-innovation-and-risk/', excerpt: 'OPEN and CARE \u2013 the two complementary frameworks for harnessing AI\u2019s potential while guarding against its risks.' },
  { src: 'smr', title: 'Why AI Demands a New Breed of Leaders', date: 'April 2025', url: 'https://faisalhoque.com/why-ai-demands-a-new-breed-of-leaders/', excerpt: 'With Thomas H. Davenport and Erik Nelson \u2013 why organizations need a new leadership role to manage the cultural and organizational change that AI adoption brings.' },
  { src: 'fastco', title: 'Boards of Directors Have Critical New Responsibilities in the AI Era', date: 'June 11, 2026', url: 'https://faisalhoque.com/boards-of-directors-have-critical-new-responsibilities-in-the-ai-era/', excerpt: 'If leadership were just analysis, an algorithm could do it. What boards must now own in the AI era \u2013 and how to build the capabilities to own it.' },
  { src: 'fastco', title: 'Culture Is Where AI Strategy Goes to Die. Here\u2019s How to Jump-Start an AI-Ready Culture in 90 Days', date: 'May 18, 2026', url: 'https://faisalhoque.com/culture-is-where-ai-strategy-goes-to-die-heres-how-to-jump-start-an-ai-ready-culture-in-90-days/', excerpt: 'A step-by-step road map for building a culture that supports AI transformation instead of suffocating it.' },
  { src: 'fastco', title: 'The Cost of Hollowing Out Human Accountability', date: '2026', url: 'https://faisalhoque.com/the-cost-of-hollowing-out-human-accountability/', excerpt: 'Twenty seconds to approve a military strike; 1.2 seconds to deny an insurance claim. What happens when humans are in the loop but humanity is not.' },
  { src: 'imd', title: 'Stop Developing an Obsolete AI Strategy. Part 2: Enterprise Risk', date: 'May 31, 2026', url: 'https://faisalhoque.com/stop-developing-an-obsolete-ai-strategy-part-2-enterprise-risk/', excerpt: 'How to defend against the risks that emerge from what others are doing with AI \u2013 new models, competitor breakthroughs, and shifts in how value is created.' },
  { src: 'imd', title: 'Stop Developing an Obsolete AI Strategy. Part 1: Project Risk', date: 'May 20, 2026', url: 'https://www.imd.org/ibyimd/brain-circuits/stop-developing-an-obsolete-ai-strategy-part-1-project-risk/', excerpt: 'The distinction every leader needs: project risk arises from your own AI implementations, and portfolio discipline is how you manage it.' },
  { src: 'psych', title: 'The Loneliness of Being Needed', date: 'May 31, 2026', url: 'https://faisalhoque.com/the-loneliness-of-being-needed/', excerpt: 'The strongest person you know is running on empty. It might be you.' },
  { src: 'psych', title: 'We All Use AI. Here\u2019s How to Use It Well', date: 'May 19, 2026', url: 'https://faisalhoque.com/we-all-use-ai-heres-how-to-use-it-well/', excerpt: 'The future belongs to people who can think with AI \u2013 without thinking like it.' },
  { src: 'psych', title: 'Only Dead Things Stay the Same', date: 'April 22, 2026', url: 'https://faisalhoque.com/dead-things-stay-the-sameyour-next-chapter-in-the-age-of-ai/', excerpt: 'Most of us live in the waiting room of our own lives, waiting for things to settle. They never do \u2013 and that is the nature of being alive.' },
  { src: 'linkedin', title: 'Faisal on LinkedIn', date: 'Updated daily', url: 'https://www.linkedin.com/in/faisalhoque/', excerpt: 'Daily commentary on AI, leadership, and transformation \u2013 the fastest-moving strand of Faisal\u2019s thinking, posted most days.' }
];

var CONVERGENCE_EPISODES = [
  { tag: 'Episode 17', title: 'How to Jump-Start Your Company\u2019s Responsible AI Governance in 90 Days', yt: 'fGxQxBIhOLs', desc: 'A step-by-step road map through the essential foundations for managing AI ethics, accountability, and human impact.' },
  { tag: 'Episode 16', title: 'How to Diagnose the Strategic Gap: AI Readiness for Leaders', yt: 'BtoHiUeI1D0', desc: 'Three critical questions for AI strategy \u2013 identifying business bottlenecks, building a cultural safety net, and the 90-day reality of innovation.' },
  { tag: 'Episode 15', title: 'Is the AI Job Crisis Designed?', yt: 'igUJjKHIKEk', desc: 'From boardroom decisions that favor short-term margins to the demand desert created when companies automate their own customers out of existence.' },
  { tag: 'Episode 14', title: 'Regenerative Leadership Principles to Scale AI Successfully', yt: 'HifjkL3XyiM', desc: 'How regenerative leadership fuels innovation, collaboration, and resilience while building teams that last.' }
];

var FEATURED_VIDEOS = [
  { tag: 'Fast Company', title: 'How Companies Can Roll Out AI Without Replacing Employees', yt: 'nJAsQANx9yQ', desc: 'Fast Company senior editor Bryan Lufkin talks with Faisal about what companies get wrong when rolling out AI \u2013 and how to do it better.' },
  { tag: 'Yahoo Finance', title: 'Balancing Innovation and Security', yt: '18661-i900Y', desc: 'Responsible innovation and responsible utilization come first. A conversation about the fundamentals of deploying AI well.' },
  { tag: 'TRANSCEND', title: 'Four Parts to TRANSCEND', yt: 'wZnd_WZ3iBs', desc: 'The structure behind the book \u2013 including the philosophical grounding that gave rise to the OPEN and CARE frameworks.' },
  { tag: 'I by IMD Book Club', title: 'Navigating Business Transformation in a Hyperdigital Era', yt: 'Ow-mnxL2tQM', desc: 'The I by IMD Book Club session on REINVENT \u2013 how organizations stay on top of relentless change.' }
];

var WORTH_YOUR_TIME = [
  { kind: 'Book', cta: 'View on Amazon', title: 'All In on AI', by: 'Thomas H. Davenport and Nitin Mittal \u00b7 Harvard Business Review Press, 2023', url: 'https://www.amazon.com/dp/1647824699', desc: 'How the most aggressive adopters \u2013 Ping An, Airbus, Capital One \u2013 put AI at the core of everything they do, from the longest-standing authority on enterprise analytics.' },
  { kind: 'Article', cta: 'Read Article', title: 'Five Trends in AI and Data Science for 2026', by: 'Thomas H. Davenport and Randy Bean \u00b7 MIT Sloan Management Review', url: 'https://sloanreview.mit.edu/article/five-trends-in-ai-and-data-science-for-2026/', desc: 'Their annual reading of where enterprise AI is actually heading \u2013 the investment bubble, the move to AI factories, agentic AI\u2019s slow road to value, and who should own the AI agenda.' },
  { kind: 'Video', cta: 'Watch Video', title: 'AI Trends in 2026: Key Insights for Leaders', by: 'Thomas H. Davenport and Randy Bean \u00b7 MIT Sloan Management Review \u00b7 13 min', url: 'https://sloanreview.mit.edu/video/ai-trends-in-2026-key-insights-for-leaders/', desc: 'The companion conversation to the trends column: why most AI investments are not paying off yet, and what leading companies do differently.' },
  { kind: 'Newsletter', cta: 'Visit Newsletter', title: 'One Useful Thing', by: 'Ethan Mollick \u00b7 Wharton School', url: 'https://www.oneusefulthing.org/', desc: 'A free newsletter on working with AI in practice \u2013 grounded in research, hands-on, and updated as fast as the technology moves.' },
  { kind: 'Report', cta: 'Read Report', title: 'The 2026 AI Index Report', by: 'Stanford Institute for Human-Centered AI', url: 'https://hai.stanford.edu/ai-index/2026-ai-index-report', desc: 'The most comprehensive annual data on AI\u2019s technical progress, economic footprint, and adoption \u2013 a standard reference for scanning the horizon.' },
  { kind: 'Book', cta: 'View on Amazon', title: 'Competing in the Age of AI', by: 'Marco Iansiti and Karim R. Lakhani \u00b7 Harvard Business Review Press, 2020', url: 'https://www.amazon.com/dp/1633697622', desc: 'The Harvard Business School case for why AI-driven operating models change the rules of scale, scope, and learning.' },
  { kind: 'Book', cta: 'View on Amazon', title: 'The Coming Wave', by: 'Mustafa Suleyman with Michael Bhaskar \u00b7 Crown, 2023', url: 'https://www.amazon.com/Coming-Wave-Power-Our-Future/dp/0593593979', desc: 'The DeepMind co-founder \u2013 now chief executive of Microsoft AI \u2013 on the containment problem: keeping control of technologies that spread faster than the institutions meant to govern them.' },
  { kind: 'Podcast', cta: 'Listen to Podcast', title: 'Me, Myself, and AI', by: 'Sam Ransbotham and Shervin Khodabandeh \u00b7 MIT Sloan Management Review and Boston Consulting Group', url: 'https://sloanreview.mit.edu/audio-series/me-myself-and-ai/', desc: 'What separates AI success from AI hype \u2013 episode-by-episode conversations with the people running AI inside companies like YouTube, Cisco, Sony, and ExxonMobil.' }
];

function renderInsights() {
  var h = '<div class="u-70c6b34">';

  // ── Hero bar ──────────────────────────────────────────────────────────────
  h += '<div class="u-4f90335">';
  h += '<div class="section-label">Insights</div>';
  h += '<div class="u-3536245">';
  h += '<div>';
  h += '<h1 class="section-title u-d51702b">Ideas &amp; <em>Conversations</em></h1>';
  h += '<p class="u-7e59c65">Faisal Hoque\u2019s latest writing across six outlets, the CONVERGENCE podcast and interview appearances, and a shelf of work by people we admire.</p>';
  h += '</div>';
  h += '</div>';

  // ── Section navigation (anchors, not content switches) ────────────────────
  h += '<div class="u-58a9696">';
  h += insightsTabBtn('latest', 'Latest Thoughts');
  h += insightsTabBtn('conversations', 'Conversations');
  h += insightsTabBtn('worth', 'Worth Your Time');
  h += '</div>';
  h += '</div>';

  // ── All three sections on one continuous page ─────────────────────────────
  h += '<div class="u-dc4836c">';
  h += '<div id="insights-latest" class="insights-section">';
  h += '<div class="section-title insights-section-title">Latest <em>Thoughts</em></div>';
  h += insightsLatestHtml();
  h += '</div>';
  h += '<div id="insights-conversations" class="insights-section" style="margin-top:56px">';
  h += '<div class="section-title insights-section-title">Conversations</div>';
  h += insightsConversationsHtml();
  h += '</div>';
  h += '<div id="insights-worth" class="insights-section" style="margin-top:56px">';
  h += '<div class="section-title insights-section-title">Worth Your <em>Time</em></div>';
  h += insightsWorthHtml();
  h += '</div>';
  h += '</div>';

  h += '</div>';
  return h;
}

function insightsTabBtn(id, label) {
  return '<button class="insight-filter' + (insightsTab === id ? ' active' : '') + '" data-itab="' + id + '" onclick="setInsightsTab(\'' + id + '\')">' + label + '</button>';
}

function setInsightsTab(t) {
  insightsTab = t;
  var btns = document.querySelectorAll('.insight-filter[data-itab]');
  for (var i = 0; i < btns.length; i++) { btns[i].classList.toggle('active', btns[i].getAttribute('data-itab') === t); }
  var sec = document.getElementById('insights-' + t);
  if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function insightsLatestHtml() {
  var h = '<p class="t-stone-13" style="max-width:680px;margin:0 0 6px">The most recent pieces from each outlet, refreshed as new work appears. Articles open on faisalhoque.com.</p>';
  h += '<div class="u-53a30b8">';
  for (var i = 0; i < LATEST_THOUGHTS.length; i++) {
    var it = LATEST_THOUGHTS[i]; var s = INSIGHT_SOURCES[it.src];
    h += '<div class="insight-card" onclick="window.open(\'' + it.url + '\',\'_blank\')" title="Read on faisalhoque.com \u2013 opens in a new tab">';
    h += '<div class="insight-card-header">';
    h += '<span class="insight-badge insight-badge--mono">' + s.label + '</span>';
    h += '<span class="insight-date">' + esc(it.date) + '</span>';
    h += '</div>';
    h += '<div class="insight-title">' + esc(it.title) + '</div>';
    h += '<div class="insight-excerpt">' + esc(it.excerpt) + '</div>';
    h += '<div class="insight-card-foot"><span class="insight-cta">Read \u2192</span></div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function insightsConversationsHtml() {
  var h = '<div class="section-label" style="margin-top:4px">The CONVERGENCE Podcast</div>';
  h += '<p class="t-stone-13" style="max-width:680px;margin:6px 0 14px">The latest four episodes of the signature series with Faisal Hoque and Lauren Hawker Zafer. Click any episode to play it here.</p>';
  h += '<div class="conv-grid">';
  for (var i = 0; i < CONVERGENCE_EPISODES.length; i++)h += insightsYtCard(CONVERGENCE_EPISODES[i]);
  h += '</div>';
  h += '<div class="section-label" style="margin-top:36px">Interviews &amp; Appearances</div>';
  h += '<p class="t-stone-13" style="max-width:680px;margin:6px 0 14px">A selection of Faisal\u2019s conversations from his video archive.</p>';
  h += '<div class="conv-grid">';
  for (var i = 0; i < FEATURED_VIDEOS.length; i++)h += insightsYtCard(FEATURED_VIDEOS[i]);
  h += '</div>';
  return h;
}

function insightsYtCard(v) {
  var h = '<div class="conv-card">';
  h += '<div class="overview-video-yt yt-facade" data-yt="' + v.yt + '" role="button" tabindex="0" aria-label="Play: ' + esc(v.title) + '">';
  h += '<img class="yt-poster" src="https://i.ytimg.com/vi/' + v.yt + '/hqdefault.jpg" alt="" loading="lazy"/>';
  h += '<div class="yt-play"></div>';
  h += '</div>';
  h += '<div class="conv-card-tag">' + esc(v.tag) + '</div>';
  h += '<div class="serif-sub">' + esc(v.title) + '</div>';
  h += '<div class="t-stone">' + esc(v.desc) + '</div>';
  h += '</div>';
  return h;
}

function insightsWorthHtml() {
  var h = '<p class="t-stone-13" style="max-width:680px;margin:0 0 6px">Books, articles, and videos by people we admire \u2013 relevant to the work, written by others.</p>';
  h += '<div class="u-53a30b8">';
  for (var i = 0; i < WORTH_YOUR_TIME.length; i++) {
    var it = WORTH_YOUR_TIME[i];
    h += '<div class="insight-card" onclick="window.open(\'' + it.url + '\',\'_blank\')" title="Opens in a new tab">';
    h += '<div class="insight-card-header">';
    h += '<span class="insight-badge insight-badge--mono">' + esc(it.kind) + '</span>';
    h += '</div>';
    h += '<div class="insight-title">' + esc(it.title) + '</div>';
    h += '<div class="insight-date" style="white-space:normal">' + esc(it.by) + '</div>';
    h += '<div class="insight-excerpt">' + esc(it.desc) + '</div>';
    h += '<div class="insight-card-foot"><span class="insight-cta">' + esc(it.cta) + ' \u2192</span></div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// === SIDEBAR ===

// ============================================================
// VOICE
// ============================================================
var voiceActive = false, recognition = null, voiceTimeout = null;

/* ═══ READINESS OVERVIEW ═══ */
function vizTimeline(currentPhase) {
  var ranges = [{ id: 1, start: 0, end: 25 }, { id: 2, start: 26, end: 50 }, { id: 3, start: 51, end: 75 }, { id: 4, start: 76, end: 90 }].map(function (r) { var p = PH.find(function (x) { return x.id === r.id }) || {}; r.name = p.name; r.color = p.color; return r });
  var sd = new Date(data.startDate || new Date().toISOString().split('T')[0]); var today = new Date();
  var daysSince = Math.max(0, Math.floor((today - sd) / (1000 * 60 * 60 * 24))); var progress = Math.min(100, Math.max(0, (daysSince / 90) * 100));
  var phProg = function (pid) { var p = PH.find(function (x) { return x.id === pid }); if (!p) return 0; var ss = p.steps.filter(function (s) { return !INDIVIDUAL_TRACK_STEPS[s.id] }); var d = ss.filter(function (s) { return isStepDone(s.id) }).length; return ss.length ? Math.round(d / ss.length * 100) : 0 };
  var h = '<div class="mb-6"><div class="u-fc4d7a9">';
  h += '<div class="flx-row-mb-14"><div class="t-fade-sm" style="flex:1">Start Date: ' + fmtDate(sd) + '</div><div class="u-64f53f5" style="flex:1;text-align:center;color:var(--paper)">90-Day Timeline</div><div class="t-fade-sm" style="flex:1;text-align:right">Day ' + Math.min(90, daysSince) + ' of 90</div></div>';
  h += '<div class="flx mb-3">'; ranges.forEach(function (p) { var s0 = (p.start === 0 ? 0 : p.start - 1); var w = ((p.end - s0) / 90) * 100; h += '<div onclick="go(\'phase-' + p.id + '\')" class="pipe-tick" title="Open Phase ' + p.id + ': ' + esc(p.name) + '" style="--w:' + w + '%"><div style="font-size:11px;font-weight:700;color:' + (currentPhase === p.id ? p.color : 'var(--text-faint)') + '">' + p.name + '</div><div class="u-56f72fc">Days ' + (p.start === 0 ? 1 : p.start) + '\u2013' + p.end + '</div></div>' });
  h += '</div><div class="u-c2a178b">';
  ranges.forEach(function (p) { var s0 = (p.start === 0 ? 0 : p.start - 1); var left = (s0 / 90) * 100; var w = ((p.end - s0) / 90) * 100; if (s0 > 0) { left -= 0.15; w += 0.15; } var pp = phProg(p.id); h += '<div class="ph-bar-pos" data-pos="' + p.id + '" style="--left:' + left + '%;--w:' + w + '%"><div class="ph-fill" data-pos="' + p.id + '" data-full="' + (pp === 100 ? 1 : 0) + '" style="--w:' + pp + '%;--c:' + p.color + '"></div></div>' });
  h += '<div title="Today \u2013 day ' + Math.min(90, daysSince) + ' of 90 on the program clock" style="position:absolute;top:-3px;left:' + progress + '%;width:3px;height:16px;background:#333;border-radius:2px;z-index:3;transition:left .3s;cursor:help"></div></div>';
  h += '<div class="flx">'; ranges.forEach(function (p) { var s0 = (p.start === 0 ? 0 : p.start - 1); var w = ((p.end - s0) / 90) * 100; var pp = phProg(p.id); h += '<div onclick="go(\'phase-' + p.id + '\')" class="pipe-tick" title="Open Phase ' + p.id + ': ' + esc(p.name) + '" style="--w:' + w + '%"><div style="font-size:10px;color:' + (pp === 100 ? '#1B6B5A' : 'rgba(var(--faint-rgb),.7)') + ';font-weight:' + (pp === 100 ? 700 : 400) + '">' + pp + '%</div></div>' });
  h += '</div></div></div>'; return h
}
function vizStatStrip() {
  var leaders = (data.leaders || []).length;
  var roles = (data.orgChart || []).length;
  var _ms = mgSteps(); var stepsTotal = _ms.length; var stepsDone = _ms.filter(function (s) { return isStepDone(s.id) }).length;
  var sd = new Date(data.startDate || new Date().toISOString().split('T')[0]);
  var today = new Date();
  var daysElapsed = Math.max(0, Math.min(90, Math.floor((today - sd) / (1000 * 60 * 60 * 24))));
  var stats = [
    { n: daysElapsed, sub: 'of 90', l: 'Days Elapsed' },
    { n: leaders, l: 'Leaders Mapped' },
    { n: roles, l: 'Roles Defined' },
    { n: stepsDone + '/' + stepsTotal, l: 'Steps Complete' }
  ];
  var h = '<div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--stone);text-align:center;margin-bottom:10px">Module start date \u2014 ' + fmt(data.startDate || today) + '</div><div class="viz-stat-strip">';
  stats.forEach(function (s) {
    h += '<div class="viz-stat-cell">'
      + '<div class="viz-stat-num">' + s.n + (s.sub ? '<span class="viz-stat-sub">' + s.sub + '</span>' : '') + '</div>'
      + '<div class="viz-stat-lbl">' + s.l + '</div>'
      + '</div>';
  });
  return h + '</div>';
}
function renderOverview() {
  var h = '<div class="content-area"><div class="content-inner">';
  h += backBtn();
  // Module overview video (exec-module-overview.mp4 beside index.html)
  h += '<div class="overview-video-card mb-6"><div class="overview-video-label">Module Overview</div>'
    + '<video class="overview-video" controls preload="auto" playsinline><source src="../../../assets/media/exec-readiness/exec-module-overview.mp4" type="video/mp4">Your browser does not support embedded video.</video></div>';
  h += vizTimeline(0);
  /* the signed-in user's open assignments, under the 90-day timeline. Guarded: the
     function is the SHELL's (js/features/my-assignments.js) and this standalone
     review copy has no account menu to open the list from — the guard is what lets
     the one line be ported into js/modules/exec-readiness/steps.js unchanged. */
  if (typeof asgnOverviewCard === 'function') h += asgnOverviewCard();
  h += '<div class="u-4d06b89">' + badge('90-Day Module', '#1B6B5A') + '<h1 class="u-da9c7f5">Build Your Leadership <em class="t-blue">Readiness</em></h1><p class="u-c9b7d79">From standing start to operational leadership architecture in 90 days.</p></div>';
  h += vizStatStrip();
  // Phase cards (exemplar overview form; phase 5 routes to the module's dashboard page)
  PH.forEach(function (ph) {
    h += card('<div class="u-1390122" onclick="go(\'' + (ph.id === 5 ? 'phase5' : 'phase-' + ph.id) + '\')"><div><div class="flx-center gap-2 mb-1"><span class="ph-circle-28" style="--c:' + ph.color + '">' + ph.id + '</span><h3 class="u-a5b9245">' + ph.name + '</h3>' + badge(ph.days, ph.color) + '</div><div class="u-d9edac8">' + ph.steps.map(function (s) { return s.name }).join(' \u2192 ') + '</div></div><span class="u-ef4626c">\u2192</span></div>', 'margin-bottom:12px');
  });
  h += '</div></div>'; return h;
}

/* ═══ STEP SHELL ═══ */
function renderStep() {
  if (!currentStep || !currentPhase) return renderOverview();
  var ph = currentPhase; var stepObj = null;
  for (var j = 0; j < ph.steps.length; j++) { if (ph.steps[j].id === currentStep) { stepObj = ph.steps[j]; break } }
  if (!stepObj) return renderOverview();
  var _boardHost = (currentStep === '2.1' && (UI.structSec || 'ownership') === 'ownership') || (currentStep === '1.2' && UI.llPage === 'hierarchy');
  var h = '<div class="content-area"><div class="content-inner' + (_boardHost ? ' board-page' : '') + '">';
  // Back button + breadcrumb
  h += '<div class="u-79840ab">';
  h += backBtn();
  h += '<div class="u-463b2e1">Phase ' + ph.id + ' \u00B7 ' + ph.name + ' <span class="t-gold">/ ' + stepObj.name + '</span></div>';
  h += '</div>';
  // Step nav — two separate boxes: org steps and L&D steps
  var indivStepIds = { '1.4': 1, '2.4': 1, '3.5': 1, '4.4': 1 };
  var orgSteps = ph.steps.filter(function (s) { return !indivStepIds[s.id] });
  var ldevSteps = ph.steps.filter(function (s) { return !!indivStepIds[s.id] });
  h += '<div class="step-nav"' + (ldevSteps.length ? ' style="margin-bottom:12px"' : '') + '>';
  orgSteps.forEach(function (s) {
    var done = isStepDone(s.id);
    var navTarget = s.id === '5.1' ? 'phase5' : s.id;
    h += '<button class="step-nav-btn' + (currentStep === s.id ? ' active' : '') + (done ? ' done' : '') + '" onclick="go(\'' + navTarget + '\')">' + (done ? '\u2713 ' : s.icon + ' ') + s.name + '</button>'
  });
  h += '</div>';
  if (ldevSteps.length) {
    h += '<div style="display:flex;justify-content:flex-start;margin-bottom:32px">';
    h += '<div class="step-nav" style="margin-bottom:0;border-color:rgba(var(--gold-rgb),.3)">';
    h += '<div style="padding:10px 12px;font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:rgba(var(--gold-rgb),.7);text-transform:uppercase;border-right:1px solid rgba(var(--gold-rgb),.3)">L&D</div>';
    ldevSteps.forEach(function (s) {
      var done = isStepDone(s.id);
      h += '<button class="step-nav-btn' + (currentStep === s.id ? ' active' : '') + (done ? ' done' : '') + '" style="color:' + (currentStep === s.id ? 'var(--gold)' : done ? 'var(--ph1)' : 'rgba(var(--gold-rgb),.6)') + ';border-color:rgba(var(--gold-rgb),.3)" onclick="go(\'' + s.id + '\')">' + (done ? '\u2713 ' : '\u25C8 ') + s.name + '</button>'
    });
    h += '</div></div>';
  }
  // Pips
  h += '<div class="step-progress">';
  for (var j = 0; j < ph.steps.length; j++) { var s = ph.steps[j]; h += '<div class="step-pip' + (currentStep === s.id ? ' active' : isStepDone(s.id) ? ' done' : '') + '" title="' + esc(s.name) + '"></div>' }
  h += '</div>';
  // Header
  h += '<div class="step-header"><div class="step-eyebrow">Phase ' + ph.id + ' \u00B7 ' + ph.days + ' \u00B7 ' + ph.name + '</div>';
  h += '<h1 class="step-title">' + stepObj.icon + ' ' + stepObj.name + '</h1>';
  var indiv = { '1.4': 1, '2.4': 1, '3.5': 1, '4.4': 1, '5.3': 1 }, both = { '1.1': 1, '3.1': 1 };
  if (both[currentStep]) h += '<div style="margin-top:8px"><span class="tag tag-individual">Individual</span> <span class="tag tag-collective">Collective</span></div>';
  else if (indiv[currentStep]) h += '<div style="margin-top:8px"><span class="tag tag-individual">Individual</span></div>';
  else h += '<div style="margin-top:8px"><span class="tag tag-collective">Collective</span></div>';
  h += '</div>';
  // Video placeholder (skip for Phase 5 dashboard pages)
  if (ph.id !== 5) h += vp('ER-' + currentStep, 'Step ' + currentStep + ': ' + stepObj.name, '8\u201312 min');
  // Assignment bar for collective steps (not .4 individual steps)
  var indivStepIds2 = { '1.4': 1, '2.4': 1, '3.5': 1, '4.4': 1, '5.1': 1, '5.2': 1, '5.3': 1 };
  if (!indivStepIds2[currentStep]) h += stepAssignBar(currentStep);
  h += renderStepContent(currentStep);
  h += milestone(currentStep);
  var _wShared = ph.steps.filter(function (s) { return !INDIVIDUAL_TRACK_STEPS[s.id] });
  if (_wShared.length && _wShared[_wShared.length - 1].id === currentStep && _wShared.every(function (s) { return isStepDone(s.id) }) && PHASE_WRAPUPS[ph.id]) {
    h += '<div class="milestone-card"><div class="milestone-label">\u2713 Phase ' + ph.id + ' Complete</div><div class="milestone-text">' + PHASE_WRAPUPS[ph.id] + '</div></div>';
  }
  // Nav
  var allSteps = []; for (var i = 0; i < PH.length; i++)for (var j = 0; j < PH[i].steps.length; j++)allSteps.push(PH[i].steps[j]);
  var curIdx = allSteps.findIndex(function (s) { return s.id === currentStep });
  h += '<div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:24px;border-top:1px solid var(--rule)">';
  if (curIdx > 0) { var prev = allSteps[curIdx - 1]; h += btn('\u2190 ' + prev.name, 'go(\'' + prev.id + '\')', 'bg2') } else h += '<div></div>';
  if (curIdx < allSteps.length - 1) { var next = allSteps[curIdx + 1]; var _nt = next.id === '5.1' ? 'phase5' : next.id; h += btn(next.name + ' \u2192', 'go(\'' + _nt + '\')', 'bp') } else h += btn('Dashboard \u2192', 'go(\'phase5\')', 'bp');
  h += '</div></div></div>'; return h;
}

/* ═══ STEP CONTENT ROUTER ═══ */
function renderStepContentBody(id){
  if(id==='1.1')return renderStep11();
  if(id==='1.2')return renderStep12();
  if(id==='1.3')return renderStep13();
  if(id==='1.4')return renderStep14();
  if(id==='2.1')return renderStep21();
  if(id==='2.2')return renderStep22();
  if(id==='2.3')return renderStep23();
  if(id==='2.4')return renderStep24();
  if(id==='3.1')return renderStep31();
  if(id==='3.2')return renderStep32();
  if(id==='3.3')return renderStep33();
  if(id==='3.4')return renderStep34_values();
  if(id==='3.5')return renderStep35();
  if(id==='4.1')return renderStep41();
  if(id==='4.2')return renderStep42();
  if(id==='4.3')return renderStep43();
  if(id==='4.4')return renderStep44();
  if(id==='5.3')return renderLdevDashboard();
  if(id==='5.2')return renderLdevHub();
  var desc={};
  return card('<p style="font-size:14px;color:var(--stone);line-height:1.7">'+(desc[id]||'Coming soon.')+'</p><p style="font-size:13px;color:var(--stone);font-style:italic;margin-top:12px">Full interactive content coming next.</p>');
}

/* ═══ STEP CONTENT ROUTER ═══ */

/* ═══ STEP 1.1: Assessment Battery ═══ */
function renderStep11() {
  var a = data.assessments || {}; var co = data.completedSections || {}; var sec = UI.sec;
  var secs = [{ id: 'A', l: 'Purpose & Clarity', c: !!co.A }, { id: 'B', l: 'AI Fluency', c: !!co.B }, { id: 'C', l: 'Change Capacity', c: !!co.C }, { id: 'D', l: 'Structure Baseline', c: !!co.D }, { id: 'E', l: 'Ethical Readiness', c: !!co.E }];
  var allDone = secs.every(function (s) { return s.c });
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Assessment Battery</h2><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Five scored sections. Complete all to generate the Readiness Report.</p>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px">';
  secs.forEach(function (s) { h += '<button onclick="harvestFields();saveData();UI.sec=\'' + s.id + '\';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans);border:' + (sec === s.id ? '2px solid #1B6B5A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (s.c ? 'rgba(27,107,90,.08)' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (sec === s.id || s.c ? '#1B6B5A' : 'var(--text-body)') + '">' + (s.c ? '\u2713' : '\u25CB') + ' ' + s.l + '</button>' });
  h += '</div>';
  // Right-aligned note explaining the asterisk convention, shared across all sections.
  var reqNote = '<div style="display:flex;justify-content:flex-start;margin:-8px 0 14px"><div style="font-size:11px;color:var(--stone);font-style:italic;display:flex;align-items:center;gap:5px"><span style="color:var(--gold);font-style:normal">*</span>Questions marked with an asterisk must be completed in order to continue.</div></div>';

  if (sec === 'A') {
    var p = a.purpose || {};
    h += card('<h3 class="h-sub">A: Strategic Clarity & Purpose Alignment</h3><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">How clearly your organization\u2019s purpose is articulated, and how directly your AI strategy is connected to it.</p>' + reqNote + ta('Mission statement *', 'ap_mission', p.mission, 'What does your organization exist to do?', 3) + ta('Top 3 strategic priorities', 'ap_priorities', p.priorities, 'List your three priorities', 3) + ta('Current AI strategy', 'ap_aiStrategy', p.aiStrategy, 'Your current approach to AI', 3) + likert('Purpose clarity *', 'assessments.purpose.clarity', p.clarity, 'Very unclear', 'Very clear') + likert('AI-purpose alignment *', 'assessments.purpose.aiAlignment', p.aiAlignment, 'No connection', 'Clearly connected') + likert('Strategic coherence *', 'assessments.purpose.coherence', p.coherence, 'Competing', 'Fully aligned') + doneBtn('saveSection(\'A\')', !(p.mission && p.clarity && p.aiAlignment && p.coherence), null, co.A === true))
  }

  if (sec === 'B') {
    var f = a.fluency || {};
    h += card('<h3 class="h-sub">B: AI Fluency</h3><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Your organization\u2019s understanding of AI capabilities, limitations, and failure modes.</p>' + reqNote + likert('Foundational understanding *', 'assessments.fluency.foundational', f.foundational, 'None', 'Expert') + likert('Failure mode awareness *', 'assessments.fluency.failureModes', f.failureModes, 'Unaware', 'Deep') + likert('Cost/risk understanding', 'assessments.fluency.costRisk', f.costRisk, 'None', 'Strong') + likert('Strategic connection *', 'assessments.fluency.strategic', f.strategic, 'Not at all', 'Clearly') + likert('Hands-on experience *', 'assessments.fluency.handsOn', f.handsOn, 'None', 'Daily') + sel('Senior executive engagement level', 'af_engagement', f.engagement, [{ v: '', l: 'Select\u2026' }, { v: 'none', l: 'None' }, { v: 'delegated', l: 'Delegated' }, { v: 'occasional', l: 'Occasional' }, { v: 'regular', l: 'Regular' }, { v: 'deep', l: 'Deep integration' }], 'This asks how directly your senior executive team works with AI tools \u2014 from never touching them to integrating them deeply into their own work \u2014 rather than how much your organization as a whole uses AI.') + ta('AI tools used', 'af_tools', f.tools, 'Which tools? What was the experience?', 3) + doneBtn('saveSection(\'B\')', !(f.foundational && f.failureModes && f.strategic && f.handsOn), null, co.B === true))
  }

  if (sec === 'C') {
    var c = a.change || {};
    h += card('<h3 class="h-sub">C: Change Leadership Capacity</h3><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Assess your organization\u2019s past experience and current resources for managing large-scale change initiatives.</p>' + reqNote + likert('Track record *', 'assessments.change.trackRecord', c.trackRecord, 'Poor', 'Excellent', 'How successfully has your organization delivered major change initiatives in the past?') + likert('Change fatigue *', 'assessments.change.fatigue', c.fatigue, 'Severe', 'None', 'How much capacity for further change does your workforce have right now, given everything they have already absorbed?') + likert('Middle mgmt health *', 'assessments.change.middleMgmt', c.middleMgmt, 'Disengaged', 'Engaged', 'Are your middle managers \u2014 the people who make or break execution \u2014 engaged and equipped to carry change, or stretched and checked out?') + likert('Psychological safety *', 'assessments.change.psySafety', c.psySafety, 'Not safe', 'Very safe', 'Can people raise concerns, admit mistakes, and challenge decisions without fear of being penalized?') + likert('Learning culture *', 'assessments.change.learningCulture', c.learningCulture, 'Defaults to habit', 'Learns from evidence', 'How readily does your organization learn from evidence and adapt, rather than defaulting to habit or opinion?') + ta('Recent change initiative', 'ac_recentChange', c.recentChange, 'Describe initiative, outcome, lessons', 4) + doneBtn('saveSection(\'C\')', !(c.trackRecord && c.fatigue && c.middleMgmt && c.psySafety && c.learningCulture), null, co.C === true))
  }

  if (sec === 'D') {
    var d = a.structure || {};
    h += card('<h3 class="h-sub">D: Leadership Structure Baseline</h3><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Your current architecture for AI transformation. This feeds into the Leadership Structure Lab in Phase 2.</p>' + reqNote + sel('Who currently owns AI transformation? *', 'ad_ownership', d.ownership, [{ v: '', l: 'Select one\u2026' }, { v: 'cio', l: 'Chief Information Officer (CIO)' }, { v: 'cto', l: 'Chief Technology Officer (CTO)' }, { v: 'ceo', l: 'Chief Executive Officer (CEO)' }, { v: 'cao', l: 'Chief AI Officer (CAO)' }, { v: 'cdo', l: 'Chief Data Officer (CDO)' }, { v: 'ctro', l: 'Chief Transformation Officer (CTrO)' }, { v: 'cino', l: 'Chief Innovation Officer (CINO)' }, { v: 'cito', l: 'Chief Innovation & Transformation Officer (CITO)' }, { v: 'distributed', l: 'Distributed across C-suite (no single owner)' }, { v: 'nobody', l: 'Nobody \u2014 no formal ownership' }, { v: 'adhoc', l: 'Ad hoc \u2014 varies by project' }, { v: 'other', l: 'Other (please specify)' }], null, 'var w=document.getElementById(\'ad_ownershipOtherWrap\');if(w)w.style.display=(this.value===\'other\'?\'block\':\'none\')') + adOtherBox('ownership', d.ownershipOther, d.ownership === 'other') + sel('Board-level AI oversight *', 'ad_boardOversight', d.boardOversight, [{ v: '', l: 'Select one\u2026' }, { v: 'dedicated', l: 'Yes \u2014 dedicated AI/technology committee' }, { v: 'shared', l: 'Yes \u2014 shared with another committee' }, { v: 'none', l: 'No formal board oversight of AI' }, { v: 'unknown', l: 'Don\u2019t know' }, { v: 'other', l: 'Other (please specify)' }], null, 'var w=document.getElementById(\'ad_boardOversightOtherWrap\');if(w)w.style.display=(this.value===\'other\'?\'block\':\'none\')') + adOtherBox('boardOversight', d.boardOversightOther, d.boardOversight === 'other') + sel('Cross-functional innovation/transformation body', 'ad_crossFunc', d.crossFunc, [{ v: '', l: 'Select one\u2026' }, { v: 'active', l: 'Exists and actively meeting' }, { v: 'dormant', l: 'Exists but dormant' }, { v: 'none', l: 'Does not exist' }, { v: 'other', l: 'Other (please specify)' }], null, 'var w=document.getElementById(\'ad_crossFuncOtherWrap\');if(w)w.style.display=(this.value===\'other\'?\'block\':\'none\')') + adOtherBox('crossFunc', d.crossFuncOther, d.crossFunc === 'other') + ta('AI decision-making structure', 'ad_decisionStructure', d.decisionStructure, 'Who currently approves AI investments, reviews progress, and can halt projects?', 4) + ta('Structural gaps identified', 'ad_gaps', d.gaps, 'What\u2019s missing in the current leadership structure for AI?', 3) + likert('Cross-functional collaboration on AI *', 'assessments.structure.crossCollab', d.crossCollab, 'Competing silos', 'Fully coordinating') + likert('Middle management role in AI decisions', 'assessments.structure.mmRole', d.mmRole, 'Excluded entirely', 'Empowered to decide') + doneBtn('saveSection(\'D\')', !(d.ownership && d.boardOversight && d.crossCollab), null, co.D === true))
  }

  if (sec === 'E') {
    var e = a.ethical || {};
    h += card('<h3 class="h-sub">E: Ethical & Philosophical Readiness</h3><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Foundational questions about identity, evidence standards, ethical commitments, and the assumptions embedded in your AI tools.</p>' + reqNote + recBox('rr_eth_phil', 'Great Leaders Question Philosophical Assumptions', 'Faisal Hoque, Paul Scade, Pranay Sanklecha, and Sverre Spoelstra', 'Harvard Business Review', 'https://faisalhoque.com/great-leaders-question-philosophical-assumptions/', 'Identifies three philosophical domains \u2014 ontology, epistemology, and ethics \u2014 and shows why surfacing assumptions in each is essential to AI-era leadership.', '', 'READ BEFORE COMPLETING') + likert('Core identity *', 'assessments.ethical.identity', e.identity, 'Cannot articulate', 'Clear') + likert('Evidence standards *', 'assessments.ethical.evidence', e.evidence, 'Never examined', 'Clearly specified') + likert('Ethical commitments *', 'assessments.ethical.commitments', e.commitments, 'None', 'Strong') + likert('Embedded assumptions *', 'assessments.ethical.assumptions', e.assumptions, 'Cannot identify', 'Clearly identified') + sel('Workforce approach', 'ae_workforce', e.workforce, [{ v: '', l: 'Select\u2026' }, { v: 'automate_reduce', l: 'Automate & reduce' }, { v: 'augment_redeploy', l: 'Augment & redeploy' }, { v: 'augment_grow', l: 'Augment & grow' }, { v: 'undecided', l: 'Undecided' }], 'As AI capability grows, what is your long-term intent for your workforce \u2014 to reduce headcount, redeploy people into new roles, or grow the organization\u2019s overall capacity?') + ta('Ethical lines', 'ae_lines', e.lines, 'What would you refuse to do even at cost?', 4) + doneBtn('saveSection(\'E\')', !(e.identity && e.evidence && e.commitments && e.assumptions), null, co.E === true))
  }

  if (allDone) h += '<div class="milestone-card"><div class="milestone-label">\u2713 Battery Complete</div><div class="milestone-text">All five sections scored. Readiness Report available.</div></div>';
  // Discrete step completion (ruled 25 July): sections no longer auto-complete the step.
  if (allDone || isStepDone('1.1')) h += doneBtn('markStepComplete(\'1.1\')', false, null, '1.1');
  return h;
}

function saveSection(secId) {
  if (lockBlocked('assessments')) return; if (!confirmSectionDone(secId)) return;
  harvestFields();
  if (!data.assessments) data.assessments = {};
  if (secId === 'A') { if (!data.assessments.purpose) data.assessments.purpose = {};['mission', 'priorities', 'aiStrategy'].forEach(function (f) { var v = val('ap_' + f); if (v) data.assessments.purpose[f] = v }) }
  if (secId === 'B') { if (!data.assessments.fluency) data.assessments.fluency = {}; data.assessments.fluency.engagement = val('af_engagement'); data.assessments.fluency.tools = val('af_tools') }
  if (secId === 'C') { if (!data.assessments.change) data.assessments.change = {}; data.assessments.change.recentChange = val('ac_recentChange') }
  if (secId === 'D') { if (!data.assessments.structure) data.assessments.structure = {};['ownership', 'ownershipOther', 'boardOversight', 'boardOversightOther', 'crossFunc', 'crossFuncOther', 'decisionStructure', 'gaps'].forEach(function (f) { var v = val('ad_' + f); if (v) data.assessments.structure[f] = v }) }
  if (secId === 'E') { if (!data.assessments.ethical) data.assessments.ethical = {}; data.assessments.ethical.workforce = val('ae_workforce'); data.assessments.ethical.lines = val('ae_lines') }
  if (!data.completedSections) data.completedSections = {};
  data.completedSections[secId] = true;
  var order = ['A', 'B', 'C', 'D', 'E']; var idx = order.indexOf(secId);
  if (idx < order.length - 1) UI.sec = order[idx + 1];
  // Ruled 25 July: sections never complete the step. The discrete Step Complete button
  // (markStepComplete('1.1')) owns completion, the done-date stamp, and the team email.
  // (The old line here was also an unbraced if — stampStepDone fired on EVERY section save.)
  saveData(); render();
}

/* ═══ STEP 1.2: Leadership Landscape ═══ */
function llTabs() {
  var page = UI.llPage || 'inventory';
  var leaders = data.leaders || [];
  var canHierarchy = leaders.length >= 2;
  var h = '<div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">';
  h += '<button class="sec-tab" data-sel="' + (page === 'inventory' ? '1' : '0') + '" onclick="saveLandscapeNotes();UI.llPage=\'inventory\';render()">Leadership Inventory</button>';
  if (canHierarchy) {
    h += '<button class="sec-tab" data-sel="' + (page === 'hierarchy' ? '1' : '0') + '" onclick="saveLandscapeNotes();UI.llPage=\'hierarchy\';render()">Assign Hierarchy</button>';
  } else {
    h += '<button class="sec-tab" data-sel="0" disabled title="Map at least 2 leaders first" style="opacity:.45;cursor:not-allowed">Assign Hierarchy</button>';
  }
  h += '</div>';
  return h;
}
function renderStep12() {
  if (!UI.llPage) UI.llPage = 'inventory';
  // If hierarchy was selected but leaders dropped below 2, fall back to inventory.
  if (UI.llPage === 'hierarchy' && (data.leaders || []).length < 2) UI.llPage = 'inventory';
  if (UI.llPage === 'hierarchy') return renderStep12Hierarchy();
  return renderStep12Inventory();
}
function renderStep12Inventory() {
  var leaders = data.leaders || []; var done12 = isStepDone('1.2');
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Landscape</h2><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Map every senior leader involved in or affected by AI transformation. Document each leader\u2019s role, AI fluency, engagement, change leadership experience, bandwidth, and scope of impact. Then complete the two assessments below: the transformation ownership gap and the role of middle management.</p>';
  h += llTabs();
  if (leaders.length) {
    h += '<div style="font-family:var(--mono);font-size:11px;color:var(--gold);margin-bottom:12px">' + leaders.length + ' leader' + (leaders.length !== 1 ? 's' : '') + ' mapped</div>';
    leaders.forEach(function (l, i) {
      var ec = l.engagement === 'active' ? '#1B6B5A' : l.engagement === 'developing' ? '#4E7FA6' : 'var(--text-body)';
      h += card('<div style="display:flex;justify-content:space-between;cursor:pointer" onclick="UI.editIdx=' + i + ';UI.addForm=true;UI.scrollTo=\'leaderEditCard\';render()" title="Click to edit"><div><div style="font-size:15px;font-weight:600">' + esc(l.name || 'Unnamed') + '</div><div style="font-size:13px;color:var(--stone)">' + esc(leaderRoleName(l)) + '</div></div><div style="display:flex;gap:6px">' + (l.fluency ? badge('Fluency: ' + l.fluency + '/5', '#2D5A8E') : '') + (l.engagement ? badge(l.engagement === 'active' ? 'Active' : l.engagement === 'developing' ? 'Developing' : 'Not yet', ec) : '') + '</div></div>' + leaderLinkControl(l));
      if (UI.addForm && UI.editIdx === i) h += '<div id="leaderEditCard">' + leaderEditCard() + '</div>';
    });
  } else h += card('<div style="text-align:center;padding:32px"><p style="color:var(--stone)">No leaders mapped yet. Add your first leader profile below.</p></div>');
  if (UI.addForm && UI.editIdx === null) h += leaderEditCard();
  else if (!UI.addForm) h += '<div style="margin-top:12px">' + btn('+ Add Leader', 'UI.addForm=true;UI.editIdx=null;render()', 'bp') + '</div>';
  // Transformation ownership gap
  h += card('<h3 class="h-sub-lg">Transformation Ownership Gap</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Most organizations have a structural gap between technology management (which the Chief Information Officer or Chief Technology Officer handles) and the strategic, cultural, and organizational work of AI transformation. Based on the landscape above, does someone in your organization currently combine <strong style="color:var(--paper)">technical expertise</strong>, <strong style="color:var(--paper)">cultural leadership</strong>, and <strong style="color:var(--paper)">strategic vision</strong> for AI?</p><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">The emerging role landscape includes the Chief AI Officer, Chief Data Officer, Chief Transformation Officer, Chief Innovation Officer, and the proposed Chief Innovation & Transformation Officer \u2014 a function that bridges the gap between operational IT and enterprise-wide transformation.</p>' + recBox('rr_own', 'Why AI Demands a New Breed of Leaders', 'Faisal Hoque, Thomas H. Davenport, and Erik Nelson', 'MIT Sloan Management Review', 'https://faisalhoque.com/why-ai-demands-a-new-breed-of-leaders/', 'Introduces the CITO concept and maps the structural gap between technology management and transformation leadership.') + ta('Who currently fills this role in your organization? If nobody, describe the gap.', 'll_ownershipGap', (data.landscapeNotes || {}).ownershipGap, 'e.g. Our CIO handles technology decisions but nobody owns the cultural and organizational dimensions\u2026', 4), 'margin-top:24px');
  // Middle management — separate card
  h += card('<h3 class="h-sub-lg">Middle Management Assessment</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Middle managers are the connective tissue of an organization. They translate strategy into execution, exercise daily judgment, maintain institutional knowledge, and protect the ethical boundaries that automated systems cannot. Yet many AI transformation programs treat middle management as a mechanical layer to be automated away.</p><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">This assessment asks: is your organization\u2019s middle management layer being positioned as <strong style="color:var(--paper)">a cost to be eliminated</strong>, or as <strong style="color:var(--paper)">the judgment and ethics layer</strong> that your AI systems will depend on? The answer shapes how you design your leadership structure in Phase 2.</p>' + recBox('rr_mm', 'The Looming AI Risk: Automating Middle Management Destroys a Critical Ethical Layer', 'Faisal Hoque, Pranay Sanklecha, and Paul Scade', 'I by IMD', 'https://www.imd.org/ibyimd/artificial-intelligence/the-looming-ai-risk-automating-middle-management-destroys-critical-ethical-layer/', 'Examines the special duties of middle managers and the catastrophic consequences of eliminating human judgment from operational decisions.') + ta('What is the current state of middle management\u2019s role in AI-related decisions in your organization?', 'll_mmAssessment', (data.landscapeNotes || {}).mmAssessment, 'Is middle management being treated as execution to be automated, or as the critical judgment layer? What decisions do they currently make that should not be automated?', 4), 'margin-top:16px');
  // Mark complete + milestone
  // Mark complete: always show the button; disabled until >=2 leaders mapped
  h += doneBtn('if(!confirmStepDone(\'1.2\'))return;data.completedSteps[\'1.2\']=true;stampStepDone(\'1.2\');saveLandscapeNotes();UI.llPage=\'hierarchy\';saveData();render()', leaders.length < 2, null, '1.2', 'Map at least 2 leaders to complete this step.');
  return h;
}
function reportingChartAndControls(){
  var leaders=data.leaders||[];
  syncPhase1Chart();
  var roles=data.orgChart||[];
  var h='';
  // If adding/editing a role from this step, show the shared role form (same as dashboard).

  // --- Org chart (built from reporting lines) ---
  var layout=layoutOrgTreeScreen(roles);var pos=layout.pos; /* 16 Sep 2026 (Paul's ruling): the fitted layout and two-line titles, as on paper and the dashboard */
  if(!UI.llZoom)UI.llZoom=1;
  h+='<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">';
  h+='<button onclick="UI.llZoom=Math.min(2,(UI.llZoom||1)+0.2);render()" title="Zoom in" style="width:30px;height:30px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:16px;cursor:pointer;font-family:var(--sans)">+</button>';
  h+='<button onclick="UI.llZoom=Math.max(0.3,(UI.llZoom||1)-0.2);render()" title="Zoom out" style="width:30px;height:30px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:16px;cursor:pointer;font-family:var(--sans)">&minus;</button>';
  h+='<button onclick="UI.llZoom=1;render()" title="Reset to 100%" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono)">Reset</button>';
  h+='<span style="font-family:var(--mono);font-size:11px;color:var(--stone)">'+Math.round(UI.llZoom*100)+'%</span>';
  h+='<button onclick="var el=document.getElementById(\'llChartWrap\');if(el){if(el.requestFullscreen)el.requestFullscreen();else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();else if(el.msRequestFullscreen)el.msRequestFullscreen()}" title="View the chart fullscreen" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono);letter-spacing:.06em">\u26F6 FULLSCREEN</button>';
  h+='</div>';
  var natW=layout.tw+40,natH=layout.th+40;
  var _fz=Math.max(0,layout.tw-(layout.treeW||layout.tw));var _vx=-20-_fz,_vw=natW+_fz;
  h+='<div class="org-board" style="margin-bottom:24px"><div id="llChartWrap" class="org-board-canvas">';
  if(Math.abs((UI.llZoom||1)-1)<0.01){
    h+='<svg style="width:100%;max-width:'+_vw+'px;min-width:'+Math.round(_vw*0.55)+'px;height:auto;display:block;margin:0 auto" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }else{
    var zw=Math.round(natW*UI.llZoom);var zh=Math.round(natH*UI.llZoom);
    h+='<svg width="'+zw+'" height="'+zh+'" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }
  layout.lines.forEach(function(d){h+='<path d="'+d+'" fill="none" stroke="rgba(245,242,236,.18)" stroke-width="1.5"/>'});
  roles.forEach(function(r){var p=pos[r.id];if(!p)return;h+=orgChartNodeSvg(r,p,{interactive:false})}); /* 16 Sep 2026 (Paul's ruling): the dashboard's node — neutral border, the level's colour in the top bar, the initials, Unassigned in italics — so the two charts reflect each other */
  h+='</svg></div></div>';

  // --- Role structure list: per role, set its parent (reporting) and its occupant ---
  h+='<div style="font-family:var(--mono);font-size:11px;color:var(--gold);letter-spacing:.06em;margin-bottom:12px">ROLE STRUCTURE &amp; OCCUPANTS</div>';
  var editableRoles=roles.filter(function(r){return r.id!=='board';});
  if(!editableRoles.length){
    h+=card('<div style="text-align:center;padding:24px;color:var(--stone)">No roles yet. Add leaders on the Leadership Inventory tab (each becomes a role), or use Add Role for a vacant role.</div>');
  } else {
    editableRoles.forEach(function(r){
      var occ=roleOccupant(r);
      // Parent (reporting) dropdown — other roles + board, excluding self.
      var popts='<option value="board"'+((!r.parentId||r.parentId==='board')?' selected':'')+'>Board (top level)</option>';
      roles.forEach(function(other){
        if(other.id===r.id||other.id==='board')return;
        popts+='<option value="'+esc(other.id)+'"'+(r.parentId===other.id?' selected':'')+'>'+esc(other.name||'Role')+'</option>';
      });
      // Occupant dropdown — all leaders + unassigned. Autofills current occupant.
      var oopts='<option value="">\u2014 vacant \u2014</option>';
      leaders.forEach(function(l){
        oopts+='<option value="'+esc(l.id)+'"'+((r.occupantLeaderId||(occ||{}).id)===l.id?' selected':'')+'>'+esc(l.name)+' \u2014 '+esc(leaderRoleName(l))+'</option>';
      });
      h+='<div style="padding:12px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:8px">';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="font-size:14px;font-weight:600;color:var(--paper);flex:1">'+esc(r.name||'Role')+(occ?'':' <span style="font-family:var(--mono);font-size:10px;color:var(--stone);font-weight:400">\u00B7 vacant</span>')+'</div><button onclick="UI.orgEditId=\''+r.id+'\';UI.orgAddForm=false;UI.orgSelected=null;UI.scrollTo=\'orgEditCard\';render()" style="padding:4px 10px;font-size:11px;font-family:var(--mono);background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;color:var(--stone);cursor:pointer">Edit role</button></div>';
      h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
      h+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--text-body)">reports to</span>';
      h+='<select class="assign-sel" onchange="assignRoleParent(\''+r.id+'\',this.value)" style="padding:6px 10px;background:rgba(var(--fg-rgb),.06);border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:13px;font-family:var(--sans);max-width:220px">'+popts+'</select></div>';
      h+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--text-body)">occupied by</span>';
      h+='<select class="assign-sel" id="or_qa12_'+r.id+'" onchange="quickAssignOrg(\''+r.id+'\',this.value)" style="padding:6px 10px;background:rgba(var(--fg-rgb),.06);border:1px solid '+(occ?'rgba(27,107,90,.4)':'rgba(var(--fg-rgb),.12)')+';border-radius:6px;font-size:13px;font-family:var(--sans);max-width:220px">'+oopts+'</select></div>';
      h+='</div></div>';
      if(UI.orgEditId===r.id)h+='<div id="orgEditCard">'+renderOrgForm(r,roles,leaders)+'</div>';
    });
  }
  // Add Role (vacant) — same creation path as the dashboard.
  h+='<div style="margin-top:4px">'+btn('+ Add Role','UI.orgAddForm=true;UI.orgEditId=null;UI.orgSelected=null;UI.scrollTo=\'orgAddCard\';render()','bp')+'</div>';
  // Ruled 25 July: the Add Role form opens in the button's slot, below it, not above the chart.
  if(UI.orgAddForm&&!UI.orgEditId){h+='<div id="orgAddCard">'+renderOrgForm(null,roles,leaders)+'</div>';}

  return h;
}
function renderStep12Hierarchy() {
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Landscape</h2><p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Arrange your inventoried leaders into reporting relationships. The board sits at the top. Set who each leader reports to, and the chart updates automatically.</p>';
  h += llTabs();
  h += reportingChartAndControls();
  return h;
}
function nextLeaderId() {
  // Stable, unique id for a leader so reporting links survive reorder/delete.
  if (!data._leaderSeq) data._leaderSeq = 0;
  data._leaderSeq++;
  return 'L' + Date.now().toString(36) + '_' + data._leaderSeq;
}
// Per-leader login-link control: a dropdown to associate a roster user with this
// leader (for the individual development track), plus a light provenance note.
// Used in the inventory leader list and, cloned, in the individual-track entry gate.
function leaderLinkControl(l) {
  var linkedUser = l.userId ? USERS.find(function (u) { return u.id === l.userId; }) : null;
  var isMe = (typeof currentUserId !== 'undefined' && currentUserId && l.userId === currentUserId);
  var opts = '<option value="">\u2014 not linked \u2014</option>';
  USERS.forEach(function (u) {
    opts += '<option value="' + esc(u.id) + '"' + (l.userId === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>';
  });
  var by = null;
  if (l.userId && l.userLinkBy) { var bu = USERS.find(function (u) { return u.id === l.userLinkBy; }); by = bu ? bu.name : null; }
  var h = '<div onclick="event.stopPropagation()" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(var(--fg-rgb),.06);display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  h += '<span style="font-family:var(--mono);font-size:10px;color:var(--stone);text-transform:uppercase;letter-spacing:.07em">Individual track login</span>';
  h += '<select class="assign-sel" onchange="linkUserToLeader(\'' + l.id + '\',this.value,(typeof currentUserId!==\'undefined\'?currentUserId:null));render()" style="padding:5px 10px;background:rgba(var(--fg-rgb),.06);border:1px solid ' + (l.userId ? 'rgba(27,107,90,.4)' : 'rgba(var(--fg-rgb),.12)') + ';border-radius:6px;font-size:12px;font-family:var(--sans);color:var(--paper)">' + opts + '</select>';
  if (isMe) h += '<span style="font-family:var(--mono);font-size:10px;color:#1B6B5A">\u2713 you</span>';
  if (by) h += '<span style="font-size:10px;color:var(--stone)">linked by ' + esc(by) + '</span>';
  h += '</div>';
  return h;
}
// A compact list of all leaders, each with its login-link control — reused as the
// self-association picker in the individual-track entry gate.
function leaderLinkList() {
  var leaders = data.leaders || [];
  if (!leaders.length) return '<div style="font-size:13px;color:var(--stone);padding:16px">No leaders have been mapped yet. They are added in the Leadership Landscape (Leadership Inventory).</div>';
  var h = '';
  leaders.forEach(function (l) {
    h += '<div style="padding:12px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:8px">';
    h += '<div style="font-size:14px;font-weight:600;color:var(--paper)">' + esc(l.name || 'Unnamed') + '</div><div style="font-size:12px;color:var(--stone)">' + esc(leaderRoleName(l)) + '</div>';
    h += leaderLinkControl(l);
    h += '</div>';
  });
  return h;
}
// Entry gate for individual-track steps: if the logged-in user isn't linked to a
// leader, returns a prompt + the self-association picker; otherwise returns null.
function indivGate(stepLabel) {
  if (getMyLeader()) return null;
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">' + esc(stepLabel) + '</h2>';
  h += '<div style="margin:16px 0;padding:18px 20px;background:rgba(var(--gold-rgb),.06);border:1px solid rgba(var(--gold-rgb),.25);border-radius:10px">';
  h += '<div style="font-size:15px;font-weight:600;color:var(--paper);margin-bottom:6px">Connect your account to your leader profile</div>';
  h += '<p style="font-size:14px;color:var(--text-body);line-height:1.6;margin:0">The individual development track is personal to you. Find yourself in the list below and link your account, so your work is saved to your own profile. You can change this later in the Leadership Landscape.</p>';
  h += '</div>';
  h += leaderLinkList();
  return h;
}
function leaderFormFields(ed) {
  ed = ed || { name: '', role: '', fluency: '', changeExp: '', bandwidth: '', engagement: '', scope: '' };
  // Model B: role is the box the leader occupies, chosen from existing roles. The
  // dropdown lists current roles (+ Unassigned, + Create new role). On edit, it
  // pre-selects the role this leader currently occupies.
  var chart = (data.orgChart || []);
  var curRole = ed.id ? leaderOccupiedRole(ed) : null;
  var curId = curRole ? curRole.id : '__unassigned__';
  var roleOpts = '<option value="__unassigned__"' + (curId === '__unassigned__' ? ' selected' : '') + '>Unassigned</option>';
  chart.forEach(function (r) {
    if (r.id === 'board') return;
    roleOpts += '<option value="' + esc(r.id) + '"' + (curId === r.id ? ' selected' : '') + '>' + esc(r.name || 'Untitled role') + (roleHasOccupant(r) && !(curRole && curRole.id === r.id) ? ' (currently filled)' : '') + '</option>';
  });
  roleOpts += '<option value="__new__">+ Create new role\u2026</option>';
  var roleField = '<div style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Role &amp; function *</label>'
    + '<select id="ldr_roleSel" onchange="document.getElementById(\'ldr_newRoleWrap\').style.display=(this.value===\'__new__\'?\'block\':\'none\')" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);box-sizing:border-box;background:#fff;color:#1a1612">' + roleOpts + '</select>'
    + '<div id="ldr_newRoleWrap" style="display:none;margin-top:8px"><input id="ldr_newRoleName" type="text" placeholder="Name the new role, e.g. VP Customer Success" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);box-sizing:border-box"></div>'
    + '<div style="font-size:11px;color:var(--stone);margin-top:6px">A leader\u2019s title is the role they occupy. Pick an existing role, leave them Unassigned, or create a new one.</div></div>';
  return ta('Name *', 'ldr_name', ed.name, 'Full name', 1)
    + roleField
    + sel('AI fluency assessment', 'ldr_fluency', ed.fluency, [{ v: '', l: 'Select one\u2026' }, { v: '1', l: '1 \u2014 No understanding' }, { v: '2', l: '2 \u2014 Basic awareness' }, { v: '3', l: '3 \u2014 Working understanding' }, { v: '4', l: '4 \u2014 Strong command' }, { v: '5', l: '5 \u2014 Expert' }])
    + sel('Engagement level', 'ldr_engagement', ed.engagement, [{ v: '', l: 'Select one\u2026' }, { v: 'active', l: 'Actively engaged with AI transformation' }, { v: 'developing', l: 'Developing engagement' }, { v: 'notyet', l: 'Not yet engaged' }])
    + sel('Scope of impact', 'ldr_scope', ed.scope, [{ v: '', l: 'Select one\u2026' }, { v: 'org', l: 'Organization-wide' }, { v: 'dept', l: 'Departmental' }, { v: 'team', l: 'Team-level' }])
    + ta('Change leadership experience', 'ldr_changeExp', ed.changeExp, 'Key transformations led or participated in', 2)
    + sel('Current bandwidth', 'ldr_bandwidth', ed.bandwidth, [{ v: '', l: 'Select one\u2026' }, { v: 'overloaded', l: 'Overloaded \u2014 no capacity for new work' }, { v: 'stretched', l: 'Stretched \u2014 limited capacity' }, { v: 'manageable', l: 'Manageable \u2014 some capacity' }, { v: 'available', l: 'Available \u2014 good capacity' }]);
}
// ── Board AI expertise (ruled 25 July) ─────────────────────────────
// Expertise attaches to a board MEMBER, not to a free textarea. It lives on the
// member entry inside the orgChart board node (externals have no stable id, so a
// side map would break on removal; on the entry it travels with the member and
// removeBoardMember cleans it up automatically). The editor's or_ ids put it under
// the orgChart lock. Legacy structure.boardExpertise blobs stay inert; displays
// fall back to them only when no member carries expertise.
function boardExpertiseSummary() {
  var b = (data.orgChart || []).find(function (x) { return x.id === 'board' });
  var leaders = data.leaders || []; var byId = {}; leaders.forEach(function (l) { if (l.id) byId[l.id] = l; });
  return ((b && b.members) || []).filter(function (m) { return m.aiExpertise }).map(function (m) {
    var nm = m.type === 'leader' ? ((byId[m.id] || {}).name || 'Leader') : (m.name || 'External');
    return nm + ' \u2014 ' + m.aiExpertise;
  }).join('; ');
}
function bexpSet(i, state) {
  var b = (data.orgChart || []).find(function (x) { return x.id === 'board' });
  var m = b && (b.members || [])[i]; if (!m) return;
  if (lockBlocked('orgChart')) return;
  if (state === 'no') { m.aiExpState = 'no'; m.aiExpertise = ''; }
  else { m.aiExpState = 'has'; }
  saveData(); render();
}
function bexpSave(i) {
  var el = $('or_bexpText' + i); if (!el) return;
  var b = (data.orgChart || []).find(function (x) { return x.id === 'board' });
  var m = b && (b.members || [])[i]; if (!m) return;
  if ((m.aiExpertise || '') === el.value) return;          // unchanged: no write, no lock noise
  if (lockBlocked('orgChart')) return;
  m.aiExpertise = el.value; saveData();
}
function boardExpertisePicker() {
  var b = (data.orgChart || []).find(function (x) { return x.id === 'board' });
  var members = (b && b.members) || [];
  var leaders = data.leaders || []; var byId = {}; leaders.forEach(function (l) { if (l.id) byId[l.id] = l; });
  var h = '<div class="mb-4"><label class="form-label">Board AI expertise: Which directors currently have AI knowledge?</label>';
  if (!members.length) {
    h += '<div style="padding:12px 14px;border:1px dashed rgba(var(--fg-rgb),.15);border-radius:8px;font-size:13px;color:var(--text-body)">Add board members above first \u2014 AI expertise attaches to a member.</div></div>';
    return h;
  }
  members.forEach(function (m, i) {
    var nm = m.type === 'leader' ? ((byId[m.id] || {}).name || 'Leader') : (m.name || 'External');
    var ti = m.type === 'leader' ? ((byId[m.id] || {}).title || '') : (m.title || '');
    var st = m.aiExpState || (m.aiExpertise ? 'has' : '');
    h += '<div style="padding-left:14px;margin-bottom:10px">';
    h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    h += '<div style="flex:1;min-width:180px"><span style="font-size:13px;font-weight:600;color:var(--paper)">' + esc(nm) + '</span>' + (ti ? ' <span style="font-size:12px;color:var(--text-body)">' + esc(ti) + '</span>' : '') + '</div>';
    h += '<button onclick="bexpSet(' + i + ',\'has\')" style="padding:4px 10px;font-size:11px;cursor:pointer;font-family:var(--sans);border:1px solid ' + (st === 'has' ? '#1B6B5A;background:rgba(27,107,90,.12);color:#1B6B5A;font-weight:600' : 'rgba(var(--fg-rgb),.15);background:rgba(var(--fg-rgb),.03);color:var(--text-body)') + '">\u2713 Has AI expertise</button>';
    h += '<button onclick="bexpSet(' + i + ',\'no\')" style="padding:4px 10px;font-size:11px;cursor:pointer;font-family:var(--sans);border:1px solid ' + (st === 'no' ? '#9B2D3F;background:rgba(155,45,63,.12);color:#9B2D3F;font-weight:600' : 'rgba(var(--fg-rgb),.15);background:rgba(var(--fg-rgb),.03);color:var(--text-body)') + '">\u2717 No AI expertise</button>';
    h += '</div>';
    if (st === 'has') {
      h += '<textarea id="or_bexpText' + i + '" rows="2" onblur="bexpSave(' + i + ')" placeholder="Describe the director\u2019s relevant AI knowledge." style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.05);color:var(--paper);font-size:14px;font-family:var(--sans);box-sizing:border-box;margin-top:6px">' + esc(m.aiExpertise || '') + '</textarea>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}
function memberStaffingBlock(roleId, opts) {
  opts = opts || {};
  var noun = opts.noun || 'board';
  var r = (data.orgChart || []).find(function (x) { return x.id === roleId });
  var members = (r && r.members) || [];
  var leaders = data.leaders || [];
  var byId = {}; leaders.forEach(function (l) { if (l.id) byId[l.id] = l; });
  var h = '';
  // Current members
  if (members.length) {
    h += '<div style="margin-bottom:12px">';
    members.forEach(function (m, mi) {
      var isL = m.type === 'leader';
      var ml = isL ? byId[m.id] : null;
      var nm = isL ? (ml ? ml.name : 'Leader') : m.name;
      var ti = isL ? (ml ? leaderRoleName(ml) : 'Internal') : (m.title || 'External');
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:6px">';
      h += '<div style="width:8px;height:8px;border-radius:4px;background:' + (isL ? '#1B6B5A' : '#4E7FA6') + ';flex-shrink:0"></div>';
      h += '<div style="flex:1"><span style="font-size:13px;font-weight:600;color:var(--paper)">' + esc(nm) + '</span> <span style="font-size:12px;color:var(--text-body)">' + esc(ti) + '</span>' + (m.aiExpertise ? '<div style="font-size:11px;color:var(--text-body);margin-top:2px;line-height:1.5">' + esc(m.aiExpertise) + '</div>' : (m.aiExpState === 'no' ? '<div style="font-size:11px;color:var(--text-body);margin-top:2px;line-height:1.5">No AI expertise</div>' : '')) + '</div>';
      h += '<div style="font-family:var(--mono);font-size:9px;padding:2px 8px;border:1px solid ' + (isL ? 'rgba(27,107,90,.3)' : 'rgba(var(--gold-rgb),.3)') + ';color:' + (isL ? '#1B6B5A' : '#4E7FA6') + '">' + (isL ? 'INTERNAL' : 'EXTERNAL') + '</div>';
      h += '<button onclick="removeBoardMember(\'' + roleId + '\',' + mi + ')" title="Remove from this body" style="background:none;border:none;color:#9B2D3F;cursor:pointer;font-size:16px;padding:2px 6px">\u00D7</button>';
      h += '</div>';
    });
    h += '</div>';
  } else {
    h += '<div style="font-size:13px;color:var(--text-body);margin-bottom:12px">No members yet. Add leaders below, or add an external member.</div>';
  }
  // Toggle leaders (who from the inventory sits on this body)
  if (leaders.length) {
    h += '<div style="margin-bottom:12px"><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Add from your leaders</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    leaders.forEach(function (l) {
      var isOn = members.some(function (m) { return m.type === 'leader' && m.id === l.id });
      h += '<button onclick="toggleBoardLeader(\'' + roleId + '\',\'' + l.id + '\')" title="' + (isOn ? 'Click to remove' : 'Click to add') + '" style="padding:5px 12px;font-size:12px;background:' + (isOn ? 'rgba(27,107,90,.15)' : 'transparent') + ';border:1px solid ' + (isOn ? '#1B6B5A' : 'rgba(var(--fg-rgb),.12)') + ';color:' + (isOn ? '#1B6B5A' : 'var(--text-body)') + ';cursor:pointer;font-family:inherit;border-radius:6px">' + (isOn ? '\u2713 ' : '') + esc(l.name || 'Leader') + '</button>';
    });
    h += '</div></div>';
  }
  // Add external member
  h += '<div style="margin-top:8px"><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Add an external ' + esc(noun === 'council' ? 'member' : '/ non-executive member') + '</div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h += '<input id="bm_extName_' + roleId + '" placeholder="Name" style="flex:1;min-width:140px;padding:8px;background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.12);color:var(--paper);font-size:13px;font-family:var(--sans);border-radius:6px">';
  h += '<input id="bm_extTitle_' + roleId + '" placeholder="Title / affiliation" style="flex:1;min-width:140px;padding:8px;background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.12);color:var(--paper);font-size:13px;font-family:var(--sans);border-radius:6px">';
  h += btn('+ Add', 'addBoardMember(\'' + roleId + '\',\'external\',null,val(\'bm_extName_' + roleId + '\'),val(\'bm_extTitle_' + roleId + '\'))', 'bp', 'font-size:12px;padding:8px 14px');
  h += '</div></div>';
  return h;
}
// Set which role a leader occupies (untethered model). roleSel is the dropdown
// value: '__unassigned__' (occupy nothing), '__new__' (create a role named newName
// and occupy it), or an existing role id. A leader occupies at most one role, so we
// first clear them from any role, then assign.
function assignLeaderToRole(leaderId, roleSel, newName) {
  if (!data.orgChart) data.orgChart = [];
  // Clear this leader out of every role first (one occupant per leader).
  data.orgChart.forEach(function (r) { if (r.occupantLeaderId === leaderId) r.occupantLeaderId = null; });
  if (roleSel === '__unassigned__' || !roleSel) return;
  if (roleSel === '__new__') {
    var nm = (newName || '').trim();
    if (!nm) return;  // no name given -> treat as unassigned
    data.orgChart.push({ id: 'role_' + uid(), name: nm, level: 3, parentId: 'board', occupantLeaderId: leaderId, guidingConcepts: '', taggedValues: [], members: [], source: 'leader' });
    return;
  }
  // Existing role id -> occupy it.
  var role = data.orgChart.filter(function (r) { return r.id === roleSel; })[0];
  if (role) role.occupantLeaderId = leaderId;
}
function saveLeader() {
  if (lockBlocked('leaders') || lockBlocked('orgChart')) return;
  var l = { name: val('ldr_name'), fluency: val('ldr_fluency'), changeExp: val('ldr_changeExp'), bandwidth: val('ldr_bandwidth'), engagement: val('ldr_engagement'), scope: val('ldr_scope') };
  if (!l.name) return;
  if (!data.leaders) data.leaders = [];
  if (UI.editIdx !== null) {
    var prev = data.leaders[UI.editIdx] || {};
    l.id = prev.id || nextLeaderId();
    if (prev.userId !== undefined) l.userId = prev.userId;
    if (prev.userLinkBy !== undefined) l.userLinkBy = prev.userLinkBy;
    if (prev.userLinkAt !== undefined) l.userLinkAt = prev.userLinkAt;
    data.leaders[UI.editIdx] = l;
  } else {
    l.id = nextLeaderId();
    data.leaders.push(l);
  }
  // Apply the role-occupancy choice from the form dropdown.
  assignLeaderToRole(l.id, val('ldr_roleSel'), val('ldr_newRoleName'));
  UI.addForm = false; UI.addLeaderOpen = false; UI.editIdx = null;
  syncPhase1Chart(); saveData(); render();
}
// ── Phase 1 reporting hierarchy ─────────────────────────────────────────────
// Level derived from reporting-chain depth: Board=1, reports-to-Board=2, etc.
// Build org-chart roles from the leaders inventory (leaders = source of truth).
// Resolve the individual occupying a role. Canonical pointer is role.occupantLeaderId
// (a stable leader id); falls back to the legacy assignedLeader array index for any
// data created before the id conversion. Returns the leader object or null (vacant).
function roleOccupant(role) {
  if (!role) return null;
  var leaders = data.leaders || [];
  if (role.occupantLeaderId) {
    return leaders.filter(function (l) { return l.id === role.occupantLeaderId; })[0] || null;
  }
  if (role.assignedLeader !== null && role.assignedLeader !== undefined && typeof role.assignedLeader === 'number') {
    return leaders[role.assignedLeader] || null;  // legacy index fallback
  }
  return null;
}
// True if a role currently has an occupant (id or legacy index).
function roleHasOccupant(role) {
  return !!roleOccupant(role);
}
// --- Model B: a leader's role IS the box they occupy. -------------------------
// leaderOccupiedRole(leader) returns the orgChart role this leader occupies (or
// null if unplaced). leaderRoleName(leader) is the single source of truth for a
// leader's displayed title: the occupied role's name, or 'Unassigned' if the
// leader occupies no box. Display sites read this, NOT the vestigial l.role field.
function leaderOccupiedRole(leader) {
  if (!leader || !leader.id) return null;
  var chart = data.orgChart || [];
  for (var i = 0; i < chart.length; i++) { if (chart[i].occupantLeaderId === leader.id) return chart[i]; }
  // Legacy index fallback (pre-occupantLeaderId charts).
  var leaders = data.leaders || []; var idx = leaders.indexOf(leader);
  if (idx > -1) { for (var j = 0; j < chart.length; j++) { if (typeof chart[j].assignedLeader === 'number' && chart[j].assignedLeader === idx) return chart[j]; } }
  return null;
}
function leaderRoleName(leader) {
  var r = leaderOccupiedRole(leader);
  return (r && r.name) ? r.name : 'Unassigned';
}
function phase1ChartRoles() {
  var leaders = data.leaders || [];
  var byId = {}; leaders.forEach(function (l) { if (l.id) byId[l.id] = l; });
  var roles = [];
  // Board node (fixed) at level 1.
  roles.push({ id: 'board', name: 'Board', level: 1, parentId: '', occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: [], source: 'core' });
  leaders.forEach(function (l, i) {
    roles.push({ id: 'ldr_' + l.id, name: l.role || l.name || 'Leader', level: 2, parentId: 'board', occupantLeaderId: l.id, guidingConcepts: '', taggedValues: [], members: [], source: 'leader' });
  });
  return roles;
}
// Reconcile data.orgChart with the current leaders inventory (roles persist).
// Reconcile data.orgChart with the current leaders inventory WITHOUT wiping
// non-leader chart elements (board members, council, Phase 2 additions).
// - Adds a leader-box for any new leader (defaulting to report-to-board).
// - Removes leader-boxes whose leader no longer exists.
// - Updates reporting parent + derived level for existing leader-boxes.
// - Leaves the board node, its members, the council, and any added roles intact.
// The AI Transformation Council node exists on the chart only when the user has
// chosen the council coordination mechanism (Structure Lab > Cross-Functional).
// Creating/removing it here keeps the chart driven by the user's decision, not
// auto-added. Members are preserved across renders by syncPhase1Chart's reconcile.
function syncCouncilNode() {
  if (!data.orgChart) data.orgChart = [];
  var wantCouncil = ((data.structure || {}).coordMechanism === 'council');
  var idx = data.orgChart.findIndex(function (r) { return r.id === 'crossfunc'; });
  if (wantCouncil) {
    if (idx < 0) {
      data.orgChart.push({ id: 'crossfunc', name: 'AI Transformation Council', level: 0, parentId: '', occupantLeaderId: null, guidingConcepts: 'Cross-functional coordination body.', taggedValues: [], members: [], source: 'addition' });
      saveData();
    }
  } else {
    if (idx >= 0) {
      data.orgChart.splice(idx, 1);
      saveData();
    }
  }
}
function syncPhase1Chart() {
  // Untethered-role model: roles are independent objects with their own ids; a role
  // is occupied by at most one leader via occupantLeaderId, and no role is "owned" by
  // a leader. This reconcile therefore does the minimum: ensure the board node exists,
  // and vacate any occupancy pointer to a leader who no longer exists. Roles are never
  // auto-created from the inventory and never deleted here (deleting a leader vacates
  // the roles they held; the roles persist). Role creation happens in the leader form
  // ("+ Create new role") and on the chart pages.
  var leaders = data.leaders || [];
  var chart = data.orgChart || [];
  var validLeaderIds = {}; leaders.forEach(function (l) { if (l.id) validLeaderIds[l.id] = true; });

  var changed = false;   // ruled 25 July: persist ONLY when the reconcile changed something.
  // This runs on the render path of both board hosts (dashboard, 1.2 hierarchy); an
  // unconditional save made every render bump the org rev, and two tabs on board pages
  // fed each other storage events in an endless adopt->render->write loop (the reported
  // multi-user freeze). It also let a stale replica clobber newer foreign revs on
  // navigation. Reconciles are idempotent, so gating the save converges cross-tab
  // activity after at most one write.
  var board = chart.find(function (r) { return r.id === 'board'; });
  if (!board) {
    board = { id: 'board', name: 'Board', level: 1, parentId: '', occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: [], source: 'core' };
    chart.push(board);
    changed = true;
  }
  // Vacate occupancy that points at a deleted leader (role stays, just empty).
  chart.forEach(function (r) {
    if (r.occupantLeaderId && !validLeaderIds[r.occupantLeaderId]) { r.occupantLeaderId = null; changed = true; }
  });

  data.orgChart = chart;
  if (changed) saveData();
}
// Would assigning `targetLeaderId` as `leaderId`'s manager create a cycle?
// Would setting role's parent to targetId create a cycle in the role hierarchy?
function roleParentWouldCycle(roleId, targetId, rolesById) {
  if (targetId === 'board' || !targetId) return false;
  var cur = targetId, guard = 0;
  while (cur && cur !== 'board' && guard < 200) {
    if (cur === roleId) return true;            // target sits (transitively) under role -> cycle
    var p = rolesById[cur];
    cur = p ? p.parentId : null;
    guard++;
  }
  return false;
}
// Set a role's parent (its position in the hierarchy) directly. parentId is the
// canonical store for reporting under the role model. Recomputes level from the
// parent's depth so the color band matches the visual position.
function assignRoleParent(roleId, parentId) {
  if (lockBlocked('orgChart')) return;
  var roles = data.orgChart || [];
  var rolesById = {}; roles.forEach(function (r) { rolesById[r.id] = r; });
  if (roleParentWouldCycle(roleId, parentId, rolesById)) { alert('That would create a reporting loop.'); return; }
  var role = rolesById[roleId]; if (!role) return;
  role.parentId = (parentId === 'board' ? 'board' : parentId);
  // Derive level from parent depth (board is level 1; child = parent+1, capped at 4).
  var depth = 1, cur = role.parentId, guard = 0;
  while (cur && cur !== 'board' && guard < 200) { var p = rolesById[cur]; if (!p) break; depth++; cur = p.parentId; guard++; }
  if (role.level !== 0) role.level = Math.min(4, depth + 1);  // leave floating (level 0) roles floating
  saveData(); render();
}
function saveLandscapeNotes() { if (!data.landscapeNotes) data.landscapeNotes = {}; var e1 = $('ll_ownershipGap'), e2 = $('ll_mmAssessment'); if (e1) data.landscapeNotes.ownershipGap = e1.value; if (e2) data.landscapeNotes.mmAssessment = e2.value; saveData() }

/* ═══ STEP 1.3: Leadership Risk Mapping ═══ */
function renderStep13() {
  var risks = data.risks || [];
  var colors = ['#1B6B5A', '#2D5A8E', '#8B5E3C', '#9B2D3F', '#6B4C8A', '#4E7FA6', '#3D5A6E'];
  var SCEN = [
    { id: 'zillow', name: 'Deploying Without Readiness', desc: 'AI systems are deployed at scale before the organization\u2019s leadership structure is ready to manage the implications. The technology works, but the leadership architecture does not, and the result is catastrophic financial and reputational loss.', case_: 'In November 2021, Zillow shut down its home-buying business after the pricing algorithms behind it systematically overpaid for houses as the market shifted. The company wrote down $304 million on a single quarter\u2019s purchases, warned of a quarter-billion more in losses on homes it was still committed to buy, laid off a quarter of its workforce, and watched its shares fall about 25% the next day. The failure of the models to accurately forecast pricing and demand was real, but the deeper issue was a failure of readiness. Zillow had scaled its AI operations far faster than it had built the institutional ability to detect errors in the program and call a halt to its work.', link: 'https://www.cnbc.com/2021/11/03/zillow-stock-plunges-24percent-after-company-exits-home-buying-business.html', anchor: 'shut down its home-buying business', q: 'How exposed is your organization to deploying AI before your leadership team understands the strategic, cultural, and operational implications?' },
    { id: 'calstate', name: 'Transformation Without Engagement', desc: 'AI integration is announced without preparing the workforce or middle management. Resistance erupts immediately, stalling the program before it begins.', case_: 'In February 2025, California State University announced a roughly $17 million deal with OpenAI to make CSU the nation\u2019s first \u201CAI-powered\u201D public university system, putting AI tools in front of more than half a million people across its 23 campuses. Faculty and staff learned of the initiative from a systemwide email, and within a week it faced fierce opposition from staff and students who objected to both the goal and its implementation. The resistance never faded: the faculty union objected, a state Assembly committee called university officials to account, thousands petitioned against renewal, and many simply refused to use the tools. CSU pressed ahead and renewed the contract in 2026, having spent more than a year fighting resistance that could have been defused by proper engagement before the announcement.', link: 'https://calmatters.org/education/2026/05/california-state-university-open-ai-chatgpt-contract/', anchor: 'renewed the contract in 2026', q: 'Could an AI initiative in your organization face similar resistance because leadership hasn\u2019t done the cultural groundwork?' },
    { id: 'aircanada', name: 'AI Without Boundaries', desc: 'AI-powered customer interactions are deployed without clear policies about what the AI can promise, commit to, or represent. The organization is held responsible for its AI\u2019s statements.', case_: 'In 2022, the support chatbot on Air Canada\u2019s website told a bereaved customer he could pay full fare and claim the airline\u2019s bereavement discount retroactively \u2014 contradicting the actual policy, stated elsewhere on the same site. When the airline refused the refund, a British Columbia tribunal found Air Canada responsible for negligent misrepresentation and ordered it to pay the fare difference. The company\u2019s lawyers had argued that the chatbot was, in effect, a separate legal entity responsible for its own statements. The tribunal rejected that outright: a company is responsible for everything on its website, chatbot included.', link: 'https://www.canlii.org/en/bc/bccrt/doc/2024/2024bccrt149/2024bccrt149.html', anchor: 'a British Columbia tribunal', q: 'Does your leadership team have clear policies about where AI can and cannot represent the organization?' },
    { id: 'cigna', name: 'Eliminating Human Judgment', desc: 'Operational decisions that require human judgment are automated for efficiency. Ethical, legal, and reputational consequences follow when no human reviews critical cases.', case_: 'A 2023 investigation by ProPublica and The Capitol Forum revealed that Cigna\u2019s automated review system let company doctors reject claims on medical grounds without ever opening the patient\u2019s file: the system flagged mismatched diagnosis codes, and doctors signed off on the denials in batches. Over two months in 2022, Cigna doctors denied more than 300,000 requests for payment this way, averaging 1.2 seconds per case; one doctor alone denied roughly 60,000 claims in a single month. The reporting triggered a congressional investigation, state regulatory scrutiny, and class-action lawsuits arguing that bulk sign-off violated laws requiring meaningful physician review. No sophisticated AI was involved \u2014 just a system that made rubber-stamping easier than reviewing.', link: 'https://www.propublica.org/article/cigna-pxdx-medical-health-insurance-rejection-claims', anchor: 'investigation by ProPublica and The Capitol Forum', q: 'Are there decisions in your organization where AI could eliminate human judgment in ways that create ethical or reputational risk?' },
    { id: 'stigma', name: 'Cultural Readiness Failure', desc: 'AI tools are introduced into an organizational culture that penalizes their use. Leaders who adopt AI are judged as less competent, creating a self-defeating cycle.', case_: 'In a study published in Harvard Business Review in 2025, more than 1,000 engineers at a global technology company reviewed identical code, told only that it was written by an engineer alone or with AI assistance. When reviewers believed AI had been used, they rated the engineer\u2019s competence 9% lower than they did for identical work, which they believed had been done without AI assistance. The penalty was imposed most severely by evaluators who didn\u2019t use AI themselves. The stigma had real consequences: a full year after the company rolled out an AI coding assistant, only 41% of its engineers had even tried it.', link: 'https://hbr.org/2025/08/research-the-hidden-penalty-of-using-ai-at-work', anchor: 'study published in Harvard Business Review in 2025', q: 'Is your organizational culture ready for AI adoption, or would leaders who use AI tools be penalized rather than supported?' },
    { id: 'disruption', name: 'Competitive Disruption', desc: 'The organization moves too slowly on AI while competitors deploy it to reduce costs, improve speed, and capture market share. The gap becomes unbridgeable.', case_: 'Kodak remains the defining case. The company was not blind to digital photography \u2014 its own engineers built the first digital camera prototype in 1975, and it invested in digital imaging for decades afterward. The failure lay in the response: each digital move was made in service of the old film-and-printing business, while competitors built their businesses on the new technology itself. Kodak understood the technology earlier than almost anyone, failed to change its business at the pace the technology demanded, and filed for bankruptcy protection in 2012. Early awareness counts for nothing once the response falls far enough behind.', link: 'https://hbr.org/2016/07/kodaks-downfall-wasnt-about-technology', anchor: 'the defining case', q: 'How quickly are your competitors moving on AI, and what is the cost of delay?' },
    { id: 'fatigue', name: 'Change Fatigue', desc: 'AI transformation is layered on top of existing change programs without stable foundations. The workforce burns out, resistance hardens, and initiatives stall or actively undermine each other.', case_: 'In 2016, Gartner found, the average employee went through two planned enterprise changes in a year; by 2022 the number was ten, each arriving before the last had settled. Over the same period, employees\u2019 willingness to support enterprise change fell from 74% to 43%. An AI transformation announced to a workforce in that condition begins with the exhaustion the previous changes left behind. And McKinsey\u2019s transformation research shows how rarely these programs succeed even in good conditions: fewer than one-third improve performance and sustain the improvement.', link: 'https://hbr.org/2023/05/employees-are-losing-patience-with-change-initiatives', anchor: 'Gartner found', q: 'What is the current state of change fatigue in your organization, and can you absorb another major transformation?' }
  ];
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Risk Mapping</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 12px;line-height:1.6;font-size:14px">Seven scenarios illustrate what happens when leadership isn\u2019t ready for AI. For each, assess how likely it is in your organization, how severe the consequences would be, and how soon it could happen.</p>';
  h += card('<div style="display:flex;gap:16px"><div style="flex:1"><h4 style="font-size:14px;font-weight:700;color:var(--ph1);margin:0 0 4px">\u25A3 As an Organization</h4><p style="font-size:13px;color:var(--stone);line-height:1.5">Complete this as a leadership team. Score each scenario for your organization. The output becomes your Risk Map and feeds into the Leadership Structure Lab in Phase 2.</p></div><div style="flex:1"><h4 style="font-size:14px;font-weight:700;color:var(--ph2);margin:0 0 4px">\u25C8 As an Individual</h4><p style="font-size:13px;color:var(--stone);line-height:1.5">Each leader can also reflect individually. Confronting these scenarios develops the awareness and judgment that AI-era leadership demands.</p></div></div>', 'margin-bottom:24px;border-top:3px solid var(--gold)');
  SCEN.forEach(function (sc, idx) {
    var r = null; for (var i = 0; i < risks.length; i++) { if (risks[i].id === sc.id) { r = risks[i]; break } }
    if (!r) r = { id: sc.id, likelihood: 0, impact: 0, timeHorizon: 0, notes: '' };
    var nv = (data.riskNotes || {})[sc.id] || r.notes || '';
    var rL = data['risk_' + sc.id + '_likelihood'] || r.likelihood;
    var rI = data['risk_' + sc.id + '_impact'] || r.impact;
    var rT = data['risk_' + sc.id + '_timeHorizon'] || r.timeHorizon;
    var lit = rL + rI + rT; var col = colors[idx % colors.length];
    var exKey = 'risk_ex_' + sc.id; var exOpen = UI.ctxOpen[exKey];
    h += '<div class="cd" style="margin-bottom:16px;border-top:3px solid ' + col + '">';
    h += '<h4 style="font-size:16px;font-weight:700;margin:0 0 6px;color:var(--paper)">' + esc(sc.name) + '</h4>';
    h += '<p style="font-size:13px;color:var(--stone);margin:0 0 12px;line-height:1.6">' + esc(sc.desc) + '</p>';
    // Expandable case study
    if (sc.case_) {
      h += '<div onclick="UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.1);cursor:pointer;margin-bottom:12px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)">' + (exOpen ? '\u25BE' : '\u25B8') + ' Real-World Example</div>';
      if (exOpen) { h += '<div style="padding:14px 16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08);margin-bottom:16px;border-left:3px solid ' + col + '"><p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0">' + (function () { var b = esc(sc.case_); if (sc.link && sc.anchor) b = b.replace(esc(sc.anchor), '<a href="' + esc(sc.link) + '" target="_blank" rel="noopener" class="vp-link">' + esc(sc.anchor) + '</a>'); return b })() + '</p></div>' }
    }
    h += '<p style="font-size:13px;color:var(--paper);margin:0 0 16px;line-height:1.5;font-style:italic;border-left:2px solid ' + col + ';padding-left:12px">' + esc(sc.q) + '</p>';
    h += '<div style="margin-bottom:12px">' + badge('Score: ' + lit + '/15', lit === 0 ? 'var(--text-body)' : lit > 10 ? '#9B2D3F' : lit > 5 ? '#4E7FA6' : '#1B6B5A') + '</div>';
    h += likert('Likelihood in your organization', 'risk_' + sc.id + '_likelihood', rL, 'Very unlikely', 'Very likely');
    h += likert('Severity of consequences', 'risk_' + sc.id + '_impact', rI, 'Minor', 'Catastrophic');
    h += likert('How soon could this happen?', 'risk_' + sc.id + '_timeHorizon', rT, 'Years away', 'Imminent');
    h += ta('How does this apply to your organization?', 'risk_' + sc.id + '_notes', nv, 'Describe the specific risk in your context', 2);
    h += '</div>';
  });
  var _rk13 = ['zillow', 'calstate', 'aircanada', 'cigna', 'stigma', 'disruption', 'fatigue'].some(function (s) { return (data['risk_' + s + '_likelihood'] || 0) > 0 });
  h += doneBtn('saveRisks()', !_rk13, '\u2713 Save Risk Map & Continue \u2192', '1.3', 'Score at least one risk scenario (likelihood) to complete this step.');
  return h;
}
function saveRisks() {
  if (lockBlocked('risks')) return; if (!confirmStepDone('1.3')) return;
  harvestFields();
  var sids = ['zillow', 'calstate', 'aircanada', 'cigna', 'stigma', 'disruption', 'fatigue']; var risks = [];
  sids.forEach(function (sid) { risks.push({ id: sid, likelihood: data['risk_' + sid + '_likelihood'] || 0, impact: data['risk_' + sid + '_impact'] || 0, timeHorizon: data['risk_' + sid + '_timeHorizon'] || 0, notes: (data.riskNotes || {})[sid] || val('risk_' + sid + '_notes') }) });
  data.risks = risks; data.completedSteps['1.3'] = true; stampStepDone('1.3'); saveData(); render();
}

/* ═══ STEP 1.4: Mindset Foundations ═══ */
function renderStep14() {
  var _g = indivGate('Mindset Foundations'); if (_g) return _g;
  var deps = data.depScan || []; var ms = myIndivRead('mindsetStudy');
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Working with AI</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">This is the individual track entry point. Working with AI is not just a faster way of doing the same job. It changes how work gets done, which of your skills stay sharp, and the assumptions you absorb from the tools themselves. Start with your own day-to-day experience of working with AI, then widen the picture to the digital workforce and the skills that erode through dependence.</p>';

  // Three tabs, rendered like the Assessment Battery's section tabs: box-style buttons,
  // each showing a completion glyph (filled check when that tab is complete, open circle
  // otherwise) with a green tint and border treatment. (1) Working with AI \u2014 the five
  // readings. (2) The Digital Workforce \u2014 hybrid-team reflections. (3) Skill Atrophy \u2014
  // the self-audit and the Dependency Scan.
  var _mf = UI.mfTab || 'intro';
  var _mfTabs = [{ id: 'intro', label: 'Working with AI', c: mfTabDone('intro') }, { id: 'workforce', label: 'The Digital Workforce', c: mfTabDone('workforce') }, { id: 'atrophy', label: 'Skill Atrophy', c: mfTabDone('atrophy') }];
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px">';
  _mfTabs.forEach(function (t) {
    var on = _mf === t.id;
    h += '<button onclick="mfSwitchTab(\'' + t.id + '\')" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans);border:' + (on ? '2px solid #1B6B5A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (t.c ? 'rgba(27,107,90,.08)' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (on || t.c ? '#1B6B5A' : 'var(--text-body)') + '">' + (t.c ? '\u2713' : '\u25CB') + ' ' + esc(t.label) + '</button>';
  });
  h += '</div>';

  // Tab 1 — Working with AI (intro). A short learning portal: five core readings, each
  // followed by a reflection question and a textarea, saved into mindsetStudy (read1..read5).
  var _rd = function (n, title, authors, outlet, url, desc, question, field) {
    return recBox('rd_read' + n, title, authors, outlet, url, desc, '', 'CORE READING ' + n)
      + '<div style="margin:-8px 0 20px;padding:0 2px">'
      + '<div style="font-size:13px;color:var(--paper);font-weight:600;line-height:1.5;margin-bottom:8px">' + esc(question) + '</div>'
      + taGated('Your answer *', field, ms[field], 'One to three sentences', 2)
      + '</div>';
  };
  var _intro = '<p style="color:var(--text-body);margin:0 0 20px;line-height:1.6;font-size:14px">Five short readings introduce the ideas that matter most when you start working with AI. Read each one, then answer the question beneath it in a sentence or two.</p>'
    + _rd(1, '6 Skills Everyone Needs in the AI Era', '', 'Fast Company', 'https://faisalhoque.com/6-skills-everyone-needs-in-the-ai-era/', 'The six capabilities worth developing are precisely the ones AI tempts you to neglect: thriving in uncertainty, deciding what matters, preserving cognitive self-reliance, sustaining connection, ethical reasoning, and a distinctive point of view.', 'Of the six skills, which is most critical for the work you currently do, and what specifically could tempt you to stop exercising it?', 'read1')
    + _rd(2, 'We All Use AI. Here\u2019s How to Use It Well', '', 'Psychology Today', 'https://faisalhoque.com/we-all-use-ai-heres-how-to-use-it-well/', 'Using AI well is not about better prompts; it is about keeping your own judgment in the driver\u2019s seat rather than offloading the decision about what matters.', 'Think of a recent time you used AI for something that mattered. Did you start from a developed view of your own, or did you begin by asking the AI what to think? What would staying in the driver\u2019s seat have looked like?', 'read2')
    + _rd(3, 'The Cost of Hollowing Out Human Accountability', '', 'Fast Company', 'https://faisalhoque.com/the-cost-of-hollowing-out-human-accountability/', 'For some decisions the difficulty is a feature, not a bug: the weight is what makes people pause, question, and stay accountable. Remove it and the institution becomes numb.', 'Name one decision in your work area where AI removes effort that arguably ought to stay effortful. What scrutiny or pushback might be lost if the weight of that decision disappears?', 'read3')
    + _rd(4, 'Do You Really Know What \u2018Agent\u2019 Means?', '', 'Fast Company', 'https://faisalhoque.com/do-you-really-know-what-agent-means-if-not-youre-putting-your-company-at-risk/', '\u201CAgent\u201D spans a wide spectrum \u2014 from constrained workflows, through task-specific squads, to genuinely autonomous systems \u2014 and where a tool sits on it determines who is accountable when it fails.', 'Think of an AI tool described as an \u201Cagent\u201D in your world. Where does it actually sit on the spectrum from constrained workflow to genuine autonomy, and who would be accountable if it got something consequential wrong?', 'read4')
    + _rd(5, 'AI Isn\u2019t Underperforming. Leadership Just Hasn\u2019t Caught Up Yet', '', 'I by IMD', 'https://faisalhoque.com/ai-isnt-underperforming-leadership-just-hasnt-caught-up-yet/', 'The gap between AI investment and returns is a leadership gap, not a technology one. Frontier firms pull ahead through organizational change, supported by three leadership capabilities.', 'The article says AI transformation is a leadership responsibility, not a technology task to hand off. In your organization, who currently owns the cultural and human side of AI change? What falls through the cracks if no one does?', 'read5');

  // Tab 2 — The Digital Workforce (keeps the original framing, plus the agent-management
  // reflections moved up from Phase 2 Mindset Depth, now keyed in the mindsetStudy store).
  var _theme1 = card('<h3 class="h-sub-lg">Understanding the Digital Workforce</h3><p style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:12px">You are now allocating resources to digital agents. An AI agent is not just a tool. It performs tasks independently, makes decisions within set parameters, and requires management, much as a human report does. Agentic AI systems will increasingly collaborate with and report to human workers. Leaders who understand this shift can design their hybrid teams deliberately, rather than discovering the management problems after deployment.</p>' + recBox('rr_ms_theme1', '7 Ways Leaders Must Evolve to Lead AI-Augmented Teams', 'Faisal Hoque', 'Fast Company', 'https://www.fastcompany.com/91328927/7-ways-leaders-must-evolve-to-lead-ai-augmented-teams-leading-ai-augmented-teams', 'The new management skills required to lead hybrid teams where humans and AI systems work side by side.') + taGated('Your reflection: What changes about leadership when your team includes AI agents? *', 'ms_theme1', ms.theme1, '', 3))
    + card('<h3 class="h-sub-lg">Managing Your Hybrid Team</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">You are managing a hybrid team: some members are human, and some are AI agents. The management challenge is real. AI agents need onboarding, supervision, and clear boundaries, just as human reports do.</p>' + recBox('rr_md_hybrid', 'The Hybrid Mandate', 'Faisal Hoque', 'Fast Company', 'https://www.fastcompany.com/91372399/how-to-lead-in-an-everything-is-hybrid-business-world-ai-hybrid-work', 'How to lead when the workforce blends human and machine.') + taGated('Which AI agents are currently operating in your area of responsibility? What roles do they play? *', 'ms_dwAgents', ms.dwAgents, 'e.g. A drafting assistant for strategy documents, a scheduling agent, a data analysis tool', 3) + taGated('How are you currently \u201Cmanaging\u201D these AI agents? What\u2019s working and what isn\u2019t? *', 'ms_dwManaging', ms.dwManaging, 'Have you set boundaries? Do you review output? Do you know their limitations?', 3));

  // Tab 3 — Skill Atrophy (keeps its framing, plus the self-audit moved up from Phase 2,
  // which sits naturally beside the Dependency Scan).
  var _theme2 = card('<h3 class="h-sub-lg">Skill Atrophy</h3><p style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:12px">When you delegate a cognitive task to AI, the corresponding human skill can begin to atrophy. Technological progress can unintentionally diminish your core capabilities. A leader who stops writing first drafts loses practice in thinking through structured prose. A manager who automates performance reviews stops exercising the judgment that made those reviews fair. The question is not whether AI is better at the task. It is whether you can afford to lose the capacity.</p>' + recBox('rr_ms_theme2', 'What Is Reverse Improvement? How Leaders Can Avoid Common AI Mistakes', 'Faisal Hoque', 'Fast Company', 'https://www.fastcompany.com/91281454/how-to-avoid-leadership-mistakes-with-ai', 'How delegating cognitive work to AI erodes the human skills behind it, and the mindful practices that guard against it.') + taGated('Your reflection: Where might you personally be experiencing skill atrophy? *', 'ms_theme2', ms.theme2, '', 3) + taGated('What has changed about your own work since you started using AI tools? What skills have you gained, and what might you be losing? *', 'ms_selfAudit', ms.selfAudit, 'Connect back to your Dependency Scan below', 3));

  // Dependency Scan — follows directly from Skill Atrophy
  var _depScan = '<div id="sec-depscan"></div>' + card('<h3 class="h-sub-lg">Dependency Scan</h3><p style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:12px"><em>Adapted from The Friction Map \u2014 Human Edge Program.</em></p><p style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:16px">The ideas above stay abstract until you apply them to your own work. Inventory every skill you have outsourced to AI, and for each one assess whether the skill still matters and what the risk is if it atrophies. The scan returns in Phase 2, where the AI-Free Zones work asks you to connect it to the zones you declare, and it continues after the module as a monthly practice in My Development.</p>' +
    deps.map(function (d, i) {
      var exKey = 'dep_' + i; var exOpen = UI.ctxOpen[exKey];
      var r = '<div style="border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:8px">';
      r += '<div style="padding:12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()">';
      r += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--stone)">' + (exOpen ? '\u25BE' : '\u25B8') + '</span><div style="font-size:14px;font-weight:600;color:var(--paper)">' + esc(d.skill) + '</div></div>';
      r += '<div style="display:flex;gap:6px;align-items:center">' + (d.importance ? badge(d.importance, d.importance === 'critical' ? '#9B2D3F' : d.importance === 'useful' ? '#4E7FA6' : 'var(--text-body)') : '') + (d.riskLevel ? badge('Risk: ' + d.riskLevel, d.riskLevel === 'high' ? '#9B2D3F' : d.riskLevel === 'medium' ? '#4E7FA6' : 'var(--text-body)') : '') + '</div></div>';
      if (exOpen) {
        r += '<div onclick="event.stopPropagation()" style="padding:0 12px 12px;border-top:1px solid rgba(var(--fg-rgb),.04)">';
        r += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">';
        r += '<div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:4px">AI Tool</div><div style="font-size:13px;color:var(--paper)">' + esc(d.aiTool || 'Not specified') + '</div></div>';
        r += '<div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:4px">Importance</div><div style="font-size:13px;color:var(--paper)">' + esc(d.importance || 'Not assessed') + '</div></div>';
        r += '</div>';
        r += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">';
        r += '<div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:4px">Atrophy Risk</div><div style="font-size:13px;color:var(--paper)">' + esc(d.riskLevel || 'Not assessed') + '</div></div>';
        r += '<div style="text-align:right">' + btn('\u00D7 Remove', 'removeDep(' + i + ')', 'bg2', 'padding:4px 10px;font-size:11px') + '</div>';
        r += '</div></div>';
      }
      r += '</div>'; return r;
    }).join('') +
    '<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(var(--fg-rgb),.06)">' + ta('Skill you\u2019ve outsourced to AI *', 'dep_skill', '', 'e.g. Writing first drafts of strategy documents', 1) + ta('AI tool that replaced it', 'dep_tool', '', 'e.g. ChatGPT, Copilot', 1) + sel('Does this skill still matter?', 'dep_importance', '', [{ v: '', l: 'Select one\u2026' }, { v: 'critical', l: 'Critical \u2014 must preserve this capability' }, { v: 'useful', l: 'Useful \u2014 worth maintaining' }, { v: 'low', l: 'Low priority \u2014 safe to delegate' }]) + sel('Risk if this skill atrophies', 'dep_risk', '', [{ v: '', l: 'Select one\u2026' }, { v: 'high', l: 'High \u2014 serious consequences' }, { v: 'medium', l: 'Medium \u2014 some risk' }, { v: 'low', l: 'Low \u2014 minimal concern' }]) + btn('+ Add to Scan', 'addDep()', 'bp') + '</div>', 'margin-top:24px');

  // Emit the active tab's content, each followed by its own gated complete button
  // (mirrors the Assessment Battery: the button unlocks only when that tab's fields are
  // filled, and shows the green-tick treatment once the tab is marked complete).
  var _nonEmpty = function (v) { return !!(v && String(v).trim()); };
  if (_mf === 'intro') {
    h += _intro;
    var introReady = _nonEmpty(ms.read1) && _nonEmpty(ms.read2) && _nonEmpty(ms.read3) && _nonEmpty(ms.read4) && _nonEmpty(ms.read5);
    h += doneBtn('saveMindsetTab(\'intro\')', !introReady, null, mfTabDone('intro'), 'Answer all five reading questions to complete this tab.');
  } else if (_mf === 'workforce') {
    h += _theme1;
    var wfReady = _nonEmpty(ms.theme1) && _nonEmpty(ms.dwAgents) && _nonEmpty(ms.dwManaging);
    h += doneBtn('saveMindsetTab(\'workforce\')', !wfReady, null, mfTabDone('workforce'), 'Complete the reflections on this tab first.');
  } else {
    h += _theme2 + _depScan;
    var atReady = _nonEmpty(ms.theme2) && _nonEmpty(ms.selfAudit) && (deps.length >= 1);
    h += doneBtn('saveMindsetTab(\'atrophy\')', !atReady, null, mfTabDone('atrophy'), 'Complete the reflections and add at least one Dependency Scan entry first.');
  }
  var _all14 = mfTabDone('intro') && mfTabDone('workforce') && mfTabDone('atrophy');
  if (_all14 || isStepDone('1.4')) h += doneBtn('saveMindsetStep()', false, null, '1.4');
  return h;
}
function addDep() { if (lockBlocked('depScan')) return; var d = { skill: val('dep_skill'), aiTool: val('dep_tool'), importance: val('dep_importance'), riskLevel: val('dep_risk') }; if (!d.skill) return; if (!data.depScan) data.depScan = []; data.depScan.push(d); saveData(); render() }
function removeDep(i) { if (lockBlocked('depScan')) return; data.depScan = (data.depScan || []).filter(function (_, j) { return j !== i }); saveData(); render() }
function saveMindset() {
  var ms = myIndivStore('mindsetStudy'); if (!ms) { alert('Link your account to a leader first.'); return; }
  var e1 = $('ms_theme1'), e2 = $('ms_theme2');
  if (e1) ms.theme1 = e1.value; if (e2) ms.theme2 = e2.value;
  // Fields moved up from Phase 2 Mindset Depth, now stored here.
  var ea = $('ms_dwAgents'), em = $('ms_dwManaging'), es = $('ms_selfAudit');
  if (ea) ms.dwAgents = ea.value; if (em) ms.dwManaging = em.value; if (es) ms.selfAudit = es.value;
  // Working-with-AI reading reflections (read1..read5).
  for (var _i = 1; _i <= 5; _i++) { var _e = $('read' + _i); if (_e) ms['read' + _i] = _e.value; }
  markIndivDone('1.4'); saveData(); render();
}
// Persist whichever Mindset Foundations fields are currently on screen, without
// re-rendering. Called on blur by taGated so the gated complete buttons can re-evaluate.
function mfPersistFields() {
  var ms = myIndivStore('mindsetStudy'); if (!ms) return;
  var _f = false;  // save only when this page actually carries mindset fields (ruled 25 July)
  var e1 = $('ms_theme1'), e2 = $('ms_theme2'), ea = $('ms_dwAgents'), em = $('ms_dwManaging'), es = $('ms_selfAudit');
  if (e1) { ms.theme1 = e1.value; _f = true; } if (e2) { ms.theme2 = e2.value; _f = true; }
  if (ea) { ms.dwAgents = ea.value; _f = true; } if (em) { ms.dwManaging = em.value; _f = true; } if (es) { ms.selfAudit = es.value; _f = true; }
  for (var _i = 1; _i <= 5; _i++) { var _e = $('read' + _i); if (_e) { ms['read' + _i] = _e.value; _f = true; } }
  if (_f) saveData();
}
// Read whether a Mindset Foundations tab is marked complete for the current leader.
function mfTabDone(tab) {
  var ml = getMyLeader(); if (!ml) return false;
  var d = (data.indivDone || {})[ml.id] || {};
  return d['1.4:' + tab] === true;
}
// Mark one Mindset Foundations tab complete (gated like the Assessment Battery's
// saveSection). Persists the visible fields first, records the per-tab flag, and flips
// the overall 1.4 done flag only once all three tabs are complete.
function saveMindsetTab(tab) {
  if (!mfTabDone(tab) && !confirm('Mark this section complete? This can\u2019t be undone.')) return; /* Item-7 extension: individual tab-saves run the standard section dialog; decline writes nothing */
  var ms = myIndivStore('mindsetStudy'); if (!ms) { alert('Link your account to a leader first.'); return; }
  var e1 = $('ms_theme1'), e2 = $('ms_theme2'), ea = $('ms_dwAgents'), em = $('ms_dwManaging'), es = $('ms_selfAudit');
  if (e1) ms.theme1 = e1.value; if (e2) ms.theme2 = e2.value;
  if (ea) ms.dwAgents = ea.value; if (em) ms.dwManaging = em.value; if (es) ms.selfAudit = es.value;
  for (var _i = 1; _i <= 5; _i++) { var _e = $('read' + _i); if (_e) ms['read' + _i] = _e.value; }
  var ml = getMyLeader(); if (!ml) { alert('Link your account to a leader first.'); return; }
  if (!data.indivDone) data.indivDone = {};
  if (!data.indivDone[ml.id]) data.indivDone[ml.id] = {};
  data.indivDone[ml.id]['1.4:' + tab] = true;
  // Ruled 25 July: tabs never complete the step — saveMindsetStep() (the discrete button) owns it.
  saveData(); render();
}
// Switch the Mindset Foundations theme tab. Persists whichever theme reflection is
// currently on screen first (only the active tab's textarea exists in the DOM), so no
// in-progress text is lost on switch. Does NOT mark the step done.
function mfSwitchTab(tab) {
  var ms = myIndivStore('mindsetStudy');
  if (ms) {
    var e1 = $('ms_theme1'), e2 = $('ms_theme2'), ea = $('ms_dwAgents'), em = $('ms_dwManaging'), es = $('ms_selfAudit');
    if (e1) ms.theme1 = e1.value; if (e2) ms.theme2 = e2.value;
    if (ea) ms.dwAgents = ea.value; if (em) ms.dwManaging = em.value; if (es) ms.selfAudit = es.value;
    for (var _i = 1; _i <= 5; _i++) { var _e = $('read' + _i); if (_e) ms['read' + _i] = _e.value; }
    saveData();
  }
  UI.mfTab = tab; render();
}


/* ═══ STEP 2.1: Leadership Structure Lab ═══ */
function renderStep21() {
  var st = data.structure || {};
  // Phase 1 Structure Baseline (section D) — surfaced as expandable reference blocks
  // beside the matching target-state questions (current-state context that informs
  // the Phase 2 design without dictating it). Each renders only if answered.
  var _ad = (data.assessments && data.assessments.structure) || {};
  var _ownLabels = { cio: 'Chief Information Officer (CIO)', cto: 'Chief Technology Officer (CTO)', ceo: 'Chief Executive Officer (CEO)', cao: 'Chief AI Officer (CAO)', cdo: 'Chief Data Officer (CDO)', ctro: 'Chief Transformation Officer (CTrO)', cino: 'Chief Innovation Officer (CINO)', cito: 'Chief Innovation & Transformation Officer (CITO)', distributed: 'distributed across the C-suite with no single owner', nobody: 'nobody \u2014 no formal ownership', adhoc: 'ad hoc \u2014 varying by project' };
  var _boardLabels = { dedicated: 'a dedicated AI/technology committee', shared: 'oversight shared with another committee', none: 'no formal board oversight of AI', unknown: 'unsure of the board\u2019s AI oversight' };
  var _cfLabels = { active: 'an active cross-functional body that meets regularly', dormant: 'a cross-functional body that exists but is dormant', none: 'no cross-functional body' };
  var _ownBody = _ad.ownership ? 'In your Phase 1 assessment, you said AI transformation is currently owned by <strong style="color:var(--paper)">' + esc(_ad.ownership === 'other' ? (_ad.ownershipOther || 'Other') : (_ownLabels[_ad.ownership] || _ad.ownership)) + '</strong>.' : '';
  var _boardBody = _ad.boardOversight ? 'In your Phase 1 assessment, you said board-level AI oversight is currently <strong style="color:var(--paper)">' + esc(_ad.boardOversight === 'other' ? (_ad.boardOversightOther || 'Other') : (_boardLabels[_ad.boardOversight] || _ad.boardOversight)) + '</strong>.' : '';
  var _cfBody = _ad.crossFunc ? 'In your Phase 1 assessment, you said you currently have <strong style="color:var(--paper)">' + esc(_ad.crossFunc === 'other' ? (_ad.crossFuncOther || 'Other') : (_cfLabels[_ad.crossFunc] || _ad.crossFunc)) + '</strong>.' : '';
  var _decBody = _ad.decisionStructure ? 'Your Phase 1 description of how AI decisions are made today:<div style="margin-top:6px;padding:10px 12px;background:rgba(var(--fg-rgb),.04);border-radius:6px;font-style:italic">' + esc(_ad.decisionStructure) + '</div>' : '';
  var _gapsBody = _ad.gaps ? 'The structural gaps you identified in your Phase 1 assessment:<div style="margin-top:6px;padding:10px 12px;background:rgba(var(--fg-rgb),.04);border-radius:6px;font-style:italic">' + esc(_ad.gaps) + '</div>' : '';
  var secs = [{ id: 'ownership', l: 'Transformation Ownership' }, { id: 'board', l: 'Board Governance' }, { id: 'senior', l: 'Senior Leadership' }, { id: 'middle', l: 'Middle Management' }, { id: 'crossfunc', l: 'Cross-Functional Coordination' }];
  var sec = UI.structSec || 'ownership';
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Structure Lab</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Design the leadership architecture for AI transformation. Work through five dimensions. The output becomes your Leadership Structure chart, an org chart you will maintain after the 90-day program.</p>';
  // Section tabs
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px">';
  secs.forEach(function (s) { var done = st[s.id + '_done']; h += '<button onclick="harvestFields();saveData();UI.structSec=\'' + s.id + '\';render()" style="padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);border:' + (sec === s.id ? '2px solid #2D5A8E' : done ? '1px solid rgba(27,107,90,.4)' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (done ? 'rgba(27,107,90,.08)' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (sec === s.id ? '#2D5A8E' : done ? '#1B6B5A' : 'var(--text-body)') + '">' + (done ? '\u2713 ' : '') + s.l + '</button>' });
  h += '</div>';
  // Gaps framing block — cross-cutting, shown at the top of every section.
  h += assessBaselineBox('ab_gaps', 'GAPS YOU IDENTIFIED IN YOUR ASSESSMENT', _gapsBody);

  if (sec === 'ownership') {
    var _ownerRole = st.ownerRoleId ? ((data.orgChart || []).filter(function (r) { return r.id === st.ownerRoleId; })[0] || null) : null;
    var _ownerAdded = !!_ownerRole;
    var _ownerOcc = _ownerRole ? roleOccupant(_ownerRole) : null;
    // Reporting-line options: board + existing roles (excluding the ownership role itself).
    var _rtOpts = '<option value="board"' + ((!_ownerRole || !_ownerRole.parentId || _ownerRole.parentId === 'board') ? ' selected' : '') + '>Board (top level)</option>';
    (data.orgChart || []).forEach(function (r) {
      if (r.id === 'board') return; if (_ownerRole && r.id === _ownerRole.id) return;
      _rtOpts += '<option value="' + esc(r.id) + '"' + ((_ownerRole && _ownerRole.parentId === r.id) ? ' selected' : '') + '>' + esc(r.name || 'Role') + '</option>';
    });
    var _ownerBtn = '<div style="margin:4px 0 4px;padding-top:16px;border-top:1px solid rgba(var(--fg-rgb),.08)">';
    if (_ownerAdded) {
      _ownerBtn += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<span style="display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:12px;color:#1B6B5A"><span style="width:18px;height:18px;border-radius:9px;background:#1B6B5A;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px">\u2713</span>Added to org chart as <strong style="color:var(--paper)">' + esc(_ownerRole.name || '') + '</strong>' + (_ownerOcc ? ' \u2014 filled by ' + esc(_ownerOcc.name) : ' \u2014 currently vacant') + '</span>'
        + '</div>'
        + '<div style="font-size:12px;color:var(--text-body);margin-top:8px;line-height:1.5">The role is on the org chart below. Click its box to view it and assign a person when the organization is ready \u2014 you do not have to fill it now.</div>';
    } else {
      _ownerBtn += btn('+ Add to org chart', 'addOwnerRoleToChart()', 'bp', 'font-size:12px;padding:8px 14px')
        + '<div style="font-size:12px;color:var(--text-body);margin-top:8px;line-height:1.5">Creates this role on the org chart, initially vacant. You can assign a person to it later by clicking its box in the chart.</div>';
    }
    _ownerBtn += '</div>';
    h += card('<h3 class="h-sub-lg">Transformation Ownership</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">The structural gap between technology management and enterprise-wide transformation is where many AI strategies fail. CIOs\u2019 time is dominated by operational demands: in survey research cited in <a href="https://faisalhoque.com/why-ai-demands-a-new-breed-of-leaders/" target="_blank" rel="noopener" class="vp-link">MIT Sloan Management Review</a>, 61% of CIOs reported having less time for strategic responsibilities than in previous years. Someone must own the cultural, strategic, and organizational dimensions of AI transformation alongside the technical ones.</p>'
      + assessBaselineBox('ab_ownership', 'CURRENT STATE \u2014 FROM YOUR ASSESSMENT', _ownBody)
      + recBox('rr_own_newbreed', 'Why AI Demands a New Breed of Leaders', 'Faisal Hoque, Thomas H. Davenport &amp; Erik Nelson', 'MIT Sloan Management Review', 'https://faisalhoque.com/why-ai-demands-a-new-breed-of-leaders/', 'Argues that AI transformation is a leadership and cultural challenge, not just a technical one, and that organizations need a dedicated senior role \u2014 a chief innovation and transformation officer \u2014 to own the organizational and cultural change AI adoption demands. Useful context as you decide who should own the transformation here.')
      + sel('Based on your Phase 1 assessment, what ownership model will you adopt?', 'st_ownerModel', st.ownerModel, [{ v: '', l: 'Select one\u2026' }, { v: 'cito', l: 'Create a Chief Innovation & Transformation Officer role' }, { v: 'cao', l: 'Create a Chief AI Officer role' }, { v: 'ctro', l: 'Create a Chief Transformation Officer role' }, { v: 'expand_cio', l: 'Expand the Chief Information Officer role with explicit cultural/strategic mandate' }, { v: 'council', l: 'Create a cross-functional AI Transformation Council' }, { v: 'dual', l: 'Dual ownership: technology leader + cultural/strategic leader jointly' }])
      + '<div style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Who does this role report to?</label><select id="st_ownerReportsTo" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);box-sizing:border-box;background:#fff;color:#1a1612">' + _rtOpts + '</select></div>'
      + ta('What changes from the current state? What resistance do you anticipate?', 'st_ownerChange', st.ownerChange, 'A reflection prompt \u2014 this is not stored on the role', 3)
      + _ownerBtn);
    if (_ownerAdded) {
      h += card('<div style="font-family:var(--mono);font-size:11px;color:var(--gold);letter-spacing:.06em;margin-bottom:6px">ORG CHART</div><p style="color:var(--text-body);margin:0 0 16px;font-size:13px;line-height:1.6">Your new ownership role is on the chart. Click any box to view it and assign or change its occupant \u2014 this is the same chart that appears on the Leadership Dashboard.</p>');
      h += renderOrgChartInteractive(data.orgChart || [], data.leaders || []);
      h += card(''
        + '<div>'
        + btn('+ Add New Leader', 'UI.addLeaderOpen=true;UI.editIdx=null;UI.scrollTo=\'addLeaderPanelCard\';render()', 'bg2', 'font-size:12px;padding:8px 14px')
        + '<div style="font-size:12px;color:var(--text-body);margin-top:8px;line-height:1.5">Need to add a person to assign to this role? Add them right here. They join the Leadership Inventory and appear throughout the module, and you can then assign them to the role by clicking its box above.</div>'
        + '</div>');
      if (UI.addLeaderOpen) h += '<div id="addLeaderPanelCard">' + addLeaderPanel() + '</div>';
    }
    h += card(doneBtn('saveStructSec(\'ownership\')', false, null, st[sec + '_done'] === true), 'background:none;border:none;padding:0');
  }


  if (sec === 'board') {
    h += card('<h3 class="h-sub-lg">Board-Level AI Governance</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">AI decisions have board-level implications \u2014 strategic, ethical, financial, and reputational. The board needs a structure for substantive oversight, not just an annual briefing.</p>'
      + assessBaselineBox('ab_board', 'CURRENT STATE \u2014 FROM YOUR ASSESSMENT', _boardBody)
      // Ruled 25 July: membership is the first thing they work on \u2014 expertise below attaches to these members.
      + '<div style="margin:4px 0 16px;padding:18px;border:1px solid rgba(27,107,90,.35);border-radius:10px;background:rgba(27,107,90,.06)">'
      + '<div style="font-family:var(--serif);font-size:18px;font-weight:600;color:var(--paper);margin-bottom:2px">Board Membership</div>'
      + '<div style="font-size:12px;color:var(--text-body);margin-bottom:14px;line-height:1.6">Who sits on the board. Select the leaders from your inventory who are board members, and add any external or non-executive directors. This populates the board on your org chart.</div>'
      + memberStaffingBlock('board', { noun: 'board' })
      + '</div>'
      + '<div class="mb-4"><label class="form-label">Board AI oversight structure</label><select id="st_boardStructure" class="sel-helper" onchange="var w=document.getElementById(\'st_boardStructureOtherWrap\');if(w)w.style.display=(this.value===\'other\'?\'block\':\'none\')"><option value=""' + (st.boardStructure ? '' : ' selected') + '>Select one\u2026</option><option value="dedicated"' + (st.boardStructure === 'dedicated' ? ' selected' : '') + '>Dedicated AI/Technology committee</option><option value="expanded"' + (st.boardStructure === 'expanded' ? ' selected' : '') + '>Expand existing Risk or Strategy committee</option><option value="standing"' + (st.boardStructure === 'standing' ? ' selected' : '') + '>Standing AI agenda item on full board</option><option value="none"' + (st.boardStructure === 'none' ? ' selected' : '') + '>No formal board oversight (will create)</option><option value="other"' + (st.boardStructure === 'other' ? ' selected' : '') + '>Other (please specify)</option></select></div>'
      + '<div id="st_boardStructureOtherWrap" style="display:' + (st.boardStructure === 'other' ? 'block' : 'none') + ';margin:-8px 0 16px"><label class="form-label">Please specify</label><input id="st_boardStructureOther" type="text" value="' + esc(st.boardStructureOther || '') + '" placeholder="Describe your oversight structure" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.05);color:var(--paper);font-size:14px;font-family:var(--sans);box-sizing:border-box"></div>'
      + boardExpertisePicker()
      + ta('Board AI expertise gaps: What knowledge is missing at board level?', 'st_boardExpertiseGaps', st.boardExpertiseGaps, 'Where does the board lack the expertise needed for substantive AI oversight?', 3)
      + ta('What decisions should require board-level approval vs. management authority?', 'st_boardDecisions', st.boardDecisions, 'e.g. AI investments above a threshold, workforce reduction decisions, ethical boundary questions', 3)
      + ta('Board education plan: How will you build AI literacy at board level?', 'st_boardEducation', st.boardEducation, '', 3)
      + doneBtn('saveStructSec(\'board\')', false, null, st[sec + '_done'] === true));
  }

  if (sec === 'senior') {
    h += card('<h3 class="h-sub-lg">Senior Leadership Layer</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">AI transformation is not something the CIO does while the rest of the leadership team watches. Every senior leader has AI responsibilities. Map accountability and decision rights explicitly.</p>'
      + assessBaselineBox('ab_decision', 'CURRENT DECISION-MAKING \u2014 FROM YOUR ASSESSMENT', _decBody)
      + recBox('rr_src_reinvent', 'REINVENT: Navigating Business Transformation in a Hyper-Digital Era', 'Faisal Hoque', 'Fast Company Press', 'https://faisalhoque.com/all-books/', 'The #1 Wall Street Journal bestseller, published in association with IMD. Chapter 9 develops the networked governance model; Chapter 10, enterprise portfolio management.', '12px')
      + ta('Decision rights map: Who can approve AI investments, who can halt projects, who owns workforce impact decisions?', 'st_seniorDecisionRights', st.seniorDecisionRights, 'Be specific \u2014 name individuals or roles', 4)
      + ta('Accountability structure: Which leader is accountable for each domain where AI will be deployed?', 'st_seniorAccountability', st.seniorAccountability, 'e.g. Operations AI \u2192 COO, Customer AI \u2192 CMO, Data infrastructure \u2192 CIO', 4)
      + ta('How will you ensure cross-functional alignment rather than competing AI fiefdoms?', 'st_seniorAlignment', st.seniorAlignment, '', 3)
      + doneBtn('saveStructSec(\'senior\')', false, null, st[sec + '_done'] === true));
  }

  if (sec === 'middle') {
    h += card('<h3 class="h-sub-lg">Middle Management Principles</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Middle managers are the connective tissue between strategy and execution. The question is not which middle management roles to eliminate, but which require human judgment that algorithms cannot replicate. Define your principles now. Phase 3 will activate them.</p>'
      + recBox('rr_ld_ethics', 'The Looming AI Risk: Automating Middle Management Destroys a Critical Ethical Layer', 'Faisal Hoque, Pranay Sanklecha, and Paul Scade', 'I by IMD', 'https://www.imd.org/ibyimd/artificial-intelligence/the-looming-ai-risk-automating-middle-management-destroys-critical-ethical-layer/', 'Examines the special duties of middle managers and the catastrophic consequences of eliminating human judgment from operational decisions.', '12px')
      + '<p style="color:var(--paper);font-size:14px;line-height:1.6;margin-bottom:16px">For each major category of middle management work, determine which of the three groups below it belongs in.</p>'
      + ta('Automate now: Tasks that are purely mechanical, rule-based, and have no ethical or judgment dimension', 'st_mmAutomate', st.mmAutomate, 'e.g. Routine reporting, scheduling, data aggregation', 3)
      + ta('Augment now, automate later: Tasks where AI can assist but human oversight is still needed during the transition', 'st_mmAugment', st.mmAugment, 'e.g. Performance monitoring, resource allocation, process optimization', 3)
      + ta('Human judgment permanent: Tasks that require ethical reasoning, contextual understanding, or relational skills that must remain human', 'st_mmHuman', st.mmHuman, 'e.g. Employee wellbeing decisions, ethical boundary calls, conflict resolution, mentoring', 3)
      + doneBtn('saveStructSec(\'middle\')', false, null, st[sec + '_done'] === true));
  }

  if (sec === 'crossfunc') {
    var _wantCouncil = (st.coordMechanism === 'council');
    if (_wantCouncil) syncCouncilNode();
    var _councilBlock = '';
    if (_wantCouncil) {
      _councilBlock = '<div style="font-family:var(--mono);font-size:11px;color:var(--gold);letter-spacing:.06em;margin:8px 0 6px;padding-top:16px;border-top:1px solid rgba(var(--fg-rgb),.08)">COUNCIL MEMBERSHIP</div>'
        + '<p style="color:var(--text-body);margin:0 0 12px;font-size:13px;line-height:1.6">Staff the AI Transformation Council. Select the leaders from your inventory who sit on it, and add any external members. The council appears on your org chart as a cross-functional body.</p>'
        + memberStaffingBlock('crossfunc', { noun: 'council' });
    } else {
      _councilBlock = '<div style="margin-top:16px;padding:14px 16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;font-size:13px;color:var(--text-body);line-height:1.6">Choose <strong style="color:var(--paper)">AI Transformation Council</strong> as your coordination mechanism above to staff a council and place it on your org chart. The other mechanisms don\u2019t add a standing body to the chart.</div>';
    }
    h += card('<h3 class="h-sub-lg">Cross-Functional Coordination</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">AI cuts across every function. In <a href="https://www.businesswire.com/news/home/20200617005059/en/" target="_blank" rel="noopener" class="vp-link">a 2020 Accenture study</a>, 75% of 1,550 senior executives said their departments compete rather than collaborate on digitization. Design the coordination mechanisms that prevent AI transformation from becoming a new source of silos.</p>'
      + assessBaselineBox('ab_crossfunc', 'CURRENT STATE \u2014 FROM YOUR ASSESSMENT', _cfBody)
      + sel('Primary coordination mechanism', 'st_coordMechanism', st.coordMechanism, [{ v: '', l: 'Select one\u2026' }, { v: 'council', l: 'AI Transformation Council (cross-functional standing body)' }, { v: 'epmo', l: 'Enterprise Portfolio Management Office' }, { v: 'matrix', l: 'Matrix reporting for AI leads embedded in functions' }, { v: 'rotation', l: 'Leadership rotation through AI-intensive projects' }, { v: 'network', l: 'Innovation network model (REINVENT)' }])
      + ta('Meeting cadence and participants', 'st_coordCadence', st.coordCadence, 'e.g. Fortnightly cross-functional AI sync, all department heads + AI owner', 3)
      + ta('How will you manage conflicts between functions competing for AI resources or pursuing conflicting AI strategies?', 'st_coordConflict', st.coordConflict, '', 3)
      + ta('What information flows between functions? What decisions require cross-functional input?', 'st_coordInfo', st.coordInfo, '', 3)
      + _councilBlock
      + doneBtn('saveStructSec(\'crossfunc\')', false, null, st[sec + '_done'] === true));
  }
  var _all21 = ['ownership', 'board', 'senior', 'middle', 'crossfunc'].every(function (s) { return (data.structure || {})[s + '_done'] });
  if (_all21 || isStepDone('2.1')) h += doneBtn('markStepComplete(\'2.1\')', false, null, '2.1');
  return h;
}
function saveStructSec(secId) {
  if (lockBlocked('structure')) return; if (!((data.structure || {})[secId + '_done']) && !confirm('Mark this section complete? This can\u2019t be undone.')) return;
  harvestFields(); if (!data.structure) data.structure = {};
  var fields = { ownership: ['ownerModel', 'ownerWho', 'ownerChange', 'ownerName'], board: ['boardStructure', 'boardStructureOther', 'boardExpertise', 'boardExpertiseGaps', 'boardDecisions', 'boardEducation'], senior: ['seniorDecisionRights', 'seniorAccountability', 'seniorAlignment'], middle: ['mmAutomate', 'mmAugment', 'mmHuman'], crossfunc: ['coordMechanism', 'coordCadence', 'coordConflict', 'coordInfo'] };
  (fields[secId] || []).forEach(function (f) { var el = $('st_' + f); if (el) data.structure[f] = el.value });
  data.structure[secId + '_done'] = true;
  // Ruled 25 July: sections never complete the step — markStepComplete('2.1') owns it.
  var order = ['ownership', 'board', 'senior', 'middle', 'crossfunc']; var idx = order.indexOf(secId);
  if (idx < order.length - 1) UI.structSec = order[idx + 1];
  saveData(); render();
}
// Map the ownership-model selection to a concrete role title.
function ownerModelTitle(model) {
  var m = {
    cito: 'Chief Innovation & Transformation Officer',
    cao: 'Chief AI Officer',
    ctro: 'Chief Transformation Officer',
    expand_cio: 'Chief Information Officer (AI-expanded)',
    council: 'AI Transformation Council Lead',
    dual: 'AI Transformation Co-Lead'
  };
  return m[model] || 'AI Transformation Owner';
}
// Add (or update) the AI-transformation ownership role as a LEADER in the inventory.
// Because it is a leader, it flows through phase1ChartRoles/reconcile onto the chart
// and is assessed like every other leader.
function addOwnerRoleToChart() {
  if (lockBlocked('orgChart') || lockBlocked('structure')) return;
  var st = data.structure || {};
  var model = (typeof val === 'function' && val('st_ownerModel')) || st.ownerModel || '';
  if (!model) { alert('Choose an ownership model first.'); return; }
  function fv(id) { return (typeof val === 'function' && val(id)) || ''; }
  var title = ownerModelTitle(model);
  var reportsTo = fv('st_ownerReportsTo') || 'board';
  if (!data.structure) data.structure = {};
  data.structure.ownerModel = model;
  if (!data.orgChart) data.orgChart = [];
  // Create (or update) the ownership role as an UNTETHERED, initially VACANT role.
  // Who fills it is decided later by clicking the box in the chart below -- the org
  // need not assign a person now.
  var existingId = data.structure.ownerRoleId;
  var existing = existingId ? data.orgChart.filter(function (r) { return r.id === existingId; })[0] : null;
  if (existing) {
    existing.name = title;
    existing.parentId = reportsTo;
  } else {
    var rid = 'role_' + uid();
    data.orgChart.push({ id: rid, name: title, level: 2, parentId: reportsTo, occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: [], source: 'leader' });
    data.structure.ownerRoleId = rid;
    existing = data.orgChart.filter(function (r) { return r.id === rid; })[0];
  }
  // Derive the role's level from its reporting position.
  if (typeof assignRoleParent === 'function') { assignRoleParent(existing.id, reportsTo); }
  // Select the new role so its detail (and occupant assignment) shows in the chart below.
  UI.orgSelected = existing.id; UI.orgEditId = null;
  syncPhase1Chart();
  saveData();
  if (typeof render === 'function') render();
}


/* ═══ STEP 2.2: AI Collaboration Lab ═══ */


/* ═══ STEP 2.2: AI Collaboration Lab ═══ */
function renderStep22(){
  var cl=data.collabLab||{};
  var secs=[{id:'touchpoints',l:'Touchpoint Mapping'},{id:'models',l:'Collaboration Models'},{id:'personas',l:'AI Persona Design'},{id:'aifree',l:'AI-Free Zones'},{id:'translation',l:'Translation Layer'}];
  var sec=UI.collabSec||'touchpoints';
  var h='<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">AI Collaboration Lab</h2>';
  h+='<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">This is a thinking lab, not a configuration tool. Work through five dimensions of how humans and AI will interact in your organization. The output is a set of guiding principles, not a tracked dashboard object.</p>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px">';
  secs.forEach(function(s){var done=cl[s.id+'_done'];h+='<button onclick="harvestFields();saveData();UI.collabSec=\''+s.id+'\';render()" style="padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);border:'+(sec===s.id?'2px solid #2D5A8E':done?'1px solid rgba(27,107,90,.4)':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(done?'rgba(27,107,90,.08)':'rgba(var(--fg-rgb),.03)')+';color:'+(sec===s.id?'#2D5A8E':done?'#1B6B5A':'var(--text-body)')+'">'+(done?'\u2713 ':'')+s.l+'</button>'});
  h+='</div>';

  if(sec==='touchpoints'){
    h+=card('<h3 class="h-sub-lg">Touchpoint Mapping</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Map every point where AI interacts with humans in your organization, or will once AI is deployed. This includes customer-facing interactions, internal workflows, decision support, and agent-to-agent processes.</p>'
      +ta('Customer-facing AI touchpoints (current and planned)','cl_touchCustomer',cl.touchCustomer,'e.g. Chatbot on website, AI-generated product recommendations, automated email responses',3)
      +ta('Internal workflow AI touchpoints','cl_touchInternal',cl.touchInternal,'e.g. AI-assisted report drafting, automated scheduling, AI screening of applications',3)
      +ta('Decision support AI touchpoints','cl_touchDecision',cl.touchDecision,'e.g. AI-generated analytics dashboards, predictive models for strategy, risk scoring',3)
      +ta('Agent-to-agent processes (where AI systems interact with each other)','cl_touchAgent',cl.touchAgent,'e.g. Automated supply chain optimization feeding into pricing algorithms',3)
      +doneBtn('saveCollabSec(\'touchpoints\')',false,null,cl[sec+'_done']===true));
  }

  if(sec==='models'){
    h+=card('<h3 class="h-sub-lg">Collaboration Models</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Not every human-AI interaction follows the same model. For each domain, determine which model is appropriate.</p>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">'
      +card('<div style="font-size:14px;font-weight:700;color:#1B6B5A;margin-bottom:4px">Advisor</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI provides analysis and recommendations. Humans make all decisions.</p>','border-top:3px solid #1B6B5A;padding:14px')
      +card('<div style="font-size:14px;font-weight:700;color:#2D5A8E;margin-bottom:4px">Augmenter</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI handles parts of the workflow. Humans retain oversight and final authority.</p>','border-top:3px solid #2D5A8E;padding:14px')
      +card('<div style="font-size:14px;font-weight:700;color:#8B5E3C;margin-bottom:4px">Autonomous Agent</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI operates independently within defined boundaries. Humans intervene by exception.</p>','border-top:3px solid #8B5E3C;padding:14px')
      +card('<div style="font-size:14px;font-weight:700;color:#9B2D3F;margin-bottom:4px">Competitor</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI and humans tackle the same problem independently. Results are compared to drive innovation.</p>','border-top:3px solid #9B2D3F;padding:14px')
      +'</div>');
    // Structured function-model mapping
    var funcModels=data.collabLab?data.collabLab.functionModels||[]:[];
    if(funcModels.length){
      funcModels.forEach(function(fm,i){
        var mc={'advisor':'#1B6B5A','augmenter':'#2D5A8E','autonomous':'#8B5E3C','competitor':'#9B2D3F','facilitator':'#6B4C8A'};
        var mn=COLLAB_MODEL_LABELS; /* 16 Sep 2026: one definition, read by the step, the page, and the document */
        h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-left:3px solid '+(mc[fm.model]||'#888')+';background:rgba(var(--fg-rgb),.02);margin-bottom:6px">';
        h+='<div style="flex:1"><div style="font-size:14px;font-weight:600;color:var(--paper)">'+esc(fm.name)+'</div></div>';
        h+='<div style="font-family:var(--mono);font-size:10px;color:'+(mc[fm.model]||'#888')+';text-transform:uppercase;letter-spacing:.08em;padding:3px 10px;border:1px solid '+(mc[fm.model]||'#888')+'">'+(mn[fm.model]||fm.model)+'</div>';
        h+='<button onclick="removeFuncModel('+i+')" title="Remove this function" style="background:none;border:none;color:#9B2D3F;cursor:pointer;font-size:14px;padding:2px 6px">\u00D7</button></div>';
      });
    }
    h+='<div style="margin-top:12px;padding:16px;border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
    h+='<div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Add Function</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 220px;gap:12px;align-items:end">';
    h+='<div><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Function name</label><input id="cl_funcName" type="text" placeholder="e.g. Customer Service, Strategic Planning" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);box-sizing:border-box;background:rgba(var(--fg-rgb),.03);color:var(--paper)"></div>';
    h+='<div><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Model type</label><select id="cl_funcModel" onchange="document.getElementById(\'cl_customModelWrap\').style.display=(this.value===\'custom\'?\'block\':\'none\')" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);background:#fff;color:#1a1612;box-sizing:border-box"><option value="">Select model\u2026</option><option value="advisor">Advisor</option><option value="augmenter">Augmenter</option><option value="autonomous">Autonomous Agent</option><option value="competitor">Competitor</option><option value="custom">Custom\u2026</option></select></div>';
    h+='</div>';
    h+='<div id="cl_customModelWrap" style="display:none;margin-top:12px"><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Custom model name</label><input id="cl_customModel" type="text" placeholder="Describe your model" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);box-sizing:border-box;background:rgba(var(--fg-rgb),.03);color:var(--paper)"></div>';
    h+=btn('+ Add Function','addFuncModel()','bp','margin-top:12px');
    h+='</div>';
    h+=doneBtn('saveCollabSec(\'models\')',false,null,cl[sec+'_done']===true);
  }

  if(sec==='personas'){
    h+=card('<h3 class="h-sub-lg">AI Persona Design</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">AI systems present themselves differently depending on context. A customer-facing AI needs conversational warmth. An internal analytics AI needs precision and speed. An agent-to-agent AI needs machine-readable clarity. These are not cosmetic differences. The persona shapes whether the humans on the other end can work with the system effectively.</p>'
      +'<p style="color:var(--paper);font-size:14px;line-height:1.6;margin-bottom:16px">Use the TRANSCEND framework: <strong>Function</strong> (what do we want it to do?), <strong>Epistemic Perspective</strong> (what information does it have access to?), <strong>Relationship</strong> (what relationship do we want with this AI?).</p>'
      +recBox('rr_src_transcend','TRANSCEND: Unlocking Humanity in the Age of AI','Faisal Hoque','Post Hill Press','https://faisalhoque.com/all-books/','','12px','','pp. 45\u201349')
      +ta('Customer-facing AI personas: How should AI present itself to customers?','cl_personaCustomer',cl.personaCustomer,'Consider tone, speed, boundaries, escalation triggers',3)
      +ta('Internal AI personas: How should AI present itself to employees?','cl_personaInternal',cl.personaInternal,'Consider authority level, language register, decision-making scope',3)
      +ta('What behaviors must AI personas never exhibit?','cl_personaBoundaries',cl.personaBoundaries,'e.g. Never make promises on behalf of the company, never access personal data without consent',3)
      +doneBtn('saveCollabSec(\'personas\')',false,null,cl[sec+'_done']===true));
  }

  if(sec==='aifree'){
    h+=card('<h3 class="h-sub-lg">AI-Free Zones</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">When everyone uses the same AI tools trained on the same data, outputs converge toward generic mediocrity. Competitive advantage in the AI era comes from authentic difference. Some spaces must remain exclusively human.</p>'
      +recBox('rr_src_7things','7 Things Every Leader Must Do to Prepare Their Organization for 2026','Faisal Hoque','Fast Company','https://www.fastcompany.com/91462416/leaders-prepare-organization-2026-ai','Seven priorities for leading AI transformation by intent rather than drift, from reimagining middle management to building authentic competitive difference.','12px')
      +ta('Where in your organization should only humans operate? Why?','cl_aiFreeZones',cl.aiFreeZones,'Consider: creative ideation, final hiring decisions, setting organizational purpose, ethical boundary calls, mentoring relationships',4)
      +ta('What proprietary knowledge or processes must be protected from AI commodification?','cl_proprietary',cl.proprietary,'What is distinctive about your organization that AI should not be allowed to smooth away?',3)
      +ta('What skills are at risk of atrophying if fully delegated to AI? (Connect back to your Dependency Scan from Phase 1.)','cl_atrophyRisks',cl.atrophyRisks,'',3)
      +doneBtn('saveCollabSec(\'aifree\')',false,null,cl[sec+'_done']===true));
  }

  if(sec==='translation'){
    h+=card('<h3 class="h-sub-lg">The Translation Layer</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">When algorithms speak to other algorithms, language changes from a medium for human understanding into code for machine processing. Leaders need translators \u2014 people and processes that can interpret algorithmic signals and reconnect them with human insight. A r\u00e9sum\u00e9 may score well, but does the candidate bring originality? A post may perform, but did it actually persuade?</p>'
      +recBox('rr_src_autonomous','Leadership in a World of Autonomous Algorithms','Faisal Hoque','Fast Company','https://faisalhoque.com/leadership-in-a-world-of-autonomous-algorithms/','How leadership changes when AI systems act independently, and what humans must still own as algorithms take on more of the work.','12px')
      +ta('Who in your organization will serve as translators between AI systems and human decision-makers?','cl_translators',cl.translators,'Name roles or people who can interpret AI outputs for human context',3)
      +ta('What processes will you create to ensure AI outputs are interpreted, not just accepted?','cl_transProcesses',cl.transProcesses,'e.g. Human review layer for AI recommendations, regular audit of AI-driven decisions',3)
      +ta('Where are you currently at risk of mistaking algorithmic proxies for real understanding?','cl_transRisks',cl.transRisks,'e.g. Engagement metrics treated as customer satisfaction, ATS scores treated as talent quality',3)
      +doneBtn('saveCollabSec(\'translation\')',false,null,cl[sec+'_done']===true));
  }
  var _all22=['touchpoints','models','personas','aifree','translation'].every(function(s){return (data.collabLab||{})[s+'_done']});
  if(_all22||isStepDone('2.2'))h+=doneBtn('markStepComplete(\'2.2\')',false,null,'2.2');
  return h;
}
function addFuncModel() {
  if (lockBlocked('collabLab')) return;
  var name = val('cl_funcName'), model = val('cl_funcModel');
  if (!name || !model) return;
  if (model === 'custom') { model = val('cl_customModel') || 'custom'; if (!val('cl_customModel')) return }
  if (!data.collabLab) data.collabLab = {};
  if (!data.collabLab.functionModels) data.collabLab.functionModels = [];
  data.collabLab.functionModels.push({ name: name, model: model });
  saveData(); render();
}
function removeFuncModel(idx) {
  if (lockBlocked('collabLab')) return;
  if (!data.collabLab || !data.collabLab.functionModels) return;
  data.collabLab.functionModels.splice(idx, 1);
  saveData(); render();
}
function saveCollabSec(secId) {
  if (lockBlocked('collabLab')) return; if (!((data.collabLab || {})[secId + '_done']) && !confirm('Mark this section complete? This can\u2019t be undone.')) return;
  harvestFields(); if (!data.collabLab) data.collabLab = {};
  var fields = { touchpoints: ['touchCustomer', 'touchInternal', 'touchDecision', 'touchAgent'], models: ['modelMapping'], personas: ['personaCustomer', 'personaInternal', 'personaBoundaries'], aifree: ['aiFreeZones', 'proprietary', 'atrophyRisks'], translation: ['translators', 'transProcesses', 'transRisks'] };
  (fields[secId] || []).forEach(function (f) { var el = $('cl_' + f); if (el) data.collabLab[f] = el.value });
  data.collabLab[secId + '_done'] = true;
  // Ruled 25 July: sections never complete the step — markStepComplete('2.2') owns it.
  var order = ['touchpoints', 'models', 'personas', 'aifree', 'translation']; var idx = order.indexOf(secId);
  if (idx < order.length - 1) UI.collabSec = order[idx + 1];
  saveData(); render();
}

/* ═══ STEP 2.3: Competency Framework ═══ */
function renderStep23() {
  var cf = data.competencyFramework || {}; var leaders = data.leaders || [];
  var COMPS = [
    { id: 'orchestration', name: 'AI Orchestration', desc: 'Ability to manage hybrid teams of humans and AI, design workflows that integrate both, and make deployment decisions about where AI adds value and where it doesn\u2019t.' },
    { id: 'philosophical', name: 'Philosophical & Ethical Reasoning', desc: 'Capacity to surface, examine, and defend the foundational assumptions embedded in AI tools \u2014 ontological, epistemological, and ethical commitments that shape every AI-driven decision.' },
    { id: 'hybrid', name: 'Hybrid Team Leadership', desc: 'Managing teams where AI systems have defined roles, behavioral traits, and decision-making authority alongside human colleagues. Understanding the emotional dynamics of human-AI collaboration.' },
    { id: 'change', name: 'Change & Transformation', desc: 'Navigating continuous (not episodic) change. Building stable foundations while absorbing ongoing disruption. Managing change fatigue. Co-designing transformation with the people who must live with it.' },
    { id: 'composure', name: 'Composure & Adaptive Judgment', desc: 'Making decisions under uncertainty with incomplete information. Staying calm under pressure. Portfolio thinking over fixed planning. Knowing when to act and when to wait.' },
    { id: 'ecosystem', name: 'Ecosystem Stewardship', desc: 'Managing relationships with AI vendors, partners, regulators, and the broader ecosystem. Understanding competitive dynamics in an AI-driven landscape.' },
    { id: 'emotional', name: 'Emotional Intelligence', desc: 'The human skills that become more valuable as AI handles more cognitive tasks. Empathy, interpersonal judgment, conflict resolution, mentoring, and the ability to build trust in turbulent times.' }
  ];
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Competency Framework</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Seven AI-era leadership competencies. For each, define what good looks like in your organization, then assess each leader from the Leadership Inventory against the framework.</p>';

  // Competency definitions
  COMPS.forEach(function (c) {
    var exKey = 'comp_' + c.id; var exOpen = UI.ctxOpen[exKey];
    h += '<div class="cd" style="margin-bottom:12px;border-left:3px solid #2D5A8E">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="harvestFields();saveData();UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()"><div><h4 style="font-size:15px;font-weight:700;margin:0 0 2px">' + esc(c.name) + '</h4><p style="font-size:12px;color:var(--stone);margin:0;line-height:1.4">' + esc(c.desc) + '</p></div><span style="font-size:11px;color:var(--stone)">' + (exOpen ? '\u25BE' : '\u25B8') + '</span></div>';
    if (exOpen) {
      h += '<div onclick="event.stopPropagation()" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.06)">';
      h += ta('What does this competency look like in your organization? Define observable behaviors.', 'cf_def_' + c.id, (cf.definitions || {})[c.id], 'e.g. Leaders who score high in this competency demonstrate\u2026', 3);
      // Leader assessments
      if (leaders.length) {
        h += '<div style="margin-top:12px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Leader Assessment</div>';
        leaders.forEach(function (l, i) {
          var score = (cf.scores || {})[l.id + '_' + c.id] || 0;
          h += likert(esc(l.name || 'Leader ' + (i + 1)), 'competencyFramework.scores.' + l.id + '_' + c.id, score, 'Weak', 'Strong');
        });
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  });

  // Summary
  if (leaders.length) {
    h += card('<h3 class="h-sub-lg">Gap Summary</h3><p style="color:var(--text-body);margin:0 0 12px;font-size:13px">Average score per competency across all assessed leaders.</p>'
      + COMPS.map(function (c) {
        var vals = leaders.map(function (l) { return (cf.scores || {})[l.id + '_' + c.id] || 0 }).filter(function (v) { return v > 0 });
        var avg = vals.length ? (vals.reduce(function (a, b) { return a + b }, 0) / vals.length) : 0;
        var col = avg >= 4 ? '#1B6B5A' : avg >= 2.5 ? '#4E7FA6' : '#9B2D3F';
        return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><div style="font-size:12px;color:var(--stone);min-width:200px">' + esc(c.name) + '</div><div style="flex:1;height:6px;background:rgba(var(--fg-rgb),.06);border-radius:3px"><div style="height:100%;width:' + avg * 20 + '%;background:' + col + ';border-radius:3px"></div></div><div style="font-family:var(--mono);font-size:12px;color:var(--paper);min-width:30px;text-align:right">' + (avg ? avg.toFixed(1) : '\u2014') + '</div></div>'
      }).join(''));
  }

  h += doneBtn('saveCompetencyFramework()', false, '\u2713 Save Framework & Continue \u2192', '2.3');
  return h;
}
function saveCompetencyFramework() {
  if (!confirmStepDone('2.3')) return;
  harvestFields();
  if (!data.competencyFramework) data.competencyFramework = {};
  if (!data.competencyFramework.definitions) data.competencyFramework.definitions = {};
  ['orchestration', 'philosophical', 'hybrid', 'change', 'composure', 'ecosystem', 'emotional'].forEach(function (id) {
    var el = $('cf_def_' + id); if (el) data.competencyFramework.definitions[id] = el.value;
  });
  data.completedSteps['2.3'] = true; stampStepDone('2.3'); saveData(); render();
}
/* ═══ STEP 2.4: Mindset Depth ═══ */
function renderStep24() {
  var _g = indivGate('Mindset Depth'); if (_g) return _g;
  var md = myIndivRead('mindsetDepth');
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Values Architecture</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Every AI tool your organization adopts arrives with philosophical commitments built into it. If you have not articulated your own positions, you will inherit the positions of whoever designed the tool. This step asks you to make your foundational commitments explicit, then put them to work against concrete decisions.</p>';

  // ── Values Architecture ──
  h += '<div id="sec-values"></div>';

  // Source at top
  h += recBox('rr_phil_complete', 'Great Leaders Question Philosophical Assumptions', 'Faisal Hoque, Paul Scade, Pranay Sanklecha, and Sverre Spoelstra', 'Harvard Business Review', 'https://faisalhoque.com/great-leaders-question-philosophical-assumptions/', 'Identifies three philosophical domains \u2014 ontology, epistemology, and ethics \u2014 and shows why surfacing assumptions in each is essential to AI-era leadership.', '', 'READ BEFORE COMPLETING');

  // Box 1: Ontology — Define your organization
  var ex1Key = 'va_ex_org'; var ex1Open = UI.ctxOpen[ex1Key];
  h += card('<div style="border-top:3px solid #2D5A8E;margin:-24px -24px 16px;padding:16px 24px 0"><h3 class="h-sub">Ontology: Define Your Organization</h3>' + badge('Foundational', '#2D5A8E') + '</div>'
    + '<p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Ontological questions ask what things really are. What is your organization for? Milton Friedman argued that a business exists to maximize shareholder returns within a limited set of rules. Peter Drucker offered a fundamentally different answer: the corporation is a social institution through which people organize their collective lives. Most leadership teams have never consciously chosen between views like these. Instead, decisions are made on unexamined defaults applied inconsistently from person to person.</p>'
    + '<div onclick="UI.ctxOpen[\'' + ex1Key + '\']=!UI.ctxOpen[\'' + ex1Key + '\'];render()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.1);cursor:pointer;margin-bottom:12px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)">' + (ex1Open ? '\u25BE' : '\u25B8') + ' Example: Friedman vs Drucker</div>'
    + (ex1Open ? '<div style="padding:14px 16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08);margin-bottom:16px;border-left:3px solid #2D5A8E"><p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0">A leader who accepts Friedman\u2019s view will approach decisions about culture, workforce investment, and community engagement as costs to be minimised. A leader who accepts Drucker\u2019s view will approach the same decisions as investments in the institution\u2019s social fabric. Neither is inherently wrong \u2014 but a leadership team that hasn\u2019t aligned around one or the other will make inconsistent decisions. The exercise below asks you to surface this alignment.</p></div>' : '')
    + ta('What is your organization? Write a one or two sentence definition that goes beyond its commercial function.', 'md_val1', md.val1, 'Ask each member of the senior team to do this independently, then compare. Where the answers diverge will show you where the team is not ontologically aligned.', 4)
    , 'margin-bottom:16px');

  // Box 2: Ontology — Define core concepts
  var ex2Key = 'va_ex_data'; var ex2Open = UI.ctxOpen[ex2Key];
  h += card('<div style="border-top:3px solid #2D5A8E;margin:-24px -24px 16px;padding:16px 24px 0"><h3 class="h-sub">Ontology: Define Your Core Concepts</h3>' + badge('Applied', '#2D5A8E') + '</div>'
    + '<p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Beyond defining the organization itself, leaders carry assumptions about what their core concepts really are \u2014 what a customer is, what data is, what an employee is. These assumptions determine how the concept is treated at every level of the business.</p>'
    + '<div onclick="UI.ctxOpen[\'' + ex2Key + '\']=!UI.ctxOpen[\'' + ex2Key + '\'];render()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.1);cursor:pointer;margin-bottom:12px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)">' + (ex2Open ? '\u25BE' : '\u25B8') + ' Example: Apple on Customer Data</div>'
    + (ex2Open ? '<div style="padding:14px 16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08);margin-bottom:16px;border-left:3px solid #2D5A8E"><p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0">The question of what customer data is has become one of the most consequential ontological questions in business. A leader who sees it as a raw material available to be extracted and monetised will use it in certain ways. A leader who sees it as a digital embodiment of a relationship with the customer will use the same data in fundamentally different ways. Under Tim Cook, Apple built part of its corporate identity around the second view, treating privacy as a fundamental human right. This is not just data policy \u2014 it shapes product design, business models, and how the company and its users view themselves.</p></div>' : '')
    + ta('Pick something central to your business \u2014 your product, your customer, your data, your culture. What is it?', 'md_val2', md.val2, 'Write a definition that the whole leadership team could align around. Then identify where current practice diverges from that definition.', 4)
    , 'margin-bottom:16px');

  // Box 3: Epistemology
  var ex3Key = 'va_ex_epist'; var ex3Open = UI.ctxOpen[ex3Key];
  h += card('<div style="border-top:3px solid #8B5E3C;margin:-24px -24px 16px;padding:16px 24px 0"><h3 class="h-sub">Epistemology: What Counts as Evidence?</h3>' + badge('Standards', '#8B5E3C') + '</div>'
    + '<p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Leaders make epistemic judgments constantly \u2014 deciding what evidence is sufficient for action, which sources to trust, whose expertise to defer to, and what level of uncertainty is acceptable. Most organizations do this informally. The best ones make their epistemic commitments explicit.</p>'
    + '<div onclick="UI.ctxOpen[\'' + ex3Key + '\']=!UI.ctxOpen[\'' + ex3Key + '\'];render()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.1);cursor:pointer;margin-bottom:12px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)">' + (ex3Open ? '\u25BE' : '\u25B8') + ' Examples: Tony\u2019s Chocolonely & Toyota</div>'
    + (ex3Open ? '<div style="padding:14px 16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08);margin-bottom:16px;border-left:3px solid #8B5E3C"><p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0 0 10px">Tony\u2019s Chocolonely was founded after a journalist\u2019s investigations into child labor in the cocoa supply chain. The company embedded that challenge in its operations through five sourcing principles, which formalise how claims about ethical sourcing must be supported, revisited, and tested against what the company is able to know. Knowledge claims must be backed by evidence, not just certification.</p><p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0">Toyota\u2019s doctrine of Genchi Genbutsu \u2014 \u201Cgo and see for yourself\u201D \u2014 mandates that the best way to understand a problem is to go to where the problem exists and encounter it directly, rather than relying on reports or second-hand data. This is a formal epistemic norm built into the company\u2019s operating culture.</p></div>' : '')
    + ta('What are your organization\u2019s epistemic standards? When a claim is made \u2014 by a person, a report, or an AI system \u2014 what does your organization require before treating it as reliable?', 'md_val3', md.val3, 'Identify a recent decision that turned out badly. What did the team believe at the time? Where did that belief come from? If no one can trace the origins, it was never held in a defensible way.', 4)
    , 'margin-bottom:16px');

  // Box 4: Ethics
  var ex4Key = 'va_ex_ethics'; var ex4Open = UI.ctxOpen[ex4Key];
  h += card('<div style="border-top:3px solid #9B2D3F;margin:-24px -24px 16px;padding:16px 24px 0"><h3 class="h-sub">Ethics: What Will You Defend at Cost?</h3>' + badge('Commitments', '#9B2D3F') + '</div>'
    + '<p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Ethical proficiency is not corporate social responsibility or brand positioning. It is the capacity to examine what constitutes the good, to set out and defend the company\u2019s own ethical stances, and to hold those stances when it costs something to do so.</p>'
    + '<div onclick="UI.ctxOpen[\'' + ex4Key + '\']=!UI.ctxOpen[\'' + ex4Key + '\'];render()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.1);cursor:pointer;margin-bottom:12px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)">' + (ex4Open ? '\u25BE' : '\u25B8') + ' Example: Anthropic & the Pentagon</div>'
    + (ex4Open ? '<div style="padding:14px 16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08);margin-bottom:16px;border-left:3px solid #9B2D3F"><p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0">In February 2026, the Pentagon gave Anthropic an ultimatum: accept contractual clauses permitting the US military to use the company\u2019s technology for \u201Cany lawful use,\u201D or lose the contract. Anthropic insisted on two restrictions \u2014 no use for mass domestic surveillance and no use for fully autonomous weapons \u2014 and refused to drop them. The Pentagon cut the company off and gave the contract to a competitor. Anthropic knew the precise contours of its ethical commitments, could articulate why those commitments existed, and held to them at significant commercial cost.</p></div>' : '')
    + ta('Identify three positions your organization currently holds that are based on a view about ethical values. For each, ask: would you maintain this position if it cost 10% of revenue?', 'md_val4', md.val4, 'If the answer is no, it is not grounded in a real ethical commitment. It is either a marketing position or a security blanket. Knowing the difference is the beginning of ethical proficiency.', 4)
    , 'margin-bottom:16px');

  // ── Theory Into Practice ──
  h += '<div style="font-family:var(--serif);font-size:24px;font-weight:300;margin:32px 0 8px">Theory Into Practice</div>';
  h += '<p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Recognizing that a question is ontological, that an epistemic standard needs defending, or that an ethical commitment has never been tested is not the same as knowing what to do about it under real pressure. Apply your Values Architecture to concrete decisions your organization is facing.</p>';

  h += card(ta('Case 1: Pick an AI tool your organization currently uses. What philosophical assumptions are embedded in it? What does it treat as \u201Cgood\u201D output? What data does it privilege? What does it exclude?', 'md_case1', md.case1, '', 4)
    + ta('Case 2: Describe a recent decision where AI-generated data influenced the outcome. What counted as evidence? Were alternative forms of evidence considered?', 'md_case2', md.case2, '', 4)
    + ta('Case 3: Identify a situation where your organization\u2019s stated values could conflict with AI efficiency. How would you resolve it?', 'md_case3', md.case3, 'e.g. An AI system recommends reducing customer service staff by 40%. Your values say people matter. What do you do?', 4)
    , 'border-top:3px solid #8B5E3C;margin-bottom:16px');

  h += doneBtn('saveMindsetDepth()', false, null, '2.4');
  return h;
}
function saveMindsetDepth() {
  if (!confirmIndivStepDone('2.4')) return; /* Item-7: decline writes nothing */
  harvestFields();
  var md = myIndivStore('mindsetDepth'); if (!md) { alert('Link your account to a leader first.'); return; }
  ['val1', 'val2', 'val3', 'val4', 'val5', 'case1', 'case2', 'case3'].forEach(function (f) {
    var el = $('md_' + f); if (el) md[f] = el.value;
  });
  markIndivDone('2.4'); saveData(); render();
}


/* ═══ STEP 3.1: AI Fluency Sprint ═══ */
function renderStep31() {
  var fl = data.fluencySprint || {}; var leaders = data.leaders || [];
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">AI Fluency Sprint</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Fluency does not come from reading about AI. It comes from using it. By the end of this step, every senior leader should be actively using AI tools in their daily work. This is not optional.</p>';
  // Per-leader tasks
  h += '<div style="font-family:var(--serif);font-size:20px;font-weight:300;margin:24px 0 8px">Three Leadership Tasks with AI</div>';
  h += '<p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Each leader completes three tasks from their real work using AI tools this week. Document what you did, which tool you used, and what you learned.</p>';
  if (leaders.length) {
    leaders.forEach(function (l, i) {
      var lt = (fl.leaderTasks || {})[l.id] || {};
      var exKey = 'fl_ldr_' + l.id; var exOpen = UI.ctxOpen[exKey];
      h += '<div class="cd" style="margin-bottom:12px;border-left:3px solid #8B5E3C">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="harvestFields();saveData();UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()"><div><h4 style="font-size:15px;font-weight:700;margin:0">' + esc(l.name || 'Leader ' + (i + 1)) + '</h4><div style="font-size:12px;color:var(--stone)">' + esc(leaderRoleName(l)) + '</div></div><div style="display:flex;align-items:center;gap:8px">' + (lt.task1 ? badge('In progress', '#1B6B5A') : badge('Not started', 'var(--text-body)')) + '<span style="font-size:11px;color:var(--stone)">' + (exOpen ? '\u25BE' : '\u25B8') + '</span></div></div>';
      if (exOpen) {
        h += '<div onclick="event.stopPropagation()" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.06)">';
        h += ta('Task 1: What did you do? Which AI tool? What happened?', 'fl_lt_' + l.id + '_task1', lt.task1, 'e.g. Used ChatGPT to draft a strategy brief. Faster but missed organizational context.', 3);
        h += ta('Task 2: What did you do? Which AI tool? What happened?', 'fl_lt_' + l.id + '_task2', lt.task2, '', 3);
        h += ta('Task 3: What did you do? Which AI tool? What happened?', 'fl_lt_' + l.id + '_task3', lt.task3, '', 3);
        h += '</div>';
      }
      h += '</div>';
    });
  } else {
    h += card('<p style="color:var(--stone);text-align:center;padding:24px">Map leaders in Step 1.2 first. Each leader will have their own task fields here.</p>');
  }
  // Team project (shared)
  h += card('<h3 class="h-sub-lg">Team AI Project</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Design and execute a small team project that requires at least three different AI tools working together. Document the workflow, what each tool contributed, and where human judgment was needed.</p>'
    + ta('Project description', 'fl_project', fl.project, 'A brief overview of the project.', 4)
    + ta('Document the workflow', 'fl_projectWorkflow', fl.projectWorkflow, 'Explain how the tools interacted with each other and what each contributed.', 3)
    + ta('Where was human judgment essential?', 'fl_projectJudgment', fl.projectJudgment, 'At what points did AI output need human review, correction, or interpretation?', 3)
    , 'border-top:3px solid #8B5E3C;margin-bottom:16px');
  h += doneBtn('saveFluency()', false, null, '3.1');
  return h;
}
function saveFluency() {
  if (!confirmStepDone('3.1')) return;
  harvestFields(); if (!data.fluencySprint) data.fluencySprint = {};
  ['project', 'projectWorkflow', 'projectJudgment', 'filter'].forEach(function (f) { var el = $('fl_' + f); if (el) data.fluencySprint[f] = el.value });
  // Save per-leader tasks
  if (!data.fluencySprint.leaderTasks) data.fluencySprint.leaderTasks = {};
  (data.leaders || []).forEach(function (l, i) {
    var lid = l.id; if (!lid) return;
    if (!data.fluencySprint.leaderTasks[lid]) data.fluencySprint.leaderTasks[lid] = {};
    ['task1', 'task2', 'task3'].forEach(function (f) { var el = $('fl_lt_' + lid + '_' + f); if (el) data.fluencySprint.leaderTasks[lid][f] = el.value });
  });
  data.completedSteps['3.1'] = true; stampStepDone('3.1'); saveData(); render();
}

/* ═══ STEP 3.2: Decision Simulations ═══ */
function renderStep32() {
  var ds = data.decisionSims || {};
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Decision Simulations</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Design AI-era decision scenarios specific to your industry and strategic priorities, then run your leadership team through them. The point is to develop judgment by exercising it under conditions that approximate the real thing.</p>';
  var scenarios = [
    { id: 'autonomous', name: 'The Autonomy Decision', q: 'An AI system in your organization has been making increasingly accurate operational decisions. It now outperforms human managers on speed and consistency. Do you let it operate autonomously? Where do you draw the line? What are the consequences of drawing it in the wrong place?' },
    { id: 'workforce', name: 'The Workforce Transition', q: 'AI analysis shows that 30% of a key department\u2019s work could be automated within 12 months, affecting 50 roles. How do you handle this? What do you owe these people? What do you owe the organization? How do you sequence the communication?' },
    { id: 'competitor', name: 'The Competitive Threat', q: 'A competitor has deployed AI across their customer service, cutting costs by 40% and improving satisfaction scores. Your board is pressing for a response. You know your organization isn\u2019t ready. What do you do?' },
    { id: 'ethical', name: 'The Ethical Boundary', q: 'An AI system identifies a highly profitable strategy that conflicts with one of your Values Architecture principles. The financial pressure is real. A board member argues the principle is a luxury you can\u2019t afford. How do you respond?' }
  ];
  scenarios.forEach(function (sc, idx) {
    var colors = ['#1B6B5A', '#2D5A8E', '#8B5E3C', '#9B2D3F'];
    h += card('<h4 style="font-size:16px;font-weight:700;margin:0 0 8px">' + esc(sc.name) + '</h4><p style="font-size:13px;color:var(--paper);line-height:1.6;font-style:italic;margin-bottom:12px;border-left:2px solid ' + colors[idx] + ';padding-left:12px">' + esc(sc.q) + '</p>'
      + ta('Your response: What would you do?', 'ds_' + sc.id + '_response', (ds[sc.id + '_response'] || ''), '', 4)
      + ta('Ethical pre-mortem: What could go wrong with your decision?', 'ds_' + sc.id + '_premortem', (ds[sc.id + '_premortem'] || ''), 'Consider unintended consequences, stakeholders harmed, values compromised', 3)
      , 'border-top:3px solid ' + colors[idx] + ';margin-bottom:16px');
  });
  h += doneBtn('saveDecisionSims()', false, null, '3.2');
  return h;
}
function saveDecisionSims() { if (!confirmStepDone('3.2')) return; harvestFields(); if (!data.decisionSims) data.decisionSims = {};['autonomous', 'workforce', 'competitor', 'ethical'].forEach(function (id) { ['response', 'premortem'].forEach(function (f) { var el = $('ds_' + id + '_' + f); if (el) data.decisionSims[id + '_' + f] = el.value }) }); data.completedSteps['3.2'] = true; stampStepDone('3.2'); saveData(); render() }

/* ═══ STEP 3.3: Middle Management Activation ═══ */
function renderStep33() {
  var mm = data.mmActivation || {};
  var workflows = mm.workflows || []; var humanOnly = mm.humanOnly || [];
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Middle Management Activation</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Phase 2 defined the principles. This step translates them into practical workflows. For each dimension, design the specific changes that will activate middle management in its reimagined role.</p>';
  h += recBox('rr_workflow_ethics', 'The Looming AI Risk: Automating Middle Management Destroys a Critical Ethical Layer', 'Faisal Hoque, Pranay Sanklecha, and Paul Scade', 'I by IMD', 'https://www.imd.org/ibyimd/artificial-intelligence/the-looming-ai-risk-automating-middle-management-destroys-critical-ethical-layer/', 'Examines the special duties of middle managers and the catastrophic consequences of eliminating human judgment from operational decisions.', '', 'READ BEFORE COMPLETING');
  // Dynamic workflows
  h += card('<h3 class="h-sub-lg">AI Workflow Analysis</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Identify each middle management workflow that is a candidate for AI augmentation. Describe what AI would do and what the human role remains.</p>'
    + workflows.map(function (w, i) {
      var exKey = 'wf_' + i; var exOpen = UI.ctxOpen[exKey];
      var r = '<div style="border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:8px">';
      r += '<div style="padding:12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()">';
      r += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--stone)">' + (exOpen ? '\u25BE' : '\u25B8') + '</span><div style="font-size:14px;font-weight:600;color:var(--paper)">' + esc(w.name || 'Unnamed workflow') + '</div></div>';
      r += '<div style="display:flex;gap:6px">' + (w.aiRole ? badge('AI', '#2D5A8E') : '') + (w.humanRole ? badge('Human', '#1B6B5A') : '') + '</div></div>';
      if (exOpen) {
        r += '<div onclick="event.stopPropagation()" style="padding:0 12px 12px;border-top:1px solid rgba(var(--fg-rgb),.04)">';
        r += '<div style="margin-top:12px;padding:10px 14px;background:rgba(45,90,142,.04);border-left:3px solid #2D5A8E;margin-bottom:8px"><div style="font-family:var(--mono);font-size:9px;color:#2D5A8E;text-transform:uppercase;margin-bottom:4px">AI Role</div><div style="font-size:13px;color:var(--paper);line-height:1.5">' + esc(w.aiRole || 'Not defined') + '</div></div>';
        r += '<div style="padding:10px 14px;background:rgba(27,107,90,.04);border-left:3px solid #1B6B5A;margin-bottom:8px"><div style="font-family:var(--mono);font-size:9px;color:#1B6B5A;text-transform:uppercase;margin-bottom:4px">Human Role</div><div style="font-size:13px;color:var(--paper);line-height:1.5">' + esc(w.humanRole || 'Not defined') + '</div></div>';
        r += '<div style="text-align:right">' + btn('\u00D7 Remove', 'removeWorkflow(' + i + ')', 'bg2', 'padding:4px 10px;font-size:11px') + '</div>';
        r += '</div>';
      }
      r += '</div>'; return r;
    }).join('')
    + '<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(var(--fg-rgb),.06)">'
    + ta('Workflow name', 'mm_wf_name', '', 'e.g. Monthly performance reporting', 1)
    + ta('What AI would do', 'mm_wf_ai', '', 'e.g. Generate initial data analysis, flag anomalies, draft summary', 2)
    + ta('What the human role remains', 'mm_wf_human', '', 'e.g. Interpret context, have the conversation with the team, make judgment calls', 2)
    + btn('+ Add Workflow', 'addWorkflow()', 'bp')
    + '</div>'
    , 'border-top:3px solid #8B5E3C;margin-bottom:16px');
  // Dynamic human-only decisions
  h += card('<h3 class="h-sub-lg">Exclusively Human Decisions</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Identify decisions that must remain exclusively human. For each, explain why AI cannot be trusted with this judgment.</p>'
    + humanOnly.map(function (d, i) {
      return '<div style="padding:12px;border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:8px;border-left:3px solid #1B6B5A;display:flex;gap:12px;align-items:flex-start"><div style="flex:1"><div style="font-size:14px;font-weight:600;color:var(--paper)">' + esc(d.decision || 'Unnamed') + '</div>' + (d.reason ? '<div style="font-size:12px;color:var(--stone);margin-top:4px">' + esc(d.reason) + '</div>' : '') + '</div>' + btn('\u00D7', 'removeHumanOnly(' + i + ')', 'bg2', 'padding:4px 10px;font-size:14px') + '</div>';
    }).join('')
    + '<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(var(--fg-rgb),.06)">'
    + ta('Decision that must remain human', 'mm_ho_decision', '', 'e.g. Employee performance conversations', 1)
    + ta('Why this must stay human', 'mm_ho_reason', '', 'e.g. Requires empathy, contextual understanding, and the ability to read emotional cues', 2)
    + btn('+ Add Decision', 'addHumanOnly()', 'bp')
    + '</div>'
    , 'border-top:3px solid #1B6B5A;margin-bottom:16px');
  // Log and eval (unchanged)
  h += card('<h3 class="h-sub-lg">AI Use Log</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Establish a practice where middle managers document their AI use.</p>'
    + ta('Design your AI Use Log template', 'mm_logTemplate', mm.logTemplate, 'Consider: tool used, task, outcome, surprises, human judgment applied, lessons', 3)
    + ta('Review cadence and sharing', 'mm_logCadence', mm.logCadence, 'How often? Who reviews? Who benefits from the insights?', 3)
    , 'border-top:3px solid #8B5E3C;margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Adapted Evaluation Criteria</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Update evaluation criteria for middle managers to reflect the reimagined role.</p>'
    + ta('New evaluation criteria', 'mm_evalCriteria', mm.evalCriteria, 'e.g. Quality of human-AI collaboration, judgment in boundary cases, team AI fluency development', 4)
    + ta('Success metrics', 'mm_evalMetrics', mm.evalMetrics, '', 3)
    , 'border-top:3px solid #8B5E3C;margin-bottom:16px');
  h += doneBtn('saveMMActivation()', false, null, '3.3');
  return h;
}
function addWorkflow() { if (lockBlocked('mmActivation')) return; var n = val('mm_wf_name'), a = val('mm_wf_ai'), hu = val('mm_wf_human'); if (!n) return; if (!data.mmActivation) data.mmActivation = {}; if (!data.mmActivation.workflows) data.mmActivation.workflows = []; data.mmActivation.workflows.push({ name: n, aiRole: a, humanRole: hu }); saveData(); render() }
function removeWorkflow(i) { if (lockBlocked('mmActivation')) return; if (!data.mmActivation || !data.mmActivation.workflows) return; data.mmActivation.workflows.splice(i, 1); saveData(); render() }
function addHumanOnly() { if (lockBlocked('mmActivation')) return; var d = val('mm_ho_decision'), r = val('mm_ho_reason'); if (!d) return; if (!data.mmActivation) data.mmActivation = {}; if (!data.mmActivation.humanOnly) data.mmActivation.humanOnly = []; data.mmActivation.humanOnly.push({ decision: d, reason: r }); saveData(); render() }
function removeHumanOnly(i) { if (lockBlocked('mmActivation')) return; if (!data.mmActivation || !data.mmActivation.humanOnly) return; data.mmActivation.humanOnly.splice(i, 1); saveData(); render() }
function saveMMActivation() { if (lockBlocked('mmActivation')) return; if (!confirmStepDone('3.3')) return; harvestFields(); if (!data.mmActivation) data.mmActivation = {};['logTemplate', 'logCadence', 'evalCriteria', 'evalMetrics'].forEach(function (f) { var el = $('mm_' + f); if (el) data.mmActivation[f] = el.value }); data.completedSteps['3.3'] = true; stampStepDone('3.3'); saveData(); render() }

/* ═══ STEP 3.4: Values Architecture (collective) ═══ */
function renderStep34_values() {
  var ov = data.orgValues || [];
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Values Architecture</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Synthesize your team\u2019s individual philosophical reflections (from Step 2.4) into shared organizational principles. These principles become the values you tag to roles in the Leadership Structure.</p>';
  var _vaTab = UI.vaTab || 'principles'; if (_vaTab === 'reflections') _vaTab = 'principles';  // merged tab (ruled 25 July); stale tab state maps across
  var _vaSec = data.vaSec || {};
  var _vaTabs = [{ id: 'principles', l: 'Shared Principles' }, { id: 'synthesis', l: 'Synthesis & Commitments' }, { id: 'tagging', l: 'Tag Values to Roles' }];
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px">';
  _vaTabs.forEach(function (t) { h += '<button onclick="harvestFields();saveData();UI.vaTab=\'' + t.id + '\';render()" style="padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);border:' + (_vaTab === t.id ? '2px solid #6B4C8A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:rgba(var(--fg-rgb),.03);color:' + (_vaTab === t.id ? '#6B4C8A' : 'var(--text-body)') + '">' + t.l + '</button>' });
  h += '</div>';
  if (_vaTab === 'principles') {
    // Reference: each leader's individual Step 2.4 reflections, as collapsed expandable
    // lines (one per leader who has mindsetDepth data) so the team can review everyone's
    // views before synthesizing. Reads data.mindsetDepth[leaderId] across ALL leaders,
    // not just the logged-in user.
    var _mdAll = data.mindsetDepth || {};
    var _refLeaders = (data.leaders || []).filter(function (l) {
      var m = _mdAll[l.id]; return m && (m.val1 || m.val2 || m.val3 || m.val4 || m.val5);
    });
    var _refInner = '<div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">\u25A1 Reference: Individual Reflections from Step 2.4</div>';
    if (!_refLeaders.length) {
      _refInner += '<p style="font-size:13px;color:var(--stone);font-style:italic;line-height:1.6">No individual reflections yet. Leaders can record these in Step 2.4.</p>';
    } else {
      _refInner += '<p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0 0 12px">' + _refLeaders.length + ' leader' + (_refLeaders.length !== 1 ? 's have' : ' has') + ' recorded reflections. Click a name to read their views.</p>';
      _refLeaders.forEach(function (l) {
        var m = _mdAll[l.id] || {};
        var rk = 'vref_' + l.id; var ropen = UI.ctxOpen[rk];
        var body = ''
          + (m.val1 ? '<div style="padding:8px 12px;border-left:2px solid #6B4C8A;margin-bottom:8px"><strong style="color:var(--paper)">Ontological (What is your organization?):</strong><br>' + esc(m.val1) + '</div>' : '')
          + (m.val2 ? '<div style="padding:8px 12px;border-left:2px solid #6B4C8A;margin-bottom:8px"><strong style="color:var(--paper)">Ontological (What is your product/service?):</strong><br>' + esc(m.val2) + '</div>' : '')
          + (m.val3 ? '<div style="padding:8px 12px;border-left:2px solid #2D5A8E;margin-bottom:8px"><strong style="color:var(--paper)">Epistemological (What are your evidence standards?):</strong><br>' + esc(m.val3) + '</div>' : '')
          + (m.val4 ? '<div style="padding:8px 12px;border-left:2px solid #9B2D3F;margin-bottom:8px"><strong style="color:var(--paper)">Ethical (What positions survive the 10% test?):</strong><br>' + esc(m.val4) + '</div>' : '')
          + (m.val5 ? '<div style="padding:8px 12px;border-left:2px solid #8B5E3C;margin-bottom:8px"><strong style="color:var(--paper)">Additional reflection:</strong><br>' + esc(m.val5) + '</div>' : '');
        _refInner += '<div style="border:1px solid rgba(var(--fg-rgb),.08);border-radius:6px;margin-bottom:8px;overflow:hidden">';
        _refInner += '<div onclick="UI.ctxOpen[\'' + rk + '\']=!UI.ctxOpen[\'' + rk + '\'];render()" style="display:flex;align-items:center;gap:8px;padding:11px 14px;cursor:pointer;background:rgba(var(--fg-rgb),.02)">';
        _refInner += '<span style="font-size:14px;font-weight:600;color:var(--paper);flex:1">' + esc(l.name) + '<span style="font-family:var(--mono);font-size:11px;color:var(--stone);font-weight:400"> \u00B7 ' + esc(leaderRoleName(l)) + '</span></span>';
        _refInner += '<span style="font-size:11px;color:rgba(138,130,120,.7)">' + (ropen ? '\u25BE' : '\u25B8') + '</span></div>';
        if (ropen) _refInner += '<div style="padding:12px 14px 4px;font-size:13px;color:var(--stone);line-height:1.6">' + body + '</div>';
        _refInner += '</div>';
      });
    }
    h += card(_refInner, 'margin-bottom:24px;border-top:3px solid var(--gold)');
    // Merged tab (ruled 25 July): the reflections above are the reference point; the principles card sits below them.
    // Shared principles — add pattern
    h += card('<h3 class="h-sub">Shared Organizational Principles</h3>'
      + '<p style="color:var(--text-body);margin:8px 0 16px;font-size:14px;line-height:1.6">As a leadership team, agree on the high-level principles that will govern your organization\u2019s relationships with AI. Each principle should be a clear commitment that can be tagged to specific roles in the Leadership Structure. Aim for 3\u20136 principles across the three philosophical domains.</p>'
      , 'margin-bottom:0;border-bottom:none');
    // Add principle form (top of the list, ruled 16 July)
    h += '<div style="margin:0 0 12px;padding:20px;border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
    h += '<div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Add Principle</div>';
    h += ta('Principle statement', 'ov_principle', '', 'e.g. Human judgment is non-negotiable in consequential decisions', 2);
    h += sel('Domain', 'ov_domain', '', [{ v: '', l: 'Select domain\u2026' }, { v: 'ontological', l: 'Ontological \u2014 What things are (identity, nature, categories)' }, { v: 'epistemological', l: 'Epistemological \u2014 What counts as evidence and knowledge' }, { v: 'ethical', l: 'Ethical \u2014 What we value and where we draw lines' }]);
    h += btn('+ Add Principle', 'addOrgValue()', 'bp', 'margin-top:8px');
    h += '</div>';
    // Existing principles
    if (ov.length) {
      ov.forEach(function (v, i) {
        var dc = { 'ontological': '#6B4C8A', 'epistemological': '#2D5A8E', 'ethical': '#9B2D3F' };
        h += card('<div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1"><div style="font-family:var(--mono);font-size:9px;color:' + (dc[v.domain] || '#888') + ';text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">' + esc(v.domain || '') + '</div><div style="font-size:14px;color:var(--paper);line-height:1.6">' + esc(v.principle) + '</div></div><button onclick="removeOrgValue(' + i + ')" style="background:none;border:none;color:#9B2D3F;cursor:pointer;font-size:14px;padding:4px 8px">\u00D7</button></div>', 'border-left:3px solid ' + (dc[v.domain] || '#888') + ';margin-bottom:8px');
      });
    } else {
      h += '<p style="color:var(--stone);font-style:italic;padding:12px 0">No shared principles defined yet.</p>';
    }
    h += doneBtn('saveVaSec(\'principles\')', ov.length < 1, null, _vaSec.principles_done === true, 'Add at least one shared principle first.');
  }
  if (_vaTab === 'synthesis') {
    // Synthesis discussion
    h += card('<h3 class="h-sub">Synthesis Discussion</h3>'
      + '<p style="color:var(--text-body);margin:8px 0 16px;font-size:14px;line-height:1.6">Where did individual reflections diverge? What does that tell you about the team\u2019s alignment?</p>'
      + ta('Key divergences and what they mean', 'ov_divergences', (data.valuesDiscussion || {}).divergences || '', 'Which reflections surprised the team? Where is there genuine disagreement vs different emphasis?', 4)
      + ta('How will these principles be embedded in daily practice?', 'ov_embedding', (data.valuesDiscussion || {}).embedding || '', 'How will you ensure these are not just words on a wall?', 3)
      , 'margin-top:16px');
    h += card('<h3 class="h-sub">Collective Philosophical Commitments</h3>'
      + '<p style="color:var(--text-body);margin:8px 0 16px;font-size:14px;line-height:1.6">Based on the principles above, write a collective statement of philosophical commitments for your leadership team. This is not a mission statement or a set of corporate values. It is a declaration of how this leadership team will think about AI. What will you do? What will you refuse to do? What kind of organization are you choosing to be?</p>'
      + '<p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">This statement feeds directly into the Leadership Structure: it will appear on every role card in the org chart as the shared philosophical foundation.</p>'
      + ta('Our collective philosophical commitments', 'ov_collectiveCommitments', (data.valuesDiscussion || {}).collectiveCommitments || '', 'e.g. We treat AI as a tool that serves human judgment, not a replacement for it. We will not automate decisions that require empathy, contextual understanding, or ethical reasoning\u2026', 6)
      , 'margin-top:16px');
    // AI Purpose Filter — moved from 3.1 (ruled 16 July): it draws on the purpose and principles set in this step.
    var _pv = (data.assessments && data.assessments.purpose) || {}; var _pvOpen = UI.ctxOpen['va_purposeref'];
    h += '<div style="margin:16px 0 12px"><button onclick="UI.ctxOpen[\'va_purposeref\']=!UI.ctxOpen[\'va_purposeref\'];render()" style="background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.1);padding:8px 14px;cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--stone)">' + (_pvOpen ? '\u25BE' : '\u25B8') + ' Your Purpose & Values</button>';
    if (_pvOpen) {
      h += '<div style="padding:14px 16px;border:1px solid rgba(var(--fg-rgb),.1);border-top:none;background:rgba(var(--fg-rgb),.02)">';
      h += '<div style="font-family:var(--mono);font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Purpose</div>';
      h += '<div style="font-size:13px;color:var(--text-body);line-height:1.6;margin-bottom:12px">' + (_pv.mission ? esc(_pv.mission) : '<em>Not yet captured \u2014 Assessment Battery, section A.</em>') + '</div>';
      h += '<div style="font-family:var(--mono);font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Shared Principles</div>';
      h += (ov.length ? ov.map(function (v) { return '<div style="font-size:13px;color:var(--text-body);line-height:1.6;margin-bottom:4px">\u2022 ' + esc(v.principle) + '</div>' }).join('') : '<div style="font-size:13px;color:var(--text-body)"><em>None defined yet \u2014 see the Shared Principles tab.</em></div>');
      h += '</div>';
    }
    h += '</div>';
    h += card('<h3 class="h-sub-lg">AI Purpose Filter</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Draft a one-page filter for evaluating AI tools against your organization\u2019s purpose and values. The reference above shows what you have set in this step.</p>'
      + ta('Before adopting an AI tool, we will ask:', 'fl_filter', (data.fluencySprint || {}).filter, 'e.g. 1. Does this serve our mission? 2. Does it align with our epistemic standards? 3. What assumptions does it embed?', 4)
      , 'border-top:3px solid #8B5E3C;margin-bottom:16px');
    h += doneBtn('saveVaSec(\'synthesis\')', false, null, _vaSec.synthesis_done === true);
  }
  if (_vaTab === 'tagging') {
    // Compact per-role value tagging — tag 2-3 principles per role here, in place.
    // Writes to the same role.taggedValues the dashboard cards use (single source).
    if (ov.length) {
      var _roles = (data.orgChart || []).slice().filter(function (r) { return r.level !== 0 || r.id === 'crossfunc'; });
      var _tagInner = '<h3 class="h-sub">Tag Values to Roles</h3>'
        + '<p style="color:var(--text-body);margin:8px 0 16px;font-size:14px;line-height:1.6">Now connect these principles to your leadership structure. For each role, tag the two or three values that should most guide it \u2014 these appear on the role\u2019s card in the org chart. You can refine these any time on the Leadership Dashboard.</p>';
      if (!_roles.length) {
        _tagInner += '<div style="font-size:13px;color:var(--text-body);line-height:1.6;padding:12px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:6px">No roles on your org chart yet. Build your leadership structure first (Leadership Landscape and Structure Lab), then return here to tag values \u2014 or tag them later on the Leadership Dashboard.</div>';
      } else {
        // Fold rows (ruled 25 July): role name + tagged-value count; expand to tag from a
        // full-width list, one principle per line (long statements fit). ER's 3.4 fold idiom
        // (UI.ctxOpen keys); flagged against Rollout item 14's donor contract at conformance.
        _roles.forEach(function (role) {
          var tv = role.taggedValues || [];
          var nm = role.id === 'board' ? 'Board' : role.name;
          var rk = 'vtag_' + role.id; var ropen = UI.ctxOpen[rk];
          _tagInner += '<div style="border:1px solid rgba(var(--fg-rgb),.08);border-radius:6px;margin-bottom:8px;overflow:hidden">';
          _tagInner += '<div onclick="UI.ctxOpen[\'' + rk + '\']=!UI.ctxOpen[\'' + rk + '\'];render()" style="display:flex;align-items:center;gap:8px;padding:11px 14px;cursor:pointer;background:rgba(var(--fg-rgb),.02)">';
          _tagInner += '<span style="font-size:14px;font-weight:600;color:var(--paper);flex:1">' + esc(nm) + '<span style="font-family:var(--mono);font-size:11px;color:var(--stone);font-weight:400"> \u00B7 ' + (tv.length === 1 ? '1 tagged value' : tv.length + ' tagged values') + '</span></span>';
          _tagInner += '<span style="font-size:11px;color:rgba(138,130,120,.7)">' + (ropen ? '\u25BE' : '\u25B8') + '</span></div>';
          if (ropen) {
            _tagInner += '<div style="padding:4px 0">';
            ov.forEach(function (v) {
              var on = tv.indexOf(v.id) >= 0;
              var dc = DOMAIN_COL[v.domain] || '#888';
              _tagInner += '<div onclick="toggleRoleValue(\'' + role.id + '\',\'' + v.id + '\')" style="display:flex;align-items:flex-start;gap:10px;padding:9px 14px;cursor:pointer;border-left:3px solid ' + (on ? dc : 'transparent') + ';background:' + (on ? 'rgba(107,76,138,.08)' : 'transparent') + ';border-bottom:1px solid rgba(var(--fg-rgb),.05)">';
              _tagInner += '<span style="font-family:var(--mono);font-size:12px;color:' + (on ? dc : 'var(--stone)') + ';flex-shrink:0;width:14px">' + (on ? '\u2713' : '\u25A1') + '</span>';
              _tagInner += '<span style="flex:1;font-size:13px;color:' + (on ? 'var(--paper)' : 'var(--text-body)') + ';line-height:1.5">' + esc(v.principle) + '</span>';
              _tagInner += '<span style="font-family:var(--mono);font-size:9px;color:' + dc + ';text-transform:uppercase;letter-spacing:.08em;flex-shrink:0;padding-top:2px">' + esc(v.domain || '') + '</span>';
              _tagInner += '</div>';
            });
            _tagInner += '</div>';
          }
          _tagInner += '</div>';
        });
      }
      h += card(_tagInner, 'margin-top:16px;border-top:3px solid #6B4C8A');
    }
    if (!ov.length) h += '<p style="color:var(--stone);font-style:italic;padding:12px 0">Define shared principles first. Tagging opens once principles exist.</p>';
    h += doneBtn('saveVaSec(\'tagging\')', false, null, _vaSec.tagging_done === true);
  }
  var _vaAll = _vaSec.principles_done === true && _vaSec.synthesis_done === true && _vaSec.tagging_done === true;
  if (_vaAll || isStepDone('3.4')) h += doneBtn('saveValuesArch()', false, null, '3.4');
  return h;
}
function addOrgValue() {
  var p = val('ov_principle'), d = val('ov_domain');
  if (!p || !d) return;
  if (!data.orgValues) data.orgValues = [];
  data.orgValues.push({ id: 'v' + uid(), principle: p, domain: d });
  saveData(); render();
}
function removeOrgValue(idx) {
  if (!confirm('Remove this principle?')) return;
  (data.orgValues || []).splice(idx, 1);
  saveData(); render();
}
function saveVaSec(secId) {
  if (lockBlocked('valuesArch')) return; if (!((data.vaSec || {})[secId + '_done']) && !confirm('Mark this section complete? This can\u2019t be undone.')) return;
  harvestFields(); if (!data.vaSec) data.vaSec = {};
  if (!data.valuesDiscussion) data.valuesDiscussion = {};
  var e1 = $('ov_divergences'), e2 = $('ov_embedding'), e3 = $('ov_collectiveCommitments');
  if (e1) data.valuesDiscussion.divergences = e1.value;
  if (e2) data.valuesDiscussion.embedding = e2.value;
  if (e3) data.valuesDiscussion.collectiveCommitments = e3.value;
  data.vaSec[secId + '_done'] = true;
  // Ruled 26 July: sections never complete the step \u2014 saveValuesArch ('3.4') owns it.
  var order = ['principles', 'synthesis', 'tagging']; var idx = order.indexOf(secId);
  if (idx < order.length - 1) UI.vaTab = order[idx + 1];
  saveData(); render();
}
function saveValuesArch() {
  if (lockBlocked('valuesArch')) return; if (!confirmStepDone('3.4')) return;
  harvestFields();
  if (!data.valuesDiscussion) data.valuesDiscussion = {};
  var e1 = $('ov_divergences'), e2 = $('ov_embedding'), e3 = $('ov_collectiveCommitments');
  if (e1) data.valuesDiscussion.divergences = e1.value;
  if (e2) data.valuesDiscussion.embedding = e2.value;
  if (e3) data.valuesDiscussion.collectiveCommitments = e3.value;
  // Build valuesArch array from orgValues
  data.valuesArch = (data.orgValues || []).map(function (v) { return v.id });
  data.completedSteps['3.4'] = true; stampStepDone('3.4'); saveData(); render();
}

/* ═══ STEP 3.5: Mindset Application (individual) ═══ */
function renderStep35() {
  var _g = indivGate('Mindset Application'); if (_g) return _g;
  var ma = myIndivRead('mindsetApp');
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Mindset Application</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Apply everything you have studied and built to real situations. This step exercises the practical expertise that distinguishes the effective leader from the well-informed one.</p>';
  // AI Concern Circles
  // AI Concern Circles
  h += '<div id="sec-concerns"></div>';
  // AI Concern Circles: two optional, growing lists (fears and hopes). Unlike the Slow
  // Thinking Log, nothing is forced -- a leader starts with one of each and may add more
  // over time. Any legacy single ma.fear/ma.hope value is migrated into the list on read.
  var _fears = (ma.fears || []).slice(); var _hopes = (ma.hopes || []).slice();
  if (!_fears.length && ma.fear) _fears = [{ text: ma.fear, date: '' }];
  if (!_hopes.length && ma.hope) _hopes = [{ text: ma.hope, date: '' }];
  function concernList(items, kind, color) {
    var out = '';
    if (items.length) {
      items.forEach(function (entry, i) {
        var d = entry.date ? new Date(entry.date) : null; var dateStr = d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        out += '<div style="padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:8px;border-left:3px solid ' + color + ';display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'
          + '<div style="flex:1">' + (dateStr ? '<div style="font-family:var(--mono);font-size:10px;color:var(--stone);margin-bottom:2px">' + esc(dateStr) + '</div>' : '') + '<div style="font-size:13px;color:var(--paper);line-height:1.5">' + esc(entry.text) + '</div></div>'
          + '<button class="btn bg2" onclick="removeConcern(\'' + kind + '\',' + i + ')" title="Remove this entry" style="padding:4px 10px;font-size:14px">\u00D7</button>'
          + '</div>';
      });
    }
    return out;
  }
  h += card('<h3 class="h-sub-lg">AI Concern Circles</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Go and speak to other leaders in your organization. Start by expressing one fear and one hope about AI in your work, and encourage them to do the same. Listen without judgment, and follow up with individuals who express high anxiety.</p>'
    + '<div style="font-family:var(--mono);font-size:10px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Your fears</div>'
    + concernList(_fears, 'fear', '#9B2D3F')
    + ta('Add a fear: What concerns you about AI in your role?', 'ma_fearEntry', '', '', 2)
    + btn('+ Add Fear', 'addConcern(\'fear\')', 'bp', 'margin-bottom:20px')
    + '<div style="font-family:var(--mono);font-size:10px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin:8px 0">Your hopes</div>'
    + concernList(_hopes, 'hope', '#1B6B5A')
    + ta('Add a hope: What excites you about AI in your role?', 'ma_hopeEntry', '', '', 2)
    + btn('+ Add Hope', 'addConcern(\'hope\')', 'bp')
    , 'border-top:3px solid #8B5E3C;margin-bottom:16px');
  // Skill Atrophy Audit
  h += '<div id="sec-reverseaudit"></div>';
  h += card('<h3 class="h-sub-lg">Skill Atrophy Audit</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Pick one of the skills you identified in the Assess phase as being at risk of eroding through AI use. Design a deliberate practice to maintain it.</p>'
    + ta('Skill at risk of atrophying', 'ma_atrophySkill', ma.atrophySkill, 'What capability are you outsourcing to AI that you need to preserve?', 3)
    + ta('Deliberate practice: How will you maintain this skill?', 'ma_practice', ma.practice, 'e.g. Write one strategy brief per month without AI, then compare with AI-assisted version', 3)
    , 'border-top:3px solid #6B4C8A;margin-bottom:16px');
  // Philosophical Commitments
  // Philosophical Commitments
  h += '<div id="sec-commitments"></div>';
  h += card('<h3 class="h-sub-lg">Philosophical Commitments Statement</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Draft a brief statement of your personal ontological, epistemological, and ethical commitments as they relate to your role. These feed into the guiding concepts attached to your position in the Leadership Structure.</p>'
    + ta('My philosophical commitments as a leader', 'ma_commitments', ma.commitments, 'What is this organization? What do I treat as evidence? Where are my ethical lines? How will I exercise judgment when AI suggests a different path?', 5)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += doneBtn('saveMindsetApp()', false, null, '3.5');
  return h;
}
function saveMindsetApp() { if (!confirmIndivStepDone('3.5')) return; harvestFields(); var ma = myIndivStore('mindsetApp'); if (!ma) { alert('Link your account to a leader first.'); return; } ['atrophySkill', 'practice', 'commitments'].forEach(function (f) { var el = $('ma_' + f); if (el) ma[f] = el.value }); markIndivDone('3.5'); saveData(); render() }
// AI Concern Circles: add/remove entries on the two growing lists (fears, hopes). Adding
// either also stamps the concernCircle practice for the current month (its monthly review
// is "engage with your concern circles"), mirroring how the Slow Thinking Log stamps.
function addConcern(kind) {
  var t = val('ma_' + kind + 'Entry'); if (!t) return;
  var ma = myIndivStore('mindsetApp'); if (!ma) { alert('Link your account to a leader first.'); return; }
  var listKey = kind === 'fear' ? 'fears' : 'hopes';
  if (!ma[listKey]) ma[listKey] = [];
  // Migrate any legacy single value into the list before appending the new one.
  var legacy = kind === 'fear' ? ma.fear : ma.hope;
  if (!ma[listKey].length && legacy) { ma[listKey].push({ text: legacy, date: '' }); }
  if (kind === 'fear') ma.fear = ''; else ma.hope = '';
  ma[listKey].push({ text: t, date: new Date().toISOString(), user: currentUserId || 'u1' });
  var uid = currentUserId || 'u1'; if (!data.practiceLog) data.practiceLog = {}; if (!data.practiceLog[uid]) data.practiceLog[uid] = {}; data.practiceLog[uid].concernCircle = new Date().toISOString();
  saveData(); render();
}
function removeConcern(kind, i) {
  var ma = myIndivStore('mindsetApp'); if (!ma) return;
  var listKey = kind === 'fear' ? 'fears' : 'hopes';
  // Materialize a legacy single value into the list first so indices line up with render.
  var legacy = kind === 'fear' ? ma.fear : ma.hope;
  if ((!ma[listKey] || !ma[listKey].length) && legacy) { ma[listKey] = [{ text: legacy, date: '' }]; if (kind === 'fear') ma.fear = ''; else ma.hope = ''; }
  if (!ma[listKey]) return;
  ma[listKey].splice(i, 1); saveData(); render();
}

/* ═══ STEP 4.1: Operating Rhythm ═══ */
function renderStep41() {
  var or = data.opRhythm || {};
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Embed the Leadership Operating Rhythm</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Lock the changes into the operating fabric so AI-ready leadership becomes permanent. Without rhythm, governance has no teeth.</p>';
  h += card('<h3 class="h-sub-lg">AI as Standing Agenda</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">AI must be a standing item in every senior leadership meeting, not skippable when time is tight. Define the structure.</p>'
    + ta('What specific AI agenda items will appear in every leadership meeting?', 'or_agenda', or.agenda, 'e.g. AI deployment status, emerging opportunities, philosophical drift check, workforce impact update', 3)
    + ta('Who is responsible for preparing the AI agenda? What inputs do they need?', 'or_agendaOwner', or.agendaOwner, '', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Peer Learning Structures</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Pair each senior leader with one or two others \u2014 inside or outside the organization \u2014 who are working through comparable AI decisions. These groups should meet on a defined schedule.</p>'
    + ta('How will you pair leaders? What structure will you use?', 'or_peerStructure', or.peerStructure, 'e.g. Paired by domain (ops leaders together, customer-facing together), meeting fortnightly', 3)
    + ta('What will peer learning groups work on?', 'or_peerAgenda', or.peerAgenda, 'e.g. Real-world case discussion, shared AI tool reviews, decision simulation practice', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Decision Simulation Cadence</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Decision simulations from Phase 3 should not be a one-off. Establish a recurring cadence.</p>'
    + sel('How often will you run decision simulations?', 'or_simFreq', or.simFreq, [{ v: '', l: 'Select\u2026' }, { v: 'monthly', l: 'Monthly' }, { v: 'quarterly', l: 'Quarterly' }, { v: 'biannual', l: 'Twice a year' }])
    + ta('Who designs the scenarios? Where will they come from?', 'or_simDesign', or.simDesign, 'e.g. Rotate responsibility, draw from real emerging situations, use industry-specific cases', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Structured Frontier Exposure</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Your leadership team must have regular, structured exposure to the state of the art, not just the state of the market, which lags behind it. Leaders who only see what their vendors are selling will underestimate what is possible.</p>'
    + ta('How will you ensure frontier exposure? What engagements will you establish?', 'or_frontier', or.frontier, 'e.g. Quarterly sessions with AI labs, annual research summit, structured engagement with organizations further along in deployment', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Board AI Education Program</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">The board needs enough AI literacy to provide substantive oversight, not just receive reassuring presentations.</p>'
    + ta('What does the board education program look like?', 'or_boardEd', or.boardEd, 'e.g. Annual AI deep-dive, at least one director with deep AI expertise, shared vocabulary for oversight', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += doneBtn('saveOpRhythm()', false, null, '4.1');
  return h;
}
function saveOpRhythm() { if (!confirmStepDone('4.1')) return; harvestFields(); if (!data.opRhythm) data.opRhythm = {};['agenda', 'agendaOwner', 'peerStructure', 'peerAgenda', 'simFreq', 'simDesign', 'frontier', 'boardEd'].forEach(function (f) { var el = $('or_' + f); if (el) data.opRhythm[f] = el.value }); data.completedSteps['4.1'] = true; stampStepDone('4.1'); saveData(); render() }

/* ═══ STEP 4.2: Evaluation & Succession ═══ */
function renderStep42() {
  var ev = data.evalSuccession || {};
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Rewire Evaluation & Succession</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">If the leadership evaluation framework is unchanged from five years ago, your behavioral expectations have not actually changed. Tie a meaningful portion of leadership evaluation to AI-readiness indicators.</p>';
  h += card('<h3 class="h-sub-lg">Updated Evaluation Criteria</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Leadership evaluation must reflect AI-era competencies. Connect this to the Competency Framework from Phase 2.</p>'
    + ta('Which AI-readiness indicators will you tie to leadership evaluation?', 'ev_indicators', ev.indicators, 'e.g. Experiments personally sponsored, fluency demonstrated in board discussions, talent developed in AI direction, philosophical commitments articulated', 4)
    + ta('What proportion of leadership evaluation will be linked to AI readiness?', 'ev_proportion', ev.proportion, 'Be specific \u2014 a vague commitment to "include AI" will not change behavior', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Succession Bench Review</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Reassess the succession bench against AI-era criteria. Who on the bench is building AI fluency? Who is stuck?</p>'
    + ta('Current succession bench assessment', 'ev_bench', ev.bench, 'For each successor candidate: are they building AI fluency? Do they demonstrate the competencies? What gaps exist?', 4)
    + ta('What changes to the succession plan are needed?', 'ev_benchChanges', ev.benchChanges, '', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Board Fluency Requirements</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Define the minimum AI literacy requirements for board membership.</p>'
    + ta('Board fluency requirements', 'ev_boardFluency', ev.boardFluency, 'e.g. At minimum, one director with deep AI expertise, a recurring AI agenda item, shared vocabulary for substantive oversight', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += doneBtn('saveEvalSuccession()', false, null, '4.2');
  return h;
}
function saveEvalSuccession() { if (!confirmStepDone('4.2')) return; harvestFields(); if (!data.evalSuccession) data.evalSuccession = {};['indicators', 'proportion', 'bench', 'benchChanges', 'boardFluency'].forEach(function (f) { var el = $('ev_' + f); if (el) data.evalSuccession[f] = el.value }); data.completedSteps['4.2'] = true; stampStepDone('4.2'); saveData(); render() }

/* ═══ STEP 4.3: First Leadership Review ═══ */
function renderStep43() {
  var rv = data.leadershipReview || {}; var leaders = data.leaders || []; var a = data.assessments || {};
  var cf = data.competencyFramework || {};
  // Helper: progress badge based on delta between Phase 1 baseline and Phase 4 rescore
  function progressBadge(baseline, rescore) {
    if (!baseline || !rescore) return '';
    var delta = rescore - baseline;
    if (delta >= 2) return '<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;margin-left:8px;border-radius:3px;background:rgba(27,107,90,.15);color:#1B6B5A;border:1px solid rgba(27,107,90,.3)">Significant growth (+' + delta + ')</span>';
    if (delta >= 1) return '<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;margin-left:8px;border-radius:3px;background:rgba(var(--gold-rgb),.15);color:var(--gold);border:1px solid rgba(var(--gold-rgb),.3)">Growth (+' + delta + ')</span>';
    return '<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;margin-left:8px;border-radius:3px;background:rgba(138,130,120,.15);color:var(--text-body);border:1px solid rgba(138,130,120,.3)">No progress (' + delta + ')</span>';
  }
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">First Leadership Review</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Rescore the same assessment dimensions from Phase 1. The system compares against the baseline and flags progress. Identify who has developed, who requires additional support, and where hard conversations are needed.</p>';
  h += '<div style="padding:12px 16px;background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3);border-radius:6px;margin-bottom:24px"><p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0;font-style:italic">\u201CBy this point, you are beginning to learn which members of your leadership team will make the journey and which will not. The longer you avoid the hard calls, the more expensive they become \u2014 in strategy, in culture, and in talent retention.\u201D</p><div style="font-family:var(--mono);font-size:10px;color:var(--stone);margin-top:8px">90 Days to AI Leadership \u2014 Fast Company</div></div>';
  // Per-leader review
  if (leaders.length) {
    // Org-level assessment numbers, used only as a fallback when a leader has no
    // per-leader competency baseline from the Phase 2 Competency Framework.
    var baselineFluency = (a.fluency || {}).foundational || 0;
    var baselineChange = (a.change || {}).trackRecord || 0;
    var baselinePhilosophical = (a.ethical || {}).commitments || 0;
    leaders.forEach(function (l, i) {
      var lr = (rv.leaders || {})[l.id] || {};
      var exKey = 'rv_ldr_' + l.id; var exOpen = UI.ctxOpen[exKey];
      // Per-leader baselines: the leader's own Phase 2 competency scores where present,
      // falling back to org-level assessment numbers. Fluency uses the leader's own
      // landscape fluency rating (a per-leader figure already).
      var ldrBaseFluency = parseInt(l.fluency) || baselineFluency;
      var ldrBaseChange = ((cf.scores || {})[l.id + '_change']) || baselineChange;
      var ldrBasePhilosophical = ((cf.scores || {})[l.id + '_philosophical']) || baselinePhilosophical;
      h += '<div class="cd" style="margin-bottom:12px;border-left:3px solid #9B2D3F">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="harvestFields();saveData();UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()"><div><h4 style="font-size:15px;font-weight:700;margin:0">' + esc(l.name || 'Leader ' + (i + 1)) + '</h4><div style="font-size:12px;color:var(--stone)">' + esc(leaderRoleName(l)) + (ldrBaseFluency ? ' \u00B7 Phase 1 fluency: ' + ldrBaseFluency + '/5' : '') + '</div></div><span style="font-size:11px;color:var(--stone)">' + (exOpen ? '\u25BE' : '\u25B8') + '</span></div>';
      if (exOpen) {
        h += '<div onclick="event.stopPropagation()" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.06)">';
        // AI Fluency — same labels as Phase 1
        h += '<div style="margin-bottom:16px">';
        h += likert('AI Fluency \u2014 Foundational understanding', 'leadershipReview.leaders.' + l.id + '.fluency', lr.fluency || 0, 'None', 'Expert');
        if (lr.fluency) h += '<div style="margin-top:4px;margin-bottom:8px">' + progressBadge(ldrBaseFluency, lr.fluency) + '</div>';
        h += '</div>';
        // Change Leadership — same labels as Phase 1
        h += '<div style="margin-bottom:16px">';
        h += likert('Change Leadership \u2014 Track record', 'leadershipReview.leaders.' + l.id + '.change', lr.change || 0, 'Poor', 'Excellent');
        if (lr.change) h += '<div style="margin-top:4px;margin-bottom:8px">' + progressBadge(ldrBaseChange, lr.change) + '</div>';
        h += '</div>';
        // Philosophical Proficiency — same labels as Phase 1
        h += '<div style="margin-bottom:16px">';
        h += likert('Ethical & Philosophical \u2014 Commitments', 'leadershipReview.leaders.' + l.id + '.philosophical', lr.philosophical || 0, 'None', 'Strong');
        if (lr.philosophical) h += '<div style="margin-top:4px;margin-bottom:8px">' + progressBadge(ldrBasePhilosophical, lr.philosophical) + '</div>';
        h += '</div>';
        h += sel('Overall assessment', 'rv_' + l.id + '_assessment', lr.assessment, [{ v: '', l: 'Select\u2026' }, { v: 'developed', l: 'Has developed \u2014 ready for next level' }, { v: 'progressing', l: 'Progressing \u2014 on track' }, { v: 'support', l: 'Needs additional support' }, { v: 'hard', l: 'Requires a hard conversation' }]);
        h += ta('Notes and development priorities', 'rv_' + l.id + '_notes', lr.notes, 'What specific actions or support does this leader need?', 3);
        h += '</div>';
      }
      h += '</div>';
    });
  } else {
    h += card('<p style="color:var(--stone);text-align:center;padding:24px">Map leaders in Step 1.2 first.</p>');
  }
  // Structural review
  h += card('<h3 class="h-sub-lg">Structural Review</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">What structural changes from Phase 2 are working? Which need revision?</p>'
    + ta('What is working well in the new leadership structure?', 'rv_structWorking', rv.structWorking, '', 3)
    + ta('What needs revision or adjustment?', 'rv_structRevision', rv.structRevision, '', 3)
    , 'border-top:3px solid #9B2D3F;margin-bottom:16px');
  h += doneBtn('saveLeadershipReview()', false, null, '4.3');
  return h;
}
function saveLeadershipReview() {
  if (!confirmStepDone('4.3')) return;
  harvestFields(); if (!data.leadershipReview) data.leadershipReview = {};
  if (!data.leadershipReview.leaders) data.leadershipReview.leaders = {};
  (data.leaders || []).forEach(function (l, i) {
    var lid = l.id; if (!lid) return;
    if (!data.leadershipReview.leaders[lid]) data.leadershipReview.leaders[lid] = {};
    var el1 = $('rv_' + lid + '_assessment'); if (el1) data.leadershipReview.leaders[lid].assessment = el1.value;
    var el2 = $('rv_' + lid + '_notes'); if (el2) data.leadershipReview.leaders[lid].notes = el2.value;
  });
  ['structWorking', 'structRevision'].forEach(function (f) { var el = $('rv_' + f); if (el) data.leadershipReview[f] = el.value });
  data.completedSteps['4.3'] = true; stampStepDone('4.3'); saveData(); render();
}

/* ═══ STEP 4.4: Composure & Resilience ═══ */
function renderStep44() {
  var _g = indivGate('Composure & Resilience'); if (_g) return _g;
  var cr = myIndivRead('composure');
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Composure & Resilience</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">Establish the inner leadership practices that sustain leaders through ongoing turbulence. Composure is not complacency. It is the foundation for clear thinking under pressure.</p>';

  // Three tabs, rendered like the Mindset Foundations tabs: box-style buttons with a
  // completion glyph (filled check when complete, open circle otherwise) and green tint.
  // (1) Reflections \u2014 Stepping into the River + Collaborative Decision-Making. (2) STOP \u2014
  // the STOP Technique. (3) Slow Thinking Log \u2014 the ongoing monthly log. STOP and the Slow
  // Thinking Log remain wired into the Ongoing Practices grid exactly as before.
  var _cr = UI.crTab || 'reflections';
  var _crTabs = [{ id: 'reflections', label: 'Reflections', c: crTabDone('reflections') }, { id: 'stop', label: 'STOP', c: crTabDone('stop') }, { id: 'slowlog', label: 'Slow Thinking Log', c: crTabDone('slowlog') }];
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px">';
  _crTabs.forEach(function (t) {
    var on = _cr === t.id;
    h += '<button onclick="crSwitchTab(\'' + t.id + '\')" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans);border:' + (on ? '2px solid #1B6B5A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (t.c ? 'rgba(27,107,90,.08)' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (on || t.c ? '#1B6B5A' : 'var(--text-body)') + '">' + (t.c ? '\u2713' : '\u25CB') + ' ' + esc(t.label) + '</button>';
  });
  h += '</div>';

  var _nonEmpty = function (v) { return !!(v && String(v).trim()); };

  // ── Tab: Reflections (Stepping into the River + Collaborative Decision-Making) ──
  var _reflections = '<div id="sec-constants"></div>'
    + card('<h3 class="h-sub-lg">Stepping into the River</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Heraclitus famously said, \u201CYou cannot step into the same river twice.\u201D But he also said that the river is still a river. Change is constant, but some things persist. Purpose, identity, and strategic clarity are the stable vessel that allows people to navigate change rather than being pulled under by it.</p>'
      + recBox('rr_src_changefatigue', 'How to Beat Change Fatigue', 'Faisal Hoque', 'Fast Company', 'https://www.fastcompany.com/91485057/how-beat-change-fatigue', 'Why change fatigue is a failure of organizational design, not individual resilience, and five principles for providing stability amid constant change.', '12px')
      + taGated('What persists through change in your organization? What are the constants? *', 'cr_constants', cr.constants, 'Consider: purpose, identity, values, relationships, commitments you have made and will keep', 3)
      + taGated('How will you communicate these constants to your people during turbulence? *', 'cr_constantsComm', cr.constantsComm, '', 3)
      , 'border-top:3px solid #8B5E3C;margin-bottom:16px')
    + card('<h3 class="h-sub-lg">Collaborative Decision-Making Under Uncertainty</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Bring people into the process. Share what you know. Acknowledge what you don\u2019t. Transparency about the process builds trust even when the outcome is uncertain.</p>'
      + taGated('How will your leadership team make decisions when information is incomplete and the stakes are high? *', 'cr_uncertaintyProcess', cr.uncertaintyProcess, 'Define the process: who is consulted, how dissent is handled, when to act vs when to wait', 3)
      + taGated('What will you share with people, and how, when you don\u2019t yet know the answer? *', 'cr_uncertaintyComms', cr.uncertaintyComms, 'How do you communicate uncertainty without undermining confidence?', 3)
      , 'border-top:3px solid #9B2D3F;margin-bottom:16px');

  // ── Tab: STOP (the STOP Technique) ──
  var _stop = '<div id="sec-stop"></div>'
    + card('<h3 class="h-sub-lg">The STOP Technique</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">A present-moment awareness practice for leaders. <strong>Stop</strong> what you are doing. <strong>Take</strong> a breath. <strong>Observe</strong> what is happening \u2014 internally and externally. <strong>Proceed</strong> with intention.</p>'
      + '<p style="color:var(--paper);font-size:14px;margin-bottom:12px">Identify three recurring situations where this practice would change how you respond:</p>'
      + taGated('Moment 1 *', 'cr_stop1', cr.stop1, 'e.g. Before responding to a crisis email', 2)
      + taGated('Moment 2 *', 'cr_stop2', cr.stop2, 'e.g. Before a board presentation', 2)
      + taGated('Moment 3 *', 'cr_stop3', cr.stop3, 'e.g. When a project goes off track', 2)
      , 'border-top:3px solid #6B4C8A;margin-bottom:16px');

  // ── Tab: Slow Thinking Log (ongoing monthly practice; completes on first entry) ──
  var logs = cr.slowLog || [];
  var _slowlog = '<div id="sec-slowlog"></div>'
    + card('<h3 class="h-sub-lg">Slow Thinking Log</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">An ongoing monthly practice. Each month, record one decision where you deliberately slowed down, examined your assumptions, and exercised independent judgment.</p>'
      + (logs.length ? logs.map(function (entry, i) {
        var d = entry.date ? new Date(entry.date) : null; var dateStr = d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        var exKey = 'slow44_' + i; var exOpen = UI.ctxOpen[exKey];
        var preview = entry.text.length > 100 ? entry.text.substring(0, 100) + '\u2026' : entry.text;
        return '<div style="padding:12px;border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:8px;border-left:3px solid #9B2D3F;cursor:pointer" onclick="UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()"><div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1"><div style="font-family:var(--mono);font-size:10px;color:var(--stone);margin-bottom:4px">' + esc(dateStr) + '</div><div style="font-size:13px;color:var(--paper);line-height:1.5">' + (exOpen ? esc(entry.text) : esc(preview)) + '</div></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--stone)">' + (exOpen ? '\u25BE' : '\u25B8') + '</span>' + btn('\u00D7', 'event.stopPropagation();removeSlowLog(' + i + ')', 'bg2', 'padding:4px 10px;font-size:14px') + '</div></div></div>';
      }).join('') : '<p style="color:var(--stone);font-size:13px;font-style:italic;margin-bottom:12px">No entries yet. Add your first below.</p>')
      + '<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(var(--fg-rgb),.06)">'
      + ta('This month\u2019s entry: What decision did you slow down on?', 'cr_slowEntry', '', 'What assumptions did you examine? What did you decide, and why?', 3)
      + btn('+ Add Log Entry', 'addSlowLog()', 'bp')
      + '</div>'
      , 'border-top:3px solid #9B2D3F;margin-bottom:16px');

  // Emit the active tab's content, each followed by its own gated complete button.
  if (_cr === 'reflections') {
    h += _reflections;
    var refReady = _nonEmpty(cr.constants) && _nonEmpty(cr.constantsComm) && _nonEmpty(cr.uncertaintyProcess) && _nonEmpty(cr.uncertaintyComms);
    h += doneBtn('saveComposureTab(\'reflections\')', !refReady, null, crTabDone('reflections'), 'Complete the reflections on this tab first.');
  } else if (_cr === 'stop') {
    h += _stop;
    var stopReady = _nonEmpty(cr.stop1) && _nonEmpty(cr.stop2) && _nonEmpty(cr.stop3);
    h += doneBtn('saveComposureTab(\'stop\')', !stopReady, null, crTabDone('stop'), 'Identify all three situations to complete this tab.');
  } else {
    h += _slowlog;
    var slowReady = (logs.length >= 1);
    h += doneBtn('saveComposureTab(\'slowlog\')', !slowReady, null, crTabDone('slowlog'), 'Add at least one log entry to complete this tab.');
  }
  var _all44 = crTabDone('reflections') && crTabDone('stop') && crTabDone('slowlog');
  if (_all44 || isStepDone('4.4')) h += doneBtn('saveComposureStep()', false, null, '4.4');
  return h;
}
function addSlowLog() { var t = val('cr_slowEntry'); if (!t) return; var _cr = myIndivStore('composure'); if (!_cr) { alert('Link your account to a leader first.'); return; } if (!_cr.slowLog) _cr.slowLog = []; var now = new Date().toISOString(); _cr.slowLog.push({ text: t, date: now, user: currentUserId || 'u1' }); var uid = currentUserId || 'u1'; if (!data.practiceLog) data.practiceLog = {}; if (!data.practiceLog[uid]) data.practiceLog[uid] = {}; data.practiceLog[uid].slowLog = now; saveData(); render() }
function removeSlowLog(i) { var _cr = myIndivStore('composure'); if (!_cr || !_cr.slowLog) return; _cr.slowLog.splice(i, 1); saveData(); render() }
function saveComposure() { harvestFields(); var _cr = myIndivStore('composure'); if (!_cr) { alert('Link your account to a leader first.'); return; } ['stop1', 'stop2', 'stop3', 'constants', 'constantsComm', 'uncertaintyProcess', 'uncertaintyComms'].forEach(function (f) { var el = $('cr_' + f); if (el) _cr[f] = el.value }); markIndivDone('4.4'); saveData(); render() }
// Persist whichever Composure & Resilience fields are currently on screen, without
// re-rendering. Called on blur by taGated so the gated complete buttons can re-evaluate.
function crPersistFields() {
  var cr = myIndivStore('composure'); if (!cr) return;
  var _f = false;  // save only when this page actually carries composure fields (ruled 25 July)
  ['stop1', 'stop2', 'stop3', 'constants', 'constantsComm', 'uncertaintyProcess', 'uncertaintyComms'].forEach(function (f) { var el = $('cr_' + f); if (el) { cr[f] = el.value; _f = true; } });
  if (_f) saveData();
}
// Read whether a Composure & Resilience tab is marked complete for the current leader.
function crTabDone(tab) {
  var ml = getMyLeader(); if (!ml) return false;
  var d = (data.indivDone || {})[ml.id] || {};
  return d['4.4:' + tab] === true;
}
// Mark one Composure & Resilience tab complete (gated like the Mindset Foundations tabs).
// Persists the visible fields first, records the per-tab flag, and flips the overall 4.4
// done flag only once all three tabs are complete.
function saveComposureTab(tab) {
  if (!crTabDone(tab) && !confirm('Mark this section complete? This can\u2019t be undone.')) return; /* Item-7 extension: individual tab-saves run the standard section dialog; decline writes nothing */
  var cr = myIndivStore('composure'); if (!cr) { alert('Link your account to a leader first.'); return; }
  ['stop1', 'stop2', 'stop3', 'constants', 'constantsComm', 'uncertaintyProcess', 'uncertaintyComms'].forEach(function (f) { var el = $('cr_' + f); if (el) cr[f] = el.value });
  var ml = getMyLeader(); if (!ml) { alert('Link your account to a leader first.'); return; }
  if (!data.indivDone) data.indivDone = {};
  if (!data.indivDone[ml.id]) data.indivDone[ml.id] = {};
  data.indivDone[ml.id]['4.4:' + tab] = true;
  // Ruled 25 July: tabs never complete the step — saveComposureStep() (the discrete button) owns it.
  saveData(); render();
}
// Switch the Composure & Resilience tab, persisting on-screen fields first so no
// in-progress text is lost. Does NOT mark the step done.
function crSwitchTab(tab) {
  crPersistFields();
  UI.crTab = tab; render();
}
/* ═══ PERSONAL L&D DASHBOARD ═══ */
function renderLdevDashboard() {
  var h = '<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">My Leadership Development Reviews</h2>';
  h += '<p style="color:var(--text-body);margin:8px 0 16px;line-height:1.6;font-size:14px">Your personal leadership development reviews: everything that should be maintained on an ongoing basis, accessible from one place.</p>';
  h += '<div style="padding:12px 16px;background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.3);border-radius:6px;margin-bottom:24px"><p style="font-size:13px;color:var(--text-body);line-height:1.5;margin:0"><strong>Recommended cadence:</strong> Aim to complete all reviews once per month. Use this dashboard to access each practice directly.</p></div>';

  var now = new Date();
  function daysSince(isoStr) { if (!isoStr) return null; var d = new Date(isoStr); return Math.floor((now - d) / (1000 * 60 * 60 * 24)) }
  var myLog = ((data.practiceLog || {})[currentUserId || 'u1']) || {};
  // Reviews go live only once the 90-day module is complete (all organizational steps in
  // phases 1-4 done). Before that, the cards just navigate; after, opening a review from
  // here stamps it done for the month (Slow Thinking excepted -- it is logged by entry).
  var _reviewsLive = getProgress().pct === 100;
  function dueCard(title, desc, lastDate, navArgs, color, key) {
    // navArgs: [stepId, anchor, tabObjLiteral]. When reviews are live and a practice key
    // is given (and it is not the Slow Thinking log), opening stamps that review done.
    var done = !!(lastDate && periodKey(new Date(lastDate)) === periodKey(new Date()));
    var statusText = done ? 'Complete' : 'Incomplete';
    var statusCol = done ? '#1B6B5A' : '#9B2D3F';
    var stamps = _reviewsLive && key && key !== 'slowLog';
    var onclick;
    if (stamps) {
      onclick = 'markOneReview(\'' + key + '\',\'' + navArgs[0] + '\',\'' + navArgs[1] + '\'' + (navArgs[2] ? ',' + navArgs[2] : '') + ')';
    } else {
      onclick = 'goTo(\'' + navArgs[0] + '\',\'' + navArgs[1] + '\'' + (navArgs[2] ? ',' + navArgs[2] : '') + ')';
    }
    return card('<div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1"><h4 style="font-size:15px;font-weight:700;margin:0 0 4px">' + esc(title) + '</h4><p style="font-size:12px;color:var(--stone);line-height:1.4;margin:0 0 8px">' + esc(desc) + '</p><div style="display:flex;align-items:center;gap:8px"><div style="width:8px;height:8px;border-radius:50%;background:' + statusCol + '"></div><span style="font-family:var(--mono);font-size:11px;color:' + statusCol + '">' + statusText + '</span></div></div><div>' + '<button class="btn-ghost pad-chip-md" onclick="' + onclick + '">Open \u2192</button>' + '</div></div>', 'border-left:3px solid ' + color + ';margin-bottom:12px');
  }

  h += dueCard('Slow Thinking Log', 'Monthly: Record one decision where you deliberately slowed down and exercised independent judgment.', myLog.slowLog || null, ['4.4', 'sec-slowlog', '{cr:\'slowlog\'}'], '#9B2D3F', 'slowLog');
  h += dueCard('STOP Technique Review', 'Monthly: Revisit your three STOP situations. Are they still the right ones?', myLog.stopReview || null, ['4.4', 'sec-stop', '{cr:\'stop\'}'], '#6B4C8A', 'stopReview');
  h += dueCard('Dependency Scan', 'Monthly: Update your inventory of skills outsourced to AI.', myLog.depScan || null, ['1.4', 'sec-depscan', '{mf:\'atrophy\'}'], '#1B6B5A', 'depScan');
  h += dueCard('Skill Atrophy Audit', 'Monthly: Check your atrophying skill.', myLog.reverseAudit || null, ['3.5', 'sec-reverseaudit', ''], '#8B5E3C', 'reverseAudit');
  h += dueCard('Values Architecture Review', 'Monthly: Revisit your four commitments. Has anything drifted?', myLog.valuesReview || null, ['2.4', 'sec-values', ''], '#2D5A8E', 'valuesReview');
  h += dueCard('AI Concern Circles', 'Monthly: Share one fear and one hope.', myLog.concernCircle || null, ['3.5', 'sec-concerns', ''], '#8B5E3C', 'concernCircle');
  h += dueCard('Philosophical Commitments', 'Monthly: Does your personal commitments statement still hold?', myLog.commitments || null, ['3.5', 'sec-commitments', ''], '#9B2D3F', 'commitments');

  // Mark review timestamps
  h += '<div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(var(--fg-rgb),.06)">';
  h += '<p style="font-size:13px;color:var(--stone);margin-bottom:12px">After completing your monthly reviews, mark them as done:</p>';
  h += btn('\u2713 Mark Monthly Reviews Complete', 'markMonthlyReviews()', 'bp', 'margin-right:8px');
  h += '</div>';

  // Slow Thinking Log quick-add with expandable entries
  var slowLogs = (myIndivRead('composure').slowLog) || [];
  h += '<div style="margin-top:32px">';
  h += '<div style="font-family:var(--serif);font-size:20px;font-weight:300;margin-bottom:12px">Quick Add: Slow Thinking Log</div>';
  if (slowLogs.length) {
    h += '<div style="margin-bottom:16px">';
    slowLogs.slice().reverse().slice(0, 5).forEach(function (entry, ri) {
      var origIdx = slowLogs.length - 1 - ri;
      var d = entry.date ? new Date(entry.date) : null; var dateStr = d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      var exKey = 'slow_' + origIdx; var exOpen = UI.ctxOpen[exKey];
      var preview = entry.text.length > 100 ? entry.text.substring(0, 100) + '\u2026' : entry.text;
      h += '<div style="border-left:3px solid #9B2D3F;border-bottom:1px solid rgba(var(--fg-rgb),.06);cursor:pointer" onclick="UI.ctxOpen[\'' + exKey + '\']=!UI.ctxOpen[\'' + exKey + '\'];render()">';
      h += '<div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1"><div style="font-family:var(--mono);font-size:10px;color:var(--stone);margin-bottom:2px">' + esc(dateStr) + '</div><div style="font-size:13px;color:var(--paper);line-height:1.4">' + (exOpen ? esc(entry.text) : esc(preview)) + '</div></div><span style="font-size:11px;color:var(--stone);margin-left:8px">' + (exOpen ? '\u25BE' : '\u25B8') + '</span></div>';
      h += '</div>';
    });
    if (slowLogs.length > 5) h += '<div style="font-size:12px;color:var(--stone);padding:8px 12px;font-style:italic">Showing last 5 of ' + slowLogs.length + ' entries. <span style="cursor:pointer;color:var(--gold)" onclick="goTo(\'4.4\',\'sec-slowlog\',{cr:\'slowlog\'})">View all \u2192</span></div>';
    h += '</div>';
  }
  h += ta('This month\u2019s entry', 'ldev_slowEntry', '', 'What decision did you slow down on? What assumptions did you examine?', 3);
  h += btn('+ Add Entry', 'addSlowLogFromDashboard()', 'bp');
  h += '</div>';

  return h;
}
function addSlowLogFromDashboard() { var t = val('ldev_slowEntry'); if (!t) return; var _cr = myIndivStore('composure'); if (!_cr) { alert('Link your account to a leader first.'); return; } if (!_cr.slowLog) _cr.slowLog = []; var now = new Date().toISOString(); _cr.slowLog.push({ text: t, date: now, user: currentUserId || 'u1' }); var uid = currentUserId || 'u1'; if (!data.practiceLog) data.practiceLog = {}; if (!data.practiceLog[uid]) data.practiceLog[uid] = {}; data.practiceLog[uid].slowLog = now; saveData(); render() }
function markMonthlyReviews() { var now = new Date().toISOString(); var uid = currentUserId || 'u1'; if (!data.practiceLog) data.practiceLog = {}; if (!data.practiceLog[uid]) data.practiceLog[uid] = {}; data.practiceLog[uid].stopReview = now; data.practiceLog[uid].depScan = now; data.practiceLog[uid].reverseAudit = now; data.practiceLog[uid].concernCircle = now; data.practiceLog[uid].commitments = now; data.practiceLog[uid].valuesReview = now; saveData(); render() }
// Stamp a single review as done for the current month, then navigate to its page/tab.
// Used by the My Development cards once monthly reviews are live: opening a review from
// the dashboard counts as having reviewed it. Slow Thinking is excluded (it is logged by
// adding an entry, not by a review visit).
function markOneReview(key, stepId, anchor, tab) {
  var now = new Date().toISOString(); var uid = currentUserId || 'u1';
  if (!data.practiceLog) data.practiceLog = {}; if (!data.practiceLog[uid]) data.practiceLog[uid] = {};
  data.practiceLog[uid][key] = now;
  saveData();
  goTo(stepId, anchor, tab);
}

// ── Ongoing-practices monthly cadence (O4) ─────────────────────────────────
// Period stamp is "YYYY-MM". The live counter reads the real device clock; the
// rollover is forward-only (a clock set backward or equal does nothing) and
// idempotent (safe to call on every render). On rollover it snapshots the
// COMPUTED health state (green/red/grey per user per practice) for the closing
// period into data.practiceHistory, then resets the live practice cadence stamps.
var PRACTICE_KEYS = [
  { id: 'slowLog', name: 'Slow Thinking', cadence: 'Monthly', dueDays: 30 },
  { id: 'stopReview', name: 'STOP Technique', cadence: 'Monthly', dueDays: 30 },
  { id: 'depScan', name: 'Dependency Scan', cadence: 'Monthly', dueDays: 30 },
  { id: 'reverseAudit', name: 'Skill Atrophy Audit', cadence: 'Monthly', dueDays: 30 },
  { id: 'valuesReview', name: 'Values Review', cadence: 'Monthly', dueDays: 30 },
  { id: 'concernCircle', name: 'Concern Circles', cadence: 'Monthly', dueDays: 30 },
  { id: 'commitments', name: 'Commitments', cadence: 'Monthly', dueDays: 30 }
];
function periodKey(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
function periodLabel(pk) {
  if (!pk) return '';
  var parts = pk.split('-'); var y = parseInt(parts[0]); var m = parseInt(parts[1]) - 1;
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return (names[m] || '?') + ' ' + y;
}
// Compare two "YYYY-MM" keys: returns <0 if a before b, 0 equal, >0 a after b.
function periodCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;  // lexical works for zero-padded YYYY-MM
}
function daysSinceFrom(now, isoStr) { if (!isoStr) return null; return Math.floor((now - new Date(isoStr)) / (1000 * 60 * 60 * 24)); }
// Compute per-user-per-practice status for the current live state. Returns
// {cells:{userId:{practiceId:'green'|'blue'|'red'|'grey'}}, green, blue, red, grey}.
// Snapshot health for the period whose end is `now` (closeRef). Binary: a practice
// is "done" (green) if its last-done timestamp falls within that same month, else
// "not done" (red). No recency gradient, no grey -- a closed month is simply done or
// not for each person/practice.
function computePracticeHealth(now) {
  var out = { cells: {}, green: 0, red: 0 };
  var refPeriod = periodKey(now);
  /* Item-6 (F-4 ruling, Paul 27 July): what you saw is what gets archived — the archive
     computes over the same 13-leader population the live grid displays, keyed by
     userId where a login exists and by leader id where not. */
  (data.leaders || []).forEach(function (l) {
    var key = l.userId || l.id;
    var uLog = (l.userId && (data.practiceLog || {})[l.userId]) || {};
    out.cells[key] = {};
    PRACTICE_KEYS.forEach(function (p) {
      var last = uLog[p.id] || null;
      var done = !!(last && periodKey(new Date(last)) === refPeriod);
      var s = done ? 'green' : 'red';
      if (done) out.green++; else out.red++;
      out.cells[key][p.id] = s;
    });
  });
  return out;
}
// Idempotent, forward-only rollover. Call freely (e.g. on hub render).
function practiceRollover(now) {
  now = now || new Date();
  var cur = periodKey(now);
  if (!data.practicePeriod) { data.practicePeriod = cur; saveData(); return false; }
  if (periodCompare(cur, data.practicePeriod) > 0) {
    // Real clock has advanced past the stored period -> archive & reset.
    archiveAndResetPractices(data.practicePeriod, now);
    data.practicePeriod = cur;
    saveData();
    return true;
  }
  // cur <= stored period: backward or same -> do nothing (forward-only guard).
  return false;
}
// Snapshot the closing period's computed health, then clear live cadence stamps.
// Health is measured as of the END of the closing period (not the moment the
// rollover fires, which may be days into the new month) so the archive reflects
// how the team actually stood when that period closed.
function archiveAndResetPractices(closingPeriod, now) {
  now = now || new Date();
  if (!data.practiceHistory) data.practiceHistory = {};
  // Reference time = last moment of the closing period's month.
  var cp = closingPeriod.split('-'); var closeRef = new Date(parseInt(cp[0]), parseInt(cp[1]), 0, 23, 59, 59);
  // If the closing period is the current month (manual reset mid-month), use now.
  if (periodKey(now) === closingPeriod) closeRef = now;
  var snap = computePracticeHealth(closeRef);
  data.practiceHistory[closingPeriod] = {
    period: closingPeriod,
    archivedAt: now.toISOString(),
    users: (data.leaders || []).map(function (l) { return { id: (l.userId || l.id), name: l.name }; }), /* Item-6: archive rows = the grid's leaders */
    practices: PRACTICE_KEYS.map(function (p) { return { id: p.id, name: p.name }; }),
    cells: snap.cells,
    summary: { green: snap.green, red: snap.red }
  };
  // Reset live cadence stamps (timestamps only; does NOT touch slow-log content).
  if (data.practiceLog) {
    Object.keys(data.practiceLog).forEach(function (uid) { data.practiceLog[uid] = {}; });
  }
}
// Authoritative manual reset (facilitator backstop): archive current period and
// advance to the current month immediately.
function manualResetPractices() {
  var now = new Date();
  var closing = data.practicePeriod || periodKey(now);
  archiveAndResetPractices(closing, now);
  data.practicePeriod = periodKey(now);
  saveData(); render();
}
// Days remaining until the end of the current month.
function daysLeftInMonth(now) {
  now = now || new Date();
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 0);  // last day of month
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}
/* ── L&D HUB REPORT (Paul's ruling, 13 Sep 2026) ───────────────────────────────────────
   The printed hub is its own document rendered from the data, never the screen cleaned up.
   Cover; the Competency Heat Map on its own landscape page; Study Completion and AI Fluency
   Progress as tables on one portrait page; Monthly Reviews Health compact, with the
   Development Priorities beneath it, on the last page. Practice History does not print. */
var LDEV_COMPS=[
  {id:'orchestration',name:'AI Orchestration'},
  {id:'philosophical',name:'Philosophical & Ethical Reasoning'},
  {id:'hybrid',name:'Hybrid Team Leadership'},
  {id:'change',name:'Change & Transformation'},
  {id:'composure',name:'Composure & Adaptive Judgment'},
  {id:'ecosystem',name:'Ecosystem Stewardship'},
  {id:'emotional',name:'Emotional Intelligence'}
];
var LDEV_STEPS=[{id:'1.4',name:'Mindset Foundations',phase:'Phase 1'},{id:'2.4',name:'Mindset Depth',phase:'Phase 2'},{id:'3.5',name:'Mindset Application',phase:'Phase 3'},{id:'4.4',name:'Composure & Resilience',phase:'Phase 4'}];
var LDEV_PRACTICES=[
  {id:'slowLog',name:'Slow Thinking',cadence:'Monthly',dueDays:30},
  {id:'stopReview',name:'STOP Technique',cadence:'Monthly',dueDays:30},
  {id:'depScan',name:'Dependency Scan',cadence:'Monthly',dueDays:30},
  {id:'reverseAudit',name:'Skill Atrophy Audit',cadence:'Monthly',dueDays:30},
  {id:'valuesReview',name:'Values Review',cadence:'Monthly',dueDays:30},
  {id:'concernCircle',name:'Concern Circles',cadence:'Monthly',dueDays:30},
  {id:'commitments',name:'Commitments',cadence:'Monthly',dueDays:30}
];
function ldevHubLead(){return'Collective view of leadership development across the program. Competency tracking, study progress, fluency growth, and ongoing practice health.'}
/* the gap ranking the screen's Development Priorities shows: competencies by average score, lowest first */
function ldevGaps(){var cf=data.competencyFramework||{};var leaders=data.leaders||[];
return LDEV_COMPS.map(function(c){var vals=leaders.map(function(l){return(cf.scores||{})[l.id+'_'+c.id]||0}).filter(function(v){return v>0});return{name:c.name,avg:vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0}}).filter(function(g){return g.avg>0}).sort(function(a,b){return a.avg-b.avg})}
var LDEV_REPORT_CSS='@page land{size:landscape}.lr-land{page:land;break-before:page;break-after:page;page-break-before:always;page-break-after:always;width:1000px}.lr-pg{page-break-before:always}'
+'.lr-hk{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6B4C8A;margin:0 0 6px}.lr-h{font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:600;color:#111;margin:0 0 6px;line-height:1.15}.lr-lead{font-size:12.5px;color:#444;margin:0 0 10px;line-height:1.5}.lr-rule{border-top:2px solid #111;margin:0 0 16px}'
+'.lr-blk{page-break-inside:avoid}.lr-h2{font-size:16px;font-weight:700;color:#1E2530;margin:16px 0 3px}.lr-sub{font-size:12px;color:#555;margin:0 0 8px;line-height:1.5}'
+'table.lr-t{width:100%;border-collapse:collapse;font-size:11.5px}table.lr-t th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;font-weight:500;text-align:center;padding:6px 6px;border-bottom:1px solid rgba(30,37,48,.25);vertical-align:bottom;line-height:1.35}table.lr-t th.l,table.lr-t td.l{text-align:left;padding-left:0}table.lr-t td{padding:3.5px 6px;text-align:center;border-bottom:1px solid rgba(30,37,48,.08);color:#1E2530;vertical-align:middle}table.lr-t td.nm{font-weight:600;white-space:nowrap}table.lr-t td.role{color:#555;font-size:11.5px;text-align:left}'
+'.lr-nl{font-family:var(--mono,monospace);font-size:8.5px;color:#777;font-weight:400;margin-left:4px}'
+'table.lr-heat{width:100%;border-collapse:separate;border-spacing:2px;font-size:12px;table-layout:fixed}table.lr-heat th{font-size:11.5px;font-weight:600;color:#1E2530;text-align:center;padding:4px 2px 10px;line-height:1.25;vertical-align:bottom}table.lr-heat th.c{width:200px;text-align:left}table.lr-heat td{text-align:center;padding:15px 2px;font-weight:700;font-size:16px;border-radius:3px}table.lr-heat td.c{text-align:left;font-weight:500;font-size:13px;color:#1E2530;padding-left:0}'
+'.lr-leg{font-size:11px;color:#555;margin-top:10px}.lr-sw{display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin:0 5px 0 14px}'
+'.lr-tick{color:#1B6B5A;font-size:14px;font-weight:700}.lr-open{color:#B0B7BF;font-size:13px}'
+'.lr-per{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:1px solid rgba(107,76,138,.3);background:rgba(107,76,138,.05);border-radius:6px;margin:0 0 10px}.lr-per .p{font-family:var(--serif,Georgia,serif);font-size:20px;color:#111}.lr-per .d{font-family:var(--mono,monospace);font-size:10.5px;color:#555;margin-left:10px}.lr-per .s{display:flex;gap:18px}.lr-per .s b{font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:400;display:block;line-height:1;text-align:center}.lr-per .s span{font-family:var(--mono,monospace);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;display:block;text-align:center;margin-top:2px}'
+'table.lr-mr{width:100%;border-collapse:collapse;font-size:11.5px;page-break-inside:avoid}table.lr-mr th{font-family:var(--mono,monospace);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:#555;font-weight:500;text-align:center;padding:4px 3px 6px;border-bottom:1px solid rgba(30,37,48,.25);vertical-align:bottom;line-height:1.3}table.lr-mr th.l{text-align:left;padding-left:0}table.lr-mr td{padding:3px 3px;text-align:center;border-bottom:1px solid rgba(30,37,48,.07);height:21px}table.lr-mr td.nm{text-align:left;padding-left:0;font-weight:600;color:#1E2530;white-space:nowrap}.lr-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#D5D9DE;vertical-align:middle}.lr-dot.on{background:#1B6B5A}'
+'.lr-dp{border:2px solid #4E7FA6;border-radius:8px;padding:12px 14px;margin-top:14px;page-break-inside:avoid}.lr-dp h3{font-size:15px;font-weight:700;margin:0 0 2px;color:#1E2530}.lr-dp .lr-sub{margin-bottom:8px}.lr-dpr{display:flex;align-items:center;gap:10px;margin:0 0 5px;font-size:12px}.lr-dpr .r{font-family:var(--mono,monospace);font-size:11px;color:#555;width:16px;text-align:right}.lr-dpr .n{min-width:210px;color:#1E2530}.lr-dpr .bar{flex:1;height:6px;background:rgba(30,37,48,.08);border-radius:3px}.lr-dpr .bar div{height:100%;border-radius:3px}.lr-dpr .v{font-family:var(--mono,monospace);font-size:11px;color:#1E2530;min-width:28px;text-align:right}'
+'.lr-dorm{border:1px solid rgba(30,37,48,.15);border-radius:8px;padding:16px;font-size:12.5px;color:#444;line-height:1.55}.lr-empty{font-size:12.5px;color:#666}';
function ldevReportBody(opts){opts=opts||{};var cf=data.competencyFramework||{};var leaders=data.leaders||[];var rv=data.leadershipReview||{};var a=data.assessments||{};
var head=function(kicker,title,lead){return'<div class="lr-hk">'+kicker+'</div><div class="lr-h">'+title+'</div>'+(lead?'<div class="lr-lead">'+lead+'</div>':'')+'<div class="lr-rule"></div>'};
var nameParts=function(l){var n=String(l.name||'?').trim();var k=n.lastIndexOf(' ');return k>0?[n.slice(0,k),n.slice(k+1)]:[n,'']};
var h='';
/* 1. Competency Heat Map – its own landscape page */
h+='<div class="lr-land">'+(opts.sectionHead||'')+head('L&D Hub','Competency Heat Map','Each leader\u2019s score on the seven leadership competencies, 1\u20135, from the Competency Framework at Step 2.3.');
if(leaders.length&&cf.scores){
  h+='<table class="lr-heat"><thead><tr><th class="c"></th>'+leaders.map(function(l){var p=nameParts(l);return'<th title="'+esc(l.name||'?')+'">'+esc(p[0])+(p[1]?'<br/>'+esc(p[1]):'')+'</th>'}).join('')+'</tr></thead><tbody>';
  LDEV_COMPS.forEach(function(c){h+='<tr><td class="c">'+esc(c.name)+'</td>'+leaders.map(function(l){var v=(cf.scores||{})[l.id+'_'+c.id]||0;
    var st=v>=4?'background:rgba(27,107,90,.28);color:#0F4A3E':v>=3?'background:rgba(78,127,166,.24);color:#1E3A55':v>0?'background:rgba(155,45,63,.22);color:#6E1F2D':'background:rgba(30,37,48,.05);color:#888';
    return'<td style="'+st+'">'+(v||'\u2014')+'</td>'}).join('')+'</tr>'});
  h+='</tbody></table>';
  h+='<div class="lr-leg">Score, out of 5 <span class="lr-sw" style="background:rgba(27,107,90,.28)"></span>4\u20135 strong <span class="lr-sw" style="background:rgba(78,127,166,.24)"></span>3 developing <span class="lr-sw" style="background:rgba(155,45,63,.22)"></span>1\u20132 gap <span class="lr-sw" style="background:rgba(30,37,48,.05)"></span>\u2014 not scored</div>';
}else h+='<p class="lr-empty">Complete Step 2.3 (Competency Framework) to populate this view.</p>';
h+='</div>';
/* 2. Study Completion and AI Fluency Progress – one portrait page */
h+='<div class="lr-pg">'+head('L&D Hub','Study Progress','Each leader\u2019s individual mindset and composure track, and the movement in AI fluency since the baseline.');
h+='<div class="lr-blk"><div class="lr-h2" style="margin-top:0">Study Completion</div><div class="lr-sub">Individual mindset &amp; composure track \u2014 completion per leader.</div>';
if(leaders.length){var _indivDone=data.indivDone||{};
  h+='<table class="lr-t"><thead><tr><th class="l">Leader</th>'+LDEV_STEPS.map(function(s){return'<th>'+esc(s.name)+'<br/><span style="letter-spacing:0;text-transform:none;color:#888">'+esc(s.phase)+'</span></th>'}).join('')+'<th>Done</th></tr></thead><tbody>';
  leaders.forEach(function(l){var dn=_indivDone[l.id]||{};var n=0;
    h+='<tr><td class="l nm">'+esc(l.name||'?')+(l.userId?'':'<span class="lr-nl">(no login)</span>')+'</td>'+LDEV_STEPS.map(function(s){var done=!!dn[s.id];if(done)n++;return'<td>'+(done?'<span class="lr-tick">\u2713</span>':'<span class="lr-open">\u25CB</span>')+'</td>'}).join('')+'<td style="font-family:var(--mono,monospace);font-size:11px;color:'+(n===LDEV_STEPS.length?'#1B6B5A':'#555')+'">'+n+'/'+LDEV_STEPS.length+'</td></tr>'});
  h+='</tbody></table>';
}else h+='<p class="lr-empty">No leaders mapped yet.</p>';
h+='</div><div class="lr-blk"><div class="lr-h2">AI Fluency Progress</div><div class="lr-sub">Baseline fluency, the three sprint tasks, the rescore at review, and the growth between them.</div>';
if(leaders.length){var baselineFluency=(a.fluency||{}).foundational||0;var fl=data.fluencySprint||{};
  h+='<table class="lr-t"><thead><tr><th class="l">Leader</th><th class="l">Role</th><th>Baseline</th><th>Tasks</th><th>Rescore</th><th>Growth</th></tr></thead><tbody>';
  leaders.forEach(function(l,i){var baseline=parseInt(l.fluency)||baselineFluency;var rescore=(rv.leaders||{})[l.id]?(rv.leaders[l.id].fluency||0):0;var lt=(fl.leaderTasks||{})[l.id]||{};var taskCount=[lt.task1,lt.task2,lt.task3].filter(function(t){return!!t}).length;var delta=rescore?rescore-baseline:null;
    var deltaCol=delta!==null?(delta>=2?'#1B6B5A':delta>=1?'#4E7FA6':'#1E2530'):'#999';
    h+='<tr><td class="l nm">'+esc(l.name||'Leader '+(i+1))+'</td><td class="role">'+esc(leaderRoleName(l))+'</td><td>'+baseline+'/5</td><td style="font-weight:700;color:'+(taskCount>=3?'#1B6B5A':taskCount>0?'#4E7FA6':'#999')+'">'+taskCount+'/3</td><td>'+(rescore||'\u2014')+'</td><td style="font-family:var(--mono,monospace);font-weight:700;color:'+deltaCol+'">'+(delta!==null?((delta>0?'+':'')+delta):'\u2014')+'</td></tr>'});
  h+='</tbody></table>';
}
h+='</div></div>';
/* 3. Monthly Reviews Health, compact, with the Development Priorities beneath */
h+='<div class="lr-pg">'+head('L&D Hub','Practice Health','The monthly reviews each leader keeps up, and the competencies with the widest gaps.');
h+='<div class="lr-h2" style="margin-top:0">Monthly Reviews Health</div>';
if(getProgress().pct!==100){
  h+='<div class="lr-dorm"><div class="lr-hk" style="color:#555">\u25CB Dormant</div>Monthly reviews begin once the 90-day module is complete. Until every organizational step across Phases 1\u20134 is finished, leaders are still working through the practices these reviews maintain.</div>';
}else{
  var now=new Date();var pk=periodKey(now);
  var rows=leaders.map(function(l){return{leader:l,linked:!!l.userId,log:((data.practiceLog||{})[l.userId])||{}}});
  var doneNow=function(iso){return !!iso&&periodKey(new Date(iso))===pk};
  var g=0,n=0;rows.forEach(function(r){LDEV_PRACTICES.forEach(function(p){if(doneNow(r.log[p.id]||null))g++;else n++})});
  h+='<div class="lr-per"><div><span class="p">'+esc(periodLabel(pk))+'</span><span class="d">'+daysLeftInMonth(now)+' days left in this period</span></div><div class="s"><div><b style="color:#1B6B5A">'+g+'</b><span>Done</span></div><div><b style="color:#555">'+n+'</b><span>Not started</span></div></div></div>';
  if(rows.length){
    h+='<table class="lr-mr"><thead><tr><th class="l">Leader</th>'+LDEV_PRACTICES.map(function(p){return'<th>'+esc(p.name).replace(' ','<br/>')+'</th>'}).join('')+'</tr></thead><tbody>';
    rows.forEach(function(r){h+='<tr><td class="nm">'+esc(r.leader.name||'?')+(r.linked?'':'<span class="lr-nl">(no login)</span>')+'</td>'+LDEV_PRACTICES.map(function(p){return'<td><span class="lr-dot'+(doneNow(r.log[p.id]||null)?' on':'')+'"></span></td>'}).join('')+'</tr>'});
    h+='</tbody></table>';
    h+='<div class="lr-leg" style="margin-top:6px"><span class="lr-dot on" style="margin-right:5px"></span>done this month <span class="lr-dot" style="margin:0 5px 0 14px"></span>not started</div>';
  }else h+='<p class="lr-empty">No leaders mapped yet.</p>';
}
var gaps=(leaders.length&&cf.scores)?ldevGaps():[];
if(gaps.length){h+='<div class="lr-dp"><h3>Development Priorities</h3><div class="lr-sub">Competencies ranked by gap severity (lowest average scores first).</div>'
  +gaps.map(function(gp,i){var col=gp.avg>=4?'#1B6B5A':gp.avg>=2.5?'#4E7FA6':'#9B2D3F';return'<div class="lr-dpr"><span class="r">'+(i+1)+'</span><span class="n">'+esc(gp.name)+'</span><div class="bar"><div style="width:'+(gp.avg*20)+'%;background:'+col+'"></div></div><span class="v">'+gp.avg.toFixed(1)+'</span></div>'}).join('')+'</div>'}
h+='</div>';
return h}
function printLdevHubReport(){printDocument('L&D Hub',printDocCover('L&D Hub',ldevHubLead(),'')+ldevReportBody(),LDEV_REPORT_CSS)}
/* ═══ L&D HUB ═══ */
/* ═══ L&D HUB ═══ */
function renderLdevHub(){
  practiceRollover();
  var cf=data.competencyFramework||{};var leaders=data.leaders||[];var rv=data.leadershipReview||{};var a=data.assessments||{};
  var COMPS=LDEV_COMPS;
  var h='<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">L&D Hub</h2>';
  h+='<p style="color:var(--text-body);margin:8px 0 24px;line-height:1.6;font-size:14px">'+ldevHubLead()+'</p>';

  // ── 1. Competency Heat Map ──
  if(leaders.length&&cf.scores){
    h+=card('<h3 class="h-sub-lg">Competency Heat Map</h3>'
      +'<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:180px repeat('+leaders.length+',1fr);gap:1px;font-size:12px;min-width:'+(180+leaders.length*80)+'px">'
      +'<div style="padding:8px;font-weight:700;color:var(--stone)"></div>'
      +leaders.map(function(l){return'<div title="'+esc(l.name||'?')+'" style="padding:8px;font-weight:600;text-align:center;font-size:11px;color:var(--paper)">'+esc((l.name||'?').split(' ')[0])+'</div>'}).join('')
      +COMPS.map(function(c){
        return'<div style="padding:8px;color:var(--stone);border-top:1px solid rgba(var(--fg-rgb),.06);font-size:11px">'+esc(c.name)+'</div>'
          +leaders.map(function(l){
            var v=(cf.scores||{})[l.id+'_'+c.id]||0;
            var bg=v>=4?'rgba(27,107,90,.3)':v>=3?'rgba(var(--gold-rgb),.2)':v>0?'rgba(155,45,63,.2)':'rgba(var(--fg-rgb),.04)';
            return'<div title="'+esc(l.name||'?')+' \u2013 '+esc(c.name)+': '+(v?v+'/5':'Not scored')+'" style="padding:8px;text-align:center;background:'+bg+';border-top:1px solid rgba(var(--fg-rgb),.06);font-weight:600;color:var(--paper);cursor:help">'+(v||'\u2014')+'</div>';
          }).join('');
      }).join('')
      +'</div></div>'
    ,'border:2px solid #2D5A8E;margin-bottom:16px');
  } else {
    h+=card('<h3 class="h-sub-lg">Competency Heat Map</h3><p style="color:var(--stone);text-align:center;padding:24px">Complete Step 2.3 (Competency Framework) to populate this view.</p>','margin-bottom:16px');
  }

  // ── 2. Study Completion Grid (per leader) ──
  var ldevSteps=LDEV_STEPS;
  if(leaders.length){
    var _indivDone=data.indivDone||{};
    h+=card('<h3 class="h-sub">Study Completion</h3>'
      +'<p style="font-size:12px;color:var(--stone);margin:0 0 16px">Individual mindset & composure track \u2014 completion per leader.</p>'
      +'<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:180px repeat('+ldevSteps.length+',1fr);gap:1px;font-size:12px;min-width:'+(180+ldevSteps.length*90)+'px">'
      +'<div style="padding:8px"></div>'
      +ldevSteps.map(function(s){return'<div style="padding:8px 4px;font-family:var(--mono);font-size:9px;color:var(--stone);text-align:center;letter-spacing:.06em">'+esc(s.name)+'</div>';}).join('')
      +leaders.map(function(l){
        var dn=_indivDone[l.id]||{};
        var linked=!!l.userId;
        return'<div style="padding:8px;font-weight:600;font-size:11px;color:var(--paper);border-top:1px solid rgba(var(--fg-rgb),.06);display:flex;align-items:center;gap:6px">'+esc(l.name||'?')+(linked?'':' <span style="font-family:var(--mono);font-size:8px;color:var(--stone)">(no login)</span>')+'</div>'
          +ldevSteps.map(function(s){
            var done=!!dn[s.id];
            return'<div style="padding:8px;text-align:center;border-top:1px solid rgba(var(--fg-rgb),.06);color:'+(done?'#1B6B5A':'rgba(138,130,120,.5)')+';font-size:14px;font-weight:700">'+(done?'\u2713':'\u25CB')+'</div>';
          }).join('');
      }).join('')
      +'</div></div>'
    ,'margin-bottom:16px');
  } else {
    h+=card('<h3 class="h-sub-lg">Study Completion</h3><p style="color:var(--stone);text-align:center;padding:24px">No leaders mapped yet.</p>','margin-bottom:16px');
  }

  // ── 3. Fluency Progress ──
  if(leaders.length){
    var baselineFluency=(a.fluency||{}).foundational||0;
    h+=card('<h3 class="h-sub-lg">AI Fluency Progress</h3>'
      +leaders.map(function(l,i){
        var baseline=parseInt(l.fluency)||baselineFluency;
        var rescore=(rv.leaders||{})[l.id]?(rv.leaders[l.id].fluency||0):0;
        var fl=data.fluencySprint||{};var lt=(fl.leaderTasks||{})[l.id]||{};
        var taskCount=[lt.task1,lt.task2,lt.task3].filter(function(t){return!!t}).length;
        var delta=rescore?rescore-baseline:null;
        var deltaCol=delta!==null?(delta>=2?'#1B6B5A':delta>=1?'#4E7FA6':'var(--text-body)'):'var(--stone)';
        return'<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.04)">'
          +'<div style="min-width:140px"><div style="font-size:13px;font-weight:600;color:var(--paper)">'+esc(l.name||'Leader '+(i+1))+'</div><div style="font-size:11px;color:var(--stone)">'+esc(leaderRoleName(l))+'</div></div>'
          +'<div style="min-width:70px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Baseline</div><div style="font-size:16px;font-weight:700;color:var(--paper)">'+baseline+'/5</div></div>'
          +'<div style="min-width:70px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Tasks</div><div style="font-size:16px;font-weight:700;color:'+(taskCount>=3?'#1B6B5A':taskCount>0?'#4E7FA6':'var(--stone)')+'">'+taskCount+'/3</div></div>'
          +'<div style="min-width:70px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Rescore</div><div style="font-size:16px;font-weight:700;color:var(--paper)">'+(rescore||'\u2014')+'</div></div>'
          +(delta!==null?'<div style="min-width:80px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Growth</div><div style="font-family:var(--mono);font-size:13px;font-weight:700;color:'+deltaCol+'">'+(delta>0?'+':'')+delta+'</div></div>':'')
          +'</div>';
      }).join('')
    ,'margin-bottom:16px');
  }

  // ── 4. Ongoing Practices Health (per-leader grid) ──
  // Rows are keyed to LEADERS (not login accounts), showing the leader's name. The
  // practice data is stored per user (data.practiceLog[userId]), so each leader is
  // mapped to its linked user via leader.userId to pull the right log. Leaders with
  // no linked login have no log (all cells "not started"), matching Study Completion.
  var now=new Date();
  function daysSince(isoStr){if(!isoStr)return null;return Math.floor((now-new Date(isoStr))/(1000*60*60*24))}
  var practiceKeys=LDEV_PRACTICES;
  // Pair each leader with its linked user (for the practice log + avatar color).
  var _practiceRows=(data.leaders||[]).map(function(l){
    var u=l.userId?USERS.find(function(x){return x.id===l.userId;}):null;
    return {leader:l,user:u,log:((data.practiceLog||{})[l.userId])||{}};
  });
  // A practice counts as done when its last-done timestamp falls within the CURRENT
  // period (this calendar month). The grid is binary: done (green) or not started.
  // No "days since", no overdue, no blue -- within a month a practice is simply done
  // or not.
  function doneThisPeriod(isoStr){
    if(!isoStr)return false;
    return periodKey(new Date(isoStr))===periodKey(new Date());
  }
  function statusDot(done){
    if(done)return'<div style="width:10px;height:10px;border-radius:50%;background:#1B6B5A" title="Done this month"></div>';
    return'<div style="width:10px;height:10px;border-radius:50%;background:rgba(138,130,120,.3)" title="Not started"></div>';
  }
  // Leader-initial avatar fallback for leaders with no linked login.
  function leaderAv(l,size){
    var s=size||18;var ini=(l.name||'?').split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase();
    return'<div title="'+esc(l.name||'')+'" style="width:'+s+'px;height:'+s+'px;border-radius:'+(s/2)+'px;background:rgba(138,130,120,.35);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:'+Math.round(s*0.42)+'px;font-weight:700;font-family:monospace;flex-shrink:0">'+esc(ini)+'</div>';
  }
  // Summary counts across all leaders: done vs not started for the current month.
  var greenCount=0;var greyCount=0;
  _practiceRows.forEach(function(row){practiceKeys.forEach(function(p){if(doneThisPeriod(row.log[p.id]||null))greenCount++;else greyCount++})});

  // Monthly reviews only begin once the 90-day module is complete (all organizational
  // steps across phases 1-4 done). Until then this tracker is dormant: leaders have not
  // yet reached all the work these reviews maintain, so tracking would be meaningless.
  // Individual-track stragglers are surfaced separately on the Study Completion grid.
  var _reviewsLive=getProgress().pct===100;
  if(!_reviewsLive){
    h+=card('<h3 class="h-sub-lg">Monthly Reviews Health</h3>'
      +'<div style="text-align:center;padding:28px 20px;opacity:.7">'
      +'<div style="font-family:var(--mono);font-size:10px;color:var(--stone);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">\u25CB Dormant</div>'
      +'<p style="font-size:13px;color:var(--stone);line-height:1.6;max-width:440px;margin:0 auto">Monthly reviews begin once the 90-day module is complete. Until every organizational step across Phases 1\u20134 is finished, leaders are still working through the practices these reviews maintain. Track who has completed their individual work on the Study Completion grid above.</p>'
      +'</div>'
    ,'margin-bottom:16px');
  } else {
  h+=card('<h3 class="h-sub-lg">Monthly Reviews Health</h3>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:10px 14px;background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.25);border-radius:8px">'
    +'<div style="display:flex;align-items:baseline;gap:10px"><span style="font-family:var(--serif);font-size:18px;font-weight:300;color:var(--paper)">'+esc(periodLabel(periodKey(new Date())))+'</span><span style="font-family:var(--mono);font-size:11px;color:var(--stone)">'+daysLeftInMonth(new Date())+' days left in this period</span></div>'
    +'<button onclick="if(confirm(\'Close the current period? This archives the current practice health as a snapshot you can view later, and resets everyone\\u2019s practices for the new period.\'))manualResetPractices()" style="padding:5px 12px;font-size:11px;font-family:var(--mono);background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;color:var(--stone);cursor:pointer">Close period &amp; reset</button>'
    +'</div>'
    +'<div style="display:flex;gap:16px;margin-bottom:16px">'
    +'<div style="text-align:center;flex:1"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:#1B6B5A">'+greenCount+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.1em">Done</div></div>'
    +'<div style="text-align:center;flex:1"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:var(--stone)">'+greyCount+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.1em">Not Started</div></div>'
    +'</div>'
    // Grid: leaders as rows, practices as columns
    +(_practiceRows.length?('<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:150px repeat('+practiceKeys.length+',1fr);gap:1px;min-width:'+(150+practiceKeys.length*80)+'px">'
    // Header row
    +'<div style="padding:6px 8px"></div>'
    +practiceKeys.map(function(p){return'<div style="padding:6px 4px;font-family:var(--mono);font-size:9px;color:var(--stone);text-align:center;letter-spacing:.05em">'+esc(p.name)+'</div>'}).join('')
    // Leader rows
    +_practiceRows.map(function(row){
      var l=row.leader;var av=row.user?userAv(row.user,18):leaderAv(l,18);
      var nm=(l.name||'?').split(' ')[0];
      return'<div style="padding:8px;display:flex;align-items:center;gap:6px;border-top:1px solid rgba(var(--fg-rgb),.04)">'+av+'<span style="font-size:11px;color:var(--paper);font-weight:600">'+esc(nm)+'</span>'+(row.user?'':' <span style="font-family:var(--mono);font-size:8px;color:var(--stone)">(no login)</span>')+'</div>'
        +practiceKeys.map(function(p){
          var done=doneThisPeriod(row.log[p.id]||null);
          return'<div style="padding:8px;text-align:center;border-top:1px solid rgba(var(--fg-rgb),.04);display:flex;align-items:center;justify-content:center">'+statusDot(done)+'</div>';
        }).join('');
    }).join('')
    +'</div></div>'):'<p style="color:var(--stone);text-align:center;padding:16px;font-size:13px">No leaders mapped yet.</p>')
  ,'margin-bottom:16px');
  }

  // ── 4b. Practice History (archived period snapshots) ──
  var _hist=data.practiceHistory||{};
  var _histKeys=Object.keys(_hist).sort().reverse();  // most recent first
  if(_histKeys.length){
    var hh='<h3 class="h-sub">Practice History</h3>'
      +'<p style="font-size:12px;color:var(--stone);margin:0 0 14px">Archived snapshots of how practices stood at the close of each period.</p>';
    _histKeys.forEach(function(pk){
      var rec=_hist[pk];if(!rec)return;
      var hk='ph_hist_'+pk;var hopen=UI.ctxOpen[hk];
      var sm=rec.summary||{green:0,red:0,grey:0};
      hh+='<div style="border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;margin-bottom:8px;overflow:hidden">';
      hh+='<div onclick="UI.ctxOpen[\''+hk+'\']=!UI.ctxOpen[\''+hk+'\'];render()" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer">';
      hh+='<span style="font-size:13px;font-weight:600;color:var(--paper);flex:1">'+esc(periodLabel(pk))+'</span>';
      hh+='<span style="font-family:var(--mono);font-size:10px;color:#1B6B5A">'+sm.green+' done</span>';
      hh+='<span style="font-family:var(--mono);font-size:10px;color:#9B2D3F">'+sm.red+' not done</span>';
      hh+='<span style="font-size:11px;color:rgba(138,130,120,.6)">'+(hopen?'\u25BE':'\u25B8')+'</span></div>';
      if(hopen){
        var us=rec.users||[];var ps=rec.practices||[];var cells=rec.cells||{};
        hh+='<div style="padding:0 14px 14px;overflow-x:auto"><div style="display:grid;grid-template-columns:120px repeat('+ps.length+',1fr);gap:1px;min-width:'+(120+ps.length*70)+'px">';
        hh+='<div style="padding:6px 8px"></div>';
        ps.forEach(function(p){hh+='<div style="padding:6px 4px;font-family:var(--mono);font-size:9px;color:var(--stone);text-align:center;letter-spacing:.05em">'+esc(p.name)+'</div>';});
        us.forEach(function(u){
          var row=cells[u.id]||{};
          hh+='<div style="padding:8px;font-size:11px;color:var(--paper);font-weight:600;border-top:1px solid rgba(var(--fg-rgb),.04)">'+esc((u.name||'?').split(' ')[0])+'</div>';
          ps.forEach(function(p){
            var s=row[p.id]||'grey';
            // Binary in history: done that month (green/blue from older snapshots) -> green;
            // not done (red/grey) -> red. No blue, no "not started" distinction here.
            var done=(s==='green'||s==='blue');
            var col=done?'#1B6B5A':'#9B2D3F';
            hh+='<div style="padding:8px;text-align:center;border-top:1px solid rgba(var(--fg-rgb),.04)"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+col+'"></span></div>';
          });
        });
        hh+='</div></div>';
      }
      hh+='</div>';
    });
    h+=card(hh,'margin-bottom:16px');
  }

  // ── 5. Development Priorities ──
  if(leaders.length&&cf.scores){
    var gaps=ldevGaps();
    if(gaps.length){
      h+=card('<h3 class="h-sub-lg">Development Priorities</h3><p style="font-size:13px;color:var(--stone);margin-bottom:12px">Competencies ranked by gap severity (lowest average scores first).</p>'
        +gaps.map(function(g,i){
          var col=g.avg>=4?'#1B6B5A':g.avg>=2.5?'#4E7FA6':'#9B2D3F';
          return'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-family:var(--mono);font-size:12px;color:var(--stone);width:20px;text-align:right">'+(i+1)+'</div><div style="font-size:13px;color:var(--paper);min-width:200px">'+esc(g.name)+'</div><div style="flex:1;height:6px;background:rgba(var(--fg-rgb),.06);border-radius:3px"><div style="height:100%;width:'+g.avg*20+'%;background:'+col+';border-radius:3px"></div></div><div style="font-family:var(--mono);font-size:12px;color:var(--paper);min-width:30px;text-align:right">'+g.avg.toFixed(1)+'</div></div>';
        }).join('')
      ,'border:2px solid #4E7FA6');
    }
  }

  return h;
}

/* ═══ OUTCOME PAGES ═══ */

/* PRINT PIPELINE (Paul's ruling, 12 Sep 2026; family baseline). Executive Readiness printed the live page; it now prints a document: a cover, the output's body without its heading and without controls, and the copyright footer on every page. */
var PRINT_MODULE_NAME='90-Day Executive Readiness'; /* 16 Sep 2026 (Paul's ruling): the cover's kicker takes the Governance form — 90-Day and the module's name, as Governance reads 90-Day Responsible AI Governance; the home page reads 90 Days to Executive Readiness and the sidebar Executive Readiness */

/* PRINT BASELINE (Paul's ruling, 12 Sep 2026; family): the cover's parts and the footer's words */
function printDateLine(){return new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
function printFooterText(){return '\u00a9 '+new Date().getFullYear()+' Next Chapter, LLC. All rights reserved.'} /* the same words as the site footer at nextchapter.org */
function printDocCover(title,lead,countLine){var org=(function(){var ent=(data&&data.enterprise&&String(data.enterprise.name||'').trim())||'';if(ent)return ent;var o=null;try{o=getOrg(currentOrgId)}catch(e){}return (o&&o.name)||''})(); /* 13 Sep 2026 (Paul's ruling; family): the cover names the organization as Organization Details (the Organization & Team panel) records it; the sign-in organization's label is the fallback only when that name is blank — ported to Executive Readiness 16 Sep 2026 (Paul's ruling: the cover as Governance has it) */
return '<div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:85vh">'
+'<div style="font-family:var(--mono,monospace);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin:0 0 18px">NextChapter \u00b7 '+esc(PRINT_MODULE_NAME)+'</div>'
+'<div style="font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px">'+esc(title)+'</div>'
+(lead?'<div style="font-size:14px;color:#444;line-height:1.6;max-width:520px;margin:0 0 26px">'+esc(lead)+'</div>':'')
+'<div style="border-top:2px solid #111;padding-top:12px;color:#333">'+(org?'<div style="font-size:18px;font-weight:600;color:#111;margin:0 0 4px">'+esc(org)+'</div>':'')+'<div style="font-size:13px">'+printDateLine()+'</div></div>'
+'</div>'} /* PRINT COVER (Paul's ruling, 12 Sep 2026; family): NextChapter · module, the title, the lead, the organization a little bigger, the date alone; no phase, no count (the count argument is accepted and ignored) */
var OUT_RENDERERS={'out-readiness':renderOutReadiness,'out-inventory':renderOutInventory,'out-riskmap':renderOutRiskMap,'out-structure':renderOutStructure,'out-collab':renderOutCollab,'out-competency':renderOutCompetency,'out-fluency':renderOutFluency,'out-decisions':renderOutDecisions,'out-mmprinciples':renderOutMMPrinciples,'out-values':renderOutValues,'out-rhythm':renderOutRhythm,'out-evalplan':renderOutEvalPlan,'out-review':renderOutReview};
function _pdStrip(body){var m=body.indexOf('Save as PDF</button></div>');if(m>=0)body=body.slice(m+26);return body.replace(/<button[\s\S]*?<\/button>/g,'')}
function _pdTitle(body){var m=body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);return m?m[1].replace(/<[^>]+>/g,'').trim():'Report'}
function _pdLead(body){var m=body.indexOf('Save as PDF</button></div>');if(m<0)return '';var p=body.slice(0,m).match(/<p[^>]*>([\s\S]*?)<\/p>/);return p?p[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim():''}
function printCurrentOutput(){var doc=(typeof PRINT_DOCS!=='undefined')&&PRINT_DOCS[currentStep];if(doc){var nm=((PH.reduce(function(a,p){return a.concat(p.outcomes||[])},[]).find(function(o){return o.id===currentStep}))||{}).name||'Output';printDocument(nm,doc(),'');return} /* 14 Sep 2026 (Paul's ruling): an output with a document prints the document; the cleaned screen is the fallback */
  var fn=OUT_RENDERERS[currentStep];if(!fn){window.print();return}var raw=fn();printPage(_pdTitle(raw),function(){return raw})}

/* ═══ OUTCOME PAGES ═══ */
function renderOutcomePage(){
  var id=currentStep;var ph=currentPhase;
  var h='<div class="content-area"><div class="content-inner">';
  h+=backBtn();
  if(id==='out-readiness')h+=renderOutReadiness();
  else if(id==='out-inventory')h+=renderOutInventory();
  else if(id==='out-riskmap')h+=renderOutRiskMap();
  else if(id==='out-structure')h+=renderOutStructure();
  else if(id==='out-collab')h+=renderOutCollab();
  else if(id==='out-competency')h+=renderOutCompetency();
  else if(id==='out-fluency')h+=renderOutFluency();
  else if(id==='out-decisions')h+=renderOutDecisions();
  else if(id==='out-mmprinciples')h+=renderOutMMPrinciples();
  else if(id==='out-values')h+=renderOutValues();
  else if(id==='out-rhythm')h+=renderOutRhythm();
  else if(id==='out-evalplan')h+=renderOutEvalPlan();
  else if(id==='out-review')h+=renderOutReview();
  else h+='<p style="color:var(--stone)">This output will be generated when the relevant steps are complete.</p>';
  h+='</div></div>';return h;
}

/* ── Readiness Report ── */
function readinessBody(){ /* the Readiness Report page: the five area tiles, the overall score card, and the category cards with their bars; its document is readinessDoc (15 Sep 2026, Paul's ruling: a document is composed for paper, never the page passed through) */
  var a=data.assessments||{};var co=data.completedSections||{};var secs=['A','B','C','D','E'];var done=secs.filter(function(s){return co[s]}).length;var h='';
  // Summary stats
  var scores=[];
  var cats=READINESS_CATS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  h+='<div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">';
  cats.forEach(function(cat){
    var sub=a[cat.k]||{};var vals=cat.fields.map(function(f){return typeof sub[f]==='number'?sub[f]:0}).filter(function(v){return v>0});
    var avg=vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0;
    scores.push(avg);
    var col=avg>=4?'#1B6B5A':avg>=2.5?'#4E7FA6':'#9B2D3F';
    h+='<div style="flex:1;min-width:140px;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+col+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:'+col+'">'+avg.toFixed(1)+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase;margin-top:4px">'+cat.name+'</div></div>';
  });
  h+='</div>';
  // Overall
  var overall=scores.length?scores.reduce(function(a,b){return a+b},0)/scores.length:0;
  var oCol=overall>=4?'#1B6B5A':overall>=2.5?'#4E7FA6':'#9B2D3F';
  h+=card('<div style="text-align:center"><div style="font-family:var(--serif);font-size:56px;font-weight:300;color:'+oCol+'">'+overall.toFixed(1)+'<span style="font-size:24px;color:var(--stone)">/5</span></div><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--stone);text-transform:uppercase;margin-top:4px">Overall Readiness Score</div><div style="margin-top:12px;font-size:13px;color:var(--stone)">'+readinessReading(overall)+'</div></div>','border:2px solid '+oCol+';margin-bottom:24px');
  // Section details
  if(done<5){h+='<p style="color:var(--stone);font-style:italic">Complete all five sections of the Assessment Battery to see detailed breakdowns.</p>';return h}
  cats.forEach(function(cat){
    var sub=a[cat.k]||{};
    h+=card('<h3 class="h-sub-lg">'+cat.name+'</h3>'+cat.fields.map(function(f){
      var v=typeof sub[f]==='number'?sub[f]:0;var barCol=v>=4?'#1B6B5A':v>=3?'#4E7FA6':'#9B2D3F';
      return'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-size:12px;color:var(--stone);min-width:140px">'+esc(READINESS_LABELS[f]||f)+'</div><div style="flex:1;height:6px;background:rgba(var(--fg-rgb),.06);border-radius:3px"><div style="height:100%;width:'+v*20+'%;background:'+barCol+';border-radius:3px"></div></div><div style="font-family:var(--mono);font-size:12px;color:var(--paper);min-width:24px;text-align:right">'+v+'</div></div>'
    }).join('')+
    // Show text fields if they exist
    (sub.mission?'<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.06)"><div style="font-size:11px;color:var(--stone);font-weight:600;margin-bottom:4px">Mission</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(sub.mission)+'</div></div>':'')+
    (sub.priorities?'<div style="margin-top:8px"><div style="font-size:11px;color:var(--stone);font-weight:600;margin-bottom:4px">Strategic Priorities</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(sub.priorities)+'</div></div>':'')
    );
  });
    return h}

/* ── Readiness Report ── */
function renderOutReadiness(){
  var a=data.assessments||{};var co=data.completedSections||{};
  var secs=['A','B','C','D','E'];var done=secs.filter(function(s){return co[s]}).length;
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Readiness Report</h2><p style="color:var(--stone);font-size:13px">Phase 1: Assess \u2014 synthesized from the Assessment Battery</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=readinessBody();
  return h;
}

/* ── Leadership Inventory ── */
function inventoryFigs(){var leaders=data.leaders||[]; /* 15 Sep 2026: the four figures the page's band and the Leadership Inventory document share */
  var fluencyVals=leaders.map(function(l){return parseInt(l.fluency)||0}).filter(function(v){return v>0});
  var avgFluency=fluencyVals.length?(fluencyVals.reduce(function(a,b){return a+b},0)/fluencyVals.length).toFixed(1):'—';
  var activeCount=leaders.filter(function(l){return l.engagement==='active'}).length;
  var overloaded=leaders.filter(function(l){return l.bandwidth==='overloaded'||l.bandwidth==='stretched'}).length;
  return {total:leaders.length,avgFluency:avgFluency,active:activeCount,overloaded:overloaded}}
function inventoryStatBand(){var leaders=data.leaders||[];var h='';var _f=inventoryFigs();var avgFluency=_f.avgFluency,activeCount=_f.active,overloaded=_f.overloaded;
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #2D5A8E"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#2D5A8E">'+leaders.length+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Leaders Mapped</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #1B6B5A"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#1B6B5A">'+avgFluency+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Avg AI Fluency</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(activeCount>=leaders.length/2?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+activeCount+'/'+leaders.length+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Actively Engaged</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(overloaded>leaders.length/2?'#9B2D3F':'#1B6B5A')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:'+(overloaded>leaders.length/2?'#9B2D3F':'var(--paper)')+'">'+overloaded+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Stretched/Overloaded</div></div>';
  h+='</div>';
  return h}

/* ── Leadership Inventory ── */
function renderOutInventory(){
  var leaders=data.leaders||[];var ln=data.landscapeNotes||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Inventory</h2><p style="color:var(--stone);font-size:13px">Phase 1: Assess \u2014 synthesized from the Leadership Landscape step</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=inventoryStatBand();
  // Leader profiles
  if(!leaders.length){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">No leaders mapped yet. Complete Step 1.2.</p>');return h}
  h+=lyScreenRegister('leader',leaders,'full',LEADER_LAYER_INDEX.landscape); /* 14 Sep 2026 (Paul's ruling): the page shows the engine's record blocks, as the document prints them; one form */
  // Ownership gap and MM assessment
  if(ln.ownershipGap){h+=card('<h3 class="h-sub-lg">Transformation Ownership Gap</h3><p style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ln.ownershipGap)+'</p>','border-left:3px solid #4E7FA6')}
  if(ln.mmAssessment){h+=card('<h3 class="h-sub-lg">Middle Management Assessment</h3><p style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ln.mmAssessment)+'</p>','border-left:3px solid #8B5E3C')}
  return h;
}

/* ── Risk Map ── */
function riskMapBody(){ /* the Risk Map page: the summary band first, then each scored risk as a card with its three scores and its bar; its document is riskMapDoc (15 Sep 2026, Paul's ruling: a document is composed for paper, never the page passed through) */
  var risks=data.risks||[];var h='';
  if(!risks.length||!risks.some(function(r){return r.likelihood>0})){
    return card('<p style="color:var(--stone);text-align:center;padding:32px">No risks scored yet. Complete Step 1.3.</p>');
  }
  var names={'zillow':'Deploying Without Readiness','calstate':'Transformation Without Engagement','aircanada':'AI Without Boundaries','cigna':'Eliminating Human Judgment','stigma':'Cultural Readiness Failure','disruption':'Competitive Disruption','fatigue':'Change Fatigue'};
  var colors=['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F','#6B4C8A','#4E7FA6','#3D5A6E'];
  // Sort by total score descending
  var scored=risks.filter(function(r){return(r.likelihood+r.impact+r.timeHorizon)>0}).sort(function(a,b){return(b.likelihood+b.impact+b.timeHorizon)-(a.likelihood+a.impact+a.timeHorizon)});
  var criticalCount=scored.filter(function(r){return(r.likelihood+r.impact+r.timeHorizon)>10}).length;
  var moderateCount=scored.filter(function(r){var t=r.likelihood+r.impact+r.timeHorizon;return t>5&&t<=10}).length;
  var lowCount=scored.filter(function(r){return(r.likelihood+r.impact+r.timeHorizon)<=5&&(r.likelihood+r.impact+r.timeHorizon)>0}).length;
  var critCol=criticalCount>0?'#9B2D3F':'#1B6B5A';
  h+=card('<div style="display:flex;gap:16px;align-items:center;justify-content:center"><div style="text-align:center;padding:16px 24px;border-right:1px solid rgba(var(--fg-rgb),.06)"><div style="font-family:var(--serif);font-size:56px;font-weight:300;color:'+critCol+'">'+criticalCount+'</div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:'+critCol+';text-transform:uppercase;margin-top:4px">Critical Risks</div><div style="font-size:11px;color:var(--stone);margin-top:2px">score above 10/15</div></div><div style="text-align:center;padding:16px 24px;border-right:1px solid rgba(var(--fg-rgb),.06)"><div style="font-family:var(--serif);font-size:36px;font-weight:300;color:var(--gold)">'+moderateCount+'</div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-top:4px">Moderate</div><div style="font-size:11px;color:var(--stone);margin-top:2px">score 6\u201310</div></div><div style="text-align:center;padding:16px 24px"><div style="font-family:var(--serif);font-size:36px;font-weight:300;color:#1B6B5A">'+lowCount+'</div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:#1B6B5A;text-transform:uppercase;margin-top:4px">Low</div><div style="font-size:11px;color:var(--stone);margin-top:2px">score 1\u20135</div></div></div><div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px;color:var(--stone)">'+scored.length+' of 7 scenarios assessed</div>','border:2px solid '+critCol);
  // Top risks
  h+='<div style="margin-bottom:24px">';
  scored.forEach(function(r,idx){
    var total=r.likelihood+r.impact+r.timeHorizon;var pct=Math.round(total/15*100);
    var col=total>10?'#9B2D3F':total>5?'#4E7FA6':'#1B6B5A';
    var sids=['zillow','calstate','aircanada','cigna','stigma','disruption','fatigue'];
    var cidx=sids.indexOf(r.id);var bCol=colors[cidx>=0?cidx:0];
    h+=card('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4 style="font-size:14px;font-weight:700;margin:0">'+esc(names[r.id]||r.id)+'</h4>'+badge('Score: '+total+'/15',col)+'</div>'
      +'<div style="display:flex;gap:16px;margin-bottom:8px"><div style="font-size:12px;color:var(--stone)">Likelihood: <strong style="color:var(--paper)">'+r.likelihood+'</strong></div><div style="font-size:12px;color:var(--stone)">Impact: <strong style="color:var(--paper)">'+r.impact+'</strong></div><div style="font-size:12px;color:var(--stone)">Timing: <strong style="color:var(--paper)">'+r.timeHorizon+'</strong></div></div>'
      +'<div style="height:8px;background:rgba(var(--fg-rgb),.06);border-radius:4px;margin-bottom:8px"><div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:4px;transition:width .3s"></div></div>'
      +(r.notes?'<div style="font-size:12px;color:var(--stone);line-height:1.5;font-style:italic">'+esc(r.notes)+'</div>':'')
    ,'border-left:3px solid '+bCol+';margin-bottom:8px');
  });
  h+='</div>';
  return h}

/* ── Risk Map ── */
function renderOutRiskMap(){
  var risks=data.risks||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Risk Map</h2><p style="color:var(--stone);font-size:13px">Phase 1: Assess \u2014 synthesized from Leadership Risk Mapping</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=riskMapBody();
  return h;
}

/* ── Leadership Structure ── */

/* ── Leadership Structure ── */
function renderOutStructure(){
  var st=data.structure||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Structure</h2><p style="color:var(--stone);font-size:13px">Phase 2: Build \u2014 synthesized from the Leadership Structure Lab</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var sections=STRUCTURE_SECTIONS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  var completed=sections.filter(function(s){return st[s.id+'_done']}).length;
  // Summary
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #2D5A8E"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#2D5A8E">'+completed+'/5</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Sections Complete</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(st.ownerModel?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+(st.ownerModel?'\u2713':'\u2014')+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Ownership Defined</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(st.boardStructure?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+(st.boardStructure?'\u2713':'\u2014')+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Board Governance</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(st.mmHuman?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+(st.mmHuman?'\u2713':'\u2014')+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">MM Principles</div></div>';
  h+='</div>';
  if(!completed){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">No sections completed yet. Complete Step 2.1.</p>');return h}
  // Section details
  var _ownerModelLabels={cito:'Chief Innovation & Transformation Officer',cao:'Chief AI Officer',ctro:'Chief Transformation Officer',expand_cio:'Expanded CIO role (cultural/strategic mandate)',council:'Cross-functional AI Transformation Council',dual:'Dual ownership (technology + cultural/strategic leader)'};
  var _coordLabels={council:'AI Transformation Council (cross-functional standing body)',epmo:'Enterprise Portfolio Management Office',matrix:'Matrix reporting for embedded AI leads',rotation:'Leadership rotation through AI-intensive projects',network:'Innovation network model'};
  sections.forEach(function(sec){
    if(!st[sec.id+'_done'])return;
    var col=sec.id==='middle'?'#8B5E3C':sec.id==='crossfunc'?'#6B4C8A':'#2D5A8E';
    h+=card('<h3 class="h-sub-lg">'+esc(sec.name)+'</h3>'
      +sec.fields.map(function(f){
        var v=st[f.k]||'';if(f.k==='boardExpertise')v=boardExpertiseSummary()||v;if(!v)return'';
        if(f.k==='boardStructure'){var _bsl={dedicated:'Dedicated AI/Technology committee',expanded:'Expand existing Risk or Strategy committee',standing:'Standing AI agenda item on full board',none:'No formal board oversight (will create)',other:(st.boardStructureOther||'Other')};v=_bsl[v]||v;}
        if(f.k==='ownerModel'&&_ownerModelLabels[v])v=_ownerModelLabels[v];
        else if(f.k==='coordMechanism'&&_coordLabels[v])v=_coordLabels[v];
        return'<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(f.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(v)+'</div></div>';
      }).join('')
    ,'border-left:3px solid '+col);
  });
  return h;
}

/* ── Collaboration Principles ── */

/* ── Collaboration Principles ── */
function renderOutCollab(){
  var cl=data.collabLab||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Collaboration Principles</h2><p style="color:var(--stone);font-size:13px">Phase 2: Build \u2014 synthesized from the AI Collaboration Lab</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var sections=COLLAB_SECTIONS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  var completed=sections.filter(function(s){return cl[s.id+'_done']}).length;
  h+='<div style="text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #2D5A8E;margin-bottom:24px"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#2D5A8E">'+completed+'/5</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Sections Complete</div></div>';
  if(!completed){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">No sections completed yet. Complete Step 2.2.</p>');return h}
  var colors=['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F','#6B4C8A'];
  sections.forEach(function(sec,idx){
    if(!cl[sec.id+'_done'])return;
    h+=card('<h3 class="h-sub-lg">'+esc(sec.name)+'</h3>'
      +sec.fields.map(function(f){
        if(f.rows)return f.rows(cl).filter(function(r){return r.v}).map(function(r){return '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(r.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(r.v)+'</div></div>'}).join(''); /* 16 Sep 2026: a rows field, as the document prints it */
        var v=cl[f.k]||'';if(!v)return'';
        return'<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(f.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(v)+'</div></div>';
      }).join('')
    ,'border-left:3px solid '+colors[idx%colors.length]);
  });
  return h;
}

/* ── Competency Framework Output ── */

/* ── Competency Framework Output ── */
function renderOutCompetency(){
  var cf=data.competencyFramework||{};var leaders=data.leaders||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Competency Framework</h2><p style="color:var(--stone);font-size:13px">Phase 2: Build \u2014 synthesized from the Competency Framework step</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var COMPS=[
    {id:'orchestration',name:'AI Orchestration'},
    {id:'philosophical',name:'Philosophical & Ethical Reasoning'},
    {id:'hybrid',name:'Hybrid Team Leadership'},
    {id:'change',name:'Change & Transformation'},
    {id:'composure',name:'Composure & Adaptive Judgment'},
    {id:'ecosystem',name:'Ecosystem Stewardship'},
    {id:'emotional',name:'Emotional Intelligence'}
  ];
  // Gap priorities — 16 Sep 2026 (Paul's ruling): at the top of the page, above the leaders
  if(leaders.length){
    var gaps=COMPS.map(function(c){
      var vals=leaders.map(function(l){return(cf.scores||{})[l.id+'_'+c.id]||0}).filter(function(v){return v>0});
      return{name:c.name,avg:vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0};
    }).filter(function(g){return g.avg>0}).sort(function(a,b){return a.avg-b.avg});
    if(gaps.length){
      h+=card('<h3 class="h-sub-lg">Development Priorities</h3><p style="font-size:13px;color:var(--stone);margin-bottom:12px">Competencies ranked by gap severity (lowest scores first).</p>'
        +gaps.map(function(g,i){
          var col=g.avg>=4?'#1B6B5A':g.avg>=2.5?'#4E7FA6':'#9B2D3F';
          return'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-family:var(--mono);font-size:12px;color:var(--stone);width:20px;text-align:right">'+(i+1)+'</div><div style="font-size:13px;color:var(--paper);min-width:220px">'+esc(g.name)+'</div><div style="flex:1;height:6px;background:rgba(var(--fg-rgb),.06);border-radius:3px"><div style="height:100%;width:'+g.avg*20+'%;background:'+col+';border-radius:3px"></div></div><div style="font-family:var(--mono);font-size:12px;color:var(--paper);min-width:30px;text-align:right">'+g.avg.toFixed(1)+'</div></div>';
        }).join('')
      ,'border:2px solid #4E7FA6');
    }
  }
  if(leaders.length){
  h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>';
  h+=lyScreenRegister('leader',leaders,(UI.printDepth||'summary'),LEADER_LAYER_INDEX.competency); /* 14 Sep 2026 (Paul's ruling): the engine's record blocks at the chosen depth; the screen-only / print-only heat map retired */
  }
  // Per-competency detail
  COMPS.forEach(function(c){
    var def=(cf.definitions||{})[c.id]||'';
    var vals=leaders.map(function(l){return(cf.scores||{})[l.id+'_'+c.id]||0}).filter(function(v){return v>0});
    var avg=vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0;
    var col=avg>=4?'#1B6B5A':avg>=2.5?'#4E7FA6':'#9B2D3F';
    h+=card('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4 style="font-size:15px;font-weight:700;margin:0">'+esc(c.name)+'</h4>'+(avg?badge('Avg: '+avg.toFixed(1)+'/5',col):'')+'</div>'
      +(def?'<div style="font-size:13px;color:var(--paper);line-height:1.6;margin-bottom:12px;padding:12px;background:rgba(var(--fg-rgb),.03);border-left:2px solid #2D5A8E">'+esc(def)+'</div>':'')
      +(leaders.length?'<div style="display:flex;gap:8px;flex-wrap:wrap">'+leaders.map(function(l,i){
        var v=(cf.scores||{})[l.id+'_'+c.id]||0;
        var lCol=v>=4?'#1B6B5A':v>=3?'#4E7FA6':v>0?'#9B2D3F':'var(--stone)';
        return'<div style="flex:0 0 108px;padding:6px 10px;border:1px solid rgba(var(--fg-rgb),.06);font-size:12px;display:flex;justify-content:space-between;gap:6px;overflow:hidden"><span title="'+esc(l.name||'?')+'" style="color:var(--stone);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc((l.name||'?').split(' ')[0])+'</span><strong style="color:'+lCol+'">'+(v||'\u2014')+'</strong></div>';
      }).join('')+'</div>':'')
    ,'border-left:3px solid #2D5A8E');
  });
  return h;
}

/* ── Fluency Assessment ── */

/* ── Fluency Assessment ── */
function renderOutFluency(){
  var fl=data.fluencySprint||{};var leaders=data.leaders||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Fluency Assessment</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 synthesized from the AI Fluency Sprint</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!fl.project&&!(fl.leaderTasks&&Object.keys(fl.leaderTasks).length)){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 3.1 first.</p>');return h}
  // Summary stats
  var taskCount=0;var leaderCount=0;
  if(fl.leaderTasks){for(var k in fl.leaderTasks){var lt=fl.leaderTasks[k];if(lt){if(lt.task1)taskCount++;if(lt.task2)taskCount++;if(lt.task3)taskCount++;if(lt.task1||lt.task2||lt.task3)leaderCount++}}}
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;margin-bottom:24px;background:rgba(139,94,60,.25)">';
  [{icon:'\u25B7',v:leaderCount,l:'Leaders Active'},{icon:'\u2261',v:taskCount,l:'Tasks Completed'},{icon:'\u25A3',v:fl.project?'Yes':'No',l:'Team Project'}].forEach(function(s){
    h+='<div style="padding:16px;background:var(--ink);text-align:center"><div style="font-size:18px;margin-bottom:4px">'+s.icon+'</div><div style="font-size:18px;font-weight:700;color:#8B5E3C">'+s.v+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">'+s.l+'</div></div>';
  });
  h+='</div>';
  if(fl.leaderTasks&&leaders.length){var withTasks=leaders.filter(function(l){var t=fl.leaderTasks[l.id];return t&&(t.task1||t.task2||t.task3)});
  h+=lyScreenRegister('leaderFluency',withTasks,'full',0); /* 14 Sep 2026 (Paul's ruling): the engine's record blocks; 16 Sep 2026 (Paul's ruling): the fluency layer alone — each leader's three tasks — one form, no depth control */
  }
  // Shared components in a visually distinct section
  var shared=[{k:'project',l:'Team AI Project',icon:'\u25C7',color:'#2D5A8E'},{k:'projectWorkflow',l:'The Workflow',icon:'\u2192',color:'#8B5E3C'},{k:'projectJudgment',l:'Where Human Judgment Was Essential',icon:'\u25CE',color:'#1B6B5A'}];
  var hasShared=shared.some(function(f){return fl[f.k]});
  if(hasShared){
    h+='<div style="font-family:var(--mono);font-size:11px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">Shared Outputs</div>';
    shared.forEach(function(f){
      if(!fl[f.k])return;
      h+='<div style="border-top:3px solid '+f.color+';padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:12px">';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:16px">'+f.icon+'</span><span style="font-size:15px;font-weight:700;color:var(--paper)">'+f.l+'</span></div>';
      h+='<div style="font-size:13px;color:var(--paper);line-height:1.7">'+esc(fl[f.k])+'</div></div>';
    });
  }
  return h;
}

/* ── Decision Analyses ── */

/* ── Decision Analyses ── */
function renderOutDecisions(){
  var ds=data.decisionSims||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Decision Analyses</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 synthesized from Decision Simulations</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var scenarios=DECISION_SCENARIOS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  var colors=['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F'];
  var any=false;
  // Summary: count completed
  var completed=scenarios.filter(function(sc){return ds[sc.id+'_response']||ds[sc.id+'_premortem']}).length;
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  h+='<div style="flex:1;padding:16px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06);text-align:center"><div style="font-size:24px;font-weight:700;color:var(--gold)">'+completed+'/4</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em">Scenarios Completed</div></div>';
  h+='</div>';
  // Scenario cards in 2x2 grid
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  scenarios.forEach(function(sc,idx){
    var resp=ds[sc.id+'_response']||'';var pre=ds[sc.id+'_premortem']||'';
    if(!resp&&!pre)return;any=true;
    var col=colors[idx];
    h+='<div style="border-top:3px solid '+col+';background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
    // Header
    h+='<div style="padding:16px 20px;border-bottom:1px solid rgba(var(--fg-rgb),.04)">';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:18px">'+sc.icon+'</span><span style="font-size:16px;font-weight:700;color:var(--paper)">'+esc(sc.name)+'</span></div>';
    h+='<div style="font-size:12px;color:var(--stone)">'+esc(sc.desc)+'</div></div>';
    // Response
    if(resp){
      h+='<div style="padding:14px 20px;border-bottom:1px solid rgba(var(--fg-rgb),.04)">';
      h+='<div style="font-family:var(--mono);font-size:9px;color:'+col+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Our Response</div>';
      h+='<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(resp)+'</div></div>';
    }
    // Pre-mortem
    if(pre){
      h+='<div style="padding:14px 20px;background:rgba(155,45,63,.03)">';
      h+='<div style="font-family:var(--mono);font-size:9px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Ethical Pre-Mortem</div>';
      h+='<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(pre)+'</div></div>';
    }
    h+='</div>';
  });
  h+='</div>';
  if(!any)h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 3.2 first.</p>');
  return h;
}

/* ── MM Principles Output ── */

/* ── MM Principles Output ── */
function renderOutMMPrinciples(){ /* 16 Sep 2026 (Paul's ruling): laid out to his page plan — the four sections the document prints, in the page's vocabulary */
  var mm=data.mmActivation||{};var st=data.structure||{};var wf=mm.workflows||[],ho=mm.humanOnly||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Middle Management Principles</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 synthesized from Structure Lab + MM Activation</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var anyCat=MM_CATEGORIES.some(function(c){return st[c.k]});
  if(!anyCat&&!wf.length&&!ho.length&&!mm.logTemplate&&!mm.logCadence&&!mm.evalCriteria&&!mm.evalMetrics){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Steps 2.1 and 3.3 first.</p>');return h}
  var cnt=function(k){return ' <span style="font-family:var(--mono);font-size:11px;color:var(--stone);font-weight:400">\u00b7 '+k+'</span>'};
  // 1. The Three Categories — one band; an empty column says so, because the band needs its shape
  if(anyCat)h+=card('<h3 class="h-sub-lg">The Three Categories</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">'+MM_CATEGORIES.map(function(c){return '<div style="border-top:3px solid '+c.col+';padding-top:10px"><div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:'+c.col+';margin-bottom:6px">'+esc(c.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+(st[c.k]?esc(st[c.k]):'<em style="color:var(--stone)">Not recorded</em>')+'</div></div>'}).join('')+'</div>','border:2px solid #8B5E3C');
  // 2. AI-Augmented Workflows — each a pair: AI does / The manager does (the step's expanded boxes, side by side)
  var roleBox=function(label,text,col,rgb){return '<div style="padding:10px 14px;background:rgba('+rgb+',.06);border-left:3px solid '+col+'"><div style="font-family:var(--mono);font-size:9px;color:'+col+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">'+esc(label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+(text?esc(text):'<em style="color:var(--stone)">Not recorded</em>')+'</div></div>'};
  if(wf.length)h+=card('<h3 class="h-sub-lg">AI-Augmented Workflows'+cnt(wf.length)+'</h3>'+wf.map(function(w){return '<div style="padding:12px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><div style="font-size:14px;font-weight:600;color:var(--paper);margin-bottom:8px">'+esc(w.name||'Unnamed workflow')+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+roleBox('AI does',w.aiRole,'#4E7FA6','78,127,166')+roleBox('The manager does',w.humanRole,'#1B6B5A','27,107,90')+'</div></div>'}).join(''),'border-left:3px solid #4E7FA6');
  // 3. Decisions That Stay Human
  if(ho.length)h+=card('<h3 class="h-sub-lg">Decisions That Stay Human'+cnt(ho.length)+'</h3>'+ho.map(function(d){return '<div style="padding:10px 0 10px 12px;margin-bottom:6px;border-left:3px solid #1B6B5A"><div style="font-size:14px;font-weight:600;color:var(--paper)">'+esc(d.decision||'Unnamed decision')+'</div>'+(d.reason?'<div style="font-size:12.5px;color:var(--text-body);margin-top:4px;line-height:1.5">'+esc(d.reason)+'</div>':'')+'</div>'}).join(''),'border-left:3px solid #1B6B5A');
  // 4. The log and the evaluation — two panels side by side
  var panel=function(title,rows){rows=rows.filter(function(r){return r[1]});if(!rows.length)return '';return card('<h3 class="h-sub-lg" style="font-size:14px">'+esc(title)+'</h3>'+rows.map(function(r){return '<div style="margin-bottom:10px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(r[0])+'</div><div style="font-size:'+(r[2]?'12px;font-family:var(--mono)':'13px')+';color:var(--paper);line-height:1.6">'+esc(r[1])+'</div></div>'}).join(''),'border-left:3px solid #8B5E3C;margin:0')};
  var p1=panel('The AI Use Log',[['Template',mm.logTemplate,true],['Review cadence',mm.logCadence]]),p2=panel('Evaluating Managers',[['Criteria',mm.evalCriteria],['Success metrics',mm.evalMetrics]]);
  if(p1||p2)h+='<div style="display:grid;grid-template-columns:'+(p1&&p2?'1fr 1fr':'1fr')+';gap:12px;margin-bottom:16px">'+p1+p2+'</div>';
  return h;
}

/* ── Operating Rhythm Output ── */
/* ── Values Architecture Output ── */

/* ── Operating Rhythm Output ── */
/* ── Values Architecture Output ── */
function renderOutValues(){ /* 16 Sep 2026 (Paul's ruling): laid out to his page plan — the five sections the document prints, and at Full depth the appendix of reflections */
  var ov=data.orgValues||[];var vd=data.valuesDiscussion||{};var depth=(UI.printDepth||'summary');
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Values Architecture</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 shared organizational principles from the collective Values Architecture exercise</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!ov.length&&!vd.collectiveCommitments){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 3.4 first.</p>');return h}
  var fig=valuesFigures(),ord=valuesOrdered(),refl=valuesReflectors(),roles=valuesRoleList();
  var lab=function(t){return '<div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(t)+'</div>'};
  var cnt=function(k){return ' <span style="font-family:var(--mono);font-size:11px;color:var(--stone);font-weight:400">\u00b7 '+k+'</span>'};
  h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>';
  // 1. Our Philosophical Commitments — the statement leads
  if(vd.collectiveCommitments)h+=card('<h3 class="h-sub-lg">Our Philosophical Commitments</h3><div style="font-family:var(--serif,Georgia,serif);font-size:17px;line-height:1.55;color:var(--paper);white-space:pre-line">'+esc(vd.collectiveCommitments)+'</div>','border:2px solid #6B4C8A');
  // 2. Shared Principles — by domain, numbered continuously
  if(ov.length){var pi='<h3 class="h-sub-lg">Shared Principles'+cnt(ov.length)+'</h3>';VALUES_DOMAINS.forEach(function(d){var list=ord.filter(function(o){return o.d===d.id});if(!list.length)return;var col=DOMAIN_COL[d.id]||'#888';pi+='<div style="margin:12px 0 4px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:'+col+'">'+esc(d.l)+'</span><span style="font-size:11.5px;color:var(--stone);margin-left:10px">'+esc(VALUES_DOMAIN_GLOSS[d.id]||'')+'</span></div>'+list.map(function(o){return '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><span style="font-family:var(--mono);font-size:12px;color:'+col+';flex-shrink:0;width:22px">'+o.n+'</span><span style="font-size:14px;color:var(--paper);line-height:1.5">'+esc(o.v.principle)+'</span></div>'}).join('')});h+=card(pi,'border-left:3px solid #6B4C8A')}
  // 3. The Roles That Carry Each Principle — three figures, then one row per principle
  if(ov.length){var figBox=function(v,l,col){return '<div style="text-align:center;padding:12px 8px;border:1px solid rgba(var(--fg-rgb),.08);border-top:3px solid '+col+'"><div style="font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:300;color:'+col+'">'+esc(String(v))+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">'+esc(l)+'</div></div>'};
    var rows=ord.map(function(o){var rs=roles.filter(function(r){return (r.taggedValues||[]).indexOf(o.v.id)>=0});return '<div style="display:grid;grid-template-columns:2fr 3fr;gap:12px;padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><div style="font-size:13.5px;color:var(--paper);line-height:1.5"><span style="font-family:var(--mono);font-size:11px;color:var(--stone);margin-right:6px">'+o.n+'</span>'+esc(o.v.principle)+'</div><div style="font-size:13px;line-height:1.6;color:var(--paper)">'+(rs.length?rs.map(function(r){var who=valuesRoleWho(r);return esc(r.id==='board'?'Board':(r.name||'Unnamed role'))+(who?' <span style="color:var(--stone)">\u00b7 '+esc(who)+'</span>':'')}).join('<br>'):'<em style="color:#9B2D3F">Not yet tagged to any role</em>')+'</div></div>'}).join('');
    h+=card('<h3 class="h-sub-lg">The Roles That Carry Each Principle</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0 16px">'+figBox(fig.principles,'Principles','#6B4C8A')+figBox(fig.carrying+' / '+fig.roles,'Roles carrying values','#2D5A8E')+figBox(fig.unplaced,'Not yet placed',fig.unplaced?'#9B2D3F':'#1B6B5A')+'</div>'+rows,'border-left:3px solid #2D5A8E')}
  // 4. Keeping the Principles Alive — the embedding, then the AI Purpose Filter with the purpose it tests against (the filter lives on 3.4; ruled 16 July)
  var flt=(data.fluencySprint||{}).filter,mission=((data.assessments||{}).purpose||{}).mission;
  if(vd.embedding||flt||mission){var al='<h3 class="h-sub-lg">Keeping the Principles Alive</h3>';if(vd.embedding)al+='<div style="margin-bottom:14px">'+lab('In daily practice')+'<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(vd.embedding)+'</div></div>';if(flt||mission){al+='<div style="font-family:var(--mono);font-size:10px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin:4px 0 8px">\u25A4 AI Purpose Filter</div>';if(mission)al+='<div style="margin-bottom:10px">'+lab('Our purpose')+'<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(mission)+'</div></div>';if(flt)al+='<div>'+lab('Before adopting an AI tool, we ask')+'<div style="font-size:14px;color:var(--paper);line-height:1.7;white-space:pre-wrap">'+esc(flt)+'</div></div>'}h+=card(al,'border-left:3px solid #8B5E3C')}
  // 5. Where the Team Diverged
  if(vd.divergences)h+=card('<h3 class="h-sub-lg">Where the Team Diverged</h3><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(vd.divergences)+'</div>','border-left:3px solid #9B2D3F');
  // Appendix at Full depth — each leader's Step 2.4 reflections
  if(depth==='full'){h+='<div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--stone);margin:24px 0 6px">Appendix</div><h3 class="h-sub-lg">The Reflections Behind the Principles</h3>';if(refl.length)refl.forEach(function(l){var m=(data.mindsetDepth||{})[l.id]||{};h+=card('<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px"><span style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(l.name)+'</span><span style="font-family:var(--mono);font-size:11px;color:var(--stone)">'+esc(leaderRoleName(l))+'</span></div>'+MINDSET_REFLECTION_LABELS.map(function(q){return m[q[0]]?'<div style="margin-bottom:10px">'+lab(q[1])+'<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(m[q[0]])+'</div></div>':''}).join(''),'border-left:3px solid #6B4C8A')});else h+=card('<p style="color:var(--stone);font-style:italic">No individual reflections recorded in Step 2.4.</p>')}
  return h;
}

/* ── Operating Rhythm Output ── */

/* ── Operating Rhythm Output ── */
function renderOutRhythm(){
  var or=data.opRhythm||{};var rh=data.rhythm||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Operating Rhythm</h2><p style="color:var(--stone);font-size:13px">Phase 4: Embed \u2014 the permanent operating cadence for AI-ready leadership</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!or.agenda&&!or.peerStructure){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 4.1 first.</p>');return h}
  // Cadence summary
  var cadLabels={weekly:'Weekly',fortnightly:'Fortnightly',monthly:'Monthly'};
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;margin-bottom:24px;background:rgba(155,45,63,.25)">';
  [{icon:'\u25C7',l:'Simulations',v:or.simFreq||'Not set'},{icon:'\u2261',l:'Peer Learning',v:or.peerStructure?'Active':'Not set'},{icon:'\u25A3',l:'Board Ed',v:or.boardEd?'Planned':'Not set'}].forEach(function(s){
    h+='<div style="padding:16px;background:var(--ink);text-align:center"><div style="font-size:18px;margin-bottom:4px">'+s.icon+'</div><div style="font-size:16px;font-weight:700;color:#9B2D3F">'+esc(s.v)+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">'+s.l+'</div></div>';
  });
  h+='</div>';
  // Grouped sections
  var groups=RHYTHM_GROUPS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  groups.forEach(function(g){
    var hasContent=g.items.some(function(i){return or[i.k]});if(!hasContent)return;
    h+='<div style="border-top:3px solid '+g.color+';padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
    h+='<div style="font-size:15px;font-weight:700;color:var(--paper);margin-bottom:12px">'+g.title+'</div>';
    g.items.forEach(function(i){
      if(!or[i.k])return;
      h+='<div style="margin-bottom:10px"><div style="font-family:var(--mono);font-size:9px;color:'+g.color+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">'+esc(i.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(or[i.k])+'</div></div>';
    });
    h+='</div>';
  });
  h+='</div>';
  return h;
}

/* ── Evaluation Plan Output ── */

/* ── Evaluation Plan Output ── */
function renderOutEvalPlan(){
  var ev=data.evalSuccession||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Evaluation Plan</h2><p style="color:var(--stone);font-size:13px">Phase 4: Embed \u2014 rewired evaluation and succession for the AI era</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!ev.indicators&&!ev.bench){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 4.2 first.</p>');return h}
  // Two-column layout: Evaluation | Succession
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">';
  // Evaluation column
  h+='<div style="border-top:3px solid #9B2D3F;padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
  h+='<div style="font-size:16px;font-weight:700;color:var(--paper);margin-bottom:16px">Evaluation Criteria</div>';
  if(ev.indicators){h+='<div style="margin-bottom:14px"><div style="font-family:var(--mono);font-size:9px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">AI-Readiness Indicators</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.indicators)+'</div></div>'}
  if(ev.proportion){h+='<div><div style="font-family:var(--mono);font-size:9px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Evaluation Weighting</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.proportion)+'</div></div>'}
  h+='</div>';
  // Succession column
  h+='<div style="border-top:3px solid #6B4C8A;padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
  h+='<div style="font-size:16px;font-weight:700;color:var(--paper);margin-bottom:16px">Succession Planning</div>';
  if(ev.bench){h+='<div style="margin-bottom:14px"><div style="font-family:var(--mono);font-size:9px;color:#6B4C8A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Bench Assessment</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.bench)+'</div></div>'}
  if(ev.benchChanges){h+='<div><div style="font-family:var(--mono);font-size:9px;color:#6B4C8A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Changes Needed</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.benchChanges)+'</div></div>'}
  h+='</div></div>';
  // Board fluency (full width)
  if(ev.boardFluency){
    h+=card('<div style="display:flex;align-items:flex-start;gap:12px"><div style="font-size:24px;flex-shrink:0">\u25A3</div><div><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Board Fluency Requirements</div><div style="font-size:14px;color:var(--paper);line-height:1.7">'+esc(ev.boardFluency)+'</div></div></div>','border:2px solid var(--gold)');
  }
  return h;
}

/* ── Review Report Output ── */

/* ── Review Report Output ── */
function renderOutReview(){
  var rv=data.leadershipReview||{};var leaders=data.leaders||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Review Report</h2><p style="color:var(--stone);font-size:13px">Phase 4: Embed \u2014 first review of leadership progress and readiness</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!rv.leaders&&!rv.structWorking){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 4.3 first.</p>');return h}
  // Summary stats
  var counts={developed:0,progressing:0,support:0,hard:0};
  if(rv.leaders&&leaders.length){leaders.forEach(function(l){var a=(rv.leaders[l.id]||{}).assessment||'';if(counts[a]!==undefined)counts[a]++})}
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  [{l:'Developed',k:'developed',c:'#1B6B5A'},{l:'Progressing',k:'progressing',c:'#2D5A8E'},{l:'Needs Support',k:'support',c:'#4E7FA6'},{l:'Hard Conversation',k:'hard',c:'#9B2D3F'}].forEach(function(s){
    h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+s.c+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:'+s.c+'">'+counts[s.k]+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">'+s.l+'</div></div>';
  });
  h+='</div>';
  if(rv.leaders&&leaders.length){var assessed=leaders.filter(function(l){var r=rv.leaders[l.id];return r&&(r.assessment||r.notes)});
  h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>';
  var groups=Object.keys(REVIEW_LABELS).map(function(k){return {name:REVIEW_LABELS[k],list:assessed.filter(function(l){return (rv.leaders[l.id]||{}).assessment===k})}});var rest=assessed.filter(function(l){return !REVIEW_LABELS[(rv.leaders[l.id]||{}).assessment]});if(rest.length)groups.push({name:'Not yet assessed',list:rest});
  h+=lyScreenRegister('leader',assessed,(UI.printDepth||'summary'),LEADER_LAYER_INDEX.review,groups); /* 14 Sep 2026 (Paul's ruling): the engine's record blocks at the chosen depth, grouped by assessment */
  }
  // Structural review
  if(rv.structWorking||rv.structRevision){
    h+=card('<h3 class="h-sub-lg">Structural Review</h3>'
      +(rv.structWorking?'<div style="margin-bottom:12px"><div style="font-size:11px;color:#1B6B5A;font-weight:600;text-transform:uppercase;margin-bottom:4px">Working Well</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(rv.structWorking)+'</div></div>':'')
      +(rv.structRevision?'<div><div style="font-size:11px;color:#9B2D3F;font-weight:600;text-transform:uppercase;margin-bottom:4px">Needs Revision</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(rv.structRevision)+'</div></div>':'')
    ,'border:2px solid #9B2D3F');
  }
  return h;
}


/* ═══ PHASE HOME PAGES ═══ */
var PHASE_NARRATIVES = {
  1: 'Map your starting position. Score your leadership team\'s readiness, profile every senior leader, confront the risk scenarios, and begin the individual mindset shift.',
  2: 'Build the architecture. Design your leadership structure, establish collaboration principles, define the competency framework, and deepen philosophical grounding.',
  3: 'Develop the capabilities. Every leader gets hands-on with AI, decisions are stress-tested through simulations, middle management is activated, and mindset learning is applied.',
  4: 'Lock it in. Embed the operating rhythm, rewire evaluation and succession, conduct the first leadership review, and establish composure practices.'
};

var PHASE_COMPLETE_MSG = {
  1: 'Baseline established. You have a scored picture of your leadership team\'s readiness, a full landscape inventory, risk scenarios confronted, and individual mindset foundations laid. Time to build the architecture.',
  2: 'Architecture designed. Transformation ownership defined, collaboration principles established, competency framework in place, and philosophical depth engaged. Time to develop the capabilities.',
  3: 'Capabilities developed. Every leader is using AI tools, decisions have been stress-tested, middle management is activated, and mindset learning is being applied. Time to embed it.',
  4: 'Embedded. Operating rhythm locked in, evaluation criteria updated, first review complete, composure practices established. Your leadership architecture is operational.'
};

/* Shared-step tick row for the phase Progress card (exemplar STEP_FLOW form).
   Individual-track steps never appear here \u2014 they are per-leader (ruled 16 July). */
var STEP_FLOW = {
  1: [{ id: '1.1', icon: '\u25A3', sh: 'Assess' }, { id: '1.2', icon: '\u25C7', sh: 'Landscape' }, { id: '1.3', icon: '\u25CE', sh: 'Risks' }],
  2: [{ id: '2.1', icon: '\u229E', sh: 'Structure' }, { id: '2.2', icon: '\u229C', sh: 'Collaboration' }, { id: '2.3', icon: '\u21BB', sh: 'Competency' }],
  3: [{ id: '3.1', icon: '\u25B7', sh: 'Fluency' }, { id: '3.2', icon: '\u229F', sh: 'Simulations' }, { id: '3.3', icon: '\u2297', sh: 'Middle Mgmt' }, { id: '3.4', icon: '\u2299', sh: 'Values' }],
  4: [{ id: '4.1', icon: '\u25A4', sh: 'Rhythm' }, { id: '4.2', icon: '\u25FB', sh: 'Evaluation' }, { id: '4.3', icon: '\u25B3', sh: 'Review' }]
};
var PHASE_DONE_LINE = {
  1: 'You\u2019ve mapped your leadership baseline and confronted your risks.',
  2: 'Your leadership architecture is designed and documented.',
  3: 'Your leaders are building real capability with AI in hand.',
  4: 'The architecture is embedded in how you operate.'
};
function renderPhaseHome(phaseId) {
  var ph = PH.find(function (p) { return p.id === phaseId });
  if (!ph) return renderOverview();
  var steps = ph.steps.filter(function (s) { return !INDIVIDUAL_TRACK_STEPS[s.id]; });
  var done = steps.filter(function (s) { return isStepDone(s.id) }).length;
  var total = steps.length; var pct = total ? Math.round(done / total * 100) : 0;
  var flow = STEP_FLOW[phaseId] || [];
  var leaders = data.leaders || [];
  var cf = data.competencyFramework || {};
  // Phase metrics \u2014 four per phase (ruled 16 July, superseding the same-day three-ruling; the donor's own row is four), org-level only; shared surfaces never read per-user stores
  var metrics;
  if (phaseId === 1) {
    var secsDone = Object.keys(data.completedSections || {}).filter(function (k) { return (data.completedSections || {})[k] }).length;
    metrics = [
      { label: 'Assessment Sections Done', value: secsDone + '/5', icon: '\u25A3', nav: '1.1' },
      { label: 'Leaders Mapped', value: leaders.length, icon: '\u25C7', nav: '1.2' },
      { label: 'Risks Scored', value: (data.risks || []).filter(function (r) { return r.likelihood > 0 }).length + '/7', icon: '\u25CE', nav: '1.3' },
      { label: 'Readiness Score', value: (function () { var _rc = [{ k: 'purpose', f: ['clarity', 'aiAlignment', 'coherence'] }, { k: 'fluency', f: ['foundational', 'failureModes', 'costRisk', 'strategic', 'handsOn'] }, { k: 'change', f: ['trackRecord', 'fatigue', 'middleMgmt', 'psySafety', 'learningCulture'] }, { k: 'structure', f: ['crossCollab', 'mmRole'] }, { k: 'ethical', f: ['identity', 'evidence', 'commitments', 'assumptions'] }]; var _ra = data.assessments || {}; var _rs = []; _rc.forEach(function (c) { var sub = _ra[c.k] || {}; var v = c.f.map(function (f) { return typeof sub[f] === 'number' ? sub[f] : 0 }).filter(function (x) { return x > 0 }); if (v.length) _rs.push(v.reduce(function (x, y) { return x + y }, 0) / v.length) }); return _rs.length ? (_rs.reduce(function (x, y) { return x + y }, 0) / _rs.length).toFixed(1) + '/5' : '\u2014' })(), icon: '\u25C9', nav: 'out-readiness' }
    ];
  } else if (phaseId === 2) {
    var rolesCount = (data.orgChart || []).length;
    var collabDone = (data.collabLab || {}).models_done ? 'Yes' : 'No';
    var compScored = cf.scores ? Object.keys(cf.scores).length : 0;
    metrics = [
      { label: 'Roles Defined', value: rolesCount, icon: '\u229E', nav: '2.1' },
      { label: 'Collab Model', value: collabDone, icon: '\u229C', nav: '2.2' },
      { label: 'Scores Entered', value: compScored, icon: '\u21BB', nav: '2.3' },
      { label: 'Steps Complete', value: done + '/' + total, icon: '\u2713', nav: '2.1' }
    ];
  } else if (phaseId === 3) {
    var fluencyTasks = 0; if (data.fluencySprint && data.fluencySprint.leaderTasks) { for (var k in data.fluencySprint.leaderTasks) { var lt = data.fluencySprint.leaderTasks[k]; if (lt) { if (lt.task1) fluencyTasks++; if (lt.task2) fluencyTasks++; if (lt.task3) fluencyTasks++; } } }
    var _dsObj = data.decisionSims || {}; var decisions = ['autonomous', 'workforce', 'competitor', 'ethical'].filter(function (id) { return _dsObj[id + '_response'] || _dsObj[id + '_premortem'] }).length;
    var workflows = (data.mmActivation && data.mmActivation.workflows) ? data.mmActivation.workflows.length : 0;
    metrics = [
      { label: 'AI Tasks Done', value: fluencyTasks, icon: '\u25B7', nav: '3.1' },
      { label: 'Decisions Tested', value: decisions, icon: '\u229F', nav: '3.2' },
      { label: 'MM Workflows', value: workflows, icon: '\u2297', nav: '3.3' },
      { label: 'Steps Complete', value: done + '/' + total, icon: '\u2713', nav: '3.1' }
    ];
  } else {
    var rhythmSet = isStepDone('4.1') ? 'Yes' : 'No';
    var evalSet = isStepDone('4.2') ? 'Yes' : 'No';
    var reviewDone = (data.completedSteps || {})['4.3'] ? 'Yes' : 'No';
    metrics = [
      { label: 'Rhythm Set', value: rhythmSet, icon: '\u25A4', nav: '4.1' },
      { label: 'Eval Rewired', value: evalSet, icon: '\u25FB', nav: '4.2' },
      { label: 'Review Done', value: reviewDone, icon: '\u25B3', nav: '4.3' },
      { label: 'Steps Complete', value: done + '/' + total, icon: '\u2713', nav: '4.1' }
    ];
  }
  var h = '<div class="content-area"><div class="content-inner">';
  h += backBtn();
  // Phase overview video (drop the matching .mp4 beside index.html)
  var PHASE_VIDEOS = { 1: { src: '../../../assets/media/exec-readiness/exec-phase1.mp4', label: 'Phase One \u00b7 Assess' }, 2: { src: '../../../assets/media/exec-readiness/exec-phase2.mp4', label: 'Phase Two \u00b7 Build' }, 3: { src: '../../../assets/media/exec-readiness/exec-phase3.mp4', label: 'Phase Three \u00b7 Develop' }, 4: { src: '../../../assets/media/exec-readiness/exec-phase4.mp4', label: 'Phase Four \u00b7 Embed' } };
  var _pv = PHASE_VIDEOS[phaseId];
  if (_pv) {
    h += '<div class="overview-video-card mb-6"><div class="overview-video-label" style="color:' + ph.color + '">' + _pv.label + '</div>'
      + '<video class="overview-video" controls preload="auto" playsinline><source src="' + _pv.src + '" type="video/mp4">Your browser does not support embedded video.</video></div>';
  }
  h += vizTimeline(phaseId);
  h += '<div class="u-96f7104"><div style="width:64px;height:64px;border-radius:32px;background:' + ph.color + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;flex-shrink:0">' + phaseId + '</div><div><div class="flx-center gap-2"><h1 class="u-09ee37b">' + ph.name + '</h1>' + badge(ph.days, ph.color) + '</div><p class="u-ccba76a">' + esc(PHASE_NARRATIVES[phaseId] || '') + '</p></div></div>';
  // Metrics
  h += '<div class="u-f78be26">';
  metrics.forEach(function (m) { h += card('<div class="t-center" data-clickable="1" onclick="go(\'' + m.nav + '\')" title="Open Step ' + m.nav + '" ><div class="u-e5e6f83">' + m.icon + '</div><div class="ph-score" style="--c:' + ph.color + '">' + m.value + '</div><div class="u-5964388">' + m.label + '</div></div>', 'padding:16px;border-top:3px solid ' + ph.color) });
  h += '</div>';
  // Progress
  h += card('<div class="flx-row-mb-12"><h3 class="u-3526083">Progress</h3>' + badge(done + '/' + total + ' steps \u00b7 ' + pct + '%', pct === 100 ? '#1B6B5A' : ph.color) + '</div><div class="u-bc01850"><div class="pct-fill" data-full="' + (pct === 100 ? 1 : 0) + '" style="--w:' + pct + '%;--c:' + ph.color + '"></div></div><div class="u-6f946a0">' + flow.map(function (s, i) { var d = isStepDone(s.id); var r = '<div onclick="go(\'' + s.id + '\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:8px 12px;border-radius:8px;background:' + (d ? 'rgba(27,107,90,.06)' : 'transparent') + ';min-width:70px"><div style="width:36px;height:36px;border-radius:18px;background:' + (d ? '#1B6B5A' : ph.color + '20') + ';color:' + (d ? '#fff' : ph.color) + ';display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid ' + (d ? '#1B6B5A' : ph.color) + '">' + (d ? '\u2713' : s.icon) + '</div><div class="flow-label" data-done="' + (d ? 1 : 0) + '">' + s.sh + '</div></div>'; if (i < flow.length - 1) r += '<div class="flow-conn" data-done="' + (d && isStepDone(flow[i + 1].id) ? 1 : 0) + '"></div>'; return r }).join('') + '</div>', 'margin-bottom:24px');
  // Phase-complete wrap-up: persistent home on the landing once every shared step is done
  if (pct === 100 && PHASE_COMPLETE_MSG[phaseId]) {
    h += '<div class="milestone-card">';
    h += '<div class="milestone-label">\u2713 Phase ' + phaseId + ' Complete</div>';
    h += '<div class="milestone-text">' + PHASE_COMPLETE_MSG[phaseId] + '</div>';
    h += '</div>';
  }
  // Steps + Outcomes grid
  h += '<div class="gr-2-mb"><div><div class="label-tiny">Steps</div>';
  steps.forEach(function (s) { var d = isStepDone(s.id); h += '<div onclick="go(\'' + s.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid ' + (d ? '#1B6B5A' : ph.color) + '"><div style="width:20px;height:20px;border-radius:10px;background:' + (d ? '#1B6B5A' : ph.color + '20') + ';color:' + (d ? '#fff' : ph.color) + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">' + (d ? '\u2713' : s.id.split('.')[1]) + '</div><span style="font-size:13px;font-weight:600;color:' + (d ? '#1B6B5A' : 'var(--paper)') + ';flex:1">' + s.id + ' ' + s.name + '</span>' + (d ? '<span class="u-5ca1883">\u2713</span>' : '') + '</div>' });
  h += '</div><div><div class="label-tiny">Outcomes</div>';
  (ph.outcomes || []).forEach(function (o) { h += '<div onclick="go(\'' + o.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid ' + ph.color + '"><span class="u-3dd9b4c">' + (o.icon || '\u25A1') + '</span><span class="u-884cbc8">' + o.name + '</span><span class="u-38575ff">\u2192</span></div>' });
  h += '</div></div>';
  // Completion
  if (pct === 100) { var msg = PHASE_DONE_LINE[phaseId] || ''; var next = phaseId < 4 ? 'phase-' + (phaseId + 1) : 'phase5'; var nextLabel = phaseId < 4 ? 'Continue to Phase ' + (phaseId + 1) + ': ' + PH[phaseId].name + ' \u2192' : 'Go to Leadership Dashboard \u2192'; h += card('<div class="t-center"><div class="u-e0bd553">\u2605</div><h3 class="h-sub">Phase ' + phaseId + ' Complete</h3><p class="u-bbfc088">' + esc(msg) + '</p>' + btn(nextLabel, 'go(\'' + next + '\')', 'bp', 'margin-top:12px') + '</div>', 'background:rgba(27,107,90,.06);border:2px solid #1B6B5A') }
  h += '</div></div>'; return h;
}

/* ═══ DASHBOARD (Phase 5: Lead) — with inline org chart ═══ */
var DOMAIN_COL = { ontological: '#6B4C8A', epistemological: '#2D5A8E', ethical: '#9B2D3F' };
function exportState() {
  try {
    var org = (getOrg(currentOrgId) || {}).name || 'workspace';
    var payload = { app: 'nextchapter-exec-readiness', type: 'exec-readiness-state', schema: SK, org: org, exportedAt: new Date().toISOString(), data: data };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url;
    a.download = 'exec-readiness-state-' + (org.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'workspace') + '-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  } catch (e) { alert('Export failed: ' + ((e && e.message) || e)); }
}
function importState() {
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = function () {
    var f = inp.files && inp.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { applyImportedState(String(r.result)); };
    r.onerror = function () { alert('Could not read that file.'); };
    r.readAsText(f);
  };
  inp.click();
}
function applyImportedState(text) {
  var parsed;
  try { parsed = JSON.parse(text); } catch (e) { alert('That file cannot be read.'); return; }
  var d = (parsed && typeof parsed === 'object' && parsed.data) ? parsed.data : parsed;
  if (!d || typeof d !== 'object' || (d.completedSteps === undefined && d.assessments === undefined && d.leaders === undefined)) { alert('That does not look like an Executive Readiness state file.'); return; }
  if (parsed && parsed.schema && parsed.schema !== SK) { if (!confirm('This file was exported from a different version of the module (' + parsed.schema + '). Import anyway?')) return; }
  if (!currentOrgId) { alert('Open a workspace before importing a state.'); return; }
  if (!confirm('Import this state? It replaces the data in the current workspace. Export first if you want to keep it.')) return;
  try {
    Store.writeOrg(currentOrgId, d);
    loadData(); applyTeamRoster();
    Auth.setSession((USERS[0] && USERS[0].id) || currentUserId);
    render();
  } catch (e) { alert('Import failed: ' + ((e && e.message) || e)); }
}
function seedData(){
  if(!confirm('Load sample data? This overwrites any existing entries.')) return;

  // --- Team roster: a single facilitator ("a", admin + the signed-in user) plus one
  //     login per leader. The leader user-ids below (u6-u15) match the userId set on
  //     each seeded leader and the keys in data.practiceLog, so the individual-track
  //     views (study completion, practice health) resolve to real, named people rather
  //     than "(no login)". Nobody here has a password (Part 5): an administrator sets each one a temporary password. This roster is authoritative: loading
  //     the sample data replaces any team members currently in Profile & Team.
  data.roster=[
    {id:'u_fac',name:'a',username:'a',role:'Facilitator',initials:'A',color:'#4E7FA6',scope:'All',admin:true},
    {id:'u6', name:'Harriet Rivers',     username:'harriet', role:'Participant',initials:'HR', color:'#1B6B5A',scope:'Executive'},
    {id:'u7', name:'Vincent Lau',    username:'vincent',role:'Participant',initials:'VL', color:'#2D5A8E',scope:'Operations'},
    {id:'u8', name:'Shalini Mehta',    username:'shalini', role:'Participant',initials:'SM', color:'#8B5E3C',scope:'AI & Innovation'},
    {id:'u9', name:'Ray Caruso',username:'ray',role:'Participant',initials:'RC',color:'#9B2D3F',scope:'Finance'},
    {id:'u10',name:'Imogen Whitfield',      username:'imogen',  role:'Participant',initials:'IW', color:'#6B4C8A',scope:'Marketing'},
    {id:'u11',name:'Sinead Corrigan',  username:'sinead', role:'Participant',initials:'SC', color:'#4E7FA6',scope:'Innovation & Transformation'},
    {id:'u12',name:'Duncan Fairley',  username:'duncan',role:'Participant',initials:'DF', color:'#1B6B5A',scope:'People'},
    {id:'u13',name:'Freya Lindqvist',     username:'freya', role:'Participant',initials:'FL', color:'#2D5A8E',scope:'Engineering'},
    {id:'u14',name:'Arvind Nair',username:'arvind',role:'Participant',initials:'AN',color:'#8B5E3C',scope:'Sales'},
    {id:'u15',name:'Tamsin Doyle', username:'tamsin',role:'Participant',initials:'TD', color:'#9B2D3F',scope:'Data & Analytics'}
  ];
  data.members=[];  // legacy slot; the roster above is canonical

  /* Demo organization: Aurora Windows -- a ~900-person manufacturer of windows, glass,
     and glazing systems, early in its AI journey. Leadership scores and self-assessments
     are deliberately modest at baseline; the Phase-4 review records honest progress, so
     every report, chart, and the Lead dashboard render fully populated and show movement
     from a standing start to a working leadership system. The org chart is built
     from these leaders and their reporting lines, the same path real data uses. */

  // --- Company profile ---
  data.enterprise={
    name:'Aurora Windows',
    industry:'Manufacturing -- windows, glass, and glazing systems',
    size:'201\u20131,000',
    region:'United States (Midwest), with a fabrication plant in Ontario',
    website:'aurorawindows.example',
    maturity:'Piloting',
    sponsor:'Chief Executive Officer',
    objective:'Build the leadership mindset, structure, and discipline to lead AI well -- starting with quoting, demand forecasting, and customer support -- without outrunning our people or our judgment.'
  };

  // --- Leaders (Step 1.2) with stable ids + reporting lines for the Phase 1 chart ---
  data.leaders=[
    {id:'seed_ceo',name:'Harriet Rivers',role:'Chief Executive Officer',fluency:'4',engagement:'active',scope:'org',changeExp:'Led the post-merger integration and the move to a single ERP.',bandwidth:'stretched',userId:'u6',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_coo',name:'Vincent Lau',role:'Chief Operating Officer',fluency:'3',engagement:'active',scope:'org',changeExp:'Ran the plant-floor automation program; comfortable with operational change, newer to AI.',bandwidth:'manageable',userId:'u7',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_caio',name:'Dr. Shalini Mehta',role:'Chief AI & Innovation Officer',fluency:'5',engagement:'active',scope:'org',changeExp:'Built an analytics function from scratch at a prior firm; recruited specifically for this transition.',bandwidth:'available',userId:'u8',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cfo',name:'Ray Caruso',role:'Chief Financial Officer',fluency:'2',engagement:'developing',scope:'dept',changeExp:'Led the finance-systems consolidation; skeptical of AI hype, persuadable by evidence.',bandwidth:'stretched',userId:'u9',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cmo',name:'Imogen Whitfield',role:'Chief Marketing Officer',fluency:'3',engagement:'developing',scope:'dept',changeExp:'Drove the rebrand and the shift to digital demand generation.',bandwidth:'manageable',userId:'u10',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cpo',name:'Duncan Fairley',role:'Chief People Officer',fluency:'2',engagement:'developing',scope:'org',changeExp:'Led the engagement-and-retention turnaround after the merger; now owns the workforce-impact plan for AI.',bandwidth:'manageable',userId:'u12',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cito',name:'Sinead Corrigan',role:'Chief Innovation & Transformation Officer',fluency:'4',engagement:'active',scope:'org',changeExp:'Recruited to own the cultural and strategic side of the AI transition; previously led a digital-transformation program in building products.',bandwidth:'manageable',userId:'u11',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpeng',name:'Freya Lindqvist',role:'VP Engineering',fluency:'3',engagement:'developing',scope:'dept',changeExp:'Led the platform re-architecture; strong technically, early in AI-specific leadership.',bandwidth:'stretched',userId:'u13',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpsales',name:'Arvind Nair',role:'VP Sales',fluency:'2',engagement:'developing',scope:'dept',changeExp:'Built the national accounts team; cautious about AI in customer-facing work.',bandwidth:'stretched',userId:'u14',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpdata',name:'Tamsin Doyle',role:'VP Data & Analytics',fluency:'4',engagement:'active',scope:'dept',changeExp:'Stood up the data warehouse and BI practice; the most fluent of the senior layer.',bandwidth:'manageable',userId:'u15',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpops',name:'Glen Hodges',role:'VP Operations',fluency:'2',engagement:'developing',scope:'dept',changeExp:'Runs the Ontario fabrication plant; pragmatic, not yet engaged with the module.',bandwidth:'stretched'},
    {id:'seed_vphr',name:'Lorna Whitaker',role:'VP Human Resources',fluency:'2',engagement:'developing',scope:'org',changeExp:'Led the people plan for the plant consolidation; owns workforce policy and sits on the AI Transformation Council.',bandwidth:'stretched'},
    {id:'seed_dirpx',name:'Beatriz Camargo',role:'Director, Product Experience',fluency:'3',engagement:'developing',scope:'team',changeExp:'Owns the customer experience for the quoting product; recently promoted.',bandwidth:'manageable'}
  ];
  data._leaderSeq=12;

  // --- Step 1.1: Assessment Battery (sections A-E) ---
  data.assessments={
    purpose:{
      mission:'Be the supplier architects and builders trust for windows that perform -- quoted fast, delivered on time, and right the first time.',
      priorities:'1) Cut quote turnaround from days to hours. 2) Lift on-time delivery through better demand forecasting. 3) Reduce rework and warranty claims with line-quality analytics.',
      aiStrategy:'AI serves the strategy, not the reverse. First targets are quote drafting, demand forecasting, and support triage -- each one owned by a named leader and gated by the AI Transformation Council before it scales.'
    },
    fluency:{
      engagement:'occasional',
      tools:'Microsoft Copilot (patchy adoption), ChatGPT used informally by individuals, a forecasting pilot in the BI team, and a support-triage trial in customer service.'
    },
    change:{
      recentChange:'A bruising ERP consolidation two years ago that ran long and over budget. It succeeded, but it spent the organization\u2019s appetite for change. People are competent and loyal but change-weary, which shapes how fast we can move on AI.'
    },
    structure:{
      ownership:'cao',
      boardOversight:'none',
      crossFunc:'none',
      decisionStructure:'Decision rights for AI are undefined. It is unclear who can approve a deployment, who owns a model\u2019s outputs, or who is accountable when something goes wrong.',
      gaps:'The central gap is between technology management and transformation leadership -- and between senior intent and middle-management reality.'
    },
    ethical:{
      workforce:'undecided',
      lines:'No agreed boundaries on what AI may decide unaided. Customer commitments, pricing approvals, and people decisions are felt to be human, but nothing is written down.'
    }
  };

  // --- Step 1.1 numeric self-ratings (1-5) read by the Readiness Report / radar.
  //     Keys live INSIDE each assessment domain; deliberately modest at baseline. ---
  data.assessments.purpose.clarity=3;   data.assessments.purpose.aiAlignment=2; data.assessments.purpose.coherence=3;
  data.assessments.fluency.foundational=2; data.assessments.fluency.failureModes=2; data.assessments.fluency.costRisk=2; data.assessments.fluency.strategic=3; data.assessments.fluency.handsOn=2;
  data.assessments.change.trackRecord=3; data.assessments.change.fatigue=2; data.assessments.change.middleMgmt=2; data.assessments.change.psySafety=3; data.assessments.change.learningCulture=3;
  data.assessments.structure.crossCollab=2; data.assessments.structure.mmRole=2;
  data.assessments.ethical.identity=2; data.assessments.ethical.evidence=2; data.assessments.ethical.commitments=1; data.assessments.ethical.assumptions=2;

  // --- Step 1.2: Landscape notes ---
  data.landscapeNotes={
    ownershipGap:'Technology is managed under the CFO; transformation leadership is not yet owned anywhere with authority. The new CAIO is the intended bridge, but her mandate and decision rights have not been ratified, so accountability still falls between roles.',
    mmAssessment:'Middle managers are capable and trusted but under-equipped for AI. They have had no training, no decision framework, and no time carved out. They are the connective tissue between strategy and execution, and right now they are a single point of failure for adoption.'
  };

  // --- Step 1.3: Risk Mapping (seven scenarios; flat score keys + risks array) ---
  // Scores are 1-5; likelihood * impact drives the heat map, timeHorizon orders urgency.
  var RISK_SEED={
    zillow:{likelihood:3,impact:5,timeHorizon:4,notes:'We are tempted to scale the forecasting pilot fast. Without a governing body and clear ownership, an over-eager rollout could commit us to numbers the business then has to honor.'},
    calstate:{likelihood:4,impact:4,timeHorizon:5,notes:'Given change fatigue from the ERP program, announcing AI without bringing managers and staff along first is our single most likely failure mode.'},
    aircanada:{likelihood:3,impact:4,timeHorizon:4,notes:'The support-triage trial could promise customers things we cannot honor. We have no policy on what the AI may commit to on our behalf.'},
    cigna:{likelihood:2,impact:5,timeHorizon:3,notes:'Pressure to automate warranty and claims triage for speed. The reputational and legal cost of removing human review from edge cases would be severe.'},
    stigma:{likelihood:3,impact:3,timeHorizon:3,notes:'Quiet signals that leaders who lean on AI are seen as less capable. If that hardens, the people we most need to adopt will hide their use.'},
    disruption:{likelihood:4,impact:4,timeHorizon:4,notes:'A larger competitor is already cutting quote times with AI. Moving too slowly is as real a risk as moving carelessly.'},
    fatigue:{likelihood:4,impact:3,timeHorizon:3,notes:'Layering AI onto an organization still recovering from the ERP change could burn people out and stall everything if we do not build stable foundations first.'}
  };
  var _sids=['zillow','calstate','aircanada','cigna','stigma','disruption','fatigue'];
  if(!data.riskNotes)data.riskNotes={};
  var _risks=[];
  _sids.forEach(function(sid){
    var r=RISK_SEED[sid];
    data['risk_'+sid+'_likelihood']=r.likelihood;
    data['risk_'+sid+'_impact']=r.impact;
    data['risk_'+sid+'_timeHorizon']=r.timeHorizon;
    data.riskNotes[sid]=r.notes;
    _risks.push({id:sid,likelihood:r.likelihood,impact:r.impact,timeHorizon:r.timeHorizon,notes:r.notes});
  });
  data.risks=_risks;

  // --- Individual-track completion per leader (steps 1.4/2.4/3.5/4.4), by tier ---
  // DONE: all four; PROGRESS: 1.4+2.4; START: partial; unlinked: none.
  data.indivDone={
    seed_ceo:{'1.4':true,'1.4:intro':true,'1.4:workforce':true,'1.4:atrophy':true,'2.4':true,'3.5':true,'4.4':true,'4.4:reflections':true,'4.4:stop':true,'4.4:slowlog':true},   // DONE
    seed_coo:{'1.4':true,'1.4:intro':true,'1.4:workforce':true,'1.4:atrophy':true,'2.4':true,'3.5':true,'4.4':true,'4.4:reflections':true,'4.4:stop':true,'4.4:slowlog':true},   // DONE
    seed_caio:{'1.4':true,'1.4:intro':true,'1.4:workforce':true,'1.4:atrophy':true,'2.4':true,'3.5':true,'4.4':true,'4.4:reflections':true,'4.4:stop':true,'4.4:slowlog':true},  // DONE
    seed_cfo:{'1.4':true,'2.4':true},                          // PROGRESS
    seed_cmo:{'1.4':true,'2.4':true},                          // PROGRESS
    seed_cpo:{'1.4':true,'2.4':true},                          // PROGRESS
    seed_cito:{'1.4':true,'2.4':true},                         // PROGRESS
    seed_vpeng:{'1.4':true},                                   // START (one step)
    seed_vpsales:{'1.4':true},                                 // START (one step)
    seed_vpdata:{}                                             // START (none yet)
    // seed_vpops, seed_vphr, seed_dirpx: unlinked, no individual-track data
  };

  // --- Step 1.4: Mindset Foundations -- study reflections + dependency scan ---
  data.mindsetStudy={'seed_ceo':{
    theme1:'The hardest shift is from episodic change to continuous change. The ERP program had an end date; AI does not. Leading it means building stable foundations rather than bracing for one more push.',
    theme2:'Judgment becomes more valuable, not less, as routine cognitive work is automated. The leader\u2019s job moves toward framing problems, weighing values, and deciding what not to delegate.',
    theme3:'Composure is a leadership capability we have under-invested in. Deciding well under uncertainty, and staying steady when the picture is incomplete, is now part of the core job.',
    dwAgents:'We will allow bounded agents (e.g. support triage) only where the role, limits, and escalation path are written down and a human owns the outcome.',
    dwManaging:'Managers are evaluated partly on how well they integrate AI without eroding their team\u2019s core skills or trust.',
    selfAudit:'Each leader keeps a short log of decisions where they leaned on AI and where they overrode it, reviewed in the monthly leadership session.'
  },
    seed_coo:{theme1:'Operational change has an end state; AI does not. I keep wanting a "go-live" date and there isn\u2019t one.',theme2:'Where I add most value is deciding which pilots are real and which are theatre.',theme3:'The plant teams trust evidence over slogans -- so do I.'},
    seed_caio:{theme1:'My instinct is to optimize the model; the harder discipline is deciding where a model should not be used at all.',theme2:'Governance gates are not bureaucracy -- they are how trust is earned across the business.',theme3:'I have to translate, not just build.'},
    seed_cfo:{theme1:'I came in skeptical. The shift for me is from "prove the ROI first" to "design a small, reversible bet and learn".',theme2:'Verification before scaling is the control I actually care about.',theme3:'Hype is noise; the cash-flow case is signal.'},
    seed_cmo:{theme1:'Customer tone is the thing I will not automate away. AI drafts; people commit.',theme2:'The risk is a confident wrong message at scale.',theme3:'Brand trust is slow to build, fast to lose.'},
    seed_cpo:{theme1:'My job is honesty with people whose roles change. The mindset shift is owning that rather than softening it.',theme2:'Workforce impact is a leadership question, not an HR process.',theme3:'People can handle hard truths; they cannot handle being managed around.'},
    seed_cito:{theme1:'I own the cultural side, which means I cannot hide behind the technology.',theme2:'The strategic story has to be legible to the plant floor, not just the board.',theme3:'Continuous change needs stable anchors.'},
    seed_vpeng:{theme1:'Strong on the build, early on the leadership of an AI-shaped team. That gap is mine to close.',theme2:'',theme3:''},
    seed_vpsales:{theme1:'Cautious about AI in front of customers; starting to see where it helps rather than replaces.',theme2:'',theme3:''}
};
  data.depScan=[
    {skill:'Demand forecasting & planning judgment',aiTool:'Forecasting model (BI pilot)',importance:'High',riskLevel:'Medium'},
    {skill:'Quote drafting & pricing logic',aiTool:'Quote-drafting assistant',importance:'High',riskLevel:'High'},
    {skill:'First-line customer support',aiTool:'Support-triage assistant',importance:'Medium',riskLevel:'Medium'},
    {skill:'Line-quality inspection analysis',aiTool:'Quality analytics',importance:'Medium',riskLevel:'Low'}
  ];

  // --- Phase 2, Step 2.1: Leadership Structure ---
  data.structure={
    ownerModel:'cito',
    ownerWho:'Sinead Corrigan, Chief Innovation & Transformation Officer, accountable to the CEO and reporting quarterly to the board. The CAIO (Dr. Shalini Mehta) leads the technical AI work; the CITO owns the cultural, strategic, and organizational side of the transition.',
    ownerChange:'Create a dedicated CITO role rather than leaving transformation inside the CFO\u2019s IT remit, and give it ratified decision rights for deployment approvals alongside the CAIO\u2019s technical ownership.',
    boardStructure:'Stand up a Board AI Committee meeting quarterly, with one outside advisor who has led an AI transition.',
    boardExpertiseGaps:'Strong on finance, manufacturing, and governance; still thin on data ethics and the workforce dimensions of automation \u2014 recruit or advise to close this.',
    boardDecisions:'The committee sets risk appetite, approves scaling beyond pilot, and reviews the workforce-impact plan; it does not approve individual deployments.',
    boardEducation:'A short quarterly briefing from the CAIO plus an annual external session to build directors\u2019 fluency.',
    seniorDecisionRights:'Pilots: owning executive decides. Scaling past pilot: CAIO with COO/CFO sign-off. Anything touching customer commitments or jobs: escalates to the council.',
    seniorAccountability:'Each AI initiative has one named accountable executive. The CAIO owns the portfolio; outputs are owned by the function that deploys them.',
    seniorAlignment:'Monthly leadership review keeps the team aligned; disagreements are surfaced there rather than worked around.',
    mmAutomate:'Routine reporting, first-draft quotes, ticket classification, and forecast generation.',
    mmAugment:'Exception handling, customer escalations, supplier negotiations, and final pricing -- AI drafts, the manager decides.',
    mmHuman:'Hiring and performance decisions, layoffs or redeployment, and any commitment a customer will rely on.',
    coordMechanism:'council',
    coordCadence:'Council meets fortnightly during the build; leadership review monthly; board committee quarterly.',
    coordConflict:'Conflicts that cannot be resolved in council go to the CEO with a written recommendation and a dissent noted.',
    coordInfo:'A shared one-page status per initiative -- owner, stage, risks, decisions needed -- visible to all council members.'
  };

  // --- Phase 2, Step 2.2: AI Collaboration Lab ---
  data.collabLab={
    touchCustomer:'Support triage and quote drafting are the main customer-facing AI touchpoints.',
    touchInternal:'Forecast generation, reporting, and meeting summaries.',
    touchDecision:'AI informs pricing and planning decisions but does not make them.',
    touchAgent:'A support-triage agent with a defined, bounded role and an explicit escalation path to a human.',
    personaCustomer:'In customer contact the AI is helpful, plain-spoken, and explicit that it is an assistant -- never implying it can authorize commitments.',
    personaInternal:'Internally the AI is treated as a fast, fallible first-drafter whose work is always checked.',
    personaBoundaries:'The assistant never quotes binding prices, never confirms delivery dates, and always hands edge cases to a person.',
    aiFreeZones:'People conversations, performance reviews, and final pricing approvals are deliberately AI-free.',
    proprietary:'Pricing logic, customer lists, and warranty data stay out of public AI tools; only sanctioned, contained tools touch them.',
    atrophyRisks:'Risk that estimators lose pricing intuition and that support staff lose first-line problem-solving if the AI does too much.',
    translators:'The CAIO and two BI analysts act as translators between the technical work and the operating teams.',
    transProcesses:'Translators sit in the council, run short clinics for managers, and own the plain-language documentation.',
    transRisks:'If the translators become a bottleneck, adoption stalls; we are cross-training to avoid a single point of dependence.',
    functionModels:[ /* 16 Sep 2026 (Paul's ruling): in the shape the step writes ({name, model}); the models are authored from the roles the earlier seed described — drafting with a human deciding is Augmenter, forecasting with a human approving is Advisor, the bounded triage agent of the Touchpoint Map is Autonomous Agent */
      {name:'Customer Support',model:'augmenter'},
      {name:'Sales / Estimating',model:'augmenter'},
      {name:'Operations / Planning',model:'advisor'},
      {name:'Support Triage',model:'autonomous'}
    ]
  };
  data.collabPrinciples={
    aiVoice:'The AI speaks as a clearly-labeled assistant: helpful and direct, never implying authority it does not have, always deferring binding decisions to a named human.',
    touchpoints:'Three governed touchpoints at launch -- support triage, quote drafting, and demand forecasting -- each with an owner and a human reviewer.'
  };

  // --- Phase 2, Step 2.3: Competency Framework (definitions + per-leader scores) ---
  var _compIds=['orchestration','philosophical','hybrid','change','composure','ecosystem','emotional'];
  data.competencyFramework={
    definitions:{
      orchestration:'For Aurora: deciding where AI belongs in quoting, planning, and support -- and where it does not -- and designing the human/AI workflow for each.',
      philosophical:'Surfacing the assumptions baked into our tools (what a "good" quote or a "qualified" lead is) and being able to defend or challenge them.',
      hybrid:'Leading teams where an assistant has a defined role alongside people, and managing the human dynamics that creates.',
      change:'Leading continuous change without exhausting an already change-weary workforce; building stable foundations.',
      composure:'Deciding well under uncertainty as the AI landscape shifts; portfolio thinking over rigid plans.',
      ecosystem:'Managing vendors, partners, and competitive dynamics in an AI-driven market.',
      emotional:'The human skills -- trust, empathy, conflict resolution, mentoring -- that matter more as machines take routine cognitive load.'
    },
    scores:{}
  };
  // Baseline competency scores per leader (1-5), keyed <leaderIndex>_<competencyId>.
  // Deliberately modest, with the CAIO strongest and the CFO/People lead lowest.
  var _compBaseline=[
    {orchestration:4,philosophical:4,hybrid:3,change:4,composure:4,ecosystem:3,emotional:5}, // Harriet (CEO) -- DONE
    {orchestration:4,philosophical:3,hybrid:4,change:4,composure:4,ecosystem:3,emotional:4}, // Vincent (COO) -- DONE
    {orchestration:5,philosophical:5,hybrid:4,change:4,composure:5,ecosystem:4,emotional:4}, // Shalini (CAIO) -- DONE
    {orchestration:2,philosophical:3,hybrid:2,change:3,composure:3,ecosystem:2,emotional:3}, // Ray (CFO) -- PROGRESS
    {orchestration:3,philosophical:2,hybrid:3,change:3,composure:2,ecosystem:3,emotional:4}, // Imogen (CMO) -- PROGRESS
    {orchestration:2,philosophical:3,hybrid:2,change:3,composure:3,ecosystem:2,emotional:4}, // Duncan (CPO) -- PROGRESS  [index 5]
    {orchestration:4,philosophical:3,hybrid:3,change:4,composure:3,ecosystem:3,emotional:4}, // Sinead (CITO) -- PROGRESS  [index 6]
    {orchestration:2,philosophical:1,hybrid:2,change:2,composure:2,ecosystem:1,emotional:2}, // Freya (VP Eng) -- START
    {orchestration:1,philosophical:1,hybrid:1,change:2,composure:2,ecosystem:1,emotional:3}, // Tomas (VP Sales) -- START
    {orchestration:3,philosophical:2,hybrid:2,change:2,composure:2,ecosystem:2,emotional:2}, // Tamsin (VP Data) -- START
    {orchestration:2,philosophical:1,hybrid:2,change:2,composure:3,ecosystem:1,emotional:3}, // Glen (VP Ops) -- UNLINKED, scored
    {orchestration:2,philosophical:2,hybrid:3,change:2,composure:2,ecosystem:2,emotional:3}  // Beatriz (Dir PX) -- UNLINKED, scored
  ];
  _compBaseline.forEach(function(row,i){
    var lid=(data.leaders[i]||{}).id; if(!lid)return;
    _compIds.forEach(function(cid){ data.competencyFramework.scores[lid+'_'+cid]=row[cid]; });
  });

  // --- Phase 2, Step 2.4: Mindset Depth ---
  data.mindsetDepth={'seed_ceo':{
    val1:'Human judgment leads; AI advises.',
    val2:'We are honest with our people about what is changing and why.',
    val3:'We build foundations before we scale.',
    val4:'No customer commitment is made by a machine.',
    val5:'We protect the skills we do not want to lose.',
    case1:'When the forecasting model and an experienced planner disagree, the planner\u2019s judgment wins until the model has earned trust on the record.',
    case2:'When the support assistant cannot resolve a frustrated customer, it hands off fast and warmly rather than looping.',
    case3:'When automation would cut a role, we plan redeployment and tell affected people early, not last.'
  },
    seed_coo:{val1:'Reliability',val2:'Honesty about limits',val3:'Stable footing for teams',val4:'',val5:'',case1:'A forecasting pilot that we paused when it could not explain a swing.',case2:'',case3:'',agents:'Assistants draft the daily plan; a person signs it off.',managing:'I watch for over-trust in a clean-looking number.',selfAudit:'I ask whose judgment the tool is replacing unnoticed.'},
    seed_caio:{val1:'Rigor',val2:'Transparency',val3:'Human accountability',val4:'Fairness',val5:'',case1:'Refused to ship a lead-scoring model until the proxy for "qualified" was defensible.',case2:'',case3:'',agents:'Defined where the assistant decides vs recommends.',managing:'Bias surfaced in training data is my standing concern.',selfAudit:'I document the assumption behind every "good" label.'},
    seed_cfo:{val1:'Prudence',val2:'Evidence',val3:'Reversibility',val4:'',val5:'',case1:'Structured the first AI spend as a staged, killable bet.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I check that the verification step is real, not ceremonial.'},
    seed_cmo:{val1:'Trust',val2:'Voice',val3:'Restraint',val4:'',val5:'',case1:'Held a campaign that an AI tool wanted to send before a human read it.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I ask whether a message would embarrass us if it were wrong.'},
    seed_cpo:{val1:'Honesty',val2:'Dignity',val3:'Fairness',val4:'',val5:'',case1:'Told a team early that their work would change, with a plan attached.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I check who carries the cost of a change and whether it is fair.'},
    seed_cito:{val1:'Coherence',val2:'Candor',val3:'Stability',val4:'',val5:'',case1:'Re-sequenced a rollout so the culture could keep up with the technology.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I test whether the strategic story still makes sense on the floor.'}
};

  // --- Phase 3, Step 3.1: AI Fluency Sprint (shared + per-leader tasks) ---
  data.fluencySprint={
    project:'Stand up the governed quote-drafting assistant for one product line, end to end, with a human reviewer.',
    projectWorkflow:'Quote requests come in through the CRM intake, the drafting assistant writes against the price book, the anomaly checker flags outliers, and the estimator reviews, prices, and commits.',
    projectJudgment:'The judgment we are protecting is final pricing -- the assistant drafts, the estimator decides and commits.',
    filter:'Use AI for the first draft and the routine; reserve human attention for exceptions, relationships, and anything a customer will rely on.',
    leaderTasks:{}
  };
  // Per-leader fluency tasks (task1/task2/task3) for each seeded leader.
  // Per-leader fluency-sprint tasks, keyed by stable leader id (not array index).
  // DONE/PROGRESS leaders show real sprint activity; START leaders one task; unlinked none.
  var _fluencyTasks={
    seed_ceo:{task1:'Used Copilot daily for a week to draft board-pack narratives, then edited heavily.',task2:'Ran a side-by-side of an AI-drafted vs. self-drafted strategy memo.',task3:'Reflected on where the AI draft was confidently wrong.'},
    seed_coo:{task1:'Built a forecast for one product line with the BI tool and compared it to the planner\u2019s number.',task2:'Drafted a shift plan with AI assistance and stress-tested it on the floor.',task3:'Noted where the model missed real-world constraints.'},
    seed_caio:{task1:'Prototyped the quote-drafting assistant and documented its failure modes.',task2:'Wrote the plain-language guardrails for the support agent.',task3:'Coached two managers through their first model review.'},
    seed_cfo:{task1:'Used AI to summarize three financing options, then checked every figure by hand.',task2:'Tested an AI-assisted variance analysis against the manual one.',task3:''},
    seed_cmo:{task1:'Generated three campaign concepts with AI and rewrote them for brand voice.',task2:'Used AI to cluster customer feedback, then validated the themes.',task3:''},
    seed_cpo:{task1:'Drafted an internal FAQ about the AI changes with AI help, then made it human.',task2:'Used AI to model redeployment options for an affected team.',task3:''},
    seed_cito:{task1:'Built a one-page AI purpose filter with AI assistance, then pressure-tested it against three live tool decisions.',task2:'Used AI to map cross-functional dependencies for the council.',task3:''},
    seed_vpeng:{task1:'Tried an AI pair-programming tool on a real ticket and logged what it got wrong.',task2:'',task3:''},
    seed_vpdata:{task1:'Benchmarked an AI feature-engineering step against the manual pipeline.',task2:'',task3:''}
  };
  Object.keys(_fluencyTasks).forEach(function(lid){ if(_fluencyTasks[lid]) data.fluencySprint.leaderTasks[lid]=_fluencyTasks[lid]; });
  // Fluency assignment (per-leader assigned focus area), keyed by leader index.
  // Assign each leader's fluency work to a real program user (u1-u5), cycling across
  // the roster so the "Assign to" dropdown shows a genuine assignee for everyone.

  // --- Phase 3, Step 3.2: Decision Simulations (four scenarios; response + premortem) ---
  var _decisions={
    autonomous:{response:'We would not grant the assistant autonomy over binding actions. It may act inside a narrow, reversible lane (classifying tickets, drafting quotes) with a human owning every commitment.',premortem:'If we granted too much: a wrong auto-commitment to a customer, an unpriced edge case shipped, and a loss of trust that sets adoption back a year.'},
    workforce:{response:'Be honest early. Map the 50 affected roles, fund retraining, prioritize redeployment over exit, and tell people before rumor does. Treat it as a leadership obligation, not an HR clean-up.',premortem:'If handled badly: a fearful workforce that hides AI use, our best people leave first, and the change stalls amid mistrust.'},
    competitor:{response:'Respond with discipline, not panic. Accelerate the governed support and quoting pilots, publish a clear internal timeline, and resist a rushed, ungoverned rollout that trades long-term trust for short-term parity.',premortem:'If we panic: an ungoverned deployment, a public error, and a self-inflicted wound worse than the competitive gap we were chasing.'},
    ethical:{response:'The Values Architecture holds. If the profitable strategy crosses a principle (e.g. a commitment a machine makes, or a subtly unfair pricing pattern), we decline it and say why, in writing, to the board.',premortem:'If we cave under financial pressure once, the principles become decorative and every future boundary is negotiable.'}
  };
  data.decisionSims={};
  Object.keys(_decisions).forEach(function(id){
    data.decisionSims[id+'_response']=_decisions[id].response;
    data.decisionSims[id+'_premortem']=_decisions[id].premortem;
  });

  // --- Phase 3, Step 3.3: Middle Management Activation ---
  data.mmActivation={
    workflows:[
      {name:'Quote drafting',aiRole:'Drafts the quote from the spec and pricing rules',humanRole:'Reviews, sets final price, commits to the customer'},
      {name:'Support triage',aiRole:'Classifies and drafts a first reply',humanRole:'Resolves, decides, owns the relationship'},
      {name:'Demand forecast',aiRole:'Generates the baseline forecast',humanRole:'Adjusts for judgment and approves the plan'}
    ],
    humanOnly:[
      {decision:'Final pricing and any customer commitment',reason:'A binding promise must be made by an accountable person.'},
      {decision:'Hiring, performance, and redeployment decisions',reason:'These affect livelihoods and require human judgment and care.'},
      {decision:'Scaling an AI system beyond its pilot',reason:'Crosses a risk threshold that belongs to the council, not a tool.'}
    ],
    logTemplate:'Date | Decision | AI input used | Human override (Y/N) | Why',
    logCadence:'Reviewed in the monthly leadership session; patterns fed back to the council.',
    evalCriteria:'Managers are assessed on outcomes, on protecting core team skills, and on honest use of AI -- not on raw automation volume.',
    evalMetrics:'Quote turnaround, on-time delivery, first-contact resolution, rework rate, and team skill-retention checks.'
  };

  // --- Phase 3, Step 3.4: Values Architecture (org values + discussion) ---
  data.orgValues=[
    {id:'v1',principle:'Human judgment leads; AI advises.',domain:'ontological'},
    {id:'v2',principle:'We are honest with our people about what is changing.',domain:'ethical'},
    {id:'v3',principle:'No binding customer commitment is made by a machine.',domain:'ethical'},
    {id:'v4',principle:'We build stable foundations before we scale.',domain:'epistemological'},
    {id:'v5',principle:'We protect the skills we do not want to lose.',domain:'ontological'}
  ];
  data.valuesArch=data.orgValues.map(function(v){return v.id;});
  data.vaSec={principles_done:true,synthesis_done:true,tagging_done:true};
  data.valuesDiscussion={
    divergences:'The sharpest disagreement was on pace: the CMO and CAIO want to move faster, the CFO and People lead want firmer foundations first. We resolved it as "fast on governed pilots, patient on scaling."',
    embedding:'The principles appear on every role card in the org chart, open every council meeting, and are part of how managers are evaluated -- not a poster, but a working reference.',
    collectiveCommitments:'We treat AI as a tool that serves human judgment, not a replacement for it. We will be honest with our people, keep binding commitments human, build before we scale, and protect the craft that makes Aurora trusted.'
  };

  // --- Phase 3, Step 3.5: Mindset Application ---
  data.mindsetApp={'seed_ceo':{
    fear:'That we move too cautiously, a competitor outruns us, and the caution we called "responsible" was really just fear of change.',
    hope:'That Aurora becomes the firm that adopted AI without losing its head or its people -- faster and steadier than rivals because the leadership was ready.',
    atrophySkill:'Estimating intuition -- the feel for a fair, winnable price -- is the skill we most want to keep sharp even as the assistant drafts.',
    practice:'A monthly ten-minute "slow thinking" review where each leader names one decision they deliberately did not delegate, and why.',
    commitments:'Run the monthly leadership review, keep the decision log honest, and revisit the Values Architecture every quarter against real cases.',
    scorecardDecision:'Used the readiness scorecard to decide to delay scaling the support agent by one month until the escalation path and guardrails were documented.'
  },
    seed_coo:{fear:'That we automate a judgment that should have stayed human.',hope:'Faster, calmer operations with people freed from drudgery.',atrophySkill:'Hands-on feel for what a realistic plan looks like.',practice:'Monthly manual forecast vs the model, by hand.',commitments:'No silent automation of a sign-off.',scorecardDecision:'Yes'},
    seed_caio:{fear:'Over-trust in a confident model.',hope:'AI as genuine leverage on the hardest problems.',atrophySkill:'First-principles problem framing.',practice:'Red-team my own models quarterly.',commitments:'Every deployment has a human owner.',scorecardDecision:'Yes'}
};

  // --- Phase 4, Step 4.1: Operating Rhythm ---
  data.opRhythm={
    agenda:'Monthly leadership review: portfolio status, decisions needed, one deep-dive, and a values check against a real recent case.',
    agendaOwner:'Chaired by the CEO; portfolio prepared by the CAIO.',
    peerStructure:'A monthly peer forum for the six leaders to compare AI decisions candidly, off the record.',
    peerAgenda:'Each leader brings one decision where they used AI and one where they overrode it.',
    simFreq:'A quarterly decision simulation for the leadership team.',
    simDesign:'Run on a real, live dilemma rather than a hypothetical, with a written debrief.',
    frontier:'A standing fifteen-minute "what changed" briefing from the CAIO on the AI landscape.',
    boardEd:'A quarterly board briefing plus one external session a year to build director fluency.'
  };
  data.rhythm={cadence:'Council fortnightly; leadership review monthly; board committee quarterly.'};

  // --- Phase 4, Step 4.2: Evaluation & Succession ---
  data.evalSuccession={
    indicators:'Honest AI use, skill-retention in the team, quality of judgment under uncertainty, and how well a leader brings their people along -- weighted above raw automation metrics.',
    proportion:'About a third of each senior leader\u2019s evaluation now reflects AI-era leadership behaviors.',
    bench:'The CAIO is the obvious AI-leadership successor; the COO is building fast. The gap is a credible successor for the CFO\u2019s governance role.',
    benchChanges:'Add an AI-fluency expectation to every senior succession profile and sponsor two high-potential managers into the council.',
    boardFluency:'Recruit one director with AI/data depth within a year; brief the rest quarterly.'
  };
  data.evaluation={criteria:'AI-era leadership behaviors -- honest use, skill protection, judgment under uncertainty, and bringing people along -- now form roughly a third of senior evaluations.'};

  // --- Phase 4, Step 4.3: First Leadership Review (per-leader + structure verdict) ---
  data.leadershipReview={
    leaders:{},
    structWorking:'The CAIO role and the AI Transformation Council have given AI a clear home and a place where functions decide together. Decision rights are now mostly understood, and the monthly review is sticking.',
    structRevision:'The board committee is still under-powered on AI expertise, and the council occasionally becomes a bottleneck for smaller decisions. Push more routine approvals down and strengthen the board.'
  };
  // Honest per-leader review notes after the first 90 days -- progress, not perfection.
  // 14 Sep 2026 (Paul's ruling): assessments carry the four values Step 4.3 writes (developed, progressing, support, hard); the seed had used its own words.
  // 15 Sep 2026: the three early-stage leaders carry the three review scores their judgments imply (flagged for Paul); Glen and Beatriz are not yet assessed by design.
  var _review=[
    {fluency:5,change:5,philosophical:5,assessment:'developed',notes:'Set the tone, protected the principles under pressure, and kept the pace disciplined. Now needs to delegate more of the portfolio to avoid becoming the bottleneck.'}, // Harriet (CEO) DONE
    {fluency:4,change:5,philosophical:4,assessment:'developed',notes:'Moved from cautious to genuinely engaged; the forecasting and quoting pilots are his. Now leads the operational AI story with confidence.'}, // Vincent (COO) DONE
    {fluency:5,change:5,philosophical:5,assessment:'developed',notes:'The engine of the transition. Watch for over-centralization -- her translators must be cross-trained so adoption does not depend on her alone.'}, // Shalini (CAIO) DONE
    {fluency:3,change:4,philosophical:3,assessment:'support',notes:'Started skeptical, now persuaded by evidence and a real asset on governance. Fluency is rising from a low base; pair him with the CAIO on model risk.'}, // Ray (CFO) PROGRESS
    {fluency:4,change:3,philosophical:3,assessment:'progressing',notes:'Brings energy and customer insight; needs to slow down on ungoverned experiments and respect the scaling gate.'}, // Imogen (CMO) PROGRESS
    {fluency:3,change:4,philosophical:3,assessment:'support',notes:'The conscience of the workforce plan and trusted by staff. Building the hands-on AI fluency to lead the people side credibly.'}, // Duncan (CPO) PROGRESS
    {fluency:4,change:4,philosophical:4,assessment:'developed',notes:'Has taken real ownership of the cultural and strategic side of the transition and works well with the CAIO. Still building internal relationships across functions.'}, // Sinead (CITO) PROGRESS
    {fluency:3,change:2,philosophical:2,assessment:'support',notes:'Strong engineer, early in AI-team leadership. Has begun the fluency sprint; needs to finish the mindset track.'}, // Freya (VP Eng) START
    {fluency:2,change:2,philosophical:2,assessment:'hard',notes:'Cautious about customer-facing AI. Engaged with the first study step; not yet rescored.'}, // Tomas (VP Sales) START
    {fluency:3,change:2,philosophical:2,assessment:'hard',notes:'Technically fluent on data, newer to leadership of the practice. Has not yet completed the development track.'}, // Tamsin (VP Data) START
    {assessment:'',notes:'Not yet engaged with the program; assessed at org level only.'}, // Glen (VP Ops) UNLINKED
    {assessment:'',notes:'Recently promoted; not yet enrolled in the leadership track.'} // Beatriz (Dir PX) UNLINKED
  ];
  data.leaders.forEach(function(l,i){ var lid=l.id; if(lid&&_review[i]) data.leadershipReview.leaders[lid]=_review[i]; });

  // --- Phase 4, Step 4.4: Composure & Resilience ---
  data.composure={'seed_ceo':{
    stop1:'Name the decision and the deadline honestly -- is it reversible, and does it truly need deciding now?',
    stop2:'Separate what we know from what we are assuming, and ask what would change our mind.',
    stop3:'Check the decision against the Values Architecture before committing.',
    constants:'Our purpose, our principles, and our duty to our people are the fixed points that do not move when the technology does.',
    constantsComm:'Leaders restate those constants plainly and often, especially when things feel uncertain.',
    uncertaintyProcess:'Decide with the information we have, write down the assumptions, set a review date, and adjust without flinching when reality disagrees.',
    uncertaintyComms:'Tell people what we know, what we don\u2019t, and when they\u2019ll hear more -- candor over false certainty.',
    slowLog:[
      {text:'Paused before approving the support agent\u2019s wider rollout; chose to document the escalation path first. The week\u2019s delay was worth the protection.',date:new Date(Date.now()-1000*60*60*24*21).toISOString(),user:'u1'},
      {text:'Resisted matching a competitor\u2019s ungoverned launch; held the scaling gate and briefed the board on why. Steadier, not slower for its own sake.',date:new Date(Date.now()-1000*60*60*24*10).toISOString(),user:'u3'},
      {text:'Overrode the forecast on one product line where the planner\u2019s judgment was clearly better; logged it so we learn when to trust the model.',date:new Date(Date.now()-1000*60*60*24*3).toISOString(),user:'u2'}
    ]
  },
    seed_coo:{stop1:'When a plant metric swings overnight.',stop2:'When a vendor promises a step-change.',stop3:'When two functions want the same AI resource.',constants:'On-time delivery and safety do not bend.',constantsComm:'Stated at every ops review.',uncertaintyProcess:'Decide the next reversible step, not the whole roadmap.',uncertaintyComms:'I tell teams what we know and what we are still testing.',slowLog:[]},
    seed_caio:{stop1:'When a model looks too good.',stop2:'When a stakeholder wants to skip the gate.',stop3:'When the data shifts under a live model.',constants:'Human accountability and explainability.',constantsComm:'Built into every governance review.',uncertaintyProcess:'Stage, verify, then scale.',uncertaintyComms:'I publish what each model can and cannot do.',slowLog:[]}
};
  // Per-user practice log (slow-thinking), keyed by user id as the code expects.
  // --- Ongoing-practices cadence: current period, varied live stamps, and two
  //     months of pre-archived history so the L&D hub health grid and Practice
  //     History both render populated immediately. ---
  (function(){
    var now=new Date();
    function isoAgo(days){var d=new Date(now);d.setDate(d.getDate()-days);return d.toISOString();}
    data.practicePeriod=now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2);
    // A date pinned safely inside the CURRENT month (day 2 is always in-month), so a
    // practice that is present reads as "done this month" (green) regardless of when the
    // seed is loaded; an omitted practice reads as "not started" (grey). The spread is
    // deliberate -- from leaders who have done everything this month to one who has done
    // nothing -- so the health grid shows a clear done/not mix.
    function isoThisMonth(day){var d=new Date(now.getFullYear(),now.getMonth(),day||2,12,0,0);return d.toISOString();}
    data.practiceLog={
      u6:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(3),depScan:isoThisMonth(4),reverseAudit:isoThisMonth(5),valuesReview:isoThisMonth(6),concernCircle:isoThisMonth(7),commitments:isoThisMonth(8)},  // all seven done
      u7:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(4),depScan:isoThisMonth(6),reverseAudit:isoThisMonth(8),commitments:isoThisMonth(9)},  // five of seven
      u8:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(3),depScan:isoThisMonth(4),reverseAudit:isoThisMonth(5),valuesReview:isoThisMonth(6),concernCircle:isoThisMonth(7),commitments:isoThisMonth(8)},  // all seven done
      u9:{slowLog:isoThisMonth(2)},  // only slow thinking
      u10:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(5),valuesReview:isoThisMonth(7),commitments:isoThisMonth(9)},  // four of seven
      u11:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(4),depScan:isoThisMonth(6),concernCircle:isoThisMonth(8),commitments:isoThisMonth(9)},  // five of seven
      u12:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(5)},  // two of seven
      u13:{slowLog:isoThisMonth(2)},  // only slow thinking
      u14:{},  // nothing done this month
      u15:{slowLog:isoThisMonth(2),depScan:isoThisMonth(5),valuesReview:isoThisMonth(7)}  // three of seven
    };
    // Two prior months of archived snapshots (computed-health shape).
    function prevPeriod(n){var d=new Date(now.getFullYear(),now.getMonth()-n,1);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);}
    function archEnd(n){var d=new Date(now.getFullYear(),now.getMonth()-n+1,0,23,59,59);return d.toISOString();}
    /* Item-6 (F-4 ruling): the seeded history regenerates in the archiver's shape - all 13 grid leaders, keyed as the archiver keys them. */
    var _pUsers=(data.leaders||[]).map(function(l){return {id:(l.userId||l.id),name:l.name}});
    var _pNoLogin={};(data.leaders||[]).forEach(function(l){if(!l.userId)_pNoLogin[l.id]=true});
    var _pPracs=[{id:'slowLog',name:'Slow Thinking'},{id:'stopReview',name:'STOP Technique'},{id:'depScan',name:'Dependency Scan'},{id:'reverseAudit',name:'Skill Atrophy Audit'},{id:'valuesReview',name:'Values Review'},{id:'concernCircle',name:'Concern Circles'},{id:'commitments',name:'Commitments'}];
    // Deterministic-but-varied status generator for history cells. Binary now:
    // green = done that month, red = not done (~70% done).
    function mkCells(seed){
      var cells={};var g=0,r=0;var k=seed;
      _pUsers.forEach(function(u,ui){
        cells[u.id]={};
        _pPracs.forEach(function(p,pi){
          k=(k*1103515245+12345)&0x7fffffff;var v=(k>>8)%10;
          var s = (_pNoLogin[u.id] || v>=7) ? 'red' : 'green'; /* Item-6: no-login leaders can never log practices - history rows read not-done */
          if(s==='green')g++; else r++;
          cells[u.id][p.id]=s;
        });
      });
      return {cells:cells,summary:{green:g,red:r}};
    }
    data.practiceHistory={};
    [2,1].forEach(function(n,idx){
      var pk=prevPeriod(n);
      var mk=mkCells(idx===0?7:23);
      data.practiceHistory[pk]={period:pk,archivedAt:archEnd(n),users:_pUsers,practices:_pPracs,cells:mk.cells,summary:mk.summary};
    });
  })();

  // --- Mark every step and section complete so the journey reads as finished ---
  data.completedSections={A:true,B:true,C:true,D:true,E:true};
  // Ruled 25 July: under the discrete-button model, tabs and sections carry their own
  // state — the demo seeds them complete to match its completed steps.
  ['ownership','board','senior','middle','crossfunc'].forEach(function(s){data.structure[s+'_done']=true});
  ['touchpoints','models','personas','aifree','translation'].forEach(function(s){data.collabLab[s+'_done']=true});
  data.completedSteps={
    '1.1':true,'1.2':true,'1.3':true,'1.4':true,
    '2.1':true,'2.2':true,'2.3':true,'2.4':true,
    '3.1':true,'3.2':true,'3.3':true,'3.4':true,'3.5':true,
    '4.1':true,'4.2':true,'4.3':true,'4.4':true
  };

  // --- Module Management seed (§11): program clock + completion history.
  //     The journey reads as finished, so the clock starts 89 days back and
  //     each stepDoneAt is spread mechanically across its phase's day window
  //     (P1 days 1–25, P2 26–50, P3 51–75, P4 76–90). Derived, not hand-tuned
  //     — revisit list carries the hand-tuning question. Written at builder
  //     level like the exemplar's seed, so no notifications fire. ---
  (function(){
    var t0=new Date(); t0.setDate(t0.getDate()-89);
    data.startDate=t0.toISOString().split('T')[0];
    var _dISO=function(dd){var t=new Date(t0); t.setDate(t.getDate()+dd); return t.toISOString().split('T')[0];};
    data.stepDoneAt={
      '1.1':_dISO(5),'1.2':_dISO(10),'1.3':_dISO(15),'1.4':_dISO(20),
      '2.1':_dISO(28),'2.2':_dISO(33),'2.3':_dISO(38),'2.4':_dISO(44),
      '3.1':_dISO(53),'3.2':_dISO(58),'3.3':_dISO(63),'3.4':_dISO(68),'3.5':_dISO(72),
      '4.1':_dISO(78),'4.2':_dISO(81),'4.3':_dISO(84),'4.4':_dISO(88)
    };
    data.stepDue={};
    data.notifications=[]; data.remind7={};
    data.chatMsgs=[{who:'u2',name:'Paul Scade',ts:'9:14 AM',text:'Good morning everyone \u2014 just reviewed the Values Architecture section. The ontological framing is sharp. Matches the HBR article precisely.'}, {who:'u4',name:'Erik Nelson',ts:'9:31 AM',text:'Agreed. Quick thought: should we add a governance escalation path for the competency framework gaps? Clients keep asking about that.'}, {who:'u5',name:'Tom Davenport',ts:'9:47 AM',text:'Good point Erik. I\u2019d anchor it to the CARE framework \u2014 specifically the Catastrophize \u2192 Assess loop. That gives it theoretical grounding.'}, {who:'u2',name:'Paul Scade',ts:'10:02 AM',text:'Yes \u2014 and it maps cleanly to what Faisal published in MIT SMR. Easy to reference.'}, {who:'u4',name:'Erik Nelson',ts:'10:18 AM',text:'Faisal, can you weigh in when you get a chance? Want to lock this before the facilitation session.'}]; // demo thread seed-owned (item 13, July 16); personas are pre-Aurora relics — Paul's copy round // literal-overwrite ruling (July 8): runtime keys reset on every seed
  })();

  // --- Org chart: build from the sample leaders + their reporting lines, the same
  //     path real user data uses (Phase 1 hierarchy). No hardcoded model org. ---
  data.orgChart=phase1ChartRoles();
  // Express the sample hierarchy directly as role parentId/level (roles own the
  // hierarchy now). CEO under board; the C-suite under the CEO; VP People under COO.
  var _seedParents={
    'ldr_seed_ceo':{p:'board',lv:2},
    'ldr_seed_coo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_caio':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cfo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cmo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cito':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cpo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_vpeng':{p:'ldr_seed_coo',lv:4},
    'ldr_seed_vpsales':{p:'ldr_seed_cmo',lv:4},
    'ldr_seed_vpdata':{p:'ldr_seed_caio',lv:4},
    'ldr_seed_vpops':{p:'ldr_seed_coo',lv:4},
    'ldr_seed_vphr':{p:'ldr_seed_cpo',lv:4},
    'ldr_seed_dirpx':{p:'ldr_seed_vpeng',lv:4}
  };
  (data.orgChart||[]).forEach(function(r){
    var sp=_seedParents[r.id];
    if(sp){r.parentId=sp.p;r.level=sp.lv;}
  });
  // Demonstrate the "Unassigned" state under model B: leave Beatriz Camargo (the most
  // junior leader) occupying NO role. Her role box persists but vacant, so the chart
  // shows a vacant role AND her inventory entry reads "Unassigned" -- exercising both
  // the empty-role and unplaced-leader paths in a real demo (not just a synthetic test).
  (data.orgChart||[]).forEach(function(r){ if(r.id==='ldr_seed_dirpx')r.occupantLeaderId=null; });
  // Tag 2-3 values per role and set a guiding concept, modelling what a user does
  // via the per-role tagging list (3.4) and the dashboard role-edit form. Keyed to
  // the seeded leader ids (chart role ids are 'ldr_'+leaderId; board is 'board').
  var _seedTags={
    'board':{vals:['v1','v3'],gc:'Sets AI risk appetite and approves scaling beyond pilot; does not approve individual deployments.'},
    'ldr_seed_ceo':{vals:['v1','v2','v4'],gc:'Final accountability for the AI transition; protects the principles under commercial pressure and sets the pace.'},
    'ldr_seed_coo':{vals:['v1','v4'],gc:'Owns the operational pilots (forecasting, quoting); decides where AI is trusted on the line and where it is not.'},
    'ldr_seed_caio':{vals:['v1','v4','v5'],gc:'Owns the AI portfolio and the governance gates; the human/AI workflow for each deployment runs through this role.'},
    'ldr_seed_cfo':{vals:['v3','v4'],gc:'Decision rights over investment and the scaling gate; verification of AI-influenced numbers before they are relied on.'},
    'ldr_seed_cmo':{vals:['v2','v3'],gc:'Owns customer-facing AI tone and the line that no binding commitment is made by a machine.'},
    'ldr_seed_cpo':{vals:['v2','v5'],gc:'Owns the workforce-impact plan; honesty with affected people and protection of the skills worth keeping.'},
    'ldr_seed_cito':{vals:['v1','v2','v4'],gc:'Owns the cultural and strategic side of the AI transition end to end; holds the line on principles when efficiency arguments push the other way.'},
    'ldr_seed_vpeng':{vals:['v1','v4'],gc:'Builds the AI-assisted engineering workflow; decides where automated code and review are trusted.'},
    'ldr_seed_vpsales':{vals:['v2','v3'],gc:'Owns AI in the sales motion; keeps a human in the loop on every customer commitment.'},
    'ldr_seed_vpdata':{vals:['v1','v4'],gc:'Owns data quality and the model-evaluation discipline the rest of the business depends on.'},
    'ldr_seed_vpops':{vals:['v4'],gc:'Runs AI-assisted scheduling and quality at the plant; verifies before the line relies on a number.'},
    'ldr_seed_dirpx':{vals:['v2','v3'],gc:'Owns the customer experience of the quoting product; keeps the AI-drafted quote honest and clear.'}
  };
  (data.orgChart||[]).forEach(function(r){
    var t=_seedTags[r.id];
    if(t){r.taggedValues=t.vals.slice();r.guidingConcepts=t.gc;}
  });
  // Ownership: the CITO is the AI-transformation owner added via the Ownership flow.
  // ownerRoleId points at the CITO *role* on the chart (untethered-role model);
  // the ownership tab reads this to show the role as already added to the chart.
  data.structure.ownerRoleId='ldr_seed_cito';
  // Board membership: CEO + CAIO + CITO sit on the board, plus an external non-exec director.
  var _boardRole=(data.orgChart||[]).find(function(r){return r.id==='board';});
  if(_boardRole){
    _boardRole.members=[
      {type:'leader',id:'seed_ceo',aiExpertise:'Led the enterprise AI adoption decision; fluent in the strategic and investment case, and relies on the CAIO for technical depth.'},
      {type:'leader',id:'seed_caio',aiExpertise:'Deep technical AI expertise \u2014 model risk, data quality, and deployment architecture; the board\u2019s credible challenge on technical claims.'},
      {type:'leader',id:'seed_cito',aiExpertise:'Owns the cultural and organizational dimensions of the AI transition; expertise in change management and workforce impact.'},
      {type:'external',name:'Margaret Iyer',title:'Non-Executive Director \u2014 former CEO, industrial manufacturing',aiExpState:'no'}
    ];
  }
  // Council: coordMechanism is 'council', so create the node and staff it.
  syncCouncilNode();
  var _councilRole=(data.orgChart||[]).find(function(r){return r.id==='crossfunc';});
  if(_councilRole){
    _councilRole.members=[
      {type:'leader',id:'seed_caio'},
      {type:'leader',id:'seed_cito'},
      {type:'leader',id:'seed_coo'},
      {type:'leader',id:'seed_cfo'},
      {type:'leader',id:'seed_cmo'},
      {type:'leader',id:'seed_vphr'}
    ];
    _councilRole.guidingConcepts='Cross-functional body where operations, finance, marketing, and people decide together; chaired by the CAIO with the CITO owning the cultural mandate.';
    _councilRole.taggedValues=['v1','v4'];
  }

  // Push the seeded roster into USERS and sign in as the facilitator, so the session
  // reflects the new team immediately (no reload needed). applyTeamRoster reads
  // data.roster as the source of truth.
  if(typeof applyTeamRoster==='function')applyTeamRoster();
  Auth.setSession('u_fac');

  saveData();
  go('readiness');
}

function orgLevelColor(lv) { return lv === 0 ? '#4E7FA6' : lv === 1 ? '#6B4C8A' : lv === 2 ? '#4E7FA6' : lv === 3 ? '#2D5A8E' : '#8B5E3C' }
function layoutOrgTreeForPaper(roles,pageW,pageH){return layoutOrgTreeFitted(roles,pageW,pageH,{BW:170,BH:70,GX:16,GY:44,IND:14,GYH:10,FW:190})} /* paper geometry: narrower boxes and gaps than the screen's, since names wrap to two lines; width is the binding constraint on a landscape page */
function layoutOrgTreeScreen(roles){return layoutOrgTreeFitted(roles,1000,650,{BW:180,BH:76,GX:24,GY:48,IND:20,GYH:12,FW:220})} /* 16 Sep 2026 (Paul's ruling): the screen charts take the same shape as the paper chart — the same page-shaped target chooses the same variant — with the screen's box geometry */
function orgNameLines(name,maxC){var words=String(name||'').split(/\s+/),l1='',l2='';words.forEach(function(wd){if(!l2&&(l1+' '+wd).trim().length<=maxC)l1=(l1+' '+wd).trim();else l2=(l2+' '+wd).trim()});if(l2.length>maxC)l2=l2.substring(0,maxC-1)+'\u2026';return [l1,l2]} /* a role name on up to two lines within a character budget; one definition for the paper builder and both screen charts */
function layoutOrgTreeFitted(roles,pageW,pageH,g){ /* 16 Sep 2026 (Paul's ruling): the chart fitted to a page shape. The upper tiers keep the row layout; from a chosen depth down, nodes hang vertically under their parent, indented, as org-chart tools do for the lowest tiers; floating bodies (level 0) tuck into the free space beside the top tier when it fits; of the variants (no hanging, or hanging from each depth), the one that prints largest on the page wins */
  var BW=g.BW,BH=g.BH,GX=g.GX,GY=g.GY,IND=g.IND,GYH=g.GYH,FW=g.FW;
  var treeRoles=roles.filter(function(r){return r.level!==0}),floats=roles.filter(function(r){return r.level===0});
  var cm={};treeRoles.forEach(function(r){var p=(r.parentId&&treeRoles.some(function(x){return x.id===r.parentId}))?r.parentId:'__r';(cm[p]=cm[p]||[]).push(r.id)});
  var roots=cm.__r||[];var depthOf={};function setDepth(id,d){depthOf[id]=d;(cm[id]||[]).forEach(function(c){setDepth(c,d+1)})}roots.forEach(function(r){setDepth(r,0)});
  var maxDepth=0;Object.keys(depthOf).forEach(function(k){if(depthOf[k]>maxDepth)maxDepth=depthOf[k]});
  function build(hangFrom){var pos={},lines=[],w={};
    function hangParent(id){return hangFrom!==null&&(cm[id]||[]).length>0&&depthOf[id]+1>=hangFrom}
    function hangDepth(id){var d=0;(cm[id]||[]).forEach(function(c){d=Math.max(d,1+hangDepth(c))});return d}
    function hangH(id){var h=0;(cm[id]||[]).forEach(function(c){h+=GYH+BH+hangH(c)});return h}
    function sw(id){if(w[id]!==undefined)return w[id];var k=cm[id]||[];if(!k.length){w[id]=BW;return BW}if(hangParent(id)){w[id]=IND*hangDepth(id)+BW;return w[id]}var t=k.reduce(function(a,c){return a+sw(c)+GX},-GX);w[id]=Math.max(BW,t);return w[id]}
    function placeHang(id,x,y){var k=cm[id]||[];var cy=y+BH+GYH;var sx=x+IND/2;var last=null;k.forEach(function(c){pos[c]={x:x+IND,y:cy,w:BW,h:BH};var mid=cy+BH/2;lines.push('M'+sx+','+mid+' L'+(x+IND)+','+mid);last=mid;placeHang(c,x+IND,cy);cy+=BH+hangH(c)+GYH});if(last!==null)lines.push('M'+sx+','+(y+BH)+' L'+sx+','+last)}
    function place(id,x,y){var ww=sw(id);if(hangParent(id)){pos[id]={x:x,y:y,w:BW,h:BH};placeHang(id,x,y);return}pos[id]={x:x+ww/2-BW/2,y:y,w:BW,h:BH};var k=cm[id]||[];var cx=x;k.forEach(function(c){place(c,cx,y+BH+GY);cx+=sw(c)+GX})}
    var rx=0;roots.forEach(function(r){place(r,rx,0);rx+=sw(r)+GX*2});
    treeRoles.forEach(function(r){var k=cm[r.id]||[];if(!k.length||hangParent(r.id)||!pos[r.id])return;var p=pos[r.id],px=p.x+p.w/2,py=p.y+p.h;var kids=k.map(function(id){return pos[id]});var my=py+(kids[0].y-py)/2;lines.push('M'+px+','+py+' L'+px+','+my);var xs=kids.map(function(c){return c.x+c.w/2});var mn=Math.min.apply(null,xs.concat([px])),mx=Math.max.apply(null,xs.concat([px]));if(mx>mn)lines.push('M'+mn+','+my+' L'+mx+','+my);kids.forEach(function(c){var cx=c.x+c.w/2;lines.push('M'+cx+','+my+' L'+cx+','+c.y)})});
    var all=Object.keys(pos).map(function(k){return pos[k]});var treeMaxX=all.length?Math.max.apply(null,all.map(function(p){return p.x+p.w})):0;
    /* floats: the free space beside the top tier, right-aligned within the tree's width; else beside the tree */
    var rowsY=[];all.forEach(function(p){if(rowsY.indexOf(p.y)<0)rowsY.push(p.y)});rowsY.sort(function(a,b){return a-b});
    var rightX=treeMaxX;var tiers=rowsY.slice(0,2).reverse();
    floats.forEach(function(fr){var placed=false;for(var t=0;t<tiers.length&&!placed;t++){var y=tiers[t];var occ=all.filter(function(p){return p.y<y+BH&&p.y+p.h>y});var free=occ.length?Math.max.apply(null,occ.map(function(p){return p.x+p.w}))+GX*2:0;var x=rightX-FW;if(x>=free){pos[fr.id]={x:x,y:y,w:FW,h:BH,floating:true};rightX=x-GX;placed=true}}
      if(!placed){pos[fr.id]={x:treeMaxX+GX*2,y:rowsY[0]||0,w:FW,h:BH,floating:true};treeMaxX+=FW+GX*2}});
    all=Object.keys(pos).map(function(k){return pos[k]});var tw=all.length?Math.max.apply(null,all.map(function(p){return p.x+p.w}))+40:400,th=all.length?Math.max.apply(null,all.map(function(p){return p.y+p.h}))+40:300;
    return {pos:pos,lines:lines,tw:tw,th:th,treeW:treeMaxX+40,hangFrom:hangFrom,scale:Math.min(pageW/(tw+40),pageH/(th+40))}}
  var best=build(null);for(var d=maxDepth;d>=2;d--){var v=build(d);if(v.scale>best.scale+1e-9)best=v}
  return best}
function layoutOrgTree(roles) {
  var BW = 180, BH = 76, GX = 24, GY = 48;
  // Separate floating roles (level 0 = cross-functional) from tree roles
  var treeRoles = roles.filter(function (r) { return r.level !== 0 });
  var floatRoles = roles.filter(function (r) { return r.level === 0 });
  var cm = {}; treeRoles.forEach(function (r) { var p = r.parentId || '__r'; if (!cm[p]) cm[p] = []; cm[p].push(r.id) });
  var w = {};
  function sw(id) { if (w[id] !== undefined) return w[id]; var k = cm[id] || []; if (!k.length) { w[id] = BW; return BW } var t = k.reduce(function (s, c) { return s + sw(c) + GX }, -GX); w[id] = Math.max(BW, t); return w[id] }
  var pos = {};
  function pl(id, x, y) { var ww = sw(id); pos[id] = { x: x + ww / 2 - BW / 2, y: y, w: BW, h: BH }; var k = cm[id] || []; var cx = x; k.forEach(function (c) { pl(c, cx, y + BH + GY); cx += sw(c) + GX }) }
  var roots = treeRoles.filter(function (r) { return !r.parentId || !treeRoles.find(function (p) { return p.id === r.parentId }) });
  var rx = 0; roots.forEach(function (r) { sw(r.id); pl(r.id, rx, 0); rx += sw(r.id) + GX * 2 });
  // Position floating roles: between level 1 (y=0) and level 2 (y=BH+GY), offset to the right
  var ap = Object.keys(pos).map(function (k) { return pos[k] });
  var maxX = ap.length ? Math.max.apply(null, ap.map(function (p) { return p.x + p.w })) : 0;
  var _treeMaxX = maxX;
  floatRoles.forEach(function (fr, fi) {
    pos[fr.id] = { x: maxX + GX * 2, y: BH / 2 + GY / 4, w: BW + 40, h: BH, floating: true };
    maxX += BW + 40 + GX;
  });
  var lines = [];
  // One trunk, one bus, one drop per child (ruled 16 July): the old per-child elbows
  // overdrew the shared segments, and the alpha stroke compounded into thicker lines.
  var kidsBy = {};
  treeRoles.forEach(function (r) {
    if (r.parentId && pos[r.parentId] && pos[r.id]) { (kidsBy[r.parentId] = kidsBy[r.parentId] || []).push(r.id); }
  });
  Object.keys(kidsBy).forEach(function (pid) {
    var p = pos[pid]; var px = p.x + p.w / 2, py = p.y + p.h;
    var kids = kidsBy[pid].map(function (id) { return pos[id] });
    var my = py + ((kids[0].y - py) / 2);
    lines.push('M' + px + ',' + py + ' L' + px + ',' + my);
    var xs = kids.map(function (c) { return c.x + c.w / 2 });
    var minX = Math.min.apply(null, xs.concat([px])), maxX = Math.max.apply(null, xs.concat([px]));
    if (maxX > minX) lines.push('M' + minX + ',' + my + ' L' + maxX + ',' + my);
    kids.forEach(function (c) { var cx2 = c.x + c.w / 2; lines.push('M' + cx2 + ',' + my + ' L' + cx2 + ',' + c.y) });
  });
  ap = Object.keys(pos).map(function (k) { return pos[k] });
  var tw = ap.length ? Math.max.apply(null, ap.map(function (p) { return p.x + p.w })) + 40 : 400;
  var th = ap.length ? Math.max.apply(null, ap.map(function (p) { return p.y + p.h })) + 40 : 300;
  return { pos: pos, lines: lines, tw: tw, th: th, treeW: _treeMaxX + 40 };
}

// Dashboard-style interactive org chart: zoom controls, SVG with clickable boxes,
// empty state, and the click-to-select detail/edit panel. Extracted so both the
// Lead dashboard and the ownership flow render the same chart (click a box to view
// it and assign an occupant). Returns an HTML string.
// ── Fullscreen-aware org-chart interaction ──────────────────────────────────
// In fullscreen, the Fullscreen API renders ONLY the fullscreened element and its
// descendants, and a normal render() (which rebuilds the whole page) would drop us
// out of fullscreen. So while fullscreen is active we update the chart in place and
// host the selected-role detail as an overlay INSIDE the chart wrapper (bottom-right).
function orgFullscreenEl() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function orgIsFullscreen() {
  var fe = orgFullscreenEl();
  return !!(fe && (fe.id === 'orgChartWrap' || fe.id === 'llChartWrap'));
}
// Box click: toggle selection. Out of fullscreen -> normal global render(). In
// fullscreen -> repaint the chart wrapper in place and refresh the overlay, so we
// stay fullscreen and the clicked box's detail shows at bottom-right.
function orgBoxClick(id) {
  UI.orgSelected = (UI.orgSelected === id ? null : id);
  UI.orgEditId = null;
  if (orgIsFullscreen()) { orgRepaintInPlace(); }
  else { render(); }
}
// Re-render just the chart wrapper's contents (SVG + overlay) without touching the
// rest of the page, preserving fullscreen. Reads the same data the dashboard uses.
function orgRepaintInPlace() {
  var wrap = document.getElementById('orgChartWrap') || document.getElementById('llChartWrap');
  if (!wrap) return;
  var roles = (data.orgChart || []); var leaders = (data.leaders || []);
  wrap.innerHTML = orgChartInnerSvg(roles, leaders, !!(wrap.classList && wrap.classList.contains('org-board-canvas'))) + orgFullscreenOverlay(roles, leaders);
}
// The SVG markup for the chart body (no wrapper div), shared by the normal render
// and the in-place fullscreen repaint so the two never diverge.
function orgChartNodeSvg(r,p,opts){opts=opts||{}; /* 16 Sep 2026 (Paul's ruling): one node for both screen charts — the dashboard's box, drawn by the 1.2 reporting-lines chart too. Every box takes the 3px corner; the 8px corner the floating body (and every 1.2 box) had let the square-cornered top bar overhang it */
    var isBoard=r.level===1;
    var leader=isBoard?null:roleOccupant(r);
    var mc=(r.members||[]).length;
    var col=orgLevelColor(r.level);
    var isSel=!!opts.selected;
    var lName=leader?(leader.name.length>20?leader.name.substring(0,18)+'\u2026':leader.name):isBoard?(mc+' member'+(mc!==1?'s':'')):'Unassigned';
    var initials=leader?leader.name.split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase():isBoard?String(mc):'\u2014';
    var circCol=leader?col:isBoard&&mc?col:'rgba(138,130,120,.2)';
    var txtCol=leader||isBoard&&mc?'#d4cfca':'rgba(138,130,120,.5)';
    var isFloat=p.floating;
    var h=opts.interactive?'<g onclick="orgBoxClick(\''+r.id+'\')" style="cursor:pointer">':'<g>';
    h+='<title>'+esc(r.name)+' \u2013 '+esc(leader?leader.name:(isBoard?(mc+' member'+(mc!==1?'s':'')):'Unassigned'))+'</title>';
    h+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="3" fill="'+(isSel?'rgba(245,242,236,.08)':'rgba(26,22,18,.95)')+'" stroke="'+(isSel?col:isFloat?'rgba(78,127,166,.4)':'rgba(245,242,236,.15)')+'" stroke-width="'+(isSel?'2.5':isFloat?'2':'1')+'"'+(isFloat?' stroke-dasharray="6,3"':'')+'"/>';
    h+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="4" fill="'+(isFloat?'#4E7FA6':col)+'"/>';
    var nl=orgNameLines(r.name,22),two=!!nl[1];var rowY=two?58:52;
    if(two)h+='<text x="'+(p.x+14)+'" y="'+(p.y+20)+'" fill="#F5F2EC" font-size="12" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(nl[0])+'</text><text x="'+(p.x+14)+'" y="'+(p.y+34)+'" fill="#F5F2EC" font-size="12" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(nl[1])+'</text>';
    else h+='<text x="'+(p.x+14)+'" y="'+(p.y+24)+'" fill="#F5F2EC" font-size="12" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(nl[0])+'</text>';
    h+='<circle cx="'+(p.x+22)+'" cy="'+(p.y+rowY)+'" r="12" fill="'+circCol+'"/>';
    h+='<text x="'+(p.x+22)+'" y="'+(p.y+rowY+4)+'" fill="'+(leader||isBoard&&mc?'#fff':'#666')+'" font-size="9" font-weight="700" text-anchor="middle" font-family="monospace">'+esc(initials)+'</text>';
    h+='<text x="'+(p.x+40)+'" y="'+(p.y+rowY+4)+'" fill="'+txtCol+'" font-size="11" font-family="Helvetica Neue,sans-serif"'+(leader||isBoard&&mc?'':' font-style="italic"')+'>'+esc(lName)+'</text>';
    if((r.taggedValues||[]).length)h+='<circle cx="'+(p.x+p.w-10)+'" cy="'+(p.y+10)+'" r="3" fill="#4E7FA6" opacity="0.7"/>';
    return h+'</g>'}
// The SVG markup for the chart body (no wrapper div), shared by the normal render
// and the in-place fullscreen repaint so the two never diverge.
function orgChartInnerSvg(roles,leaders,fit){
  var layout=layoutOrgTreeScreen(roles);var pos=layout.pos; /* 16 Sep 2026 (Paul's ruling): the fitted layout — hanging lower tiers, tucked floats — and names on two lines, as on paper */
  if(!UI.orgZoom)UI.orgZoom=1;
  var natW=layout.tw+40,natH=layout.th+40;var h;
  // Symmetric framing (ruled 16 July): floating roles extend the canvas rightward, which
  // pulled the tree left of the board's center. Mirror the float zone on the left of the
  // viewBox so the Board/CEO trunk sits dead center; with no floats this is a no-op.
  var _fz=Math.max(0,layout.tw-(layout.treeW||layout.tw));var _vx=-20-_fz,_vw=natW+_fz;
  if(fit&&Math.abs(UI.orgZoom-1)<0.01){
    // Org Board fit (ruled 16 July): CSS-sized SVG — fills the board width up to natural
    // size, floored at 0.55 so nodes stay readable; below the floor the canvas pans.
    // The manual chart zoom (+/- buttons) overrides fit until zoom returns to 1.
    h='<svg style="width:100%;max-width:'+_vw+'px;min-width:'+Math.round(_vw*0.55)+'px;height:auto;display:block;margin:0 auto" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }else{
    var zw=Math.round(_vw*UI.orgZoom);var zh=Math.round(natH*UI.orgZoom);
    h='<svg width="'+zw+'" height="'+zh+'" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }
  layout.lines.forEach(function(d){h+='<path d="'+d+'" fill="none" stroke="rgba(245,242,236,.18)" stroke-width="1.5"/>'});
  roles.forEach(function(r){var p=pos[r.id];if(!p)return;h+=orgChartNodeSvg(r,p,{interactive:true,selected:UI.orgSelected===r.id})});
  h+='</svg>';
  return h;
}
// Bottom-right detail overlay shown only while fullscreen is active. Mirrors the
// selected role's key facts and offers the same actions (assign occupant / edit /
// close) without leaving fullscreen.
function orgFullscreenOverlay(roles, leaders) {
  if (!orgIsFullscreen() || !UI.orgSelected) return '';
  var r = (roles || []).find(function (x) { return x.id === UI.orgSelected });
  if (!r) return '';
  var isBoard = r.level === 1;
  var occ = isBoard ? null : roleOccupant(r);
  var col = orgLevelColor(r.level);
  var occName = occ ? occ.name : (isBoard ? ((r.members || []).length + ' member' + (((r.members || []).length) !== 1 ? 's' : '')) : 'Unassigned');
  // Occupant assignment dropdown (non-board): same setter as the normal detail panel.
  var assignCtl = '';
  if (!isBoard) {
    var _optStyle = ' style="background-color:var(--bg-elev);color:var(--paper)"';  // theme tokens (ruled 25 July): the hardcoded dark ground was invisible in light mode
    var opts = '<option value=""' + _optStyle + '>\u2014 vacant \u2014</option>';
    (leaders || []).forEach(function (l) {
      opts += '<option value="' + esc(l.id) + '"' + ((r.occupantLeaderId || (occ || {}).id) === l.id ? ' selected' : '') + _optStyle + '>' + esc(l.name) + '</option>';
    });
    assignCtl = '<div style="margin-top:10px"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Occupied by</div>'
      + '<select id="or_qafs_' + r.id + '" onchange="quickAssignOrg(\'' + r.id + '\',this.value);orgRepaintInPlace()" style="width:100%;padding:8px 10px;background:rgba(var(--fg-rgb),.05);color:var(--paper);border:1px solid ' + (occ ? 'rgba(27,107,90,.4)' : 'rgba(var(--fg-rgb),.2)') + ';border-radius:6px;font-size:13px;font-family:var(--sans)">' + opts + '</select></div>';
    // Reports To (ruled 25 July): the same quick control the 1.2 role rows carry, on the
    // fullscreen panel. assignRoleParent brings the reporting-loop alert and level recompute.
    var popts2 = '<option value="board"' + _optStyle + ((!r.parentId || r.parentId === 'board') ? ' selected' : '') + '>Board (top level)</option>';
    (roles || []).forEach(function (o) {
      if (o.id === r.id || o.id === 'board') return;
      popts2 += '<option value="' + esc(o.id) + '"' + _optStyle + (r.parentId === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>';
    });
    assignCtl += '<div style="margin-top:10px"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Reports to</div>'
      + '<select id="or_qparfs_' + r.id + '" onchange="assignRoleParent(\'' + r.id + '\',this.value);orgRepaintInPlace()" style="width:100%;padding:8px 10px;background:rgba(var(--fg-rgb),.05);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.2);border-radius:6px;font-size:13px;font-family:var(--sans)">' + popts2 + '</select></div>'
      // Fullscreen zoom (ruled 25 July): the page board's lever (UI.orgZoom), repaint-in-place.
      + '<div style="display:flex;align-items:center;gap:6px;margin-top:10px">' + '<button onclick="UI.orgZoom=Math.min(2,(UI.orgZoom||1)+0.2);orgRepaintInPlace();var z=document.getElementById(\'orgFsZoomPct\');if(z)z.textContent=Math.round(UI.orgZoom*100)+\'%\'" title="Zoom in" style="width:32px;height:32px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:18px;cursor:pointer;font-family:var(--sans)">+</button>' + '<button onclick="UI.orgZoom=Math.max(0.3,(UI.orgZoom||1)-0.2);orgRepaintInPlace();var z=document.getElementById(\'orgFsZoomPct\');if(z)z.textContent=Math.round(UI.orgZoom*100)+\'%\'" title="Zoom out" style="width:32px;height:32px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:18px;cursor:pointer;font-family:var(--sans)">&minus;</button>' + '<button onclick="UI.orgZoom=1;orgRepaintInPlace();var z=document.getElementById(\'orgFsZoomPct\');if(z)z.textContent=\'100%\'" title="Reset to 100%" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono)">Reset</button>' + '<span id="orgFsZoomPct" style="font-family:var(--mono);font-size:11px;color:var(--stone)">' + Math.round((UI.orgZoom || 1) * 100) + '%</span></div>';
  }
  var tagged = (r.taggedValues || []).length;
  var h = '<div id="orgFsOverlay" style="position:fixed;right:24px;bottom:24px;width:320px;max-width:42vw;max-height:70vh;overflow:auto;background:var(--bg-elev);border:1px solid ' + col + ';border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.5);padding:18px;z-index:2147483647">';
  h += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px">';
  h += '<div style="flex:1"><div style="font-family:var(--mono);font-size:9px;color:' + col + ';text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">' + (isBoard ? 'Governance' : 'Role') + '</div>';
  h += '<div style="font-size:16px;font-weight:700;color:var(--paper);line-height:1.25">' + esc(isBoard ? 'Board' : (r.name || 'Role')) + '</div></div>';
  h += '<button onclick="UI.orgSelected=null;orgRepaintInPlace()" title="Close" style="background:none;border:none;color:var(--stone);font-size:20px;line-height:1;cursor:pointer;padding:0 2px">\u00D7</button>';
  h += '</div>';
  h += '<div style="font-size:13px;color:var(--text-body);margin-bottom:4px">' + esc(occName) + '</div>';
  if (tagged) h += '<div style="font-family:var(--mono);font-size:10px;color:var(--gold);margin-bottom:4px">' + tagged + ' value' + (tagged !== 1 ? 's' : '') + ' tagged</div>';
  h += assignCtl;
  h += '<div style="margin-top:12px;font-size:11px;color:var(--stone);line-height:1.5;border-top:1px solid rgba(var(--fg-rgb),.08);padding-top:10px">Exit fullscreen for the full detail panel, value tagging, and role editing.</div>';
  h += '</div>';
  return h;
}
function renderOrgChartInteractive(roles, leaders) {
  roles = roles || []; leaders = leaders || [];
  var layout = layoutOrgTreeScreen(roles); /* 16 Sep 2026: the fitted layout the chart draws, so Fit-to-window measures the right width */ var pos = layout.pos;
  var h = '';
  /* Item-11 (F-10, ruled 27 July): a chart holding only the auto-injected board placeholder
     counts as empty — the guidance card shows; the placeholder injection is untouched. */
  var _realRoles = roles.filter(function (r) { return r.id !== 'board'; });
  // SVG org chart (only when real roles exist; empty state handled below)
  if (_realRoles.length) {
    // Zoom controls
    if (!UI.orgZoom) UI.orgZoom = 1;
    h += '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">';
    h += '<button onclick="UI.orgZoom=Math.min(2,UI.orgZoom+0.2);render()" title="Zoom in" style="width:32px;height:32px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:18px;cursor:pointer;font-family:var(--sans)">+</button>';
    h += '<button onclick="UI.orgZoom=Math.max(0.3,UI.orgZoom-0.2);render()" title="Zoom out" style="width:32px;height:32px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:18px;cursor:pointer;font-family:var(--sans)">&minus;</button>';
    h += '<button onclick="UI.orgZoom=1;render()" title="Reset to 100%" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono)">Reset</button>';
    h += '<span style="font-family:var(--mono);font-size:11px;color:var(--stone)">' + Math.round(UI.orgZoom * 100) + '%</span>';
    h += '<button onclick="var tw=' + (layout.tw + 40) + ';var el=document.getElementById(\'orgChartWrap\');var cw=(el?el.clientWidth:900)-48;UI.orgZoom=Math.min(1,cw/tw);render()" title="Fit chart to window" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono)">Fit</button>';
    h += '<button onclick="var el=document.getElementById(\'orgChartWrap\');if(el){if(el.requestFullscreen)el.requestFullscreen();else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();else if(el.msRequestFullscreen)el.msRequestFullscreen()}" title="View the chart fullscreen" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono);letter-spacing:.06em">\u26F6 FULLSCREEN</button>';
    h += orgSavedStatesControls();
    h += '</div>';
    h += '<div class="org-board">';
    // The key lives on the board, top-left (ruled 16 July). Serves every board host.
    h += '<div class="org-board-legend">';
    [{ n: 1, l: 'Board', c: '#6B4C8A' }, { n: 2, l: 'C-Suite', c: '#4E7FA6' }, { n: 3, l: 'Senior', c: '#2D5A8E' }, { n: 4, l: 'Middle Mgmt', c: '#8B5E3C' }, { n: 0, l: 'Cross-Functional', c: '#4E7FA6' }].forEach(function (lv) {
      h += '<div style="display:flex;align-items:center;gap:5px"><div style="width:8px;height:8px;border-radius:4px;background:' + lv.c + '"></div><span style="font-family:var(--mono);font-size:9px;color:var(--text-body)">' + lv.l + '</span></div>';
    });
    h += '</div>';
    h += '<div id="orgChartWrap" class="org-board-canvas">';
    h += orgChartInnerSvg(roles, leaders, true);
    h += orgFullscreenOverlay(roles, leaders);
    h += '</div></div>';
  } else {
    h += '<div style="border:1px solid rgba(var(--fg-rgb),.06);background:rgba(0,0,0,.2);padding:64px 32px;display:flex;align-items:center;justify-content:center;min-height:280px">';
    h += '<div style="max-width:440px;text-align:center">';
    h += '<div style="font-size:32px;margin-bottom:16px;opacity:.5">\u229E</div>';
    h += '<div style="font-family:var(--serif);font-size:20px;font-weight:300;color:var(--paper);margin-bottom:10px">Your org chart is empty</div>';
    h += '<div style="font-size:14px;color:var(--text-body);line-height:1.6">It builds automatically from your module work. In the <strong style="color:var(--paper)">Leadership Landscape</strong>, map your leaders and set their reporting lines on the <strong style="color:var(--paper)">Assign Hierarchy</strong> tab. You can also <strong style="color:var(--paper)">+ Add Role</strong> here to edit the chart directly.</div>';
    h += '</div></div>';
  }
  // Detail panel for selected role (click a box to view it and assign an occupant)
  if (UI.orgSelected && !UI.orgEditId) {
    var sr = roles.find(function (r) { return r.id === UI.orgSelected });
    if (sr) h += renderOrgDetail(sr, roles, leaders);
  }
  if (UI.orgEditId) {
    var er = roles.find(function (r) { return r.id === UI.orgEditId });
    if (er) h += '<div id="orgEditCard">' + renderOrgForm(er, roles, leaders) + '</div>';
  }
  return h;
}

function renderDashboardBody(){
  // Init: no auto-seeding. The chart reflects only the user's own work (manual
  // edits, "Seed from Module", or the full "Seed sample data" demo). An empty
  // chart stays empty and shows a guidance prompt below.
  var _leaders=data.leaders||[];
  var _chart=data.orgChart||[];
  // The council exists only if the user chose a council-type coordination mechanism.
  syncCouncilNode();
  // Reconcile the persistent role-chart (add roles for new leaders, remove for deleted,
  // reconcile occupants) on render — the Assign Hierarchy view does the same, so both
  // views of the one chart stay consistent.
  syncPhase1Chart();
  var roles=data.orgChart||[];var leaders=data.leaders||[];
  var layout=layoutOrgTreeScreen(roles);var pos=layout.pos;
  // Structural staffing snapshot for the stat strip. A "position" is a fillable role
  // on the chart, so the Board and the Cross-Functional Council (governance bodies, not
  // single-occupant roles) are excluded from the position counts. Vacant = positions
  // without an occupant; unassigned leaders = inventory people occupying no position.
  var positionRoles=roles.filter(function(r){return r.id!=='board'&&r.id!=='crossfunc';});
  var positionsTotal=positionRoles.length;
  var positionsFilled=positionRoles.filter(function(r){return roleHasOccupant(r);}).length;
  var positionsVacant=positionsTotal-positionsFilled;
  var unassignedLeaders=leaders.filter(function(l){return !leaderOccupiedRole(l);}).length;

  var h='<div class="content-area"><div class="content-inner board-page">';
  h+=backBtn();
  // Phase Five Lead overview video (exec-phase5.mp4 beside index.html)
  h+='<div class="overview-video-card mb-6"><div class="overview-video-label" style="color:#6B4C8A">Phase Five \u00b7 Lead</div>'
   +'<video class="overview-video" controls preload="auto" playsinline><source src="../../../assets/media/exec-readiness/exec-phase5.mp4" type="video/mp4">Your browser does not support embedded video.</video></div>';
  h+='<div class="step-header"><div class="step-eyebrow">Phase 5 \u00B7 Ongoing</div><h1 class="step-title">Leadership <em>Structure</em></h1></div>';
  // Stats — structural staffing snapshot (Positions / Filled / Vacant / Unassigned leaders)
  h+='<div style="display:flex;gap:1px;margin-bottom:24px;background:rgba(var(--gold-rgb),.25)">';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300">'+positionsTotal+'</div><div class="dash-stat-label">Positions</div></div>';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:'+(positionsFilled>0?'#1B6B5A':'var(--paper)')+'">'+positionsFilled+'</div><div class="dash-stat-label">Filled</div></div>';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:'+(positionsVacant>0?'#C08A2D':'var(--paper)')+'">'+positionsVacant+'</div><div class="dash-stat-label">Vacant</div></div>';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:'+(unassignedLeaders>0?'#C08A2D':'var(--paper)')+'">'+unassignedLeaders+'</div><div class="dash-stat-label">Unassigned leaders</div></div>';
  h+='</div>';
  // Toolbar
  h+='<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;justify-content:center">';
  h+=btn('+ Add Role','UI.orgAddForm=true;UI.orgEditId=null;UI.orgSelected=null;UI.scrollTo=\'orgAddCard\';render()','bp','font-size:12px;padding:8px 14px');
  h+=btn('+ Add New Leader','UI.addLeaderOpen=true;UI.editIdx=null;UI.scrollTo=\'addLeaderPanelCard\';render()','bp','font-size:12px;padding:8px 14px');
  h+=btn('\u2193 Save','saveOrgState()','bp','font-size:12px;padding:8px 14px');
  h+=lyDepthCtl()+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px;padding:8px 14px'); /* 16 Sep 2026 (Paul's ruling): the legacy print button gives way to the family's PDF control, with the Summary / Full toggle the document reads */
  h+='</div>';
  if(UI.addLeaderOpen)h+='<div id="addLeaderPanelCard">'+addLeaderPanel()+'</div>';
  // Add form at top
  if(UI.orgAddForm&&!UI.orgEditId){
    h+='<div id="orgAddCard">'+renderOrgForm(null,roles,leaders)+'</div>';
  }
  // Interactive org chart (clickable boxes -> select to view/assign). Shared helper.
  h+=renderOrgChartInteractive(roles,leaders);

  // Policies section
  var cl=data.collabLab||{};var mm=data.mmActivation||{};
  var hasPolicies=cl.aiFreeZones||cl.personaCustomer||cl.translators||mm.workflows;
  if(hasPolicies){
    h+='<div style="margin-top:32px"><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:16px">Policies & Principles</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    // AI-Free Zones
    if(cl.aiFreeZones){
      var afzOpen=UI.ctxOpen['pol_afz'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_afz\']=!UI.ctxOpen[\'pol_afz\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">AI-Free Zones</div><span style="color:var(--stone);font-size:11px">'+(afzOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(afzOpen)h+='<div style="padding:0 14px 14px;font-size:13px;color:var(--stone);line-height:1.6">'+esc(cl.aiFreeZones)+'</div>';
      h+='</div>';
    }
    // AI Persona Design
    if(cl.personaCustomer||cl.personaInternal){
      var apOpen=UI.ctxOpen['pol_persona'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_persona\']=!UI.ctxOpen[\'pol_persona\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">AI Persona Design</div><span style="color:var(--stone);font-size:11px">'+(apOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(apOpen)h+='<div style="padding:0 14px 14px;font-size:12px;color:var(--stone);line-height:1.6">'+(cl.personaCustomer?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Customer-facing:</strong> '+esc(cl.personaCustomer)+'</div>':'')+(cl.personaInternal?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Internal:</strong> '+esc(cl.personaInternal)+'</div>':'')+(cl.personaBoundaries?'<div><strong style="color:#9B2D3F">Boundaries:</strong> '+esc(cl.personaBoundaries)+'</div>':'')+'</div>';
      h+='</div>';
    }
    // Translation Layer
    if(cl.translators||cl.transProcesses){
      var tlOpen=UI.ctxOpen['pol_trans'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_trans\']=!UI.ctxOpen[\'pol_trans\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">Translation Layer</div><span style="color:var(--stone);font-size:11px">'+(tlOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(tlOpen)h+='<div style="padding:0 14px 14px;font-size:12px;color:var(--stone);line-height:1.6">'+(cl.translators?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Translators:</strong> '+esc(cl.translators)+'</div>':'')+(cl.transProcesses?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Processes:</strong> '+esc(cl.transProcesses)+'</div>':'')+(cl.transRisks?'<div><strong style="color:var(--gold)">Risks:</strong> '+esc(cl.transRisks)+'</div>':'')+'</div>';
      h+='</div>';
    }
    // MM Practice Principles
    if(mm.workflows&&mm.workflows.length||mm.humanOnly&&mm.humanOnly.length){
      var mpOpen=UI.ctxOpen['pol_mm'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_mm\']=!UI.ctxOpen[\'pol_mm\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">MM Practice Principles</div><span style="color:var(--stone);font-size:11px">'+(mpOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(mpOpen){
        h+='<div style="padding:0 14px 14px;font-size:12px;color:var(--stone);line-height:1.6">';
        if(mm.workflows)mm.workflows.forEach(function(w){h+='<div style="margin-bottom:6px;padding:6px 10px;border-left:2px solid #8B5E3C"><strong style="color:var(--paper)">'+esc(w.name)+'</strong>: AI: '+esc(w.aiRole||'')+' | Human: '+esc(w.humanRole||'')+'</div>'});
        if(mm.humanOnly&&mm.humanOnly.length){h+='<div style="margin-top:8px;font-family:var(--mono);font-size:9px;color:#1B6B5A;text-transform:uppercase;margin-bottom:4px">Human-Only Decisions</div>';mm.humanOnly.forEach(function(d){h+='<div style="margin-bottom:4px;padding:4px 10px;border-left:2px solid #1B6B5A">'+esc(d.decision)+'</div>'})}
        h+='</div>';
      }
      h+='</div>';
    }
    h+='</div></div>';
  }

  // Quick links
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px">';
  h+='<div style="border:2px solid #2D5A8E;padding:20px;cursor:pointer" onclick="go(\'5.2\')"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px">Collective</div><div style="font-family:var(--serif);font-size:20px;font-weight:300;margin-bottom:6px">L&D Hub</div><div style="color:#2D5A8E;font-size:14px">\u2192</div></div>';
  h+='<div style="border:2px solid #6B4C8A;padding:20px;cursor:pointer" onclick="go(\'5.3\')"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px">Individual</div><div style="font-family:var(--serif);font-size:20px;font-weight:300;margin-bottom:6px">My Development</div><div style="color:#6B4C8A;font-size:14px">\u2192</div></div>';
  h+='</div>';
  // Outputs
  h+='<div style="margin-top:24px"><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:12px">Program Outputs</div>';
  h+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
  for(var i=0;i<4;i++){(PH[i].outcomes||[]).forEach(function(o){
    h+='<div onclick="go(\''+o.id+'\')" style="padding:6px 12px;border:1px solid var(--rule);font-family:var(--mono);font-size:10px;color:var(--stone);cursor:pointer" onmouseover="this.style.borderColor=\'var(--gold)\';this.style.color=\'var(--paper)\'" onmouseout="this.style.borderColor=\'var(--rule)\';this.style.color=\'var(--stone)\'">\u2192 '+esc(o.name)+'</div>';
  })}
  h+='</div></div>';
  h+='</div></div>';return h;
}



function renderOrgDetail(r,roles,leaders,opts){var P=!!(opts&&opts.print); /* 16 Sep 2026 (Paul's ruling): print mode omits the direct reports and the middle-management categories */
  var isBoard=r.level===1;
  var leader=isBoard?null:roleOccupant(r);
  var cf=data.competencyFramework||{};var rv=data.leadershipReview||{};var ma=leader?((data.mindsetApp||{})[leader.id]||{}):{};
  var children=roles.filter(function(c){return c.parentId===r.id});
  var parentRole=r.parentId?roles.find(function(p){return p.id===r.parentId}):null;
  var col=orgLevelColor(r.level);
  var _allValues=(data.orgValues&&data.orgValues.length)?data.orgValues:[];
  var tagged=(r.taggedValues||[]).map(function(vid){return _allValues.find(function(v){return v.id===vid})}).filter(Boolean);
  var COMPS=[{id:'orchestration',n:'Orchestration'},{id:'philosophical',n:'Philosophical'},{id:'hybrid',n:'Hybrid Teams'},{id:'change',n:'Change'},{id:'composure',n:'Composure'},{id:'ecosystem',n:'Ecosystem'},{id:'emotional',n:'Emotional'}];
  var lvLabels={0:'Cross-Functional',1:'Board & Governance',2:'C-Suite & Transformation',3:'Senior Leadership',4:'Middle Management'};

  var h='<div style="margin-top:24px;border:2px solid '+col+';background:rgba(var(--fg-rgb),.02)">';
  // Header
  h+='<div style="padding:20px 24px;border-bottom:1px solid rgba(var(--fg-rgb),.06);display:flex;justify-content:space-between;align-items:flex-start">';
  h+='<div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:'+col+';text-transform:uppercase;margin-bottom:4px">'+(lvLabels[r.level]||'')+'</div>';
  h+='<div style="font-family:var(--serif);font-size:22px;font-weight:300;font-style:italic;margin-bottom:4px;color:var(--paper)">'+esc(r.name)+'</div>';
  if(parentRole)h+='<div style="font-size:12px;color:var(--text-body)">Reports to: '+esc(parentRole.name)+'</div>';
  h+='</div><div style="display:flex;gap:8px">';
  h+='<button onclick="UI.orgEditId=\''+r.id+'\';UI.orgAddForm=false;UI.scrollTo=\'orgEditCard\';render()" style="padding:6px 14px;font-size:11px;background:transparent;border:1px solid rgba(var(--fg-rgb),.12);color:var(--text-body);cursor:pointer;font-family:var(--mono)">Edit</button>';
  h+='<button onclick="UI.orgSelected=null;render()" title="Close" style="padding:6px 14px;font-size:11px;background:transparent;border:1px solid rgba(var(--fg-rgb),.12);color:var(--text-body);cursor:pointer;font-family:var(--mono)">\u00D7</button>';
  h+='</div></div>';
  h+='<div style="padding:24px">';
  // Board members
  if(isBoard&&(r.members||[]).length){
    var _mById={};(leaders||[]).forEach(function(l){if(l.id)_mById[l.id]=l;});
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:'+col+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Committee Members ('+r.members.length+')</div>';
    r.members.forEach(function(m){
      var isLeaderM=m.type==='leader';
      var ml=isLeaderM?(_mById[m.id]||(m.idx!==undefined?leaders[m.idx]:null)):null;
      var nm=isLeaderM?(ml?ml.name:'Leader'):m.name;
      var ti=isLeaderM?(ml?leaderRoleName(ml):'Internal'):(m.title||'External');
      var ini=(nm||'?').split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase();
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(var(--fg-rgb),.04)">';
      h+='<div style="width:28px;height:28px;border-radius:14px;background:'+(isLeaderM?'#1B6B5A':'#4E7FA6')+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:monospace;flex-shrink:0">'+esc(ini)+'</div>';
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--paper)">'+esc(nm)+'</div><div style="font-size:11px;color:var(--text-body)">'+esc(ti)+'</div>'+(m.aiExpertise?'<div style="font-size:11px;color:var(--text-body);margin-top:2px;line-height:1.5">'+esc(m.aiExpertise)+'</div>':'')+'</div>';
      h+='<div style="font-family:var(--mono);font-size:9px;padding:2px 8px;border:1px solid '+(isLeaderM?'rgba(27,107,90,.3)':'rgba(var(--gold-rgb),.3)')+';color:'+(isLeaderM?'#1B6B5A':'#4E7FA6')+'">'+(isLeaderM?'INTERNAL':'EXTERNAL')+'</div>';
      h+='</div>';
    });
    h+='</div>';
  }
  // Board enrichment from Structure Lab
  if(isBoard){
    var st=data.structure||{};var ev=data.evalSuccession||{};
    var boardFields=[
      {label:'Board AI Expertise',val:boardExpertiseSummary()||st.boardExpertise},
      {label:'Board Expertise Gaps',val:st.boardExpertiseGaps},
      {label:'Decisions Requiring Board Approval',val:st.boardDecisions},
      {label:'Board Education Plan',val:st.boardEducation},
      {label:'Board Fluency Requirements',val:ev.boardFluency}
    ].filter(function(f){return f.val});
    if(boardFields.length){
      h+='<div style="margin:12px 0 20px"><div style="font-family:var(--mono);font-size:10px;color:#6B4C8A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Board Summary</div>'; /* 16 Sep 2026 (Paul's ruling): Board Summary, not From Structure Lab; a little more room after the committee members */
      boardFields.forEach(function(f){
        h+='<div style="margin-bottom:8px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #6B4C8A"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:4px">'+esc(f.label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(f.val)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // Cross-functional enrichment from Structure Lab
  if(r.level===0){
    var st=data.structure||{};
    var cfFields=[
      {label:'Coordination Mechanism',val:st.coordMechanism?{council:'AI Transformation Council',epmo:'Enterprise PMO',matrix:'Matrix AI Leads',rotation:'Leadership Rotation',network:'Innovation Network'}[st.coordMechanism]||st.coordMechanism:''},
      {label:'Meeting Cadence & Participants',val:st.coordCadence},
      {label:'Conflict Resolution',val:st.coordConflict},
      {label:'Information Flows',val:st.coordInfo}
    ].filter(function(f){return f.val});
    if(cfFields.length){
      h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">'+esc(r.name)+' Summary</div>'; /* 16 Sep 2026 (Paul's ruling): the cross-functional body's title, then Summary */
      cfFields.forEach(function(f){
        h+='<div style="margin-bottom:8px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border-left:3px solid var(--gold)"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:4px">'+esc(f.label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(f.val)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // Quick assign (non-board)
  if(!isBoard){
    h+='<div style="margin-bottom:20px;display:flex;align-items:center;gap:12px"><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em">Assigned to</div>';
    h+='<select id="or_qadash_'+r.id+'" onchange="quickAssignOrg(\''+r.id+'\',this.value)" class="assign-sel" style="padding:6px 12px;background:rgba(var(--fg-rgb),.05);border:1px solid '+col+';color:var(--paper);font-size:13px;font-family:var(--sans)"><option value=""'+(r.assignedLeader===null||r.assignedLeader===undefined?' selected':'')+'>Unassigned</option>';
    leaders.forEach(function(l,i){h+='<option value="'+esc(l.id)+'"'+((r.occupantLeaderId||(roleOccupant(r)||{}).id)===l.id?' selected':'')+'>'+esc(l.name)+'</option>'});
    h+='</select>';
    if(leader)h+='<span style="font-size:13px;color:var(--paper);font-weight:600">'+esc(leaderRoleName(leader))+'</span>';
    h+='</div>';
  }
  // Guiding concepts
  if(r.guidingConcepts){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Guiding Concepts</div>';
    h+='<div style="font-size:14px;color:var(--paper);line-height:1.7;padding:14px 18px;background:rgba(var(--fg-rgb),.03);border-left:3px solid '+col+'">'+esc(r.guidingConcepts)+'</div></div>';
  }
  // Structure Lab enrichment for senior leadership (Option C: keyword match)
  if(r.level===3&&leader){
    var st=data.structure||{};var enrichLines=[];
    var searchName=leader.name;var searchRole=leaderRoleName(leader);
    ['seniorAccountability','seniorDecisionRights','seniorAlignment'].forEach(function(field){
      var text=st[field]||'';if(!text)return;
      var lines=text.split('\n');
      lines.forEach(function(line){
        if(line&&(line.indexOf(searchName)>=0||(searchRole&&line.indexOf(searchRole)>=0)))enrichLines.push({field:field,text:line.trim()});
      });
    });
    if(enrichLines.length){
      var fieldLabels={seniorAccountability:'Accountability',seniorDecisionRights:'Decision Rights',seniorAlignment:'Alignment'};
      h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:#2D5A8E;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">From Structure Lab</div>';
      enrichLines.forEach(function(el){
        h+='<div style="padding:8px 12px;margin-bottom:4px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #2D5A8E"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:2px">'+(fieldLabels[el.field]||el.field)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(el.text)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // MM enrichment from Structure Lab — the same three categories for every manager; omitted on paper (Paul's ruling, 16 Sep 2026)
  if(r.level===4&&!P){
    var st=data.structure||{};
    var mmFields=[
      {label:'Tasks to Automate',val:st.mmAutomate},
      {label:'Tasks to Augment',val:st.mmAugment},
      {label:'Tasks Remaining Human',val:st.mmHuman}
    ].filter(function(f){return f.val});
    if(mmFields.length){
      h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:#8B5E3C;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">From Structure Lab</div>';
      mmFields.forEach(function(f){
        h+='<div style="padding:8px 12px;margin-bottom:4px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #8B5E3C"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:2px">'+esc(f.label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(f.val)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // Tagged values
  if(tagged.length){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Values \u2014 Relevant to This Role</div>';
    tagged.forEach(function(v){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:4px;background:rgba(var(--fg-rgb),.03);border-left:3px solid '+(DOMAIN_COL[v.domain]||'#888')+'"><div style="font-size:13px;color:var(--paper);flex:1">'+esc(v.principle)+'</div><div style="font-family:var(--mono);font-size:9px;color:'+(DOMAIN_COL[v.domain]||'#888')+';text-transform:uppercase;letter-spacing:.1em">'+esc(v.domain)+'</div></div>';
    });
    h+='</div>';
  }
  // Leader competencies + review (non-board, assigned)
  if(!isBoard&&leader){
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">';
    h+='<div><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Competency Profile</div>';
    COMPS.forEach(function(c){
      var v=leader?(cf.scores||{})[leader.id+'_'+c.id]||0:0;
      var vc=v>=4?'#1B6B5A':v>=3?'#4E7FA6':v>0?'#9B2D3F':'#555';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="font-size:11px;color:var(--text-body);min-width:90px">'+c.n+'</div><div style="flex:1;height:5px;background:rgba(var(--fg-rgb),.06);border-radius:2px"><div style="height:100%;width:'+v*20+'%;background:'+vc+';border-radius:2px"></div></div><div style="font-family:var(--mono);font-size:11px;color:'+vc+';min-width:24px;text-align:right">'+(v||'\u2014')+'</div></div>';
    });
    h+='</div>';
    h+='<div><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Assessment & Review</div>';
    h+='<div style="font-size:13px;color:var(--text-body);line-height:2.4">Fluency: <strong style="color:var(--paper)">'+(leader.fluency||'\u2014')+'/5</strong><br>Engagement: <strong style="color:'+(leader.engagement==='active'?'#1B6B5A':'#4E7FA6')+'">'+(leader.engagement==='active'?'Active':leader.engagement==='developing'?'Developing':'Not yet')+'</strong><br>Scope: <strong style="color:var(--paper)">'+(leader.scope==='org'?'Organization-wide':leader.scope==='dept'?'Departmental':'Team')+'</strong>';
    var rvl=(rv.leaders||{})[leader.id];
    if(rvl){
      var ac={developed:'Developed',progressing:'Progressing',support:'Needs Support',hard:'Hard Conversation'};
      var acol={developed:'#1B6B5A',progressing:'#2D5A8E',support:'#4E7FA6',hard:'#9B2D3F'};
      h+='<br>Review: <strong style="color:'+(acol[rvl.assessment]||'var(--text-body)')+'">'+(ac[rvl.assessment]||'\u2014')+'</strong>';
      if(rvl.notes)h+='<div style="margin-top:8px;font-size:12px;color:var(--text-body);line-height:1.5;padding:8px 12px;background:rgba(var(--fg-rgb),.03);border-left:2px solid #4E7FA6">'+esc(rvl.notes)+'</div>';
    }
    h+='</div></div></div>';
  }
  // Philosophical commitments — collective from Step 3.4, individual from Step 3.5
  var collectiveCommitments=(data.valuesDiscussion||{}).collectiveCommitments;
  if(collectiveCommitments){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Collective Philosophical Commitments</div>';
    h+='<div style="font-size:13px;color:var(--paper);line-height:1.7;padding:14px 18px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #9B2D3F">'+esc(collectiveCommitments)+'</div></div>';
  }
  if(!isBoard&&leader&&ma.commitments){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Individual Commitments ('+esc(leader.name)+')</div>';
    h+='<div style="font-size:13px;color:var(--paper);line-height:1.7;padding:14px 18px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #8B5E3C">'+esc(ma.commitments)+'</div></div>';
  }
  // Direct reports — the chart shows them; omitted on paper (Paul's ruling, 16 Sep 2026)
  if(children.length&&!P){
    h+='<div><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Direct Reports ('+children.length+')</div>';
    children.forEach(function(c){
      var cl=roleOccupant(c);
      h+='<div onclick="event.stopPropagation();UI.orgSelected=\''+c.id+'\';UI.orgEditId=null;render()" title="Open this role" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(var(--fg-rgb),.04);cursor:pointer"><div style="display:flex;align-items:center;gap:8px"><div style="width:6px;height:6px;border-radius:3px;background:'+orgLevelColor(c.level)+'"></div><span style="font-size:13px;color:var(--paper);font-weight:600">'+esc(c.name)+'</span></div><span style="font-size:12px;color:var(--text-body)">'+(cl?esc(cl.name):'Unassigned')+'</span></div>';
    });
    h+='</div>';
  }
  h+='</div></div>';
  return h;
}

function renderOrgForm(role, roles, leaders) {
  var isEdit = role && role.id;
  var ed = role || { name: '', level: 2, parentId: '', occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: [] };
  var isBoard = (isEdit ? ed.level : 2) === 1;
  var h = '<div style="padding:24px;border:2px solid var(--gold);background:rgba(var(--fg-rgb),.03);margin:24px 0">';
  h += '<h3 class="h-sub-lg">' + (isEdit ? 'Edit: ' + esc(ed.name) : 'Add New Role') + '</h3>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';
  h += ta('Role title *', 'org_name', ed.name, 'e.g. Chief AI Officer', 1);
  // Level is not set by hand -- it derives from the role's reporting position
  // ("reports to"), so there is no manual level control here.
  h += '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';
  var _isLeaderBox = /^ldr_/.test(ed.id || '');
  var _parentOpts = roles.filter(function (r) {
    if (isEdit && r.id === ed.id) return false;            // can't report to self
    if (_isLeaderBox) { return r.id === 'board' || /^ldr_/.test(r.id); }  // leaders report to board or another leader only
    return true;                                     // non-leader roles may sit anywhere
  }).map(function (r) { return { v: r.id, l: r.name }; });
  if (!isBoard) h += sel('Reports to', 'org_parent', ed.parentId || '', [{ v: '', l: _isLeaderBox ? 'Board (top level)' : 'None (top level)' }].concat(_parentOpts));
  if (!isBoard) h += sel('Assigned leader', 'org_leader', (ed.occupantLeaderId || (roleOccupant(ed) || {}).id || ''), [{ v: '', l: 'Unassigned' }].concat(leaders.map(function (l, i) { return { v: l.id, l: l.name || 'Leader ' + (i + 1) } })));
  h += '</div>';
  h += ta('Guiding concepts', 'org_concepts', ed.guidingConcepts, 'Decision rights, collaboration model\u2026', 3);
  // Values tagging — draws on the principles defined in the Values Architecture step (3.4).
  h += '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:600;color:var(--text-body);margin-bottom:6px">Values Architecture \u2014 select relevant principles</label>';
  var _ovList = data.orgValues || [];
  if (!_ovList.length) {
    h += '<div style="font-size:12px;color:var(--text-body);line-height:1.6;padding:10px 12px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:6px">No organizational principles defined yet. Build them in the Values Architecture step (Phase 3), then return here to tag the ones relevant to this role.</div>';
  } else {
    _ovList.forEach(function (v) {
      var on = (ed.taggedValues || []).indexOf(v.id) >= 0;
      var _dc = DOMAIN_COL[v.domain] || '#888';
      h += '<div onclick="toggleOrgValue(\'' + v.id + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:4px;background:' + (on ? 'rgba(107,76,138,.1)' : 'transparent') + ';border:1px solid ' + (on ? _dc : 'rgba(var(--fg-rgb),.08)') + ';cursor:pointer">';
      h += '<div style="width:18px;height:18px;border-radius:3px;border:2px solid ' + (on ? _dc : 'rgba(var(--fg-rgb),.15)') + ';background:' + (on ? _dc : 'transparent') + ';color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (on ? '\u2713' : '') + '</div>';
      h += '<div><div style="font-size:12px;color:var(--paper)">' + esc(v.principle) + '</div>' + (v.domain ? '<div style="font-size:10px;color:' + _dc + ';text-transform:uppercase;font-family:var(--mono);letter-spacing:.1em">' + esc(v.domain) + '</div>' : '') + '</div></div>';
    });
  }
  h += '</div>';
  // Board member management (level 1 only)
  if (isEdit && isBoard) {
    var members = ed.members || [];
    // Board membership is the PRIMARY action when editing the board, so it gets its
    // own visually distinct panel, separated from the mechanical role fields above.
    h += '<div style="margin:20px 0 16px;padding:18px;border:1px solid rgba(27,107,90,.35);border-radius:10px;background:rgba(27,107,90,.06)">';
    h += '<div style="font-family:var(--serif);font-size:18px;font-weight:600;color:var(--paper);margin-bottom:2px">Board Members</div>';
    h += '<div style="font-size:12px;color:var(--text-body);margin-bottom:14px">Who sits on the board. Add leaders from your inventory, or add external (non-executive) members.</div>';
    // Current members
    if (members.length) {
      h += '<div style="font-family:var(--mono);font-size:9px;color:var(--text-body);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Current members</div>';
      h += '<div style="background:rgba(0,0,0,.18);border-radius:8px;padding:4px 10px;margin-bottom:16px">';
      members.forEach(function (m, mi) {
        var _eml = m.type === 'leader' ? ((leaders || []).filter(function (l) { return l.id === m.id; })[0] || (m.idx !== undefined ? leaders[m.idx] : null)) : null;
        var nm = m.type === 'leader' ? (_eml ? _eml.name : 'Leader') : m.name;
        var ti = m.type === 'leader' ? (_eml ? leaderRoleName(_eml) : 'Internal') : (m.title || 'External');
        h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:' + (mi < members.length - 1 ? '1px solid rgba(var(--fg-rgb),.06)' : 'none') + '">';
        h += '<div style="width:9px;height:9px;border-radius:5px;background:' + (m.type === 'leader' ? '#1B6B5A' : '#4E7FA6') + ';flex-shrink:0"></div>';
        h += '<span style="font-size:14px;color:var(--paper);flex:1;font-weight:500">' + esc(nm) + '</span>';
        h += '<span style="font-size:11px;color:var(--text-body)">' + esc(ti) + '</span>';
        h += '<button onclick="event.stopPropagation();removeBoardMember(\'' + ed.id + '\',' + mi + ')" title="Remove from this body" style="background:none;border:none;color:#9B2D3F;cursor:pointer;font-size:16px;padding:2px 8px;line-height:1">\u00D7</button>';
        h += '</div>';
      });
      h += '</div>';
    } else {
      h += '<div style="font-size:12px;color:var(--text-body);font-style:italic;margin-bottom:14px">No board members yet.</div>';
    }
    // Toggle leaders (larger, clearer chips)
    h += '<div style="font-family:var(--mono);font-size:9px;color:var(--text-body);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Add from your leaders</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">';
    leaders.forEach(function (l, i) {
      var isOn = members.some(function (m) { return m.type === 'leader' && m.id === l.id });
      h += '<button onclick="event.stopPropagation();toggleBoardLeader(\'' + ed.id + '\',\'' + l.id + '\')" title="' + (isOn ? 'Click to remove' : 'Click to add') + '" style="padding:7px 14px;font-size:12px;font-weight:600;background:' + (isOn ? 'rgba(27,107,90,.18)' : 'rgba(var(--fg-rgb),.04)') + ';border:1px solid ' + (isOn ? '#1B6B5A' : 'rgba(var(--fg-rgb),.14)') + ';border-radius:20px;color:' + (isOn ? '#3DA88E' : '#b8b2aa') + ';cursor:pointer;font-family:inherit">' + (isOn ? '\u2713 ' : '+ ') + esc((l.name || '').split(' ')[0]) + '</button>';
    });
    h += '</div>';
    // Add external
    h += '<div style="font-family:var(--mono);font-size:9px;color:var(--text-body);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Add an external member</div>';
    h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
    h += '<input id="org_extName" placeholder="External member name" style="flex:1;min-width:140px;padding:9px 10px;background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;color:var(--paper);font-size:13px;font-family:var(--sans)">';
    h += '<input id="org_extTitle" placeholder="Title / role" style="flex:1;min-width:120px;padding:9px 10px;background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;color:var(--paper);font-size:13px;font-family:var(--sans)">';
    h += btn('+ Add', 'addBoardMember(\'' + ed.id + '\',\'manual\',null,val(\'org_extName\'),val(\'org_extTitle\'))', 'bp', 'font-size:12px;padding:9px 14px');
    h += '</div>';
    h += '</div>';
  }
  // Save/cancel
  h += '<div style="display:flex;gap:12px">';
  h += btn('Save', 'saveOrgRole2(' + (isEdit ? '\'' + ed.id + '\'' : 'null') + ')', 'bp');
  h += btn('Cancel', 'UI.orgAddForm=false;UI.orgEditId=null;render()', 'bg2');
  if (isEdit) h += btn('Delete', 'deleteOrgRole2(\'' + ed.id + '\')', 'bg2', 'color:#9B2D3F');
  h += '</div></div>';
  return h;
}
var _orgTaggedValues = null;
function resetSessionBuffers() { _orgTaggedValues = null; } /* for sealSession (Part S): the role form's tagged-values buffer is cleared only by Save/Delete, so it would carry one organization's picks into the next */
// Directly toggle a value on a specific role's taggedValues (used by the compact
// per-role tagging list in the Values Architecture step). Independent of the
// edit-form's UI.orgEditId / _orgTaggedValues buffer so the two don't interfere.
function toggleRoleValue(roleId, vid) {
  if (lockBlocked('orgChart')) return;
  var r = (data.orgChart || []).find(function (x) { return x.id === roleId; });
  if (!r) return;
  if (!r.taggedValues) r.taggedValues = [];
  var idx = r.taggedValues.indexOf(vid);
  if (idx >= 0) r.taggedValues.splice(idx, 1); else r.taggedValues.push(vid);
  saveData(); render();
}
function toggleOrgValue(vid) {
  if (!_orgTaggedValues) {
    var role = UI.orgEditId ? (data.orgChart || []).find(function (r) { return r.id === UI.orgEditId }) : null;
    _orgTaggedValues = (role && role.taggedValues) ? role.taggedValues.slice() : [];
  }
  var idx = _orgTaggedValues.indexOf(vid);
  if (idx >= 0) _orgTaggedValues.splice(idx, 1); else _orgTaggedValues.push(vid);
  // Update the role in data immediately for re-render
  if (UI.orgEditId) {
    var r = (data.orgChart || []).find(function (x) { return x.id === UI.orgEditId });
    if (r) r.taggedValues = _orgTaggedValues.slice();
  }
  render();
}
// parentId mirrors it. Board/none -> 'board'; another leader-box -> that leader id.
function saveOrgRole2(existingId) {
  if (lockBlocked('orgChart')) return;
  harvestFields();
  var prev = existingId ? ((data.orgChart || []).find(function (x) { return x.id === existingId }) || {}) : {};
  var r = {
    id: existingId || uid(),
    name: val('org_name'),
    level: (prev && typeof prev.level === 'number') ? prev.level : 2,
    parentId: val('org_parent') || '',
    occupantLeaderId: val('org_leader') !== '' ? val('org_leader') : null,
    guidingConcepts: val('org_concepts') || '',
    taggedValues: _orgTaggedValues || [],
    members: existingId ? (prev.members || []) : [],
    source: prev.source || (/^ldr_/.test(existingId || '') ? 'leader' : undefined)
  };
  if (!r.name) return;
  // Reporting-loop guard (ruled 25 July): the edit form runs the same cycle check as the
  // on-chart Reports-to dropdowns. Without it a cyclic parent silently detached the whole
  // chain from the rendered tree; now it alerts and keeps the form open, like assignRoleParent.
  var _rb = {}; (data.orgChart || []).forEach(function (x) { _rb[x.id] = x; });
  if (roleParentWouldCycle(r.id, r.parentId, _rb)) { alert('That would create a reporting loop.'); return; }
  if (!data.orgChart) data.orgChart = [];
  if (existingId) { data.orgChart = data.orgChart.map(function (x) { return x.id === existingId ? r : x }) }
  else { data.orgChart.push(r) }
  // One occupant per leader: if this role now has an occupant, clear that leader out
  // of every OTHER role (the same guard the chart occupant dropdown uses). Without
  // this, assigning a leader here leaves them in their previous role too.
  if (r.occupantLeaderId) {
    data.orgChart.forEach(function (x) { if (x.id !== r.id && x.occupantLeaderId === r.occupantLeaderId) x.occupantLeaderId = null; });
  }
  // Reconcile board/occupant after an edit. parentId on the role is canonical for
  // reporting, so there is nothing to mirror back to the leader record.
  if (/^ldr_/.test(r.id)) {
    syncPhase1Chart();
  }
  _orgTaggedValues = null;
  UI.orgAddForm = false; UI.orgEditId = null; saveData(); render();
}
function deleteOrgRole2(id) {
  if (lockBlocked('orgChart')) return;
  if (!confirm('Delete this role?')) return;
  data.orgChart = (data.orgChart || []).filter(function (r) { return r.id !== id });
  (data.orgChart || []).forEach(function (r) { if (r.parentId === id) r.parentId = '' });
  _orgTaggedValues = null;
  UI.orgAddForm = false; UI.orgEditId = null; UI.orgSelected = null; saveData(); render();
}
function quickAssignOrg(roleId, val) {
  if (lockBlocked('orgChart')) return;
  var v = val !== '' ? val : null;  // val is a leader id (or '' to vacate)
  // One occupant per leader: if assigning a leader, first clear them from any other
  // role they currently occupy (untethered model -- a person holds one role).
  if (v) { (data.orgChart || []).forEach(function (r) { if (r.id !== roleId && r.occupantLeaderId === v) r.occupantLeaderId = null; }); }
  (data.orgChart || []).forEach(function (r) { if (r.id === roleId) r.occupantLeaderId = v });
  saveData(); render();
}
var ORG_LEVEL_LABELS={0:'Cross-Functional',1:'Board & Governance',2:'C-Suite & Transformation',3:'Senior Leadership',4:'Middle Management'};
function erScaleSvg(svg){return String(svg).replace(/<svg width="\d+" height="\d+"/,'<svg preserveAspectRatio="xMinYMin meet" style="width:100%;height:auto"')} /* 15 Sep 2026: a landscape snapshot scales to its page by its viewBox, not its pixel width */
function orgChartSvgHtml(roles,layout,opts){var pos=layout.pos;opts=opts||{}; /* opts.paper (16 Sep 2026, Paul's ruling): role names wrap onto two lines instead of truncating, and a floating body prints with a dashed border and its level named, so no report line is read into it */ /* 16 Sep 2026 (Paul's ruling): the chart's colours are the theme's tokens — box, role, occupant, connector — so the page's fill sweep no longer turns the role names pale in the light theme, and paper takes the tokens' print values */
  var svg='<svg width="'+(layout.tw+40)+'" height="'+(layout.th+40)+'" viewBox="-20 -20 '+(layout.tw+40)+' '+(layout.th+40)+'"'+(opts.paper?' preserveAspectRatio="xMinYMin meet"':'')+' xmlns="http://www.w3.org/2000/svg">';
  layout.lines.forEach(function(d){svg+='<path d="'+d+'" fill="none" style="stroke:rgba(var(--fg-rgb),.25)" stroke-width="1.5"/>'});
  roles.forEach(function(r){
    var p=pos[r.id];if(!p)return;
    var isBoard=r.level===1;
    var leader=isBoard?null:roleOccupant(r);
    var mc=(r.members||[]).length;
    var col=orgLevelColor(r.level);
    var lName=leader?leader.name:isBoard?(mc+' members'):'Unassigned';
    var dashed=(opts.paper&&p.floating)?' stroke-dasharray="5,3"':'';
    svg+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="3" style="fill:var(--bg-elev);stroke:rgba(var(--fg-rgb),'+(dashed?'.35':'.15')+')" stroke-width="1"'+dashed+'/>';
    svg+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="4" fill="'+col+'"/>';
    if(opts.paper){var nl=orgNameLines(r.name,Math.max(14,Math.floor((p.w-24)/6.6))),l1=nl[0],l2=nl[1];
      var second=(p.floating?ORG_LEVEL_LABELS[0]+' \u00b7 ':'')+lName;var maxS=Math.floor((p.w-24)/5.6);if(second.length>maxS)second=second.substring(0,maxS-1)+'\u2026';
      if(l2){svg+='<text x="'+(p.x+12)+'" y="'+(p.y+20)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(l1)+'</text><text x="'+(p.x+12)+'" y="'+(p.y+34)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(l2)+'</text>'}
      else svg+='<text x="'+(p.x+12)+'" y="'+(p.y+27)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(l1)+'</text>';
      svg+='<text x="'+(p.x+12)+'" y="'+(p.y+(l2?54:48))+'" style="fill:var(--text-body)" font-size="10" font-family="Helvetica Neue,sans-serif">'+esc(second)+'</text>';return}
    svg+='<text x="'+(p.x+12)+'" y="'+(p.y+22)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(r.name.length>22?r.name.substring(0,20)+'\u2026':r.name)+'</text>';
    svg+='<text x="'+(p.x+12)+'" y="'+(p.y+50)+'" style="fill:var(--text-body)" font-size="10" font-family="Helvetica Neue,sans-serif">'+esc(lName.length>24?lName.substring(0,22)+'\u2026':lName)+'</text>';
  });
  svg+='</svg>';
  return svg}
function orgRolesTableHtml(roles,leaders){var lvLabels=ORG_LEVEL_LABELS;
  var table='<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:24px">';
  table+='<tr style="border-bottom:2px solid #333"><th style="text-align:left;padding:8px">Role</th><th style="text-align:left;padding:8px">Level</th><th style="text-align:left;padding:8px">Assigned To</th><th style="text-align:left;padding:8px">Guiding Concepts</th><th style="text-align:left;padding:8px">Values</th></tr>';
  roles.forEach(function(r){
    var isBoard=r.level===1;
    var leader=isBoard?null:roleOccupant(r);
    var assignee=leader?leader.name:isBoard?(r.members||[]).map(function(m){if(m.type==='leader'){var bl=(leaders||[]).filter(function(l){return l.id===m.id;})[0]||(m.idx!==undefined?leaders[m.idx]:null);return bl?bl.name:'';}return m.name||'';}).join(', '):'Unassigned';
    var vals=(r.taggedValues||[]).map(function(vid){var v=(data.orgValues||[]).find(function(x){return x.id===vid});return v?v.principle:''}).filter(Boolean).join('; ');
    table+='<tr style="border-bottom:1px solid #ddd"><td style="padding:8px;font-weight:600">'+esc(r.name)+'</td><td style="padding:8px">'+esc(lvLabels[r.level]||'')+'</td><td style="padding:8px">'+esc(assignee)+'</td><td style="padding:8px;max-width:200px">'+esc(r.guidingConcepts||'')+'</td><td style="padding:8px;max-width:200px;font-size:10px">'+esc(vals)+'</td></tr>';
  });
  table+='</table>';
  return table}
function competencySummaryTable(){var cf=data.competencyFramework||{},leaders=data.leaders||[];var COMPS=['Orchestration','Philosophical','Hybrid Teams','Change','Composure','Ecosystem','Emotional'];var CK=['orchestration','philosophical','hybrid','change','composure','ecosystem','emotional'];
  var t='<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px"><tr style="border-bottom:2px solid #333"><th style="text-align:left;padding:6px">Leader</th>';COMPS.forEach(function(c){t+='<th style="text-align:center;padding:6px;font-size:9px">'+c+'</th>'});t+='</tr>';
  leaders.forEach(function(l){t+='<tr style="border-bottom:1px solid #ddd"><td style="padding:6px;font-weight:600">'+esc(l.name)+'</td>';CK.forEach(function(c){var v=(cf.scores||{})[l.id+'_'+c]||0;t+='<td style="text-align:center;padding:6px;color:'+(v>=4?'#1B6B5A':v>=3?'#4E7FA6':v>0?'#9B2D3F':'#ccc')+'">'+v+'</td>'});t+='</tr>'});
  return t+'</table>'} /* 16 Sep 2026: every leader's seven scores — the legacy org-chart window's table, now the Leadership Structure document's appendix */
function printOrgChart(){
  var roles=data.orgChart||[];var leaders=data.leaders||[];
  var layout=layoutOrgTree(roles);var pos=layout.pos;
  var cf=data.competencyFramework||{};var rv=data.leadershipReview||{};
  var lvLabels=ORG_LEVEL_LABELS;
  var COMPS=['Orchestration','Philosophical','Hybrid Teams','Change','Composure','Ecosystem','Emotional'];
  var CK=['orchestration','philosophical','hybrid','change','composure','ecosystem','emotional'];
  var svg=orgChartSvgHtml(roles,layout); /* 14 Sep 2026: shared with the Leadership Dashboard document */
  var table=orgRolesTableHtml(roles,leaders); /* 14 Sep 2026: shared with the Leadership Dashboard document */
  var compTable='<h3 style="margin-top:32px;font-size:14px">Competency Summary</h3>'+competencySummaryTable(); /* 16 Sep 2026: the table is shared with the Leadership Structure document's appendix */
  // Open print window
  var w=window.open('','_blank');
  if(!w){alert('Pop-up blocked. Please allow pop-ups for printing.');return}
  w.document.write('<!DOCTYPE html><html><head><title>Leadership Structure \u2014 Executive Readiness</title><style>'+printThemeTokens()+'body{font-family:Helvetica Neue,Arial,sans-serif;padding:32px;color:#1a1612}h1{font-size:24px;font-weight:300;margin:0 0 4px}h2{font-size:14px;font-weight:700;margin:16px 0 8px}p{font-size:12px;color:#666;margin:0 0 24px}.meta{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px}svg{max-width:100%;height:auto}@media print{body{padding:16px}}</style></head><body>');
  w.document.write('<div class="meta">Executive Readiness \u00B7 Leadership Structure \u00B7 Printed '+new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})+'</div>');
  w.document.write('<h1>Leadership Structure</h1>');
  w.document.write('<p>'+roles.length+' roles \u00B7 '+leaders.length+' leaders \u00B7 '+roles.filter(function(r){return roleHasOccupant(r)||(r.members||[]).length>0}).length+' filled</p>');
  w.document.write('<div style="overflow-x:auto;border:1px solid #ddd;padding:16px;margin-bottom:16px">'+svg+'</div>');
  w.document.write('<h2>Role Details</h2>'+table);
  w.document.write(compTable);
  w.document.write('</body></html>');
  w.document.close();
  setTimeout(function(){w.print()},300);
}
function printThemeTokens() {
  // Print windows are bare (no styles.css), so the swept var() references need
  // definitions. Print is always the light theme. Shadows are suppressed for paper;
  // font tokens are included so mono/serif stamps keep their faces in print.
  return ':root{--gold-rgb:78,127,166;--ink:#EAEEF4;--paper:#1E2530;--bg-rgb:234,238,244;--fg-rgb:30,37,48;' +
    '--stone:#303C4A;--text-muted:#303C4A;--text-fade:#404C5A;--text-faint:#58656F;' +
    '--faint-rgb:88,101,111;--ref-accent:#0A7FB5;' +
    '--text-body:#333E4B;--text-mid:#47525F;--text-hint:#2A3542;--text-bright:#273240;--text-soft:#3F4A58;--text-max:#1E2530;' +
    '--bg-elev:#FFFFFF;--menu-bg:#FFFFFF;--menu-fg:#1E2530;--warn-text:#8F6A00;--warn-pale:#7E6A00;' +
    '--ph1-t:#1B6B5A;--ph2-t:#2D5A8E;--ph3-t:#8B5E3C;--ph4-t:#9B2D3F;--ph5-t:#6B4C8A;' +
    '--gold:#4E7FA6;--gold-light:#6E9FC6;--gold-pale:#C4D8E8;--navy:#1E2530;--rule:rgba(15,45,74,.32);--rule-rgb:15,45,74;--head-blue:#076D9E;--gold-text:#33526C;' +
    '--ph1:#1B6B5A;--ph2:#2D5A8E;--ph3:#8B5E3C;--ph4:#9B2D3F;--ph5:#6B4C8A;' +
    '--surface:rgba(var(--fg-rgb),.06);--border-faint:rgba(var(--fg-rgb),.12);--border-soft:rgba(var(--fg-rgb),.08);' +
    '--border-softer:rgba(var(--fg-rgb),.06);--bg-card:rgba(var(--fg-rgb),.03);--bg-card-hover:rgba(var(--gold-rgb),.04);' +
    '--bg-input:rgba(var(--fg-rgb),.06);--shadow-card:none;--shadow-elev:none;' +
    "--serif:'Cormorant Garamond',Georgia,serif;--mono:'DM Mono',Menlo,Consolas,monospace;--sans:'Helvetica Neue',Arial,sans-serif}";
}

function orgSnapshot() {
  // Deep copy of chart + leaders so a saved state is internally consistent.
  return {
    chart: JSON.parse(JSON.stringify(data.orgChart || [])),
    leaders: JSON.parse(JSON.stringify(data.leaders || []))
  };
}
function orgAutosaveBeforeReset() {
  if (!data.orgSavedStates) data.orgSavedStates = [];
  var chart = data.orgChart || [];
  // Only autosave if there is something worth keeping.
  if (!chart.length) return;
  var d = new Date();
  var stamp = d.toLocaleDateString('en-US') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var snap = orgSnapshot(); snap.name = 'Autosave before reset \u2014 ' + stamp; snap.auto = true; snap.savedAt = d.getTime();
  data.orgSavedStates.push(snap);
  // Keep autosaves from piling up: cap at the 5 most recent autosaves.
  var autos = data.orgSavedStates.filter(function (s) { return s.auto });
  if (autos.length > 5) {
    var excess = autos.slice(0, autos.length - 5);
    data.orgSavedStates = data.orgSavedStates.filter(function (s) { return excess.indexOf(s) === -1 });
  }
}
function saveOrgState() {
  var name = prompt('Name this saved chart state:', '');
  if (name === null) return;
  name = name.trim();
  if (!name) { alert('Please enter a name.'); return; }
  if (!data.orgSavedStates) data.orgSavedStates = [];
  var snap = orgSnapshot(); snap.name = name; snap.savedAt = Date.now();
  // Overwrite if a state with the same name exists, else add.
  var existing = -1;
  for (var i = 0; i < data.orgSavedStates.length; i++) { if (data.orgSavedStates[i].name === name) { existing = i; break; } }
  if (existing >= 0) {
    if (!confirm('A saved state named \u201C' + name + '\u201D already exists. Overwrite it?')) return;
    data.orgSavedStates[existing] = snap;
  } else {
    data.orgSavedStates.push(snap);
  }
  saveData(); render();
}
function loadOrgState(idx) {
  if (lockBlocked('leaders') || lockBlocked('orgChart')) return;
  var i = parseInt(idx);
  if (isNaN(i)) return;
  var states = data.orgSavedStates || [];
  var s = states[i];
  if (!s) return;
  if (!confirm('Load \u201C' + s.name + '\u201D? This will replace both the current org chart and the current leaders list. Save the current state first if you want to keep it.')) return;
  data.orgChart = JSON.parse(JSON.stringify(s.chart || []));
  data.leaders = JSON.parse(JSON.stringify(s.leaders || []));
  UI.orgSelected = null; UI.orgEditId = null;
  saveData(); render();
}
function deleteOrgState(idx) {
  var i = parseInt(idx);
  if (isNaN(i)) return;
  var states = data.orgSavedStates || [];
  var s = states[i];
  if (!s) return;
  if (!confirm('Delete saved state \u201C' + s.name + '\u201D? This cannot be undone.')) return;
  data.orgSavedStates.splice(i, 1);
  saveData(); render();
}
function orgSavedStatesControls() {
  var states = data.orgSavedStates || [];
  if (!states.length) return '';
  var h = '<div style="display:flex;align-items:center;gap:6px;margin-left:auto">';
  h += '<span style="font-family:var(--mono);font-size:10px;color:var(--text-body);letter-spacing:.06em">SAVED</span>';
  h += '<select id="orgStateSel" class="assign-sel" style="padding:6px 10px;background:rgba(var(--fg-rgb),.06);border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:12px;font-family:var(--sans);max-width:200px">';
  h += '<option value="">Load a saved state\u2026</option>';
  states.forEach(function (s, i) { h += '<option value="' + i + '">' + esc(s.name) + '</option>'; });
  h += '</select>';
  h += '<button onclick="var el=document.getElementById(\'orgStateSel\');if(el)loadOrgState(el.value)" title="Load selected saved state" style="padding:6px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:11px;cursor:pointer;font-family:var(--mono)">Load</button>';
  h += '<button onclick="var el=document.getElementById(\'orgStateSel\');if(el&&el.value!==\'\')deleteOrgState(el.value)" title="Delete selected saved state" style="width:28px;height:28px;border:1px solid rgba(155,45,63,.4);background:rgba(155,45,63,.08);color:#d98b97;font-size:14px;cursor:pointer;font-family:var(--sans);border-radius:6px">\u2715</button>';
  h += '</div>';
  return h;
}
function addBoardMember(roleId, type, leaderId, name, title) {
  if (lockBlocked('orgChart')) return;
  if (!data.orgChart) data.orgChart = [];
  var r = data.orgChart.find(function (x) { return x.id === roleId });
  if (!r && roleId === 'board') { r = { id: 'board', name: 'Board', level: 1, parentId: '', occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: [], source: 'core' }; data.orgChart.push(r); }
  if (!r) return; if (!r.members) r.members = [];
  if (type === 'leader') {
    if (r.members.some(function (m) { return m.type === 'leader' && m.id === leaderId })) return;
    r.members.push({ type: 'leader', id: leaderId });
  } else {
    if (!name) return;
    r.members.push({ type: 'external', name: name || '', title: title || '' });
  }
  saveData(); render();
}
function removeBoardMember(roleId, mi) {
  if (lockBlocked('orgChart')) return;
  var r = (data.orgChart || []).find(function (x) { return x.id === roleId });
  if (!r || !r.members) return;
  r.members.splice(mi, 1); saveData(); render();
}
function toggleBoardLeader(roleId, leaderId) {
  if (lockBlocked('orgChart')) return;
  if (!data.orgChart) data.orgChart = [];
  var r = data.orgChart.find(function (x) { return x.id === roleId });
  if (!r && roleId === 'board') { r = { id: 'board', name: 'Board', level: 1, parentId: '', occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: [], source: 'core' }; data.orgChart.push(r); }
  if (!r) return; if (!r.members) r.members = [];
  var exists = r.members.findIndex(function (m) { return m.type === 'leader' && m.id === leaderId });
  if (exists >= 0) r.members.splice(exists, 1); else r.members.push({ type: 'leader', id: leaderId });
  saveData(); render();
}



/* ═══ NOTES ═══ */
// Item 39 (family law; Architecture treatment, adapted to ER's page model and panel
// register 25 July 2026): each note records where it was captured and renders a jump
// link back to that location. Legacy notes ({text,date} only) render without the
// delete button or jump link. Storage stays data.notes; ER's --nav-h-exact mechanism
// already anchors the panel, so Architecture's anchorBelowNav is not ported.



/* ═══ NOTES ═══ */
// Item 39 (family law; Architecture treatment, adapted to ER's page model and panel
// register 25 July 2026): each note records where it was captured and renders a jump
// link back to that location. Legacy notes ({text,date} only) render without the
// delete button or jump link. Storage stays data.notes; ER's --nav-h-exact mechanism
// already anchors the panel, so Architecture's anchorBelowNav is not ported.
function notesWhere(){
  if(currentPage==='step'&&currentStep){
    for(var i=0;i<PH.length;i++)for(var j=0;j<PH[i].steps.length;j++)
      if(PH[i].steps[j].id===currentStep)return'Step '+currentStep+' \u00B7 '+PH[i].steps[j].name;
    return'Step '+currentStep;
  }
  if(currentPage==='phaseHome'&&currentStep){var ph=PH.find(function(p){return String(p.id)===String(currentStep)});if(ph)return'Phase '+ph.id+' \u00B7 '+ph.name}
  if(currentPage==='outcome'&&currentStep){for(var k=0;k<PH.length;k++){var o=(PH[k].outcomes||[]).find(function(x){return x.id===currentStep});if(o)return o.name}}
  var map={home:'Home',learn:'Learn',insights:'Insights','mgmt-hub':'Track Program',reports:'Report Manager'};
  return map[currentPage]||'';
}
function deleteNote(id) { data.notes = (data.notes || []).filter(function (x) { return x.id !== id }); saveData(); renderNotes(); updateNotesCount() }
function goToNote(id) { var x = (data.notes || []).find(function (nn) { return nn.id === id }); if (!x || !x.page) return; if (x.page === 'step' && x.step) go('step', x.step); else if (x.page === 'phaseHome' && x.step) go('phaseHome', x.step); else if (x.page === 'outcome' && x.step) go('outcome', x.step); else go(x.page) }
function toggleNotes() {
  notesOpen = !notesOpen;
  var p = $('notesPanel'); p.className = notesOpen ? 'notes-panel open' : 'notes-panel';
  if (notesOpen) renderNotes();
  renderNav();
}
function updateNotesCount() { var e = $('notesCount'); if (e) e.textContent = (data.notes || []).length }
/* Items 3+12 (F-3/F-11/F-15 — one class, ruled 27 July): the three surfaces living outside
   #app (Notes panel, Team Chat panel, org profile modal) repaint on every render — including
   adoption — so foreign writes and org switches never leave a stale panel. Focus and caret
   on any field being edited inside them survive the repaint. */
function repaintOpenPanels() {
  var a = document.activeElement, fid = a && a.id, fv = (a && fid && ('value' in a)) ? a.value : null;
  var fs = (a && typeof a.selectionStart === 'number') ? a.selectionStart : null, fe2 = (a && typeof a.selectionEnd === 'number') ? a.selectionEnd : null;
  try { if (notesOpen) renderNotes(); } catch (e) { }
  try { if (gchatOpen) renderGChatPanel(); } catch (e) { }
  try { if (currentModal === 'org') renderOrgModal(); } catch (e) { }
  try { updateGChatUnread(); } catch (e) { }
  if (fid) { try { var el2 = document.getElementById(fid); if (el2 && el2 !== a) { if (fv != null) el2.value = fv; el2.focus(); if (fs != null && typeof el2.setSelectionRange === 'function') el2.setSelectionRange(fs, fe2 == null ? fs : fe2); } } catch (e) { } }
}
function renderNotes() {
  var n = data.notes || [];
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--rule)"><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase">Notes (' + n.length + ')</div><button onclick="toggleNotes()" title="Close" style="background:none;border:1px solid rgba(var(--fg-rgb),.15);color:var(--stone);width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px">\u00D7</button></div>';
  h += '<div style="flex:1;overflow-y:auto;padding:16px 24px;display:flex;flex-direction:column;gap:10px">';
  if (n.length) {
    for (var i = n.length - 1; i >= 0; i--) {
      var _nt = n[i];
      h += '<div style="background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.08);padding:12px 16px;position:relative">'
        + (_nt.id ? '<button title="Delete note" onclick="deleteNote(\'' + esc(_nt.id) + '\')" style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--stone);cursor:pointer;font-size:13px;line-height:1">\u00D7</button>' : '')
        + '<div style="font-size:14px;color:var(--paper);line-height:1.6;margin-bottom:6px;padding-right:16px">' + esc(_nt.text) + '</div>'
        + '<div style="font-family:var(--mono);font-size:9px;color:var(--stone)">'
        + (_nt.where && _nt.id ? '<span onclick="goToNote(\'' + esc(_nt.id) + '\')" style="cursor:pointer;color:var(--gold);text-decoration:underline;text-underline-offset:2px" title="Jump to where this was captured">' + esc(_nt.where) + '</span> \u00B7 ' : '')
        + fmt(_nt.date) + '</div></div>'
    }
  }
  else h += '<div style="font-family:var(--serif);font-size:16px;color:var(--stone);font-style:italic;text-align:center;padding:40px 0">No notes yet.</div>';
  h += '</div>';
  h += '<div style="display:flex;gap:8px;padding:14px 24px;border-top:1px solid var(--rule)"><textarea id="noteInput" placeholder="Add a note\u2026" style="flex:1;background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.12);color:var(--paper);font-family:var(--sans);font-size:13px;padding:10px 14px;outline:none;resize:none;min-height:40px"></textarea><button onclick="addNote()" style="background:var(--gold);border:none;color:var(--ink);padding:10px 14px;cursor:pointer;font-size:16px">+</button></div>';
  $('notesPanel').innerHTML = h;
}
function addNote() { var t = $('noteInput'); if (!t || !t.value.trim()) return; if (!data.notes) data.notes = []; var cu = (typeof getCurrentUser === 'function') ? getCurrentUser() : null; data.notes.push({ id: uid(), text: t.value.trim(), date: new Date().toISOString(), by: cu ? cu.id : null, byName: cu ? cu.name : null, page: currentPage, step: currentStep, where: notesWhere() }); saveData(); renderNotes(); updateNotesCount() }

/* ═══ GUIDE ═══ */
/* -- AI FEATURES (Part 2, 2 Oct 2026): the AI Guide and Voice are off until an organization's administrator switches them on. Data without settings counts as both off. -- */
function aiGuideOn() { return !SAMPLE_MODE && !!(data && data.settings && data.settings.aiGuide); }
function voiceOn() { return !SAMPLE_MODE && !!(data && data.settings && data.settings.voice); }
function canSetAiFeatures() { var u = getCurrentUser(); return !!isAppAdmin || !!(u && u.admin === true); } /* admin:true is the authority record (ruled July 9) */
/* Run on every render and after a change: the buttons shown or hidden, an open AI Guide closed and a live microphone stopped when switched off. */
function applyAiFeatures() {
  var ai = aiGuideOn(), vo = voiceOn();
  if (!ai && coachOpen) { try { toggleCoach(); } catch (e) { } }
  if (!vo && _voiceActive) { _voiceActive = false; try { if (_recognition) _recognition.stop(); } catch (e) { } try { _voiceUI(false); } catch (e) { } }
  var f = $('coachFab'), p = $('fabPulse') || document.querySelector('.coach-fab-pulse'), v = $('voiceFab');
  if (f) f.style.display = ai ? '' : 'none';
  if (p) p.style.display = ai ? '' : 'none';
  if (v) v.style.display = vo ? '' : 'none';
}
function setAiFeature(key, on) {
  if (!canSetAiFeatures() || (key !== 'aiGuide' && key !== 'voice')) return;
  if (!data.settings) data.settings = { aiGuide: false, voice: false };
  data.settings[key] = !!on;
  saveData();
  applyAiFeatures();
  render();
  if (currentModal === 'org') renderOrgModal();
}
function aiFeaturesFold() {
  var st = data.settings || {};
  function sw(key, label, note) { return '<label class="ai-switch"><input type="checkbox" role="switch" id="aiSet_' + key + '"' + (st[key] ? ' checked' : '') + ' onchange="setAiFeature(\'' + key + '\',this.checked)"/> <span>' + label + '</span></label><div class="ai-fold-note">' + note + '</div>'; }
  return '<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open"' + (UI.aiFoldOpen ? ' open' : '') + '><summary>AI Features (off by default)</summary><div class="ai-fold-body">'
    + sw('aiGuide', 'AI Guide', 'When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.')
    + sw('voice', 'Voice', 'When this is on, Voice uses the browser\'s own speech recognition. Some browsers send the recording to the browser maker to turn it into text.')
    + '</div></details>';
}
function toggleCoach() {
  if (!coachOpen && !aiGuideOn()) return; /* Part 2: blocks opening only, so the seal and switching off can always close it */
  coachOpen = !coachOpen;
  $('coachFab').className = coachOpen ? 'coach-fab open' : 'coach-fab';
  $('coachPanel').className = coachOpen ? 'coach-panel open' : 'coach-panel';
  if (coachOpen) renderCoach();
}
function renderCoach() {
  var h = '<div class="coach-header"><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase">\u2726 Ask Danni</div><button class="coach-close" onclick="toggleCoach()" title="Close">\u00D7</button></div>';
  h += '<div class="coach-ai-notice">You are talking to an AI assistant. It can make mistakes, so check anything important.</div>'; /* Part 2 (A.2.6): "AI Guide" is a name, not a plain statement */
  h += '<div class="coach-msgs" id="coachMsgs">';
  coachMsgs.forEach(function (m) { h += '<div class="coach-msg ' + m.role + '"><div class="coach-sender">' + (m.role === 'ai' ? 'Danni' : 'You') + '</div>' + esc(m.text) + '</div>' });
  h += '</div>';
  h += '<div class="coach-input-row"><textarea id="coachInput" placeholder="Ask about OPEN/CARE, CITO, philosophical proficiency\u2026" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendCoach()}"></textarea><button class="coach-send" onclick="sendCoach()">Send</button></div>';
  $('coachPanel').innerHTML = h;
  var msgs = $('coachMsgs'); if (msgs) msgs.scrollTop = msgs.scrollHeight;
}
function sendCoach() { if (!aiGuideOn()) return; var t = $('coachInput'); if (!t || !t.value.trim()) return; coachMsgs.push({ role: 'user', text: t.value.trim() }); coachMsgs.push({ role: 'ai', text: 'Thank you. The AI Guide will provide contextualised guidance on all aspects of the module. Full AI integration coming in a future build.' }); renderCoach() }

/* ═══ SIDEBAR ═══ */
var sidebarOpen = true;
var sidebarMinimized = (function () {
  try { return Store.getPref('sidebar-min') === '1'; }
  catch (e) { return false; }
})();
function toggleSidebar() { sidebarOpen = !sidebarOpen; updateSidebarState() }
function updateSidebarState(){
  var sb=$('pipSidebar');var app=$('app');var ftr=$('appFooter');var btn=$('sidebarToggle');
  var show=sidebarPageShown();
  if(sb){sb.className='sidebar'+(sidebarOpen?'':' collapsed')+(sidebarMinimized?' mini':'');sb.style.display=show?'flex':'none'}
  if(app){app.classList.remove('sidebar-collapsed','sidebar-mini');if(!show||!sidebarOpen)app.classList.add('sidebar-collapsed');else if(sidebarMinimized)app.classList.add('sidebar-mini')}
  if(ftr){ftr.classList.remove('sidebar-collapsed','sidebar-mini');if(!show||!sidebarOpen)ftr.classList.add('sidebar-collapsed');else if(sidebarMinimized)ftr.classList.add('sidebar-mini')}
  if(btn){btn.style.display=show?'block':'none';btn.style.left='16px'}
}
function sidebarPageShown(){return currentPage==='step'||currentPage==='readiness'||currentPage==='phase5'||currentPage==='outcome'||currentPage==='phaseHome'||currentPage==='reports'} /* 16 Sep 2026 (Paul's ruling): the Report Manager keeps the sidebar and its toggle like the working pages; one definition for renderSidebar and updateSidebarState */
function renderSidebar(){
  var sb=document.getElementById('pipSidebar');
  if(!sb)return;
  var showSidebar=sidebarPageShown();
  sb.style.display=showSidebar?'flex':'none';
  // Apply min/max class
  sb.className = 'sidebar' + (sidebarOpen ? '' : ' collapsed') + (sidebarMinimized ? ' mini' : '');
  var app=document.getElementById('app');
  if(app){
    app.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){app.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){app.classList.add('sidebar-mini');}
  }
  var ftr=document.getElementById('appFooter');
  if(ftr){
    ftr.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){ftr.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){ftr.classList.add('sidebar-mini');}
  }
  var btn=document.getElementById('sidebarToggle');
  if(btn){
    btn.style.display=showSidebar?'block':'none';
    // Keep the toggle pinned in the nav's top-left corner in every state.
    btn.style.left = '16px';
  }
  if(!showSidebar)return;

  // Build header with min/max toggle button
  var togContent = sidebarMinimized ? '\u00BB' : '\u00AB&nbsp;&nbsp;Minimize';
  var togTitle = sidebarMinimized ? 'Maximize sidebar' : 'Minimize sidebar';
  var headerHtml = '<div class="sidebar-header">'
    + (sidebarMinimized ? '<div class="sidebar-logo-mini" title="Executive Readiness">ER</div>' : '<div class="sidebar-logo">Executive <span>Readiness</span></div>')
    + '<button class="sidebar-size-tog" onclick="toggleSidebarSize()" title="' + togTitle + '" aria-label="' + togTitle + '">' + togContent + '</button>'
    + '</div>';

  // Build minimized body: phase circles only
  if(sidebarMinimized){
    var h='<div class="sidebar-inner">';
    h += headerHtml;
    h += '<div class="sidebar-scroll">';
    h += '<div class="sidebar-mini-row' + (currentPage==='readiness'?' active':'') + '" onclick="go(\'readiness\')" title="Overview">'
      + '<span class="sidebar-mini-icon">\u25A6</span></div>';
    for(var i=0;i<PH.length;i++){
      var ph=PH[i];
      var isPhaseActive=(currentPage==='phaseHome'&&String(currentStep)===String(ph.id))||(currentPage==='phase5'&&ph.id===5);
      var hasActiveStep = (currentPage==='step' && currentStep && String(currentStep).charAt(0)===String(ph.id));
      h += '<div class="sidebar-mini-row' + (isPhaseActive||hasActiveStep?' active':'') + '" '
        + 'onclick="go(\''+(ph.id===5?'phase5':'phase-'+ph.id)+'\')" '
        + 'title="Phase '+ph.id+': '+ph.name+' ('+ph.days+')">'
        + '<span class="sidebar-mini-dot" style="background:'+ph.color+'">'+ph.id+'</span>'
        + '</div>';
    }
    h += '</div>';
    // Sticky footer: explicit Maximize button
    h += '<button class="sidebar-mini-max" onclick="maximizeSidebar()" title="Maximize sidebar" aria-label="Maximize sidebar">\u00BB</button>';
    h += '</div>';
    sb.innerHTML = h;
    updateSidebarState();
    return;
  }

  // Maximized (full) view
  // Multi-open sections: any number of phases can show their steps + outputs
  // at once. Selecting a phase (or any step within it) opens that phase and
  // does not collapse the others.
  // - On navigation (page/step change) the open phase follows the selection.
  // - The chevron opens/collapses a phase in place without navigating; that
  //   choice holds until the next navigation.
  var actId = activeNavPhaseId();
  var pageKey = currentPage + ':' + currentStep;
  if(!UI.navOpenSet){ UI.navOpenSet = {}; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  if(UI._navPageKey !== pageKey){ UI._navPageKey = pageKey; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  var h='<div class="sidebar-inner">';
  h += headerHtml;
  h+='<div class="sidebar-scroll">';
  h+='<div class="sidebar-home'+(currentPage==='readiness'?' active':'')+'" onclick="go(\'readiness\')">Overview</div>';
  for(var i=0;i<PH.length;i++){
    var ph=PH[i];
    var isPhaseActive=(currentPage==='phaseHome'&&String(currentStep)===String(ph.id))||(currentPage==='phase5'&&ph.id===5);
    var navOpenThis=!!(UI.navOpenSet&&UI.navOpenSet[String(ph.id)]);
    h+='<div class="sidebar-phase-group">';
    h+='<div class="sidebar-phase-head" onclick="goPhase('+ph.id+')">';
    h+='<div class="sidebar-phase-dot" style="background:'+ph.color+'"></div>';
    h+='<span class="sidebar-phase-name" style="color:'+(isPhaseActive?'var(--paper)':'color-mix(in srgb, '+ph.color+' 58%, var(--paper))')+'">'+ph.id+'. '+ph.name+'</span>';
    h+='<span class="sidebar-phase-days">'+ph.days+'</span>';
    h+='<span class="sidebar-phase-tog" onclick="event.stopPropagation();toggleNavPhase('+ph.id+')" title="'+(navOpenThis?'Collapse':'Expand')+'" style="cursor:pointer;color:color-mix(in srgb, '+ph.color+' 58%, var(--paper));font-family:var(--mono);font-size:13px;opacity:.9;padding:2px 6px;margin-left:2px;user-select:none">'+(navOpenThis?'\u25BE':'\u25B8')+'</span>';
    h+='</div>';
    if(navOpenThis){
      // Module-specific (Executive Readiness): the per-phase individual step is
      // pulled out of the main list into the Leadership Development strand below.
      var _indivMap={'1.4':1,'2.4':1,'3.5':1,'4.4':1};
      var indivStep=null;
      for(var j=0;j<ph.steps.length;j++){
        var s=ph.steps[j];
        if(_indivMap[s.id]){indivStep=s;if(ph.id<5)continue;}
        if(s.id==='5.3')continue;
        var isActive=(currentPage==='step'&&currentStep===s.id)||(currentPage==='phase5'&&s.id==='5.1');
        var isDone=isStepDone(s.id);
        var cls='sidebar-step'+(isActive?' active':isDone?' done':'');
        h+='<div class="'+cls+'" onclick="go(\''+(s.id==='5.1'?'phase5':s.id)+'\')">'+(isDone&&!isActive?'':s.icon+' ')+s.id+' '+s.name+'</div>';
      }
      if(indivStep&&ph.id<5){
        h+='<div class="sidebar-outcomes-label">Leadership Development</div>';
        var ivActive=(currentPage==='step'&&currentStep===indivStep.id);
        var ivDone=isStepDone(indivStep.id);
        var ivCls='sidebar-step'+(ivActive?' active':ivDone?' done':'');
        h+='<div class="'+ivCls+'" onclick="go(\''+indivStep.id+'\')">'+(ivDone&&!ivActive?'':'\u25C8 ')+indivStep.id+' '+indivStep.name+'</div>';
      }
      if(ph.id===5){
        h+='<div class="sidebar-outcomes-label">Leadership Development</div>';
        var ldevActive=(currentPage==='step'&&currentStep==='5.3');
        var ldevDone=isStepDone('5.3');
        var ldevCls='sidebar-step'+(ldevActive?' active':ldevDone?' done':'');
        h+='<div class="'+ldevCls+'" onclick="go(\'5.3\')">'+(ldevDone&&!ldevActive?'':'\u25C8 ')+'5.3 My Development</div>';
      }
      if(ph.outcomes&&ph.outcomes.length>0){
        var outOpen=navOutputsOpen(ph);
        h+='<div class="sidebar-outcomes-label sidebar-outcomes-fold" onclick="event.stopPropagation();toggleNavOutputs('+ph.id+')" style="cursor:pointer;user-select:none" title="'+(outOpen?'Hide the outputs':'Show the outputs')+'">'+(outOpen?'\u25BE':'\u25B8')+' Outputs <span style="opacity:.7">('+ph.outcomes.length+')</span></div>'; /* 12 Sep 2026 (Paul's ruling): the outputs sit behind a fold */
        if(outOpen){
        for(var k=0;k<ph.outcomes.length;k++){
          var o=ph.outcomes[k];
          var isOActive=(currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id;
          h+='<div class="sidebar-outcome'+(isOActive?' active':'')+'" onclick="go(\''+o.id+'\')">\u2192 '+o.name+'</div>';
        }
        }
      }
    }
    h+='</div>';
  }
  h+='</div>';
  h+='</div>';
  sb.innerHTML=h;
  updateSidebarState();
}

/* ===== GROUP CHAT ===== */
var gchatOpen = false;
function chatArr() { if (!data.chatMsgs) data.chatMsgs = []; return data.chatMsgs } /* donor pattern (item 13, ruled July 16): per-org, seed-owned */
var gchatSeen = {}; /* Item-12 (F-11, ruled 27 July): per-session, per-org last-seen marker — the unread badge derives from chatMsgs, never a local counter */
function gchatMsgCount() { return ((data && data.chatMsgs) || []).length }
function gchatSeenKey() { return String((typeof currentOrgId !== 'undefined' && currentOrgId) || '') }
function gchatSeenBase() { var k = gchatSeenKey(); if (!(k in gchatSeen)) gchatSeen[k] = gchatMsgCount(); return gchatSeen[k] }
function gchatMarkSeen() { gchatSeen[gchatSeenKey()] = gchatMsgCount() }
function gchatUnread() { var a = chatArr(), n = 0; for (var i = gchatSeenBase(); i < a.length; i++) { var m = a[i]; var mine = !!m && ((m.by && m.by === currentUserId) || (!m.by && m.who === currentUserId)); if (m && !mine) n++; } return n } /* Sweep 4R item 5 (addendum 5 Oct 2026): colleagues' messages since this session last saw the room; one's own never count */
function updateGChatUnread() { var u = $('gchatUnread'); if (!u) return; var n = gchatUnread(); u.style.display = n > 0 ? '' : 'none'; u.textContent = String(n) }

function toggleGChat() {
  if (SAMPLE_MODE && !gchatOpen) return; /* Part 3: Team Chat is off in the sample tab */
  gchatOpen = !gchatOpen;
  var fab = $('gchatFab'); var panel = $('gchatPanel');
  if (fab) fab.className = 'gchat-fab' + (gchatOpen ? ' open' : '');
  if (panel) panel.className = 'gchat-panel' + (gchatOpen ? ' open' : '');
  if (gchatOpen) renderGChatPanel();
  updateGChatUnread();
  renderNav();
}
function renderGChatPanel() {
  var panel = $('gchatPanel'); if (!panel) return;
  var cu = getCurrentUser(); var cuId = cu ? cu.id : 'u1';
  var avHtml = ''; USERS.forEach(function (u) { avHtml += '<div class="gchat-av" style="background:' + u.color + ';color:#fff">' + u.initials + '</div>' });
  var memHtml = ''; USERS.forEach(function (u) { memHtml += '<div class="gchat-member"><div class="gchat-member-av" style="background:' + u.color + ';color:#fff">' + u.initials + '</div>' + esc(u.name) + (u.id === cuId || u.id === 'u2' || u.id === 'u4' ? '<div class="gchat-online"></div>' : '') + '</div>' });
  var h = '<div class="gchat-header"><div class="gchat-header-title"><div class="gchat-avatars">' + avHtml + '</div> Team Room</div><button class="gchat-close" onclick="toggleGChat()" title="Close">\u00D7</button></div>';
  h += '<div class="gchat-members">' + memHtml + '</div>';
  h += '<div class="gchat-msgs" id="gchatMsgsEl"><div class="gchat-day-div">Today</div>';
  chatArr().forEach(function (msg) {
    var isMe = (msg.who === cuId); var cls = isMe ? 'me' : 'them';
    var u = USERS.find(function (x) { return x.id === msg.who }); var col = u ? u.color : '#888'; var ini = u ? u.initials : '?';
    h += '<div class="gchat-msg ' + cls + '"><div class="gchat-msg-av" style="background:' + col + ';color:#fff">' + ini + '</div><div class="gchat-msg-body"><div class="gchat-msg-meta">' + esc(isMe ? 'You' : msg.name) + ' \u00B7 ' + esc(msg.ts) + '</div><div class="gchat-msg-text">' + esc(msg.text) + '</div></div></div>';
  });
  h += '</div><div class="gchat-typing" id="gchatTyping"></div>';
  h += '<div class="gchat-input-row"><textarea id="gchatInput" placeholder="Message the team\u2026" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendGChat()}"></textarea><button class="gchat-send" onclick="sendGChat()">\u2192</button></div>';
  panel.innerHTML = h;
  gchatMarkSeen(); /* Item-12 (F-11): whatever the panel paints is seen */
  var msgs = $('gchatMsgsEl'); if (msgs) msgs.scrollTop = msgs.scrollHeight;
}
function sendGChat(){
  var inp=$('gchatInput');if(!inp||!inp.value.trim())return;
  var text=inp.value.trim();inp.value='';
  var cu=getCurrentUser();var cuId=cu?cu.id:'u1';
  var now=new Date();var ts=(now.getHours()%12||12)+':'+(now.getMinutes()<10?'0':'')+now.getMinutes()+' '+(now.getHours()>=12?'PM':'AM');
  chatArr().push({by:currentUserId,who:cuId,name:cu?cu.name:'You',ts:ts,text:text}); Store.commit('chatMsgs');
  renderGChatPanel();
  /* 2 Oct 2026 (Paul): Team Chat carries no AI; nothing is written in anyone else's name */
}


/* ═══ MODULE MANAGEMENT HUB + NOTIFICATIONS (§11/§12, ported §18.7) ═══ */
/* ================= Module Management Hub (Paul, July 5) =================
   Assignments (data.assigns) and the roster already existed; this adds
   completion stamps (data.stepDoneAt, written by every saveDone handler),
   optional per-step deadlines (data.stepDue), and analytics: the 90-day
   burn-up and velocity charts (adapted from the companion Governance
   module), team load, and derived signals. Phase 5 (Navigate) is ongoing
   work, not a step to burn down, so it stays out of the counts. */
function confirmStepDone(sid) { if ((data.completedSteps || {})[sid]) return true; return confirm('Mark this step complete? This will notify the team and can\u2019t be undone.') }
// Discrete step completion (ruled 25 July): every tabbed/sectioned step carries its own
// Step Complete button; tabs and sections never complete the step. Shared steps run the
// confirmStepDone warning (it notifies the team) and stamp/email once via stampStepDone;
// individual-track steps (1.4, 4.4) use a non-notify confirm — their completion is
// per-leader and never emails.
function markStepComplete(sid) { if (!confirmStepDone(sid)) return; if (!data.completedSteps) data.completedSteps = {}; data.completedSteps[sid] = true; stampStepDone(sid); saveData(); render() }
function saveMindsetStep() {
  var ml = getMyLeader(); if (!ml) { alert('Link your account to a leader first.'); return; }
  var dd = (data.indivDone || {})[ml.id] || {};
  if (!(dd['1.4:intro'] && dd['1.4:workforce'] && dd['1.4:atrophy'])) return;
  if (dd['1.4']) { render(); return; }
  if (!confirm('Mark this step complete? This can\u2019t be undone.')) return;
  data.indivDone[ml.id]['1.4'] = true; saveData(); render()
}
function saveComposureStep() {
  var ml = getMyLeader(); if (!ml) { alert('Link your account to a leader first.'); return; }
  var dd = (data.indivDone || {})[ml.id] || {};
  if (!(dd['4.4:reflections'] && dd['4.4:stop'] && dd['4.4:slowlog'])) return;
  if (dd['4.4']) { render(); return; }
  if (!confirm('Mark this step complete? This can\u2019t be undone.')) return;
  data.indivDone[ml.id]['4.4'] = true; saveData(); render()
}
function confirmSectionDone(s) { if ((data.completedSections || {})[s]) return true; return confirm('Mark this section complete? This can\u2019t be undone.') }
/* Item-7 (ruled 27 July): every individual-track step completion runs the same non-notify
   confirm as 1.4/4.4 — the family standard is a warning on every completion; cancel touches nothing. */
function confirmIndivStepDone(sid) { if (indivStepDone(sid)) return true; return confirm('Mark this step complete? This can\u2019t be undone.') }
function stampStepDone(id) { try { if (!data.stepDoneAt) data.stepDoneAt = {}; if (!data.stepDoneAt[id]) { data.stepDoneAt[id] = new Date().toISOString().split('T')[0]; Store.commit('stepDoneAt'); notifyStepComplete(id) } } catch (e) { } }
function mgSteps() { var out = []; PH.forEach(function (p) { if (p.days === 'Ongoing') return; p.steps.forEach(function (st) { if (INDIVIDUAL_TRACK_STEPS[st.id]) return; out.push({ id: st.id, name: st.name, icon: st.icon, ph: p }) }) }); return out } /* shared steps only — individual-track steps are per-leader and never enter org-wide counts (ruled 16 July) */
function deferRender() { setTimeout(render, 0) }
function mgDueSave(id, v) { data.stepDue = data.stepDue || {}; if (v) data.stepDue[id] = v; else delete data.stepDue[id]; Store.commit('stepDue') }
function mgAssignToggle(id, uid2) { toggleAssign(id, uid2) } /* delegates to the existing assignment system */
function mgStats() {
  var steps = mgSteps(), co = data.completedSteps || {}, due = data.stepDue || {};
  var done = steps.filter(function (s) { return co[s.id] }).length;
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var elapsed = Math.max(0, Math.round((Date.now() - sd.getTime()) / 86400000));
  var ideal = Math.min(1, elapsed / 90) * steps.length;
  var today = new Date().toISOString().split('T')[0];
  var overdue = steps.filter(function (s) { return !co[s.id] && due[s.id] && due[s.id] < today }).length;
  return { total: steps.length, done: done, elapsed: elapsed, ideal: ideal, delta: done - ideal, overdue: overdue }
}
function mgBurnup() {
  var steps = mgSteps(), total = steps.length; var co = data.completedSteps || {}, dts = data.stepDoneAt || {};
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var events = []; steps.forEach(function (s) { if (co[s.id] && dts[s.id]) events.push({ d: new Date(dts[s.id]), id: s.id }) });
  events.sort(function (a, b) { return a.d - b.d });
  var elapsed = Math.max(0, Math.min(120, Math.round((Date.now() - sd.getTime()) / 86400000)));
  var span = Math.max(90, elapsed);
  var W = 560, H = 190, PX = 40, PY = 12, PW = W - PX - 16, PHt = H - PY - 34;
  var X = function (day) { return PX + day / span * PW }, Y = function (nn) { return PY + PHt - (nn / total) * PHt };
  var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">';
  [0, .5, 1].forEach(function (f) { var y = PY + PHt - f * PHt; h += '<line x1="' + PX + '" y1="' + y.toFixed(1) + '" x2="' + (PX + PW) + '" y2="' + y.toFixed(1) + '" stroke="rgba(245,242,236,.08)"/><text x="' + (PX - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="9" fill="#8A8278">' + Math.round(f * total) + '</text>' });
  [30, 60, 90].forEach(function (d) { if (d <= span) h += '<line x1="' + X(d).toFixed(1) + '" y1="' + PY + '" x2="' + X(d).toFixed(1) + '" y2="' + (PY + PHt) + '" stroke="rgba(245,242,236,.08)" stroke-dasharray="2 4"/><text x="' + X(d).toFixed(1) + '" y="' + (PY + PHt + 16) + '" text-anchor="middle" font-size="9" fill="#8A8278">day ' + d + '</text>' });
  h += '<line x1="' + X(0).toFixed(1) + '" y1="' + Y(0).toFixed(1) + '" x2="' + X(Math.min(90, span)).toFixed(1) + '" y2="' + Y(total).toFixed(1) + '" stroke="#8A8278" stroke-dasharray="4 4" stroke-opacity=".6"><title>Ideal pace: all ' + total + ' steps by day 90</title></line>';
  var pth = ['M' + X(0).toFixed(1) + ' ' + Y(0).toFixed(1)], n = 0;
  events.forEach(function (e) { var day = Math.max(0, Math.min(span, Math.round((e.d - sd) / 86400000))); pth.push('L' + X(day).toFixed(1) + ' ' + Y(n).toFixed(1)); n++; pth.push('L' + X(day).toFixed(1) + ' ' + Y(n).toFixed(1)) });
  pth.push('L' + X(Math.min(elapsed, span)).toFixed(1) + ' ' + Y(n).toFixed(1));
  h += '<path d="' + pth.join(' ') + '" fill="none" stroke="#D4A017" stroke-width="2"/>';
  h += '<circle cx="' + X(Math.min(elapsed, span)).toFixed(1) + '" cy="' + Y(n).toFixed(1) + '" r="4" fill="#D4A017"/>';
  h += '<text x="' + X(Math.min(elapsed, span)).toFixed(1) + '" y="' + (Y(n) - 8).toFixed(1) + '" text-anchor="middle" font-size="9" fill="#D4A017">TODAY \u00b7 ' + n + '/' + total + '</text></svg>';
  var st = mgStats();
  h += '<div class="t-faint-sm" style="text-align:center;margin-top:4px;color:' + (st.delta >= 0 ? 'var(--ph1-t)' : '#C25B73') + '">' + (st.delta >= 0 ? '\u25b2 ' : '\u25bc ') + Math.abs(st.delta).toFixed(1) + ' steps ' + (st.delta >= 0 ? 'ahead of' : 'behind') + ' the ideal pace</div>';
  return h
}
function mgVelocity() {
  var dts = data.stepDoneAt || {}, co = data.completedSteps || {};
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var weeks = [], i; for (i = 0; i < 13; i++)weeks.push(0); var any = false;
  mgSteps().forEach(function (s) { if (co[s.id] && dts[s.id]) { any = true; var w = Math.floor((new Date(dts[s.id]) - sd) / (7 * 86400000)); if (w < 0) w = 0; if (w > 12) w = 12; weeks[w]++ } });
  if (!any) return '<p class="t-faint-sm">No completion dates recorded yet \u2013 velocity appears as steps are marked complete.</p>';
  var curW = Math.min(12, Math.max(0, Math.floor((Date.now() - sd.getTime()) / (7 * 86400000))));
  var W = 560, H = 170, PX = 26, PY = 20, PW = W - PX - 10, PHt = H - PY - 28;
  var bw = PW / 13, mx = Math.max.apply(null, weeks.concat([1]));
  var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">';
  weeks.forEach(function (v, j) {
    var bh = v / mx * PHt, x = PX + j * bw + 3, y = PY + PHt - bh; var col = j === curW ? '#D4A017' : '#4FB39A';
    h += '<rect x="' + x.toFixed(1) + '" y="' + PY + '" width="' + (bw - 6).toFixed(1) + '" height="' + PHt + '" rx="4" fill="rgba(245,242,236,.03)"/>';
    if (v) h += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 6).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + col + '" fill-opacity=".85"><title>Week ' + (j + 1) + ': ' + v + ' step' + (v > 1 ? 's' : '') + '</title></rect>';
    if (v) h += '<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#F5F2EC">' + v + '</text>';
    h += '<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (PY + PHt + 16) + '" text-anchor="middle" font-size="8.5" fill="' + (j === curW ? '#D4A017' : '#8A8278') + '">W' + (j + 1) + '</text>'
  });
  h += '</svg><div class="t-faint-sm" style="text-align:center;margin-top:4px">Gold bar = current program week</div>';
  return h
}
function mgSignals() {
  var steps = mgSteps(), co = data.completedSteps || {}, due = data.stepDue || {}, dts = data.stepDoneAt || {}, assigns = data.assigns || {};
  var withOwner = steps.filter(function (s) { return (assigns[s.id] || []).length }).length;
  var withDue = steps.filter(function (s) { return due[s.id] }).length;
  var met = 0, miss = 0; steps.forEach(function (s) { if (co[s.id] && due[s.id] && dts[s.id]) { if (dts[s.id] <= due[s.id]) met++; else miss++ } });
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var h = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:center">';
  var cellS = function (v, l) { return '<div><div class="fs-14"><strong>' + v + '</strong></div><div class="t-faint-sm" style="margin-top:2px">' + l + '</div></div>' };
  h += cellS(withOwner + ' of ' + steps.length, 'steps with an owner');
  h += cellS(withDue + ' of ' + steps.length, 'steps with a deadline');
  h += cellS((met + miss) ? met + ' met \u00b7 ' + miss + ' missed' : '\u2014', 'deadlines on completed steps');
  h += '</div>';
  var meds=PH.filter(function(p){return p.id!==5}).map(function(p){var shared=p.steps.filter(function(st){return !INDIVIDUAL_TRACK_STEPS[st.id]});var ds=shared.filter(function(st){return co[st.id]&&dts[st.id]}).map(function (st) { return Math.round((new Date(dts[st.id]) - sd) / 86400000) }).sort(function (a, b) { return a - b }); var med = ds.length ? ds[Math.floor((ds.length - 1) / 2)] : null; var doneN=shared.filter(function(st){return co[st.id]}).length;return{p:p,med:med,doneN:doneN,n:shared.length} });
  h += '<div style="margin-top:10px">' + meds.map(function (x) { return '<div class="row-line"><span class="fs-13" style="flex:1;color:' + x.p.color + '">Phase ' + x.p.id + ' \u2013 ' + esc(x.p.name) + '</span><span class="t-faint-sm">' + x.doneN + ' / ' + x.n + ' complete' + (x.med != null ? ' \u00b7 median completion day ' + x.med : '') + '</span></div>' }).join('') + '</div>';
  return h
}
function mgWeek() {
  var steps = mgSteps(), co = data.completedSteps || {}, due = data.stepDue || {};
  var today = new Date().toISOString().split('T')[0];
  var week = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  var overdue = steps.filter(function (s) { return !co[s.id] && due[s.id] && due[s.id] < today });
  var upcoming = steps.filter(function (s) { return !co[s.id] && due[s.id] && due[s.id] >= today && due[s.id] <= week });
  if (!overdue.length && !upcoming.length) return '<p class="t-faint-sm">Nothing due in the next seven days and nothing overdue.</p>';
  return overdue.concat(upcoming).map(function (s2) { return mgRowHtml(s2.id, s2.name) }).join('')
}
function mgRowHtml(id2, name) {
  var co = data.completedSteps || {}, due = data.stepDue || {}, dts = data.stepDoneAt || {};
  var today = new Date().toISOString().split('T')[0];
  var doneS = !!co[id2]; var d2 = due[id2] || ''; var over = !doneS && d2 && d2 < today;
  return '<div style="display:grid;grid-template-columns:minmax(160px,1fr) 300px 240px;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)">'
    + '<div style="display:flex;align-items:baseline;gap:10px"><span class="t-faint-sm" style="min-width:26px">' + id2 + '</span><span class="fs-14">' + esc(name) + '</span></div>'
    + '<div style="display:flex;justify-content:flex-start;align-items:center;gap:8px;flex-wrap:wrap">'
    + (doneS ? badge('\u2713 done' + (dts[id2] ? ' \u00b7 ' + fmtDate(dts[id2]) : ''), '#1B6B5A') + (d2 ? '<span class="t-faint-sm">was due ' + fmtDate(d2) + '</span>' : '') : over ? badge('overdue \u00b7 was due ' + fmtDate(d2), '#C25B73') : d2 ? badge('due ' + fmtDate(d2), '#D4A017') : badge('open', '#2D5A8E'))
    + (doneS ? '' : '<input type="date" value="' + esc(d2) + '" onchange="mgDueSave(\'' + id2 + '\',this.value)" onblur="deferRender()" title="Optional deadline" style="font-size:11px;padding:3px 6px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px"/>')
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:2px">' + assignBtn(id2) + '</div>'
    + '</div>'
}
function mgWorkload() {
  var steps = mgSteps(), co = data.completedSteps || {}, assigns = data.assigns || {};
  var rows = USERS.map(function (u) { var open = 0, done = 0; steps.forEach(function (s) { if ((assigns[s.id] || []).indexOf(u.id) >= 0) { if (co[s.id]) done++; else open++ } }); return { u: u, open: open, done: done } }).filter(function (r) { return r.open + r.done > 0 });
  if (!rows.length) return '<p class="t-faint-sm">No assignments yet \u2013 assign members on the Assignments tab.</p>';
  var mx = Math.max.apply(null, rows.map(function (r) { return r.open + r.done }));
  rows.sort(function (a, b) { return (b.open - a.open) || (b.done - a.done) });
  var h = ''; rows.forEach(function (r) {
    var wO = (r.open / mx) * 100, wD = (r.done / mx) * 100;
    h += '<div style="display:flex;align-items:center;gap:10px;padding:5px 0"><div style="width:26px">' + userAv(r.u, 24) + '</div><div class="fs-13" style="width:140px">' + esc(r.u.name) + '</div>'
      + '<div style="flex:1;height:12px;background:rgba(var(--fg-rgb),.05);border-radius:6px;overflow:hidden;display:flex">'
      + (r.open ? '<div style="width:' + wO.toFixed(1) + '%;background:#D4A017"><title></title></div>' : '')
      + (r.done ? '<div style="width:' + wD.toFixed(1) + '%;background:#4FB39A;opacity:.45"></div>' : '')
      + '</div><div class="t-faint-sm" style="width:130px;text-align:right">' + r.open + ' open \u00b7 ' + r.done + ' complete</div></div>'
  });
  h += '<div class="t-faint-sm" style="margin-top:6px">Sorted by open load \u2013 gold is open work, faded teal is complete.</div>';
  return h
}
function mgmtHubContent() { /* the hub body, callable for the page, the PDF, and the notification emails (July 7) */
  var st = mgStats(), co = data.completedSteps || {}, due = data.stepDue || {}, dts = data.stepDoneAt || {}, assigns = data.assigns || {};
  var today = new Date().toISOString().split('T')[0];
  var h = '<div class="mb-6">' + badge('Ongoing', '#6B4C8A') + '<h1 class="section-title u-967e19d">Module <em>Management</em></h1><p class="u-98b80d8">Every step of the module in one place: who owns it, when it is due, and how completion is tracking against the 90 days.</p></div>';
  var tile = function (v, l, c) { return '<div style="text-align:center"><div class="score-num-md" style="font-size:26px;line-height:1.2' + (c ? ';color:' + c : '') + '">' + v + '</div><div class="t-faint-sm" style="margin-top:3px">' + l + '</div></div>' };
  h += card('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'
    + tile(st.done + ' / ' + st.total, 'steps complete')
    + tile('Day ' + Math.min(st.elapsed, 90) + (st.elapsed > 90 ? ' (+' + (st.elapsed - 90) + ' over)' : ''), 'of the 90')
    + tile((st.delta >= 0 ? '+' : '\u2212') + Math.abs(st.delta).toFixed(1), 'steps vs ideal pace', st.delta >= 0 ? 'var(--ph1-t)' : '#C25B73')
    + tile(String(st.overdue), 'overdue', st.overdue ? '#C25B73' : null)
    + '</div>', 'margin-bottom:16px');
  var _mt = UI.mgTab || 0;
  var _mtb = function (n, l) { return '<button class="btn-ghost pad-chip-md' + (_mt === n ? ' nav-action-on' : '') + '" style="font-size:13px' + (_mt === n ? ';border-color:var(--warn-text);color:var(--warn-text)' : '') + '" onclick="UI.mgTab=' + n + ';render()">' + l + '</button>' };
  h += '<div style="display:flex;gap:8px;margin-bottom:16px">' + _mtb(0, 'Assignments') + _mtb(1, 'Analytics') + '</div>';
  if (_mt === 1) {
    h += card('<h3 class="h-sub-md">90-Day Burn-up</h3><p class="t-faint-sm" style="margin:4px 0 10px">Cumulative step completion against the ideal pace \u2013 the dashed line finishes all ' + st.total + ' steps by day 90.</p>' + mgBurnup(), 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md">Module Velocity</h3><p class="t-faint-sm" style="margin:4px 0 10px">Steps completed per program week, from completion dates.</p>' + mgVelocity(), 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md">Workload by Member</h3><p class="t-faint-sm" style="margin:4px 0 10px">Open and completed step assignments \u2013 gold shows who is carrying open work now.</p>' + mgWorkload(), 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md">Signals</h3>' + mgSignals(), 'margin-bottom:16px');
  } else {
    h += card('<h3 class="h-sub-md">This Week</h3><p class="t-faint-sm" style="margin:4px 0 8px">Steps overdue or due within seven days.</p>' + mgWeek(), 'margin-bottom:16px');
    PH.forEach(function (p) {
      if (p.days === 'Ongoing') return;
      var rows = ''; p.steps.forEach(function (stp) {
        var id2 = stp.id; if (INDIVIDUAL_TRACK_STEPS[id2]) return;
        rows += mgRowHtml(id2, stp.name)
      });
      h += card('<h3 class="h-sub-md" style="color:' + p.color + '">Phase ' + p.id + ' \u2013 ' + esc(p.name) + ' <span class="t-faint-sm" style="font-weight:400">(' + p.days + ')</span></h3>' + rows, 'margin-bottom:16px');
    });
  }
  return h
}
/* ================= Email Notifications (Paul, July 7) =================
   Client-side complete; INERT until the dev team wires the AWS service.
   Contract (see AWS_Notifications_Contract.md in the handoff set):
   - Set NOTIFY_ENDPOINT to the service URL. The app POSTs JSON:
     {kind, subject, to:[emails], stepId, orgName, sentAt, pdf, html}
   - kind 'step-complete': html = completion notice + the full Module
     Management analytics page (stat band included). pdf:true — the
     service converts the html to PDF (wrap with the app stylesheet)
     and mails it as an attachment to every address in `to`.
   - kind 'deadline-reminder': plain notice, pdf:false, sent to the
     administrator-role member(s) plus the step's assignees.
   - Until the endpoint is set, every notification is recorded in the
     local outbox (data.notifications) with status 'pending'.
   Admin rule: roster members flagged admin:true (the org's administrator account) - role text is cosmetic (ruled July 9)
   (case-insensitive). No match => assignees only, and the outbox
   entry notes the gap.
   ======================================================================= */
var NOTIFY_ENDPOINT = ''; /* dev team: set to the AWS notification service URL */
function notifyMemberEmails(list) { return (list || USERS || []).map(function (u) { return u && u.email }).filter(function (e) { return e && /\S+@\S+/.test(e) }) }
function notifyAdmins() { return (USERS || []).filter(function (u) { return u && u.admin === true }) } /* flag-based (ruled July 9): role text is a label, admin:true is the authority record */
function notifyStepName(id) { var nm = id; (PH || []).forEach(function (p) { (p.steps || []).forEach(function (st) { if (st.id === id) nm = 'Step ' + st.id + ' \u2013 ' + st.name }) }); return nm }
function notifyQueue(kind, subject, to, stepId, pdf) {
  if (!to || !to.length) return;
  if (!data.notifications) data.notifications = [];
  var n = { at: Date.now(), kind: kind, subject: subject, to: to, stepId: stepId || '', pdf: !!pdf, status: NOTIFY_ENDPOINT ? 'sending' : 'pending \u2013 endpoint not configured' };
  data.notifications.push(n); if (data.notifications.length > 50) data.notifications = data.notifications.slice(-50);
  Store.commit('notifications');
  notifyDispatch(n); return n
}
function notifyEmailHtml(n) {
  var head = '<h2 style="font-family:Helvetica,Arial,sans-serif">' + esc(n.subject) + '</h2><p>' + (n.kind === 'step-complete' ? esc(notifyStepName(n.stepId)) + ' was marked complete on ' + fmtDate(n.at) + '. The current Module Management analytics report is attached.' : 'The assigned step ' + esc(notifyStepName(n.stepId)) + ' is due within one week (' + esc(((data.stepDue || {})[n.stepId] ? fmtDate((data.stepDue || {})[n.stepId]) : '')) + ').') + '</p>';
  return n.kind === 'step-complete' ? head + '<hr/>' + (function () { var _t = UI.mgTab; UI.mgTab = 1; var hub = mgmtHubContent(); UI.mgTab = _t; return hub; })() : head
} /* §12: the email always embeds the analytics page (ruled July 16) */
function notifyDispatch(n) {
  if (SAMPLE_MODE || !NOTIFY_ENDPOINT) return; /* Part 3: the sample tab sends no email */ /* inert until wired \u2013 outbox holds the record */
  try {
    fetch(NOTIFY_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: n.kind, subject: n.subject, to: n.to, stepId: n.stepId, orgName: (data.enterprise || {}).name || '', sentAt: new Date(n.at).toISOString(), pdf: n.pdf, html: notifyEmailHtml(n) }) })
      .then(function (r) { n.status = r.ok ? 'sent' : 'failed (' + r.status + ')'; Store.commit('notifications'); render() })
      .catch(function () { n.status = 'failed (network)'; Store.commit('notifications'); render() })
  } catch (e) { n.status = 'failed'; Store.commit('notifications') }
}
function notifyStepComplete(id) {
  try {
    var to = notifyMemberEmails(); if (!to.length) return;
    notifyQueue('step-complete', notifyStepName(id) + ' complete \u2013 analytics report', to, id, true)
  } catch (e) { }
}
function notifySweepDeadlines() {
  try {
    var due = data.stepDue || {}, assigns = data.assigns || {}, co = data.completedSteps || {};
    if (!data.remind7) data.remind7 = {};
    var today = new Date(); today.setHours(0, 0, 0, 0);
    Object.keys(due).forEach(function (id) {
      if (!due[id] || co[id] || data.remind7[id]) return;
      var who = assigns[id] || []; if (!who.length) return; /* reminders are for ASSIGNED deadlines */
      var d = new Date(due[id] + 'T00:00:00'); var days = Math.round((d - today) / 86400000);
      if (days < 0 || days > 7) return;
      var admins = notifyAdmins();
      var to = notifyMemberEmails(admins.concat((USERS || []).filter(function (u) { return who.indexOf(u.id) >= 0 && admins.indexOf(u) < 0 })));
      if (!to.length) return;
      var n = notifyQueue('deadline-reminder', notifyStepName(id) + ' due ' + due[id], to, id, false);
      if (n && !admins.length) n.status += ' \u00b7 no administrator on the roster';
      data.remind7[id] = true; Store.commit('remind7')
    })
  } catch (e) { }
}
function notifyOutboxCard() { /* not mounted – kept demo-clean (Paul, July 7); remount in renderMgmtHub if an in-app delivery log is wanted once AWS is wired */
  var ns = (data.notifications || []).slice(-8).reverse();
  var rows = ns.map(function (n) { return '<div class="row-line"><span class="fs-13" style="flex:1">' + esc(n.subject) + '</span><span class="t-faint-sm">' + fmtDate(n.at) + ' \u00b7 ' + n.to.length + ' recipient' + (n.to.length > 1 ? 's' : '') + ' \u00b7 ' + esc(n.status) + '</span></div>' }).join('');
  return card('<h3 class="h-sub-md">Email Notifications</h3><p class="t-faint-sm" style="margin:-2px 0 8px">Step-completion reports go to the whole team; deadline reminders go to the administrator and the assignees one week out. ' + (NOTIFY_ENDPOINT ? 'Dispatching to the configured service.' : 'The dispatch service is not yet wired \u2013 notifications queue here until the dev team connects AWS.') + '</p>' + (rows || '<p class="t-faint-sm">\u2014</p>'), 'margin-bottom:16px')
}

function renderMgmtHub() {
  var _w = '<div class="content-area pt-110"><div class="content-inner">';
  return _w + backBtn() + '<div style="display:flex;justify-content:flex-end;margin:0 0 10px">' + btn('\u25BE Save as PDF', 'printMgmtAnalytics()', 'bg2', 'font-size:12px') + '</div>' + mgmtHubContent() + '</div></div>'
}
/* MODULE MANAGEMENT DOCUMENT (Governance, 14 Sep 2026, Paul's ruling; ported to Executive Readiness 16 Sep 2026 on his word): the Track Program page prints as its own document rather than a snapshot of the tab showing. Page one: the four figures; This Week; every shared step by phase with its owners, its due date, and its state. Page two: the burn-up beside the velocity chart; the workload by member; the signals. The tab buttons, the due-date fields, and the assignment controls do not print. ER's one difference: the individual-track steps, which never enter the shared program, are left out as mgSteps leaves them out */
function mgmtHubDoc(){var st=mgStats(),co=data.completedSteps||{},due=data.stepDue||{},dts=data.stepDoneAt||{};
  var today=new Date().toISOString().split('T')[0];var week=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  var owners=function(id){return ((data.assigns||{})[id]||[]).map(function(uid){var u=(USERS||[]).find(function(x){return x.id===uid});return u?u.name:''}).filter(Boolean).join(', ')};
  var state=function(id){var d2=due[id]||'';if(co[id])return 'Done'+(dts[id]?' \u00b7 '+lyDate(dts[id]):'')+(d2?' \u00b7 was due '+lyDate(d2):'');if(d2&&d2<today)return 'Overdue \u00b7 was due '+lyDate(d2);if(d2)return 'Due '+lyDate(d2);return 'Open'};
  var css='<style>.mh-doc{--ok-t:#1B6B5A}.mh-doc .mh-sec{font-size:20px;font-weight:800;color:#111;margin:0 0 10px;break-after:avoid;page-break-after:avoid}.mh-doc .mh-sec+.mh-sec{margin-top:18px}.mh-fig{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 18px}.mh-fig div{border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center}.mh-fig b{display:block;font-size:22px;font-weight:700;color:#111}.mh-fig span{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.08em}.mh-tbl{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 12px}.mh-tbl th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;text-align:left;padding:4px 6px;border-bottom:1px solid #111}.mh-tbl td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}.mh-tbl tr{break-inside:avoid;page-break-inside:avoid}.mh-id{font-family:var(--mono,monospace);font-size:11px;color:#555}.mh-ph{font-size:15px;font-weight:700;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}.mh-ph span{font-weight:400;color:#666;font-size:12px}.mh-lead{font-size:12px;color:#555;margin:0 0 6px}.mh2{display:flex;gap:12px;align-items:stretch;break-inside:avoid;page-break-inside:avoid}.mh2>*{flex:1;min-width:0}.mh-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 12px;background:none;break-inside:avoid;page-break-inside:avoid}.mh-doc .cd h3{font-size:14px;font-weight:700;margin:0 0 4px;color:#111}.mh-doc .t-faint-sm{font-size:11.5px;color:#555}.mh-doc .fs-13{font-size:12.5px}.mh-doc .fs-14{font-size:13px}.mh-doc svg{max-width:100%}</style>';
  var h=printDocCover('Module Management','Every step of the module in one place \u2013 who owns it, when it is due, and how completion is pacing against the 90 days.','')+css+'<div class="mh-doc">';
  var fig=function(v,l){return '<div><b>'+v+'</b><span>'+l+'</span></div>'};
  h+='<div class="mh-fig">'+fig(st.done+' / '+st.total,'steps complete')+fig('Day '+Math.min(st.elapsed,90)+(st.elapsed>90?' (+'+(st.elapsed-90)+' over)':''),'of the 90')+fig((st.delta>=0?'+':'\u2212')+Math.abs(st.delta).toFixed(1),'steps vs ideal pace')+fig(String(st.overdue),'overdue')+'</div>';
  var steps=mgSteps();var wk=steps.filter(function(s2){return !co[s2.id]&&due[s2.id]&&due[s2.id]<=week}); /* overdue, or due within seven days */
  var tbl=function(list){var t='<table class="mh-tbl"><thead><tr><th style="width:8%">Step</th><th>Name</th><th style="width:28%">Owners</th><th style="width:30%">State</th></tr></thead><tbody>';
    list.forEach(function(s2){var o=owners(s2.id);t+='<tr><td class="mh-id">'+esc(s2.id)+'</td><td>'+esc(s2.name)+'</td><td>'+(o?esc(o):'<span style="color:#999">Not assigned</span>')+'</td><td>'+esc(state(s2.id))+'</td></tr>'});return t+'</tbody></table>'};
  h+='<div class="mh-sec">This Week</div><div class="mh-lead">Steps overdue or due within seven days.</div>'+(wk.length?tbl(wk):'<div class="t-faint-sm" style="font-style:italic;margin:0 0 12px">Nothing due in the next seven days and nothing overdue.</div>');
  h+='<div class="mh-sec">Assignments</div>';
  PH.forEach(function(p){if(p.days==='Ongoing')return;var list=steps.filter(function(s2){return s2.ph===p});if(!list.length)return;h+='<div class="mh-ph" style="color:'+p.color+'">Phase '+p.id+' \u2013 '+esc(p.name)+' <span>('+esc(p.days)+')</span></div>'+tbl(list)});
  /* page two: the analytics */
  h+='<div style="break-before:page;page-break-before:always"><div class="mh-sec">Analytics</div>';
  h+='<div class="mh2">'+card('<h3>90-Day Burn-up</h3><p class="t-faint-sm" style="margin:0 0 8px">Cumulative step completion against the ideal pace \u2013 the dashed line finishes all '+st.total+' steps by day 90.</p>'+mgBurnup())+card('<h3>Module Velocity</h3><p class="t-faint-sm" style="margin:0 0 8px">Steps completed per program week, from completion dates.</p>'+mgVelocity())+'</div>';
  h+=card('<h3>Workload by Member</h3><p class="t-faint-sm" style="margin:0 0 8px">Open and completed step assignments \u2013 gold shows who is carrying open work now.</p>'+mgWorkload());
  h+=card('<h3>Signals</h3>'+mgSignals())+'</div>';
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<input[^>]*>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')}
function printMgmtAnalytics(){printDocument('Module Management',mgmtHubDoc(),'')} /* 14 Sep 2026 (Governance, Paul's ruling), ported 16 Sep 2026: the Track Program page prints as its own document */


function printPage(title,contentFn){var raw=contentFn();printDocument(title,printDocCover(title,_pdLead(raw),'')+_pdStrip(raw),'')} /* 12 Sep 2026 (Paul's ruling; family): a cover, the body without its heading block and without controls, the copyright footer on every page */
function printDocument(title,content,extraCss,opts){ /* 14 Sep 2026: opts.preview shows the document as a sheet with its forced page breaks marked and a Show as pages button, and does not open the print dialog */ /* 13 Sep 2026: the shared print window – the family styles, an optional stylesheet for bespoke report documents, the content, the footer */
var w=window.open('');if(!w){alert('The print view was blocked by the browser. Allow pop-ups for this site and try again.');return}
w.document.write('<html><head><title>'+title+'</title>'+
'<link rel="stylesheet" href="'+(function(){try{return new URL('fonts/print.css', document.baseURI || location.href).href}catch(e){return 'fonts/print.css'}})()+'">'+ /* Part 1 (2 Oct 2026): our own fonts, not Google's; print.css = exactly the weights this window loaded from Google. The window is empty, so the address is absolute (baseURI = location.href here; it also holds under a <base> tag) */
'<style>'+printThemeTokens()+'*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Helvetica Neue",Arial,sans-serif;max-width:750px;margin:40px auto;padding:0 40px;line-height:1.7;font-size:14px;color:#1e2530;background:#fff}'+
'h1,h2,h3,h4{color:#1a1612;break-after:avoid;page-break-after:avoid}a{color:#2D5A8E}'+
'.btn,.btn-ghost,.bp,.bs,.bg,.bg2,.bd{display:none !important}button{display:none !important}'+
'.cd{background:none;border:none;border-radius:0;padding:8px 0;margin-bottom:14px;page-break-inside:avoid}'+
'select{-webkit-appearance:none;appearance:none;border:none;background:none;font-weight:600;font-size:13px;color:#1a1612}textarea{border:none;background:none;font-size:13px;color:#1e2530;resize:none}'+
'table{border-collapse:collapse;width:100%}th,td{padding:7px 8px;vertical-align:top;border-bottom:1px solid #e0e0e0;text-align:left}'+
'*{-webkit-print-color-adjust:exact;print-color-adjust:exact}[style*="#F5F2EC"],[style*="#8A8278"],[style*="rgba(245,242,236"],[style*="rgba(138,130,120"],[style*="color:var(--paper)"]{color:#1e2530 !important}[style*="color:var(--stone)"],[style*="color:var(--text-muted)"],[style*="color:var(--text-faint)"]{color:#555 !important}@media print{body{margin:0;padding:0}}'+
'@page{margin:16mm 14mm 20mm 14mm;@top-left{content:""}@top-center{content:""}@top-right{content:""}@bottom-center{content:""}@bottom-left{content:"'+printFooterText()+'";font:9px "DM Mono",monospace;color:#666}@bottom-right{content:counter(page) " / " counter(pages);font:9px "DM Mono",monospace;color:#666}}'+ /* PRINT MARGINS (Paul's ruling, 12 Sep 2026; family): the document owns all six page corners — the top three empty, the copyright line bottom left, the page number bottom right — so the browser's own date, title, address, and count never print, whatever the user's Headers and footers setting */
'.print-footer{display:none}@media screen{.print-footer{display:block;margin-top:40px;padding-top:10px;border-top:1px solid #ddd;font-family:"DM Mono",monospace;font-size:9px;letter-spacing:.06em;color:#666}}'+ /* on screen, before printing, the copyright line ends the document */
(extraCss||'')+'</style></head><body>'+((opts&&opts.preview)?'<div class="preview-note" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:12px/1.5 var(--sans,sans-serif);color:#333;background:#FBF6EC;border:1px solid #E8D9B8;padding:8px 12px;margin:0 0 24px"><button onclick="window.print()" style="font:12px var(--sans,sans-serif);font-weight:600;padding:6px 14px;border:1px solid #333;border-radius:6px;background:#fff;color:#111;cursor:pointer;white-space:nowrap">Show as pages</button><span style="flex:1;min-width:240px">Preview. Dashed rules below mark where the document forces a page break; where the printer breaks a long section in the middle is set when it prints. Show as pages opens your browser\u2019s print preview, where the pages are exact, and Cancel returns here.</span></div>'+'<style>@media print{.preview-note{display:none}}@media screen{html{background:#e6e6e6}body{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 32px rgba(0,0,0,.08);padding:56px 64px !important;margin:24px auto !important}[style*="break-before:page"]::before,[style*="page-break-after:always"]:not([style*="display:flex"])::after,[style*="min-height:85vh"]+*::before{content:"page break";display:block;text-align:center;font:10px "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#999;border-top:1px dashed #bbb;padding-top:6px;margin:28px 0 24px}[style*="page-break-after:always"]+[style*="break-before:page"]::before{display:none}}</style>':'')+content+'<div class="print-footer">'+printFooterText()+'</div></body></html>');
w.document.close();if(!(opts&&opts.preview))setTimeout(function(){w.print()},500)}

/* ═══ INIT ═══ */
function userAv(u, size) { var s = size || 28; var txt = (function () { var h = (u.color || '#888888').replace('#', ''); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#1A1612' : '#fff'; })(); return '<div title="' + esc(u.name) + '" style="width:' + s + 'px;height:' + s + 'px;border-radius:' + s / 2 + 'px;background:' + (u.color || '#888888') + ';color:' + txt + ';display:inline-flex;align-items:center;justify-content:center;font-size:' + (s * .38) + 'px;font-weight:700;flex-shrink:0;letter-spacing:0">' + esc(u.initials) + '</div>' } /* luminance text + 28px default adopted (§5A.10, ruled July 16) */
function signOut() {
  if (SAMPLE_MODE) { closeSample(); return; } /* Sweep 4R item 9 (addendum 5 Oct 2026; amends Part 3): in the sample tab Sign Out closes the tab; it never signs anyone out, never opens sign-in and writes nothing */
  if (!confirm('Sign out? Your work is saved.')) return;
  try { Collab.leave(); } catch (e) { }
  sealSession();
  Auth.signOut();
  Auth.clearSession();
  UI.entry = { step: 'login', err: '' };
  render();
}

/* ═══ ASSIGNMENT ═══ */
function assignBtn(taskId) {
  var assigns = (data.assigns || {})[taskId] || [];
  var isOpen = UI.assignOpen === taskId;
  var h = '<div style="position:relative;display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap">';
  assigns.forEach(function (uid) { var u = USERS.find(function (x) { return x.id === uid }); if (u) h += userAv(u) });
  h += '<button onclick="event.stopPropagation();UI.assignOpen=UI.assignOpen===\'' + taskId + '\'?null:\'' + taskId + '\';render()" title="Assign members" style="padding:3px 10px;border-radius:6px;border:1px dashed rgba(var(--fg-rgb),.25);background:transparent;cursor:pointer;font-size:11px;font-weight:600;color:var(--stone);font-family:var(--sans)">+ Assign</button>';
  if (isOpen) {
    h += '<div onclick="event.stopPropagation()" style="position:absolute;right:0;top:30px;background:var(--ink);border:1px solid rgba(var(--fg-rgb),.15);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.4);padding:8px;z-index:100;min-width:220px">';
    USERS.forEach(function (u) {
      var isSel = assigns.indexOf(u.id) >= 0;
      h += '<button onclick="event.stopPropagation();toggleAssign(\'' + taskId + '\',\'' + u.id + '\')" title="' + (isSel ? 'Click to remove' : 'Click to assign') + '" style="display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;background:' + (isSel ? 'rgba(27,107,90,.08)' : 'transparent') + ';cursor:pointer;border-radius:4px;font-family:var(--sans);text-align:left">';
      h += userAv(u, 24);
      h += '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--paper)">' + esc(u.name) + '</div><div style="font-size:10px;color:var(--stone)">' + esc(u.role) + ' \u00B7 ' + esc(u.scope) + '</div></div>';
      if (isSel) h += '<span style="color:#1B6B5A;margin-left:auto">\u2713</span>';
      h += '</button>';
    });
    h += '<button onclick="event.stopPropagation();UI.assignOpen=null;render()" style="width:100%;padding:6px;margin-top:4px;border:1px solid rgba(var(--fg-rgb),.12);border-radius:4px;background:rgba(var(--fg-rgb),.03);cursor:pointer;font-size:11px;font-family:var(--sans);color:var(--stone)">Done</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}
function toggleAssign(taskId, uid) {
  if (!data.assigns) data.assigns = {};
  var cur = data.assigns[taskId] || [];
  if (cur.indexOf(uid) >= 0) { data.assigns[taskId] = cur.filter(function (x) { return x !== uid }) }
  else { data.assigns[taskId] = cur.concat([uid]) }
  saveData(); render();
}

function closeHelp() { currentModal = null; var mr = document.getElementById('modalRoot'); if (mr) mr.innerHTML = ''; }

function openHelp() {
  var mr = document.getElementById('modalRoot');
  if (!mr) return;
  currentModal = 'help'; // family modal flag: the item-4 carousel pause and modal-keyed behavior read this
  var sl = 'font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--gold);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:10px';
  var row = 'display:grid;grid-template-columns:110px 1fr;gap:12px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06)';
  var key = 'font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);padding-top:2px';
  var val = 'font-size:13px;color:var(--stone);line-height:1.65';
  var sec = 'margin-bottom:24px';
  var body = 'font-size:14px;color:var(--stone);line-height:1.75';
  var h = '';
  h += '<div style="position:fixed;inset:0;background:rgba(26,22,18,.9);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:32px 24px;overflow-y:auto" onclick="if(event.target===this)closeHelp()">';
  h += '<div style="background:var(--ink);border:1px solid rgba(var(--gold-rgb),.35);padding:40px 48px;max-width:680px;width:100%;position:relative">';

  h += '<h3 style="font-family:var(--serif);font-size:28px;font-weight:300;color:var(--paper);margin-bottom:6px">Executive Readiness Program</h3>';

  h += '<div style="background:rgba(var(--gold-rgb),.08);border-left:2px solid var(--gold);padding:16px 20px;margin-bottom:28px;font-family:var(--serif);font-size:17px;font-style:italic;font-weight:300;line-height:1.55;color:var(--paper)">A step-by-step tool for building AI-era leadership readiness, built on Faisal Hoque\u2019s published frameworks. This guide explains how the module is organized and how each of its surfaces works.</div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">What This Is<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<p style="' + body + '">A structured 90-day leadership program. Four sprint phases \u2014 Assess, Build, Develop, Embed \u2014 run across the 90 days, and a fifth, Lead, runs on after the sprint ends. Two tracks run in parallel inside each phase: shared organizational design and individual mindset development. Each phase breaks into guided steps, and every phase produces output documents you can print. Your progress, assessments, structures, and outputs are saved as you work.</p></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">Getting Around<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<div style="display:grid;gap:8px">';
  h += '<div style="' + row + '"><div style="' + key + '">Top nav</div><div style="' + val + '">Home \xb7 Learn \xb7 Readiness \xb7 Lead \xb7 Insights on the left. Your profile chip, Help, the Light/Dark toggle, Team Chat, Notes, and a More menu sit at the top right; Track Program lives under More.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">More menu</div><div style="' + val + '">View zoom controls, Track Program, Voice, Profile (your organization & team), Seed sample data, and Export and Import state. App admins also see an Admin entry.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Left sidebar</div><div style="' + val + '">Visible on Readiness and Lead pages. Shows all five phases, every step, the \u25C8 individual-track rows, and every output document. Click \u2630 to show or hide it.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Phase landings</div><div style="' + val + '">Click any phase from the sidebar or the Readiness overview. Each shows the phase intro video, live completion metrics, the full step sequence, and links to the phase outputs. Phase 5 lands directly on the Leadership Dashboard.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Step pages</div><div style="' + val + '">Each step opens with a concept carousel that auto-advances (hover to pause), then guided work sections in tabs, each with its own discrete completion control. Every step carries an \u201CAssigned to\u201D bar so a named owner can take it. Steps build on each other; work them in order.</div></div>';
  h += '</div></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">Signing In & Organizations<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<div style="display:grid;gap:8px">';
  h += '<div style="' + row + '"><div style="' + key + '">Sign in</div><div style="' + val + '">Enter your username and password on the launch screen to go straight into your organization\u2019s workspace. Tick \u201CRemember me\u201D to skip sign-in next time on this device.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">New organization</div><div style="' + val + '">\u201CSet up a new organization\u201D on the login screen creates a workspace and your own account; add the rest of your team from Profile.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Multiple organizations</div><div style="' + val + '">Each organization is a fully isolated workspace with its own profile, team, and program data. Nothing is shared between them.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Profiles & Passwords</div><div style="' + val + '">Every member has a username and password. Administrators manage the team under Profile (More menu); everyone changes their own password from the More menu. These identities sign work, drive step assignments, and appear in Team Chat.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Admin</div><div style="' + val + '">Choose \u201CAdmin\u201D on the login screen and enter the administrator username and password. Admins land with an admin bar across the top showing which organization and user they are acting as; the admin console lists every organization and user.</div></div>';
  h += '</div></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">The Five Phases<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<div style="display:grid;gap:0">';
  h += '<div style="display:grid;grid-template-columns:28px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)">';
  h += '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:#1B6B5A;padding-top:2px">01</div>';
  h += '<div><div style="font-size:14px;font-weight:600;color:var(--paper);margin-bottom:4px">Assess \u2014 Days 1\u201325</div>';
  h += '<p style="font-size:13px;color:var(--stone);line-height:1.65;margin-bottom:6px">Run the five-section Assessment Battery \u2014 Purpose & Clarity, AI Fluency, Change Capacity, Structure Baseline, and Ethical Readiness. Map every senior leader onto the Leadership Landscape. Surface and rank the risks. Begin the individual mindset work.</p>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7)"><span style="color:#1B6B5A;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Steps</span>Assessment Battery \xb7 Leadership Landscape \xb7 Risk Mapping \xb7 Mindset Foundations</div>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7);margin-top:3px"><span style="color:#1B6B5A;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Outputs</span>Readiness Report \xb7 Leadership Inventory \xb7 Risk Map</div>';
  h += '</div></div>';
  h += '<div style="display:grid;grid-template-columns:28px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)">';
  h += '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:#2D5A8E;padding-top:2px">02</div>';
  h += '<div><div style="font-size:14px;font-weight:600;color:var(--paper);margin-bottom:4px">Build \u2014 Days 26\u201350</div>';
  h += '<p style="font-size:13px;color:var(--stone);line-height:1.65;margin-bottom:6px">Design the governance architecture across five surfaces: transformation ownership, board governance, senior leadership, middle management, and cross-functional coordination. Define the seven-competency framework and set the collaboration principles for AI-human work.</p>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7)"><span style="color:#2D5A8E;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Steps</span>Leadership Structure Lab \xb7 AI Collaboration Lab \xb7 Competency Framework \xb7 Mindset Depth</div>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7);margin-top:3px"><span style="color:#2D5A8E;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Outputs</span>Leadership Structure \xb7 Collaboration Principles \xb7 Competency Framework</div>';
  h += '</div></div>';
  h += '<div style="display:grid;grid-template-columns:28px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)">';
  h += '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:#8B5E3C;padding-top:2px">03</div>';
  h += '<div><div style="font-size:14px;font-weight:600;color:var(--paper);margin-bottom:4px">Develop \u2014 Days 51\u201375</div>';
  h += '<p style="font-size:13px;color:var(--stone);line-height:1.65;margin-bottom:6px">Every leader uses AI personally on real work in the Fluency Sprint. Four decision simulations put judgment under pressure. Middle managers get practical workflows. The values architecture makes philosophical proficiency concrete.</p>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7)"><span style="color:#8B5E3C;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Steps</span>AI Fluency Sprint \xb7 Decision Simulations \xb7 Middle Management \xb7 Values Architecture \xb7 Mindset Application</div>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7);margin-top:3px"><span style="color:#8B5E3C;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Outputs</span>Fluency Assessment \xb7 Decision Analyses \xb7 MM Principles \xb7 Values Architecture</div>';
  h += '</div></div>';
  h += '<div style="display:grid;grid-template-columns:28px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)">';
  h += '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:#9B2D3F;padding-top:2px">04</div>';
  h += '<div><div style="font-size:14px;font-weight:600;color:var(--paper);margin-bottom:4px">Embed \u2014 Days 76\u201390</div>';
  h += '<p style="font-size:13px;color:var(--stone);line-height:1.65;margin-bottom:6px">Install the recurring operating rhythm. Rewire evaluation and succession for AI-era capabilities. Run the first scored leadership review. Build composure and resilience practices.</p>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7)"><span style="color:#9B2D3F;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Steps</span>Operating Rhythm \xb7 Evaluation & Succession \xb7 First Leadership Review \xb7 Composure & Resilience</div>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7);margin-top:3px"><span style="color:#9B2D3F;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Outputs</span>Operating Rhythm \xb7 Evaluation Plan \xb7 Review Report</div>';
  h += '</div></div>';
  h += '<div style="display:grid;grid-template-columns:28px 1fr;gap:14px;padding:14px 0">';
  h += '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:#6B4C8A;padding-top:2px">05</div>';
  h += '<div><div style="font-size:14px;font-weight:600;color:var(--paper);margin-bottom:4px">Lead \u2014 Ongoing</div>';
  h += '<p style="font-size:13px;color:var(--stone);line-height:1.65;margin-bottom:6px">Manage the live leadership architecture. The Leadership Dashboard, L&D Hub, and My Development persist and evolve long after the 90-day sprint ends.</p>';
  h += '<div style="font-size:11px;color:rgba(138,130,120,.7)"><span style="color:#6B4C8A;font-weight:700;font-size:9px;text-transform:uppercase;margin-right:6px">Steps</span>Leadership Dashboard \xb7 L&D Hub \xb7 My Development</div>';
  h += '</div></div>';
  h += '</div></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">The Two Tracks<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<p style="' + body + '">Every phase carries two kinds of work. The organizational track designs shared structures \u2014 governance, competencies, operating rhythm \u2014 and belongs to the leadership team collectively. The individual track (the \u25C8 rows in the sidebar) is each leader\u2019s own mindset work: Mindset Foundations (1.4), Mindset Depth (2.4), Mindset Application (3.5), and Composure & Resilience (4.4), carrying into My Development in Phase 5. The Assessment Battery serves both. Work them in parallel: organizational designs only hold if the individual capability underneath them is real.</p></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">The Competency Framework<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<p style="' + body + '">Step 2.3 defines the seven AI-era leadership competencies the program scores against: Orchestration, Philosophical, Hybrid Teams, Change, Composure, Ecosystem, and Emotional. Leaders are scored 1\u20135 per competency. The scores drive the Competency Heat Map, the L&D Hub\u2019s development picture, and the First Leadership Review \u2014 hover any heat-map cell for the leader, competency, and score behind it.</p></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">Track Program<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<div style="display:grid;gap:8px">';
  h += '<div style="' + row + '"><div style="' + key + '">Assignments</div><div style="' + val + '">Every step, grouped by phase, with a status badge, an optional deadline, and an assignment button. You can also assign a step from the \u201CAssigned to\u201D bar on the step page itself.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Analytics</div><div style="' + val + '">A 90-Day Burn-up against the ideal pace, Module Velocity per program week, and Workload by Member.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">Email notifications</div><div style="' + val + '">When a step is completed for the first time, the app emails a completion report to every team member with an email address, with the analytics attached as a PDF. When an assigned step comes within seven days of its deadline, the app emails one reminder to the assignees and to the organization\u2019s administrator account \u2014 the owner account created when the organization was set up.</div></div>';
  h += '</div></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">Tools<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<div style="display:grid;gap:8px">';
  h += '<div style="' + row + '"><div style="' + key + '">? Help</div><div style="' + val + '">Top-right nav. Opens this guide at any time.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u25A6 Track Program</div><div style="' + val + '">Under the \u22EF More menu. Step assignments, deadlines, analytics, and email notifications in one place.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u2726 AI Guide</div><div style="' + val + '">Gold button, bottom-right corner. Context-aware for whichever step you are on, grounded in the OPEN and CARE frameworks. Ask it anything about the current step, your leaders, or a decision you are weighing.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u2261 Team Chat</div><div style="' + val + '">Top-right nav. Message your program team; teammates\u2019 AI personas reply in character, and an unread badge counts messages that arrive while the panel is closed.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u270E Notes</div><div style="' + val + '">Top-right nav. Capture reflections as you work \u2014 useful for slow-thinking practice and leadership review prep.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u25C9 Voice</div><div style="' + val + '">In the More menu. Navigate hands-free. Say: \u201Chome\u201D \xb7 \u201Clearn\u201D \xb7 \u201Creadiness\u201D \xb7 \u201Cinsights\u201D \xb7 \u201Clead\u201D \xb7 \u201Ccoach\u201D \xb7 \u201Chelp\u201D \xb7 \u201Cstop\u201D.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u2295 View</div><div style="' + val + '">In the More menu. Zoom the whole app in or out, fit the page to your screen, or reset to 100%.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u2193 PDF</div><div style="' + val + '">Every output document has a Save as PDF control to print or save a formatted copy \u2014 the Readiness Report, Leadership Inventory, Leadership Structure, and the rest.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u21BB Sample data</div><div style="' + val + '">In the More menu. Seeds the workspace with a realistic example program so you can explore every screen before entering your own data.</div></div>';
  h += '<div style="' + row + '"><div style="' + key + '">\u2195 Export / Import</div><div style="' + val + '">In the More menu. Export downloads the organization\u2019s state as a file; Import restores it. Useful for backups and for moving work between environments.</div></div>';
  h += '</div></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">The Lead Dashboard<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<p style="' + body + '">Phase 5 is the module\u2019s operations center and runs on after day 90. The Leadership Dashboard (5.1) holds the live leadership structure \u2014 an org chart of roles, boards, and occupants you can edit, zoom, view fullscreen, print, and snapshot into saved states. The L&D Hub (5.2) tracks the whole team\u2019s development practice period by period, with the competency heat map and practice health. My Development (5.3) is each leader\u2019s personal view of the same system.</p></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">Insights<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<p style="' + body + '">Curated pieces by Faisal Hoque in three tabs \u2014 Latest Thoughts (recent columns), Conversations (video conversations and talks), and Worth Your Time (recommended reading from elsewhere). Every card opens at the source in a new tab.</p></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">Organization & Team<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<p style="' + body + '">Open Profile from the More menu to manage the team and record your organization details. Every member can be edited inline, and each carries a username and password.</p></div>';

  h += '<div style="' + sec + '">';
  h += '<div style="' + sl + '">Data & Privacy<span style="flex:0 0 20px;height:1px;background:var(--gold)"></span></div>';
  h += '<p style="' + body + '">All your data — leaders, assessments, structures, competency scores, and review outputs — is stored in your browser\'s local storage only. Nothing is synced or shared. The AI Guide sends only your question and current step context to the Anthropic API. Use <strong style="color:var(--paper)">Reset</strong> in the top nav to clear everything.</p></div>';

  h += '<div style="text-align:center;padding-top:8px">';
  h += '<button onclick="closeHelp()" style="padding:12px 32px;background:var(--gold);border:none;color:#fff;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer">Got It</button>';
  h += '</div>';
  h += '</div></div>';
  mr.innerHTML = h;
}

var _voiceActive = false, _recognition = null;
function _voiceToast(msg) { var el = document.getElementById('voiceToast'); if (!el) return; el.textContent = msg; el.classList.add('show'); clearTimeout(_voiceToast._t); _voiceToast._t = setTimeout(function () { el.classList.remove('show') }, 2600); }
function _voiceUI(on) { var f = document.getElementById('voiceFab'), ic = document.getElementById('voiceIcon'), lb = document.getElementById('voiceLabel'); if (f) f.classList.toggle('listening', !!on); if (ic) ic.innerHTML = on ? '\u25C9' : '\u25C9'; if (lb) lb.textContent = on ? 'Listening\u2026' : 'Voice'; }
function toggleVoice() {
  if (!voiceOn()) return; /* Part 2: speech recognition never starts while Voice is off */
  if (typeof _voiceActive !== 'undefined' && _voiceActive) {
    _voiceActive = false;
    if (_recognition) try { _recognition.stop(); } catch (e) { }
    _voiceUI(false); _voiceToast('Voice off');
    return;
  }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { _voiceToast('Voice needs Chrome or Edge'); return; }
  _recognition = new SR();
  _recognition.continuous = true; _recognition.interimResults = false; _recognition.lang = 'en-US';
  _recognition.onstart = function () { _voiceActive = true; _voiceUI(true); _voiceToast('Listening\u2026 try \u201Chome\u201D, \u201Creadiness\u201D, \u201Cstop\u201D'); };
  _recognition.onresult = function (e) {
    var tx = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
    _voiceToast('Heard: ' + tx);
    if (tx.match(/\b(home)\b/)) { go('home'); }
    else if (tx.match(/\b(learn|library|research)\b/)) { go('learn'); }
    else if (tx.match(/\b(readiness|journey|phase)\b/)) { go('readiness'); }
    else if (tx.match(/\b(insight|data)\b/)) { go('insights'); }
    else if (tx.match(/\b(lead|dashboard)\b/)) { go('phase5'); }
    else if (aiGuideOn() && tx.match(/\b(coach)\b/) && typeof coachOpen !== 'undefined' && !coachOpen) { toggleCoach(); }
    else if (tx.match(/\b(help)\b/)) { openHelp(); }
    else if (tx.match(/\b(stop|quiet|cancel)\b/)) { toggleVoice(); }
  };
  _recognition.onerror = function (e) {
    var msg = e.error === 'not-allowed' ? 'Microphone access denied' : e.error === 'no-speech' ? 'No speech detected' : 'Voice error: ' + e.error;
    _voiceUI(false); _voiceActive = false; _voiceToast(msg);
  };
  _recognition.onend = function () { if (_voiceActive) { try { _recognition.start(); } catch (e) { _voiceActive = false; _voiceUI(false); } } };
  try { _recognition.start(); } catch (e) { _voiceToast('Could not start voice'); }
}
/* -- withOrgData (Part 4, 2 Oct 2026; the directive names it in 3.3 but never defines it): run fn on an organization's data and
   save it, without switching to it. It never calls switchToOrg or sealSession: the admin console working on an organization's
   data is not a change of organization (S.4). -- */
function withOrgData(id, fn) {
  var d = getOrgData(id);
  var r = fn(d);
  if (r && typeof r === 'object') d = r;
  saveOrgData(id, d);
  return d;
}
/* Reset scope law (Rollout item 68): the organization, its name, its administrators, their passwords and its AI settings stay;
   every other team member is removed, with their sign-in, together with all the program data. The rest starts as createOrg starts it. */
function resetOrgData(id) {
  return withOrgData(id, function (d) {
    var admins = (Array.isArray(d.roster) ? d.roster : []).filter(function (u) { return u && u.admin === true; });
    var fresh = emptyData();
    fresh.roster = admins;
    fresh.settings = d.settings || { aiGuide: false, voice: false };
    fresh.enterprise = { name: (d.enterprise && d.enterprise.name) || ((getOrg(id) || {}).name) || '' };
    fresh.orgSetup = !!d.orgSetup; /* an organization-level flag: a reset does not send its administrators back through setup */
    fresh.startDate = new Date().toISOString().split('T')[0];
    return fresh;
  });
}
function confirmResetOrg() { return confirm('Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone.'); }
function afterResetOrg(id, viewer) { if (viewer && id === currentOrgId && !getCurrentUser()) Auth.setSession((USERS[0] && USERS[0].id) || null); } /* Follow-up (7 Oct 2026, as Governance dev): with nobody signed in (the full-screen console), a reset must not sign anyone in */
function adminResetOrg(id) { /* the Admin panel */
  if (!isAppAdmin || !getOrg(id)) return;
  if (!confirmResetOrg()) return;
  var viewer = (id === currentOrgId) ? currentUserId : null;
  resetOrgData(id); afterResetOrg(id, viewer);
  render(); renderAdminModal();
}
function adminConsoleReset(id) { /* the full-screen admin console */
  if (!isAppAdmin || !getOrg(id)) return;
  if (!confirmResetOrg()) return;
  var viewer = (id === currentOrgId) ? currentUserId : null;
  resetOrgData(id); afterResetOrg(id, viewer);
  UI.entry = { step: 'admin' }; render();
}

/* Zoom preference: device-local, read at eval time by design (§14). Legacy
   migration, the remembered-session adoption, and footerYear now run inside
   bootApp() at the file tail. */
try { var _z = parseFloat(Store.getPref('zoom')); if (_z >= 0.5 && _z <= 2) UI.zoom = _z; } catch (e) { }

// Initialize theme from Store on load (after UI is declared). Device-local
// preference, key exec-readiness-theme (same family as zoom / sidebar-min), so it
// survives seeding and org resets by construction. Default: DARK (re-ruled 27 July).
(function () {
  try {
    var t = Store.getPref('theme');
    UI.theme = (t === 'light') ? 'light' : 'dark';
  } catch (e) { UI.theme = 'dark'; }
  try { document.documentElement.setAttribute('data-theme', UI.theme); } catch (e) { }
})();

function setTheme(t) {
  t = (t === 'dark') ? 'dark' : 'light';
  UI.theme = t;
  try { Store.setPref('theme', t); } catch (e) { }
  try { document.documentElement.setAttribute('data-theme', t); } catch (e) { }
  render();
}
function toggleTheme() { setTheme(UI.theme === 'dark' ? 'light' : 'dark'); }



/* ═══ BOOT (async loader, July 8) ═══
   The whole boot sequence now runs inside bootApp(), driven by
   Store.ready(). Locally ready() fires in the same tick, so nothing
   about startup changes. On a server build the loading shell below
   holds the app node while Store warms its cache, then bootApp()
   runs against warm data. bootApp() is guarded: a second call is a
   no-op, so a late or duplicate ready signal cannot double-bind
   listeners or re-run migrations. */
var _bootDone = false;
/* -- SAMPLE ORGANIZATION (Part 3, 2 Oct 2026): a private copy of the built-in sample in each person's browser, opened from Demo
   in a new tab. It is kept only in this browser (key exec-readiness-org-data::org_sample_local), is not in the organization list,
   and the tab makes no request to any server: no saves elsewhere, no change polling, no locks, no email. -- */
var SAMPLE_REFUSED = false; /* a sample tab opened without a signed-in tab shows only A.3.6 */
var SAMPLE_NOTE_TEXT = 'Sample organization: your changes stay in this browser only';
function isSampleTab() { try { return /[?&]sample=1(&|$)/.test(location.search); } catch (e) { return false; } }
function openSampleTab() {
  if (!currentUserId || SAMPLE_MODE) return;
  try { Store.raw.set('sample-tab-pass', JSON.stringify({ t: Date.now() })); } catch (e) { } /* through Store: every storage site is the Store's (§19.5) */
  window.open(location.pathname + '?sample=1', '_blank');
}
/* The pass works once and for two minutes; a page opened from a file:// address cannot read its opener, so the pass is the dependable route. */
function sampleTabAccepted() {
  var ok = false;
  try { var p = JSON.parse(Store.raw.get('sample-tab-pass') || 'null'); var age = p && typeof p.t === 'number' ? Date.now() - p.t : -1; if (age >= 0 && age < 120000) ok = true; } catch (e) { }
  try { Store.raw.del('sample-tab-pass'); } catch (e) { }
  if (!ok) { try { var o = window.opener; if (o && o !== window && o.currentUserId && !o.SAMPLE_MODE) ok = true; } catch (e) { } }
  return ok;
}
/* The copy: created from seedData (its confirmation suppressed) when empty or when started again; AI off; no passwords; the first sample person signed in. */
function prepareSampleData(fresh) {
  if (fresh || !data || !Array.isArray(data.roster) || !data.roster.length) {
    data = emptyData(); USERS.length = 0;
    var _c = window.confirm; window.confirm = function () { return true; };
    try { seedData(); } finally { window.confirm = _c; }
  }
  data.settings = { aiGuide: false, voice: false };
  applyTeamRoster();
  (data.roster || []).concat(USERS).forEach(function (u) { if (u) delete u.passcode; });
  saveData();
  Auth.setSession((USERS[0] && USERS[0].id) || null);
  UI.entry = null;
}
function startSampleTab() {
  SAMPLE_MODE = true; isAppAdmin = false;
  if (!sampleTabAccepted()) { SAMPLE_REFUSED = true; render(); return true; }
  currentOrgId = SAMPLE_LOCAL_ID; /* this tab's memory only: never setCurrentOrg, which stores the pointer the person's own tab uses */
  loadData();
  prepareSampleData(false);
  watchSampleNote();
  render();
  return true; /* render() before returning: returning first leaves a blank page (3.3 step 2) */
}
function restartSample() {
  if (!SAMPLE_MODE || SAMPLE_REFUSED) return;
  if (!confirm('Start the sample again? Your changes in this tab are replaced with the original sample.')) return;
  try { closeModal(); } catch (e) { }
  prepareSampleData(true);
  currentPage = 'home'; currentStep = null; currentPhase = null;
  render();
}
function closeSample() {
  if (!SAMPLE_MODE) return;
  try { window.close(); } catch (e) { }
  setTimeout(function () { try { if (!window.closed) location.replace(location.pathname); } catch (e) { } }, 300);
}
/* The red note: the first line inside the page's content container, directly above the Back button; never above that container, where the top bar would hide it. */
function sampleNoteHost() {
  var a = document.getElementById('app'); if (!a) return null;
  return a.querySelector('.content-inner') || a.querySelector('.hero-left') || a.querySelector('.pt-100 > .wrap') || a.querySelector('.u-70c6b34 > .u-4f90335') || null; /* family pages · Home · Learn · Insights */
}
function ensureSampleNote() {
  if (!SAMPLE_MODE || SAMPLE_REFUSED || !currentUserId) return;
  var host = sampleNoteHost(); if (!host) return;
  var n = document.getElementById('sampleNote');
  if (n && n.parentNode === host && host.firstElementChild === n) return;
  if (n && n.parentNode) n.parentNode.removeChild(n);
  n = document.createElement('div'); n.id = 'sampleNote'; n.className = 'sample-note'; n.setAttribute('role', 'note'); n.textContent = SAMPLE_NOTE_TEXT;
  host.insertBefore(n, host.firstChild);
  /* Sweep 4R item 9 (addendum 5 Oct 2026): the note never sits under the top bar; on Home (no content container) it steps down below the bar's measured bottom */
  try { var nav = document.querySelector('nav'), nb = nav ? nav.getBoundingClientRect().bottom : 0, top = n.getBoundingClientRect().top + (window.pageYOffset || 0); if (nb && top < nb + 8) n.style.marginTop = Math.ceil(nb + 8 - top) + 'px'; } catch (e) { }
}
/* The start-up answer: a signed-in member or administrator goes straight back in, without the seal. A session that still
   has to choose a new password signs out: the password it replaces is needed, so the person signs in again. */
function resumeSession(res) {
  if (res && res.ok && res.mustChange) { Auth.signOut(); res = null; }
  if (res && res.ok && res.admin) {
    Auth.setAdminSession(true);
    var orgs = getOrgs(), target = (currentOrgId && getOrg(currentOrgId)) ? currentOrgId : (orgs[0] && orgs[0].id);
    if (target) { setCurrentOrg(target); loadData(); applyTeamRoster(); Auth.setSession((USERS[0] && USERS[0].id) || null); }
    UI.entry = currentUserId ? null : { step: 'admin' }; render(); return;
  }
  if (res && res.ok && res.orgId && getOrg(res.orgId)) {
    setCurrentOrg(res.orgId); loadData(); applyTeamRoster();
    if (USERS.some(function (u) { return u.id === res.userId; })) { Auth.setSession(res.userId); UI.entry = null; render(); return; }
  }
  if (UI.entry && UI.entry.step === 'checking') { UI.entry = { step: (getOrgs().length ? 'login' : 'setup') }; render(); } /* first run lands on Setup (ruled July 16) */
}
var _sampleObserver = null;
function watchSampleNote() { /* pages drawn a moment after the rest (the screen loader) */
  if (_sampleObserver || typeof MutationObserver === 'undefined') return;
  var a = document.getElementById('app'); if (!a) return;
  _sampleObserver = new MutationObserver(function () { try { ensureSampleNote(); } catch (e) { } });
  _sampleObserver.observe(a, { childList: true, subtree: true });
}
function bootApp() {
  if (_bootDone) return false;
  _bootDone = true;
  if (isSampleTab()) return startSampleTab(); /* Part 3: a sample tab never reads the person's stored pointers */
  currentOrgId = Store.getCurrentOrg();
  migrateLegacyData();
  if (currentOrgId && !getOrg(currentOrgId)) setCurrentOrg(null);
  /* 5.4.5: start-up asks the server whether this browser is signed in. The ids stored by Store.setRemember no longer sign
     anyone in. Never sealSession or switchToOrg here (S.4): a reload is not a change of organization or user. */
  if (currentOrgId) { loadData(); applyTeamRoster(); } else { data = emptyData(); USERS.length = 0; }
  Auth.setSession(null); UI.entry = { step: 'checking' };
  try { Store.setRemember(null); Store.raw.del('exec-readiness-admin'); } catch (e) { } /* no ids that sign anyone in, and no administrator code, are kept in the browser */
  Auth.currentSession(resumeSession);
  try { Store.startChangeSignal(); } catch (e) { } // multi-user change signal: storage events + polling (July 8)
  (function () { var fy = document.getElementById('footerYear'); if (fy) fy.textContent = new Date().getFullYear(); })();
  // Mobile: collapse sidebar by default
  if (window.matchMedia && window.matchMedia('(max-width:960px)').matches) { sidebarOpen = false; }
  render();
  // Re-evaluate sidebar on resize
  window.addEventListener('resize', function () {
    if (window.matchMedia('(max-width:960px)').matches) {
      if (sidebarOpen) { sidebarOpen = false; if (typeof updateSidebarState === 'function') updateSidebarState(); }
    }
  });
  return true;
}
Store.ready(bootApp);
if (!_bootDone) {
  // Server mode only: hold the app node while the cache warms. Never
  // visible locally – the synchronous path has already booted by here.
  try {
    var _bootEl = document.getElementById('app');
    if (_bootEl) _bootEl.innerHTML = '<div style="padding:140px 24px;text-align:center;font-size:15px;opacity:.7">Loading your workspace…</div>';
  } catch (e) { }
}


function renderStepContent(id){var h=renderStepContentBody(id);return isPhase5Step(id)?printBar()+h:h} /* 12 Sep 2026 (Paul's ruling): the print option on every Phase 5 page */
function renderDashboard(){return renderDashboardBody()} /* 12 Sep 2026 (Paul's ruling): the print option on the dashboard; 16 Sep 2026 (Paul's ruling): it lives in the toolbar, beside the Summary / Full toggle, so the separate bar goes */

/* PRINT OPTION on every Phase 5 page and every dashboard (Paul's ruling, 12 Sep 2026; family): a Save as PDF control at the top of each such page prints it as a document — cover, body without controls, the copyright footer */
function printBar(){return UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 10px">'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px')+'</div>'}
function isPhase5Step(id){var p=null;PH.forEach(function(x){if(x.id===5)p=x});return !!(p&&p.steps.some(function(s){return s.id===id}))}
function stepNameOf(id){var nm=id;PH.forEach(function(p){p.steps.forEach(function(s){if(s.id===id)nm=s.name})});return nm}
function _pbStrip(body){return String(body).replace(/<div class="print-bar"[\s\S]*?<\/div>/,'').replace(/<button[\s\S]*?<\/button>/g,'')}
function printCurrentPage(){
  var dash=(currentPage==='phase5');var id=dash?'5.1':currentStep;var title=stepNameOf(id);
  if(!dash&&id==='5.2'){printLdevHubReport();return} /* L&D HUB REPORT (Paul's ruling, 13 Sep 2026): the hub prints its own document */
  if(dash||id==='5.1'){printDocument('Leadership Structure',erDashboardDoc(),'');return} /* 14 Sep 2026 (Paul's ruling): the dashboard prints as its own document */
  if(id==='5.3'){printDocument('My Development',myDevDoc(),'');return} /* 14 Sep 2026 (Paul's ruling): My Development prints as its own document */
  UI._printing=1;var body='';try{body=dash?renderDashboardBody():renderStepContentBody(id)}finally{UI._printing=0}
  printPage(title,function(){return body});
}

/* SIDEBAR OUTPUTS FOLD (Paul's ruling, 12 Sep 2026; family): a phase's outputs sit behind one folded line beneath its steps, so the sidebar stays uncramped and the list of outputs can grow. The fold opens when the user clicks it, and opens itself while one of its outputs is the page being viewed. */
function toggleNavOutputs(phId){UI.navOutOpen=UI.navOutOpen||{};UI.navOutOpen[phId]=!UI.navOutOpen[phId];render()}
function navOutputsOpen(ph){UI.navOutOpen=UI.navOutOpen||{};if(UI.navOutOpen[ph.id])return true;return (ph.outcomes||[]).some(function(o){return (currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id})}

/* ═══ REPORTING ENGINE (family code, copied from the Governance build 14 Sep 2026; Spec Rev A). Layered records: each record type declares a layer map; every layer has a summary and a full rendering; a layer is live when it has content and no later superseding layer does; renderings are additive; a register prints identity plus the summary of every live layer up to its own phase; each record ends with a missing-layers line. Output side only. ═══ */
var LAYER_MAPS={};
function lyCap(t){t=String(t);if(!t||/^(https?:\/\/|www\.)/.test(t)||t.indexOf('@')>=0||/^[a-z]+-[a-z0-9-]*\d/.test(t))return t;return t.charAt(0).toUpperCase()+t.slice(1)} /* 13 Sep 2026 (Paul's ruling): a printed value begins with a capital, unless it is a URL, an email, or an id */
function lyDate(v){var d=(typeof v==='number')?new Date(v):new Date(String(v));return isNaN(d)?String(v||''):d.toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
function lyText(v){ /* any value to plain text */
  if(v==null)return '';if(Array.isArray(v))return v.map(lyText).filter(Boolean).join('; ');
  if(typeof v==='object')return Object.keys(v).map(function(k){return v[k]}).map(lyText).filter(Boolean).join('; ');
  return String(v).trim()}
function lyLive(map,rec,upto){ /* the live layers, in stage order, up to and including layer index upto (all when upto is null) */
  var present=map.layers.map(function(l){try{return !!l.present(rec)}catch(e){return false}});
  return map.layers.filter(function(l,i){if(upto!=null&&i>upto)return false;if(!present[i])return false;
    return !map.layers.some(function(m,j){return m.supersedes===l.id&&present[j]})})}
function lyMissing(map,rec,upto){ /* one sentence per required-but-absent or incomplete layer */
  var out=[];map.layers.forEach(function(l,i){if(upto!=null&&i>upto)return;if(!l.required)return;var req=false;try{req=!!l.required(rec)}catch(e){}
    if(!req)return;var pres=false;try{pres=!!l.present(rec)}catch(e){}
    if(!pres){out.push(l.missing||('No '+l.title.toLowerCase()+' recorded.'));return}
    if(l.complete){var c=null;try{c=l.complete(rec)}catch(e){}if(typeof c==='string'&&c)out.push(c)}});return out}
function lyRow(label,value,indent){var t=lyCap(lyText(value));return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?esc(t):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
function lyList(label,items,fmt){ /* a list field: one row per item, the label on the first; a formatter may return lines separated by <br>, which print as lines */
  if(!items||!items.length)return lyRow(label,'');var h='';items.forEach(function(it,i){var v=fmt?fmt(it,i):it;h+=lyRowHtml(i===0?label:'',v,i>0)});return h}
function lyRowHtml(label,value,indent){var t=(typeof value==='string')?value:lyText(value);var parts=t.split('<br>').map(function(x){return esc(lyCap(x))});return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?parts.join('<br>'):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
function lyRender(type,rec,depth,upto,caption,lead){ /* the record as a table: an optional caption (the group header, which the browser keeps with the table's first page), the identity in the header row (repeats when the block splits), then each live layer's fields, then the missing-layers line. A record short enough to fit a page is unsplittable; a long one starts on a fresh page, flows and splits between rows, and ends with a wider gap. */
  var map=LAYER_MAPS[type];if(!map||!rec)return '';var full=(depth==='full');
  var idr=map.identity(rec);var title=esc(idr.title||'');var meta=(idr.meta||[]).filter(Boolean).map(esc).join(' \u00b7 ');
  var body='';var rowCount=0;  var live=lyLive(map,rec,upto);
  var rowsOf=function(l,all){var rows='';l.fields.forEach(function(f){if(!all&&!f.summary)return;var v=null;try{v=f.get(rec)}catch(e){}
      if(f.list)rows+=lyList(f.label,v,f.fmt);else rows+=lyRow(f.label,f.fmt?f.fmt(v):v)});return rows};
  var leadL=lead?live.filter(function(l){return l.id===lead})[0]:null; /* 14 Sep 2026 (Paul's ruling, the Emergency Response portfolio): the named layer leads the record, every field of it, in a box; the other layers follow as context */
  if(leadL){live=live.filter(function(l){return l!==leadL});var lr=rowsOf(leadL,true);
    body+='<tr><td colspan="2" style="padding:8px 10px 12px"><div class="ly-lead" style="border:2px solid #9B2D3F;border-radius:6px;padding:8px 10px 2px"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9B2D3F;padding:0 0 6px;margin:0 0 2px;border-bottom:1px solid #9B2D3F">'+esc(leadL.title)+'</div><table style="width:100%;border-collapse:collapse">'+lr+'</table></div></td></tr>';rowCount+=1+(lr.match(/<tr>/g)||[]).length}
  live.forEach(function(l){var rows=rowsOf(l,full);
    if(rows){body+='<tr><td colspan="2" style="padding:9px 10px 3px;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+esc(l.title)+'</td></tr>'+rows;rowCount+=1+(rows.match(/<tr>/g)||[]).length}});
  var miss=lyMissing(map,rec,upto);
  if(miss.length){body+='<tr><td colspan="2" style="padding:7px 10px;font-size:12px;color:#8B3A1E">'+miss.map(function(m){return '\u25b8 '+esc(m)}).join('<br>')+'</td></tr>';rowCount++}
  var LONG=16; /* about a page of rows: beyond this the record flows and splits between rows rather than being forced to a fresh page */
  var h='<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;'+(rowCount>LONG?'break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;margin-bottom:40px':'break-inside:avoid;page-break-inside:avoid')+'">'+(caption?'<caption style="caption-side:top;text-align:left;padding:0">'+caption+'</caption>':'')+'<thead><tr><th colspan="2" style="text-align:left;padding:8px 10px;border-bottom:2px solid #111;background:#fff"><div style="font-size:14px;font-weight:700;color:#111">'+title+(idr.score?'<span style="float:right;font-weight:700">'+esc(idr.score)+'</span>':'')+'</div>'+(meta?'<div style="font-size:11px;color:#666;font-weight:400;margin-top:2px">'+meta+'</div>':'')+'</th></tr></thead><tbody>'+body;
  return h+'</tbody></table>'}
function lyRegister(type,records,depth,upto,groups,onePerPage,lead){ /* a register document body: optional groups of records, each rendered. The group header is the largest, heaviest thing on the page, and it is the first record's table caption, so the browser keeps it with that record's first page whether the record is short or long */
  var h='';var gi=-1;(groups||[{name:'',list:records}]).filter(function(g){return g.list.length}).forEach(function(g){gi++;
    var head=g.name?'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:30px 0 12px;padding-bottom:8px;border-bottom:3px solid #111">'+esc(g.name)+' <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-left:8px">'+g.list.length+'</span></div>':'';
    g.list.forEach(function(r,i){var blk=lyRender(type,r,depth,upto,(i===0&&head)?head:'',lead);h+=(onePerPage&&!(gi===0&&i===0))?'<div style="break-before:page;page-break-before:always">'+blk+'</div>':blk})});
  return h||'<div style="font-size:13px;color:#666;font-style:italic;padding:8px 0">Nothing on this register.</div>'}
function lyGaps(type,records,upto){var out=[];var map=LAYER_MAPS[type];if(!map)return out;records.forEach(function(r){var m=lyMissing(map,r,upto);if(m.length)out.push({title:map.identity(r).title,lines:m})});return out}
function lyScreenRegister(type,records,depth,upto,groups){var h=lyRegister(type,records,depth,upto,groups);return '<div class="ly-screen" style="font-size:13px">'+h.replace(/color:#111/g,'color:var(--paper)').replace(/color:#555/g,'color:var(--text-muted)').replace(/color:#333/g,'color:var(--text-muted)').replace(/color:#666/g,'color:var(--text-faint)').replace(/background:#fff/g,'background:transparent').replace(/border-bottom:2px solid #111/g,'border-bottom:2px solid rgba(var(--fg-rgb),.5)').replace(/border-bottom:1px solid #111/g,'border-bottom:1px solid rgba(var(--fg-rgb),.4)').replace(/border-bottom:1px solid #eee/g,'border-bottom:1px solid rgba(var(--fg-rgb),.08)')+'</div>'}
function lyDepthCtl(){var d=(UI.printDepth||'summary');return '<span style="display:inline-flex;gap:4px;align-items:center;margin-right:8px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint)">DEPTH</span>'+['summary','full'].map(function(k){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(d===k?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.printDepth=\''+k+'\';render()">'+(k==='summary'?'Summary':'Full')+'</button>'}).join('')+'</span>'} /* Round 2: the depth control the outputs and the print share */

/* ── EXECUTIVE READINESS: the leader (family model, Spec Rev A; maps proposed 14 Sep 2026 for Paul's correction from printouts) ── */
var LEADER_COMPS=[{id:'orchestration',name:'AI Orchestration'},{id:'philosophical',name:'Philosophical & Ethical Reasoning'},{id:'hybrid',name:'Hybrid Team Leadership'},{id:'change',name:'Change & Transformation'},{id:'composure',name:'Composure & Adaptive Judgment'},{id:'ecosystem',name:'Ecosystem Stewardship'},{id:'emotional',name:'Emotional Intelligence'}];
var LEADER_PRACTICES={slowLog:'Slow-thinking log',stopReview:'Stop review',depScan:'Dependency scan',reverseAudit:'Reverse audit',valuesReview:'Values review',concernCircle:'Concern circle',commitments:'Commitments'};
var REVIEW_LABELS={developed:'Developed',progressing:'Progressing',support:'Needs Support',hard:'Hard Conversation'};
LAYER_MAPS.leader={
  identity:function(l){var scope={org:'Organization-wide',dept:'Departmental',function:'Function',team:'Team-level'}[l.scope]||(l.scope?lyCap(l.scope):'');return {title:l.name||'Unnamed leader',score:'',meta:[leaderRoleName(l),scope,l.engagement?'Engagement: '+lyCap(l.engagement):'',l.bandwidth?'Bandwidth: '+lyCap(l.bandwidth):''].filter(Boolean)}},
  layers:[
   {id:'landscape',title:'Leadership landscape',stage:'1.2',present:function(l){return !!(l.fluency||l.engagement||l.bandwidth||l.changeExp)},fields:[
     {label:'AI fluency, self-rated',get:function(l){return l.fluency?l.fluency+'/5':''},summary:true},
     {label:'Change experience',get:function(l){return l.changeExp}}]},
   {id:'competency',title:'Competency scores',stage:'2.3',present:function(l){var sc=(data.competencyFramework||{}).scores||{};return LEADER_COMPS.some(function(c){return sc[l.id+'_'+c.id]})},fields:[
     {label:'Average score',get:function(l){var sc=(data.competencyFramework||{}).scores||{};var v=LEADER_COMPS.map(function(c){return +sc[l.id+'_'+c.id]||0}).filter(Boolean);return v.length?(v.reduce(function(a,b){return a+b},0)/v.length).toFixed(1)+'/5 across '+v.length+' of 7 competencies':''},summary:true},
     {label:'Lowest score',get:function(l){var sc=(data.competencyFramework||{}).scores||{};var lo=null;LEADER_COMPS.forEach(function(c){var v=+sc[l.id+'_'+c.id]||0;if(v&&(!lo||v<lo.v))lo={v:v,n:c.name}});return lo?lo.n+' \u2014 '+lo.v+'/5':''},summary:true},
     {label:'Scores',get:function(l){var sc=(data.competencyFramework||{}).scores||{};return LEADER_COMPS.map(function(c){var v=+sc[l.id+'_'+c.id]||0;return c.name+' \u2014 '+(v?v+'/5':'Not scored')})},list:true}]},
   {id:'fluency',title:'AI fluency sprint',stage:'3.1',present:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id];return !!(t&&(t.task1||t.task2||t.task3))},fields:[
     {label:'Tasks completed',get:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id]||{};var n=['task1','task2','task3'].filter(function(k){return t[k]}).length;return n?n+' of 3':''},summary:true},
     {label:'Tasks',get:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id]||{};return ['task1','task2','task3'].map(function(k){return t[k]}).filter(Boolean)},list:true}]},
   {id:'review',title:'First leadership review',stage:'4.3',present:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id];return !!(r&&(r.assessment||r.notes||r.fluency))},fields:[
     {label:'Assessment',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return REVIEW_LABELS[r.assessment]||(r.assessment?lyCap(r.assessment):'')},summary:true},
     {label:'AI fluency at review',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return r.fluency?r.fluency+'/5'+(l.fluency?' (self-rated '+l.fluency+'/5 at the landscape)':''):''},summary:true},
     {label:'Change leadership at review',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return r.change?r.change+'/5':''}},
     {label:'Philosophical reasoning at review',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return r.philosophical?r.philosophical+'/5':''}},
     {label:'Notes',get:function(l){return (((data.leadershipReview||{}).leaders||{})[l.id]||{}).notes}}]},
   {id:'development',title:'Development',stage:'5',present:function(l){var d=(data.indivDone||{})[l.id];var p=l.userId?(data.practiceLog||{})[l.userId]:null;return !!((d&&Object.keys(d).length)||(p&&Object.keys(p).length))},fields:[
     {label:'Development items completed',get:function(l){var d=(data.indivDone||{})[l.id]||{};var n=Object.keys(d).filter(function(k){return d[k]}).length;return n?n+' item'+(n===1?'':'s'):''},summary:true},
     {label:'Practices logged this period',get:function(l){var p=l.userId?((data.practiceLog||{})[l.userId]||{}):{};var n=Object.keys(p).length;return n?n+' of 7':''},summary:true},
     {label:'Practices',get:function(l){var p=l.userId?((data.practiceLog||{})[l.userId]||{}):{};return Object.keys(p).map(function(k){return (LEADER_PRACTICES[k]||lyCap(k))+' \u2014 '+lyDate(p[k])})},list:true}]}
  ]};
var LEADER_LAYER_INDEX={landscape:0,competency:1,fluency:2,review:3,development:4};
LAYER_MAPS.leaderFluency={identity:LAYER_MAPS.leader.identity,layers:[{id:'fluency',title:'AI fluency sprint',stage:'3.1',present:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id];return !!(t&&(t.task1||t.task2||t.task3))},fields:[{label:'Task 1',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task1},summary:true},{label:'Task 2',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task2},summary:true},{label:'Task 3',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task3},summary:true}]}]}; /* 16 Sep 2026 (Paul's ruling; a particular rule of the Fluency Assessment): the document outputs what Step 3.1 gathers — each leader's three tasks as written, under the leader's identity line — and does not repeat the landscape and competency layers, which belong to the Inventory and the Competency Framework. One form: every field is the information */
/* ── EXECUTIVE READINESS: the leadership risk (Step 1.3; the seven scenarios' names are the screen's own) ── */
var LRISK_NAMES={zillow:'Deploying Without Readiness',calstate:'Transformation Without Engagement',aircanada:'AI Without Boundaries',cigna:'Eliminating Human Judgment',stigma:'Cultural Readiness Failure',disruption:'Competitive Disruption',fatigue:'Change Fatigue'};
function lriskTotal(r){return (+r.likelihood||0)+(+r.impact||0)+(+r.timeHorizon||0)}
function lriskBand(r){var t=lriskTotal(r);return t>10?'Critical':t>5?'Moderate':'Low'}
LAYER_MAPS.lrisk={
  identity:function(r){var t=lriskTotal(r);return {title:LRISK_NAMES[r.id]||r.id||'Unnamed risk',score:t?t+'/15':'',meta:[t?lriskBand(r):''].filter(Boolean)}},
  layers:[
   {id:'screen',title:'Risk screen',stage:'1.3',present:function(r){return lriskTotal(r)>0||!!r.notes},fields:[
     {label:'Likelihood',get:function(r){return r.likelihood?r.likelihood+'/5':''},summary:true},
     {label:'Impact',get:function(r){return r.impact?r.impact+'/5':''},summary:true},
     {label:'Time horizon',get:function(r){return r.timeHorizon?r.timeHorizon+'/5':''},summary:true},
     {label:'Notes',get:function(r){return r.notes||data['risk_'+r.id+'_notes']||''}}]}
  ]};
/* ── the register documents (14 Sep 2026): identity plus the summary of every live layer up to the output's phase; Summary / Full where the two differ ── */
var PRINT_DOCS={
 'out-inventory':function(){var L=data.leaders||[];
   var ln=data.landscapeNotes||{};var notes=(ln.ownershipGap||ln.mmAssessment)?'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:30px 0 12px;padding-bottom:8px;border-bottom:3px solid #111">The Landscape</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:avoid;page-break-inside:avoid"><tbody>'+lyRow('Transformation ownership gap',ln.ownershipGap)+lyRow('Middle management assessment',ln.mmAssessment)+'</tbody></table>':'';
   return printDocCover('Leadership Inventory','The organization chart; then every leader in the landscape \u2014 role, scope, engagement, bandwidth, self-rated AI fluency, and change experience \u2014 and the ownership gap and the middle-management assessment.','')+erOrgChartPage('')+'<div style="break-before:page;page-break-before:always">'+erHead('At a Glance','')+erFigRow((function(f){return [{v:f.total,l:'Leaders Mapped',col:'#2D5A8E',vcol:'#2D5A8E'},{v:f.avgFluency,l:'Avg AI Fluency',col:'#1B6B5A',vcol:'#1B6B5A'},{v:f.active+'/'+f.total,l:'Actively Engaged',col:f.active>=f.total/2?'#1B6B5A':'#4E7FA6'},{v:f.overloaded,l:'Stretched/Overloaded',col:f.overloaded>f.total/2?'#9B2D3F':'#1B6B5A',vcol:f.overloaded>f.total/2?'#9B2D3F':'#111'}]})(inventoryFigs()))+'<div style="height:16px"></div>'+erHead('The Leaders','')+lyRegister('leader',L,'full',LEADER_LAYER_INDEX.landscape)+notes+'</div>'}, /* 15 Sep 2026 (Paul's ruling): the four figures at the head of the register, drawn for paper; 16 Sep 2026 (Paul's ruling): a heading of the same weight, The Leaders, over the register, with a gap after the figures; later 16 Sep (Paul's ruling): the organization chart returns as the first page after the cover, now that its paper layout fits the page. 16 Sep 2026 (Paul's ruling): the Reporting Lines page removed — the chart did not print right on its landscape page and is not needed here; the hierarchy prints with the Leadership Structure (5.1) document */
 'out-riskmap':function(){return riskMapDoc()}, /* 15 Sep 2026 (Paul's ruling): composed for paper: the summary figures, then a block per scored risk, highest first */
 'out-competency':function(){var cf=data.competencyFramework||{};var L=data.leaders||[];var depth=(UI.printDepth||'summary');
   var h=printDocCover('Competency Framework','The seven leadership competencies as this organization defines them, and every leader\u2019s scores against them.','');
   h+='<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111">The Competencies</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:auto;page-break-inside:auto"><tbody>';
   LEADER_COMPS.forEach(function(c){h+=lyRow(c.name,(cf.definitions||{})[c.id])});h+='</tbody></table>';
   var gaps=LEADER_COMPS.map(function(c){var v=L.map(function(l){return +((cf.scores||{})[l.id+'_'+c.id])||0}).filter(Boolean);return {name:c.name,avg:v.length?v.reduce(function(a,b){return a+b},0)/v.length:0}}).filter(function(g){return g.avg>0}).sort(function(a,b){return a.avg-b.avg});
   if(gaps.length)h+=erBarBlock('Development Priorities','Lowest average first',gaps.map(function(g,i){return {l:(i+1)+'. '+g.name,v:g.avg,max:5}})); /* the page's ranking, lowest average first; 16 Sep 2026 (Paul's ruling): as bars, not written averages */
   return h+'<div style="break-before:page;page-break-before:always">'+lyRegister('leader',L,depth,LEADER_LAYER_INDEX.competency)+'</div>'}, /* 16 Sep 2026 (Paul's ruling): the leaders start on a new page after the competencies and the priorities */
 'out-fluency':function(){var fl=data.fluencySprint||{};var L=(data.leaders||[]).filter(function(l){var t=(fl.leaderTasks||{})[l.id];return t&&(t.task1||t.task2||t.task3)});
   var h=printDocCover('Fluency Assessment','The team project, its workflow and the judgment it protects, and every leader\u2019s sprint tasks.','');
   h+='<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111">The Team Project</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:avoid;page-break-inside:avoid"><tbody>'+lyRow('Project',fl.project)+lyRow('Workflow',fl.projectWorkflow)+lyRow('The judgment protected',fl.projectJudgment)+'</tbody></table>';
   return h+'<div style="break-before:page;page-break-before:always">'+erHead('Individual Fluency Sprints',L.length+' leader'+(L.length===1?'':'s')+' \u2014 each leader\u2019s three tasks, as written')+lyRegister('leaderFluency',L,'full',0)+'</div>'}, /* 16 Sep 2026 (Paul's ruling): the fluency layer alone, one form, under its own heading; the leaders start on a new page after the team project, as the Competency Framework's do */
 'out-review':function(){var rv=data.leadershipReview||{};var L=(data.leaders||[]).filter(function(l){var r=(rv.leaders||{})[l.id];return r&&(r.assessment||r.notes)});var depth=(UI.printDepth||'summary');
   var h=printDocCover('Leadership Review Report','The first review of leadership progress and readiness: every leader\u2019s assessment, and what the structure review found.','');
   var part=function(label,col,t){t=lyText(t);return '<div style="margin:0 0 12px"><div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:'+col+';margin-bottom:4px">'+label+'</div><div style="font-size:12.5px;line-height:1.55;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'};
   h+=erBlock(erHeadLg('Structural Review','What the review found in the leadership structure')+'<div style="border:2px solid #9B2D3F;border-radius:6px;padding:16px 20px 6px;margin:0 0 24px">'+part('Working Well','#1B6B5A',rv.structWorking)+part('Needs Revision','#9B2D3F',rv.structRevision)+'</div>'); /* 16 Sep 2026 (Paul's ruling): the structural review leads, in the page's form — the red box, the green and red titles — not as labelled rows */
   var counts={developed:0,progressing:0,support:0,hard:0};(data.leaders||[]).forEach(function(l){var a=((rv.leaders||{})[l.id]||{}).assessment||'';if(counts[a]!==undefined)counts[a]++});
   h+=erFigRow([{v:counts.developed,l:'Developed',col:'#1B6B5A',vcol:'#1B6B5A'},{v:counts.progressing,l:'Progressing',col:'#2D5A8E',vcol:'#2D5A8E'},{v:counts.support,l:'Needs Support',col:'#4E7FA6',vcol:'#4E7FA6'},{v:counts.hard,l:'Hard Conversation',col:'#9B2D3F',vcol:'#9B2D3F'}]); /* 16 Sep 2026 (Paul's ruling): the page's stat band, with its colours */
   var lead=erHeadLg('Individual Leader Reviews',L.length+' leader'+(L.length===1?'':'s')+', grouped by assessment'); /* 16 Sep 2026 (Paul's ruling): a step larger than the group headings beneath; later 16 Sep (Paul's ruling): it opens the register's page — the heading, the first group's heading, the first name — never left under the stat band */
   var groups=Object.keys(REVIEW_LABELS).map(function(k){return {name:REVIEW_LABELS[k],list:L.filter(function(l){return ((rv.leaders||{})[l.id]||{}).assessment===k})}});
   var rest=L.filter(function(l){return !REVIEW_LABELS[((rv.leaders||{})[l.id]||{}).assessment]});if(rest.length)groups.push({name:'Not yet assessed',list:rest});
   return h+'<div style="break-before:page;page-break-before:always">'+lead+lyRegister('leader',L,depth,LEADER_LAYER_INDEX.review,groups)+'</div>'}
};
var DEPTHED_OUTPUTS={'out-competency':1,'out-review':1,'out-values':1}; /* 16 Sep 2026 (Paul's ruling): the Fluency Assessment became one form; the Values Architecture gained depth — Full adds the appendix of each leader's 2.4 reflections */ /* depth is offered where the leader's full rendering is several times its summary; the Risk Map has one form */

/* ── the single-record outputs' definitions, one each, read by the page and by its printed document (14 Sep 2026) ── */
var READINESS_CATS=[
    {k:'purpose',name:'Purpose & Clarity',fields:['clarity','aiAlignment','coherence']},
    {k:'fluency',name:'AI Fluency',fields:['foundational','failureModes','costRisk','strategic','handsOn']},
    {k:'change',name:'Change Capacity',fields:['trackRecord','fatigue','middleMgmt','psySafety','learningCulture']},
    {k:'structure',name:'Structure Baseline',fields:['crossCollab','mmRole']},
    {k:'ethical',name:'Ethical Readiness',fields:['identity','evidence','commitments','assumptions']}
  ];
var READINESS_LABELS={clarity:'Purpose clarity',aiAlignment:'AI-purpose alignment',coherence:'Strategic coherence',foundational:'Foundational understanding',failureModes:'Failure mode awareness',costRisk:'Cost/risk understanding',strategic:'Strategic connection',handsOn:'Hands-on experience',trackRecord:'Track record',fatigue:'Change fatigue',middleMgmt:'Middle mgmt health',psySafety:'Psychological safety',learningCulture:'Learning culture',crossCollab:'Cross-functional collaboration on AI',mmRole:'Middle management role in AI decisions',identity:'Core identity',evidence:'Evidence standards',commitments:'Ethical commitments',assumptions:'Embedded assumptions'}; /* 15 Sep 2026: each readiness question's label as Step 1.1 asks it; a stored key never prints as a label */
function readinessReading(overall){return overall>=4?'Strong foundation. Focus on maintaining momentum.':overall>=2.5?'Mixed readiness. Significant gaps require attention before scaling AI.':'Critical gaps. Address foundational issues before any AI deployment.'} /* the page's three readings, one definition for the page and its document */
function readinessAreas(){var a=data.assessments||{};return READINESS_CATS.map(function(cat){var sub=a[cat.k]||{};var vals=cat.fields.map(function(f){return typeof sub[f]==='number'?sub[f]:0}).filter(function(v){return v>0});return {cat:cat,sub:sub,avg:vals.length?(vals.reduce(function(x,y){return x+y},0)/vals.length):0}})} /* the five areas with their averages, as the page computes them */
var STRUCTURE_SECTIONS=[
    {id:'ownership',name:'Transformation Ownership',fields:[{k:'ownerModel',l:'Ownership model'},{k:'ownerWho',l:'Owner & authority'},{k:'ownerChange',l:'Changes from current state'}]},
    {id:'board',name:'Board Governance',fields:[{k:'boardStructure',l:'Oversight structure'},{k:'boardExpertiseGaps',l:'Board AI expertise'},{k:'boardDecisions',l:'Decision boundaries'},{k:'boardEducation',l:'Education plan'}]},
    {id:'senior',name:'Senior Leadership Layer',fields:[{k:'seniorDecisionRights',l:'Decision rights'},{k:'seniorAccountability',l:'Accountability structure'},{k:'seniorAlignment',l:'Cross-functional alignment'}]},
    {id:'middle',name:'Middle Management Principles',fields:[{k:'mmAutomate',l:'Automate now'},{k:'mmAugment',l:'Augment now, automate later'},{k:'mmHuman',l:'Human judgment permanent'}]},
    {id:'crossfunc',name:'Cross-Functional Coordination',fields:[{k:'coordMechanism',l:'Coordination mechanism'},{k:'coordCadence',l:'Meeting cadence'},{k:'coordConflict',l:'Conflict resolution'},{k:'coordInfo',l:'Information flows'}]}
  ];
var COLLAB_SECTIONS=[
    {id:'touchpoints',name:'Touchpoint Map',fields:[{k:'touchCustomer',l:'Customer-facing'},{k:'touchInternal',l:'Internal workflows'},{k:'touchDecision',l:'Decision support'},{k:'touchAgent',l:'Agent-to-agent'}]},
    {id:'models',name:'Collaboration Models',fields:[{k:'functionModels',l:'Function-to-model mapping',rows:function(cl){var fm=(cl&&cl.functionModels)||[];return fm.length?fm.map(function(f){return {l:f.name||'Unnamed function',v:COLLAB_MODEL_LABELS[f.model]||f.model||''}}):[{l:'Function-to-model mapping',v:''}]}}]}, /* 16 Sep 2026 (Paul's ruling): the section prints what the step collects — one row per function, the model as the option list names it; modelMapping had no input on the step (only the seed wrote it) and is gone */
    {id:'personas',name:'AI Persona Design',fields:[{k:'personaCustomer',l:'Customer-facing personas'},{k:'personaInternal',l:'Internal personas'},{k:'personaBoundaries',l:'Boundaries'}]},
    {id:'aifree',name:'AI-Free Zones',fields:[{k:'aiFreeZones',l:'Human-only domains'},{k:'proprietary',l:'Protected knowledge'},{k:'atrophyRisks',l:'Atrophy risks'}]},
    {id:'translation',name:'Translation Layer',fields:[{k:'translators',l:'Translators'},{k:'transProcesses',l:'Processes'},{k:'transRisks',l:'Proxy risks'}]}
  ];
var DECISION_SCENARIOS=[
    {id:'autonomous',name:'The Autonomy Decision',icon:'\u25B7',desc:'When AI outperforms humans on speed and consistency'},
    {id:'workforce',name:'The Workforce Transition',icon:'\u25C8',desc:'When 30% of a department\u2019s work could be automated'},
    {id:'competitor',name:'The Competitive Threat',icon:'\u229F',desc:'When competitors deploy AI and you\u2019re not ready'},
    {id:'ethical',name:'The Ethical Boundary',icon:'\u2299',desc:'When profit conflicts with principles'}
  ];
var RHYTHM_GROUPS=[
    {title:'Leadership Meeting Rhythm',color:'#9B2D3F',items:[{k:'agenda',l:'Standing Agenda'},{k:'agendaOwner',l:'Agenda Ownership'}]},
    {title:'Peer Learning',color:'#2D5A8E',items:[{k:'peerStructure',l:'Structure'},{k:'peerAgenda',l:'Agenda'}]},
    {title:'Decision Simulations',color:'#8B5E3C',items:[{k:'simFreq',l:'Frequency'},{k:'simDesign',l:'Scenario Design'}]},
    {title:'External & Board',color:'#6B4C8A',items:[{k:'frontier',l:'Frontier Exposure'},{k:'boardEd',l:'Board Education'}]}
  ];
var EVAL_FIELDS={evaluation:[{k:'indicators',l:'AI-readiness indicators'},{k:'proportion',l:'Evaluation weighting'}],succession:[{k:'bench',l:'Bench assessment'},{k:'benchChanges',l:'Changes needed'},{k:'boardFluency',l:'Board fluency requirements'}]};
var VALUES_DOMAINS=[{id:'ontological',l:'Ontological'},{id:'epistemological',l:'Epistemological'},{id:'ethical',l:'Ethical'}];
var COLLAB_MODEL_LABELS={'advisor':'Advisor','augmenter':'Augmenter','autonomous':'Autonomous Agent','competitor':'Competitor','facilitator':'Facilitator'}; /* 16 Sep 2026: the collaboration models as Step 2.2's option list names them; a custom model prints as typed */
var STRUCTURE_LABELS={ownerModel:{cito:'Create a Chief Innovation & Transformation Officer role',cao:'Create a Chief AI Officer role',ctro:'Create a Chief Transformation Officer role',expand_cio:'Expand the Chief Information Officer role with explicit cultural/strategic mandate',council:'Create a cross-functional AI Transformation Council',dual:'Dual ownership: technology leader + cultural/strategic leader jointly'},coordMechanism:{council:'AI Transformation Council (cross-functional standing body)',epmo:'Enterprise Portfolio Management Office',matrix:'Matrix reporting for AI leads embedded in functions',rotation:'Leadership rotation through AI-intensive projects',network:'Innovation network model (REINVENT)'}}; /* the stored choices of Step 2.1, printed as their labels */
/* ── the single-record documents (14 Sep 2026): a heading per section over labelled rows, in the screen's own words; one form each ── */
function erSection(title,rowsHtml,sub){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111;break-after:avoid;page-break-after:avoid">'+esc(title)+(sub?' <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-left:8px">'+esc(sub)+'</span>':'')+'</div>'+'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px;break-inside:auto;page-break-inside:auto"><tbody>'+rowsHtml+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling; family): a block — a heading with its rows — is never split across pages; if it would be, it starts a new page. The block is unsplittable; the table inside stays splittable between rows so a block taller than a page still breaks between rows, never inside one */
function erRows(obj,fields){return fields.map(function(f){if(f.rows)return f.rows(obj).map(function(r){return lyRow(r.l,r.v)}).join(''); /* 16 Sep 2026: a field may supply its own rows (a list stored on the record) */var v=obj[f.k];var L=(typeof STRUCTURE_LABELS!=='undefined')&&STRUCTURE_LABELS[f.k];if(L&&L[v])v=L[v];return lyRow(f.l,v)}).join('')} /* a stored choice prints as its label */
/* ── documents composed for paper (15 Sep 2026, Paul's ruling): a document is designed from the page's content and laid out for the page; it is never the page's markup passed through ── */
function erHead(title,sub){return '<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* a section heading alone, for sections that are not a table of rows. 16 Sep 2026 (Paul's ruling, from the Values Architecture printout): the sub-line sits on its own line beneath the title, in its mono face, not inline with it */
function erHeadLg(title,sub){return erHead(title,sub).replace('font-size:24px','font-size:28px')} /* 16 Sep 2026 (Paul's ruling): a section heading a step above the register's group headings (24px), for documents whose groups carry their own */
function erAppendix(title,sub){return erHeadLg('Appendix','')+'<div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111;margin:0 0 12px;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* 16 Sep 2026 (Paul's ruling): an appendix is headed Appendix, with the section's own title beneath — never labelled beside the title; its sub-line beneath the title likewise */
function erFigRow(figs){return '<div class="er-figs" style="display:grid;grid-template-columns:repeat('+figs.length+',1fr);gap:10px;margin:0 0 22px;break-inside:avoid;page-break-inside:avoid">'+figs.map(function(f){return '<div style="border:1px solid #ddd;border-top:3px solid '+(f.col||'#111')+';border-radius:6px;padding:10px 8px;text-align:center"><b style="display:block;font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:600;line-height:1.1;color:'+(f.vcol||'#111')+'">'+esc(String(f.v))+'</b><span style="display:block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-top:4px">'+esc(f.l)+'</span>'+(f.sub?'<span style="display:block;font-size:10.5px;color:#777;margin-top:2px">'+esc(f.sub)+'</span>':'')+'</div>'}).join('')+'</div>'} /* a row of figures in boxes: the value, its label, an optional line beneath, a coloured rule above */
function erBarBlock(title,sub,rows){var tone=function(v){return v>=4?'#1B6B5A':v>=2.5?'#4E7FA6':'#9B2D3F'};return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+rows.map(function(r){var v=+r.v||0,m=r.max||5;return '<tr><td style="width:40%;padding:4px 8px 4px 0;font-size:11.5px;color:#555;border-bottom:1px solid #eee;vertical-align:middle">'+esc(r.l)+'</td><td style="padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle"><div style="height:7px;background:#eee;border-radius:4px"><div style="height:7px;width:'+Math.round(v/m*100)+'%;background:'+(v?tone(v):'#eee')+';border-radius:4px"></div></div></td><td style="width:64px;padding:4px 0 4px 8px;text-align:right;white-space:nowrap;font-family:var(--mono,monospace);font-size:12px;color:#111;border-bottom:1px solid #eee;vertical-align:middle">'+(v?v.toFixed(1)+' / '+m:'\u2014')+'</td></tr>'}).join('')+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling): a headed block of bars — label · bar · score, the Readiness Report's row form — unsplittable under the block rule */
function erBlock(inner){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+inner+'</div>'} /* 16 Sep 2026: the block rule as a wrapper — a unit that is never split across pages */
/* ── Middle Management Principles, composed for paper (16 Sep 2026, Paul's page plan): the three categories as a band; the workflows as AI-does / the-manager-does pairs; the decisions that stay human; the log and the evaluation as two panels ── */
var MM_CATEGORIES=[{k:'mmAutomate',l:'Automate now',col:'#9B2D3F'},{k:'mmAugment',l:'Augment now, automate later',col:'#4E7FA6'},{k:'mmHuman',l:'Human judgment permanent',col:'#1B6B5A'}]; /* the three categories of middle-management work as Step 2.1 names them — one definition for the page and the document */
function mmPrinciplesDoc(){var mm=data.mmActivation||{},st=data.structure||{};var wf=mm.workflows||[],ho=mm.humanOnly||[];
  var h=printDocCover('Middle Management Principles','What middle management automates, augments, and keeps human; the workflows and decisions that follow; and the log and evaluation criteria that hold the new role to account.',wf.length+' workflow'+(wf.length===1?'':'s')+' \u00b7 '+ho.length+' human-only decision'+(ho.length===1?'':'s'));
  var val=function(v,extra){var t=lyText(v);return '<div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(extra||'')+'">'+esc(t?lyCap(t):'Not recorded')+'</div>'};
  var roleCell=function(label,text,divider){return '<td style="width:50%;vertical-align:top;padding:10px 14px'+(divider?';border-left:1px solid #eee':'')+'"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:4px">'+esc(label)+'</div>'+val(text)+'</td>'}; /* 16 Sep 2026 (Paul's ruling): no coloured bar at the cell's edge — a hairline between the two cells only */
  var panel=function(title,rows){return '<td style="width:50%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:12px 14px"><div style="font-size:13px;font-weight:700;color:#111;margin:0 0 8px">'+esc(title)+'</div>'+rows.map(function(r){return '<div style="margin:0 0 10px"><div style="font-size:11px;color:#555;margin-bottom:2px">'+esc(r[0])+'</div>'+val(r[1],(r[2]&&lyText(r[1]))?';font-family:var(--mono,monospace);font-size:11.5px':'')+'</div>'}).join('')+'</td>'};
  h+=erBlock(erHead('The Three Categories','What middle-management work is automated, augmented, or kept human')+'<table style="width:calc(100% + 24px);margin:0 -12px 22px;border-collapse:separate;border-spacing:12px 0"><tr>'+MM_CATEGORIES.map(function(c){return '<td style="width:33.3%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:10px 12px"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:6px">'+esc(c.l)+'</div>'+val(st[c.k])+'</td>'}).join('')+'</tr></table>');
  h+=erHead('AI-Augmented Workflows',wf.length?wf.length+' workflow'+(wf.length===1?'':'s')+' \u2014 what AI does, and what the manager does':'');
  h+=wf.length?wf.map(function(w){return erBlock('<div style="border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden"><div style="padding:8px 14px;font-size:13px;font-weight:700;color:#111;border-bottom:1px solid #eee">'+esc(lyCap(lyText(w.name)||'Unnamed workflow'))+'</div><table style="width:100%;border-collapse:collapse"><tr>'+roleCell('AI does',w.aiRole,false)+roleCell('The manager does',w.humanRole,true)+'</tr></table></div>')}).join('')+'<div style="height:10px"></div>':'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Workflows','')+'</tbody></table>';
  h+=erSection('Decisions That Stay Human',ho.length?ho.map(function(d){var t=lyText(d.reason);return '<tr><td style="width:40%;padding:6px 10px 6px 0;vertical-align:top;font-size:12.5px;font-weight:700;color:#111;border-bottom:1px solid #eee">'+esc(lyCap(lyText(d.decision)||'Unnamed decision'))+'</td><td style="padding:6px 0 6px 10px;vertical-align:top;font-size:12.5px;line-height:1.5;border-bottom:1px solid #eee;color:'+(t?'#333':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</td></tr>'}).join(''):lyRow('Decisions',''),ho.length?ho.length+' decision'+(ho.length===1?'':'s')+' \u2014 and why each stays human':'');
  h+=erBlock(erHead('Log and Evaluation','How AI use is recorded, and how managers are now assessed')+'<table style="width:calc(100% + 24px);margin:0 -12px 22px;border-collapse:separate;border-spacing:12px 0"><tr>'+panel('The AI Use Log',[['Template',mm.logTemplate,true],['Review cadence',mm.logCadence]])+panel('Evaluating Managers',[['Criteria',mm.evalCriteria],['Success metrics',mm.evalMetrics]])+'</tr></table>');
  return h}
/* ── Values Architecture, composed for paper (16 Sep 2026, Paul's page plan): the commitments lead; the principles by domain, numbered continuously; the roles that carry each principle; the embedding and the AI Purpose Filter; the divergences; at Full depth, an appendix of each leader's Step 2.4 reflections ── */
var VALUES_DOMAIN_GLOSS={ontological:'What things are \u2014 identity, nature, categories',epistemological:'What counts as evidence and knowledge',ethical:'What we value and where we draw lines'}; /* the domains' glosses as Step 3.4's selector gives them */
var MINDSET_REFLECTION_LABELS=[['val1','Ontological (What is your organization?)'],['val2','Ontological (What is your product/service?)'],['val3','Epistemological (What are your evidence standards?)'],['val4','Ethical (What positions survive the 10% test?)'],['val5','Additional reflection']]; /* the Step 2.4 questions as the 3.4 reference labels them */
function valuesRoleList(){return (data.orgChart||[]).filter(function(r){return r.level!==0||r.id==='crossfunc'})} /* the roles the 3.4 tagging tab offers */
function valuesRoleWho(r){var l=r.occupantLeaderId?(data.leaders||[]).filter(function(x){return x.id===r.occupantLeaderId})[0]:null;return l?l.name:''}
function valuesOrdered(){var ov=data.orgValues||[],out=[],n=0;VALUES_DOMAINS.forEach(function(d){ov.filter(function(v){return v.domain===d.id}).forEach(function(v){out.push({n:++n,v:v,d:d.id})})});ov.filter(function(v){return !VALUES_DOMAINS.some(function(d){return d.id===v.domain})}).forEach(function(v){out.push({n:++n,v:v,d:''})});return out} /* the principles numbered continuously in domain order */
function valuesFigures(){var ov=data.orgValues||[],roles=valuesRoleList();var has=function(r,v){return (r.taggedValues||[]).indexOf(v.id)>=0};return {principles:ov.length,roles:roles.length,carrying:roles.filter(function(r){return ov.some(function(v){return has(r,v)})}).length,unplaced:ov.filter(function(v){return !roles.some(function(r){return has(r,v)})}).length}}
function valuesReflectors(){var md=data.mindsetDepth||{};return (data.leaders||[]).filter(function(l){var m=md[l.id];return !!(m&&(m.val1||m.val2||m.val3||m.val4||m.val5))})}
function valuesDoc(){var ov=data.orgValues||[],vd=data.valuesDiscussion||{};var depth=(UI.printDepth||'summary');var fig=valuesFigures(),ord=valuesOrdered(),refl=valuesReflectors(),roles=valuesRoleList();
  var h=printDocCover('Values Architecture','The leadership team\u2019s philosophical commitments; its shared principles in three domains and the roles that carry them; how the principles are kept alive in practice and in the adoption of AI tools; and where the team diverged.',ov.length+' principle'+(ov.length===1?'':'s')+' \u00b7 '+fig.carrying+' of '+fig.roles+' roles carry values'+(depth==='full'?' \u00b7 '+refl.length+' leader'+(refl.length===1?'\u2019s':'s\u2019')+' reflections':''));
  var cc=lyText(vd.collectiveCommitments);
  h+=erBlock(erHead('Our Philosophical Commitments','How this leadership team will think about AI')+'<div style="border:1px solid #ddd;border-radius:6px;padding:20px 24px;margin:0 0 24px;font-family:var(--serif,Georgia,serif);font-size:18px;line-height:1.5;white-space:pre-line;color:'+(cc?'#111':'#888')+(cc?'':';font-style:italic')+'">'+esc(cc?lyCap(cc):'Not recorded')+'</div>');
  h+=erHead('Shared Principles',ov.length?ov.length+' principle'+(ov.length===1?'':'s')+' across three domains':'');
  VALUES_DOMAINS.forEach(function(d){var list=ord.filter(function(o){return o.d===d.id});var col='#555'; /* 16 Sep 2026 (Paul's ruling): the document is greyscale; DOMAIN_COL serves the page */h+=erBlock('<div style="margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #ddd"><span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:'+col+'">'+esc(d.l)+'</span><span style="font-size:11.5px;color:#555;margin-left:10px">'+esc(VALUES_DOMAIN_GLOSS[d.id]||'')+'</span></div>'+(list.length?'<table style="width:100%;border-collapse:collapse;margin:0 0 18px"><tbody>'+list.map(function(o){return '<tr><td style="width:34px;padding:6px 0;vertical-align:top;font-family:var(--mono,monospace);font-size:12px;color:'+col+';border-bottom:1px solid #eee">'+o.n+'</td><td style="padding:6px 0;vertical-align:top;font-size:13px;line-height:1.5;color:#111;border-bottom:1px solid #eee">'+esc(lyCap(lyText(o.v.principle)))+'</td></tr>'}).join('')+'</tbody></table>':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 18px">No principles in this domain.</div>'))});
  h+=erBlock(erHead('The Roles That Carry Each Principle','Where the principles are tagged in the leadership structure')+erFigRow([{v:fig.principles,l:'Principles'},{v:fig.carrying+' / '+fig.roles,l:'Roles carrying values'},{v:fig.unplaced,l:'Not yet placed'}])+(ord.length?'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+ord.map(function(o){var rs=roles.filter(function(r){return (r.taggedValues||[]).indexOf(o.v.id)>=0});return '<tr><td style="width:40%;padding:6px 10px 6px 0;vertical-align:top;font-size:12.5px;color:#111;border-bottom:1px solid #eee"><span style="font-family:var(--mono,monospace);font-size:11px;color:#555;margin-right:6px">'+o.n+'</span>'+esc(lyCap(lyText(o.v.principle)))+'</td><td style="padding:6px 0 6px 10px;vertical-align:top;font-size:12.5px;line-height:1.55;color:#111;border-bottom:1px solid #eee">'+(rs.length?rs.map(function(r){var who=valuesRoleWho(r);return esc(r.id==='board'?'Board':(r.name||'Unnamed role'))+(who?' <span style="color:#555">\u00b7 '+esc(who)+'</span>':'')}).join('<br>'):'<span style="color:#888;font-style:italic">Not yet tagged to any role</span>')+'</td></tr>'}).join('')+'</tbody></table>':'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Principles','')+'</tbody></table>'));
  var flt=lyText((data.fluencySprint||{}).filter),mission=((data.assessments||{}).purpose||{}).mission;
  h+=erBlock(erHead('Keeping the Principles Alive','How the principles become practice, and the gate every AI tool passes')+'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 16px"><tbody>'+lyRow('In daily practice',vd.embedding)+'</tbody></table><div style="font-size:13px;font-weight:700;color:#111;margin:0 0 6px">The AI Purpose Filter</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Our purpose',mission)+'<tr><td style="width:34%;padding:5px 10px 5px 10px;vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">Before adopting an AI tool, we ask</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;line-height:1.5;border-bottom:1px solid #eee;white-space:pre-line;color:'+(flt?'#111':'#888')+(flt?'':';font-style:italic')+'">'+esc(flt?lyCap(flt):'Not recorded')+'</td></tr></tbody></table>');
  h+=erSection('Where the Team Diverged',lyRow('Divergences, and what they told the team',vd.divergences));
  if(depth==='full'){h+='<div style="break-before:page;page-break-before:always">'+erAppendix('The Reflections Behind the Principles','Each leader\u2019s answers in Step 2.4, Mindset Depth \u2014 the reference the team synthesized from')+(refl.length?refl.map(function(l){var m=(data.mindsetDepth||{})[l.id]||{};return erBlock('<div style="margin:14px 0 6px;padding-bottom:6px;border-bottom:2px solid #111"><span style="font-size:14px;font-weight:700;color:#111">'+esc(l.name)+'</span><span style="font-size:11.5px;color:#555;margin-left:10px">'+esc(leaderRoleName(l))+'</span></div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px"><tbody>'+MINDSET_REFLECTION_LABELS.map(function(q){return lyRow(q[1],m[q[0]])}).join('')+'</tbody></table>')}).join(''):'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Reflections','')+'</tbody></table>')+'</div>'} /* Full depth only: Summary omits the appendix */
  return h}
function readinessDoc(){ /* the Readiness Report, composed for paper: the overall score and its reading, the five areas as figures, then one block per area with every question's score as a bar */
  var co=data.completedSections||{};var done=['A','B','C','D','E'].filter(function(x){return co[x]}).length;
  var areas=readinessAreas();var scores=areas.map(function(x){return x.avg});var overall=scores.length?scores.reduce(function(x,y){return x+y},0)/scores.length:0;
  var tone=function(v){return v>=4?'#1B6B5A':v>=2.5?'#4E7FA6':'#9B2D3F'};var barTone=function(v){return v>=4?'#1B6B5A':v>=3?'#4E7FA6':'#9B2D3F'};
  var h=printDocCover('Readiness Report','The organization\u2019s readiness at the start of the program: its scores in the five areas of the Assessment Battery, and the overall score.','')+'<div class="rd-doc">';
  h+=erHead('Overall Readiness',done<5?'Assessment Battery complete in '+done+' of 5 sections':'');
  h+='<div style="border:2px solid '+tone(overall)+';border-radius:6px;padding:18px 20px;margin:0 0 18px;text-align:center;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--serif,Georgia,serif);font-size:48px;font-weight:600;line-height:1;color:'+tone(overall)+'">'+overall.toFixed(1)+'<span style="font-size:20px;color:#777;font-weight:400"> / 5</span></div><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#555;margin-top:8px">Overall Readiness Score</div><div style="font-size:13px;color:#333;margin-top:10px">'+esc(readinessReading(overall))+'</div></div>';
  h+=erFigRow(areas.map(function(x){return {v:x.avg?x.avg.toFixed(1):'\u2014',l:x.cat.name,col:x.avg?tone(x.avg):'#bbb',vcol:x.avg?tone(x.avg):'#999'}}));
  if(done<5)return h+'<p style="font-size:13px;color:#555;margin:0 0 18px">The Assessment Battery is complete in '+done+' of 5 sections.</p></div>';
  h+=erHead('The Five Areas','Every question scored 1 to 5');
  areas.forEach(function(x){
    h+='<div style="border:1px solid #ddd;border-radius:6px;padding:14px 16px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px"><div style="font-family:var(--serif,Georgia,serif);font-size:18px;font-weight:700;color:#111">'+esc(x.cat.name)+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:'+tone(x.avg)+'">Average '+(x.avg?x.avg.toFixed(1):'\u2014')+' / 5</div></div><table style="width:100%;border-collapse:collapse"><tbody>';
    x.cat.fields.forEach(function(f){var v=typeof x.sub[f]==='number'?x.sub[f]:0;h+='<tr><td style="width:40%;padding:4px 8px 4px 0;font-size:11.5px;color:#555;border-bottom:1px solid #eee;vertical-align:middle">'+esc(READINESS_LABELS[f]||f)+'</td><td style="padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle"><div style="height:7px;background:#eee;border-radius:4px"><div style="height:7px;width:'+(v*20)+'%;background:'+(v?barTone(v):'#eee')+';border-radius:4px"></div></div></td><td style="width:44px;padding:4px 0 4px 8px;text-align:right;font-family:var(--mono,monospace);font-size:12px;color:#111;border-bottom:1px solid #eee;vertical-align:middle">'+(v?v+' / 5':'\u2014')+'</td></tr>'});
    h+='</tbody></table>';
    if(x.sub.mission)h+='<div style="margin-top:12px"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin:0 0 3px">Mission statement</div><div style="font-size:12.5px;color:#111;line-height:1.5">'+esc(lyCap(x.sub.mission))+'</div></div>';
    if(x.sub.priorities)h+='<div style="margin-top:10px"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin:0 0 3px">Top 3 strategic priorities</div><div style="font-size:12.5px;color:#111;line-height:1.5;white-space:pre-line">'+esc(lyCap(x.sub.priorities))+'</div></div>';
    h+='</div>'});
  return h+'</div>'}
function riskMapDoc(){ /* the Risk Map, composed for paper: the count of Critical, Moderate, and Low risks, then every scored risk highest first with its three scores and its bar, then the scenarios not yet scored */
  var risks=data.risks||[];var scored=risks.filter(function(r){return lriskTotal(r)>0}).sort(function(a,b){return lriskTotal(b)-lriskTotal(a)});
  var tone=function(t){return t>10?'#9B2D3F':t>5?'#4E7FA6':'#1B6B5A'};
  var counts={Critical:0,Moderate:0,Low:0};scored.forEach(function(r){counts[lriskBand(r)]++});
  var h=printDocCover('Risk Map','The seven leadership risks, scored for likelihood, impact, and time horizon, highest first.','')+'<div class="rm-doc">';
  h+=erHead('Risk Summary',scored.length+' of 7 scenarios assessed');
  h+=erFigRow([{v:counts.Critical,l:'Critical risks',sub:'Score above 10 / 15',col:counts.Critical?'#9B2D3F':'#1B6B5A',vcol:counts.Critical?'#9B2D3F':'#1B6B5A'},{v:counts.Moderate,l:'Moderate',sub:'Score 6 to 10',col:'#4E7FA6',vcol:'#4E7FA6'},{v:counts.Low,l:'Low',sub:'Score 1 to 5',col:'#1B6B5A',vcol:'#1B6B5A'}]);
  if(!scored.length)return h+'<p style="font-size:13px;color:#555;margin:0 0 18px">No risks have been scored yet.</p></div>';
  h+=erHead('Scored Risks','Highest score first');
  scored.forEach(function(r){var t=lriskTotal(r);var col=tone(t);var name=LRISK_NAMES[r.id]||r.id||'Unnamed risk';var notes=r.notes||data['risk_'+r.id+'_notes']||'';
    h+='<div style="border:1px solid #ddd;border-left:4px solid '+col+';border-radius:6px;padding:14px 16px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid">'
     +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px"><div style="font-family:var(--serif,Georgia,serif);font-size:18px;font-weight:700;color:#111">'+esc(name)+'</div><div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.06em;color:'+col+'">'+t+' / 15 \u00b7 '+lriskBand(r)+'</div></div>'
     +'<div style="height:8px;background:#eee;border-radius:4px;margin:0 0 10px"><div style="height:8px;width:'+Math.round(t/15*100)+'%;background:'+col+';border-radius:4px"></div></div>'
     +'<table style="width:100%;border-collapse:collapse"><tbody><tr>'+[['Likelihood',r.likelihood],['Impact',r.impact],['Time horizon',r.timeHorizon]].map(function(p){return '<td style="width:33%;padding:4px 0;border:none"><span style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555">'+p[0]+'</span> <span style="font-size:13px;color:#111;margin-left:6px">'+(+p[1]||0)+' / 5</span></td>'}).join('')+'</tr></tbody></table>'
     +(notes?'<div style="font-size:12.5px;color:#333;line-height:1.5;margin-top:8px">'+esc(lyCap(notes))+'</div>':'')+'</div>'});
  var unscored=Object.keys(LRISK_NAMES).filter(function(id){return !scored.some(function(r){return r.id===id})});
  if(unscored.length)h+=erHead('Not Yet Scored',unscored.length+' of 7')+'<table style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:avoid;page-break-inside:avoid"><tbody>'+unscored.map(function(id){return '<tr><td style="padding:5px 10px;font-size:12.5px;color:#111;border-bottom:1px solid #eee">'+esc(LRISK_NAMES[id])+'</td></tr>'}).join('')+'</tbody></table>';
  return h+'</div>'}
var ER_SINGLE_DOCS={
 'out-readiness':function(){return readinessDoc()}, /* 15 Sep 2026 (Paul's ruling): composed for paper */
 'out-structure':function(){var st=data.structure||{};var h=printDocCover('Leadership Structure','How the organization has structured its leadership for AI: ownership, board governance, the senior layer, middle management principles, and cross-functional coordination.','');
   STRUCTURE_SECTIONS.forEach(function(sec){h+=erSection(sec.name,erRows(st,sec.fields),st[sec.id+'_done']?'Complete':'')});return h},
 'out-collab':function(){var cl=data.collabLab||{};var h=printDocCover('Collaboration Principles','Where and how people and AI work together in this organization: touchpoints, collaboration models, AI personas, AI-free zones, and the translation layer.','');
   COLLAB_SECTIONS.forEach(function(sec){h+=erSection(sec.name,erRows(cl,sec.fields),cl[sec.id+'_done']?'Complete':'')});return h},
 'out-decisions':function(){var ds=data.decisionSims||{};var h=printDocCover('Decision Analyses','The four decision simulations: the organization\u2019s response to each scenario and the ethical pre-mortem behind it.','');
   var done=DECISION_SCENARIOS.filter(function(sc){return ds[sc.id+'_response']||ds[sc.id+'_premortem']}).length;h+=erHead('The Four Scenarios',done+' of 4 answered');
   var box=function(sc){var r=lyText(ds[sc.id+'_response']),p=lyText(ds[sc.id+'_premortem']);var part=function(label,t,tint){return '<div style="padding:12px 16px;border-top:1px solid #eee'+(tint?';background:#f4f4f4':'')+'"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:5px">'+label+'</div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'};return '<td style="width:50%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:0;overflow:hidden"><div style="padding:14px 16px 10px"><div style="font-size:14px;font-weight:700;color:#111;margin-bottom:3px"><span style="color:#555;margin-right:6px">'+sc.icon+'</span>'+esc(sc.name)+'</div><div style="font-size:11.5px;color:#555;line-height:1.45">'+esc(sc.desc)+'</div></div>'+part('Our response',r,false)+part('Ethical pre-mortem',p,true)+'</td>'};
   [[0,1],[2,3]].forEach(function(pair){h+=erBlock('<table style="width:calc(100% + 16px);margin:0 -8px 8px;border-collapse:separate;border-spacing:8px 0"><tr>'+box(DECISION_SCENARIOS[pair[0]])+box(DECISION_SCENARIOS[pair[1]])+'</tr></table>')});return h}, /* 16 Sep 2026 (Paul's ruling): the page's four boxes kept on paper — two rows of two, each row unsplittable; each box the scenario, the response, the pre-mortem — greyscale, as the other Phase 3 documents were ruled */
 'out-mmprinciples':function(){return mmPrinciplesDoc()}, /* 16 Sep 2026 (Paul's ruling): composed for paper to his page plan */
 'out-values':function(){return valuesDoc()}, /* 16 Sep 2026 (Paul's ruling): composed for paper to his page plan; depth: Full adds the appendix of reflections */
 'out-rhythm':function(){var or_=data.opRhythm||{};var rh=data.rhythm||{};var cad={weekly:'Weekly',fortnightly:'Fortnightly',monthly:'Monthly'};var h=printDocCover('Operating Rhythm','The permanent operating cadence for AI-ready leadership: the leadership meeting, peer learning, decision simulations, and the external and board rhythm.','');
   RHYTHM_GROUPS.forEach(function(g){h+=erSection(g.title,erRows(or_,g.items))});return h},
 'out-evalplan':function(){var ev=data.evalSuccession||{};var h=printDocCover('Evaluation Plan','How leaders are evaluated and succession is planned for the AI era: the readiness indicators, their weighting, the bench, and the board.','');
   h+=erSection('Evaluation Criteria',erRows(ev,EVAL_FIELDS.evaluation));h+=erSection('Succession Planning',erRows(ev,EVAL_FIELDS.succession));return h}
};
Object.keys(ER_SINGLE_DOCS).forEach(function(k){PRINT_DOCS[k]=ER_SINGLE_DOCS[k]});

/* ── PHASE 5 DOCUMENTS (14 Sep 2026): the Leadership Dashboard and My Development print as their own documents ── */
function erOrgChartPage(sectionHead){if(typeof syncCouncilNode==='function')syncCouncilNode();if(typeof syncPhase1Chart==='function')syncPhase1Chart();var roles=data.orgChart||[];if(!roles.length)return '';var layout=layoutOrgTreeForPaper(roles,1000,650);return '<style>.ed-chart{page:edchart;break-before:page;page-break-before:always;width:990px;margin-left:0}.ed-chart svg{display:block;width:100%;max-height:650px;height:auto}@page edchart{size:landscape;margin:8mm 8mm 14mm 8mm}@media print and (max-width:800px){.ed-chart{width:1058px}}</style><div class="ed-chart">'+(sectionHead||'')+erHead('Org Chart','')+orgChartSvgHtml(roles,layout,{paper:true})+'</div>'} /* 16 Sep 2026 (Paul's rulings): the organization chart alone on a landscape page — the paper layout, the block at the page-area edge sized to the sheet (990px Letter, 1058px A4 by print media query) — shared by the Leadership Structure and the Leadership Inventory */
function erRoleDetailPrint(r,roles,leaders){var occ=(r.level===1)?null:roleOccupant(r);var h=renderOrgDetail(r,roles,leaders,{print:true});
  h=h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<select[\s\S]*?<\/select>/g,'<span style="font-size:13px;color:var(--paper);font-weight:600">'+esc(occ?occ.name:'Unassigned')+(occ?' \u00b7 ':'')+'</span>').replace(/ onclick="[^"]*"/g,'').replace(/cursor:pointer;?/g,'');
  return h} /* 16 Sep 2026 (Paul's ruling): a role prints as the page shows it — the detail box in its level's colour — with the Edit and Close buttons gone and the Assigned-to select replaced by the occupant's name */
function erDashboardDoc(opts){opts=opts||{}; /* the Leadership Dashboard (5.1), whose document is titled Leadership Structure (Paul's ruling, 15 Sep 2026). 16 Sep 2026 (Paul's ruling): the cover; Org Chart alone on a landscape page, filling it; at Summary the Role Details table (the legacy window's), at Full one page per role — the page's detail box in its colour, controls removed; the Competency Summary as an appendix on its own last page. The staffing figures and the policies section no longer print here (the cover's count line carries the staffing; the policies print in their own documents). */
  if(typeof syncCouncilNode==='function')syncCouncilNode();if(typeof syncPhase1Chart==='function')syncPhase1Chart();
  var roles=data.orgChart||[],leaders=data.leaders||[];var layout=layoutOrgTreeForPaper(roles,1000,650);var depth=(UI.printDepth||'summary'); /* the paper layout (also drawn by erOrgChartPage) orders the role pages */
  var positionRoles=roles.filter(function(r){return r.id!=='board'&&r.id!=='crossfunc'});var filled=positionRoles.filter(function(r){return roleHasOccupant(r)}).length;
  var css='<style>.ed-doc table{font-size:11.5px}.ed-doc th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111 !important}.ed-doc td{vertical-align:top}.ed-role{break-before:page;page-break-before:always}.ed-role>div{margin-top:0 !important}.ed-role [style*="margin-bottom:20px"]{margin-bottom:12px !important}.ed-role [style*="padding:24px"]{padding:14px 24px 4px !important}.ed-role [style*="padding:20px 24px"]{padding:14px 24px !important}</style>';
  /* the chart page: a landscape page with 8mm side margins. The document body carries no horizontal padding in print (body{margin:0;padding:0}) and is pinned to the page-area edge, so the block starts at margin-left:0 — both 16 Sep prints measured to that. The width follows the sheet: 990px fills a Letter landscape page area (263mm); the print media query reads the sheet's portrait width and, under 800px (A4 is 794px, Letter 816px), widens the block to 1058px for A4's 281mm */
  var h=(opts.noCover?'':printDocCover('Leadership Structure','The leadership structure as it stands: the organization chart, every role '+(depth==='full'?'in full, one to a page':'in summary')+', and every leader\u2019s competency scores.',positionRoles.length+' position'+(positionRoles.length===1?'':'s')+' \u00b7 '+filled+' filled \u00b7 '+leaders.length+' leader'+(leaders.length===1?'':'s')))+css+'<div class="ed-doc">';
  h+=erOrgChartPage(opts.sectionHead||''); /* a compiled report's section heading rides at the top of this page */
  if(depth==='full'){var pos=layout.pos||{};var ordered=roles.slice().sort(function(p,q){var a=pos[p.id]||{x:1e9,y:1e9},b=pos[q.id]||{x:1e9,y:1e9};return (a.y-b.y)||(a.x-b.x)});ordered.forEach(function(r){h+='<div class="ed-role">'+erRoleDetailPrint(r,roles,leaders)+'</div>'})}
  else h+='<div style="break-before:page;page-break-before:always">'+erHead('Role Details',roles.length+' role'+(roles.length===1?'':'s'))+orgRolesTableHtml(roles,leaders)+'</div>';
  h+='<div style="break-before:page;page-break-before:always">'+erAppendix('Competency Summary','Every leader\u2019s seven scores')+competencySummaryTable()+'</div>';
  return h+'</div>'}
var MY_REVIEWS=[{k:'slowLog',t:'Slow Thinking Log',d:'Record one decision where you deliberately slowed down and exercised independent judgment.'},{k:'stopReview',t:'STOP Technique Review',d:'Revisit your three STOP situations. Are they still the right ones?'},{k:'depScan',t:'Dependency Scan',d:'Update your inventory of skills outsourced to AI.'},{k:'reverseAudit',t:'Skill Atrophy Audit',d:'Check your atrophying skill.'},{k:'valuesReview',t:'Values Architecture Review',d:'Revisit your four commitments. Has anything drifted?'},{k:'concernCircle',t:'AI Concern Circles',d:'Share one fear and one hope.'},{k:'commitments',t:'Philosophical Commitments',d:'Does your personal commitments statement still hold?'}];
function myDevDoc(){ /* My Development (5.3): the signed-in leader's record, then the seven monthly reviews with their state this month and the date last done. Buttons and the cadence note do not print. */
  var ml=(typeof getMyLeader==='function')?getMyLeader():null;var uid=(typeof currentUserId!=='undefined'&&currentUserId)||'u1';var log=((data.practiceLog||{})[uid])||{};var thisMonth=periodKey(new Date());
  var h=printDocCover('My Development','Your personal leadership development reviews: everything that should be maintained on an ongoing basis, in one place.','');
  if(ml)h+=lyRender('leader',ml,'full',null);else h+='<p style="font-size:13px;color:#666;font-style:italic;margin:0 0 18px">No leader record is linked to this account.</p>';
  var rows=MY_REVIEWS.map(function(r){var last=log[r.k];var done=!!(last&&periodKey(new Date(last))===thisMonth);return lyRow(r.t,(done?'Complete this month':'Incomplete this month')+(last?' \u00b7 last done '+lyDate(last):' \u00b7 not yet done')+'\n'+r.d)}).join('');
  return h+erSection('Monthly Reviews',rows)}

/* ═══ REPORT MANAGER (family code, ported from the Governance build 14 Sep 2026; Spec Rev A §9). A named report definition on the organization holds an ordered list of units — outputs, Phase 5 pages, individual leaders and risks, and text pages the user writes — with a depth where a unit has one and a note per section. The compiled document is one cover, a contents page, the introduction, and each unit as a numbered section. The record is never edited here. ═══ */
function rcInp(label,id,val,ph){return '<div class="mb-4"><label class="form-label">'+esc(label)+'</label><input type="text" id="'+id+'" data-uncapped="1" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'" style="width:100%"></div>'}
function rcBtnG(label,onclick,style){return '<button class="btn bg2" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
function rcBtnS(label,onclick,color,style){return '<button class="btn bp" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
function printDocumentPreview(title,content,opts){printDocument(title,content,'',opts)} /* the Report Manager's print and preview go through the shared window */
var RC_PAGE_UNITS=[['5.1','Leadership Structure'],['5.2','L&D Hub'],['5.3','My Development']]; /* 16 Sep 2026 (Paul's ruling): the 5.1 section is Leadership Structure, as its document is titled */
function rcUnitName(u){if(u.kind==='page'){var p=RC_PAGE_UNITS.filter(function(x){return x[0]===u.id})[0];if(p)return p[1]}if(u.kind==='record'&&u.type==='person'){var pp=prPerson(u.id);return 'Personal record: '+((pp&&pp.name)||u.name||'')} /* Part 7 (A.7.2), the name read live */return u.name||(u.kind==='text'?'Untitled page':'')} /* a page unit's name is read live, so a saved report follows a renaming */
/* PERSONAL RECORD (directive 2 Oct 2026, Part 7): any person the organization holds information about, user or not, can be given a
   printed copy of what is held about them. The Report Manager's group Individual People (A.7.1) lists everyone on the people list and
   every leader in the inventory, each once (a leader is matched to a person by the leader's userId). The record prints, in order: the
   leader record at full depth, the practice log, the Team Chat messages they sent, the notes they wrote, and every other record that
   names them by id or full name, with the record and the field. A name counts only as a full name (two words or more): a one-word
   name such as the sample facilitator's "a" would match every sentence. No password field is ever printed. */
var PR_NEVER = /pass|pin_?hash|mustchange|temporary|credential/i;
function prPeople() {
  var out = [], seen = {};
  (data.roster || USERS || []).forEach(function (u) {
    if (!u || !u.id || seen['u:' + u.id]) return; seen['u:' + u.id] = 1;
    var l = (data.leaders || []).filter(function (x) { return x && x.userId === u.id; })[0] || null;
    if (l) seen['l:' + l.id] = 1;
    out.push({ id: u.id, userId: u.id, leaderId: l ? l.id : null, name: (u.name || (l && l.name) || 'Unnamed'), role: u.role || (l && l.role) || '' });
  });
  (data.leaders || []).forEach(function (l) {
    if (!l || !l.id || seen['l:' + l.id]) return; seen['l:' + l.id] = 1;
    out.push({ id: 'leader:' + l.id, userId: null, leaderId: l.id, name: l.name || 'Unnamed leader', role: l.role || '' });
  });
  return out;
}
function prPerson(id) { return prPeople().filter(function (p) { return p.id === id; })[0] || null; }
function prLabel(k) { k = String(k); if (/^\d+$/.test(k)) return '#' + (+k + 1); return lyCap(k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()); }
function prItemName(o, i) { if (o && typeof o === 'object') { var n = o.name || o.title || o.label || o.subject || o.text || o.id; if (n) return String(n).slice(0, 80); } return '#' + (i + 1); }
/* Every place that names the person: [{record, field, value}]. ids: the people-list id and the leader id; names: full names only. */
function prMentions(p) {
  var ids = [p.userId, p.leaderId].filter(Boolean), hits = [];
  var u = p.userId ? (data.roster || []).filter(function (x) { return x && x.id === p.userId; })[0] : null;
  if (u && u.serverId) ids.push(String(u.serverId));
  var names = [p.name].concat(p.leaderId ? [((data.leaders || []).filter(function (x) { return x.id === p.leaderId; })[0] || {}).name] : [])
    .filter(function (n, i, a) { return n && String(n).trim().split(/\s+/).length >= 2 && a.indexOf(n) === i; })
    .map(function (n) { return new RegExp('(^|[^A-Za-z])' + String(n).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '([^A-Za-z]|$)', 'i'); });
  var idKey = function (k) { return ids.some(function (id) { return k === id || k.indexOf(id + '_') === 0 || k.slice(-(id.length + 1)) === '_' + id; }); };
  var names_ = function (v) { return names.some(function (re) { return re.test(v); }); };
  function walk(v, rec, field, depth) {
    if (depth > 12 || v == null) return;
    if (typeof v === 'string' || typeof v === 'number') {
      var sv = String(v);
      if (ids.indexOf(sv) >= 0 || names_(sv)) hits.push({ record: rec, field: field, value: sv });
      return;
    }
    if (Array.isArray(v)) { v.forEach(function (x, i) { walk(x, (x && typeof x === 'object') ? rec + ' \u00b7 ' + prItemName(x, i) : rec, (x && typeof x === 'object') ? '' : field, depth + 1); }); return; }
    if (typeof v === 'object') Object.keys(v).forEach(function (k) {
      if (PR_NEVER.test(k)) return;
      var f = field ? field + ' \u00b7 ' + prLabel(k) : prLabel(k);
      if (idKey(k)) { hits.push({ record: rec, field: f, value: (v[k] && typeof v[k] === 'object') ? '' : String(v[k] == null ? '' : v[k]) }); }
      walk(v[k], rec, f, depth + 1);
    });
  }
  Object.keys(data || {}).forEach(function (key) {
    if (PR_NEVER.test(key) || ['roster', 'members', 'settings', 'rev', 'schemaVersion', 'notes', 'chatMsgs'].indexOf(key) >= 0) return;
    var val = data[key];
    if (key === 'practiceLog' && p.userId && val) { val = Object.assign({}, val); delete val[p.userId]; }   /* printed above, with its dates */
    if (key === 'leaders' && Array.isArray(val)) val = val.filter(function (x) { return !(x && x.id === p.leaderId); });   /* printed above, at full depth */
    if (key === 'reportDefs' && Array.isArray(val)) val = val.map(function (d) { return Object.assign({}, d, { units: (d.units || []).filter(function (x) { return x.type !== 'person'; }) }); });
    walk(val, prLabel(key), '', 0);
  });
  return hits;
}
function prHead(t) { return '<div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#555;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #999">' + esc(t) + '</div>'; }
function prTable(head, rows) {
  if (!rows.length) return '';
  var h = '<table style="width:100%;border-collapse:collapse;font-size:12.5px;line-height:1.5"><thead><tr>' + head.map(function (x) { return '<th style="text-align:left;border-bottom:1px solid #999;padding:4px 6px">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
  rows.forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td style="vertical-align:top;border-bottom:1px solid #e3e3e3;padding:4px 6px">' + esc(c == null ? '' : String(c)) + '</td>'; }).join('') + '</tr>'; });
  return h + '</tbody></table>';
}
function personalRecordDoc(id) {
  var p = prPerson(id);
  if (!p) return '<p style="font-size:13px;color:#666;font-style:italic">This person is no longer on the record.</p>';
  var h = '<p style="font-size:14px;line-height:1.6;color:#222;margin:0 0 16px">The information this workspace holds about ' + esc(p.name) + ', gathered from every part of the program.</p>';
  var u = p.userId ? (data.roster || []).filter(function (x) { return x && x.id === p.userId; })[0] : null;
  if (u) h += prHead('Team Members') + prTable(['Field', 'Value'], Object.keys(u).filter(function (k) { return !PR_NEVER.test(k) && u[k] != null && u[k] !== '' && typeof u[k] !== 'object'; }).map(function (k) { return [prLabel(k), u[k]]; }));
  var l = p.leaderId ? (data.leaders || []).filter(function (x) { return x.id === p.leaderId; })[0] : null;
  if (l) h += prHead('Individual Leaders') + lyRender('leader', l, 'full', null);
  var log = p.userId ? ((data.practiceLog || {})[p.userId] || {}) : {};
  var logRows = Object.keys(log).filter(function (k) { return !PR_NEVER.test(k); }).map(function (k) { return [LEADER_PRACTICES[k] || prLabel(k), lyDate(log[k])]; });
  if (logRows.length) h += prHead('Practices') + prTable(['Practice', 'Date'], logRows);
  var mine = [p.userId, u && u.serverId].filter(Boolean).map(String);
  var clock = function (v) { var d = new Date(v); return isNaN(d) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  var chat = p.userId ? (data.chatMsgs || []).filter(function (m) { return m && m.who === p.userId; }).map(function (m) { return [m.date ? lyDate(m.date) + (m.ts ? ' ' + m.ts : '') : (m.ts || ''), m.text || '']; }) : [];
  /* where Team Chat is kept on the server (the live app), the messages the page has loaded for this organization's program */
  ((typeof chatMessages !== 'undefined' && Array.isArray(chatMessages)) ? chatMessages : []).forEach(function (m) { if (m && mine.indexOf(String(m.user_public_id)) >= 0) chat.push([lyDate(m.created_at) + ' ' + clock(m.created_at), m.body || '']); });
  if (chat.length) h += prHead('Team Chat') + prTable(['Date', 'Message'], chat);
  var notes = p.userId ? (data.notes || []).filter(function (n) { return n && n.by === p.userId; }).map(function (n) { return [lyDate(n.date), n.text || '', n.where || '']; }) : [];
  /* where notes are kept on the server, each person's are private to them: the page holds only the signed-in person's own */
  if (p.userId && p.userId === currentUserId && typeof notesData !== 'undefined' && Array.isArray(notesData)) notesData.forEach(function (n) { if (n) notes.push([lyDate(n.created_at), n.body || '', n.step ? 'Step ' + n.step : '']); });
  if (notes.length) h += prHead('Notes') + prTable(['Date', 'Note', 'Where'], notes);
  var m = prMentions(p);
  if (m.length) h += prHead('Records') + prTable(['Record', 'Field', 'Value'], m.map(function (x) { return [x.record, x.field, x.value.length > 160 ? x.value.slice(0, 157) + '\u2026' : x.value]; }));
  return h;
}
function rcCatalogue(){var out=[];
  PH.forEach(function(p){if(p.id===5)return;(p.outcomes||[]).forEach(function(o){if(PRINT_DOCS[o.id])out.push({kind:'output',id:o.id,name:o.name,group:'Outputs \u00b7 Phase '+p.id,depths:DEPTHED_OUTPUTS[o.id]?['summary','full']:null})})});
  RC_PAGE_UNITS.forEach(function(x){out.push({kind:'page',id:x[0],name:x[1],group:'Phase 5 pages'})});
  (data.leaders||[]).forEach(function(l){out.push({kind:'record',type:'leader',id:l.id,name:l.name||'Unnamed leader',group:'Individual Leaders',rec:l,sub:leaderRoleName(l)})});
  (data.risks||[]).filter(function(r){return lriskTotal(r)>0}).sort(function(a,b){return lriskTotal(b)-lriskTotal(a)}).forEach(function(r){out.push({kind:'record',type:'lrisk',id:r.id,name:LRISK_NAMES[r.id]||r.id,group:'Individual Leadership Risks',rec:r,sub:lriskTotal(r)+'/15 \u00b7 '+lriskBand(r)})});
  prPeople().forEach(function(p){out.push({kind:'record',type:'person',id:p.id,name:p.name,group:'Individual People',sub:p.role||''})}); /* Part 7 (2 Oct 2026): one personal record per person, users and leaders each once */
  return out}
function rcKindLabel(u){return u.kind==='output'?'Output':u.kind==='page'?'Phase 5 page':u.kind==='text'?'Text page':u.kind==='record'?(u.type==='leader'?'Individual leader':u.type==='person'?'Personal record':'Individual leadership risk'):''}
function rcUnitBody(u,lead){ /* the unit's content, no cover, no controls */
  var body='';var wasDepth=UI.printDepth;
  try{
    if(u.kind==='output'){UI.printDepth=u.depth||'full';var fn=PRINT_DOCS[u.id];body=fn?_rcStripCover(fn()):''}
    else if(u.kind==='page'&&u.id==='5.1'){body=erDashboardDoc({noCover:true,sectionHead:lead||''})}
    else if(u.kind==='page'&&u.id==='5.2'){body='<style>'+LDEV_REPORT_CSS+'</style>'+ldevReportBody({sectionHead:lead||''})} /* 16 Sep 2026: no cover built to be stripped; the section heading rides into the first landscape page */
    else if(u.kind==='page'&&u.id==='5.3'){body=_rcStripCover(myDevDoc())}
    else if(u.kind==='record'&&u.type==='leader'){var l=(data.leaders||[]).find(function(x){return x.id===u.id});body=l?lyRender('leader',l,'full',null):'<p style="font-size:13px;color:#666;font-style:italic">This leader is no longer on the record.</p>'}
    else if(u.kind==='record'&&u.type==='person'){body=personalRecordDoc(u.id)} /* Part 7 */
    else if(u.kind==='record'&&u.type==='lrisk'){var r=(data.risks||[]).find(function(x){return x.id===u.id});body=r?lyRender('lrisk',r,'full',0):'<p style="font-size:13px;color:#666;font-style:italic">This risk is no longer on the record.</p>'}
    else if(u.kind==='text'){body='<div class="rc-text" style="font-size:14px;line-height:1.7;color:#222">'+rcSanitize(u.html||'')+'</div>'}
  }finally{UI.printDepth=wasDepth}
  return rcFirstRecordStays(body)}
function rcUnitGaps(u){if(u.kind==='record'&&u.type==='leader'){var l=(data.leaders||[]).find(function(x){return x.id===u.id});return l?lyGaps('leader',[l],null):[]}return []} /* the leader and risk maps name no required layers; the list is empty by design */
function rcUnitFact(u){var n=function(c,w,pl){return c+' '+(c===1?w:(pl||w+'s'))};var L=data.leaders||[];
  if(u.kind==='output'){var rv=(data.leadershipReview||{}).leaders||{};var fl=(data.fluencySprint||{}).leaderTasks||{};var sc=(data.competencyFramework||{}).scores||{};
    return ({'out-inventory':n(L.length,'leader'),'out-riskmap':n((data.risks||[]).filter(function(r){return lriskTotal(r)>0}).length,'risk'),'out-competency':n(L.filter(function(l){return LEADER_COMPS.some(function(c){return sc[l.id+'_'+c.id]})}).length,'leader scored','leaders scored'),'out-fluency':n(L.filter(function(l){var t=fl[l.id];return t&&(t.task1||t.task2||t.task3)}).length,'leader with tasks','leaders with tasks'),'out-review':n(L.filter(function(l){var r=rv[l.id];return r&&(r.assessment||r.notes)}).length,'leader assessed','leaders assessed'),'out-values':n((data.orgValues||[]).length,'principle'),'out-decisions':n(DECISION_SCENARIOS.filter(function(x){var ds=data.decisionSims||{};return ds[x.id+'_response']||ds[x.id+'_premortem']}).length,'scenario')})[u.id]||''}
  if(u.kind==='page')return u.id==='5.1'?n((data.orgChart||[]).length,'role'):u.id==='5.2'?n(L.length,'leader'):'';
  if(u.kind==='record'&&u.type==='person'){var pp=prPerson(u.id);if(!pp)return 'No longer on the record';var pm=prMentions(pp).length;return n(pm,'record')}
  if(u.kind==='record'){if(u.type==='leader'){var l=L.find(function(x){return x.id===u.id});if(!l)return 'No longer on the record';var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return REVIEW_LABELS[r.assessment]||(l.fluency?'Fluency '+l.fluency+'/5':'')}var rk=(data.risks||[]).find(function(x){return x.id===u.id});return rk?lriskTotal(rk)+'/15 \u00b7 '+lriskBand(rk):'No longer on the record'}
  if(u.kind==='text'){var words=String(u.html||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').trim().split(/\s+/).filter(Boolean).length;return words?n(words,'word'):'Nothing written yet'}
  return ''}
function rcUnitDesc(u){var D={
   'out-readiness':'The organization\u2019s readiness at the start of the program: the overall score and its reading, the five areas of the Assessment Battery with their averages, and every question\u2019s score within each area.',
   'out-inventory':'Every leader in the landscape: role, scope, engagement, bandwidth, self-rated AI fluency, and change experience; then the ownership gap and the middle-management assessment.',
   'out-riskmap':'The seven leadership risks scored for likelihood, impact, and time horizon, highest first, with the count of Critical, Moderate, and Low risks at the head.',
   'out-structure':'How the organization has structured its leadership for AI: ownership, board governance, the senior layer, middle management principles, and cross-functional coordination.',
   'out-collab':'Where and how people and AI work together: touchpoints, collaboration models, AI personas, AI-free zones, and the translation layer.',
   'out-competency':'The seven leadership competencies as the organization defines them, the development priorities, and every leader\u2019s scores.',
   'out-fluency':'The team project, its workflow and the judgment it protects, and every leader\u2019s sprint tasks.',
   'out-decisions':'The four decision simulations: the organization\u2019s response to each scenario and the ethical pre-mortem behind it.',
   'out-mmprinciples':'What middle management automates, augments, and keeps human; the workflows and decisions that follow; and the log and evaluation criteria that hold the new role to account.',
   'out-values':'The leadership team\u2019s philosophical commitments; its shared principles in three domains and the roles that carry them; how the principles are kept alive; where the team diverged; at Full depth, each leader\u2019s reflections.',
   'out-rhythm':'The permanent operating cadence: the leadership meeting, peer learning, decision simulations, and the external and board rhythm.',
   'out-evalplan':'How leaders are evaluated and succession is planned for the AI era: the readiness indicators, their weighting, the bench, and the board.',
   'out-review':'The first review of leadership progress: the structural review, then every leader\u2019s assessment, grouped by the four judgments.',
   'page:5.1':'The leadership structure as it stands: staffing, every role with its occupant, the organization chart, and the policies that govern how people and AI work together.',
   'page:5.2':'Leadership development across the program: competency tracking, study progress, fluency growth, and practice health.',
   'page:5.3':'The signed-in leader\u2019s record and the seven monthly reviews with their state this month.',
   'record:leader':'This leader\u2019s full record: the landscape entry, competency scores, sprint tasks, first review, and development.',
   'record:lrisk':'This risk\u2019s screen: likelihood, impact, time horizon, and notes.',
   'text':'A page you write, printed as its own numbered section.'};
  if(u.kind==='record'&&u.type==='person'){var pp=prPerson(u.id);return 'The information this workspace holds about '+((pp&&pp.name)||u.name||'')+', gathered from every part of the program.'}
  return D[u.kind==='output'?u.id:(u.kind==='record'?'record:'+u.type:(u.kind==='text'?'text':u.kind+':'+u.id))]||''}
function rcLeaderFilter(){return UI.rcF||(UI.rcF={q:'',rv:'all'})}
function rcSetFilter(k,v){var F=rcLeaderFilter();F[k]=v;render();if(k==='q'){var el=document.querySelector('input[type=search][placeholder^="Search leaders"]');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}}
function rcLeaderPasses(l,F){if(!l)return false;var q=(F.q||'').trim().toLowerCase();if(q&&((l.name||'')+' '+leaderRoleName(l)).toLowerCase().indexOf(q)<0)return false;var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};if(F.rv&&F.rv!=='all'){if(F.rv==='none'){if(REVIEW_LABELS[r.assessment])return false}else if(r.assessment!==F.rv)return false}return true}
function rcDefs(){if(!data.reportDefs)data.reportDefs=[];return data.reportDefs}
function rcNew(){var d={id:'rpt-'+Math.random().toString(36).slice(2,9),name:'New report',subtitle:'',intro:'',units:[],createdAt:Date.now()};rcDefs().push(d);UI.rcEdit=d.id;saveData();render()}
function rcFind(id){return rcDefs().find(function(d){return d.id===id})||null}
function rcSet(id,k,v){var d=rcFind(id);if(!d)return;d[k]=v;saveData()}
function rcSetNote(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].note=v;saveData()}
function rcSetDepth(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].depth=v;saveData();render()}
function rcToggle(id,key,depth){var d=rcFind(id);if(!d)return;var i=d.units.findIndex(function(u){return u.key===key});if(i>=0)d.units.splice(i,1);else{var c=rcCatalogue().find(function(u){return rcKey(u)===key});if(c)d.units.push({key:key,kind:c.kind,id:c.id,type:c.type||'',name:c.name,depth:c.depths?(depth==='full'?'full':'summary'):'',note:''})}saveData();render()} /* 14 Sep 2026: an option with a depth is added at the depth chosen */
function rcMove(id,i,dir){var d=rcFind(id);if(!d)return;var j=i+dir;if(j<0||j>=d.units.length)return;var t=d.units[i];d.units[i]=d.units[j];d.units[j]=t;saveData();render()}
function rcDelete(id){if(!confirm('Delete this report definition? The record it prints is untouched.'))return;data.reportDefs=rcDefs().filter(function(d){return d.id!==id});if(UI.rcEdit===id)UI.rcEdit=null;saveData();render()}
function rcDuplicate(id){var d=rcFind(id);if(!d)return;var c=JSON.parse(JSON.stringify(d));c.id='rpt-'+Math.random().toString(36).slice(2,9);c.name=d.name+' (copy)';c.createdAt=Date.now();rcDefs().push(c);UI.rcEdit=c.id;saveData();render()}
function rcKey(u){return u.kind+':'+(u.type?u.type+':':'')+u.id}
function _rcStripCover(doc){var i=doc.indexOf('min-height:85vh');if(i<0)return doc;var end=doc.indexOf('</div></div>',i);return end>0?doc.slice(end+12):doc} /* an output's own cover comes off inside a compiled report */
function rcFirstRecordStays(body){var a=body.indexOf('<table class="ly-rec"');if(a<0)return body;var b=body.indexOf('<table class="ly-rec"',a+10);var first=b>0?body.slice(a,b):body.slice(a);var fixed=first.replace('break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;','break-inside:auto;page-break-inside:auto;');return body.slice(0,a)+fixed+(b>0?body.slice(b):'')}
function rcCompile(id){ /* the whole document */
  var d=rcFind(id);if(!d)return '';
  var h=printDocCover(d.name||'Report',d.subtitle||'','');
  h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Contents</div>';
  d.units.forEach(function(u,i){h+='<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #eee;font-size:13px"><span style="font-family:var(--mono,monospace);color:#666;min-width:28px">'+(i+1)+'.</span><span>'+esc(rcUnitName(u))+(u.depth?' <span style="color:#888;font-size:11px">('+u.depth+')</span>':'')+'</span></div>'});
  var gaps=[];d.units.forEach(function(u,i){rcUnitGaps(u).forEach(function(g){gaps.push({sec:i+1,title:g.title,lines:g.lines})})});
  if(gaps.length){h+='<div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B3A1E;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #8B3A1E">What is missing ('+gaps.length+')</div>';
    gaps.forEach(function(g){h+='<div style="font-size:12.5px;padding:4px 0;border-bottom:1px solid #eee"><span style="font-family:var(--mono,monospace);color:#666">'+g.sec+'.</span> <strong>'+esc(g.title)+'</strong> \u2014 '+g.lines.map(esc).join(' ')+'</div>'})}
  h+='</div>';
  if(d.intro&&d.intro.trim())h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Introduction</div><div style="font-size:14px;line-height:1.7;color:#222;white-space:pre-wrap">'+esc(d.intro)+'</div></div>';
  d.units.forEach(function(u,i){h+=rcSection(u,i)});
  return h}
function rcSection(u,i){ /* one numbered section as the report carries it: the number at the title's size (Paul's ruling, 14 Sep 2026), the heading, the note, the body — one definition for the compiled report and for the section preview */
  var head='<div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111"><span style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#888;margin-right:12px">'+(i+1)+'</span>'+esc(rcUnitName(u))+'</div>';
  if(u.note&&u.note.trim())head+='<div style="font-size:13px;line-height:1.6;color:#333;margin:0 0 16px;padding:10px 14px;border-left:3px solid #999;white-space:pre-wrap">'+esc(u.note)+'</div>';
  if(u.kind==='page'&&(u.id==='5.1'||u.id==='5.2'))return '<div>'+rcUnitBody(u,head)+'</div>'; /* 16 Sep 2026 (Paul's ruling): these bodies open on their own landscape page; the heading sits at the top of that page above the org chart or the heat map, never alone on a page before it */
  var h='<div style="page-break-before:always">'+head;
  return h+rcUnitBody(u)+'</div>'}
function rcPrint(id){var d=rcFind(id);if(!d)return;var doc=rcCompile(id);printDocumentPreview(d.name||'Report',doc)}
function rcSaveText(id,i){var el=document.getElementById('rc_txt_'+(rcFind(id).units[i]||{}).id);if(el)rcSetTextHtml(id,i,el.innerHTML);var hd=document.getElementById('rc_head_'+(rcFind(id).units[i]||{}).id);if(hd)rcSetUnit(id,i,'name',hd.value);UI.rcSel=null;render()} /* Save keeps the text and the heading and closes the inspector */
function rcPreviewUnit(id,i){var d=rcFind(id);if(!d||!d.units[i])return;var u=d.units[i];var title=(d.name||'Report')+' \u2014 section '+(i+1);printDocumentPreview(title,rcSection(u,i).replace('page-break-before:always','page-break-before:auto'),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the section as the report carries it — its number, heading, note, and body — with no cover of its own */
function rcAddText(id,at){var d=rcFind(id);if(!d)return;var u={key:'text:'+Math.random().toString(36).slice(2,9),kind:'text',id:'',type:'',name:'',html:'',depth:'',note:''};u.id=u.key.slice(5);if(at==null||at>=d.units.length)d.units.push(u);else d.units.splice(at,0,u);UI.rcSel=u.key;saveData();render()} /* the new page opens in the inspector */
function rcSetUnit(id,i,k,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i][k]=v;saveData()}
function rcRemoveAt(id,i){var d=rcFind(id);if(!d||!d.units[i])return;d.units.splice(i,1);saveData();render()}
function rcSetTextHtml(id,i,html){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].html=rcSanitize(html);saveData()}
function rcFmt(uid,cmd,val){var el=document.getElementById('rc_txt_'+uid);if(!el)return;el.focus();
  if(cmd==='bold'||cmd==='italic'){document.execCommand(cmd,false,null)}
  else if(cmd==='size'){document.execCommand('fontSize',false,{small:'2',normal:'3',large:'5',heading:'6'}[val]||'3')}
  el.dispatchEvent(new Event('input'))}
function rcSanitize(html){ /* authored text keeps only its shape: paragraphs, breaks, bold, italics, and a size; everything else is dropped */
  var root=document.createElement('div');root.innerHTML=String(html||'');
  var SIZE={'1':'11px','2':'12px','3':'14px','4':'16px','5':'18px','6':'22px','7':'26px'};
  var walk=function(node){var out='';for(var i=0;i<node.childNodes.length;i++){var n=node.childNodes[i];
    if(n.nodeType===3){out+=esc(n.nodeValue);continue}
    if(n.nodeType!==1)continue;var tag=n.tagName.toLowerCase();if(tag==='script'||tag==='style'||tag==='iframe'||tag==='object'||tag==='embed')continue;var inner=walk(n);
    if(tag==='br'){out+='<br>';continue}
    if(tag==='b'||tag==='strong'){out+='<b>'+inner+'</b>';continue}
    if(tag==='i'||tag==='em'){out+='<i>'+inner+'</i>';continue}
    if(tag==='p'||tag==='div'||tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4'||tag==='li'||tag==='ul'||tag==='ol'){var st='';if(tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4')st=' style="font-size:22px;font-weight:700"';var fs=n.style&&n.style.fontSize;if(fs&&/^\d+(\.\d+)?px$/.test(fs))st=' style="font-size:'+fs+'"';out+='<div'+st+'>'+inner+'</div>';continue}
    if(tag==='font'&&n.getAttribute('size')&&SIZE[n.getAttribute('size')]){out+='<span style="font-size:'+SIZE[n.getAttribute('size')]+(n.getAttribute('size')==='6'||n.getAttribute('size')==='7'?';font-weight:700':'')+'">'+inner+'</span>';continue}
    if(tag==='span'){var fs2=n.style&&n.style.fontSize;var fw=n.style&&n.style.fontWeight;var st2=[];if(fs2&&/^\d+(\.\d+)?px$/.test(fs2))st2.push('font-size:'+fs2);if(fw==='700'||fw==='bold')st2.push('font-weight:700');out+=st2.length?'<span style="'+st2.join(';')+'">'+inner+'</span>':inner;continue}
    out+=inner}return out};
  return walk(root)}
function rcPreview(id){var d=rcFind(id);if(!d)return;printDocumentPreview(d.name||'Report',rcCompile(id),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the report as it will print, at any point in the assembly, without the print dialog */
function renderReports(){ /* the Report Manager page (More menu). 14 Sep 2026 (Paul's ruling): a report is assembled from Report Content Options on the right into Sections on the left; every option that has a depth is added at Summary or Full; individual risks can be filtered; text pages with a heading and a formatted body can be added anywhere; the report can be previewed at any point; the introduction and notes are uncapped */
  var defs=rcDefs();var ed=UI.rcEdit?rcFind(UI.rcEdit):null;
  var h='<div class="content-area"><div class="content-inner rc-page"><h2 class="h-section">Report Manager</h2><p class="t-lead">Compile the outputs, the Phase 5 pages, and individual leaders and risks into one printed document under one cover: a contents page, a list of what is missing, an introduction you write, and each piece as a numbered section. Add your own text pages wherever a part of the report needs an introduction. A saved report reprints with fresh data. The record itself is never edited here.</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 18px">'+btn('+ New report','rcNew()','bp')+'</div>';
  if(!defs.length)h+=card('<p style="color:var(--text-faint);text-align:center;padding:28px 0">No reports yet. Start one, choose what it contains, and print it.</p>');
  defs.forEach(function(d){var open=ed&&ed.id===d.id;
    h+='<div class="cd" style="margin-bottom:10px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(d.name||'Untitled')+'</div><div style="font-size:12px;color:var(--text-faint)">'+d.units.length+' section'+(d.units.length===1?'':'s')+(d.subtitle?' \u00b7 '+esc(d.subtitle):'')+'</div></div>'+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+rcBtnG('Preview','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG(open?'Close':'Edit','UI.rcEdit='+(open?'null':'\''+d.id+'\'')+';render()','font-size:12px')+rcBtnG('Duplicate','rcDuplicate(\''+d.id+'\')','font-size:12px')+rcBtnG('Delete','rcDelete(\''+d.id+'\')','font-size:12px')+'</span></div>';
    if(open)h+=rcEditor(d);
    h+='</div>'});
  return h+'</div></div>'}
function rcEditor(d){ /* 14 Sep 2026 (Paul's ruling): the Order column is the report's contents being built — one compact row per section with its number, name, kind, a fact about its size, its depth, and a mark where a note is written; one row selected at a time opens the inspector beneath the list, which holds what the section prints, the depth, the note, a preview of that section alone, and for a text page its editor. The Content Options list keeps its size; Add a text page is its first row. */
  var cat=rcCatalogue();var chosen={};d.units.forEach(function(u){chosen[u.key]=1});
  var seg=function(active,label,fn,extra){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(active?'background:rgba(var(--fg-rgb),.10);color:var(--paper);':'')+(extra||'')+'" onclick="'+fn+'">'+label+'</button>'};
  var ico=function(glyph,fn,title,dim){return '<button class="btn-ghost" title="'+esc(title)+'" style="font-size:12px;padding:2px 7px;line-height:1.2;min-width:0;'+(dim?'opacity:.35;pointer-events:none;':'')+'" onclick="event.stopPropagation();'+fn+'">'+glyph+'</button>'};
  var h='<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(var(--fg-rgb),.10)">';
  /* the report's own words: title, subtitle, introduction */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+rcInp('Title','rc_name_'+d.id,d.name,'e.g. Board pack, September')+rcInp('Subtitle','rc_sub_'+d.id,d.subtitle,'One line under the title on the cover')+'</div>';
  h+='<script>document.getElementById(\'rc_name_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'name\',this.value);render()};document.getElementById(\'rc_sub_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'subtitle\',this.value)};</script>';
  h+='<div class="mb-4"><label class="form-label">Introduction</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed after the contents page.</p><textarea rows="6" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSet(\''+d.id+'\',\'intro\',this.value)">'+esc(d.intro||'')+'</textarea></div>';
  /* the toolbar: preview and print; the Save as PDF here matches its neighbours (Paul's ruling, 14 Sep 2026: an exception to the quiet form, because it sits in a block of buttons) */
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 16px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+rcBtnG('Preview the report','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+'<span style="font-size:12px;color:var(--text-faint);margin-left:6px">'+d.units.length+' section'+(d.units.length===1?'':'s')+'</span></div>';
  /* two panes: the sections in order (twice the width) and the content options (its own width) */
  h+='<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:24px;align-items:start">';
  /* left: the contents being built */
  var sel=UI.rcSel!=null?d.units.findIndex(function(u){return u.key===UI.rcSel}):-1;
  h+='<div><h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Sections, in order</h4>';
  if(!d.units.length)h+='<p class="t-faint-sm" style="padding:14px;border:1px dashed rgba(var(--fg-rgb),.18);border-radius:8px">Nothing chosen yet. Add content from the options on the right. Each section you add appears here as a line of the contents.</p>';
  else{h+='<div style="border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;overflow:hidden">';
    var inspector=function(u,sel){var fact=rcUnitFact(u); /* 14 Sep 2026 (Paul's ruling): the inspector opens directly beneath the selected row, inside the list, so it is never off the page */
      h+='<div style="padding:14px 16px 16px 50px;border-top:1px solid rgba(var(--fg-rgb),.14);background:var(--bg-elev)">';
      h+='<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 6px"><span style="font-family:var(--serif);font-size:22px;line-height:1;color:var(--text-faint)">'+(sel+1)+'</span><span style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(u.kind==='text'?(u.name||'Untitled text page'):u.name)+'</span><span style="font-size:12px;color:var(--text-faint)">'+rcKindLabel(u)+'</span><span style="flex:1"></span>'+(u.kind!=='text'?rcBtnG('Preview this section','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px'):'')+rcBtnG('Close','UI.rcSel=null;render()','font-size:12px')+'</div>';
      if(u.kind==='text'){
        h+='<p class="t-faint-sm" style="margin:0 0 10px">A page you write, printed as its own numbered section. Use it to open a part of the report or to add a page of your own between sections.</p>';
        h+='<input type="text" id="rc_head_'+u.id+'" data-uncapped="1" value="'+esc(u.name||'')+'" placeholder="Heading for this text page" style="width:100%;font-size:15px;font-weight:600;margin:0 0 8px" onchange="rcSetUnit(\''+d.id+'\','+sel+',\'name\',this.value)">';
        h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px">'+seg(false,'<b>B</b>','rcFmt(\''+u.id+'\',\'bold\')')+seg(false,'<i>I</i>','rcFmt(\''+u.id+'\',\'italic\')')+'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);align-self:center;margin:0 4px 0 8px">SIZE</span>'+seg(false,'Small','rcFmt(\''+u.id+'\',\'size\',\'small\')')+seg(false,'Normal','rcFmt(\''+u.id+'\',\'size\',\'normal\')')+seg(false,'Large','rcFmt(\''+u.id+'\',\'size\',\'large\')')+seg(false,'Heading','rcFmt(\''+u.id+'\',\'size\',\'heading\')')+'</div>';
        h+='<div id="rc_txt_'+u.id+'" contenteditable="true" class="rc-text-edit" style="min-height:260px;padding:14px 16px;border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;font-size:14px;line-height:1.7;background:rgba(var(--fg-rgb),.02);color:var(--paper);outline:none" oninput="rcSetTextHtml(\''+d.id+'\','+sel+',this.innerHTML)">'+rcSanitize(u.html||'')+'</div>';
        h+='<div style="display:flex;gap:8px;align-items:center;margin:10px 0 0">'+rcBtnS('Save','rcSaveText(\''+d.id+'\','+sel+')','#2A5A5A','font-size:12px')+rcBtnG('Preview this page','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px')+'<span style="font-size:12px;color:var(--text-faint)">Select text, then Bold, Italic, or a size.</span></div>';
      }else{
        h+='<p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0 0 10px">'+esc(rcUnitDesc(u))+(fact?' <span style="color:var(--text-faint)">('+esc(fact)+')</span>':'')+'</p>';
        if(u.depth!==undefined&&u.depth!=='')h+='<div style="margin:0 0 10px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:6px">DEPTH</span>'+seg(u.depth==='summary','Summary','rcSetDepth(\''+d.id+'\','+sel+',\'summary\')')+seg(u.depth==='full','Full','rcSetDepth(\''+d.id+'\','+sel+',\'full\')')+'</div>';
        h+='<label class="form-label">Note for this section</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed at the head of the section.</p><textarea rows="4" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSetNote(\''+d.id+'\','+sel+',this.value);render()">'+esc(u.note||'')+'</textarea>';
      }
      h+='</div>'};
    d.units.forEach(function(u,i){var on=(i===sel);var fact=rcUnitFact(u);var noted=(u.kind==='text')?!!(u.html&&u.html.replace(/<[^>]*>/g,'').trim()):!!(u.note&&u.note.trim());
      h+='<div onclick="UI.rcSel='+(on?'null':'\''+u.key+'\'')+';render()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-top:'+(i?'1px solid rgba(var(--fg-rgb),.06)':'none')+';'+(on?'background:rgba(var(--fg-rgb),.06)':'')+'">'
        +'<span style="font-family:var(--serif);font-size:17px;line-height:1;color:var(--text-faint);min-width:28px;text-align:right">'+(i+1)+'</span>'
        +'<span style="flex:1;min-width:0;font-size:13.5px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(u.kind==='text'?'<em style="font-style:normal;font-weight:600">'+esc(u.name||'Untitled text page')+'</em>':'<span style="font-weight:600">'+esc(rcUnitName(u))+'</span>')+'</span>'
        +'<span style="font-size:11px;color:var(--text-faint);white-space:nowrap">'+rcKindLabel(u)+'</span>'
        +(fact?'<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">'+esc(fact)+'</span>':'')
        +(u.depth?'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap">'+u.depth+'</span>':'')
        +'<span title="'+(noted?'A note is written':'No note')+'" style="width:7px;height:7px;border-radius:50%;background:'+(noted?'var(--gold-text)':'rgba(var(--fg-rgb),.15)')+';flex-shrink:0"></span>'
        +'<span style="display:inline-flex;gap:2px;margin-left:4px">'+ico('\u2191','rcMove(\''+d.id+'\','+i+',-1)','Move up',i===0)+ico('\u2193','rcMove(\''+d.id+'\','+i+',1)','Move down',i===d.units.length-1)+ico('\u00d7','rcRemoveAt(\''+d.id+'\','+i+')','Remove this section')+'</span></div>';
      if(i===sel)inspector(u,i)});
    h+='</div>';
  }
  h+='</div>';
  /* right: report content options */
  h+='<div><h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Report Content Options</h4>';
  var groups=[];var byG={};cat.forEach(function(u){if(!byG[u.group]){byG[u.group]=[];groups.push(u.group)}byG[u.group].push(u)});
  var row=function(u){var k=rcKey(u);var on=!!chosen[k];
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px"><span style="flex:1;min-width:0;color:'+(on?'var(--text-faint)':'var(--paper)')+'">'+(on?'\u2713 ':'')+esc(u.name)+(u.sub?' <span style="font-size:11px;color:var(--text-faint)">'+esc(u.sub)+'</span>':'')+'</span>'
      +(on?seg(false,'Remove','rcToggle(\''+d.id+'\',\''+k+'\')'):(u.depths?(seg(false,'Summary','rcToggle(\''+d.id+'\',\''+k+'\',\'summary\')')+seg(false,'Full','rcToggle(\''+d.id+'\',\''+k+'\',\'full\')')):seg(false,'Add','rcToggle(\''+d.id+'\',\''+k+'\')')))+'</div>'};
  /* the first option: a text page */
  h+='<div style="margin:0 0 14px"><div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:8px;font-size:13px"><span style="flex:1;min-width:0"><span style="font-weight:600;color:var(--paper)">Text page</span> <span style="font-size:11px;color:var(--text-faint)">A heading and a body you write, added after the selected section or at the end</span></span>'+seg(false,'Add','rcAddText(\''+d.id+'\','+(sel>=0?(sel+1):'null')+')')+'</div></div>';
  groups.forEach(function(g){var list=byG[g];
    h+='<div style="margin:0 0 14px"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:0 0 4px;border-bottom:1px solid rgba(var(--fg-rgb),.18);margin:0 0 2px;display:flex;align-items:baseline;gap:8px">'+esc(g)+'<span style="font-family:var(--sans);letter-spacing:0;text-transform:none;font-size:11px;color:var(--text-faint)">'+list.length+'</span></div>';
    if(g==='Individual Leaders'){var F=rcLeaderFilter();
      h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0 4px"><input type="search" placeholder="Search leaders by name or role" value="'+esc(F.q)+'" style="flex:1;min-width:160px;font-size:12px;padding:4px 8px" oninput="rcSetFilter(\'q\',this.value)"></div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:0 0 6px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:4px">REVIEW</span>'+[['all','All'],['developed','Developed'],['progressing','Progressing'],['support','Needs Support'],['hard','Hard Conversation'],['none','Not yet assessed']].map(function(x){return seg(F.rv===x[0],x[1],'rcSetFilter(\'rv\',\''+x[0]+'\')')}).join('')+'</div>';
      var shown=list.filter(function(u){return rcLeaderPasses(u.rec,F)});
      h+='<div style="font-size:11px;color:var(--text-faint);margin:0 0 2px">'+shown.length+' of '+list.length+' leader'+(list.length===1?'':'s')+(shown.length!==list.length?' shown':'')+'</div>';
      if(!shown.length)h+='<p class="t-faint-sm" style="padding:8px 0">No leader matches these filters.</p>';
      shown.forEach(function(u){h+=row(u)});
    }else list.forEach(function(u){h+=row(u)});
    h+='</div>'});
  h+='</div></div>';
  return h+'</div>'}