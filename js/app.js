var SK = 'pipeline-v3'; // legacy single-store key (migrated into an org on first run)
/* The shape of the workspace document belongs to the program that fills it, so
   it comes from the active module (js/modules/<id>/module.js). Every screen
   still reads and writes the same global `data`. */
function emptyData() { return Modules.emptyData(); }
var data = emptyData();

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
/* -- SAMPLE TAB (Directive 2 Oct 2026, Part 3; live for the AI Innovation Pipeline, 6 Oct 2026, and Executive Readiness and
   Responsible AI Governance, 7 Oct 2026 — each its own directive of the same date). A Pipeline, Executive Readiness or Responsible AI Governance address carrying ?sample=1 is the private sample organization: its data lives only in this
   browser and the tab makes no request to any server after it starts. Decided here, before the Store below
   exists, so the Store runs on this browser's storage alone, and every request to the API or the chat relay is
   refused inside the browser (the app's own files still load: "the app itself still comes from the server"). -- */
/* + AI-Ready Architecture (21 Oct 2026): a ?sample=1 address is its Demo tab too. */
var SAMPLE_TAB_ADDR = (function () { try { return /[?&]sample=1(&|$)/.test(location.search) && !!(window.Modules && (Modules.isActive('pipeline') || Modules.isActive('exec-readiness') || Modules.isActive('ai-governance') || Modules.isActive('ai-architecture'))); } catch (e) { return false; } })();
var SAMPLE_LOCAL_ID = 'org_sample_local', SAMPLE_MODE = false, SAMPLE_REFUSED = false;
if (SAMPLE_TAB_ADDR) (function () {
  var isServer = function (u) { u = String(u || ''); return /(^|\/)api\//.test(u) || /^wss?:/i.test(u); };
  var f = window.fetch;
  if (f) window.fetch = function (u) { if (isServer(u && u.url ? u.url : u)) return Promise.reject(new Error('sample tab: no server')); return f.apply(this, arguments); };
  window.WebSocket = function () { throw new Error('sample tab: no server'); };
  try { if (navigator.sendBeacon) navigator.sendBeacon = function () { return false; }; } catch (e) { }
  var X = window.XMLHttpRequest;
  if (X) { var o = X.prototype.open; X.prototype.open = function (m, u) { if (isServer(u)) throw new Error('sample tab: no server'); return o.apply(this, arguments); }; }
})();
var Store = (function () {
  /* -- ADAPTER: the one place to repoint to a server -- */
  function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function readJSON(k, f) { var s = rawGet(k); if (s == null) return f; try { return JSON.parse(s); } catch (e) { return f; } }
  function writeJSON(k, v) { return rawSet(k, JSON.stringify(v)); }
  /* sessionStorage = a session that survives refresh but not a browser close
     (the "stay signed in by default" tier). "Remember me" uses localStorage above. */
  function sessGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessSet(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function sessDel(k) { try { sessionStorage.removeItem(k); } catch (e) { } }

  /* -- keys (one source of truth) --
     Organizations, the team, the sign-in session, the admin record and the
     device preferences are SHARED by every program module: one account, one
     team, one theme, whichever program you are in. Only the workspace document
     is per-module, so only orgKey() carries the module in its name. The
     Pipeline keeps the original unsuffixed key, so every workspace saved before
     the app had a second program is still exactly where it was. */
  var LEGACY_KEY = 'pipeline-v3', ORGS_KEY = 'pipeline-orgs', CURRENT_ORG_KEY = 'pipeline-current-org',
    REMEMBER_KEY = 'pipeline-remember', ADMIN_KEY = 'pipeline-admin', SESSION_KEY = 'pipeline-session',
    OPEN_PROFILE_KEY = 'pipeline-open-profile';
  /* Which module's workspace this browser is reading and writing.
     Normally the one in the URL. But the launchpad, the role hub and the entry
     screens have no module of their own, so the front controller loads the
     DEFAULT module purely for chrome — and for a Leader account that default
     is an Enterprise program, whose workspace the API rightly refuses (403,
     WorkspaceController::moduleFrom). Asking for a document this account can
     never open is never what the caller meant, so fall back to the first module
     of its own role space. Before the org registry has warmed there is nothing
     to compare against and the URL's module stands. */
  function moduleId(orgId) {
    var id = (window.Modules && Modules.activeId()) || 'pipeline';
    if (!window.Modules || typeof accountType !== 'function') return id;
    var m = Modules.byId(id);
    if (!m || !m.role) return id;
    var mine = accountType(orgId);
    if (m.role === mine) return id;
    /* The URL's module is in the other role space — the launchpad, the role hub
       and the entry screens all load the DEFAULT module purely for chrome, and
       for a Leader account that default is an Enterprise program. Fall back to
       something this account can actually open, preferring what it HOLDS over
       merely what its role space contains: asking for a workspace the server
       will refuse is never what the caller meant. */
    var granted = (typeof grantedModules === 'function') ? grantedModules(orgId) : [];
    if (granted.length) return granted[0];
    var own = Modules.list(mine);
    return own.length ? own[0].id : id;
  }
  function moduleSuffix(orgId) { var m = moduleId(orgId); return m === 'pipeline' ? '' : '::' + m; }
  function orgKey(id) { return 'pipeline-org-data::' + id + moduleSuffix(id); }
  function prefKey(name) { return 'pipeline-' + name; }
  /* `module` on every workspace request: the server stores one document per
     organization per module (api/sql/workspace-modules.sql).

     Always pass the organization. The account's role space is a property of
     the ORG, and `currentOrgId` is not assigned until bootApp() — which runs
     after ready() has already fetched a workspace. Reading the global here
     would make that first request ask on behalf of nobody, fall back to
     'enterprise', and get a 403 for every Leader account: the app would come
     up offline with no workspace, on the sign-in screen. */
  /* `actor` rides along with `module` on every workspace request, GET included.
     The workspace, its answers and its rev are all addressed by the
     organization's public id alone, so until the server started requiring a
     member (Core\Controller::requireOrgMember) holding an org id was the same
     as being in that org — and the reads never sent an actor at all because
     nothing had ever asked them to. Resolved through workspaceActorId(), which
     already knows how to answer before sign-in has finished: the signed-in
     member, else the organization's administrator from the roster on disk.
     Empty is left empty rather than guessed — the server refuses it, which is
     the correct outcome for a request nobody can be shown to have made. */
  function actorQ(orgId) {
    var actor = '';
    try { actor = (typeof workspaceActorId === 'function') ? workspaceActorId(orgId) : ''; } catch (e) { }
    return actor ? '&actor=' + encodeURIComponent(actor) : '';
  }
  function modQ(orgId) { return '&module=' + encodeURIComponent(moduleId(orgId)) + actorQ(orgId); }

  /* One database organization → one registry record. Both places that rebuild
     the registry from the API (ready() and refreshOrgs()) go through here, so
     a field added to one cannot go missing from the other — which is exactly
     how accountType would have been absent at boot and present after a
     refresh, giving the same account two different role answers in one
     session. accountType is the role space: 'enterprise' or 'leader'. */
  function orgRecord(o) {
    return {
      id: o.id,
      name: o.name,
      accountType: o.account_type || 'enterprise',
      /* The programs this organization holds. Entitlement stopped being a
         property of the role space when members started getting different
         subsets of it, so — exactly like accountType above — it has to ride in
         on the registry: the browser rebuilds that from the API on every load,
         and anything not in this mapper does not exist client-side. Absent (an
         older API, or an offline mirror written before this shipped) means
         "unknown", not "none": grantedModules() falls back to the whole role
         space rather than locking someone out of an app that works. */
      modules: o.modules || null,
      created: Date.parse(o.created_at) || Date.now(),
      serverId: o.id
    };
  }

  /* ═══ SERVER BACKING ═══════════════════════════════════════════════
     The database is the source of truth for the org list and every
     organization's workspace, so a team sees the same program from any
     browser or machine. localStorage stays, demoted to two jobs:

       1. a read-through CACHE of the workspace, so a dropped connection
          shows the last known state instead of a blank app; and
       2. the real home of device-local things that SHOULD differ per
          browser — theme, zoom, sidebar state, and the sign-in session.

     Server mode is on whenever the app is served over http(s). Opened
     straight from disk (file://) there is no API to call, so the app
     falls back to the original localStorage-only behaviour and still
     works — that is what `enabled` gates.

     Everything here is transport. The ~200 call sites that read and
     write program state still go through readOrg/writeOrg/commit and
     know nothing about any of it.
     ═══════════════════════════════════════════════════════════════ */
  var server = {
    enabled: (location.protocol === 'http:' || location.protocol === 'https:') && !SAMPLE_TAB_ADDR,   /* Part 3: a sample tab never reaches the server */
    orgs: null,   // org registry from GET /organizations (null = not fetched yet)
    dbOrgs: {},   // orgId → the org record from the DB (details + members), to seed a workspace
    docs: {},     // orgId → the live workspace document
    revs: {},     // orgId → the server rev each doc was loaded/saved at
    /* orgId → the document as the server last confirmed it, at that rev. The
       third point of reference the merge needs to tell "they changed this" from
       "I changed this" — see mergeDocs. Mirrored to disk (baseKey). */
    base: {},
    online: true  // false once a save fails on the network; drives the banner
  };

  /* How long to wait after the last edit before saving. The app commits on
     every keystroke-blur and toggle; without this a busy screen would fire
     dozens of saves a second. 600ms is under the "did it save?" threshold
     while collapsing a burst of edits into one request. */
  var FLUSH_DEBOUNCE_MS = 600;
  /* Typing is not a burst of edits — it is a continuous one, and the 600ms
     window did nothing to slow it down: the first keystroke opened the window,
     every keystroke after it rode along, and the WHOLE module was posted again
     every 600ms for as long as the reader kept writing. Two things came out of
     that. The obvious one is the traffic. The one that hurt is that each of
     those posts raises the server's rev, and the rev is what every other
     member's 5-second poll watches — so one person writing a paragraph put
     everybody else's open page into a pull-and-repaint loop, every five
     seconds, for as long as the paragraph took.
     So typing gets its own window, pushed back by each new keystroke, and a
     ceiling measured from the first unsaved edit so a long answer still reaches
     the database while it is being written rather than only at the end of it.
     A score button, a dropdown, an Add — anything that is not typing — is a
     discrete action and still saves on the original 600ms. */
  var TYPING_DEBOUNCE_MS = 1500;
  var TYPING_MAX_DELAY_MS = 4000;
  var RETRY_DELAY_MS = 5000;      // after a failed save, before trying again
  var flushTimer = null;
  var flushAt = 0;                // when the queued flush is due (epoch ms)
  var flushCeiling = 0;           // the latest that queue may be pushed to
  var pendingOrgs = {};           // orgIds with unsaved changes
  /* orgIds whose document is being read before a first save may be sent — see
     the "never overwrite a document this browser has not read" gate in
     flushOrg. Keyed so a burst of edits cannot start a second read. */
  var _recovering = {};

  function apiUrl(path) { return (typeof API_BASE !== 'undefined' ? API_BASE : 'api') + path; }

  function getJSON(path, cb) {
    try {
      fetch(apiUrl(path))
        .then(function (r) { return r.json(); })
        .then(function (res) { cb(res && res.success ? res.data : null); })
        .catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }

  /* Mark the connection up/down and let the app paint the offline banner.
     Only fires on a real change so the UI isn't re-rendered on every save. */
  function setOnline(up) {
    if (server.online === !!up) return;
    server.online = !!up;
    try { if (typeof onConnectionChange === 'function') onConnectionChange(server.online); } catch (e) { }
  }

  /* ═══ THREE-WAY MERGE ══════════════════════════════════════════════
     What the 5-second poll used to do was: server rev is higher → download
     the whole document → replace ours with it. Everything this browser had
     written but not yet flushed — the 600ms debounce window, a save that
     failed while offline, a page that was refreshed a moment too early —
     went with it, silently.

     It replaces nothing now. Three documents are compared instead:

       BASE    what the server last confirmed it holds (server.base, mirrored
               to disk so it survives a reload)
       MINE    this browser's document, unsent edits and all
       THEIRS  what the server holds now, saved by somebody else

     and the answer is built key by key: what only THEY changed is taken,
     what only I changed is kept, what neither touched stands. Only when the
     same leaf moved on both sides is there anything to decide — and that is
     reported as a conflict rather than resolved by silently preferring one
     writer. Mine wins those, because the user is looking at it and has not
     had the chance to save; theirs is already safe in the database and
     arrives on the next poll for the other user to see.

     Merging happens at the finest granularity the data has: down each object
     key, and into id-keyed record arrays record by record (the Leaders
     programs keep decisions in an array, the Enterprise ones keep records in
     id-keyed objects). Two people working on different steps, different
     ideas, or different fields of the SAME record never collide.
     ═══════════════════════════════════════════════════════════════════ */
  function isPlainObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function cloneDoc(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }

  /* Structural equality. Not JSON.stringify comparison: that calls two objects
     different when their keys were merely inserted in a different order, and
     every such false positive here would be reported to the user as a conflict
     over data nobody changed. */
  function deepEq(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b || typeof a !== 'object') return a === b;
    var aArr = Array.isArray(a);
    if (aArr !== Array.isArray(b)) return false;
    var i;
    if (aArr) {
      if (a.length !== b.length) return false;
      for (i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
      return true;
    }
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (i = 0; i < ka.length; i++) {
      if (!has(b, ka[i]) || !deepEq(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  /* An array of records addressed by id — the shape that can be merged row by
     row. Anything else (a list of indices, a list of strings) is a value in
     its own right and is treated as one leaf. Empty counts: it merges with
     either shape and says nothing about the other side. */
  function recordArray(a) {
    for (var i = 0; i < a.length; i++) { if (!isPlainObj(a[i]) || a[i].id == null) return false; }
    return true;
  }
  function indexById(rows) {
    var ix = {};
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if (isPlainObj(r) && r.id != null && !has(ix, String(r.id))) ix[String(r.id)] = r;
    }
    return ix;
  }

  /* The document keys that are bookkeeping rather than content. They differ on
     every browser by design and must never be reported as a conflict. */
  var MERGE_SKIP = { rev: 1, schemaVersion: 1 };

  /* Do two documents say the same thing? The rev counter is not content — it is
     incremented by every local write, including writes that changed nothing —
     so comparing it would call two identical documents different, and that is
     the difference between "there is something to upload" and an upload that
     exists only because somebody looked at a page. Every "has this changed?"
     question in this file goes through here. */
  function sameContent(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    var ka = Object.keys(a).filter(function (k) { return !MERGE_SKIP[k]; });
    var kb = Object.keys(b).filter(function (k) { return !MERGE_SKIP[k]; });
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!has(b, ka[i]) || !deepEq(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  /* One key, present on some combination of the three sides. Returns the value
     to keep, or the marker DROP when the key should not exist in the result. */
  var DROP = {};
  function mergeKey(inBase, bv, inMine, mv, inTheirs, tv, path, out, kp) {
    if (!inMine && !inTheirs) return DROP;                       // both deleted it
    if (inMine && !inTheirs) {
      if (!inBase) return mv;                                    // I added it
      if (deepEq(bv, mv)) return DROP;                           // they deleted what I hadn't touched
      out.conflicts.push({ path: path, keys: kp, kind: 'deleted-remotely' });
      return mv;                                                 // they deleted what I HAD edited
    }
    if (!inMine && inTheirs) {
      if (!inBase) return tv;                                    // they added it
      if (deepEq(bv, tv)) return DROP;                           // I deleted what they hadn't touched
      out.conflicts.push({ path: path, keys: kp, kind: 'deleted-locally' });
      return DROP;                                               // my delete stands; they are told
    }
    return merge3(inBase ? bv : undefined, mv, tv, path, out, kp);
  }

  /* kp is the same address as `path`, kept as data — object keys and {id} row
     descriptors — so a reported collision can be written back to. NOT named
     `keys`: the object branch below has its own local by that name, and the two
     silently became one. */
  function merge3(base, mine, theirs, path, out, kp) {
    kp = kp || [];
    if (deepEq(mine, theirs)) return theirs;      // same answer from either side
    if (deepEq(base, mine)) return theirs;        // only they moved it
    if (deepEq(base, theirs)) return mine;        // only I moved it

    // Both moved. Objects and record arrays can still be reconciled piecewise.
    if (isPlainObj(mine) && isPlainObj(theirs)) {
      var b = isPlainObj(base) ? base : {};
      var res = {}, seen = {}, keys = [];
      [theirs, mine, b].forEach(function (o) {
        for (var k in o) { if (has(o, k) && !seen[k]) { seen[k] = 1; keys.push(k); } }
      });
      keys.forEach(function (k) {
        if (path === '' && MERGE_SKIP[k]) return;   // stamped by the caller
        var v = mergeKey(has(b, k), b[k], has(mine, k), mine[k], has(theirs, k), theirs[k], path + '.' + k, out, kp.concat(k));
        if (v !== DROP) res[k] = v;
      });
      return res;
    }

    if (Array.isArray(mine) && Array.isArray(theirs) && recordArray(mine) && recordArray(theirs)) {
      return mergeRows(Array.isArray(base) ? base : [], mine, theirs, path, out, kp);
    }

    /* A leaf both sides changed to different things — one text field, one
       score, one list of selections. Nothing can merge that, so the local
       value stands (it is unsaved and on screen) and the collision is
       reported. */
    out.conflicts.push({ path: path, keys: kp, kind: 'both-edited', mine: mine, theirs: theirs });
    return mine;
  }

  /* Record arrays, merged by id. Order follows THEIRS — the document everyone
     else is already looking at — with rows only this browser has appended
     after it, so a row added here never jumps to the middle of someone else's
     list on the next poll. */
  function mergeRows(base, mine, theirs, path, out, kp) {
    kp = kp || [];
    var bi = indexById(base), mi = indexById(mine), ti = indexById(theirs);
    var res = [], done = {};
    function place(id) {
      if (done[id]) return;
      done[id] = 1;
      var v = mergeKey(has(bi, id), bi[id], has(mi, id), mi[id], has(ti, id), ti[id], path + '[' + id + ']', out, kp.concat({ id: id }));
      if (v !== DROP) res.push(v);
    }
    theirs.forEach(function (r) { if (isPlainObj(r) && r.id != null) place(String(r.id)); });
    mine.forEach(function (r) { if (isPlainObj(r) && r.id != null) place(String(r.id)); });
    // A row only `base` still has was deleted on both sides: nothing to place.
    return res;
  }

  /* Merge two whole workspace documents. Returns the merged document and every
     collision found, for the app to tell the user about (onSyncConflict). */
  function mergeDocs(base, mine, theirs) {
    var out = { conflicts: [] };
    var merged = merge3(base || {}, mine || {}, theirs || {}, '', out, []);
    if (!isPlainObj(merged)) merged = cloneDoc(theirs) || {};
    merged.schemaVersion = SCHEMA_VERSION;
    // The local rev counter only ever goes up, or another tab's storage-event
    // refresh reads the adoption as a rollback and writes over it.
    merged.rev = Math.max((mine && mine.rev) || 0, (theirs && theirs.rev) || 0);
    return { doc: merged, conflicts: out.conflicts };
  }

  /* ── The confirmed baseline ────────────────────────────────
     What the server is known to hold, kept beside the mirror so the diff above
     has a third point of reference. Mirrored to disk because the most common
     way to lose an edit was a reload inside the debounce window: the mirror
     held the edit, the server did not, and boot could not tell which of the two
     documents was ahead. Now it can. */
  function baseKey(id) { return 'pipeline-org-base::' + id + moduleSuffix(id); }
  /* `owned` says the caller is handing over a private copy nobody else holds a
     reference to (flushOrg's `sent`), so it need not be cloned again — this runs
     on every successful save and the document can be tens of kilobytes. */
  function setBase(id, doc, owned) {
    var c = owned ? doc : cloneDoc(doc);
    server.base[id] = c;
    writeJSON(baseKey(id), c);   // may fail on quota; the in-memory copy still serves this session
  }
  function getBase(id) {
    if (has(server.base, id)) return server.base[id];
    var stored = readJSON(baseKey(id), null);
    if (stored) server.base[id] = stored;
    return stored;
  }
  /* The freshest local state: the live replica for the org on screen (which
     holds edits that may not even have reached the mirror yet), the cache or
     the mirror for any other. */
  function localDoc(id) {
    if (typeof currentOrgId !== 'undefined' && id === currentOrgId
      && typeof data !== 'undefined' && data && typeof data === 'object') return data;
    return server.docs[id] || readJSON(orgKey(id), null);
  }

  /* Take in what the server has now, keeping everything this browser has not
     sent yet. Mirrors the result for offline, and — if it is the org on screen
     — reloads and repaints without stealing what the user is typing (the same
     focus dance as refreshOrg). Anything of ours that survived the merge is
     queued straight back to the server, so an edit the poll caught mid-flight
     still lands instead of living on in this tab alone. */
  function adoptDoc(id, fresh, rev, by) {
    var isActive = (typeof currentOrgId !== 'undefined' && id === currentOrgId);
    /* Bank whatever is on screen but not yet in the document FIRST, so it takes
       part in the merge as MINE instead of being painted over by the answer.

       Not every field puts what is typed into it into the document as it is
       typed. A row added with "Add" saves when focus leaves it; an Executive
       Readiness textarea is harvested off the page and by nothing else. Until
       that moment the only copy of those words is the DOM — which is not one of
       the three documents the merge compares, and which the repaint below
       rebuilds. So anybody else saving anything, anywhere in the module, reset
       them to the stored value while they were being written. See
       bankOpenPage() in js/app.js. */
    if (isActive) { try { if (typeof bankOpenPage === 'function') bankOpenPage(); } catch (e) { } }
    var mine = localDoc(id);
    var merged = fresh, conflicts = [];
    if (mine) {
      /* No baseline yet (the org had never been saved, or the boot fetch
         failed): treat everything local as unsent rather than assume it is
         already on the server. That errs towards keeping the user's work. */
      var res = mergeDocs(getBase(id) || {}, mine, fresh);
      merged = res.doc; conflicts = res.conflicts;
    }
    /* Before the merged document goes anywhere: which of the edits this browser
       saved has it just taken back off us. Computed here because it needs both
       sides, and `mine` is about to become the same object as `merged`. */
    var replaced = mine ? authoredOverwrites(mine, merged) : [];
    /* Did the merge actually bring anything this browser did not already have?
       Usually not: the poll fires on any rev change, and most rev changes are
       somebody else's save of a document that, once merged, says exactly what
       ours already said — their edit was already here, or was ours coming back.
       Tearing the page down for that is all cost and no news, so when the
       answer is the document we are already holding, keep holding it. */
    var unchangedHere = !!mine && sameContent(merged, mine);
    if (unchangedHere) {
      // Keep ONE object for the live replica; only its bookkeeping moves on.
      if (isPlainObj(mine)) { mine.rev = merged.rev; mine.schemaVersion = merged.schemaVersion; }
      merged = mine;
    }
    server.docs[id] = merged;
    server.revs[id] = rev;
    setBase(id, fresh);              // the server's document is the new baseline
    writeJSON(orgKey(id), merged);
    // Ours survived the merge in part → it is still unsent. Send it.
    if (!sameContent(merged, fresh)) scheduleFlush(id);
    if (conflicts.length) reportConflicts(id, conflicts);
    if (replaced.length) reportOverwrites(id, replaced, by);
    if (!isActive || unchangedHere) return false;
    /* Repaint from the merged document without taking anything the reader has
       on screen: their focus, their caret, and every field they have typed into
       since the last paint (repaintAfterSync, js/app.js). */
    if (typeof repaintAfterSync === 'function') { repaintAfterSync(); return true; }
    var f = captureFocus();
    try { loadData(); applyTeamRoster(); render(); } catch (e) { }
    restoreFocus(f);
    return true;
  }

  /* Hand collisions to the app to explain (js/app.js onSyncConflict). Never
     throws into the sync path: a merge that landed must not be undone by a
     failure to describe it. */
  function reportConflicts(id, conflicts) {
    try { console.warn('Sync conflicts kept locally:', conflicts.map(function (c) { return c.path + ' (' + c.kind + ')'; })); } catch (e) { }
    try { if (typeof onSyncConflict === 'function') onSyncConflict(conflicts, id); } catch (e) { }
  }

  /* ── What THIS browser saved, and what later replaced it ───
     The merge above reports a collision only when both sides changed a value
     between the same two saves. The commoner way to lose work is quieter and
     the merge is right to be silent about it: I type, I save, my edit reaches
     the database — and a minute later somebody who was holding an older copy
     saves over it. On my next poll base and mine agree (mine is saved), so
     merge3 takes theirs as "only they moved it" and my sentence is gone with
     nothing said. Both people believe they wrote it.

     So the leaves this browser actually sent are remembered, with the value
     sent. When an adoption changes one of them out from under us and our copy
     is still the one we sent, that is a replacement, and it is reported with
     the value that was lost. Bounded and short-lived: this is for telling
     somebody what just happened, not an edit history. */
  var AUTHORED_TTL_MS = 20 * 60 * 1000;
  var AUTHORED_MAX = 400;
  var _authored = {};                       // path string → {keys, v, at}

  /* Read a value by the descriptor path leafDiff builds: plain strings are
     object keys, {id:…} addresses a row of a record array by its id. */
  function readAt(doc, keys) {
    var cur = doc;
    for (var i = 0; i < keys.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      var k = keys[i];
      if (k && typeof k === 'object' && has(k, 'id')) {
        if (!Array.isArray(cur)) return undefined;
        var hit;
        for (var j = 0; j < cur.length; j++) { if (isPlainObj(cur[j]) && String(cur[j].id) === k.id) { hit = cur[j]; break; } }
        cur = hit;
      } else {
        cur = has(cur, k) ? cur[k] : undefined;
      }
    }
    return cur;
  }
  function pathStr(keys) {
    return keys.map(function (k) { return (k && typeof k === 'object') ? '[' + k.id + ']' : '.' + k; }).join('');
  }

  /* Every leaf where `b` says something `a` does not. Objects and record arrays
     are walked; every other value — a string, a number, a plain array of
     scalars, an array of rows without ids — is a leaf and is reported whole,
     because that is the smallest thing anyone can be told about. */
  function leafDiff(a, b, keys, out, depth) {
    if (out.length >= AUTHORED_MAX || depth > 8) return out;
    if (deepEq(a, b)) return out;
    if (isPlainObj(a) && isPlainObj(b)) {
      var seen = {}, k;
      for (k in b) { if (has(b, k) && !MERGE_SKIP[k]) { seen[k] = 1; leafDiff(a[k], b[k], keys.concat(k), out, depth + 1); } }
      for (k in a) { if (has(a, k) && !seen[k] && !MERGE_SKIP[k]) leafDiff(a[k], undefined, keys.concat(k), out, depth + 1); }
      return out;
    }
    if (Array.isArray(a) && Array.isArray(b) && recordArray(a) && recordArray(b)) {
      var ai = indexById(a), bi = indexById(b), id;
      for (id in bi) { if (has(bi, id)) leafDiff(ai[id], bi[id], keys.concat({ id: id }), out, depth + 1); }
      for (id in ai) { if (has(ai, id) && !has(bi, id)) leafDiff(ai[id], undefined, keys.concat({ id: id }), out, depth + 1); }
      return out;
    }
    /* ── Rows with no id, addressed by position ──────────────
       Some collections are arrays of plain objects with no id at all — the
       Pipeline's idea cards are the one people meet, and everything that
       handles them (data.selected, UI.ec, the expanded flags) addresses them by
       index. recordArray() rejects them, and rightly: the MERGE cannot reconcile
       them row by row, because it has nothing stable to match rows on.

       Reporting is a smaller question than merging, and this is where the two
       part company. Without this the whole array was one leaf, so a colleague
       changing one word of one card was reported as "Idea cards: 1 row →
       1 row" — true, useless, and with no field-level path, which is also why
       no note could be placed under the box it happened in.

       ONLY when the two sides are the same length. Position means nothing
       across an insert or a delete: every row after it shifts, and a diff by
       index would report a storm of changes nobody made. Different lengths stay
       one leaf, which is the honest summary of "the list itself changed". */
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.length
      && allPlainObj(a) && allPlainObj(b)) {
      for (var ix = 0; ix < a.length; ix++) {
        leafDiff(a[ix], b[ix], keys.concat(String(ix)), out, depth + 1);
      }
      return out;
    }
    out.push({ keys: keys, path: pathStr(keys), from: a, to: b });
    return out;
  }
  function allPlainObj(rows) {
    for (var i = 0; i < rows.length; i++) { if (!isPlainObj(rows[i])) return false; }
    return true;
  }

  function pruneAuthored() {
    var cut = Date.now() - AUTHORED_TTL_MS, keys = Object.keys(_authored);
    for (var i = 0; i < keys.length; i++) if (_authored[keys[i]].at < cut) delete _authored[keys[i]];
    keys = Object.keys(_authored);
    if (keys.length > AUTHORED_MAX) {
      keys.sort(function (x, y) { return _authored[x].at - _authored[y].at; });
      for (var j = 0; j < keys.length - AUTHORED_MAX; j++) delete _authored[keys[j]];
    }
  }
  /* Called on a save the server accepted: `confirmed` is what it held before,
     `sent` what it holds now. Everything between the two is ours. */
  function noteAuthored(confirmed, sent) {
    try {
      var diffs = leafDiff(confirmed || {}, sent || {}, [], [], 0), now = Date.now();
      for (var i = 0; i < diffs.length; i++) {
        _authored[diffs[i].path] = { keys: diffs[i].keys, v: cloneDoc(diffs[i].to), at: now };
      }
      pruneAuthored();
    } catch (e) { }
  }
  /* Which of our saved leaves this adoption has just replaced. `mine` is the
     document before the merge, `merged` after it: our value must still be the
     one we sent (nobody has typed over it here since) and the merged value must
     differ, or there is nothing to report. */
  function authoredOverwrites(mine, merged) {
    var out = [];
    try {
      pruneAuthored();
      var paths = Object.keys(_authored);
      for (var i = 0; i < paths.length; i++) {
        var rec = _authored[paths[i]];
        var was = readAt(mine || {}, rec.keys);
        if (!deepEq(was, rec.v)) continue;             // we have moved on; not this
        var now = readAt(merged || {}, rec.keys);
        if (deepEq(was, now)) continue;                // untouched
        out.push({ path: paths[i], keys: rec.keys, lost: was, incoming: now, at: rec.at });
        delete _authored[paths[i]];                    // said once
      }
    } catch (e) { }
    return out;
  }
  function reportOverwrites(id, items, by) {
    if (!items || !items.length) return;
    try { console.warn('Saved edits replaced by another member:', items.map(function (c) { return c.path; })); } catch (e) { }
    try { if (typeof onRemoteOverwrite === 'function') onRemoteOverwrite(items, id, by); } catch (e) { }
  }

  /* ── What changed, section by section ──────────────────────
     The document's top-level keys ARE its sections: ideas, projects, capital,
     assessments, roster… Comparing the live document with the baseline says
     exactly which of them this browser has touched since the server last
     confirmed anything — no register to keep in step, no call site to remember
     to mark, and it cannot disagree with the document because it IS the
     document. `removed` are sections that were there at the baseline and are
     gone now, which a patch has to state explicitly or they would live on. */
  function changedSections(base, doc) {
    var sections = {}, removed = [], n = 0, k;
    for (k in doc) {
      if (!has(doc, k) || MERGE_SKIP[k]) continue;
      if (!has(base, k) || !deepEq(base[k], doc[k])) { sections[k] = doc[k]; n++; }
    }
    for (k in base) {
      if (!has(base, k) || MERGE_SKIP[k]) continue;
      if (!has(doc, k)) { removed.push(k); n++; }
    }
    return { sections: sections, removed: removed, count: n };
  }

  /* Save one org's document. The rev we loaded at goes up as `base_rev`, so
     the server can refuse the write if someone else saved meanwhile (409)
     rather than let us silently flatten their work. */
  function flushOrg(id, cb) {
    /* cb (optional) fires once, when the server has the document or the attempt
       has definitively failed — see flushNow, which is the only caller that
       passes one. Never more than once, and never left uncalled. */
    var settled = false;
    var done = function (ok) { if (settled) return; settled = true; if (cb) { try { cb(!!ok); } catch (e) { } } };
    var doc = server.docs[id];
    if (!doc) { done(false); return; }

    /* Second gate, at the moment of sending: whatever queued this, if the
       document now says what the server already holds there is nothing to
       upload. Catches the queue that was raised by a write later undone (a
       harvest reverted because the reader had typed nothing — see go()) and any
       flush left pending from before a merge. */
    var confirmedNow = getBase(id);
    if (confirmedNow && sameContent(doc, confirmedNow)) { done(true); return; }

    /* ── Never overwrite a document this browser has not read ──────────
       A whole-document POST with no base_rev is accepted unconditionally by the
       server — that is what makes the seed and the genuine first write possible
       (Models\Workspace::save) — so sending one over a workspace we have never
       seen replaces the whole team's program with whatever this browser happens
       to hold. Which, on the load after a sign-in that could not fetch the
       document, is an EMPTY document: the assessment battery, the risk
       register, every answer in the program, gone in one request, in every
       module, because none of this is a module's code.

       `server.revs[id]` is the discriminator, and it is exact. It is set to 0
       for an organization the server confirms has no workspace yet — where a
       first write is right — and to the real rev the moment one is read or
       accepted. Undefined means neither has happened: the fetch never landed
       (403 for a request with no actor, or a genuinely dropped connection), so
       there is no basis on which to claim the server's copy is ours to replace.

       So: read first, merge into what is here (adoptDoc keeps every local edit
       — nothing waiting to be saved is at risk), and only then send. If the
       read cannot be had, the write waits. Local work is never dropped; it sits
       in the mirror behind the offline banner until the document can be read,
       which is the honest state and a recoverable one. */
    if (!confirmedNow && server.revs[id] == null) {
      if (_recovering[id]) { done(false); return; }   // one in flight is enough
      _recovering[id] = true;
      getJSON('/workspace?org=' + encodeURIComponent(id) + modQ(id), function (w) {
        delete _recovering[id];
        if (!w) {
          // Could not read it. Keep everything, send nothing, try again later.
          setOnline(false);
          pendingOrgs[id] = true;
          setTimeout(function () { scheduleFlush(id); }, RETRY_DELAY_MS);
          done(false);
          return;
        }
        setOnline(true);
        if (w.doc) {
          /* The three-way merge with no baseline, which is exactly the case it
             was built for: everything local counts as unsent and is kept, and
             everything of theirs we do not have arrives. */
          adoptDoc(id, w.doc, w.rev, w.updated_by);
        } else {
          server.revs[id] = w.rev || 0;   // confirmed: no workspace yet, so ours is the first
        }
        flushOrg(id, cb);                 // now on a known footing
      });
      return;
    }

    // The API records who wrote, and authorizes that they belong to the org.
    var actor = '';
    try { actor = (typeof workspaceActorId === 'function') ? workspaceActorId(id) : ''; } catch (e) { }
    if (!actor) { done(false); return; } // nobody to attribute the save to yet — retry on the next edit

    var orgServer = id, baseRev = server.revs[id];
    /* The exact bytes going out, frozen now. On success they become the
       baseline — what the server is known to hold — and `doc` cannot be used
       for that: it is the live replica, and by the time the response lands the
       user may have typed into it again. Those keystrokes are unsent changes,
       and a baseline taken after them would claim the server already had them. */
    var sent = cloneDoc(doc);

    /* ── Send the sections, not the module ───────────────────
       What this browser changed is known exactly (changedSections), so that is
       what goes: a member editing the capital plan sends the capital plan. The
       sections nobody here touched are not in the request at all, so they cannot
       be written — which is what stops two people working on different parts of
       the same program from putting older copies of each other's work back.

       The whole-document POST is still here and still correct. It is what a
       FIRST save uses (no baseline to diff against yet) and what an older
       deployment without /workspace/patch falls back to. Both paths end in the
       same place: server.revs and the baseline advanced to what was accepted. */
    var patch = confirmedNow && !server.noPatch ? changedSections(confirmedNow, doc) : null;
    var usePatch = !!(patch && patch.count);
    var body = usePatch
      ? { org: orgServer, module: moduleId(id), actor_id: actor, sections: patch.sections, removed: patch.removed, schema_version: SCHEMA_VERSION }
      /* moduleId(id), not moduleId(). Which module a document belongs to depends
         on the ORG, because the fallback inside moduleId() reads the account's
         role — and every READ path here passes it (orgKey, modQ). A write that
         leaves it out can resolve to a different module than the read it is
         answering, filing the document under one program and looking for it
         under another. */
      : { org: orgServer, module: moduleId(id), actor_id: actor, base_rev: (baseRev == null ? null : baseRev), doc: doc, schema_version: SCHEMA_VERSION };

    fetch(apiUrl(usePatch ? '/workspace/patch' : '/workspace'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j || {} }; }, function () { return { status: r.status, body: {} }; }); })
      .then(function (res) {
        setOnline(true);

        if (res.status === 409 && res.body.stale) {
          /* Somebody saved between our read and our write, so the server kept
             theirs and handed it back. Exactly the poll's situation, one step
             later — so it takes the same route: three-way merge against the
             baseline, our unsent work kept, their work kept, collisions
             reported. (It used to replay only the records marked dirty, which
             missed every edit that went through saveData() rather than
             Store.commit() — most of the organization and roster screens.) */
          var fresh = res.body.data && res.body.data.doc;
          if (fresh) adoptDoc(id, fresh, res.body.data.rev, res.body.data.updated_by);
          done(false);
          return;
        }

        /* The endpoint is not there (an older deployment). Remember that for the
           rest of the session and send the whole document instead — nothing is
           lost, the write simply takes the older route. */
        if (usePatch && (res.status === 404 || res.status === 405)) {
          server.noPatch = true;
          scheduleFlush(id);
          done(false);
          return;
        }

        if (res.status >= 200 && res.status < 300 && res.body.success) {
          /* What this browser has READ, taken before the line below stamps what
             it has just WRITTEN over the top of it. On the whole-document path
             the two are the same number — that write is refused with a 409
             unless our base_rev is the current one, so a 200 means nothing
             happened underneath us. On the patch path they are not: see below. */
          var seenRev = server.revs[id];
          server.revs[id] = res.body.data.rev;
          /* What the server is now known to hold. After a PATCH that is the old
             baseline with the sections we sent written over it — NOT the whole
             document we happen to be holding, because the sections we did not
             send may have moved on in someone else's hands. Getting this wrong
             would make the next diff think their work was ours to overwrite. */
          if (usePatch) {
            /* Read the baseline again rather than reusing the one captured
               before the request: a poll may have adopted somebody else's
               sections while this was in flight, and starting from the older
               copy would forget we had already seen them. */
            var nb = cloneDoc(getBase(id) || confirmedNow) || {};
            var beforeNb = cloneDoc(nb) || {};   // nb is written in place below
            for (var sk in patch.sections) { if (has(patch.sections, sk)) nb[sk] = cloneDoc(patch.sections[sk]); }
            for (var ri = 0; ri < patch.removed.length; ri++) delete nb[patch.removed[ri]];
            /* Remember these as OURS before the baseline moves: the difference
               between the two is exactly what this request wrote, and it is what
               lets us tell the user later if somebody saves over it. */
            noteAuthored(beforeNb, nb);
            setBase(id, nb, true);
            /* ── A patch may have stepped over somebody ──────────────
               A patch is applied to whatever is stored and is never refused as
               stale (WorkspaceController::patch) — that is the whole point of
               it. So the rev it comes back with counts every commit made since
               we last read, not only ours, and stamping it above as "I have
               seen everything up to here" was a claim this browser had no basis
               for. checkRemote() only downloads when the server's rev is HIGHER
               than that number, so a colleague's commit that our own save
               happened to step over was never fetched at all: the member who
               saved last sat on the old value, with the poll running and
               finding nothing, until somebody else wrote again.

               The baseline written a line above is wrong for the same reason —
               it claims the server holds OUR copy of the sections we never
               pulled — so the next patch touching one of those sections sends
               that stale copy back over their work. That is the same event seen
               from the other side, and it is what put "your saved change was
               replaced" on everybody else's screen.

               One accepted write moves the rev by exactly one (Models\Workspace
               ::patch). Anything more means there is something here we have not
               read, and the rev endpoint can no longer tell us so — hence a
               read of the document itself rather than another poll. */
            if (seenRev == null || res.body.data.rev !== seenRev + 1) pullDoc(id);
          } else {
            noteAuthored(confirmedNow, sent);
            setBase(id, sent, true);   // the server now holds exactly this
          }
          _dirty = {};
          /* Anything typed while the request was in flight is, by definition,
             not in what we sent. Queue it rather than wait for the next edit to
             notice — otherwise it sits unsent until the user touches the page
             again, which is the window the poll used to overwrite.

             sameContent, not deepEq: every local write bumps obj.rev, so a
             plain comparison saw a difference after any write at all and posted
             the same document two or three times over.

             After a patch this is measured against the new baseline instead:
             what we sent was only part of the document, so comparing the whole
             of it with the whole of `sent` would always look different. */
          var confirmedAfter = usePatch ? getBase(id) : sent;
          if (!sameContent(server.docs[id], confirmedAfter)) scheduleFlush(id);
          done(true);
          return;
        }

        // 403/404/422: a real rejection, not a blip. Keep the local copy and
        // surface it — retrying identical bad data would just spin.
        console.error('Workspace save rejected:', res.status, res.body.message || '');
        done(false);
      })
      .catch(function () {
        // Network failure: the edit is safe in the local mirror. Warn, retry.
        setOnline(false);
        pendingOrgs[id] = true;
        setTimeout(function () { scheduleFlush(id); }, RETRY_DELAY_MS);
        done(false);
      });
  }

  function nowMs() { try { return Date.now(); } catch (e) { return 0; } }
  /* Is a person typing into a field at this instant? Answered by the app, which
     is where the events are (appIsTyping, js/app.js). Anywhere it is not
     defined — the test probe, a screen mounted on its own — the answer is no
     and the original debounce applies unchanged. */
  function typingNow() {
    try { return typeof appIsTyping === 'function' && !!appIsTyping(); } catch (e) { return false; }
  }
  function runFlush() {
    flushTimer = null; flushAt = 0; flushCeiling = 0;
    var ids = Object.keys(pendingOrgs);
    pendingOrgs = {};
    ids.forEach(function (i) { flushOrg(i); });
  }
  function scheduleFlush(id) {
    if (!server.enabled) return;
    pendingOrgs[id] = true;
    var t = nowMs();
    if (!flushTimer) flushCeiling = t + TYPING_MAX_DELAY_MS;   // from the first unsaved edit
    var due = t + (typingNow() ? TYPING_DEBOUNCE_MS : FLUSH_DEBOUNCE_MS);
    if (due > flushCeiling) due = flushCeiling;
    if (flushTimer) {
      if (due <= flushAt) return;     // already due at least as soon as this asks
      clearTimeout(flushTimer);       // typing continues: push the window back
    }
    flushAt = due;
    flushTimer = setTimeout(runFlush, due - t > 0 ? due - t : 0);
  }

  /* Save the active org's document NOW, and call back when the server has it.
     Writes are debounced by FLUSH_DEBOUNCE_MS so that typing does not post on
     every keystroke — which is right while the page stays put, and wrong the
     moment a save is followed by a navigation: the timer goes with the page and
     the last edit is never sent. Anything that writes and then LEAVES (the
     sign-up hand-off, finishing the first-run wizard) has to come through here.
     cb(true) when the server took it, cb(false) otherwise — including with no
     server at all, where the local mirror written by writeOrg is the record. */
  function flushNow(cb) {
    var id = (typeof currentOrgId !== 'undefined') ? currentOrgId : null;
    if (!id) { if (cb) cb(false); return; }
    if (!server.enabled) { if (cb) cb(true); return; }
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; flushAt = 0; flushCeiling = 0; }
    delete pendingOrgs[id];
    // Anything else that was queued keeps its place in the debounce.
    var rest = Object.keys(pendingOrgs);
    if (rest.length) scheduleFlush(rest[0]);
    flushOrg(id, cb);
  }

  /* -- org data blob (one document; the app reads and writes it whole) -- */
  function readOrg(id) {
    if (server.enabled && Object.prototype.hasOwnProperty.call(server.docs, id)) return server.docs[id];
    return readJSON(orgKey(id), null);
  }

  function orgRaw(id) {
    if (server.enabled && Object.prototype.hasOwnProperty.call(server.docs, id)) {
      var d = server.docs[id];
      return d == null ? null : JSON.stringify(d);
    }
    return rawGet(orgKey(id));
  }
  /* -- revisioned writes (multi-user prep, July 8) --------------------
     Every persisted blob carries schemaVersion and a monotonic rev. The
     local store never rejects a write; the server enforces optimistic
     concurrency: PUT {baseRev, blob} → 200 {rev: baseRev+1} when its
     stored rev === baseRev, else 409 {stale:true, rev} – and on a 409
     the server adapter calls handleStaleWrite() below. revKey mirrors
     the blob's rev in a tiny record so change-polling never parses the
     whole blob (server equivalent: GET /org/{id}/rev). */
  var SCHEMA_VERSION = 1;
  function revKey(id) { return 'pipeline-org-rev::' + id; }
  function orgRev(id) { var v = parseInt(rawGet(revKey(id)), 10); return isNaN(v) ? 0 : v; }
  /* The single write path for program state: every saveData() and every one of
     the ~158 Store.commit() calls lands here. Locally it mirrors the document;
     in server mode it also queues the save to MySQL.

     Two rev counters live side by side, deliberately:
       obj.rev / revKey()  local, per-browser. Drives the two-tab storage-event
                           refresh, exactly as before.
       server.revs[id]     the database's rev. Drives optimistic concurrency on
                           save (base_rev) and the change poll.
     They count different things and are never compared to each other. */
  function writeOrg(id, obj) {
    /* A write that changes nothing is not a write.

       The app calls this far more often than the reader changes anything: a
       program re-reads its open page into the document when you leave it, the
       shell normalises the document on load, a screen commits a section as it
       repaints. Each of those used to bump the rev, rewrite the mirror (waking
       every other tab), and queue an upload of the whole document — so simply
       moving between pages posted the module to the server, and that upload,
       carrying a document the reader had not touched, is what could put an
       older value back over a colleague's edit.

       So: if the document says exactly what the server already has, there is
       nothing to mirror, nothing to announce and nothing to send. Local mode
       (file://) is untouched — there is no server to compare against, and the
       rev counter is the only change signal two tabs have. */
    /* pendingOrgs already says this document differs from the server's, so the
       comparison would only confirm what is known — and this runs on every
       keystroke that commits. Skip straight to the write. */
    if (server.enabled && obj && typeof obj === 'object' && !pendingOrgs[id]) {
      var confirmed = getBase(id);
      if (confirmed && sameContent(obj, confirmed)) { server.docs[id] = obj; return true; }
    }
    if (obj && typeof obj === 'object') { obj.schemaVersion = SCHEMA_VERSION; obj.rev = (obj.rev || 0) + 1; }
    var okW = writeJSON(orgKey(id), obj);   // offline mirror
    if (okW && obj) rawSet(revKey(id), String(obj.rev || 0));
    if (server.enabled && obj) { server.docs[id] = obj; scheduleFlush(id); }
    /* An open collision notice reads "now stored" from the document, and the
       document has just moved — by this browser's own hand, which is the case
       the sync repaint could never cover. Cheap: it rewrites two text nodes,
       and does nothing at all unless a notice is open. */
    try { if (typeof collabReportRefresh === 'function') collabReportRefresh(); } catch (e) { }
    return okW;
  }
  function removeOrg(id) {
    rawDel(orgKey(id)); rawDel(revKey(id)); rawDel(baseKey(id));
    delete server.docs[id]; delete server.revs[id]; delete server.base[id];
  }

  /* Authoritative workspace save for the sample-data seed. The seed is a
     "replace everything" action, so it must NOT ride the debounced,
     optimistic-concurrency flush (flushOrg): on a freshly created org that
     flush races with the change-poll and can persist an empty document,
     because saveData() marks nothing dirty and a 409 merge then keeps none of
     the seed. This posts the WHOLE document with base_rev:null — the server
     accepts it unconditionally (WorkspaceController treats null as "no basis to
     compare") — then syncs the cached rev so the next poll won't clobber it.
     Writes the offline mirror too, so file:// and the cache stay correct.
     cb(true) on a persisted save, cb(false) otherwise. */
  function commitSeed(id, doc, cb, actorOverride) {
    if (!id || !doc || typeof doc !== 'object') { if (cb) cb(false); return; }
    doc.schemaVersion = SCHEMA_VERSION; doc.rev = (doc.rev || 0) + 1;
    writeJSON(orgKey(id), doc); rawSet(revKey(id), String(doc.rev || 0)); // offline mirror
    server.docs[id] = doc;
    if (!server.enabled) { if (cb) cb(true); return; }
    /* actorOverride is whoever pressed Seed, captured before the seed replaced
       the roster. workspaceActorId() looks in the SAVED document, which by now
       is the seeded one — all-new members with no serverId — so on a seed that
       re-rosters it finds nobody and the save is abandoned. */
    var actor = actorOverride || '';
    try { if (!actor) actor = (typeof workspaceActorId === 'function') ? workspaceActorId(id) : ''; } catch (e) { }
    if (!actor) { if (cb) cb(false); return; } // nobody to attribute the save to
    fetch(apiUrl('/workspace'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // moduleId(id) — see the note in flushOrg: the org decides the module.
      /* `replace` says out loud what base_rev:null used to say silently: throw
         away whatever is stored and take this document whole. The seed is the
         one action in the app that genuinely means it — the server refuses any
         other null-base_rev write over an existing workspace, because that is
         how a browser that failed to READ a workspace came to overwrite it. */
      body: JSON.stringify({ org: id, module: moduleId(id), actor_id: actor, base_rev: null, replace: true, doc: doc, schema_version: SCHEMA_VERSION })
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j || {} }; }, function () { return { status: r.status, body: {} }; }); })
      .then(function (res) {
        if (res.status >= 200 && res.status < 300 && res.body.success) {
          setOnline(true); server.revs[id] = res.body.data.rev; server.docs[id] = doc; _dirty = {};
          setBase(id, doc);   // the seed is now what the server holds
          if (cb) cb(true);
        } else { console.error('Seed workspace save rejected:', res.status, res.body.message || ''); if (cb) cb(false); }
      })
      .catch(function () { setOnline(false); if (cb) cb(false); });
  }

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
    try { if (typeof bankOpenPage === 'function') bankOpenPage(); } catch (e) { }
    if (typeof repaintAfterSync === 'function') { repaintAfterSync(); return true; }
    var f = captureFocus();
    loadData(); applyTeamRoster();
    try { render(); } catch (e) { }
    restoreFocus(f);
    return true;
  }

  /* stale-write recovery: re-pull, overlay the local dirty records onto
     the fresh blob, persist, clear the dirty set. Record-level
     last-writer-wins, per the blob-PUT ruling. The dirty set means
     'changed since the last successful sync': the server adapter clears
     it on every 200 (locally it is scaffolding and accumulates).

     NOT what the server paths use any more. Replaying the dirty set can only
     recover records that went through Store.commit(); everything written by
     saveData() alone — organization details, the roster, most of the shell —
     marks nothing and was therefore lost on a 409. Those paths go through the
     three-way merge (mergeDocs/adoptDoc) instead, which needs no such register
     because it compares the documents themselves. This stays for local mode and
     for the pins that freeze the original contract. */
  function mergeDirtyInto(fresh, local, dirtyKeys) {
    (dirtyKeys || []).forEach(function (k) {
      var i = k.indexOf('::');
      if (i < 0) { fresh[k] = local[k]; }
      else {
        var col = k.slice(0, i), id = k.slice(i + 2);
        /* A collection of records is an id-keyed OBJECT in the enterprise
           programs and an id-keyed ARRAY in the Leaders ones (data.decisions).
           Both commit as `collection::id`, so the overlay has to know which
           shape it is looking at: writing fresh['decisions']['dec_7'] onto an
           array sets a non-index property, and JSON.stringify drops it — the
           record the user just edited vanishes on the next save with nothing
           in the console. Match on the LOCAL side, which is the replica that
           actually holds the edit; `fresh` may not carry the collection yet. */
        if (Array.isArray(local[col]) || Array.isArray(fresh[col])) {
          mergeDirtyRow(fresh, local, col, id);
          return;
        }
        if (!fresh[col] || typeof fresh[col] !== 'object') fresh[col] = {};
        fresh[col][id] = (local[col] || {})[id];
      }
    });
    return fresh;
  }
  /* One array record, matched by .id, replaced in place or appended. A record
     the local replica no longer has is a deletion, so it is removed from the
     fresh document rather than resurrected. */
  function mergeDirtyRow(fresh, local, col, id) {
    if (!Array.isArray(fresh[col])) fresh[col] = [];
    var rows = local[col] || [], rec = null, j;
    for (j = 0; j < rows.length; j++) if (rows[j] && String(rows[j].id) === id) { rec = rows[j]; break; }
    var hit = -1;
    for (j = 0; j < fresh[col].length; j++) if (fresh[col][j] && String(fresh[col][j].id) === id) { hit = j; break; }
    if (!rec) { if (hit >= 0) fresh[col].splice(hit, 1); return; }
    if (hit >= 0) fresh[col][hit] = rec; else fresh[col].push(rec);
  }
  function handleStaleWrite(id) {
    var fresh = readOrg(id); if (!fresh) return false;
    mergeDirtyInto(fresh, data, Object.keys(_dirty));
    data = fresh;
    try { ensureRaciModel(); ensureCapCostModel(); } catch (e) { }
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
  /* cb (optional) fires once the question "has anyone else saved?" has been
     answered, with true when a fresher document was actually taken in. The
     poll itself never passes one — it is fire-and-forget — but the lock layer
     does: when a colleague releases a record, the fields under it must not go
     live again until this browser holds what they wrote. See onLocksReleased()
     in the Collab block. Called exactly once on every path, including the
     failures, or the caller would leave its fields disabled for ever. */
  /* Read the document and take it in, without asking the rev endpoint first.
     checkRemote() below is the cheap poll: it compares revs and stops when the
     server's number is not higher than ours, which is right for "has anyone
     saved?" and wrong whenever our own rev is not a claim we can stand behind.
     The patch branch of flushOrg is that case — it advances our rev past
     commits we never read — so it comes here instead. */
  function pullDoc(id) {
    if (!server.enabled || !id) return;
    getJSON('/workspace?org=' + encodeURIComponent(id) + modQ(id), function (w) {
      if (!w) { setOnline(false); return; }
      setOnline(true);
      if (w.doc) adoptDoc(id, w.doc, w.rev, w.updated_by);
    });
  }

  /* ── Who changed what, from the record ────────────────────
     GET /workspace/history (api/sql/workspace-history.sql). `opts.actor` asks
     for one member's changes — "what did this person last do here" — and
     `opts.since` for everything above a rev.

     This is what replaced a ledger the browser kept in its own memory: capped,
     expiring after twenty minutes, emptied by the first report that read it,
     and gone entirely on a reload. Callers here are best-effort and must stay
     that way: nothing on screen depends on this answering. */
  function history(id, opts, cb) {
    var o = opts || {};
    if (!server.enabled || !id) { cb(null); return; }
    var qs = '/workspace/history?org=' + encodeURIComponent(id) + modQ(id);
    if (o.since != null) qs += '&since=' + encodeURIComponent(o.since);
    if (o.actor) qs += '&actor_id=' + encodeURIComponent(o.actor);
    if (o.limit) qs += '&limit=' + encodeURIComponent(o.limit);
    getJSON(qs, function (d) { cb(d && d.entries ? d.entries : null); });
  }

  function checkRemote(cb) {
    var fired = false;
    var done = function (adopted) { if (fired) return; fired = true; if (cb) { try { cb(!!adopted); } catch (e) { } } };
    try {
      if (typeof currentOrgId === 'undefined' || !currentOrgId) { done(false); return false; }

      // Server mode: ask the database whether anyone else has saved. The rev
      // endpoint returns a single number, so this poll stays cheap however big
      // the document gets; only a real change pulls the document down.
      if (server.enabled) {
        var id = currentOrgId;
        getJSON('/workspace/rev?org=' + encodeURIComponent(id) + modQ(id), function (d) {
          if (!d) { setOnline(false); done(false); return; }
          setOnline(true);
          if (d.rev <= (server.revs[id] || 0)) { done(false); return; }
          getJSON('/workspace?org=' + encodeURIComponent(id) + modQ(id), function (w) {
            if (w && w.doc) { adoptDoc(id, w.doc, w.rev, w.updated_by); done(true); return; }
            done(false);
          });
        });
        return false; // asynchronous: adoptDoc() repaints when the answer lands
      }

      if (orgRev(currentOrgId) > ((data && data.rev) || 0)) { var r = refreshOrg(); done(!!r); return r; }
    } catch (e) { }
    done(false);
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
  function ready(cb) {
    // file:// — no API to call; localStorage is the whole store, as it always was.
    if (!server.enabled) { cb(); return; }

    // Warm the cache the synchronous getters serve from: the org registry, and
    // the active org's workspace. bootApp() runs inside cb() and reads both
    // through getOrgs()/orgRaw() without knowing they came off the network.
    getJSON('/organizations', function (d) {
      if (d && d.organizations) {
        server.orgs = d.organizations.map(function (o) {
          server.dbOrgs[o.id] = o;
          return orgRecord(o);
        });
        writeJSON(ORGS_KEY, server.orgs); // mirror, so an offline reload still lists them
      } else {
        setOnline(false); // fall through on the cached registry
      }

      /* Order matters: the registry lands BEFORE the workspace request below,
         and modQ() reads accountType() out of it to decide which module it may
         ask for. Fetch the document first and a Leader account would request an
         Enterprise workspace and be refused. */
      var id = rawGet(CURRENT_ORG_KEY);
      if (!id) { cb(); return; }

      getJSON('/workspace?org=' + encodeURIComponent(id) + modQ(id), function (w) {
        if (w && w.doc) {
          server.revs[id] = w.rev;
          /* The mirror is not always behind the server. A reload inside the
             600ms save window — or after a session that ended offline — leaves
             edits on disk that never reached the database, and overwriting the
             mirror with the server's copy here is the same data loss the poll
             used to cause, just at boot. Compare the three documents instead;
             with nothing unsent the merge returns the server's copy unchanged,
             which is the ordinary case and costs one comparison. */
          var mirrored = readJSON(orgKey(id), null);
          var confirmed = getBase(id);
          if (mirrored && confirmed && !sameContent(mirrored, confirmed)) {
            var res = mergeDocs(confirmed, mirrored, w.doc);
            server.docs[id] = res.doc;
            setBase(id, w.doc);
            writeJSON(orgKey(id), res.doc);
            if (!sameContent(res.doc, w.doc)) scheduleFlush(id);   // send what never made it
            if (res.conflicts.length) reportConflicts(id, res.conflicts);
          } else {
            server.docs[id] = w.doc;
            setBase(id, w.doc);
            writeJSON(orgKey(id), w.doc);
          }
        } else if (w) {
          // The org exists but has never been saved (rev 0). Leave the cache
          // empty: readOrg() falls back to the local mirror, and the sign-in
          // path seeds a workspace from the org's DB members
          // (openOrgWorkspace in js/features/org-admin.js).
          server.revs[id] = 0;
        } else {
          setOnline(false);
        }
        cb();
      });
    });
  }

  return {
    raw: { get: rawGet, set: rawSet, del: rawDel },
    /* Which program a request is about. Exported because the workspace is no
       longer the only per-program thing on the wire: notes and team chat are
       scoped to a module now too, and all three must name it the same way — the
       URL's module, corrected to one this account can actually open. A second
       caller computing it from Modules.activeId() alone would file a Leader's
       notes under an Enterprise program on the launchpad's chrome load. */
    moduleId: moduleId,
    /* Connection state for the offline banner. */
    isOnline: function () { return server.online; },
    isServerMode: function () { return server.enabled; },
    /* The org as the database knows it (details + members) — used to seed a
       workspace for an org that has never been saved. */
    dbOrg: function (id) { return server.dbOrgs[id] || null; },
    /* Update the cached organization record in place. Organization details are
       read from this cache (orgDetails, js/features/org-admin.js), so an edit
       that only reached the server would not show until the next page load —
       and a draft that has not been sent yet would not show at all. */
    patchDbOrg: function (id, patch) {
      var o = server.dbOrgs[id];
      if (!o || !patch) return;
      for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) o[k] = patch[k];
    },
    dbUsers: function (id) { return (server.dbOrgs[id] || {}).users || []; },

    /* Pull an organization's workspace into the cache, then cb(hasWorkspace).
       ANY path that is about to read or seed an org's data must go through this
       first. readOrg() alone cannot tell "this org has no workspace yet" from
       "I haven't fetched it yet" — both look like null — and mistaking the
       second for the first seeds a blank document straight over the team's
       work. cb(false) means the org genuinely has no workspace and it is safe
       to create one. */
    loadOrg: function (id, cb) {
      if (!server.enabled) { cb(!!readJSON(orgKey(id), null)); return; }
      if (Object.prototype.hasOwnProperty.call(server.docs, id)) { cb(true); return; }
      getJSON('/workspace?org=' + encodeURIComponent(id) + modQ(id), function (w) {
        if (!w) {
          // Offline. Fall back to the mirror, and never report "no workspace"
          // from a failed fetch — that is what would trigger a blank seed.
          setOnline(false);
          var cached = readJSON(orgKey(id), null);
          if (cached) { server.docs[id] = cached; cb(true); return; }
          cb(true); // unknown: refuse to seed rather than risk a clobber
          return;
        }
        setOnline(true);
        server.revs[id] = w.rev || 0;
        if (w.doc) { server.docs[id] = w.doc; setBase(id, w.doc); writeJSON(orgKey(id), w.doc); cb(true); return; }
        cb(false);
      });
    },
    /* Force a re-read of the org registry (after creating/deleting an org). */
    refreshOrgs: function (cb) {
      if (!server.enabled) { if (cb) cb(); return; }
      getJSON('/organizations', function (d) {
        if (d && d.organizations) {
          server.orgs = d.organizations.map(function (o) {
            server.dbOrgs[o.id] = o;
            return orgRecord(o);
          });
          writeJSON(ORGS_KEY, server.orgs);
        }
        if (cb) cb();
      });
    },
    orgKey: orgKey,
    readOrg: readOrg, orgRaw: orgRaw, writeOrg: writeOrg, removeOrg: removeOrg, commitSeed: commitSeed,
    flushNow: flushNow,
    patch: patch, setPath: setPath, removeRec: removeRec, commit: commit, persistActive: persistActive,
    dirtyRecords: function () { return Object.keys(_dirty); }, clearDirty: function () { _dirty = {}; },
    refreshOrg: refreshOrg, orgRev: orgRev, checkRemote: checkRemote, startChangeSignal: startChangeSignal, ready: ready,
    /* Who changed what, and when — the server-side record. See
       api/sql/workspace-history.sql for why the browser stopped keeping its
       own. */
    history: history,
    mergeDirtyInto: mergeDirtyInto, handleStaleWrite: handleStaleWrite,
    /* The three-way merge every server-side adoption goes through, and the
       structural equality it is built on. Exported so the merge rules can be
       asserted directly on documents, without a server and without a clock —
       see the MERGE block in tools/_unused/harness.js. */
    mergeDocs: mergeDocs, deepEq: deepEq,
    /* The "your saved edit was replaced" side of the merge. Three separate
       pieces because each is worth testing on its own: the leaf walk, the
       ledger of what we sent, and the question asked of an adoption. */
    leafDiff: function (a, b) { return leafDiff(a, b, [], [], 0); },
    noteAuthored: noteAuthored, authoredOverwrites: authoredOverwrites,
    /* The whole take-in path, so the tests can pin the WIRING and not only the
       parts: a document arriving is what has to produce the report, and the
       three pieces above can each be right while nothing calls them. Only the
       poll and the 409 branch use it in the app. */
    adoptDoc: adoptDoc,
    authoredCount: function () { pruneAuthored(); return Object.keys(_authored).length; },
    forgetAuthored: function () { _authored = {}; },
    /* What the server is known to hold for an org. Read by the tests; set only
       from the paths that actually learn it (a fetch, a 200, an adoption). */
    confirmedBase: function (id) { return getBase(id); },
    schemaVersion: function () { return SCHEMA_VERSION; },
    /* The org registry. In server mode this is the database's list (warmed by
       ready()), which is what makes the admin console and sign-in show the same
       organizations in every browser. Falls back to the mirror when the fetch
       failed, so an offline reload still works. */
    getOrgs: function () {
      if (server.enabled && server.orgs) return server.orgs;
      return readJSON(ORGS_KEY, []);
    },
    setOrgs: function (list) {
      if (server.enabled) server.orgs = list; // keep the cache authoritative
      return writeJSON(ORGS_KEY, list);
    },
    getCurrentOrg: function () { return rawGet(CURRENT_ORG_KEY); },
    setCurrentOrg: function (id) { id ? rawSet(CURRENT_ORG_KEY, id) : rawDel(CURRENT_ORG_KEY); },
    getRemember: function () { return readJSON(REMEMBER_KEY, null); },
    setRemember: function (o) { o ? writeJSON(REMEMBER_KEY, o) : rawDel(REMEMBER_KEY); },
    getSession: function () { var s = sessGet(SESSION_KEY); if (s == null) return null; try { return JSON.parse(s); } catch (e) { return null; } },
    setSession: function (o) { o ? sessSet(SESSION_KEY, JSON.stringify(o)) : sessDel(SESSION_KEY); },
    /* A one-shot request that survives exactly one page load: sign-up finishes
       on the entry screen and asks for Profile, but Profile is part of a
       program's chrome — it can only open on the far side of the navigation
       into one. sessionStorage, so it dies with the tab; taken (and cleared) on
       the first read, so a later refresh never reopens the panel. */
    setOpenProfile: function (on) { on ? sessSet(OPEN_PROFILE_KEY, '1') : sessDel(OPEN_PROFILE_KEY); },
    takeOpenProfile: function () { var v = sessGet(OPEN_PROFILE_KEY); if (v != null) sessDel(OPEN_PROFILE_KEY); return v === '1'; },
    getPref: function (name, f) { var v = rawGet(prefKey(name)); return v == null ? f : v; },
    setPref: function (name, v) { rawSet(prefKey(name), v); },
    legacyRaw: function () { return rawGet(LEGACY_KEY); }
  };
})();


/* ═══════════════════════════════════════════════════════════════
   MULTI-ORG TENANCY — each organization has its own isolated data
   environment (key: pipeline-org-data::<orgId>). A registry lists
   all orgs (pipeline-orgs). currentOrgId selects the active one.
   ═══════════════════════════════════════════════════════════════ */
var ORGS_KEY = 'pipeline-orgs';
function getOrgs() { return Store.getOrgs(); }

function saveOrgs(list) { Store.setOrgs(list); }
function getOrg(id) { return getOrgs().filter(function (o) { return o.id === id; })[0] || null; }
/* Which role space this account lives in — 'enterprise' or 'leader'. The
   organization is the tenant in both cases (a Leader account is an organization
   of one), so the answer hangs off the org record, refreshed from the database
   on every load. It decides which six modules the launchpad offers, which URL
   space the app lands in after sign-in, and — enforced for real, server-side —
   which workspaces the API will open (WorkspaceController::moduleFrom).
   Unknown means enterprise: every account that predates roles was one. */
function accountType(orgId) {
  var o = getOrg(orgId || currentOrgId);
  return (o && o.accountType) || (window.Modules ? Modules.DEFAULT_ROLE : 'enterprise');
}

/* ── Which programs this browser may open ────────────────────────────────
   The role space says which SIX programs an account could have; these two say
   which of them it actually does. Both are client-side conveniences — the
   authoritative answer is Core\Controller::moduleFrom, which re-derives it from
   org_modules and user_modules on every request. What these buy is a launchpad
   that shows the truth and a switcher that does not offer a door it knows is
   locked; nothing here is a security boundary.

   The intersection is the same one the server computes: an organization's pool
   AND the signed-in member's grant. Two members of the same organization can
   see different programs.

   UNKNOWN IS NOT NONE. An older API response, or a localStorage mirror written
   before entitlements existed, carries no `modules` at all. Treating that as an
   empty grant would empty the launchpad for everyone mid-deploy, so a missing
   list falls back to the whole role space and lets the server be the one to
   refuse anything. A present-but-empty list is a real answer and is honoured. */
function orgModules(orgId) {
  var o = getOrg(orgId || currentOrgId);
  var mine = (o && o.modules) || null;
  if (mine && mine.length !== undefined) return mine;
  return (window.Modules ? Modules.list(accountType(orgId)) : []).map(function (m) { return m.id; });
}

function grantedModules(orgId) {
  var pool = orgModules(orgId);
  var u = getCurrentUser();
  /* No one signed in yet (boot, the entry screens): the organization's pool is
     the most anyone in it can have, and is the right answer for chrome. */
  if (!u || !u.modules || u.modules.length === undefined) return pool;
  return pool.filter(function (id) { return u.modules.indexOf(id) >= 0; });
}

/** True when the signed-in account may open a given program. */
function canOpenModule(moduleIdent, orgId) {
  if (typeof isAppAdmin !== 'undefined' && isAppAdmin) return true;   // the console reaches everywhere
  return grantedModules(orgId).indexOf(moduleIdent) >= 0;
}
var currentOrgId = null; // assigned in bootApp() – reading the store is a boot-time act (async loader, July 8)
function setCurrentOrg(id) { currentOrgId = id; Store.setCurrentOrg(id); }
/* ═══════════════════════════════════════════════════════════════
   USERS & AUTH — multi-user identity system (no password, just pick
   who you are). Same model as the AI-Ready Architecture app.
   ═══════════════════════════════════════════════════════════════ */
var DEFAULT_ROSTER = [
  { id: 'u1', name: 'Faisal Hoque', username: 'faisal', role: 'Program Lead', initials: 'FH', color: '#B8892A', scope: 'All', admin: true },
  { id: 'u2', name: 'Lauren Hawker Zafer', username: 'lauren', role: 'Co-Host', initials: 'LZ', color: '#4866A0', scope: 'CONVERGENCE' },
  { id: 'u3', name: 'Paul Scade', username: 'paul', role: 'Facilitator', initials: 'PS', color: '#458363', scope: 'Philosophy' },
  { id: 'u4', name: 'Pranay Sanklecha', username: 'pranay', role: 'Facilitator', initials: 'PrS', color: '#8158A0', scope: 'Ethics' },
  { id: 'u5', name: 'Erik Nelson', username: 'erik', role: 'Facilitator', initials: 'EN', color: '#8B5E3C', scope: 'Operations' },
  { id: 'u6', name: 'Tom Davenport', username: 'tom', role: 'Advisor', initials: 'TD', color: '#6B4C8A', scope: 'Research' }
];
// USERS holds the ACTIVE org's roster; populated by applyTeamRoster() on load/switch.
var USERS = [];

/* ═══════════════════════════════════════════════════════════════
   CLAUDE API ENDPOINT
   ─────────────────────────────────────────────────────────────
   Our own server, which holds the API key and forwards the request:
   api/controllers/ClaudeController.php, routed as POST /claude.

   It has to be. Every reference build shipped pointing straight at
   https://api.anthropic.com/v1/messages, which works only inside
   Anthropic's hosted environment — that one injects the key and
   answers CORS. Served from anywhere else, the browser refuses the
   request before it leaves the page ("blocked by CORS policy"), and
   every AI feature in every program fails the same way: the AI
   Guide, The Decision Lab's Challenge card and decision profile,
   The Ethics Engine's profile. The reference's own header said to
   put a proxy here; this is that proxy.

   Relative on purpose. It resolves against <base href="/apps/">, so
   the install directory stays configurable and the request is
   same-origin — no CORS to answer, and no key on the page.

   The MODEL is the server's choice, not this file's — see
   api/config/claude.php. Callers still send a `model` in the body
   (the generated program.js files do, and they are regenerated);
   the endpoint ignores it.
   ═══════════════════════════════════════════════════════════════ */
var CLAUDE_API_URL = 'api/claude';

var currentUserId = null; // session-only: entry flow runs on each cold start
var isAppAdmin = false;    // true only for the app administrator's session (username + password, Part 5.12)

var AUTH_ENDPOINT = ''; // kept for older call sites; every request goes to API_BASE (below)
/* Base URL of the PHP + MySQL API (apps/api/). Relative, so it resolves against
   the page's <base href> — the install directory, whatever it is, and NOT the
   current route. That matters: routes go four segments deep
   (/apps/leaders/x/step/1.2), and without the <base> the shell writes into
   index.php, this would resolve to .../step/api. See apps/index.php. */
var API_BASE = 'api';

/* ═══════════════════════════════════════════════════════════════
   PASSWORDS (Directive 2 Oct 2026, Parts 5 and 6; live 6 Oct 2026)
   ═══════════════════════════════════════════════════════════════
   The browser shows the screens, checks a proposed password against the rule
   so people get an immediate answer, sends it to the server, and never keeps
   it. The server (api/core/Password.php) applies the same rule again with the
   full common-password list, stores Argon2id hashes, and answers every sign-in
   with a session cookie (HttpOnly, SameSite=Strict) — so nothing in this page,
   in sessionStorage or in localStorage can sign anybody in. The records this
   page still keeps (Store.setSession / setRemember) only say which workspace to
   open; the server is asked at start-up whether they still stand (bootApp). */
var PASSWORD_MIN_LENGTH = 8;
var PASSWORD_MAX_LENGTH = 128;
var COMMON_PASSWORDS = ['password1!', 'password123!', 'p@ssw0rd', 'p@ssword1', 'pa$$w0rd', 'pa$$word1', 'passw0rd!', 'welcome1!', 'welcome123!', 'admin123!', 'admin@123', 'qwerty123!', 'qwerty1!', 'abc123!@#', 'changeme1!', 'letmein1!', 'iloveyou1!', 'monkey123!', 'dragon123!', 'football1!', 'baseball1!', 'sunshine1!', 'princess1!', 'test123!', 'user123!', 'hello123!', 'secret123!', 'company1!', '1q2w3e4r!', '1qaz2wsx!', 'zaq1@wsx', '!qaz2wsx', 'summer2025!', 'winter2025!', 'summer2026!', 'winter2026!', 'spring2026!', 'autumn2026!', 'fall2026!', 'nextchapter1!', 'nextchapter2026!'];
var PASSWORD_RULE_TEXT = 'At least 8 characters, including a number and a special character such as ! or #.';
function passwordLength(pw) { return Array.from(String(pw == null ? '' : pw)).length; }
/** '' when the password meets the rule (5.1), else what to say. */
function passwordProblem(pw) {
  pw = String(pw == null ? '' : pw);
  var n = passwordLength(pw);
  if (n < PASSWORD_MIN_LENGTH) return 'Use at least ' + PASSWORD_MIN_LENGTH + ' characters.';
  if (n > PASSWORD_MAX_LENGTH) return 'Use no more than ' + PASSWORD_MAX_LENGTH + ' characters.';
  if (!/[0-9]/.test(pw)) return 'Include at least one number.';
  if (!/[^\p{L}\p{N}\s]/u.test(pw)) return 'Include at least one special character, such as ! or #.';
  if (COMMON_PASSWORDS.indexOf(pw.toLowerCase()) >= 0) return 'That password is too common. Choose another.';
  return '';
}
/* The server's refusals in Appendix A's words. 'no-user' and 'bad-password'
   read alike on purpose (A.5.3): the screen must not say which usernames exist. */
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
  if (r === 'not-admin' || r === 'forbidden') return 'Only the organization administrator can do that.';
  if (r === 'network') return 'Could not reach the sign-in service. Try again.';
  return (res && res.message) || 'Could not reach the sign-in service. Try again.';
}

var Auth = (function () {
  /* One request each (Part 6.2), calling back with the server's data plus ok,
     or {ok:false, reason, message, errors}. A failure to reach the server is
     {ok:false, reason:'network'} — and NEVER a sign-in: there is no offline
     door any more, because the browser holds no password to check one against. */
  function req(method, path, body, cb) {
    var done = false;
    function fin(r) { if (done) return; done = true; if (cb) { try { cb(r); } catch (e) { try { console.error(e); } catch (_e) { } } } }
    try {
      var o = { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
      if (body !== undefined) o.body = JSON.stringify(body);
      if (path === '/sign-out') o.keepalive = true;   /* signing out navigates at once; the request must outlive the page */
      fetch(API_BASE + path, o)
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j || {} }; }, function () { return { status: r.status, body: {} }; }); })
        .then(function (res) {
          var b = res.body || {};
          if (res.status >= 200 && res.status < 300 && b.success) {
            var d = b.data || {}; var out = {}; for (var k in d) { if (d.hasOwnProperty(k)) out[k] = d[k]; }
            if (out.ok === undefined) out.ok = true;
            fin(out); return;
          }
          fin({ ok: false, status: res.status, reason: b.reason || (res.status === 401 ? 'signed-out' : 'error'), message: b.message || '', errors: b.errors || null, retryAfterMinutes: b.retryAfterMinutes });
        }, function () { fin({ ok: false, reason: 'network' }); });
    } catch (e) { fin({ ok: false, reason: 'network' }); }
  }

  /* -- sign-in: a username and a password -- (POST /session)
     ── THE IDENTITY IS THE SERVER'S, NOT A SEARCH ─────────────────────────
     The ids come back from the server (orgId, userId — both public ids) and
     are matched EXACTLY against this device's workspaces (openVerified). A
     username is never searched on; it is only ever a fallback WITHIN the
     organization the server named, for a workspace whose roster predates
     server links.

     A temporary password, or a stored one that breaks the rule (an old PIN),
     signs in with mustChange: the server refuses everything else until it is
     replaced (6.1.6), so nothing is opened here yet — the caller shows Choose
     a new password, and calls openVerified once that has been saved.

     `accountType` is the role space of the door (auth.js roleKey()). It is not
     a credential and the server ignores it; Router.landAfterAuth uses it. */
  function signIn(username, password, remember, cb, accountType) {
    req('POST', '/session', { username: username, password: password, remember: !!remember }, function (res) {
      if (!res || !res.ok) return cb(res || { ok: false, reason: 'network' });
      if (res.mustChange) return cb({ ok: true, mustChange: true, data: res });
      openVerified(res, cb);
    });
  }

  /* Open the workspace a verified sign-in names, building it from the database
     when this device has none (fresh browser / incognito). */
  function openVerified(data, cb) {
    var ids = serverIdsOf(data);
    /* Hand the verified identity to the store BEFORE anything asks the database
       for this organization's workspace. See workspaceActorId. */
    try { setVerifiedActor(ids.orgId, ids.userId); } catch (e) { }
    var local = findLocalUserByServerIds(ids.orgId, ids.userId, (data && data.user && data.user.username) || '');
    if (local) {
      try { linkLocalToServer(local, data); } catch (e) { } // back-fill serverId links
      return cb({ ok: true, orgId: local.orgId, userId: local.userId });
    }
    hydrateLocalOrgFromServer(data, function (built) {
      if (built && built.orgId) return cb({ ok: true, orgId: built.orgId, userId: built.userId });
      return cb({ ok: false, reason: 'no-local' });
    });
  }

  /** The public ids the sign-in response named, as {orgId, userId}. */
  function serverIdsOf(data) {
    return {
      orgId: (data && ((data.organization && data.organization.id) || data.orgId)) || '',
      userId: (data && ((data.user && data.user.id) || data.userId)) || ''
    };
  }

  /* -- the app administrator: a username and a password (5.12) --
     The account exists from installation (admin / NextChapter2026!, which works
     once). Every Super Admin action is authorised by the session this starts —
     nothing is re-sent with each request any more. */
  function signInAdmin(username, password, cb) { req('POST', '/admin-session', { username: username, password: password }, cb); }
  function currentSession(cb) { req('GET', '/session', undefined, cb); }
  function changePassword(current, next, cb) { req('POST', '/password', { current: current, next: next }, cb); }
  function changeAdminPassword(current, next, cb) { req('POST', '/admin/password', { current: current, next: next }, cb); }
  function changeAdminUsername(username, cb) { req('POST', '/admin/username', { username: username }, cb); }
  /* An organization administrator (or the app administrator) gives a member a
     temporary password; the member chooses their own at their next sign-in (5.7). */
  function setTemporaryPassword(orgId, userId, temporary, cb) { req('POST', '/admin/temporary-password', { orgId: orgId, userId: userId, temporary: temporary }, cb); }
  /* End the server session. Callback-shaped so a caller can navigate after it. */
  function serverSignOut(cb) { req('POST', '/sign-out', {}, cb || function () { }); }

  /* -- kept for generated program code that still calls them (no passwords live in the roster any more) -- */
  function defaultPasscode() { return ''; }
  function ensurePasscode(u) { if (u) delete u.passcode; return u; }

  /* -- this page's view of the session -- */
  function setSession(userId) { currentUserId = userId; }
  /* What gets written to sessionStorage / "remember me": which workspace to
     open, never a credential. The serverId is the same person in every program,
     and is what lets a session made in one be honoured in the next
     (sessionRosterId, in bootApp). */
  function sessionRecord(orgId, userId) {
    var u = (typeof USERS !== 'undefined' ? USERS : []).filter(function (x) { return x.id === userId; })[0];
    var rec = { orgId: orgId, userId: userId };
    if (u && u.serverId) rec.serverId = u.serverId;
    return rec;
  }
  function setAdminSession(on) { isAppAdmin = !!on; }
  function clearSession() { currentUserId = null; isAppAdmin = false; try { setVerifiedActor(null, null); } catch (e) { } try { Store.setRemember(null); } catch (e) { } try { Store.setSession(null); } catch (e) { } }

  return {
    signIn: signIn, openVerified: openVerified, signInAdmin: signInAdmin, currentSession: currentSession,
    changePassword: changePassword, changeAdminPassword: changeAdminPassword, changeAdminUsername: changeAdminUsername,
    setTemporaryPassword: setTemporaryPassword, serverSignOut: serverSignOut,
    defaultPasscode: defaultPasscode, ensurePasscode: ensurePasscode,
    setSession: setSession, setAdminSession: setAdminSession, clearSession: clearSession,
    sessionRecord: sessionRecord
  };
})();

function getCurrentUser() {
  return USERS.find(function (u) { return u.id === currentUserId }) || null;
}

/* Org-level authority: the app admin, or the signed-in user whose roster record
   is the administrator (admin:true). Only they may add/edit/remove team members
   or edit organization details. Everyone else gets a read-only view. */
function canManageOrg() {
  if (isAppAdmin) return true;
  var u = getCurrentUser();
  return !!(u && u.admin === true);
}
/* A member may edit their OWN profile even if they can't manage the org. */
function canEditMember(id) { return canManageOrg() || id === currentUserId; }
/* The acting user's server id, sent with mutating requests so the API can verify
   the caller is the organization's administrator. */
function actorId() { var u = getCurrentUser(); return (u && u.serverId) ? u.serverId : ''; }

/* Who the server records as the author of a workspace save, and authorizes the
   write against (they must belong to the organization).

   Normally that is the signed-in member. But the very first save for an
   organization can happen before anyone is signed in — an admin seeding a
   workspace from the console, or setup writing the owner's roster a beat before
   Auth.setSession() runs — so fall back to the organization's administrator
   from the roster we are about to save. Returns '' when neither is known yet,
   which makes the flush skip and retry on the next edit rather than 403.

   ── WHY IT ALSO READS THE SESSION RECORD ──────────────────────────────
   Every workspace request carries this, READS INCLUDED (Store.actorQ), and the
   server refuses one without it (Core\Controller::requireOrgMember). The two
   sources above are both unavailable at exactly the moment that matters most:

     · signing in on a browser that has no copy of this organization — a new
       device, a private window, cleared storage, or simply a colleague's first
       visit. There is no roster on disk to read an administrator out of, and
       Auth.setSession() has not run yet, so the fetch that is supposed to bring
       the team's document down went out with no actor and came back 403;
     · the load straight after that sign-in. Store.ready() fetches the workspace
       BEFORE bootApp() restores the session, so getCurrentUser() is still null
       and the roster on disk is still the one that fetch was meant to write.

   Both answered "" — and the app then came up with an empty document over a
   workspace the database was holding in full. What followed was the data loss
   this exists to prevent: the first ordinary write posted that empty document
   with no base_rev and replaced the team's program (see flushOrg).

   The identity is never guessed. It is either one the server has just verified
   on this page (_verifiedActor, set from the /session response) or the stored
   session's, and both are accepted only after the organization's own member
   list — fetched from the database moments earlier, GET /organizations — is
   found to contain them. A local-only workspace, whose ids the database has
   never heard of, still answers "" exactly as before. */
var _verifiedActor = null;
/* The identity the server has just verified, for the window between the
   /session response and Auth.setSession(). Cleared on sign-out. */
function setVerifiedActor(orgId, userId) {
  _verifiedActor = (orgId && userId) ? { orgId: orgId, userId: userId } : null;
}

/* A public id this organization's DATABASE member list actually contains, or ''.
   The registry is warmed by GET /organizations, which returns each organization
   with its users, so this costs no request. Unknown organization (offline, or a
   purely local workspace) → '', never a guess. */
function knownOrgMemberId(orgId, candidate) {
  if (!candidate) return '';
  try {
    var dbOrg = Store.dbOrg(orgId);
    var users = (dbOrg && dbOrg.users) || [];
    for (var i = 0; i < users.length; i++) if (users[i].public_id === candidate) return candidate;
  } catch (e) { }
  return '';
}

function workspaceActorId(orgId) {
  var me = actorId();
  if (me) return me;
  /* Verified on this page a moment ago, and about to become the session. */
  if (_verifiedActor && _verifiedActor.orgId === orgId) {
    var v = knownOrgMemberId(orgId, _verifiedActor.userId);
    if (v) return v;
  }
  /* The stored session, for the load that follows a sign-in — and for every
     refresh, where Store.ready() runs ahead of bootApp(). A record carries the
     local roster id and, since the server links were added, the public id
     beside it; either may be the one the database knows. */
  var recs = [];
  try { var s = Store.getSession(); if (s && !s.admin && s.orgId === orgId) recs.push(s); } catch (e) { }
  try { var r = Store.getRemember(); if (r && r.orgId === orgId) recs.push(r); } catch (e) { }
  for (var i = 0; i < recs.length; i++) {
    var hit = knownOrgMemberId(orgId, recs[i].serverId) || knownOrgMemberId(orgId, recs[i].userId);
    if (hit) return hit;
  }
  var d = Store.readOrg(orgId);
  var roster = (d && d.roster) || [];
  var linked = roster.filter(function (u) { return u.serverId; });
  var admin = linked.filter(function (u) { return u.admin === true; })[0];
  return (admin || linked[0] || {}).serverId || '';
}

/* Store calls this when the connection to the database goes down or comes back,
   so the user always knows whether their work is actually being saved. */
function onConnectionChange(online) {
  var bar = document.getElementById('offlineBar');
  if (online) {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offlineBar';
    bar.className = 'offline-bar';
    bar.innerHTML = '<span class="offline-dot">●</span> Offline — your recent changes are not saved yet. Retrying…';
    document.body.appendChild(bar);
  }
}

/* Called by the store when a sync merge found the same thing edited on both
   sides (Store.mergeDocs). The local value was kept and the other writer's went
   with the merge — so something WAS lost, from the other person's side of it,
   and the reader is the only one in a position to notice.

   This used to be a 2.4-second toast reading "another member edited 2 things you
   were also changing — your version was kept". True, and useless: it named
   neither the fields nor the values, so by the time anyone wondered what had
   happened there was nothing left to look at. It now hands the collision to the
   sync report (js/features/collab-notices.js), which names each field, shows
   both values side by side, and offers to put the other person's back.

   `deleted-remotely` is included and reads honestly: they removed the thing, our
   edit to it survived, and that is worth a line. `deleted-locally` is the
   mirror — our delete stood over their edit — and their text is what was lost,
   so it is shown as such. */
function onSyncConflict(conflicts) {
  try {
    if (!conflicts || !conflicts.length) return;
    var rows = conflicts.map(function (c) {
      var mine = c.mine, theirs = c.theirs;
      if (c.kind === 'deleted-remotely') theirs = undefined;   // they removed it
      if (c.kind === 'deleted-locally') mine = undefined;      // we removed it
      return {
        kind: 'kept',
        label: (typeof collabPathLabel === 'function') ? collabPathLabel(c.path) : String(c.path || ''),
        keys: c.keys || null,
        mine: mine, theirs: theirs, restore: theirs
      };
    });
    if (typeof showSyncReport === 'function') { showSyncReport(rows); return; }
    if (typeof showToast === 'function') showToast('Another member edited something you were also changing — your version was kept.', 'error');
  } catch (e) { }
}

/* The other half, and the one nobody was ever told about: a value THIS browser
   saved has been changed by somebody else who was holding an older copy. The
   merge is right to be silent — from its point of view only they moved it — so
   the store keeps a short ledger of what we sent and asks the question directly
   (Store.authoredOverwrites). What was lost is our own text, so the report keeps
   it and offers to put it back rather than leaving the reader to remember what
   they had written. */
/* A member's display name from the stable id the SERVER knows them by — the
   public_id it stamps on every workspace save. USERS is keyed by this device's
   local ids and carries the server id alongside (serverId), which is the same
   join assignmentsLoad() makes. Empty for an id this roster does not have:
   better to say a change was replaced than to name the wrong person. */
function memberNameByServerId(pub) {
  if (!pub) return '';
  var u = (typeof USERS !== 'undefined' && USERS || []).filter(function (x) {
    return x && (x.serverId === pub || x.id === pub);
  })[0];
  return (u && u.name) ? u.name : '';
}

function onRemoteOverwrite(items, orgId, by) {
  try {
    if (!items || !items.length) return;
    /* Who actually wrote it. The server records the author of every save
       (workspaces.updated_by) and hands it back with the document, so this is
       the member who really replaced the value.

       It used to be inferred from who happened to hold a lock at the moment the
       notice was raised — which named the wrong person whenever somebody else
       was editing something unrelated, and named nobody at all in the ordinary
       case, where the writer had finished and let go before the poll came
       round. The lock is still the fallback for a payload that carries no
       author (an older deployment). */
    var who = '';
    try { who = memberNameByServerId(by); } catch (e) { }
    if (!who) {
      try { var others = Collab.othersLocks(); if (others.length === 1) who = others[0].name || ''; } catch (e) { }
    }
    var rows = items.map(function (it) {
      return {
        kind: 'replaced',
        label: (typeof collabPathLabel === 'function') ? collabPathLabel(it.path) : String(it.path || ''),
        keys: it.keys || null, who: who,
        mine: it.lost, theirs: it.incoming, restore: it.lost
      };
    });
    if (typeof showSyncReport === 'function') {
      showSyncReport(rows);
      /* …and then correct "yours, gone" from the record. `it.lost` comes from
         the browser's own ledger of what it sent — good enough to notice that
         something happened, and not a source of truth: it is capped, it expires
         after twenty minutes, and it is emptied by the very report it feeds, so
         after the first collision on a field it has nothing more to say and the
         line stood still while the member went on working. The server knows
         what this member last saved there (workspace_revisions), so ask it. */
      refreshOverwriteFromHistory(orgId, rows);
      return;
    }
    if (typeof showToast === 'function') showToast('A change you had saved was replaced by another member.', 'error');
  } catch (e) { }
}

/* ── Keeping an open notice true ──────────────────────────────────
   Both of its lines are about a moving target: "now stored" is the document,
   which anybody may change, and "yours, gone" is the last change THIS member
   made to that field, which moves whenever they save again. Fetched once when
   the collision fired, both went stale while the panel sat there — and the
   panel does not close itself.

   So the arriving-change path refreshes both. The local-write path refreshes
   only the document side (Store.writeOrg), because that one runs on every
   keystroke that commits and must not put a request on the wire.

   Throttled, because a busy workspace repaints every five seconds and the
   answer does not change that fast. */
var _noticeHistoryAt = 0;
var NOTICE_HISTORY_MS = 4000;
function collabNoticeSync() {
  try {
    if (typeof collabReportRefresh === 'function') collabReportRefresh();
    var rows = (typeof _collabReportRows !== 'undefined') ? _collabReportRows : null;
    if (!rows || !rows.length) return;
    var open = rows.filter(function (r) { return r.kind === 'replaced' && r.keys && r.keys.length; });
    if (!open.length) return;
    var now = Date.now();
    if (now - _noticeHistoryAt < NOTICE_HISTORY_MS) return;
    _noticeHistoryAt = now;
    refreshOverwriteFromHistory(null, open);
  } catch (e) { }
}

/* The last change THIS member made to each reported field, taken from the
   history and written back into the open notice.
   Best-effort by design: the notice is already on screen and already broadly
   right, so a history that cannot be reached leaves it exactly as it was. */
function refreshOverwriteFromHistory(orgId, rows) {
  try {
    var id = orgId || (typeof currentOrgId !== 'undefined' ? currentOrgId : null);
    var me = (typeof workspaceActorId === 'function') ? workspaceActorId(id) : '';
    if (!id || !me || !rows || !rows.length) return;
    Store.history(id, { actor: me, limit: 25 }, function (entries) {
      if (!entries || !entries.length) return;
      var moved = false;
      rows.forEach(function (r) {
        if (!r.keys || !r.keys.length) return;
        var section = String(r.keys[0]);
        for (var i = 0; i < entries.length; i++) {          // newest first
          var ch = entries[i].changed;
          if (!ch || !Object.prototype.hasOwnProperty.call(ch, section)) continue;
          var v = readAtKeys(ch[section].after, r.keys.slice(1));
          if (v === undefined) break;                        // it is theirs, not ours
          if (!Store.deepEq(v, r.mine)) { r.mine = v; r.restore = v; moved = true; }
          break;
        }
      });
      if (moved && typeof renderCollabReport === 'function') renderCollabReport();
    });
  } catch (e) { }
}

/* Walk a value by the descriptor path the diff builds, minus its first segment
   (which named the section the value already IS). */
function readAtKeys(value, keys) {
  var cur = value;
  for (var i = 0; i < keys.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    var k = keys[i];
    if (k && typeof k === 'object' && k.id != null) {
      if (!Array.isArray(cur)) return undefined;
      var hit;
      for (var j = 0; j < cur.length; j++) { if (cur[j] && String(cur[j].id) === String(k.id)) { hit = cur[j]; break; } }
      cur = hit;
    } else {
      if (!Object.prototype.hasOwnProperty.call(cur, k)) return undefined;
      cur = cur[k];
    }
  }
  return cur;
}

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

  /* ── Where the locks live ─────────────────────────────────
     They were kept in localStorage, which made them a single browser's private
     opinion: two people on two machines each held every lock they took and saw
     none of the other's, so the one mechanism that could stop them editing the
     same record never fired between them. This file's own header said the dev
     team would repoint read()/write() at the server. This is that.

     The SHAPE is unchanged — a map of record key → {id, name, at} — because
     everything above it (lockedByOther, othersLocks, applyLockUI, the field
     guards) reads that map synchronously, on every render and every keystroke,
     and none of it can wait for a request. So the map is a CACHE of what the
     server last said, refreshed on the same 4-second tick that already beats
     the heartbeat, and every claim is applied locally at once and confirmed (or
     taken back) when the server answers.

     Fail open, deliberately. If the request fails the cache simply ages out and
     everyone can edit: a lock is there to stop two people colliding, and a lock
     service that is down must not stop one person working. */
  var _cache = {};                            // record key → {id, name, at}
  var _serverMode = false;                    // set on the first successful pull
  function lKey() { return 'pipeline-locks::' + currentOrgId; }
  function useServer() { try { return !!(Store && Store.isServerMode && Store.isServerMode()); } catch (e) { return false; } }
  function read() {
    if (useServer()) return _cache;
    try { return JSON.parse(localStorage.getItem(lKey()) || '{}'); } catch (e) { return {}; }
  }
  function write(o) {
    if (useServer()) { _cache = o || {}; return; }
    try { localStorage.setItem(lKey(), JSON.stringify(o)); } catch (e) { }
  }
  function me() { return currentUserId; }
  function sid() { return (typeof TAB_ID !== 'undefined' && TAB_ID) || 'tab'; }   /* Sweep 4R item 4: a lock belongs to this tab (session), not to the person */

  /* ── The wire ─────────────────────────────────────────────
     Locks are addressed like everything else about a workspace: organization,
     module, actor. `actorId()` is the member's server id — the same value the
     save path sends — so the server can name the holder to everyone else. */
  function wire() {
    var org = null, actor = '';
    try { org = currentOrgId; } catch (e) { }
    try { actor = (typeof actorId === 'function') ? actorId() : ''; } catch (e) { }
    if (!org || !actor || !useServer()) return null;
    var mod = 'pipeline';
    try { mod = Store.moduleId(org); } catch (e) { }
    return { org: org, actor: actor, module: mod };
  }
  function post(path, body) {
    var w = wire(); if (!w) return Promise.resolve(null);
    body.org = w.org; body.module = w.module; body.actor_id = w.actor; body.tab = sid();   /* Sweep 4R item 4 */
    try {
      return fetch(API_BASE + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }).then(function (r) { return r.json(); }).then(function (j) {
        return (j && j.success) ? j.data : null;
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  /* Replace the cache with the server's answer, keeping the local shape.
     `at` is stamped locally: the client compares it against its own clock for
     freshness, and the two machines' clocks are not the same one. */
  function adopt(locks) {
    if (!locks) return false;
    var next = {}, now = Date.now(), changed = false;
    for (var i = 0; i < locks.length; i++) {
      var l = locks[i];
      if (!l || !l.section) continue;
      next[l.section] = { id: l.mine ? me() : (l.user || l.section), sid: l.mine ? sid() : ('other:' + (l.user || '') + ':' + (l.tab || '')), name: l.name || 'Someone', at: now };   /* Sweep 4R item 4: `mine` is this tab's, as the server judged it */
    }
    changed = JSON.stringify(Object.keys(next).sort()) !== JSON.stringify(Object.keys(_cache).sort());
    _cache = next;
    _serverMode = true;
    return changed;
  }
  /* Ask the server who holds what. Called by the 4s tick, so presence appears
     within one beat of somebody else taking a field. */
  function pull(cb) {
    var w = wire(); if (!w) { if (cb) cb(false); return; }
    try {
      fetch(API_BASE + '/workspace/locks?org=' + encodeURIComponent(w.org)
        + '&module=' + encodeURIComponent(w.module) + '&actor=' + encodeURIComponent(w.actor) + '&tab=' + encodeURIComponent(sid()))
        .then(function (r) { return r.json(); })
        .then(function (j) { if (cb) cb(adopt(j && j.success ? j.data.locks : null)); })
        .catch(function () { if (cb) cb(false); });
    } catch (e) { if (cb) cb(false); }
  }
  function fresh(t) { return t && (Date.now() - t) < LOCK_TTL; }
  function holder(rk) { if (!rk) return null; var h = read()[rk]; return (h && fresh(h.at)) ? h : null; }

  /* ── The beat after a lock clears ─────────────────────────
     A released lock frees the FIELDS. The VALUES behind them come from the
     workspace document, which is refreshed on its own five-second poll — so for
     up to a beat after somebody let go, their finished sentence was in the
     database and the older one was on screen and editable. Writing there sends
     the older text back over the work they had just done: the lock did its job
     and the collision happened anyway, one second later.

     So a release is a state of its own. Between the lock clearing and this
     browser holding what they wrote, the record counts as held — by nobody in
     particular, hence the '-' id, which is nobody's user id — and that is
     enough for every guard the app already has: lockedByOther() is what
     applyLockUI, the focus handler, lockBlocked() and every module's own
     `if (Collab.lockedByOther(...)) return` all consult. Nothing else had to
     learn about this.

     Bounded by the same TTL as a real lock, so a sync that never answers cannot
     leave a section read-only: onLocksReleased() ends it on a timer as well. */
  var _settling = {};
  function beginSettle(keys, names) {
    (keys || []).forEach(function (k) { _settling[k] = { name: (names && names[k]) || 'Someone', at: Date.now() }; });
  }
  function endSettle(keys) { (keys || []).forEach(function (k) { delete _settling[k]; }); }
  function settling(rk) { var s = rk && _settling[rk]; return (s && fresh(s.at)) ? s : null; }
  function settlingLocks() {
    var out = [];
    for (var k in _settling) { if (Object.prototype.hasOwnProperty.call(_settling, k) && fresh(_settling[k].at)) out.push({ key: k, name: _settling[k].name, settling: true }); }
    return out;
  }

  function lockedByOther(rk) {
    /* Not this member's step to edit at all — a larger and older fact than any
       lock, and said HERE for the same reason the settle state above is said
       here: lockedByOther() is the one question every guard in the app already
       asks. applyLockUI, the focus handler, lockBlocked(), and the forty-odd
       handlers across the Pipeline that carry their own
       `if (Collab.lockedByOther(...)) return` all consult it, so the assignment
       rule reaches every one of them without any of them learning about it —
       and none of them can be the one that forgot.

       The marker is not a person. '~' is nobody's user id and `assigned` says
       what it is, so nothing here can print "somebody is editing this". The
       only caller that reads these fields is lockBlocked(), which refuses on
       the assignment rule before it ever reaches this line, in the right
       words. */
    if (typeof editBlocked === 'function' && editBlocked(true)) {
      return { id: '~', name: '', at: Date.now(), assigned: true };
    }
    var h = holder(rk); if (h && h.sid !== sid()) return h;
    var s = settling(rk); if (s) return { id: '-', name: s.name, at: s.at, settling: true };
    return null;
  }
  /* Take a record. Answers immediately from the cache — the caller is a focus
     handler and cannot wait — then asks the server. If the server says somebody
     else has it, the optimistic claim is taken back and the screen repainted, so
     the field the reader just entered goes read-only under them within a beat.
     That is the honest outcome: they were the second to arrive. */
  function acquire(rk) {
    if (SAMPLE_MODE || !currentOrgId || !me() || !rk) return true;
    var h = holder(rk); if (h && h.sid !== sid()) return false;
    var u = getCurrentUser() || {}, L = read();
    L[rk] = { id: me(), sid: sid(), name: u.name || 'Someone', at: Date.now() };
    write(L);
    post('/workspace/locks/claim', { sections: [rk] }).then(function (d) {
      if (!d || !d.locks || !d.locks.length) return;
      var got = d.locks[0];
      if (got.mine) return;                                  // confirmed
      _cache[rk] = { id: got.user, sid: 'other:' + (got.user || '') + ':' + (got.tab || ''), name: got.name || 'Someone', at: Date.now() };   /* Sweep 4R item 4: possibly this person's other tab */
      try {
        if (typeof applyLockUI === 'function') applyLockUI(true);
        if (typeof showToast === 'function') showToast((got.name || 'Another member') + ' is editing this section', 'error');
      } catch (e) { }
    });
    return true;
  }
  function release(rk) {
    if (SAMPLE_MODE) return;
    var L = read();
    if (rk && L[rk] && L[rk].sid === sid()) { delete L[rk]; write(L); post('/workspace/locks/release', { sections: [rk] }); }
  }
  /* The heartbeat, on the app's existing 4-second tick. Re-claiming is what
     keeps a lock alive (beat_at), and the same request re-confirms the holder,
     so a lock that was taken over while this tab was busy is noticed here too.
     The pull that follows is how everyone else's locks arrive. */
  function refreshMine() {
    if (SAMPLE_MODE || !currentOrgId || !me()) return;
    var L = read(), mineKeys = [], ch = false;
    for (var k in L) { if (L.hasOwnProperty(k) && L[k].sid === sid()) { L[k].at = Date.now(); mineKeys.push(k); ch = true; } }
    if (ch) write(L);
    if (!useServer()) return;
    if (mineKeys.length) post('/workspace/locks/claim', { sections: mineKeys });
    pull(function (changed) { if (changed) { try { applyLockUI(true); } catch (e) { } } });
  }
  function leave() {
    if (SAMPLE_MODE || !currentOrgId || !me()) return;
    var L = read(), ch = false;
    for (var k in L) { if (L.hasOwnProperty(k) && L[k].sid === sid()) { delete L[k]; ch = true; } }
    if (ch) write(L);
    if (!useServer()) return;
    /* On the way out of the tab a normal fetch is often cut off mid-flight, so
       hand it to the browser to deliver. Without this the reader's locks would
       sit until the TTL expired and their colleagues would find the section
       read-only for fifteen seconds after they had gone. */
    var w = wire(); if (!w) return;
    var body = JSON.stringify({ org: w.org, module: w.module, actor_id: w.actor, all: true });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API_BASE + '/workspace/locks/release', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) { }
    post('/workspace/locks/release', { all: true });
  }
  function othersLocks() { var L = read(), out = []; for (var k in L) { if (L.hasOwnProperty(k) && fresh(L[k].at) && L[k].sid !== sid()) out.push({ key: k, name: L[k].name }); } return out; }
  return {
    acquire: acquire, release: release, holder: holder, lockedByOther: lockedByOther,
    refreshMine: refreshMine, leave: leave, othersLocks: othersLocks, LOCK_TTL: LOCK_TTL,
    /* The window between a lock clearing and this browser holding what the
       holder wrote. Driven by onLocksReleased(); read by applyLockUI. */
    beginSettle: beginSettle, endSettle: endSettle, settling: settling, settlingLocks: settlingLocks,
    /* For the tests and for anything that wants presence without waiting for
       the next tick. */
    pull: pull, isShared: function () { return _serverMode; }
  };
})();

/* Map an input id to the record it edits - mirrors the commit() records in fldSave/savers.

   THE MAPPING IS THE PROGRAM'S, not the shell's, and this is the one place the
   shell calls back into a program rather than the other way round: the lock
   layer below reads it for every field on the page, so nothing a module owns
   ever calls it and a module that got it wrong would never show up in a port's
   SHADOWED report.

   The table below is the PIPELINE's — `exp_` means an experiment there. In
   Responsible AI Governance `exp_` is the AI-exposure block of the Assessment
   Battery, one shared record called `assessmentBattery`, and its own map says
   so. Left to the shell's, that program claimed its locks under
   `experiments::departments` while its own code asked `lockBlocked
   ('assessmentBattery')` — so the two never met, and two people editing the
   same field did not lock each other. A module that offers the hook answers
   for itself; the eleven that do not keep this table, unchanged. */
/* ── A field id, as a path into the document ──────────────────────
   idToRecordKey() below answers "which RECORD does this field belong to",
   which is what a lock needs. This answers the finer question a change note
   needs: which leaf is it. `p_mission` is data.purpose.mission, and that is
   what lets a collision reported as `.purpose.mission` find the box it
   happened in.

   Only the plain one-field-per-key families — the ones fldSave() ends with
   `data[key][field] = value`. Anything indexed (`expl_3_obj`, `bsic_0_name`)
   carries a row id in the middle and is not this shape, so it returns null and
   the field simply gets no note: saying nothing is the right answer where the
   path cannot be known, and a wrong note under the wrong box would be worse
   than none. A program with its own field naming can answer for itself through
   the `idToDocPath` hook, exactly as it can for idToRecordKey. */
function idToDocPath(id) {
  var own = window.Modules && Modules.hook('idToDocPath');
  if (own) return own(id);
  if (!id) return null;
  var i = id.indexOf('_');
  if (i < 0) return null;
  var pre = id.slice(0, i), field = id.slice(i + 1);
  if (!field) return null;

  /* Indexed families: <pre>_<row>_<field>, where the field is stored under that
     name exactly — data.ideas[3].name, data.tracking[3].status. Only these
     three, because only these three write `collection[row][field] = value`
     straight through (fldSave). The ones that translate the suffix on the way
     in — `expl_3_obj` is projects[3].objectives, `ops_3_perf` is
     opsData[3].performance — are not listed, because a path built from the id
     alone would be wrong, and a note under the wrong box is worse than none. */
  var rows = { bsic: 'ideas', trk: 'tracking', exp: 'experiments' };
  if (rows[pre]) {
    var j = field.indexOf('_');
    if (j < 0) return null;
    var row = field.slice(0, j), sub = field.slice(j + 1);
    if (!row || !sub || sub.indexOf('_') >= 0) return null;
    return [rows[pre], String(row), sub];
  }

  if (field.indexOf('_') >= 0) return null;             // indexed: not this shape
  var singles = {
    p: 'purpose', k: 'knowledge', ow: 'ownership', inc: 'incentives',
    rh: 'rhythm', cap: 'capital', gov: 'governance', str: 'stress', rev: 'review'
  };
  return singles[pre] ? [singles[pre], field] : null;
}

function idToRecordKey(id) {
  var own = window.Modules && Modules.hook('idToRecordKey');
  if (own) return own(id);
  if (!id) return null;
  var i = id.indexOf('_'); if (i < 0) return null;
  var pre = id.slice(0, i), rest = id.slice(i + 1);
  if (pre === 'ic') return null;                 // idea-card drafts: UI state, not a shared record
  var singles = { p: 'purpose', k: 'knowledge', ow: 'ownership', inc: 'incentives', rh: 'rhythm', cap: 'capital', gov: 'governance', str: 'stress', rev: 'review' };
  if (singles[pre]) return singles[pre];
  if (pre === 'tune') return 'stress';
  if (pre === 'lead') return 'ownership';
  if (pre === 'senior') return 'ownership';
  if (pre === 'au') return 'audit';
  if (pre === 'rhAtt') return 'rhythm';
  if (pre === 'rhAg') return 'rhythm';           // 2.3 agenda rows -> saveAgendaItems()
  if (pre === 'kd' || pre === 'ka') return 'capital'; // kill-confirm inputs -> capital.killRows
  if (pre === 'fl') return 'capital';             // funding-line rows -> capital.fundLines (flSave)
  if (pre === 'raci') return 'raci::' + rest;
  if (pre === 'pjr') return 'projects::' + rest;
  if (pre === 'pj' || pre === 'rs') return (UI.ap != null) ? ('projects::' + UI.ap) : null;
  /* Indexed records: id = <pre>_<idx>[_<field>], locked per row.
     bsic/pgf/pgTpl/prj were added after an audit that rendered every
     surface and checked each field id against this map - they were the
     only editable fields outside the lock system. bsic was the worst of
     them: fldSave() gates on this function, so an unmapped prefix meant
     the write went through even while another user held the card
     (last save wins, no warning). The other three had their own
     lockedByOther() guards in the save handler, so the write was
     refused - but with nothing acquired on focus and no lock painted,
     the typing was discarded silently. */
  var coll = { score: 'assessments', exp: 'experiments', trk: 'tracking', ops: 'opsData', expl: 'projects', de: 'decisions', port: 'portfolio', prs: 'projects', pr3: 'projects', cg: 'capAlloc', bpn: 'budgetPlans', bps: 'budgetPlans', bpg: 'budgetPlans', bpm: 'budgetPlans', bsic: 'ideas', pgf: 'budgetPlans', pgTpl: 'budgetPlans', prj: 'projects' }[pre];
  if (coll) { var j = rest.indexOf('_'); return coll + '::' + (j < 0 ? rest : rest.slice(0, j)); }
  return null;
}

/* Guard for button-driven writes: block and tell the user who holds the record.
   The alert states the refusal; the banner then keeps standing so the reason is
   still on screen after it is dismissed \u2014 pressing the button again and getting
   the same modal told nobody anything new. */
/* ── The step this screen belongs to, for the assignment rule ─────
   Only a step or an outcome page is a thing that can be assigned. `currentStep`
   is also set on a PHASE landing (to the phase number, 1–5), which is not a
   step id and would read as "nobody is assigned" — turning every phase landing
   read-only for the whole team. Everywhere else — the team screen, notes, a
   profile modal, My Assignments — has nothing to do with assignment and must
   be left alone. */
function assignStepOnScreen() {
  if (typeof currentPage === 'undefined') return '';
  if (currentPage !== 'step' && currentPage !== 'outcome') return '';
  return (typeof currentStep !== 'undefined' && currentStep) ? String(currentStep) : '';
}

/* ── The editing rule, ENFORCED ───────────────────────────────────
   The twin of completeBlocked(), and the same lesson: disabling a field is a
   statement, not a gate. The write still goes through from a render made
   before the assignments arrived, from the console, or from any handler
   reached another way — so every path that writes asks here first.

   `quiet` for the paths that run on every keystroke (fldSave, the harvest): a
   read-only field cannot be typed into, and if one somehow is, an alert per
   character is not a refusal, it is a trap. Those refuse in silence and the
   read-only note at the top of the step is what does the explaining. The
   button paths say it out loud, because a button that does nothing tells
   nobody anything. */
function editBlocked(quiet) {
  var why = '';
  try { why = stepEditLock(assignStepOnScreen()); } catch (e) { return false; }
  if (!why) return false;
  if (!quiet) { try { alert(why); } catch (e) { } }
  return true;
}

function lockBlocked(rk) {
  /* Assignment first: "this is not your step" is the older and larger fact, and
     saying "somebody is editing this record" to a member who could not have
     edited it either way would send them off to wait for a lock to clear.
     Every button-driven write in every program already comes through here —
     which is the whole reason the check belongs here and not in forty
     handlers. */
  if (editBlocked()) return true;
  var h = Collab.lockedByOther(rk); if (!h) return false;
  try { if (typeof showLockBanner === 'function') showLockBanner([{ key: rk, name: h.name, settling: !!h.settling }]); } catch (e) { }
  /* Two different refusals, said as two different things. "Still loading" is not
     "somebody is editing", and telling a reader to wait for a lock that has
     already cleared is how a one-second wait reads as a broken button. */
  var msg = h.settling
    ? ('Loading the changes ' + ((h && h.name) || 'another member') + ' just made to this record. Try again in a moment.')
    : ('Locked \u2014 ' + ((h && h.name) || 'another user') + ' is editing this record. Try again when the lock clears.');
  try { alert(msg) } catch (e) { }
  return true;
}

/* ── Post-render pass: a step that is not this member's to edit ───
   Every control on the step goes read-only and one note at the top says whose
   step it is. Runs from applyLockUI(), which is the single post-render hook
   every program already goes through, so no program has to know this exists.

   Scoped to #app, never #modalRoot: a profile editor or the assignments dialog
   is the member's own business and has nothing to do with whose step is on the
   page behind it.

   Its own attribute, not the collab lock's. The two states are different
   things — "somebody is editing this right now" is transient and is hatched in
   amber; "this is not your step" is a standing fact and is simply quiet — and
   they overlap freely, so a single flag would have one pass clearing the
   other's work. */
var _assignSig = null;
function applyAssignUI(force) {
  if (typeof document === 'undefined') return;
  var app = document.getElementById('app');
  if (!app) return;

  var why = '';
  try { why = stepEditLock(assignStepOnScreen()); } catch (e) { why = ''; }

  /* The same guard applyLockUI carries, and for a sharper reason: this runs on
     the four-second tick, and rebuilding the note each time would have a screen
     reader announce "this step is assigned to…" every four seconds for as long
     as the reader stayed on the page. force=true is the post-render call, where
     the DOM has just been thrown away and there is nothing left to keep. */
  var sig = assignStepOnScreen() + '|' + why;
  if (!force && sig === _assignSig) return;
  _assignSig = sig;

  /* Always clear first, so a step that has just been assigned TO this member
     goes live in the same pass that stopped saying it was somebody else's. */
  var was = app.querySelectorAll('[data-assign-locked]');
  for (var i = 0; i < was.length; i++) {
    was[i].disabled = false;
    was[i].removeAttribute('data-assign-locked');
  }
  var note = document.getElementById('assignReadOnly');
  if (note && note.parentNode) note.parentNode.removeChild(note);
  if (!why) return;

  /* Fields, and the 1-5 scales, which are buttons rather than inputs.
     `.lk-btn` is the same class in all three programs — the shell, Executive
     Readiness and AI Governance each build their scales with it — so one
     selector covers every one of them.

     The scales have to be named here because, unlike everything else on a step,
     they answer to nobody: likSet() writes the score and saves, with no
     lockBlocked() and no Collab.lockedByOther() in front of it, so the rule
     could not reach them the way it reaches the rest.

     Still not the other buttons. Half of them are how a reader gets around a
     step — the sub-tabs, the carousel, an expander, Back — and a step nobody
     may edit still has to be readable. The ones that write refuse on their own
     and say why. */
  var els = app.querySelectorAll('input,select,textarea,.lk-btn');
  for (var j = 0; j < els.length; j++) {
    var el = els[j];
    /* A field the program itself rendered disabled is left exactly as it is:
       it is already read-only, and taking ownership of it would mean handing
       it back — enabled — the moment this member is assigned the step.

       A field the COLLAB pass disabled is the exception, and it has to be
       taken over. That pass re-enables everything it holds at the top of every
       run before deciding again, so a field left in its hands would go live
       the moment the other member let go — on a step this one may not edit. */
    if (el.disabled && !el.getAttribute('data-collab-locked')) continue;
    el.disabled = true;
    el.setAttribute('data-assign-locked', '1');
  }

  var n = document.createElement('div');
  n.id = 'assignReadOnly';
  n.className = 'assign-readonly';
  n.setAttribute('role', 'status');
  /* The reason is built from members' names, so it goes in as text. */
  n.textContent = why;
  /* Inside the zoom wrapper, not above it: render() puts the whole page in one,
     and a note left outside would be the only thing on the step that did not
     scale with the reader's zoom. */
  var host = document.getElementById('zoomWrap') || app;
  if (host.firstChild) host.insertBefore(n, host.firstChild); else host.appendChild(n);
}

/* Post-render pass: disable fields of records another user holds, mark who holds them.
   force=true always paints (fresh DOM after render); the tick uses force=false and skips
   when nothing changed, so it never flickers or fights typing. */
var _lockSig = '';
/* Records another member held on the last pass, and the ones we are still
   waiting on the server for after they let go. See onLocksReleased(). */
var _lastOtherLocks = {};

/* \u2500\u2500 A released lock is not a green light on its own \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Releasing only frees the FIELDS. The values in them come from `data`, and
   `data` is refreshed by a poll on its own five-second clock \u2014 so for up to a
   beat after a colleague let go, their sentence was in the database and the
   older one was on screen, editable. Type there and the save carries the older
   text back over the work they had just finished. The lock had done its job and
   the collision happened anyway, one second later.

   So a release is treated as unfinished business: the fields stay disabled,
   they say what is happening, and the workspace is asked for straight away.
   They go live when this browser holds what the other person wrote \u2014 which is
   the only moment at which editing them is safe. Fails open: if the request
   cannot be had, the fields are released anyway after a beat, because a sync
   that is down must not leave a section read-only for ever. */
var LOCK_SETTLE_TIMEOUT_MS = 4000;
function onLocksReleased(keys) {
  if (!keys.length) return;
  var pulled = false;
  var finish = function () {
    if (pulled) return; pulled = true;
    Collab.endSettle(keys);
    try { applyLockUI(true); } catch (e) { }
  };
  try {
    if (Store.isServerMode && Store.isServerMode()) {
      Store.checkRemote(finish);
      /* The answer may never come. Release on a timer as well \u2014 whichever
         happens first \u2014 so nothing can strand a section. */
      setTimeout(finish, LOCK_SETTLE_TIMEOUT_MS);
    } else {
      Store.checkRemote();
      finish();
    }
  } catch (e) { finish(); }
  try { applyLockUI(true); } catch (e) { }
}

/* Where the "Locked \u00b7 X is editing" line may be placed without moving anything.
   It used to be inserted straight before the field, whatever the field sat in.
   Inside a ROW that is a flex or grid container \u2014 step 1.1's AI Innovation
   Audit, whose rows are `display:flex` with the name input, the status select
   and the remove button side by side \u2014 the marker becomes another item in that
   row: it lands to the left of the name box, shoves the row's contents along,
   and reads as a caption for the wrong control. The same happens in every
   two-across form row in the app.

   So the marker climbs out of any laid-out container it finds itself in and
   goes above the whole row, where a caption belongs. Bounded to four hops, and
   getComputedStyle is guarded: the test DOM has no layout to ask about, and the
   honest answer there is "insert where you always did". */
function lockMarkTarget(el, rootEl) {
  var node = el, hops = 0;
  try {
    if (typeof getComputedStyle !== 'function') return node;
    while (node && node.parentNode && node.parentNode !== rootEl && hops++ < 4) {
      var d = '';
      try { d = (getComputedStyle(node.parentNode) || {}).display || ''; } catch (e) { break; }
      if (d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid') { node = node.parentNode; continue; }
      break;
    }
  } catch (e) { return el; }
  return node || el;
}

function applyLockUI(force) {
  try { applyAssignUI(force); } catch (e) { }
  /* The page has just been rebuilt, so any change note on it has gone with it.
     Put them back where they belong. */
  try { if (typeof applyFieldNotes === 'function') applyFieldNotes(); } catch (e) { }
  try {
    var others = Collab.othersLocks(), sig = JSON.stringify(others) + '|' + JSON.stringify(Collab.settlingLocks());
    /* Whose locks have just gone. Detected before the early return, or a
       release that changed nothing else on screen would be missed. */
    var nowMap = {}, released = [], mk2;
    for (var m0 = 0; m0 < others.length; m0++) nowMap[others[m0].key] = others[m0];
    for (var pk in _lastOtherLocks) {
      if (Object.prototype.hasOwnProperty.call(_lastOtherLocks, pk) && !nowMap[pk] && !Collab.settling(pk)) released.push(pk);
    }
    if (released.length) {
      var names = {}; released.forEach(function (rk0) { names[rk0] = (_lastOtherLocks[rk0] || {}).name || 'Someone'; });
      _lastOtherLocks = nowMap;
      Collab.beginSettle(released, names);
      onLocksReleased(released);
      return;                      // onLocksReleased repaints once it has settled
    }
    _lastOtherLocks = nowMap;
    if (!force && sig === _lockSig) return; _lockSig = sig;
    var lockMap = {}; for (var m = 0; m < others.length; m++) lockMap[others[m].key] = others[m];
    /* Sections we are waiting on stay locked, and say a different thing. They
       are already refused by lockedByOther(), so this is only the painting. */
    var stl = Collab.settlingLocks();
    for (var s0 = 0; s0 < stl.length; s0++) { if (!lockMap[stl[s0].key]) lockMap[stl[s0].key] = stl[s0]; }
    /* ER-3: #modalRoot sits outside #app, so a field inside an open modal (the
       profile editor) never showed the disabled state or the lock marker. Both
       containers are scanned through one shim exposing the only member this
       function uses. */
    var _roots = [document.getElementById('app'), document.getElementById('modalRoot')].filter(Boolean); if (!_roots.length) return;
    var root = { querySelectorAll: function (sel) { var out = []; for (var _r = 0; _r < _roots.length; _r++) { var _ns = _roots[_r].querySelectorAll(sel); for (var _n = 0; _n < _ns.length; _n++) out.push(_ns[_n]); } return out; } };
    var oldMarks = root.querySelectorAll('.collab-lock-mark'); for (var i = 0; i < oldMarks.length; i++) { if (oldMarks[i].parentNode) oldMarks[i].parentNode.removeChild(oldMarks[i]); }
    /* Everything this pass holds goes live again before it decides afresh —
       except what the assignment pass above has taken over. Re-enabling one of
       those would put a field on a step this member may not edit back within
       reach, one beat after somebody else let go of it. */
    var wasLocked = root.querySelectorAll('[data-collab-locked]'); for (var j = 0; j < wasLocked.length; j++) { if (!wasLocked[j].getAttribute('data-assign-locked')) wasLocked[j].disabled = false; wasLocked[j].removeAttribute('data-collab-locked'); }
    var seen = {}, onPage = [], fields = root.querySelectorAll('input,select,textarea');
    for (var k = 0; k < fields.length; k++) {
      var el = fields[k], rk = idToRecordKey(el.id); if (!rk) continue; var h = lockMap[rk]; if (!h) continue;
      el.disabled = true; el.setAttribute('data-collab-locked', '1');
      if (!seen[rk]) {
        seen[rk] = true;
        onPage.push(h);
        mk2 = document.createElement('div');
        mk2.className = 'collab-lock-mark' + (h.settling ? ' collab-lock-mark--settling' : '');
        mk2.textContent = h.settling
          ? ('Loading ' + (h.name || 'their') + '\u2019s changes\u2026')
          : ('Locked \u00b7 ' + (h.name || 'Someone') + ' is editing');
        var anchor = lockMarkTarget(el, _roots[0]);
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(mk2, anchor);
      }
    }
    /* The inline line is easy to miss: it is next to the field, and on a long
       step the field is often off-screen. Say it once where it cannot be
       scrolled away from as well. */
    if (typeof showLockBanner === 'function') showLockBanner(onPage);
  } catch (e) { }
}

/* ── A click on a control this member may not use ─────────────────
   `disabled` is the visible half and, while the paint is current, it is also
   the working half: a disabled control fires no click. This is what holds when
   the paint is NOT current — a render that landed before the assignments
   arrived, or anything that rebuilds part of the page without going through
   render(). It matters most for the 1-5 scales, whose handler writes and saves
   with no guard of its own, so nothing else would stop them.

   Capture phase, so it runs before the inline onclick. Silent: the control is
   visibly off and the note at the top of the step has already said whose step
   it is — an alert for each click on a greyed-out button is nagging, not
   explaining. Only controls the assignment pass marked, so every way of moving
   around a step keeps working. */
if (typeof document !== 'undefined') {
  document.addEventListener('click', function (e) {
    try {
      if (!editBlocked(true)) return;
      var t = e.target;
      var hit = t && t.closest ? t.closest('[data-assign-locked]') : null;
      if (!hit) return;
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    } catch (err) { }
  }, true);
}

/* Acquire on focus, release when focus leaves all record fields (focusin handles field-to-field). */
var _heldLock = null;
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
// A user is an admin if explicitly flagged, or holds an owner/admin role.
function signOut() {
  if (SAMPLE_MODE) { closeSample(); return; }   /* Sweep 4R item 9 (addendum 5 Oct 2026; amends Part 3): in the sample tab Sign Out closes the tab; it never signs anyone out, never opens sign-in and writes nothing */
  if (!confirm('Sign out? Your work is saved.')) return;
  try { Collab.leave(); } catch (e) { }
  try { chatShutdown(); } catch (e) { }
  notesData = [];
  sealSession();
  Auth.clearSession();
  UI.entry = { step: 'login', err: '' };
  /* Out through the door of the program you were in: /apps/leaders/<module>
     becomes /apps/leaders/<module>/login. Staying on the program's own URL
     while signed out would show sign-in at an address that claims a program,
     and a refresh would put the next person straight back into it.
     The server session ends first (Part 6.1.3) — the cookie is what signs
     anybody in now — and the page leaves when it has, or after 1.5 s. */
  var left = false;
  var leave = function () {
    if (left) return; left = true;
    if (window.Router && Router.served()) { Router.openAuth('login'); return; }
    render();
  };
  setTimeout(leave, 1500);
  Auth.serverSignOut(leave);
}

function userAv(u, size) {
  size = size || 28;
  var txt = (function () {
    var h = (u.color || '#888888').replace('#', ''); // QA sweep 2: colorless records (imports, legacy) crashed the admin console
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#1A1612' : '#fff';
  })();
  return '<div class="user-av" style="width:' + size + 'px;height:' + size + 'px;background:' + (u.color || '#888888') + ';color:' + txt + ';font-size:' + Math.floor(size * 0.36) + 'px">' + u.initials + '</div>';
}

/* Assignment system (getAssigns / toggleAssign / stepAssignBar / assignBtn)
   → js/features/assignments.js. MySQL-backed via the /assignments API;
   data.assigns = { stepId: [localUserId, ...] } is the in-memory mirror. */

/* ═══════════════════════════════════════════════════════════════
   ORG LIFECYCLE
   ═══════════════════════════════════════════════════════════════ */
/* `serverIds` ({orgId,userId} = the public ids the API just minted) makes the
   local workspace ADOPT the database's ids instead of inventing its own. That
   link is not cosmetic: the org registry is re-read from the database on every
   load, so an org whose local id the server has never heard of disappears on the
   next refresh — taking the signed-in session with it — and every workspace save
   for it is refused 404. Omit it only where there is no server record to adopt
   (file:// mode, legacy migration). */
function createOrg(name, firstUser, serverIds, accountTypeKey, modules) {
  serverIds = serverIds || {};
  var id = serverIds.orgId || ('org_' + Math.random().toString(36).slice(2, 9));
  var list = getOrgs();
  /* accountType is the role space this workspace belongs to. Stamped here for
     the window between sign-up and the next registry refresh, which re-reads it
     from the database (the authority). See accountType(). */
  var rec = {
    id: id, name: name || 'Untitled Organization',
    accountType: accountTypeKey || (window.Modules ? Modules.DEFAULT_ROLE : 'enterprise'),
    /* And what it is entitled to, for the same window — a brand-new Leader
       account goes straight to its launchpad, and without this the programs it
       just chose would not be the ones showing on it. */
    modules: modules || null,
    created: Date.now()
  };
  if (serverIds.orgId) rec.serverId = serverIds.orgId;
  list.push(rec);
  saveOrgs(list);
  sealSession();
  setCurrentOrg(id);
  data = emptyData();
  data.startDate = new Date().toISOString().split('T')[0];
  data.bf12 = true;
  data.bf11 = true;
  data.enterprise = { name: name || '' };
  /* email lands on the roster record, the same field the admin member editor
     writes and the same one notifyMemberEmails() reads - an owner without one
     means every notification for this org is silent until someone notices. */
  var ownerId = serverIds.userId || uid(); // same rule as the org id: adopt the server's
  var owner = firstUser ? {
    id: ownerId, serverId: serverIds.userId || null,
    name: firstUser.name || 'Owner', username: (firstUser.username || '').trim(),
    role: firstUser.role || 'Administrator', initials: orgInitials(firstUser.name || 'Owner') || 'OW',
    color: '#B8892A', scope: 'All', email: (firstUser.email || ''),
    /* The owner holds everything the organization does — SetupController grants
       exactly that (grantAllOfOrgToUser), and the roster is where the client
       reads a member's grant from. */
    modules: modules || null,
    admin: true
  } : { id: ownerId, serverId: serverIds.userId || null, name: 'Owner', username: 'owner', role: 'Administrator', initials: 'OW', color: '#B8892A', scope: 'All', email: '', modules: modules || null, admin: true };
  data.roster = [owner];
  saveData();
  applyTeamRoster();
  return { orgId: id, userId: owner.id };
}
/* -- SESSION SEAL (Directive 2 Oct 2026, Part S; ported live 6 Oct 2026 for the AI Innovation Pipeline, 7 Oct 2026 for Executive Readiness
   and Responsible AI Governance).
   Nothing at all survives a change of organization or user: no carve-outs, preferences included. It runs on
   sign-in and the admin console's Open (both through switchToOrg), sign-out, a new organization, and deleting
   the organization being viewed. Never on page load: restoreSession uses setCurrentOrg, not switchToOrg. Only
   on a Pipeline, Executive Readiness or Responsible AI Governance page (7 Oct 2026: each program's own directive
   of the same date; the other programs keep today's behaviour until theirs are applied). A program's own state is reset through its
   sealSession hook (Modules.hook). Closed panels are emptied and Team Chat and Notes state cleared, so an
   admin console Open shows nothing of the organization before it, even for a moment.
   The live default theme is DARK (shell.html paints it first), so the seal restores dark. For the Pipeline this
   reverses applyLoginTheme's August ruling that a sign-in keeps the reader's Light Mode: the directive's
   "preferences included" is the later ruling. UI.entry is kept: it is the sign-in screen doing the switching,
   and the sign-in path reads it straight after switchToOrg. -- */
/* + AI-Ready Architecture (21 Oct 2026): its build seals the session the same way (UI_PRISTINE, 1 Oct 2026). */
function sealApplies() { try { return !!(window.Modules && (Modules.isActive('pipeline') || Modules.isActive('exec-readiness') || Modules.isActive('ai-governance') || Modules.isActive('ai-architecture'))); } catch (e) { return false; } }
function sealSession() {
  if (!sealApplies()) return;
  try { if (coachOpen) toggleCoach(); } catch (e) { }
  try { if (notesOpen) toggleNotes(); } catch (e) { }
  try { if (gchatOpen) toggleGChat(); } catch (e) { }
  try { closeModal(); } catch (e) { }
  try { if (carouselState && carouselState.timer) clearInterval(carouselState.timer); } catch (e) { }
  try { chatShutdown(); } catch (e) { }   /* chatMessages: opening Team Chat draws what it already has before reloading */
  try { notesData = []; updateNotesCount(); } catch (e) { }
  try { ['notesPanel', 'coachPanel', 'gchatPanel'].forEach(function (id) { var p = document.getElementById(id); if (p) p.innerHTML = ''; }); } catch (e) { }   /* a closed panel keeps its markup; each redraws when opened */
  try { var own = window.Modules && Modules.hook('sealSession'); if (own) own(); } catch (e) { }
  var entry = UI.entry;
  Object.keys(UI).forEach(function (k) { delete UI[k]; });
  var fresh = JSON.parse(UI_PRISTINE);
  Object.keys(fresh).forEach(function (k) { UI[k] = fresh[k]; });
  if (entry !== undefined) UI.entry = entry;
  UI.theme = 'dark'; UI.zoom = 1;
  try { Store.setPref('theme', 'dark'); Store.setPref('zoom', 1); Store.setPref('sidebar-min', '0'); } catch (e) { }
  try { document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) { }
  sidebarMinimized = false; sidebarOpen = true;
  try { syncSidebarToViewport(true); } catch (e) { }   /* a narrow screen still gets its icon strip */
  currentPage = 'home'; currentStep = null; currentPhase = null;
  try { if (window.insightsTabReset) insightsTabReset(); } catch (e) { }
  carouselState = { idx: 0, timer: null, stepId: null, hover: false };
  gateArmed = false; _lastGateStep = null;
  coachMsgs = JSON.parse(COACH_MSGS_PRISTINE); coachCtx = 'Overview';
  try { gchatUnreadCount = 0; } catch (e) { }
  try { orgSetupMode = false; } catch (e) { }
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
  if (!legacy) return;
  try {
    var d = JSON.parse(legacy);
    var id = 'org_' + Math.random().toString(36).slice(2, 9);
    var nm = (d.enterprise && d.enterprise.name) ? d.enterprise.name : 'My Organization';
    if (Array.isArray(d.roster)) d.roster.forEach(Auth.ensurePasscode);
    saveOrgs([{ id: id, name: nm, created: Date.now() }]);
    Store.writeOrg(id, d);
  } catch (e) { }
}
function fmtDate(ts) { try { var d = (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ts)) ? new Date(ts + 'T12:00:00') : new Date(ts); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }

/* ═══════════════════════════════════════════════════════════════
   ENTRY FLOW — username + password sign-in · setup · admin console
   ═══════════════════════════════════════════════════════════════ */

/* ── Locating an account on this device ───────────────────────────
   Every lookup here takes an organization id, and none of them matches on a
   person's display name.

   Both rules come from the same defect. Sign-in searched every organization on
   the device for a username-or-name and took the first hit, so whose workspace
   opened depended on what else this browser had cached — regularly the
   organization's administrator rather than the person typing. An identity is
   now GIVEN — by the server, by public id — and these functions only answer
   "is this person in that workspace?". A display name is not a credential and
   is not treated as one: "Maria Torres" is not a login, and two people may
   share it.

   There is no offline sign-in any more (Directive 2 Oct 2026, Part 5): the
   device holds no password to check one against. */

/** Normalized comparison form for an organization or member name. */
function nameKey(s) { return ((s || '') + '').trim().toLowerCase().replace(/\s+/g, ' '); }

/** One organization's roster, or [] when it has no local workspace. */
function localRoster(orgId) {
  var d; try { d = Store.readOrg(orgId); } catch (e) { return []; }
  return (d && d.roster) || [];
}

// True if this organization has that username at all.
function userExists(orgId, username) {
  var want = nameKey(username); if (!want) return false;
  return localRoster(orgId).some(function (u) { return nameKey(u.username) === want; });
}

/* Locate the local workspace for the account the SERVER just authenticated.
   `orgSid`/`userSid` are public ids and are matched exactly. The username is a
   last resort, and only inside the organization already resolved: a workspace
   written before members carried serverIds has no other way to be recognised,
   and getting it wrong there can only pick a different member of the SAME
   team — not, as before, a different organization entirely. */
function findLocalUserByServerIds(orgSid, userSid, username) {
  if (!orgSid) return null;
  var org = getOrgs().filter(function (o) { return o.id === orgSid || o.serverId === orgSid; })[0];
  if (!org) return null;

  var roster = localRoster(org.id);
  var hit = userSid && roster.filter(function (u) { return u.serverId === userSid || u.id === userSid; })[0];
  if (hit) return { orgId: org.id, userId: hit.id };

  var want = nameKey(username);
  var byName = want && roster.filter(function (u) { return nameKey(u.username) === want; })[0];
  return byName ? { orgId: org.id, userId: byName.id } : null;
}
/* Back-fill DB ids onto a local org + the signed-in user, so orgs created
   before server-linking existed (or on another device) become linked on the
   next sign-in and their team-member edits start syncing to MySQL. */
function linkLocalToServer(local, data) {
  if (!local || !data) return;
  if (data.organization && data.organization.id) {
    var list = getOrgs(), changed = false;
    var acct = data.organization.account_type || null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== local.orgId) continue;
      if (list[i].serverId !== data.organization.id) { list[i].serverId = data.organization.id; changed = true; }
      // The sign-in response carries the role space; adopt it so a local record
      // written before roles existed learns which one it is.
      if (acct && list[i].accountType !== acct) { list[i].accountType = acct; changed = true; }
    }
    if (changed) saveOrgs(list);
  }
  if (data.user && data.user.id) {
    try {
      var d = Store.readOrg(local.orgId);
      if (d && Array.isArray(d.roster)) {
        var m = d.roster.filter(function (x) { return x.id === local.userId; })[0];
        if (m && m.serverId !== data.user.id) { m.serverId = data.user.id; Store.writeOrg(local.orgId, d); }
      }
    } catch (e) { }
  }
}

/* Build a local workspace from the database for a just-verified sign-in that has
   no local copy yet (fresh device / incognito). Fetches the org (with its members
   + details) and seeds a local workspace, then returns {orgId,userId}. */
function hydrateLocalOrgFromServer(sessionData, cb) {
  var orgSid = sessionData && sessionData.organization && sessionData.organization.id;
  var userSid = sessionData && sessionData.user && sessionData.user.id;
  if (!orgSid || !userSid) { if (cb) cb(null); return; }
  fetch(API_BASE + '/organizations')
    .then(function (r) { return r.json(); })
    .then(function (res) {
      var orgs = (res && res.success && res.data && res.data.organizations) || [];
      var dbOrg = orgs.filter(function (o) { return o.id === orgSid; })[0];
      if (!dbOrg) { if (cb) cb(null); return; }
      // Pull the org's workspace down BEFORE deciding anything: on a fresh
      // browser there is no local copy, and treating that as "no workspace
      // exists" would seed a blank document over the team's program.
      openOrgWorkspace(dbOrg.id, function (localId) {
        if (!localId) { if (cb) cb(null); return; }
        try {
          // The roster is now loaded, so the workspace's own record for this
          // member — the one the server named — can be matched.
          var local = findLocalUserByServerIds(localId, userSid, '');
          if (local) { if (cb) cb(local); return; }
          /* The workspace document's roster does not carry this member yet.
             That is the ordinary case for everyone except the owner: the team
             lives in the `users` table, each module's document only caches it,
             and a member added after the document was last written is simply
             not in that copy. Their identity is in the database, so take it
             from there — bootApp repairs the cached roster on the load that
             follows (sessionRosterId → hydrateRosterFromRegistry).

             It used to fall back to (dbOrg.users || [])[0], the ORGANIZATION'S
             OWNER. A second member signing in on a fresh browser was therefore
             signed in AS the owner: their work was attributed to someone else,
             and they inherited that person's administrator rights. An identity
             is never guessed — the server said which member this is, by public
             id, so the only question left is whether the organization really
             has them; if it does not, there is no local answer and saying so is
             the only honest outcome. */
          var me = (dbOrg.users || []).filter(function (u) { return u.public_id === userSid; })[0];
          if (cb) cb(me ? { orgId: localId, userId: me.public_id } : null);
        } catch (e) { if (cb) cb(null); }
      });
    })
    .catch(function () { if (cb) cb(null); });
}

/* ── Entry / auth screens (Sign in · Set up org · Admin sign-in · Choose a new password) ──
   Extracted into the modular per-screen pattern: markup in
   login.html / setup.html / admin-login.html, logic in auth.js
   (window.Entry). renderEntry() below dispatches to it. The app-side
   glue those handlers call back into — finishSetup, enterAppAsAdmin,
   the admin console — stays here. */

/* Navigate away, but not before the workspace has been saved. Every hand-off
   between the entry screens and the app writes and then leaves — sign-up hands
   over to the Profile page, the first-run wizard hands over to the programs —
   and a debounced write does not survive the page it was queued on.

   The timeout is the guarantee that a slow or failing save can never strand
   anyone on the screen they are trying to leave: the document is already in the
   local mirror, and the next save retries it. */
function navigateWhenSaved(go) {
  var went = false;
  var once = function () { if (went) return; went = true; go(); };
  setTimeout(once, 1500);
  try { Store.flushNow(once); } catch (e) { once(); }
}

/* Complete setup locally once the server has stored the record. `serverData`
   carries the DB ids ({organization:{id}, user:{id}}) and the local workspace is
   built ON those ids — the org's local id IS its public_id, the owner's is their
   user public_id — so the workspace the database returns on the next load is the
   same one this browser is holding. Minting separate local ids here is what used
   to strand a freshly created org: the registry is refetched from the database on
   every load, the local-only id vanished from it, and boot dropped the restored
   session back onto the sign-in screen (while every workspace save 404'd). */
function finishSetup(orgName, name, username, _unused, remember, serverData, email) {
  var ids = {
    orgId: (serverData && serverData.organization && serverData.organization.id) || null,
    userId: (serverData && serverData.user && serverData.user.id) || null
  };
  // The server echoes the role space it recorded for the new organization, so
  // the local record starts out agreeing with the database rather than
  // guessing and being corrected on the next registry refresh.
  var acct = (serverData && serverData.organization && serverData.organization.account_type) || null;
  // …and the programs it recorded against it, for the same reason.
  var mods = (serverData && serverData.organization && serverData.organization.modules) || null;
  /* The NAME the server recorded, not the one that was typed — for a Leader
     nothing was typed. A Leader account is one person and its sign-up asks for
     no organization, so the server derives the workspace's name and is the only
     one that knows it; taking the empty form value instead left the local mirror
     with a nameless organization that no screen could label. */
  var savedName = (serverData && serverData.organization && serverData.organization.name) || orgName;
  var res = createOrg(savedName, { name: name, username: username, role: 'Administrator', email: email }, ids, acct, mods);
  Auth.setSession(res.userId);
  applyLoginTheme();
  try { Store.setRemember(remember ? Auth.sessionRecord(res.orgId, res.userId) : null); } catch (e) { }
  try { Store.setSession(Auth.sessionRecord(res.orgId, res.userId)); } catch (e) { } // stay signed in across refresh
  UI.entry = null;

  /* Where a new account goes next: into its own workspace, with Profile open.

     Sign-up itself stays authentication — it creates the organization, its
     owner and the session, and asks for nothing more. The "Choose a program"
     chooser is NOT part of it: a new account is sent to a program (see
     Router.landingUrl), and the panel it lands with open is the ordinary
     Profile — the very one the More menu opens, so there is exactly one
     implementation of it and nothing here to complete before the app will let
     anyone in. Close it and the program is already underneath.

     Profile can only open on the far side of that page load, because it is part
     of a program's chrome; Store.setOpenProfile carries the request across, and
     bootApp takes it. orgSetup is marked done for the same reason the wizard is
     gone: there is no first run to gate any more. */
  data.orgSetup = true;
  saveData();
  try { Store.setOpenProfile(true); } catch (e) { }
  if (window.Router && Router.served()) {
    navigateWhenSaved(function () { if (!Router.landAfterAuth(acct || accountType())) render(); });
    return;
  }
  /* Unserved (file://, the harness): no addresses, so there is no navigation to
     make and the panel opens over the app right here. */
  render();
  try { if (Store.takeOpenProfile() && typeof openOrgSetup === 'function') openOrgSetup(); } catch (e) { }
}

/* ── Admin console (app-admin) ───────────────────────
   The admin sign-in screen lives in auth.js (window.Entry); the
   console below and its glue (enter/persist/open/delete/new org) stay
   here, wired to the same MySQL-backed Store/Auth as the rest of the app. */
// Persist the app-admin session so a refresh stays signed in (survives reload,
// cleared on browser close — sessionStorage). Includes the admin flag + acting org/user.
function persistAdminSession() {
  try {
    var _ar = Auth.sessionRecord(currentOrgId || null, currentUserId || null);
    _ar.admin = true;   /* which workspace the console was in — the authority is the server session (bootApp asks it) */
    Store.setSession(_ar);
  } catch (e) { }
}
// Admin login lands straight in the app (with the Admin panel available in the menu).
// The password is checked against the database, so an admin can sign in from any
// browser — pull the org list from the database too before deciding where to land,
// or a browser with no local copy (new device, incognito) drops onto an empty
// console even though the organizations exist.
function enterAppAsAdmin() {
  Auth.setAdminSession(true);
  applyLoginTheme();
  hydrateOrgsFromServer(function () { enterAppAsAdminWithLocalOrgs(); });
}
function enterAppAsAdminWithLocalOrgs() {
  var orgs = getOrgs();
  if (!orgs.length) { persistAdminSession(); UI.entry = { step: 'admin' }; render(); return; } // no orgs yet → console to create one
  var target = (currentOrgId && getOrg(currentOrgId)) ? currentOrgId : orgs[0].id;
  // Load the workspace from the database before entering it — see openOrgWorkspace.
  openOrgWorkspace(target, function () {
    switchToOrg(target);
    Auth.setSession((USERS[0] && USERS[0].id) || null);
    if (!currentUserId) { persistAdminSession(); UI.entry = { step: 'admin' }; render(); return; }
    persistAdminSession();
    UI.entry = null; render();
  });
}
// In-app: open the Admin panel (kept available via the More menu and the admin bar)
function adminConsoleOpen(orgId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  // Admin override: enter the org's workspace signed in as its first member.
  // Load it from the database first — see openOrgWorkspace.
  openOrgWorkspace(orgId, function () { adminConsoleOpenLoaded(orgId); });
}
function adminConsoleOpenLoaded(orgId) {
  switchToOrg(orgId);
  Auth.setSession((USERS[0] && USERS[0].id) || null);
  if (!currentUserId) { persistAdminSession(); UI.entry = { step: 'admin' }; alert('This organization has no members yet.'); render(); return; }
  try { Store.setRemember(null); } catch (e) { }
  persistAdminSession();
  UI.entry = null; render();
}
function adminConsoleDelete(orgId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var o = getOrg(orgId); if (!o) return;
  if (!confirm('Delete "' + o.name + '" and all of its data? This cannot be undone.')) return;
  /* On the server, as the Admin panel's Delete does (Part 4.1/4.2.4: deleting an organization deletes everything held
     for it). This used to remove only this browser's copy, and the organization came back on the next load. */
  var sid = o.serverId || o.id, db = (Store.dbOrg && Store.dbOrg(sid)) || null;
  postJSON(API_BASE + '/organizations/delete', { id: sid, actor_id: orgAdminActor(db) },
    function () { deleteOrgById(orgId); persistAdminSession(); UI.entry = { step: 'admin' }; render(); },
    function (err) { alert((err && err.message) || 'Could not delete this organization.'); });
}
/* "+ New Organization" on the pre-login console. It opens the same DB-backed
   form the in-app admin panel uses (adminNewOrgOpen in org-admin.js), because an
   organization that exists only in this browser is gone on the next load: the
   registry is re-read from the database, which never heard of it. */
function adminConsoleNewOrg() { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ persistAdminSession(); UI.entry = { step: 'admin' }; adminNewOrgOpen(); }
function exitAdmin() { try { Auth.serverSignOut(); } catch (e) { } Auth.setAdminSession(false); UI.adminNewOrg = null; try { Store.setSession(null); } catch (e) { } UI.entry = { step: 'login', err: '' }; render(); }
/* ── Change password (5.6), and the administrator's username (5.12.3) ──────────
   One dialog for both kinds of account: a member changes their own (POST /password),
   the app administrator theirs (POST /admin/password). Changing it ends the person's
   other sessions on the server (6.1.3). Opened from the account menu and from the
   admin console. */
function openChangePassword() {
  if (SAMPLE_MODE) return;
  if (!isAppAdmin && !currentUserId) return;
  UI.pwDialog = { kind: isAppAdmin ? 'admin' : 'member', err: '', done: '', busy: false };
  currentModal = 'password'; renderPasswordModal();
  var f = $('pwCurrent'); if (f) f.focus();
}
function openChangeUsername() {
  if (!isAppAdmin) return;
  UI.pwDialog = { kind: 'admin', err: '', done: '', busy: false };
  currentModal = 'username'; renderPasswordModal();
  var f = $('adminNewUsername'); if (f) f.focus();
}
/* Kept for anything still wired to the old name. */
function adminChangePasscode() { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ openChangePassword(); }
function renderPasswordModal() {
  var mr = $('modalRoot'); if (!mr || (currentModal !== 'password' && currentModal !== 'username')) return;
  var st = UI.pwDialog || {};
  /* The dialog's layout is inline (7 Oct 2026): it reads the same whichever stylesheet a server has. Each field sits in its
     own group with room below it; the password rule is a small muted line under New password, tied to it, not a paragraph. */
  var GROUP = 'margin:0 0 18px', LABEL = 'display:block;margin:0 0 7px', INPUT = 'display:block;width:100%;box-sizing:border-box;margin:0';
  var RULE = 'font-family:var(--sans);font-style:normal;font-size:12.5px;line-height:1.5;color:var(--text-muted);margin:8px 0 0';
  function fld(label, id, ac, after) { return '<div style="' + GROUP + '"><label class="org-flabel" for="' + id + '" style="' + LABEL + '">' + label + '</label><input id="' + id + '" class="field-input" type="password" autocomplete="' + ac + '" style="' + INPUT + '" onkeydown="if(event.key===\'Enter\')' + (currentModal === 'username' ? 'doChangeUsername' : 'doChangePassword') + '()"/>' + (after || '') + '</div>'; }
  var h = '<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal modal-narrow" role="dialog" aria-modal="true" aria-labelledby="pwTitle" style="max-width:460px;position:relative">';   /* no corner \u00d7: Cancel (and a click outside) closes it */
  if (currentModal === 'username') {
    h += '<h3 id="pwTitle" style="margin:0 0 22px">Change username</h3>';
    h += '<div class="pw-form" style="display:block;margin:0"><div style="' + GROUP + '"><label class="org-flabel" for="adminNewUsername" style="' + LABEL + '">Username</label><input id="adminNewUsername" class="field-input" type="text" autocomplete="username" style="' + INPUT + '" onkeydown="if(event.key===\'Enter\')doChangeUsername()"/></div></div>';
  } else {
    h += '<h3 id="pwTitle" style="margin:0 0 22px">Change password</h3>';
    h += '<div class="pw-form" style="display:block;margin:0">' + fld('Current password', 'pwCurrent', 'current-password')
      + fld('New password', 'pwNew', 'new-password', '<div class="pw-rule" style="' + RULE + '">' + PASSWORD_RULE_TEXT + '</div>')
      + fld('Confirm new password', 'pwConfirm', 'new-password') + '</div>';
  }
  if (st.err) h += '<div class="entry-err" role="alert" style="margin:0 0 16px">' + esc(st.err) + '</div>';
  if (st.done) h += '<div class="pw-done" role="status" style="font-family:var(--sans);font-size:14px;font-weight:600;color:var(--paper);background:rgba(var(--gold-rgb),.12);border-left:3px solid var(--gold);padding:10px 14px;margin:0 0 16px">' + esc(st.done) + '</div>';
  h += '<div class="org-edit-actions" style="margin-top:6px"><button class="org-btn-save" onclick="' + (currentModal === 'username' ? 'doChangeUsername' : 'doChangePassword') + '()"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Saving\u2026' : (currentModal === 'username' ? 'Save' : 'Save password')) + '</button>'
    + '<button class="org-btn-cancel" onclick="closeModal()">' + (st.done ? 'Done' : 'Cancel') + '</button></div>';
  h += '</div></div>';
  mr.innerHTML = h;
}
function doChangePassword() {
  var st = UI.pwDialog || {}; if (st.busy) return;
  var c = $('pwCurrent'), a = $('pwNew'), b = $('pwConfirm');
  var cur = c ? c.value : '', p1 = a ? a.value : '', p2 = b ? b.value : '';   /* never trimmed: a password is exactly what was typed */
  function fail(m) { st.err = m; st.done = ''; st.busy = false; renderPasswordModal(); var f = $('pwNew'); if (f) f.focus(); }
  if (!cur) return fail('Enter your current password.');
  var prob = (p1 === cur) ? '' : passwordProblem(p1); if (prob) return fail(prob); /* Sweep 4R item 7: a new password equal to the current one goes to the server, which answers in its order: wrong current (A.5.15), then unchanged (A.5.10); the rule would otherwise answer first (the published default is on the common list) */
  if (p1 !== p2) return fail('The two passwords do not match.');
  [c, a, b].forEach(function (x) { if (x) x.value = ''; });
  st.busy = true; st.err = ''; renderPasswordModal();
  (st.kind === 'admin' ? Auth.changeAdminPassword : Auth.changePassword)(cur, p1, function (res) {
    st.busy = false;
    if (res && res.ok) { st.err = ''; st.done = 'Your password has been changed.'; renderPasswordModal(); return; }
    fail(authRefusal(res, p1));
  });
}
function doChangeUsername() { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var st = UI.pwDialog || {}; if (st.busy) return;
  var el = $('adminNewUsername'), u = el ? el.value.trim() : '';
  function fail(m) { st.err = m; st.done = ''; st.busy = false; renderPasswordModal(); }
  if (!u) return fail('Enter your username.');
  if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return fail('Use only letters, numbers, and . _ -');
  st.busy = true; st.err = ''; renderPasswordModal();
  Auth.changeAdminUsername(u, function (res) {
    st.busy = false;
    if (res && res.ok) { st.err = ''; st.done = 'Your username has been changed.'; renderPasswordModal(); return; }
    fail(authRefusal(res, ''));
  });
}
// Floating bar shown when an app admin is viewing inside an organization
// function updateAdminBar() {
//   var bar = document.getElementById('adminViewBar');
//   var show = isAppAdmin && currentUserId && getCurrentUser() && !UI.entry;
//   if (show) {
//     if (!bar) { bar = document.createElement('div'); bar.id = 'adminViewBar'; bar.className = 'admin-view-bar'; document.body.appendChild(bar); }
//     var org = getOrg(currentOrgId); var u = getCurrentUser();
//     bar.innerHTML = '<span class="admin-view-txt"><span class="admin-view-dot">●</span> Admin view · ' + esc(org ? org.name : '') + ' · acting as ' + esc(u.name || '') + '</span><button class="admin-view-btn" onclick="openAdmin()">Admin panel</button>';
//   } else if (bar && bar.parentNode) { bar.parentNode.removeChild(bar); }
// }
var adminBarOpen = false;

function toggleAdminBar(force) {
  var bar = document.getElementById('adminViewBar');
  if (!bar) return;
  adminBarOpen = (typeof force === 'boolean') ? force : !adminBarOpen;
  bar.classList.toggle('open', adminBarOpen);
}

function updateAdminBar() {
  var bar = document.getElementById('adminViewBar');
  var show = isAppAdmin && currentUserId && getCurrentUser() && !UI.entry;

  if (!show) {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'adminViewBar';
    bar.className = 'admin-view-bar' + (adminBarOpen ? ' open' : '');
    bar.innerHTML =
      '<button type="button" class="admin-view-dot" onclick="toggleAdminBar()" title="Admin view" aria-label="Admin view"></button>' +
      '<div class="admin-view-panel"><div class="admin-view-inner">' +
      '<span class="admin-view-txt"></span>' +
      '<button type="button" class="admin-view-btn" onclick="openAdmin()">Admin panel</button>' +
      '<button type="button" class="admin-view-close" onclick="toggleAdminBar(false)" aria-label="Close">&times;</button>' +
      '</div></div>';
    document.body.appendChild(bar);
  }

  // refresh text only — never rebuild, so the open/closed state survives re-renders
  var org = getOrg(currentOrgId), u = getCurrentUser();
  bar.querySelector('.admin-view-txt').innerHTML =
    '<span class="admin-view-label">Admin view</span> · ' + esc(org ? org.name : '') +
    ' · acting as ' + esc(u.name || '');
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && adminBarOpen) toggleAdminBar(false);
  if (e.key === 'Escape' && UI.navModules) closeNavModules();
  // The mobile nav drawer is modal; Escape is the keyboard's close button.
  if (e.key === 'Escape' && UI.navDrawer && typeof closeNavDrawer === 'function') closeNavDrawer();
});

/* The members to list under an org in the admin console. In server mode the
   database's user list is the answer and it is already in hand from the org
   fetch — no workspace download per org just to count heads. Falls back to the
   workspace roster when running from disk. */
function orgRosterPreview(orgId) {
  if (Store.isServerMode()) {
    return Store.dbUsers(orgId).map(function (u) {
      return { name: u.name || '', username: u.username || '', role: u.role || '', initials: orgInitials(u.name || '') || '?', color: u.is_admin ? '#B8892A' : '#4866A0' };
    });
  }
  var d = Store.readOrg(orgId);
  return (d && Array.isArray(d.roster)) ? d.roster : [];
}

/* Dispatcher for the pre-login screens. The three auth screens (Sign in,
   Set up organization, Admin sign-in, Choose a new password) are rendered by the auth.js module
   (window.Entry) into `container`; the admin *console* (after admin sign-in)
   stays here. Called by render() as renderEntry(app). */
function renderEntry(container) {
  if (!UI.entry) UI.entry = { step: 'login' };
  var s = UI.entry.step;
  if (s === 'admin' && isAppAdmin) { container.innerHTML = renderAdminConsole(); return; }
  if (window.Entry) { Entry.mount(s, container); return; }
  // auth.js not loaded yet (should not happen — it's a <script> before app.js)
  container.innerHTML = '<div class="login-screen"><div class="login-card"><p class="login-sub">Loading…</p></div></div>';
}

function renderAdminConsole() {
  var orgs = getOrgs();
  var totalUsers = 0; orgs.forEach(function (o) { totalUsers += orgRosterPreview(o.id).length; });
  var h = '<div class="login-screen admin-screen"><div class="admin-console">'
    + '<div class="admin-console-head"><div><div class="login-eyebrow">Administrator</div><h1 class="login-title" style="margin:6px 0 0">All <em>organizations</em></h1></div>'
    + '<div class="admin-console-actions"><button class="org-btn-cancel" onclick="adminConsoleNewOrg()">+ New Organization</button><button class="entry-link" onclick="openChangePassword()">Change password</button><button class="entry-link" onclick="openChangeUsername()">Change username</button><button class="entry-link" onclick="exitAdmin()">Exit admin</button></div></div>'
    + '<p class="login-sub" style="margin-bottom:18px">' + orgs.length + ' organization' + (orgs.length === 1 ? '' : 's') + ' · ' + totalUsers + ' user' + (totalUsers === 1 ? '' : 's') + ' total. Each workspace is fully isolated.</p>';
  if (UI.adminNewOrg && UI.adminNewOrg.open) h += adminNewOrgFormHtml(); // creates the org in the database
  h += '<div class="admin-console-list">';
  if (!orgs.length) { h += '<div class="entry-empty">No organizations yet.</div>'; }
  orgs.forEach(function (o) {
    var roster = orgRosterPreview(o.id);
    h += '<div class="admin-cardx">';
    h += '<div class="admin-cardx-head"><div class="entry-org-badge">' + esc((o.name || '?').slice(0, 1).toUpperCase()) + '</div>'
      + '<div class="admin-cardx-meta"><div class="admin-org-name">' + esc(o.name) + '</div>'
      + '<div class="admin-org-sub">' + roster.length + ' user' + (roster.length === 1 ? '' : 's') + ' · created ' + fmtDate(o.created) + '</div></div>'
      + '<div class="admin-org-actions"><button class="org-btn-cancel" onclick="adminConsoleOpen(\'' + o.id + '\')">Open</button>'
      + '<button class="org-btn-cancel" onclick="adminResetOrg(\'' + (o.serverId || o.id) + '\')">Reset data</button>'
      + '<button class="org-btn-del" onclick="adminConsoleDelete(\'' + o.id + '\')">Delete</button></div></div>';
    if (roster.length) {
      h += '<div class="admin-users">';
      roster.forEach(function (u) {
        h += '<div class="admin-user-row">' + userAv(u, 26)
          + '<span class="admin-user-name">' + esc(u.name || 'Unnamed') + '</span>'
          + '<span class="admin-user-uname">@' + esc(u.username || '—') + '</span>'
          + '<span class="admin-user-role">' + esc(u.role || '') + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });
  h += '</div></div></div>';
  return h;
}

var currentPage = 'home', currentStep = null, currentPhase = null; var gateArmed = false, _lastGateStep = null;
var sidebarOpen = true;
/* ═══════════════════════════════════════════════════════════════
   SIDEBAR MINIMIZE / MAXIMIZE — 2-state collapse to icon strip
   ═══════════════════════════════════════════════════════════════ */
var sidebarMinimized = (function () {
  try { return Store.getPref('sidebar-min') === '1'; }
  catch (e) { return false; }
})();

function minimizeSidebar() {
  sidebarMinimized = true;
  try { Store.setPref('sidebar-min', '1'); } catch (e) { }
  // Make sure the sidebar itself is visible — minimize doesn't hide it
  sidebarOpen = true;
  render();
}

function maximizeSidebar() {
  sidebarMinimized = false;
  try { Store.setPref('sidebar-min', '0'); } catch (e) { }
  sidebarOpen = true;
  render();
}

function toggleSidebarSize() {
  if (sidebarMinimized) maximizeSidebar();
  else minimizeSidebar();
}

/* ─── NARROW WINDOWS MINIMIZE THE SIDEBAR, THEY NEVER REMOVE IT ───
   Below 960px the rail used to be pushed off-screen (sidebarOpen = false plus
   a translateX(-100%) in the stylesheet). Nothing ever set it back, and the
   only control that could — the hamburger — is display:none !important, so a
   window that got narrow once lost its sidebar for the rest of the session,
   wide again or not. The breakpoint now switches between the two VISIBLE
   states instead: minimized (60px icon strip) while narrow, and whatever the
   person actually chose once there is room again.

   Only the crossing is acted on, never every resize event, so a maximize while
   narrow sticks until the window changes band. Store.setPref is deliberately
   NOT written here: the pref records a choice, and the window getting small is
   not one. */
var _sbNarrow = null;

function _sbPrefMinimized() {
  try { return Store.getPref('sidebar-min') === '1'; }
  catch (e) { return false; }
}

function syncSidebarToViewport(force) {
  var narrow = !!(window.matchMedia && window.matchMedia('(max-width:960px)').matches);
  if (narrow === _sbNarrow && !force) return false;
  _sbNarrow = narrow;
  sidebarOpen = true;                                    // the rail is never taken away
  sidebarMinimized = narrow ? true : _sbPrefMinimized(); // narrow → icon strip; wide → the stored choice
  return true;
}

var coachOpen = false, notesOpen = false;
// Pipeline module UI state
var UI = { v: 'home', prev: null, navStack: [], _back: false, sb: true, sec: '1.1', ap: null, icDraft: null, showEx: {}, sf: false, ec: null, addForm: false, expanded: {}, ni: { name: '', desc: '', strategic: '', cost: '', timeframe: '', dept: '', when: 'now' } };
var coachMsgs = [{ role: 'ai', text: Modules.coachGreeting() }];
var UI_PRISTINE = JSON.stringify(UI); var COACH_MSGS_PRISTINE = JSON.stringify(coachMsgs); /* the session's starting state, for sealSession (Part S) */
var coachCtx = 'Overview';

function $(id) { return document.getElementById(id) }
function uid() { return Math.random().toString(36).slice(2, 10) }
function fmt(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

/* Two one-time back-fills run from here, each behind its own flag.

   bf12 stamps 1.2/1.3 for organizations that finished those steps before the
   flags existed. Both of its `if`s were once UNBRACED, so the stampStepDone()
   calls that followed them ran on EVERY load: a false completion date on an
   org that had finished neither, a false "step complete" email to the whole
   roster, and - because a stamp only fires once - silence when the team
   genuinely finished. Braced now, and the date is written directly rather than
   through stampStepDone(), because loading data must never announce anything.

   bf11 is the companion to 1.1 becoming a real step (see isStepDone). 1.1 used
   to be DERIVED from its five completedSections; an organization that finished
   those five before the change carries no completedSteps['1.1'] and would read
   as incomplete afterwards. It is migrated once, silently, on the same terms.
   Its OWN flag, deliberately: every existing organization already carries
   bf12:true (createOrg sets it at creation), so a clause added inside that
   block would never run for the orgs this exists for. */
function loadData() {
  if (!currentOrgId) { data = emptyData(); return; }
  try { var s = Store.orgRaw(currentOrgId); data = s ? JSON.parse(s) : emptyData(); ensureRaciModel(); ensureCapCostModel(); batteryBackfill(); Object.keys(data.projects || {}).forEach(function (k) { var q = data.projects[k]; if (q && q.rescore && !q.rescoreDone && rsComplete(q.rescore)) q.rescoreDone = true }); Object.keys(data.opsData || {}).forEach(function (k) { if (data.opsData[k] && data.opsData[k].sunset && !(data.archivedItems || {})[k]) { if (!data.archivedItems) data.archivedItems = {}; data.archivedItems[k] = { stage: 'operational', at: Date.now() } } }); if (!data.bf12) { if (s) { if (!data.completedSteps) data.completedSteps = {}; if ((data.ideas || []).length >= 3 && !data.completedSteps['1.2']) { data.completedSteps['1.2'] = true; if (!data.stepDoneAt) data.stepDoneAt = {}; if (!data.stepDoneAt['1.2']) data.stepDoneAt['1.2'] = new Date().toISOString().split('T')[0]; } if ((data.selected || []).length > 0 && !data.completedSteps['1.3']) { data.completedSteps['1.3'] = true; if (!data.stepDoneAt) data.stepDoneAt = {}; if (!data.stepDoneAt['1.3']) data.stepDoneAt['1.3'] = new Date().toISOString().split('T')[0]; } } data.bf12 = true; if (s) saveData(); } if (!data.bf11) { if (s) { var _cs11 = data.completedSections || {}; if (_cs11['1.1'] && _cs11['1.2'] && _cs11['1.3'] && _cs11['1.4'] && _cs11['1.5'] && !(data.completedSteps || {})['1.1']) { if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['1.1'] = true; if (!data.stepDoneAt) data.stepDoneAt = {}; if (!data.stepDoneAt['1.1']) data.stepDoneAt['1.1'] = new Date().toISOString().split('T')[0]; } } data.bf11 = true; if (s) saveData(); } } catch (e) { data = emptyData(); data.bf12 = true; data.bf11 = true; }
}

function saveData() {
  if (!currentOrgId) return;
  try { Store.writeOrg(currentOrgId, data) } catch (e) { }
}

/* Phases, milestones and phase wrap-ups are this program's own content, so they
   come from the active module (js/modules/<id>/module.js). They stay plain
   globals because the router, the sidebar, every step screen and the management
   hub all read them by name. */
var PH = Modules.PH();
var MILESTONES = Modules.MILESTONES();
var PHASE_WRAPUPS = Modules.PHASE_WRAPUPS();

function goBack() { var st = UI.navStack || []; var t = st.pop(); if (!t) return; UI._back = true; if (t.p === 'phase') go('phase', t.ph || '1'); else if (t.s != null) go(t.p, t.s); else go(t.p) }
function backBtn() { return (UI.navStack && UI.navStack.length) ? '<button class="btn-ghost pad-chip-sm" onclick="goBack()">\u2190 Back</button>' : '' }
function go(page, step) {
  /* Give the program a chance to bank what is on screen first. The Pipeline's
     fields save themselves as they are typed (fldSave), so it defines no hook;
     Executive Readiness deliberately does not, and harvests the open page here
     instead — leave this out and every textarea in the program loses whatever
     was typed into it the moment the reader clicks anything. Never allowed to
     stop the navigation. */
  /* Called with where we are GOING, before any of the bridging below rewrites
     it. Executive Readiness ignores both arguments; the Leaders programs use
     them to reset the view state their own go() used to reset — which section
     of a decision is open, which modal, where the Assess battery is.

     Guarded by whether the reader actually typed on this page. The harvest
     writes EVERY field it can see into the document, not only the ones that
     changed, so leaving a page nobody touched still produced a document full of
     "edits" — the values the page happened to be showing. On its own that was
     only a wasted upload. Where it did damage was after the 5-second sync
     brought a colleague's change in: the harvest would write the values this
     reader's page was still showing straight back over it, from a page they had
     done nothing but look at. Their own work is never at risk here — if they
     typed, the harvest runs exactly as before. See _pageEdited. */
  /* A marked sub-field that is still inside its live-commit window: bank it
     before leaving, or the last few characters go with the page. A click takes
     focus off the field first, so this is the keyboard route. */
  try { flushLiveCommits(); } catch (e) { }
  try {
    var _pre = window.Modules && Modules.hook('beforeNavigate');
    if (_pre) {
      var _snap = _pageEdited ? null : docSnapshot();
      _pre(page, step);
      if (_snap) docRestore(_snap);   // looked at, not touched: keep nothing it wrote
      /* Touched: bank it. The harvest only writes into the document in memory —
         persisting was left to whatever happened to save next, so a page whose
         text is captured by nothing else (an Executive Readiness textarea) could
         be typed into, navigated away from, and still be sitting unsent when the
         tab closed. A no-op when the harvest changed nothing, like every other
         write. */
      else saveData();
    }
  } catch (e) { }
  _pageEdited = false;   // a new page starts untouched
  // Bridge: handle single-arg calls from pipeline module (go('1.2'), go('out-report'), etc.)
  if (step === undefined && page !== 'home' && page !== 'learn' && page !== 'pipeline' && page !== 'insights' && page !== 'phase5') {
    var v = page;
    if (v.match(/^\d+\.\d/)) { page = 'step'; step = v; }
    else if (v.indexOf('out-') === 0) { page = 'outcome'; step = v; }
    else if (v.indexOf('phase-') === 0) { page = 'phase'; step = v.split('-')[1]; }
  }
  if (page === 'step' && step === '5.1') { page = 'phase5'; step = undefined }
  var _wb = UI._back; UI._back = false;
  var _same = (page === currentPage) && ((step == null && currentStep == null) || step === currentStep);
  if (!_wb && currentPage && !_same) { (UI.navStack = UI.navStack || []).push({ p: currentPage, s: currentStep, ph: currentPhase && currentPhase.id }); if (UI.navStack.length > 25) UI.navStack.shift() }
  currentPage = page;
  currentPhase = null;
  if (page === 'phase' && step) {
    // Phase landing: find phase by ID (1-5), not step ID
    for (var i = 0; i < PH.length; i++) { if (String(PH[i].id) === String(step)) { currentPhase = PH[i]; currentStep = String(step); break } }
  } else {
    if (step) currentStep = step; else currentStep = null;
    if (currentStep) {
      for (var i = 0; i < PH.length; i++) {
        for (var j = 0; j < PH[i].steps.length; j++) { if (PH[i].steps[j].id === currentStep) { currentPhase = PH[i]; break } }
        if (currentPhase) break;
        if (PH[i].outcomes) { for (var k = 0; k < PH[i].outcomes.length; k++) { if (PH[i].outcomes[k].id === currentStep) { currentPhase = PH[i]; break } } }
        if (currentPhase) break;
      }
    }
  }
  render();
  /* Keep the address bar on the screen the user is actually looking at, so a
     refresh, a bookmark or a pasted link comes back to it. replaceState, not
     pushState: the app's own Back button walks UI.navStack above, and stacking
     a browser history entry per click would fight it. See js/router.js. */
  if (window.Router) Router.sync(page, step);
  var _nm = document.querySelector('.main-content'); if (_nm) _nm.scrollTop = 0;
  window.scrollTo(0, 0);
}

/* ═══════════════════════════════════════════════════════════════
   ZOOM CONTROLS — Pipeline & Navigate sections
   ═══════════════════════════════════════════════════════════════ */

// Initialize zoom from Store on load (after UI is declared)
(function () {
  try {
    var z = parseFloat(Store.getPref('zoom'));
    if (z >= 0.5 && z <= 2.0) UI.zoom = z;
  } catch (e) { }
})();

// Initialize theme from Store on load (after UI is declared). Device-local
// preference, key pipeline-theme (same family as zoom / sidebar-min), so it
// survives seeding and org resets by construction. Default: DARK — only an
// explicit 'light' preference opts out.
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

/* Apply the reader's own light/dark choice at sign-in — user login, org setup
   and admin login all route through here.

   This used to force DARK on every sign-in and overwrite the stored preference
   with it, so choosing Light Mode lasted exactly one session and was silently
   undone by the next login. That is defensible when dark is the only scheme
   anyone tuned; it is not, now that all twelve programs carry a light palette
   built and contrast-checked alongside the dark one (assets/css/themes.css).

   Dark remains the DEFAULT — for a first-time reader, and for anyone who has
   never touched the toggle — because shell.html applies it before first paint
   and nothing here overrides a choice that was never made.

   No render() of its own: each call site renders immediately afterwards. */
function applyLoginTheme() {
  var saved;
  try { saved = Store.getPref('theme'); } catch (e) { }
  UI.theme = (saved === 'light') ? 'light' : 'dark';
  try { document.documentElement.setAttribute('data-theme', UI.theme); } catch (e) { }
}

function setZoom(val) {
  var z = Math.max(0.5, Math.min(2.0, Math.round(val * 100) / 100));
  UI.zoom = z;
  try { Store.setPref('zoom', z); } catch (e) { }
  render();
}

function zoomIn() { setZoom((UI.zoom || 1) + 0.1); }
function zoomOut() { setZoom((UI.zoom || 1) - 0.1); }
function zoomReset() { setZoom(1); }

function zoomFit() {
  // Measure natural (unzoomed) height of the section, then pick the largest
  // scale that fits the available viewport height.
  var w = document.getElementById('zoomWrap');
  if (!w) return setZoom(1);
  var prevZoom = w.style.zoom || '';
  w.style.zoom = 1;
  // Force a reflow read
  var naturalH = w.scrollHeight;
  var viewportH = (window.innerHeight || 800) - 120;  // leave room for top nav + padding
  if (prevZoom) w.style.zoom = prevZoom;
  var fitScale = naturalH > 0 ? Math.max(0.5, Math.min(1, viewportH / naturalH)) : 1;
  setZoom(fitScale);
}

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

/* Field saves fire on change/blur, and a dozen of them re-render so the charts and
   totals they feed stay current. Rendering straight out of that event rebuilt the DOM
   before the browser had finished moving focus to the field being clicked or tabbed
   into: the node it was heading for was destroyed in flight, and the focus restore at
   the end of render() - which captured the field just LEFT - pulled the caret back
   into it. In the chart-bearing steps, where every field exit re-renders, that made
   moving between two fields take two clicks. It also swallowed clicks on buttons,
   since mouseup landed on a replaced node and no click event ever fired.

   So when render() is called from inside that transition, hold it until the click
   that caused it has finished - or until the end of the task, when the exit came from
   the keyboard and no click is coming. Focus lands on the new field against a live
   DOM and the click reaches its target; only then does the render run, and its focus
   restore now captures the field actually moved to. Anything driven by a click still
   renders synchronously, and a synchronous render cancels a pending deferred one so
   the two cannot double up. */
var _renderPending = null, _mouseIsDown = false;
try {
  document.addEventListener('mousedown', function () { _mouseIsDown = true }, true);
  document.addEventListener('mouseup', function () { _mouseIsDown = false }, true);
} catch (e) { }
/* ── Did the reader actually change anything on this page? ──────────
   One flag, set by the only two events that mean "a person edited a control":
   `input` (typing) and `change` (a dropdown, a checkbox, a radio, a date). Both
   are listened for in the CAPTURE phase on the document, so every field in every
   program is covered without touching a single line of markup — the programs
   build their HTML as strings with inline handlers, and there is no other single
   place they all pass through.

   It answers one question, asked in go(): may leaving this page write to the
   document? An "Add" button, a Save button or anything else that edits through
   the app's own functions does not need the flag — those call Store.commit /
   saveData directly and are unaffected by any of this.

   Reset when the page changes, NOT on every render: an Executive Readiness
   textarea is banked by the harvest and by nothing else, so a flag cleared by
   some unrelated repaint would throw away what the reader had typed. */
var _pageEdited = false;

/* ── Work that is on screen and nowhere else ────────────────────────
   Between the keystroke and the save there is a window in which the only copy
   of what somebody has written is the DOM. For a field that saves as it is
   typed that window is one keystroke long. For a field that saves when focus
   leaves it — a row added with "Add" — it lasts as long as they stay in the
   box. For a program that harvests the open page instead of saving per field
   (Executive Readiness) it lasts until they navigate.

   Nothing used to bridge that window. render() rebuilds #app from the document,
   so any repaint inside it reset the field to the stored value, and the repaint
   that did it was not one the reader had asked for: it was the 5-second sync,
   fired because somebody else had saved something somewhere else in the module.

   Three things close it, in order of preference:
     1. LIVE COMMIT — a sub-field marked data-live saves while it is being
        typed, like the main fields, instead of waiting for the blur.
     2. BANK — bankOpenPage() puts everything the page is holding into the
        document before a sync merge reads it, so it merges as MINE.
     3. RESTORE — whatever is still only in the DOM is re-applied after a sync
        repaint, with the caret where it was.
   _liveEdits is what makes (3) possible: the value of every field a person has
   typed into since the last paint. Cleared by each render, because a render
   the app itself asked for is the app's own intent about what the page shows. */
var _liveEdits = {};
/* What each field last put INTO the document, by field id — written by
   fldSave(), which is the Pipeline's one per-field save. It answers the
   question _liveEdits alone cannot: is the text on screen work that exists
   nowhere else, or a copy of something we already saved?

   Without it, a field that banks on every keystroke was indistinguishable from
   one that banks on nothing, and a colleague's edit arriving on the heels of
   our own save was painted and then immediately covered over again by our
   copy. See the restore loop in repaintAfterSync(), which is the only reader. */
var _bankedEdits = {};
function ownKey(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
var _lastInputAt = 0;
var _liveCommitTimers = {};
/* How long after the last keystroke a marked sub-field commits. Long enough to
   not fire mid-word, far shorter than the blur it replaces. */
var LIVE_COMMIT_MS = 400;
/* Inside a live commit, and inside a bank, a render is the app catching up a
   total or a chart. Neither is a reason to rebuild the page under someone's
   hands, so it is held and run when they leave the field. */
var _suppressRender = 0, _renderWanted = false;
var LIVE_INPUT_TYPES = { '': 1, text: 1, search: 1, url: 1, email: 1, tel: 1, number: 1, date: 1 };

/* Typing, for the store's benefit: it decides how long to hold a save for. */
function appIsTyping() { return (Date.now() - _lastInputAt) < 700; }

/* A control whose `value` is the thing on screen, so putting it back after a
   repaint restores what the reader sees. A checkbox and a radio are excluded:
   what they show is `checked`, and writing `value` on one would change what it
   submits rather than what it displays. */
function isValueField(el) {
  var tag = el && el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
  if (tag === 'INPUT') { var t = String(el.type || '').toLowerCase(); if (t === 'checkbox' || t === 'radio' || t === 'file') return false; }
  return ('value' in el);
}

(function () {
  try {
    var mark = function (ev) {
      _pageEdited = true;
      /* Before the early return below, which lets through only fields with an
         id whose `value` is what they show: a checkbox and a radio have neither,
         and ticking one is every bit as much an edit to save. */
      scheduleHarvestSave(ev && ev.type === 'input' ? HARVEST_TYPING_MS : HARVEST_CHANGE_MS);
      var el = ev && ev.target;
      if (!el || !el.id || !isValueField(el)) return;
      _liveEdits[el.id] = el.value;
      if (ev.type === 'input') { _lastInputAt = Date.now(); scheduleLiveCommit(el); }
    };
    document.addEventListener('input', mark, true);
    document.addEventListener('change', mark, true);
    /* A click is a discrete action — a score, a dropdown, an Add — and must not
       inherit the long typing window from whatever was being written a moment
       earlier. It saves on the short one. */
    document.addEventListener('mousedown', function () { _lastInputAt = 0; }, true);
    /* Leaving a field is where a held render belongs: the DOM may now be
       rebuilt without moving the caret out from under anybody. */
    document.addEventListener('focusout', function () {
      if (!_renderWanted || _suppressRender) return;
      _renderWanted = false;
      setTimeout(function () { try { render(); } catch (e) { } }, 0);
    }, true);
  } catch (e) { }
})();

/* A sub-field marked data-live saves what is in it a beat after the typing
   stops, through its own onchange handler — the same code the blur would have
   run, so no field needs a second save path. Only marked fields: an input whose
   onchange ADDS a row (gapAdd) would otherwise add one per word. */
function scheduleLiveCommit(el) {
  try {
    if (!el.id || !el.getAttribute || !el.getAttribute('data-live')) return;
    var tag = el.tagName;
    if (tag !== 'TEXTAREA' && tag !== 'INPUT') return;
    if (tag === 'INPUT' && !LIVE_INPUT_TYPES[String(el.type || '').toLowerCase()]) return;
    var id = el.id;
    if (_liveCommitTimers[id]) clearTimeout(_liveCommitTimers[id]);
    _liveCommitTimers[id] = setTimeout(function () {
      delete _liveCommitTimers[id];
      liveCommit(document.getElementById(id));
    }, LIVE_COMMIT_MS);
  } catch (e) { }
}
function liveCommit(el) {
  if (!el) return;
  _suppressRender++;
  try {
    try { el.dispatchEvent(new Event('change', { bubbles: false })); }
    catch (e) { try { if (typeof el.onchange === 'function') el.onchange({ type: 'change', target: el }); } catch (e2) { } }
  } finally { _suppressRender--; }   // a throwing handler must not leave renders held for good
}
/* Every marked field that is still waiting on its timer, committed now. */
function flushLiveCommits() {
  try {
    Object.keys(_liveCommitTimers).forEach(function (id) {
      clearTimeout(_liveCommitTimers[id]);
      delete _liveCommitTimers[id];
      liveCommit(document.getElementById(id));
    });
  } catch (e) { }
}

/* ── A page whose fields save nothing on their own ──────────────────
   Executive Readiness builds every field as plain markup and gives none of them
   a save: sel() writes a dropdown whose onchange only repaints the completion
   gate (steps.js), ta() a textarea whose oninput only resizes it. Their values
   reached the document through the harvest — and the harvest ran in exactly two
   places: leaving the page, and the sync banking the page before it merges
   somebody else's change.

   So choosing a dropdown and staying put saved nothing. Nobody else could see
   the choice, a reload dropped it, and closing the tab lost it. The merge work
   made an ARRIVING change safe; nothing there could help an edit that had never
   left the DOM in the first place.

   The same bank now also runs a beat after the edit itself, which is what gives
   these programs the per-edit saving every other program already had — and what
   makes "what saves, and when" the same answer in all of them. Only for
   programs that declare harvestOpenPage: everywhere else the control's own
   handler has already written to the document and there is nothing to collect.

   One timer, reset by each edit, because one interaction raises several events
   (a select's own onchange repaints, a live commit dispatches a change of its
   own) and the harvest reads the whole page every time it runs. */
var HARVEST_CHANGE_MS = 150;   // a dropdown, a checkbox, a date: finished the moment it fires
var HARVEST_TYPING_MS = 700;   // after the last keystroke, so a harvest never lands mid-word
var HARVEST_MAX_MS = 3000;     // …but never postponed past this, however long they keep typing
var _harvestTimer = null, _harvestCeiling = 0;

function scheduleHarvestSave(delay) {
  /* Inside a bank or a live commit already: the `change` that liveCommit
     dispatches is the app's own machinery rather than a person editing, and
     would schedule the next bank from inside this one. */
  if (_suppressRender) return;
  try { if (!(window.Modules && Modules.hook('harvestOpenPage'))) return; } catch (e) { return; }
  var t = Date.now();
  if (!_harvestTimer) _harvestCeiling = t + HARVEST_MAX_MS;   // from the first unbanked edit
  var due = t + delay;
  if (due > _harvestCeiling) due = _harvestCeiling;
  if (_harvestTimer) clearTimeout(_harvestTimer);
  _harvestTimer = setTimeout(function () {
    _harvestTimer = null; _harvestCeiling = 0;
    /* Nothing is checked here about where the reader now is. A page they have
       navigated away from clears _pageEdited, and a bank with that flag down
       collects nothing — so a timer left over from the page before is a no-op,
       not a stale write. */
    bankOpenPage();
  }, due - t > 0 ? due - t : 0);
}

/* Put everything the open page is holding into the document. Called before a
   sync merge reads it (Store.adoptDoc) so on-screen work is compared as MINE
   rather than painted over by the result.

   NOT beforeNavigate. That hook means "I am leaving this page": the Leaders
   programs use it to close the open decision card and reset their tabs, which
   is right on a navigation and wrong every five seconds. A program that needs
   its page harvested where nobody is navigating says so with harvestOpenPage —
   Executive Readiness, whose textareas have no per-field save at all. */
function bankOpenPage() {
  /* A step this member may not edit has nothing of theirs to bank. Said here
     rather than left to the disabled fields, because the harvest does not read
     one field — it reads the whole page and writes all of it, so a single
     control that escaped the read-only pass would carry the rest of the page's
     values into the document with it. */
  if (typeof editBlocked === 'function' && editBlocked(true)) return;
  _suppressRender++;
  try {
    flushLiveCommits();
    if (_pageEdited) {
      var harvest = window.Modules && Modules.hook('harvestOpenPage');
      if (harvest) {
        harvest(); saveData();
        /* The harvest reads the whole page into the document, so every field on
           it is banked now — the same note fldSave() leaves per keystroke, for
           the programs that have no per-field save at all. Without it their
           fields would be the pinned case instead: banked in fact, unbanked as
           far as the repaint could tell. */
        Object.keys(_liveEdits).forEach(function (id) {
          var fe = document.getElementById(id);
          if (fe && isValueField(fe)) _bankedEdits[id] = fe.value;
        });
      }
    }
  } catch (e) { } finally { _suppressRender--; }
}

/* Repaint the open page from a document the sync has just merged, without
   costing the reader anything they can see. Their focus and caret come back,
   and so does every field they had typed into — including the ones whose text
   had not reached the document, which is the whole point.

   _pageEdited is cleared afterwards on purpose: the page has just been painted
   from the document, so there is nothing on it that the document does not
   already have. Leaving it set would let a later harvest write the values this
   page happens to be showing back over a colleague's change. */
function repaintAfterSync() {
  var edits = _liveEdits, banked = _bankedEdits, f = null;
  try {
    var a = document.activeElement;
    if (a && a.id && isValueField(a)) {
      /* The focus and the caret come back whatever happens — that is what makes
         a sync invisible to somebody reading a step. */
      f = { id: a.id, s: (typeof a.selectionStart === 'number') ? a.selectionStart : null, e: (typeof a.selectionEnd === 'number') ? a.selectionEnd : null };
      /* Its VALUE only if this field is already known to be unbanked. Taking it
         unconditionally meant that merely PARKING the caret in a field was
         enough to pin it: the reader types, the text saves, they click a tab —
         an ordinary render, which clears both maps — and the next sync then
         read the box they happened to be sitting in as unsaved work and wrote
         it back over the colleague's edit that had just arrived. Nothing had
         been typed since the last paint, so there was never anything here to
         preserve. _liveEdits is exactly "typed since the last paint": the input
         listener writes it, render() clears it. */
      if (ownKey(edits, a.id)) edits[a.id] = a.value;
    }
  } catch (e) { }
  try { loadData(); applyTeamRoster(); render(); } catch (e) { }
  try {
    Object.keys(edits).forEach(function (id) {
      var el = document.getElementById(id);
      /* ── What may be put back, and what may not ──────────────
         This map exists for ONE thing: text that is on screen and nowhere else,
         so that a sync repaint does not wipe a half-typed answer. Anything else
         in it is a copy of the document, and putting a copy back over a paint
         is how a field gets PINNED — the reader watches their own sentence sit
         there while the document says something else, and their next keystroke
         sends the stale text back to the server. That is the "your saved change
         was replaced" the other members then get.

         Three ways an entry stops being unbanked work:
           · the field has gone from the page — it cannot be restored, and
             holding it only pins it if the id ever comes back;
           · the paint already shows it, so the document has it;
           · WE SAVED IT. _bankedEdits[id] is what this field last put into the
             document, and a match means the text is ours and already stored —
             so a paint that now shows something else is not the repaint losing
             our work, it is a colleague's edit arriving, and it stands.

         The third is the one this needs and the first two cannot supply. A
         field that saves on every keystroke (the Pipeline's do) is banked the
         instant it is typed, and if the very next thing to happen is a
         colleague's replacement arriving, no paint has ever agreed with the
         entry — so the first two tests both say "unbanked", and the stale text
         wins. Which is exactly what it did. */
      if (!el || !isValueField(el)) { delete edits[id]; return; }
      if (el.value === edits[id]) { delete edits[id]; return; }
      if (ownKey(banked, id) && banked[id] === edits[id]) { delete edits[id]; return; }
      el.value = edits[id];
    });
    /* Only the survivors keep a banked note; the rest are nobody's business
       now and the map is per-field, so it would otherwise only ever grow. */
    Object.keys(banked).forEach(function (id) { if (!ownKey(edits, id)) delete banked[id]; });
    _liveEdits = edits; _bankedEdits = banked;   // what is left is still unbanked
    if (f) {
      var el2 = document.getElementById(f.id);
      if (el2 && typeof el2.focus === 'function') {
        el2.focus();
        if (f.s != null && el2.setSelectionRange) el2.setSelectionRange(f.s, f.e == null ? f.s : f.e);
      }
    }
  } catch (e) { }
  _pageEdited = false;
  /* The panel does not close itself, and both of its lines are about a moving
     target — the document, and this member's own last change to the field. The
     document has just moved, so ask again. */
  try { if (typeof collabNoticeSync === 'function') collabNoticeSync(); } catch (e) { }
}

/* The active workspace, copied and put back. Used around a program's
   beforeNavigate hook so a harvest can be undone whole — cheaper and far safer
   than trying to work out which of the hundred fields it wrote was real. */
function docSnapshot() {
  try { return (typeof data === 'object' && data) ? JSON.stringify(data) : null; } catch (e) { return null; }
}
function docRestore(snap) {
  if (!snap) return;
  try {
    if (snap === JSON.stringify(data)) return;      // the harvest changed nothing
    data = JSON.parse(snap);
    /* Whatever the harvest wrote may already have been persisted from inside the
       hook (Executive Readiness saves the mindset family there), so put the
       restored document back through the store. It compares against what the
       server holds and, this being a straight undo, finds nothing to send. */
    saveData();
  } catch (e) { }
}

function renderIsFieldExit() {
  var ev = window.event; if (!ev) return '';
  var t = ev.type; if (t !== 'change' && t !== 'blur' && t !== 'focusout') return '';
  var el = ev.target, tag = el && el.tagName;
  return (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') ? tag : ''
}
function renderCancelPending() {
  if (!_renderPending) return;
  clearTimeout(_renderPending.timer);
  document.removeEventListener('click', _renderPending.onClick, true);
  _renderPending = null
}
/* `now` skips the wait for a select, whose change means the choice is already made -
   and whose native dropdown can swallow the mouseup, leaving no click to wait for. */
function renderAfterInteraction(now) {
  if (_renderPending) return;
  var fire = function () { if (!_renderPending) return; renderCancelPending(); render() };
  /* Capture fires before the target's own click handler, so hop a task to let that
     handler (which may render synchronously itself) finish first. The timer is the
     fallback for a press that never produces a click - released off-window, say. */
  var wait = _mouseIsDown && !now;
  var onClick = function () { setTimeout(fire, 0) };
  _renderPending = { onClick: onClick, timer: setTimeout(fire, wait ? 400 : 0) };
  if (wait) document.addEventListener('click', onClick, true)
}
/* The name the Executive Readiness textareas already call on blur: repaint, but
   not from inside the transition that is still moving focus. It had no
   definition, so every one of those blurs threw. */
function deferRender() { renderAfterInteraction(false); }
function render() {
  try { if (currentOrgId && currentUserId && window.chatWatch) chatWatch(); } catch (e) { }   /* Sweep 4R item 5: Team Chat listens from sign-in, so the badge can rise */
  /* Held: a live commit or a bank is running, and rebuilding the page from
     under a reader mid-sentence is exactly what this whole path exists to
     avoid. Run it when they leave the field (the focusout listener). */
  if (_suppressRender) { _renderWanted = true; return }
  var _fx = renderIsFieldExit();
  if (_fx) { renderAfterInteraction(_fx === 'SELECT'); return }
  renderCancelPending();
  _renderWanted = false;
  /* Past this point the page is rebuilt from the document, so nothing the app
     did not put there survives — which makes any record of in-progress typing
     stale. A sync repaint takes its copy before calling render and puts it back
     afterwards (repaintAfterSync); nobody else needs it. */
  _liveEdits = {};
  _bankedEdits = {};   // nothing is unbanked after a paint, so nothing to note
  try { notifySweepDeadlines() } catch (e) { }
  var _fEl = document.activeElement, _fid = _fEl && _fEl.id, _fsel = (_fEl && typeof _fEl.selectionStart === 'number') ? _fEl.selectionStart : null;
  try {
    var _ssEl = document.querySelector('.sidebar-scroll'), _mcEl = document.querySelector('.main-content');
    var _ssTop = _ssEl ? _ssEl.scrollTop : 0, _mcTop = _mcEl ? _mcEl.scrollTop : 0;
    var app = $('app'), nt = $('navTabs'), nr = $('navRight');
    var navEl = document.querySelector('nav'), ftEl = $('appFooter');
    /* A URL naming no role and no program is a 404 for everyone, signed in or
       not — it sits ABOVE the entry gate because showing sign-in there would
       imply the address exists and only the password is missing. The response
       already carried a 404 status (index.php); this is its body. */
    if (window.Router && Router.kind() === 'notfound' && window.Launchpad) {
      Launchpad.render(app);
      return;
    }
    // Sample tab (Part 3): never a sign-in form; a tab opened without a signed-in tab shows only A.3.6
    if (SAMPLE_MODE && (SAMPLE_REFUSED || !currentUserId || !getCurrentUser())) {
      if (nt) nt.innerHTML = '';
      if (nr) nr.innerHTML = '';
      if (navEl) navEl.style.display = 'none';
      if (ftEl) ftEl.style.display = 'none';
      var _sbS = $('pipSidebar'); if (_sbS) _sbS.style.display = 'none';
      var _tgS = $('sidebarToggle'); if (_tgS) _tgS.style.display = 'none';
      try { setCoachVisible(false); } catch (e) { }
      app.innerHTML = '<div class="sample-refused"><p>Sign in to your organization, then open Demo from the top bar.</p></div>';
      return;
    }
    // Entry gate: organization → user → passcode
    if (!currentOrgId || !currentUserId || !getCurrentUser()) {
      /* ── Signed out, and not at a door ────────────────────────────
         Sign-in used to be painted wherever the visitor happened to be, which
         is how a shared entry flow survived giving every program its own: at
         /apps/ it put up a role-less sign-in form, and at a program's plain
         address it put one up under a URL that claimed a program nobody had
         been let into. Both are answered by sending the visitor to a real
         address instead of painting one over another.

           a PROGRAM's address  → that program's own /login. It exists, it is
                                  refreshable, and the form there already knows
                                  which role space it is for.
           the launchpad or a   → no program, so no door: the launchpad lists
           role hub               them, and each card leads to its own.

         Neither applies on an entry address (kind 'auth' — the door itself),
         nor when nothing served the page (file://, the harness), which has no
         URLs to move between and keeps the in-place screen. */
      if (window.Router && Router.served() && Router.kind() === 'module') {
        /* A session record this browser still holds, with nobody signed in, is a session the server ended
           (Directive 2 Oct 2026, Part 6: signed out, its organization is not even listed). Say so at the door. */
        try { var _sr = Store.getSession(), _rr = Store.getRemember(); if ((_sr && !_sr.admin) || _rr) { sessionStorage.setItem('nc-session-ended', '1'); Store.setSession(null); Store.setRemember(null); } } catch (e) { }
        Router.openAuth('login'); return;
      }
      if (window.Launchpad && Launchpad.owns()) { Launchpad.render(app); return; }
      if (nt) nt.innerHTML = '';
      if (nr) nr.innerHTML = '';
      if (navEl) navEl.style.display = 'none';
      if (ftEl) ftEl.style.display = 'none';
      var _sb = $('pipSidebar'); if (_sb) _sb.style.display = 'none';
      /* The mobile drawer is painted by Nav.render(), which this branch never
         reaches — so signing out from inside an open drawer would leave the
         sheet sitting over the sign-in screen. Clear the host here, where the
         rest of the program chrome is cleared. */
      var _dh = $('navDrawerHost'); if (_dh) { _dh.innerHTML = ''; _dh.className = ''; }
      UI.navDrawer = false;
      app.classList.remove('sidebar-mini'); app.classList.add('sidebar-collapsed');
      // AI Guide coach belongs to the signed-in app only — hide it on the
      // login / setup / admin sign-in screens (and close it if it was open).
      setCoachVisible(false);
      renderEntry(app); // auth.js (window.Entry) mounts the sign-in / setup / admin screen and manages its own focus
      if (typeof updateAdminBar === 'function') updateAdminBar();
      return;
    }
    /* Signed in, but at an address that names no program: the launchpad, a
       role hub, or a 404. They render like the entry screens — no program
       header, no sidebar — because no program has been chosen. See
       js/launchpad.js. */
    if (window.Launchpad && Launchpad.owns()) {
      Launchpad.render(app);
      if (typeof updateAdminBar === 'function') updateAdminBar();
      return;
    }
    /* Signed in, but still standing at a door — a program's /login, or the root
       /signup or /admin. Go through it rather than painting the entry screen
       over a workspace this account can already open.

       bootApp() handles the page-LOAD case; this handles every other way of
       arriving here signed in, which is what actually bit: finishing (or simply
       closing) the sign-up form leaves you signed in, still on the /signup
       address, looking at a program you have not been sent to yet. */
    if (window.Router && Router.kind() === 'auth'
      && Router.landAfterAuth(accountType())) return;

    /* Inside a program: send the account away before painting a role space it
       is not entitled to. The API refuses the same request anyway; this just
       spares the user a screen that would fail every save. */
    if (window.Router && Router.enforceRole(accountType())) return;

    /* Belt and braces on the wordmark: it was applied once at load from the
       URL's kind, so make it agree with what is actually being rendered. Any
       future path that shows a program from a non-program address gets the
       right name rather than the suite's. */
    if (window.Modules && Modules.applyIdentity) Modules.applyIdentity('module');
    if (navEl) navEl.style.display = '';
    if (ftEl) ftEl.style.display = '';
    setCoachVisible(true); // signed in → AI Guide FAB is available again
    // Top navigation bar (tabs + right-side actions + More menu) → nav.js module (window.Nav).
    if (window.Nav) Nav.render();
    var h = '';
    // Screens migrated to <name>.html + <name>.js (see screen-loader.js).
    // Each entry maps a page id to its container-based render function.
    var SCREEN_MODULES = { home: window.renderHome, learn: window.renderLearn, insights: window.renderInsights };
    var screenFn = SCREEN_MODULES[currentPage];
    // The active program's own pages come first: a module that defines a page
    // owns it, and anything it doesn't define falls through to the shell's
    // route table below (which is still the Pipeline's).
    var modFn = window.Modules && Modules.page(currentPage);
    if (modFn) { h = modFn(); screenFn = null; }
    else if (screenFn) { screenFn(app); }
    else if (currentPage === 'pipeline') h = renderPipelineOverview();
    else if (currentPage === 'step') h = renderStep();
    else if (currentPage === 'phase') h = renderPhaseLandingPipe(currentPhase ? currentPhase.id : 1);
    else if (currentPage === 'outcome') h = renderOutcome();
    else if (currentPage === 'phase5') h = renderPhase5();
    else if (currentPage === 'cap-hub') h = renderCapHub();
    else if (currentPage === 'reports') h = renderReports(); /* 16 Sep 2026: the Report Manager page */
    else if (currentPage === 'review') h = renderReviewPage(); /* 17 Sep 2026: the Quarterly Review page */
    else if (currentPage === 'portfolio') h = renderPortfolioPage(); /* 17 Sep 2026: a live portfolio page */
    else if (currentPage === 'mgmt-hub') h = renderMgmtHub();
    if (!screenFn) {
      if (h.indexOf('id="zoomWrap"') < 0) { var _zs = (UI.zoom && UI.zoom !== 1) ? (' style="zoom:' + UI.zoom + '"') : ''; h = '<div class="zoom-wrap" id="zoomWrap"' + _zs + '>' + h + '</div>'; }
      /* A module may paint its own modals. The Pipeline and Executive
         Readiness use the shell's #modalRoot; the Leaders programs build theirs
         as part of the page, the way their reference builds did. OUTSIDE the
         zoom wrapper on purpose — a modal is chrome, and zooming the page
         should not move the dialog off centre. */
      var _mm = window.Modules && Modules.hook('renderModal');
      app.innerHTML = h + (_mm ? _mm() : '') + chartZoomOverlay();
    }
    if (_fid) { setTimeout(function () { try { var _fe2 = document.getElementById(_fid); if (_fe2 && typeof _fe2.focus === 'function') { _fe2.focus(); if (_fsel != null && typeof _fe2.setSelectionRange === 'function') _fe2.setSelectionRange(_fsel, _fsel) } } catch (_e) { } }, 0) }
    /* #modalRoot sits outside #app, so the paint above does not touch an open
       modal. My Assignments is repainted here because its content is a view of
       the workspace and the workspace moves under it: the change poll merges a
       colleague's save and calls render (repaintAfterSync), and a step they
       completed has to drop into the modal's Completed section without the
       reader closing and reopening it. The other modals are self-contained
       forms and are repainted by their own handlers. */
    try { if (currentModal === 'assignments') renderAssignmentsModal(); } catch (e) { }
    renderSidebar();
    syncNavHeight();
    setTimeout(function () { var els = document.querySelectorAll('.reveal'); for (var i = 0; i < els.length; i++) { (function (el, d) { setTimeout(function () { el.classList.add('visible') }, d) })(els[i], i * 60) } }, 50);
    carouselInit();
    if (coachOpen) renderCoachPanel();
    if (notesOpen) renderNotesPanel();
    initBalancePops();
    updateNotesCount();
    updateAdminBar();
    var _ss2 = document.querySelector('.sidebar-scroll'); if (_ss2 && _ssTop) _ss2.scrollTop = _ssTop;
    var _mc2 = document.querySelector('.main-content'); if (_mc2 && _mcTop) _mc2.scrollTop = _mcTop;
    var _gk = currentStep + '/' + (UI.sec || ''); if (_gk !== _lastGateStep) { gateArmed = false; _lastGateStep = _gk; } if (gateArmed) paintGates(); applyLockUI(true);
    ensureSampleNote();
  } catch (e) { $('app').innerHTML = '<div class="u-d829b04"><h2>Error</h2><pre>' + e.message + '</pre></div>'; console.error(e) }
}

/* ── Reset all data ───────────────────────────────────────────────
   Clears THIS PROGRAM's work, and nothing else.

   The workspace document is already per module (workspaces is keyed
   (organization_id, module)), so a reset never reached another program. What it
   did reach were the few keys inside that document which are not the program's
   content at all: every module caches the ORGANIZATION in its own document —
   the team roster, the company profile, and the flag that says first-run setup
   was done (applyTeamRoster / hydrateRosterFromRegistry, js/features/org-admin.js).

   Rebuilding those from emptyData() with the rest is what made "Reset all data"
   read as "delete my organization". The org name and profile went blank, the
   setup wizard came back, and — because data.roster is where USERS comes from —
   the signed-in user was no longer on the team, which bootApp reads as a stale
   session and answers with the sign-in screen. Nothing was ever deleted on the
   server: a workspace save touches neither the organizations nor the users
   table (api/controllers/WorkspaceController.php). The browser had simply
   thrown away its own copy of who they were.

   So these keys are carried across the reset, and only the program's content is
   rebuilt. */
var ORG_LEVEL_KEYS = ['roster', 'members', 'enterprise', 'orgSetup', 'settings'];   /* settings: the AI switches (Part 2) survive a reset (Part 4.2.2) */

function clearData() { if (!canManageOrg()) return;   /* Sweep 4R item 10: resetting the program's data is for administrators; it checks its caller itself */
  if (!confirm('Reset all ' + stateModuleName() + ' progress for this organization?\n\n'
    + 'Your organization, your team and your sign-in are kept — only this program’s work is cleared. This cannot be undone.')) return;
  var keep = {};
  ORG_LEVEL_KEYS.forEach(function (k) {
    if (data && Object.prototype.hasOwnProperty.call(data, k)) keep[k] = data[k];
  });
  data = emptyData();
  ORG_LEVEL_KEYS.forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(keep, k)) data[k] = keep[k];
  });
  saveData(); applyTeamRoster(); render();
  /* A reset is a "replace everything" action, like the seed and the import, so
     it is persisted authoritatively (base_rev:null) rather than left to the
     debounced flush — which sends only the sections it can diff against its
     baseline and races the change poll. No-ops on file:// or an unlinked org. */
  try {
    if (currentOrgId && Store.commitSeed) Store.commitSeed(currentOrgId, data, function (ok) {
      if (typeof showToast === 'function') {
        showToast(ok ? 'This program’s data has been reset.'
          : 'Reset on this device, but saving to the database failed.', ok ? '' : 'error');
      }
    });
  } catch (e) { }
}
/* A workspace document belongs to ONE program. The Pipeline's is ideas,
   projects and a capital envelope; Executive Readiness's is leaders, an org
   chart and a scored battery; they share almost no fields. So the export names
   the program it came out of — in the payload, so import can check it, and in
   the filename, so a folder of these is readable. Everything was called
   "pipeline-state-acme-2026-07-31.json" before, whichever program produced it. */
function stateModuleId() { return (window.Modules && Modules.activeId()) || 'pipeline'; }
function stateModuleName() {
  var m = window.Modules && Modules.active();
  return (m && m.name) || 'this program';
}
function slug(s) { return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(); }

/* A copy of the workspace with no password-bearing field on any person (Directive 2 Oct 2026, 5.8.9). */
function dataWithoutPasswords(d) {
  var c = JSON.parse(JSON.stringify(d || {}));
  ['roster', 'members'].forEach(function (f) { (Array.isArray(c[f]) ? c[f] : []).forEach(function (u) { if (u) { delete u.passcode; delete u.password; delete u.passwordHash; delete u.mustChange; } }); });
  return c;
}
function exportState() {
  try {
    var org = (getOrg(currentOrgId) || {}).name || 'workspace';
    var mid = stateModuleId();
    var payload = {
      app: 'nextchapter-pipeline', type: 'workspace-state', schema: 'pipeline-v3',
      module: mid, moduleName: stateModuleName(),
      org: org, exportedAt: new Date().toISOString(), data: dataWithoutPasswords(data)
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url;
    a.download = slug(mid) + '-state-' + (slug(org) || 'workspace') + '-' + new Date().toISOString().split('T')[0] + '.json';
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
  try { parsed = JSON.parse(text); } catch (e) { alert('That file is not valid JSON.'); return; }
  var d = (parsed && typeof parsed === 'object' && parsed.data) ? parsed.data : parsed;
  if (!d || typeof d !== 'object' || (d.completedSteps === undefined && d.ideas === undefined && d.purpose === undefined)) { alert('That does not look like a workspace state file.'); return; }
  /* REFUSE another program's document, rather than asking. Import replaces the
     whole workspace, and the two documents have almost no fields in common —
     loading the Pipeline's into Executive Readiness does not produce a partly
     filled program, it produces an empty one, with the other program's content
     stored under this one's name and the original gone. The old check passed
     both ways round, because `completedSteps` is the one key they share.
     Files exported before the module was recorded carry no `module` and are
     still accepted; there was only one program when they were written. */
  var fileModule = parsed && typeof parsed === 'object' ? parsed.module : null;
  if (fileModule && fileModule !== stateModuleId()) {
    var them = (window.Modules && Modules.byId(fileModule) || {}).name || fileModule;
    alert('That file is a ' + them + ' workspace, and this is ' + stateModuleName() + '.\n\n'
      + 'Each program keeps its own workspace, and their contents are not interchangeable. '
      + 'Open ' + them + ' and import it there.');
    return;
  }
  if (parsed && parsed.schema && parsed.schema !== 'pipeline-v3') { if (!confirm('This file was exported from a different schema (' + parsed.schema + '). Import anyway?')) return; }
  if (!currentOrgId) { alert('Open a workspace before importing a state.'); return; }
  if (!confirm('Import this state? It replaces the current workspace\u2019s data. Export first if you want to keep it.')) return;
  try {
    Store.writeOrg(currentOrgId, d);
    loadData(); applyTeamRoster();
    Auth.setSession((USERS[0] && USERS[0].id) || currentUserId);
    render();
    // Import is a "replace everything" action, like the seed \u2014 persist it to the
    // database authoritatively (base_rev:null force-save) rather than leaving it
    // to the debounced, optimistic-concurrency flush, which on some orgs races
    // the change-poll and can drop the import. No-ops locally / on an unlinked org.
    try {
      if (Store.commitSeed) Store.commitSeed(currentOrgId, data, function (ok) {
        if (typeof showToast === 'function') {
          showToast(ok ? 'Workspace imported and saved to the database.'
            : 'Imported on this device, but saving to the database failed.', ok ? '' : 'error');
        }
      });
    } catch (e) { }
  } catch (e) { alert('Import failed: ' + ((e && e.message) || e)); }
}

// ═══════════════════════════════════════
// === HOME === (moved to home.html + home.js)

// === LEARN === (moved to learn.html + learn.js)

// ═══════════════════════════════════════
// === PIPELINE ===
function renderPipeline() {
  var stages = getStages();
  var h = '<div class="pt-100"><div class="wrap u-5d173d9">';
  h += '<div class="section-label reveal">The 90-Day Journey</div>';
  h += '<div class="section-title reveal">Your <em>Innovation Pipeline</em></div>';
  h += '<p class="section-body reveal mb-12">Five phases. Structured progression. Each phase builds the infrastructure for the next. Work through every step in order — the sequence matters.</p>';

  // Pipeline viz
  h += '<div class="pipe-viz reveal">';
  var stageCounts = [bsNowList(stages).length, stages.explore.length, stages.experiment.length, stages.operational.length];
  var stageLabels = ['Blue Sky', 'Exploration', 'Development', 'Operational'];
  for (var i = 0; i < stageLabels.length; i++) {
    h += '<div class="pipe-stage" onclick="go(\'phase5\')">';
    h += '<div class="pipe-stage-name four-color" style="--c:' + (['#1B6B5A', '#2D5A8E', '#8B5E3C', '#9B2D3F'][i]) + '">' + stageLabels[i] + '</div>';
    h += '<div class="pipe-stage-count four-color" style="--c:' + (['#1B6B5A', '#2D5A8E', '#8B5E3C', '#9B2D3F'][i]) + '">' + stageCounts[i] + '</div>';
    h += '<div class="u-1e23254">items</div>';
    h += '</div>'
  }
  h += '</div>';

  h += '</div>';

  // Phase grid
  h += '<div class="timeline-wrap reveal"><div class="wrap"><div class="timeline-phases">';
  for (var i = 0; i < PH.length; i++) {
    var ph = PH[i];
    var stepsTotal = ph.steps.length; var stepsDone = ph.steps.filter(function (s) { return isStepDone(s.id) }).length;
    h += '<div class="timeline-phase" onclick="go(\'step\',\'' + ph.steps[0].id + '\')" class="ph-border-top" style="--c:' + ph.color + '">';
    h += '<div class="phase-num ph-color" style="--c:' + ph.color + '">Phase ' + ph.id + ' · ' + ph.days + '</div>';
    h += '<div class="phase-name t-paper">' + ph.name + '</div>';
    h += '<div class="phase-days">' + stepsDone + '/' + stepsTotal + ' complete</div>';
    h += '<div class="phase-steps">';
    for (var j = 0; j < ph.steps.length; j++) { var s = ph.steps[j]; h += '<div class="ph-done-c" style="--c:' + (isStepDone(s.id) ? ph.color : 'var(--stone)') + '">' + s.icon + ' ' + s.name + '</div>' }
    h += '</div>';
    h += '<div class="mt-4"><button class="btn-ghost ph-tag" style="--c:' + ph.color + '">Enter Phase →</button></div>';
    h += '</div>'
  }
  h += '</div></div></div>';
  h += '</div>';
  return h;
}

// === STEP ===
function renderStep() {
  if (!currentStep) return renderPipeline();
  var ph = currentPhase; if (!ph) return renderPipeline();
  var stepObj = null; for (var j = 0; j < ph.steps.length; j++) { if (ph.steps[j].id === currentStep) { stepObj = ph.steps[j]; break } }
  if (!stepObj) return renderPipeline();

  var h = '<div class="content-area"><div class="content-inner">';
  // Breadcrumb
  h += '<div class="u-79840ab">';
  h += (UI.navStack && UI.navStack.length ? backBtn() : '<button class="btn-ghost u-a2dbf3b" onclick="go(\'pipeline\')">← Pipeline</button>');
  h += '<div class="u-463b2e1">Phase ' + ph.id + ' · ' + ph.name + ' <span class="t-gold">/ ' + stepObj.name + '</span></div>';
  h += '</div>';

  // Step nav
  h += '<div class="step-nav">';
  for (var j = 0; j < ph.steps.length; j++) {
    var s = ph.steps[j]; var done = isStepDone(s.id);
    h += '<button class="step-nav-btn' + (currentStep === s.id ? ' active' : '') + (done ? ' done' : '') + '" onclick="go(\'step\',\'' + s.id + '\')">';
    h += (done ? '✓ ' : s.icon + ' ') + s.name + '</button>'
  }
  h += '</div>';

  // Progress pips
  h += '<div class="step-progress">';
  for (var j = 0; j < ph.steps.length; j++) { var s = ph.steps[j]; h += '<div class="step-pip' + (currentStep === s.id ? ' active' : isStepDone(s.id) ? ' done' : '') + '" title="' + s.name + '"></div>' }
  h += '</div>';

  // Header
  h += '<div class="step-header">';
  h += '<div class="step-eyebrow">Step ' + stepObj.id + ' · ' + ph.days + ' · ' + ph.name + '</div>';
  h += '<h1 class="step-title">' + stepObj.icon + ' ' + stepObj.name + '</h1>';
  h += '</div>';
  h += stepAssignBar(currentStep);

  // Step content
  h += renderStepContent(currentStep);

  // Milestone
  var ms = MILESTONES[currentStep];
  if (ms && isStepDone(currentStep)) {
    h += '<div class="milestone-card">';
    h += '<div class="milestone-label">✓ Milestone Reached</div>';
    h += '<div class="milestone-text">' + ms + '</div>';
    h += '</div>';
    // Phase-complete box: this step is the phase's final step and every step in the phase is done
    var _php = PH.find(function (px) { return px.steps.some(function (sx) { return sx.id === currentStep }) });
    if (_php && PHASE_WRAPUPS[_php.id] && _php.steps[_php.steps.length - 1].id === currentStep && _php.steps.every(function (sx) { return isStepDone(sx.id) })) {
      h += '<div class="milestone-card">';
      h += '<div class="milestone-label">\u2713 Phase ' + _php.id + ' Complete</div>';
      h += '<div class="milestone-text">' + PHASE_WRAPUPS[_php.id] + '</div>';
      h += '</div>';
    }
  }

  // Navigation
  var allSteps = []; for (var i = 0; i < PH.length; i++)for (var j = 0; j < PH[i].steps.length; j++)allSteps.push(PH[i].steps[j]);
  var curIdx = allSteps.findIndex(function (s) { return s.id === currentStep });
  h += '<div class="u-2135eb3">';
  if (curIdx > 0) { var prev = allSteps[curIdx - 1]; h += '<button class="btn-ghost" onclick="go(\'step\',\'' + prev.id + '\')">← ' + prev.name + '</button>' } else { h += '<div></div>' }
  if (curIdx < allSteps.length - 1) { var next = allSteps[curIdx + 1]; h += '<button class="btn-gold" onclick="go(\'step\',\'' + next.id + '\')">' + next.name + ' →</button>' }
  h += '</div>';

  h += '</div></div>';
  return h;
}

// === PIPELINE STEP FUNCTIONS ===
// Step content is rendered by re-skinned pipeline module functions.
// The master's renderStep() provides the shell (breadcrumb, step nav, progress pips, header, context, nav buttons).
// renderStepContent() routes to the pipeline's step renderers.

function renderStepContentBody(id){
  if(id==='1.1')return renderStep11();
  if(id==='1.2')return renderStep12();
  if(id==='1.3')return renderStep13();
  if(id==='2.1')return renderStep21();
  if(id==='2.2')return renderStep22();
  if(id==='2.3')return renderStep23();
  if(id==='2.4')return renderStep24();
  if(id==='3.1')return renderStep31();
  if(id==='3.2')return renderStepCap();
  if(id==='3.3')return renderStepAlloc();
  if(id==='3.4')return renderStepExp();
  if(id==='4.1')return renderStep41();
  if(id==='4.2')return renderStep42();
  if(id==='4.3')return renderStep43();
  if(id==='4.4')return renderStep44();
  if(id==='5.1')return renderPhase5Content();
  return '<p class="inline-stone">Coming soon.</p>';
}

// === PIPELINE STEP FUNCTIONS ===
// Step content is rendered by re-skinned pipeline module functions.
// The master's renderStep() provides the shell (breadcrumb, step nav, progress pips, header, context, nav buttons).
// renderStepContent() routes to the pipeline's step renderers.


// ═══════════════════════════════════════
// PIPELINE MODULE FUNCTIONS (re-skinned)
// === PIPELINE OVERVIEW ===
function renderPipelineOverview() {
  var h = '<div class="pt-100"><div class="wrap u-54bc797">';
  h += '<div class="zoom-wrap" id="zoomWrap"' + ((UI.zoom && UI.zoom !== 1) ? (' style="zoom:' + UI.zoom + '"') : '') + '>';
  h += backBtn() ? '<div class="mb-3">' + backBtn() + '</div>' : '';
  h += '<div class="overview-video-card mb-6"><div class="overview-video-label">Module Overview</div>'
    + '<video class="overview-video" controls preload="auto" playsinline><source src="assets/media/innov-module-overview.mp4" type="video/mp4">Your browser does not support embedded video.</video></div>';
  h += vizTimeline(0);
  h += asgnOverviewCard();   // the signed-in user's open assignments, under the 90-day timeline
  h += '<div class="u-4d06b89">' + badge('90-Day Module', '#1B6B5A') + '<h1 class="u-da9c7f5">Build Your AI <em class="t-blue">Innovation Pipeline</em></h1><p class="u-c9b7d79">From standing start to functioning pipeline in 90 days.</p></div>'; h += vizStatStrip();
  // Phase cards
  PH.forEach(function (ph) {
    h += card('<div class="u-1390122" onclick="go(\'phase-' + ph.id + '\')"><div><div class="flx-center gap-2 mb-1"><span class="ph-circle-28" style="--c:' + ph.color + '">' + ph.id + '</span><h3 class="u-a5b9245">' + ph.name + '</h3>' + badge(ph.days, ph.color) + '</div><div class="u-d9edac8">' + ph.steps.map(function (s) { return s.name }).join(' \u2192 ') + '</div></div><span class="u-ef4626c">\u2192</span></div>', 'margin-bottom:12px')
  });
  h += '</div></div></div>'; return h
}

// ═══════════════════════════════════════
// === STATE MANAGEMENT ===
// go() handled by master
function esc(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function val(id) { var e = $(id); return e ? e.value : '' }
function updObj(base, field, val) { if (!data[base]) data[base] = {}; data[base][field] = val; Store.commit(base, field); render() }
function updNested(base, idx, field, val, silent) { if (!data[base]) data[base] = {}; if (!data[base][idx]) data[base][idx] = {}; data[base][idx][field] = val; Store.commit(base, idx); if (!silent) render() }

// === PHASE data ===
// PH in master data

// STEP_CTX in master data

// STEP_MILES in master data

var PHASE_DESCS = {
  1: { n: 'Before you build anything, you need to see clearly where you stand. These first thirty days are for diagnosis, not action \u2014 you won\u2019t buy a tool or launch a project yet. You\u2019ll map your purpose, your culture, your current spending, and who actually holds the authority to decide. The ground you build on determines whether anything you build will stand.', arts: [{ t: '90 Days to an AI Innovation Pipeline', s: 'Fast Company' }, { t: 'The right (and wrong) way for leaders to think about AI', s: 'Fast Company' }, { t: 'The dual challenge of AI', s: 'I by IMD' }] },
  2: { n: 'You\u2019ve mapped the ground. Now you build the machinery that gives your ideas somewhere to succeed. Nothing launches in this phase \u2014 the point is to put the structure in place first: clear ownership, incentives that reward the right behavior, and a protected rhythm for looking forward. Your culture won\u2019t change because you drew a new org chart. It changes when you shift what the organization values.', arts: [{ t: 'Three myths that undermine AI success', s: 'Fast Company' }, { t: 'The age of AI requires a new kind of leadership', s: 'Fast Company' }] },
  3: { n: 'The infrastructure is in place. Now you load the portfolio and get your first projects ready to launch. Hold on to the idea that matters most in the whole program: treat your initiatives as an interconnected investment portfolio, not a to-do list. Most organizations don\u2019t have an idea problem \u2014 they have a portfolio problem. You\u2019ll build a deliberate mix across time horizons, fund it with discipline, and design your first experiments to launch.', arts: [{ t: 'Transform your AI adoption strategy', s: 'I by IMD' }, { t: '7 things every leader must do to prepare for 2026', s: 'Fast Company' }] },
  4: { n: 'The machinery is built and the portfolio is loaded. This is the final stretch, where the plan becomes reality. You\u2019ll launch your first experiments, establish the governance that outlasts these ninety days, stress-test how your organization is holding up, and run your first portfolio review. Early, visible results are the strongest antidote there is to organizational paralysis \u2014 so pay close attention to what breaks, because the failure points show you where your real constraints are.', arts: [{ t: 'When it comes to AI, innovation isn\'t enough', s: 'Fast Company' }, { t: 'If you want to get AI right, look past the technology', s: 'Fast Company' }] }
};

var STEP_FLOW = { 1: [{ id: '1.1', icon: '■', sh: 'Assess' }, { id: '1.2', icon: '◇', sh: 'Brainstorm' }, { id: '1.3', icon: '▽', sh: 'Filter' }], 2: [{ id: '2.1', icon: '+', sh: 'Ownership' }, { id: '2.2', icon: '⇄', sh: 'Incentives' }, { id: '2.3', icon: '↻', sh: 'Rhythm' }, { id: '2.4', icon: '↧', sh: 'Deepen' }], 3: [{ id: '3.1', icon: '▒', sh: 'Structure' }, { id: '3.2', icon: '▦', sh: 'Capacity' }, { id: '3.3', icon: '◻', sh: 'Capital' }, { id: '3.4', icon: '△', sh: 'Map Track' }], 4: [{ id: '4.1', icon: '▷', sh: 'Run Track' }, { id: '4.2', icon: '—', sh: 'Governance' }, { id: '4.3', icon: '✕', sh: 'Stress Test' }, { id: '4.4', icon: '↗', sh: 'Review' }] };

// === HELPERS ===
function triageScore(i) { var a = (data.assessments || {})[i]; if (!a) return 0; return (a.priority || 0) + (a.risk || 0) + (a.value || 0) + (a.costScore || 0) + (a.difficulty || 0) }
function getScore(i) { var p = (data.projects || {})[i], a = (data.assessments || {})[i] || {}; if (p && p.rescore3 && p.rescore3Done) { var q = p.rescore3; return (q.priority != null ? q.priority : (a.priority || 0)) + (q.risk != null ? q.risk : (a.risk || 0)) + (q.value != null ? q.value : (a.value || 0)) + (q.costScore != null ? q.costScore : (a.costScore || 0)) + (q.difficulty != null ? q.difficulty : (a.difficulty || 0)) } if (p && p.rescore && p.rescoreDone) { var r = p.rescore; return (r.priority != null ? r.priority : (a.priority || 0)) + (r.risk != null ? r.risk : (a.risk || 0)) + (r.value != null ? r.value : (a.value || 0)) + (r.costScore != null ? r.costScore : (a.costScore || 0)) + (r.difficulty != null ? r.difficulty : (a.difficulty || 0)) } return triageScore(i) }
function resolveBands(i, stage) {
  var pb = (data.portfolio || {})[i] || {};
  if (stage === 'bluesky') { var s1 = suggestedBands(i); return { h: s1.horizon, r: s1.risk, w: s1.reward, conf: true } }
  var graded = !!(pb.horizon && pb.risk && pb.reward);
  if (graded) return { h: pb.horizon, r: pb.risk, w: pb.reward, conf: true };
  var s2 = suggestedBands(i); return { h: pb.horizon || s2.horizon, r: pb.risk || s2.risk, w: pb.reward || s2.reward, conf: false }
}
function balanceFlags(res) {
  if (res.length < 3) return []; var f = [];
  var cnt = function (k, v) { return res.filter(function (x) { return x[k] === v }).length };
  var nd = function (k) { return res.filter(function (x) { return !!x[k] }).length };
  if (nd('h') >= 3 && cnt('h', 'quick') === 0) f.push('No quick wins in the mix \u2013 nothing delivers near-term value.');
  if (nd('w') >= 3 && cnt('w', 'high') === 0) f.push('No high-reward bets in the mix.');
  [['h', 'quick', 'quick-win'], ['h', 'medium', 'medium-term'], ['h', 'long', 'long-horizon'], ['r', 'high', 'high-risk'], ['r', 'low', 'low-risk'], ['w', 'low', 'low-reward']].forEach(function (d) { var c = cnt(d[0], d[1]), m = nd(d[0]); if (c >= 2 && m >= 3 && c * 3 >= m * 2) f.push('Concentrated: ' + c + ' of ' + m + ' are ' + d[2] + '.') });
  return f
}
function balanceFlagPop(site, fl) {
  if (!fl || !fl.length) return ''; if (!UI.balDismissed) UI.balDismissed = {}; var key = site + '|' + fl.join('|'); if (UI.balDismissed[key]) return '';
  return '<div class="bal-pop-wrap" data-balkey="' + esc(key) + '" style="position:absolute;left:0;top:0;right:0;bottom:0;display:flex;visibility:hidden;align-items:center;justify-content:center;z-index:6;background:rgba(26,22,18,.55);border-radius:12px">'
    + '<div style="max-width:400px;margin:0 16px;background:var(--bg-elev);border:1px solid var(--warn-text);border-radius:10px;padding:18px 20px;box-shadow:0 10px 32px rgba(0,0,0,.5)">'
    + '<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:var(--warn-text);margin-bottom:8px">\u26a0 PORTFOLIO BALANCE</div>'
    + fl.map(function (t) { return '<p style="font-size:13px;line-height:1.5;color:var(--paper);margin:4px 0">' + esc(t) + '</p>' }).join('')
    + '<button class="btn-gold" style="margin-top:12px;padding:8px 18px;font-size:13px" onclick="dismissBalPop(this)">Got it</button>'
    + '</div></div>'
}
function balanceHead(fl, stage) {
  var _bt = ({ explore: 'Exploration Portfolio Balance', experiment: 'Development Portfolio Balance', operational: 'Operational Portfolio Balance', bluesky: 'Blue Sky Portfolio Balance' })[stage] || 'Portfolio Balance'; var w = (fl && fl.length) ? '<div class="h-sub-md" style="color:#9B2D3F;margin:0;flex:1;text-align:right">\u26a0 ' + fl.map(function (t) { return esc(t) }).join(' \u00b7 ') + '</div>' : '';
  return '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px"><h3 class="h-sub-md" style="margin:0">' + _bt + '</h3>' + w + '</div>'
}
function initBalancePops() {
  if (typeof document === 'undefined') return; if (!UI.balDismissed) UI.balDismissed = {};
  var els = document.querySelectorAll('.bal-pop-wrap'); if (!els.length) return;
  var show = function (el) { el.style.visibility = 'visible' };
  if (!window.IntersectionObserver) { for (var i = 0; i < els.length; i++)show(els[i]); return }
  var ob = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { show(en.target); ob.unobserve(en.target) } }) }, { threshold: 0.35 });
  for (var j = 0; j < els.length; j++)ob.observe(els[j])
}
function dismissBalPop(btn) { if (!UI.balDismissed) UI.balDismissed = {}; var w = btn; while (w && (' ' + w.className + ' ').indexOf(' bal-pop-wrap ') < 0) w = w.parentNode; if (!w) return; UI.balDismissed[w.getAttribute('data-balkey')] = 1; w.style.visibility = 'hidden'; w.style.display = 'none' }
function balancePanel(items, stage) {
  if (!items || !items.length) return '';
  var _q = '';
  if (stage === 'explore') {
    var _pj2 = data.projects || {}, _pt2 = data.portfolio || {}; var _all2 = items;
    items = items.filter(function (i) { var pb3 = _pt2[i] || {}; return (_pj2[i] || {}).viable === true && pb3.horizon && pb3.risk && pb3.reward });
    var _inc2 = _all2.filter(function (i) { return (_pj2[i] || {}).viable !== true }).length;
    var _aw2 = _all2.length - items.length - _inc2;
    if (_aw2 || _inc2) _q = '<p class="t-faint-sm" style="margin-top:6px">' + (_aw2 ? _aw2 + ' awaiting portfolio grading' : '') + (_aw2 && _inc2 ? ' \u00b7 ' : '') + (_inc2 ? _inc2 + ' incomplete' : '') + '</p>';
    if (!items.length) return '';
  }
  var res = items.map(function (i) { return resolveBands(i, stage) });
  var rows = [['Time horizon', 'h', [['quick', 'Quick'], ['medium', 'Medium'], ['long', 'Long']], '#8B5E3C'], ['Risk', 'r', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], '#9B2D3F'], ['Reward', 'w', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], '#1B6B5A']];
  var tot = res.length;
  var bars = rows.map(function (row) {
    return '<div style="margin-bottom:10px"><div class="h-card-lg" style="margin-bottom:4px">' + row[0].toUpperCase() + '</div><div style="display:flex;gap:10px">' + row[2].map(function (b) {
      var c = res.filter(function (x) { return x.conf && x[row[1]] === b[0] }).length;
      var p = res.filter(function (x) { return !x.conf && x[row[1]] === b[0] }).length;
      var cw = Math.round(c / tot * 100), pw = Math.round(p / tot * 100);
      return '<div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="t-faint-sm" style="font-size:10px">' + b[1] + '</span><span class="t-faint-sm" style="font-size:10px">' + c + (p ? ' (+' + p + ')' : '') + '</span></div><div style="height:8px;border-radius:4px;background:rgba(var(--fg-rgb),.06);overflow:hidden;display:flex"><div style="width:' + cw + '%;background:' + row[3] + '"></div><div style="width:' + pw + '%;background:' + row[3] + ';opacity:.35"></div></div></div>'
    }).join('') + '</div></div>'
  }).join('');
  var sub = stage === 'bluesky' ? 'From intake estimates \u2013 timeframe, triage risk and value.' : stage === 'explore' ? 'Graded projects only \u2013 the structured portfolio.' : 'Solid = positioned \u00b7 faded = provisional (suggested from assessments).';
  var queue = _q;
  var fl = balanceFlags(res);
  var flh = balanceFlagPop('bp_' + stage, fl);
  return card(balanceHead(fl, stage) + '<p class="t-faint-sm" style="margin-bottom:10px">' + sub + '</p>' + bars + queue + flh, 'margin-bottom:16px;position:relative')
}
function vizBalanceMap() {
  var st = getStages();
  var items = [].concat(st.explore || [], st.experiment || [], st.operational || []);
  if (!items.length) return '';
  var res = [], skip = 0;
  items.forEach(function (i) { var r = resolveBands(i, 'map'); if (r.h && r.r && r.w) res.push(r); else skip++ });
  if (!res.length) return '';
  var X = { low: 0, medium: 1, high: 2 }, Y = { high: 0, medium: 1, low: 2 }, HC = { quick: '#1B6B5A', medium: '#8B5E3C', long: '#2D5A8E' };
  var L = 70, T = 16, CW = 110, CH = 78, W = L + 3 * CW + 82, H = T + 3 * CH + 76;
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;display:block">';
  var cx, cy;
  for (cx = 0; cx < 3; cx++)for (cy = 0; cy < 3; cy++)s += '<rect x="' + (L + cx * CW) + '" y="' + (T + cy * CH) + '" width="' + CW + '" height="' + CH + '" fill="rgba(245,242,236,.03)" stroke="rgba(245,242,236,.08)"/>';
  var cols = ['Low', 'Medium', 'High'], rows = ['High', 'Medium', 'Low'];
  for (cx = 0; cx < 3; cx++)s += '<text x="' + (L + cx * CW + CW / 2) + '" y="' + (T + 3 * CH + 18) + '" text-anchor="middle" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">' + cols[cx] + '</text>';
  s += '<text x="' + (L + 1.5 * CW) + '" y="' + (T + 3 * CH + 36) + '" text-anchor="middle" fill="#8A8278" font-size="10" letter-spacing="1" font-family="var(--sans,Helvetica Neue,sans-serif)">RISK</text>';
  for (cy = 0; cy < 3; cy++)s += '<text x="' + (L - 8) + '" y="' + (T + cy * CH + CH / 2 + 4) + '" text-anchor="end" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">' + rows[cy] + '</text>';
  s += '<text x="14" y="' + (T + 1.5 * CH) + '" text-anchor="middle" fill="#8A8278" font-size="10" letter-spacing="1" font-family="var(--sans,Helvetica Neue,sans-serif)" transform="rotate(-90 14 ' + (T + 1.5 * CH) + ')">REWARD</text>';
  var cells = {}; res.forEach(function (r) { var k = X[r.r] + '_' + Y[r.w]; (cells[k] = cells[k] || []).push(r) });
  Object.keys(cells).forEach(function (k) {
    var p = k.split('_'), gx = +p[0], gy = +p[1], arr = cells[k];
    var show = arr.length > 6 ? 5 : arr.length;
    for (var j = 0; j < show; j++) {
      var d = arr[j], dx = L + gx * CW + 24 + (j % 3) * 28, dy = T + gy * CH + 22 + Math.floor(j / 3) * 30;
      s += d.conf ? '<circle cx="' + dx + '" cy="' + dy + '" r="8" fill="' + HC[d.h] + '"/>' : '<circle cx="' + dx + '" cy="' + dy + '" r="7" fill="none" stroke="' + HC[d.h] + '" stroke-width="2"/>'
    }
    if (arr.length > 6) s += '<text x="' + (L + gx * CW + 24 + 56) + '" y="' + (T + gy * CH + 56) + '" fill="#F5F2EC" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">+' + (arr.length - 5) + '</text>'
  });
  var ly = H - 12;
  s += '<circle cx="' + L + '" cy="' + ly + '" r="6" fill="#1B6B5A"/><text x="' + (L + 12) + '" y="' + (ly + 4) + '" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Quick win</text>';
  s += '<circle cx="' + (L + 100) + '" cy="' + ly + '" r="6" fill="#8B5E3C"/><text x="' + (L + 112) + '" y="' + (ly + 4) + '" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Medium-term bet</text>';
  s += '<circle cx="' + (L + 222) + '" cy="' + ly + '" r="6" fill="#2D5A8E"/><text x="' + (L + 234) + '" y="' + (ly + 4) + '" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Long-term</text>';
  s += '<circle cx="' + (L + 330) + '" cy="' + ly + '" r="6" fill="none" stroke="#8A8278" stroke-width="2"/><text x="' + (L + 342) + '" y="' + (ly + 4) + '" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Provisional</text>';
  s += '</svg>';
  var note = skip ? '<p class="t-faint-sm" style="margin-top:6px">' + skip + ' project' + (skip > 1 ? 's' : '') + ' not yet placeable \u2013 add triage scores or grades.</p>' : '';
  var fl = balanceFlags(res);
  var flh = balanceFlagPop('map', fl);
  return card(balanceHead(fl) + '<p class="t-faint-sm" style="margin-bottom:10px">Exploration, Development, and Operational projects \u00b7 solid = positioned \u00b7 hollow = provisional.</p>' + s + note + flh, 'margin-bottom:16px;position:relative')
}
function suggestedBands(i) {
  var p = (data.projects || {})[i] || {}, a = (data.assessments || {})[i] || {}, idea = (data.ideas || [])[i] || {};
  var rs = p.rescore || {};
  var riskV = typeof rs.risk === 'number' ? rs.risk : (typeof a.risk === 'number' ? a.risk : 0);
  var valV = typeof rs.value === 'number' ? rs.value : (typeof a.value === 'number' ? a.value : 0);
  var tf = String(idea.timeframe || '');
  var hz = tf.indexOf('1-3') === 0 ? 'quick' : tf.indexOf('3-6') === 0 ? 'medium' : tf.indexOf('6-12') === 0 ? 'long' : tf.indexOf('12') === 0 ? 'long' : '';
  var inv = riskV > 0 ? (10 - riskV) : 0;
  return { horizon: hz, risk: riskV > 0 ? (inv >= 7 ? 'high' : inv >= 4 ? 'medium' : 'low') : '', reward: valV > 0 ? (valV >= 7 ? 'high' : valV >= 4 ? 'medium' : 'low') : '' }
}
function setNoGoFromExplore(i) { if (lockBlocked('projects::' + i)) return; if (!data.projects) data.projects = {}; if (!data.projects[i]) data.projects[i] = {}; data.projects[i].viable = false; data.projects[i].assessed = true; data.capStale = true; Store.commit('projects', i); Store.commit('capStale'); render() }
function isArchived(i) { return !!((data.archivedItems || {})[i]) }
function archiveItem(i) { var st = getStages(); var stage = st.bluesky.indexOf(i) >= 0 ? 'bluesky' : st.explore.indexOf(i) >= 0 ? 'explore' : st.experiment.indexOf(i) >= 0 ? 'experiment' : (st.operational || []).indexOf(i) >= 0 ? 'operational' : st.noGo.indexOf(i) >= 0 ? 'noGo' : 'bluesky'; if (!data.archivedItems) data.archivedItems = {}; data.archivedItems[i] = { stage: stage, at: Date.now() }; data.capStale = true; Store.commit('archivedItems', i); Store.commit('capStale'); render() }
function reviveItem(i) { var rec = (data.archivedItems || {})[i]; if (rec && rec.stage === 'noGo') { var si = (data.selected || []).indexOf(i); if (si >= 0) { data.selected.splice(si, 1); Store.commit('selected') } if ((data.projects || {})[i]) { delete data.projects[i]; Store.commit('projects', i) } }/* a noGo revive returns the item to bluesky - it used to land back in noGo, invisible and un-reselectable (QA sweep 2, July 9) */if (data.archivedItems) delete data.archivedItems[i]; data.capStale = true; Store.commit('archivedItems', i); Store.commit('capStale'); render() }
function archBtn(i, label) { var msg = label === 'Sunset' ? 'Sunset this project? It moves to the Operational archive.' : 'Archive this item? Revive it anytime from the Archive tab.'; return '<button onclick="event.stopPropagation();if(confirm(\'' + msg + '\'))archiveItem(' + i + ')" style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.15);background:rgba(var(--fg-rgb),.04);color:var(--text-faint)">\u2715 ' + (label || 'Archive') + '</button>' }
function notAdvPanel(pid) {
  var stages = getStages(), ideas = data.ideas || [], proj = data.projects || {}; if (!stages.noGo.length) return ''; var open = !!UI.expanded['notadv' + pid];
  var h = '<div class="u-3ae1f62"><button class="btn-ghost pad-chip-sm" style="color:#9B2D3F;border-color:rgba(155,45,63,.4)" onclick="UI.expanded[\'notadv' + pid + '\']=!UI.expanded[\'notadv' + pid + '\'];render()">' + (open ? '\u25be' : '\u25b8') + ' Not Advancing (' + stages.noGo.length + ')</button>';
  if (open) stages.noGo.forEach(function (i) { h += '<div class="u-27c7109" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="flex:1;min-width:140px">' + esc((ideas[i] || {}).name) + '</span><input id="pjr_' + i + '" value="' + esc((proj[i] || {}).noGoReason || '') + '" placeholder="Reason (required to resolve Step 2.4)" onchange="fldSave(this.id,this.value)" data-live="1" class="row-input" style="flex:2;min-width:200px"/><button onclick="event.stopPropagation();reconsiderNoGo(' + i + ')" style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(45,90,142,.4);background:rgba(45,90,142,.06);color:#2D5A8E">\u21a9 Reconsider</button>' + archBtn(i) + '</div>' }); return h + '</div>'
}
function archivePanel(stageKeys, pid) {
  var arch = data.archivedItems || {}, ideas = data.ideas || []; var ks = Object.keys(arch).filter(function (k) { return stageKeys.indexOf(arch[k].stage) >= 0 }); var open = !!UI.expanded['arch' + pid];
  var h = '<div style="margin-top:18px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'arch' + pid + '\']=!UI.expanded[\'arch' + pid + '\'];render()">' + (open ? '\u25be' : '\u25b8') + ' Archive (' + ks.length + ')</button>';
  if (open) {
    if (!ks.length) h += '<p class="t-faint-sm" style="margin-top:8px">Nothing archived from this portfolio.</p>';
    else h += ks.map(function (k) { var idea = ideas[k] || {}; var a = arch[k]; return '<div class="row-line"><span class="fs-14" style="flex:1">' + esc(idea.name || ('Item ' + k)) + '</span><span class="t-faint-sm">' + fmtDate(a.at) + '</span><button onclick="reviveItem(' + k + ')" style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(27,107,90,.5);background:rgba(27,107,90,.08);color:#1B6B5A">\u21ba Revive</button></div>' }).join('')
  }
  return h + '</div>'
}
function bsNowList(st) { var id = data.ideas || []; return (st.bluesky || []).filter(function (i) { return (id[i] || {}).when !== 'future' }) }
// === Capital / budget / calendar engine → js/features/budget.js ===
function getStages() {
  var d = data;
  var ideas = d.ideas || [], sel = d.selected || [], proj = d.projects || {}, rev = d.review || {}, lau = d.launched || [], exSel = d.expSelected || [];
  var _arch = d.archivedItems || {}; var nA = function (i) { return !_arch[i] };
  var op = lau.filter(nA); exSel.forEach(function (i) { if (nA(i) && ((rev.items || {})[i] || {}).decision === 'buy' && op.indexOf(i) < 0) op.push(i) });
  var noP = sel.filter(function (i) { return nA(i) && (proj[i] || {}).viable === false });
  var exp = exSel.filter(function (i) { return nA(i) && op.indexOf(i) < 0 });
  var expl = sel.filter(function (i) { return nA(i) && (proj[i] || {}).viable !== false && exSel.indexOf(i) < 0 && op.indexOf(i) < 0 });
  var unsel = ideas.map(function (_, i) { return i }).filter(function (i) { return nA(i) && sel.indexOf(i) < 0 });
  return { bluesky: unsel, explore: expl, experiment: exp, operational: op, noGo: noP };
}
/* 1.1 used to be derived from its five completedSections, so the step signed
   itself off the instant the fifth section was marked done - no step-level
   confirm, no recorded date, and no "step complete" email, because nothing
   ever called stampStepDone('1.1'). It reads from completedSteps like every
   other step. A Step Complete button (saveDone11) was tried and removed on
   15 Oct 2026: finishing the fifth section now completes the step through
   batteryStepDone(), which records the date and sends the email.
   The Assessment Report under Outcomes stays section-gated - that is a
   report becoming available, not a step being signed off. */
/* A program may own this outright. Executive Readiness does: four of its steps
   are one leader's own work and their completion is stored against the leader
   the signed-in user is linked to, so reading data.completedSteps would report
   them done for the whole organization the moment any one person finished.
   Programs that don't define the hook — the Pipeline — get the flag lookup. */
function isStepDone(sid) {
  var own = window.Modules && Modules.hook('isStepDone');
  if (own) return !!own(sid);
  var cs = data.completedSteps || {};
  return !!cs[sid];
}
// === SHARED UI BUILDERS ===
function badge(text, color) { return '<span class="bg bg-tinted" style="--c:' + color + '">' + esc(text) + '</span>' }
function card(inner, style, attrs) { return '<div class="cd"' + (attrs ? ' ' + attrs : '') + (style ? ' style="' + style + '"' : '') + '>' + inner + '</div>' }
function xpandClick(ev, key, val) {
  var t = ev && ev.target, c = ev && ev.currentTarget;
  while (t && t !== c) { if (/^(INPUT|SELECT|TEXTAREA|BUTTON|A|LABEL)$/.test(t.tagName || '') || (t.getAttribute && t.getAttribute('onclick'))) return; t = t.parentNode }
  try { if (typeof getSelection === 'function' && String(getSelection())) return } catch (e) { }
  if (val === false && c && c.querySelector) { var hd = c.querySelector('.xh'); if (hd && hd.getBoundingClientRect && ev.clientY != null) { var r = hd.getBoundingClientRect(); if (ev.clientY > r.bottom + 8) return } }
  UI.expanded[key] = val; render()
}
function xpandAttr(key, open) { return 'onclick="xpandClick(event,\'' + key + '\',' + (!open) + ')"' }
function btn(label, onclick, cls, style, disabled) { return '<button class="btn ' + (cls || 'bp') + '"' + (onclick ? ' onclick="' + onclick + '"' : '') + (style ? ' style="' + style + '"' : '') + (disabled ? ' disabled' : '') + '>' + label + '</button>' }
/* The one PDF control. Every output page and hub calls this instead of sizing its
   own btn(), so the size and the label can never drift apart again. It wears the
   suite's ghost form - transparent, hairline border, "▾ Save as PDF" - which the
   ported modules emit through btn(…,'bg2'); the component is kept rather than
   inlined because .pdf-hd/.pdf-btn-dock below are what stop it wrapping onto a
   second line when a page's lead paragraph runs long. .pdf-btn-dock
   sits it at the top right of the page header, as the last item of a row whose
   title block carries .pdf-hd (styles.css) – same spot on every page, and it
   scrolls with the page instead of hovering over it. `inline` leaves it in normal
   flow for the per-project budget sheet, which has no such header row. */
function pdfBtn(onclick, inline) { return '<button class="pdf-btn ' + (inline ? 'pdf-btn-inline' : 'pdf-btn-dock') + '" onclick="' + onclick + '" title="Download this page as a PDF">▾ Save as PDF</button>' }
function ta(label, id, val, ph, rows, ro) { var _g = (!ro && /\*/.test(label)) ? ' gate-field' : ''; var _lbl = ro ? String(label).replace(/\s*\*\s*$/, '') : label; var _hnd = ro ? '' : ' onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)"'; return '<div class="mb-4"><label class="form-label">' + esc(_lbl) + '</label><textarea id="' + id + '" rows="' + (rows || 3) + '" class="ta-helper' + _g + '"' + _hnd + (ro ? ' readonly' : '') + ' placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea></div>' }
function sel(label, id, val, opts, help, helpBelow) { var h = '<div class="mb-4"><label class="form-label">' + esc(label) + '</label>' + (help && !helpBelow ? '<p class="t-faint-sm" style="margin:-2px 0 8px">' + esc(help) + '</p>' : '') + '<select id="' + id + '" class="sel-helper' + (/\*/.test(label) ? ' gate-field' : '') + '" onchange="fldSave(this.id,this.value)">'; opts.forEach(function (o) { h += '<option value="' + esc(o.v) + '"' + (val === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>' }); return h + '</select>' + (help && helpBelow ? '<p class="t-faint-sm" style="margin:6px 0 0">' + esc(help) + '</p>' : '') + '</div>' }
function fldSave(id, value, live) {
  var i = id.indexOf('_'); if (i < 0) return; var pre = id.slice(0, i), f = id.slice(i + 1);
  /* Silently, on every keystroke — see editBlocked(). The field is disabled on
     a current render; this is what holds if the render was not current. */
  if (editBlocked(true)) return;
  if (Collab.lockedByOther(idToRecordKey(id))) return;
  /* Past the gates, so this value is going into the document: noted as banked
     before the branches, because every one of them either stores it or is a
     branch that has decided not to keep it at all. Getting that wrong in this
     direction costs nothing — an entry marked banked is simply not forced back
     over a repaint, which is the state the page is in anyway. Getting it wrong
     the other way is what pinned the field. */
  _bankedEdits[id] = value;
  // Drafts (B10): UI-state only so they survive re-renders; committed by their Save/Add buttons.
  if (pre === 'ic') { if (!UI.icDraft) UI.icDraft = {}; UI.icDraft[f] = value; return }
  if (pre === 'bsic') { var bj = f.indexOf('_'); if (bj < 0) return; var bi = parseInt(f.slice(0, bj), 10), bf = f.slice(bj + 1); if (isNaN(bi) || !data.ideas || !data.ideas[bi]) return; if (['name', 'desc', 'strategic', 'outcome', 'capabilities', 'cost', 'risk', 'timeframe', 'dept', 'when'].indexOf(bf) < 0) return; if (bf === 'name' && !String(value).trim()) return; if (bf === 'when' && value !== 'now' && value !== 'future') return; data.ideas[bi][bf] = value; Store.commit('ideas'); if (bf === 'when' && !live) { if (value === 'future') { UI.expanded.bsFold = true; UI.expanded['bsf' + bi] = true } else { UI.expanded['bs' + bi] = true } render() } return }
  if (pre === 'tune') { if (!data.stress) data.stress = {}; if (!data.stress.tuningList) data.stress.tuningList = []; data.stress.tuningList[parseInt(f, 10) || 0] = value; Store.commit('stress'); refreshSecDone(); return }
  if (pre === 'pr3') { var pj3 = f.indexOf('_'); if (pj3 < 0) return; var pi3 = parseInt(f.slice(0, pj3), 10), pf3 = f.slice(pj3 + 1); if (isNaN(pi3)) return; if (!data.projects) data.projects = {}; if (!data.projects[pi3]) data.projects[pi3] = {}; if (!data.projects[pi3].rescore3) data.projects[pi3].rescore3 = {}; if (value === '') { delete data.projects[pi3].rescore3[pf3] } else { data.projects[pi3].rescore3[pf3] = Math.max(0, Math.min(10, parseInt(value) || 0)) } delete data.projects[pi3].rescore3Done; Store.commit('projects', pi3); refreshPr3Total(pi3); return }
  if (pre === 'prs') { var pj2 = f.indexOf('_'); if (pj2 < 0) return; var pi2 = parseInt(f.slice(0, pj2), 10), pf2 = f.slice(pj2 + 1); if (isNaN(pi2)) return; if (!data.projects) data.projects = {}; if (!data.projects[pi2]) data.projects[pi2] = {}; if (!data.projects[pi2].rescore) data.projects[pi2].rescore = {}; if (value === '') { delete data.projects[pi2].rescore[pf2] } else { data.projects[pi2].rescore[pf2] = Math.max(0, Math.min(10, parseInt(value) || 0)) } delete data.projects[pi2].rescoreDone; Store.commit('projects', pi2); refreshPrsTotal(pi2); return }
  if (pre === 'pjr') { var ri2 = parseInt(f, 10); if (isNaN(ri2)) return; if (!data.projects) data.projects = {}; if (!data.projects[ri2]) data.projects[ri2] = {}; data.projects[ri2].noGoReason = value; Store.commit('projects', ri2); refreshSecDone(); return }
  if (pre === 'pj') { if (UI.ap == null) return; if (!data.projects) data.projects = {}; if (!data.projects[UI.ap]) data.projects[UI.ap] = {}; data.projects[UI.ap][f] = value; Store.commit('projects', UI.ap); refreshSecDone(); return }
  if (pre === 'port') { var pp = f.split('_'), pfld = { h: 'horizon', r: 'risk', w: 'reward', n: 'notes' }[pp[1]]; if (!pfld) return; if (!data.portfolio) data.portfolio = {}; if (!data.portfolio[pp[0]]) data.portfolio[pp[0]] = {}; data.portfolio[pp[0]][pfld] = value; Store.commit('portfolio', pp[0]); if (pp[1] !== 'n') render(); else refreshSecDone(); return }
  if (pre === 'rs') { if (UI.ap == null) return; if (!data.projects) data.projects = {}; if (!data.projects[UI.ap]) data.projects[UI.ap] = {}; if (!data.projects[UI.ap].rescore) data.projects[UI.ap].rescore = {}; if (value === '') { delete data.projects[UI.ap].rescore[f] } else { data.projects[UI.ap].rescore[f] = Math.max(0, Math.min(10, parseInt(value) || 0)) } delete data.projects[UI.ap].rescoreDone; Store.commit('projects', UI.ap); refreshRsTotal(); refreshSecDone(); return }
  // Indexed prefixes (A1-A3, B5-B9): id = pre_<idx>_<field>
  var j = f.indexOf('_'), idx = j < 0 ? f : f.slice(0, j), sub = j < 0 ? '' : f.slice(j + 1);
  if (pre === 'bpn') { var pn = bpEnsure(idx); if (!pn.notes) pn.notes = {}; pn.notes[sub] = value; Store.commit('budgetPlans', idx); return }
  if (pre === 'trk') { if (!data.tracking) data.tracking = {}; if (!data.tracking[idx]) data.tracking[idx] = {}; data.tracking[idx][sub] = value; Store.commit('tracking', idx); if (sub === 'status') { if (value === 'killed') stampKill(idx); else if (data.tracking[idx].killSunkIds) { delete data.tracking[idx].killSunkIds; Store.commit('tracking', idx) } data.capStale = true; Store.commit('capStale') } if (sub === 'status' && !live) render(); else refreshSecDone(); return }
  if (pre === 'exp') { if (sub === 'budget' && bpHasDev(idx)) return; if (!data.experiments) data.experiments = {}; if (!data.experiments[idx]) data.experiments[idx] = {}; data.experiments[idx][sub] = value; Store.commit('experiments', idx); refreshSecDone(); return }
  if (pre === 'rev') { if (!data.review) data.review = {}; if (f.slice(-10) === '_rationale') { var ri = f.slice(0, -10); if (!data.review.items) data.review.items = {}; if (!data.review.items[ri]) data.review.items[ri] = {}; data.review.items[ri].rationale = value } else { data.review[f] = value } Store.commit('review'); refreshSecDone(); return }
  if (pre === 'expl') { if ((sub === 'cS' && bpHasDev(idx)) || (sub === 'cO' && bpHasRoll(idx)) || (sub === 'cR' && bpHasSus(idx))) return; if (!data.projects) data.projects = {}; if (!data.projects[idx]) data.projects[idx] = {}; var P = data.projects[idx]; var ek = { obj: 'objectives', del: 'deliverables', tl: 'timeline', res: 'resources', risk: 'risks', met: 'metrics', cS: 'startupCost', cO: 'rolloutCost', cR: 'runningCost' }[sub]; if (ek) { P[ek] = value } else if (sub.slice(0, 3) === 'sw_') { if (!P.swot) P.swot = {}; P.swot[sub.slice(3)] = value } else if (sub === 'pI') { P.partInt = value } else if (sub === 'pE') { P.partExt = value } else if (/^(skills|resources|technology)(H|N)$/.test(sub)) { if (!P.gap) P.gap = {}; P.gap[sub] = value } else { return } Store.commit('projects', idx); refreshSecDone(); return }
  if (pre === 'ops') { if ((sub === 'runCost' && bpHasSus(idx)) || (sub === 'rolloutCost' && bpHasRoll(idx))) return; var ok = { perf: 'performance', notes: 'notes', runCost: 'runCost', rolloutCost: 'rolloutCost' }[sub]; if (!ok) return; if (!data.opsData) data.opsData = {}; if (!data.opsData[idx]) data.opsData[idx] = {}; data.opsData[idx][ok] = value; Store.commit('opsData', idx); refreshSecDone(); return }
  var m = { p: 'purpose', k: 'knowledge', ow: 'ownership', inc: 'incentives', rh: 'rhythm', cap: 'capital', gov: 'governance', str: 'stress' }, key = m[pre]; if (!key) return; if (!data[key]) data[key] = {}; data[key][f] = value; Store.commit(key); if (pre === 'ow' && f === 'ownerName') refreshRaci(); if (pre === 'cap') { if (!live) if (f === 'aiBudget' || f === 'killCosts' || f === 'envYears' || f === 'budgetY2' || f === 'budgetY3' || f === 'budgetY4' || f === 'budgetY5' || f === 'periodStart' || f === 'programShape' || f === 'programEnd' || f === 'susCap' || f.indexOf('susCapY') === 0 || f.indexOf('reserveY') === 0) { render(); return } } refreshSecDone()
}
function rsComplete(rs) { return ['priority', 'risk', 'value', 'costScore', 'difficulty'].every(function (k) { return rs && rs[k] != null }) }
function rsTotalHtml(ap) { var p = (data.projects || {})[ap] || {}, rs = p.rescore || {}, trTot = triageScore(ap); if (!p.rescoreDone || !rsComplete(rs)) return 'Deepened <strong>\u2014</strong> \u00b7 First Pass ' + trTot + '/50'; var rsTot = getScore(ap), d = rsTot - trTot; return 'Deepened <strong>' + rsTot + '/50</strong> \u00b7 First Pass ' + trTot + '/50 (' + (d >= 0 ? '+' : '') + d + ')' }
function refreshRsTotal() { var el = document.getElementById('rsTotal'); if (el && UI.ap != null) el.innerHTML = rsTotalHtml(UI.ap); var b = document.getElementById('rsBtn'); if (b && UI.ap != null) { var p = (data.projects || {})[UI.ap] || {}; var done = !!p.rescoreDone, comp = rsComplete(p.rescore || {}); b.disabled = done || !comp; b.textContent = done ? '\u2713 Complete' : 'Mark Complete & Continue'; b.style.background = done ? 'rgba(27,107,90,.25)' : comp ? '#1B6B5A' : 'rgba(var(--fg-rgb),.08)'; b.style.color = done ? 'var(--ref-accent)' : comp ? '#fff' : 'var(--text-faint)'; b.style.cursor = (comp && !done) ? 'pointer' : 'default' } }
function confirmRescore() { if (UI.ap == null) return; if (lockBlocked('projects::' + UI.ap)) return; if (!data.projects) data.projects = {}; var p = data.projects[UI.ap]; if (!p || !rsComplete(p.rescore || {})) return; p.rescoreDone = true; Store.commit('projects', UI.ap); render() }
function refreshSecDone() { var b = document.querySelector('.done-btn'); if (!b) return; if (currentPage !== 'step') return; if (gateArmed) paintGates(); var ok = true; if (currentStep === '1.1') { var s = UI.sec, co = data.completedSections || {}; if (co[s]) return; var p = data.purpose || {}, k = data.knowledge || {}, cu = data.culture || {}, au = data.audit || [], de = data.decisions || {}; if (s === '1.1') ok = !!(p.mission && p.goals && p.frictions); else if (s === '1.2') ok = !!(k.usage && k.awareness); else if (s === '1.3') ok = !!(cu.uncertainty && cu.aiLegitimacy && cu.overall); else if (s === '1.4') ok = true;/* twin: renderStep11 sec 1.4 doneBtn disabled=false - an empty audit is a valid completion (ruled July 9) */else if (s === '1.5') ok = !!((de.q1 || {}).who && (de.q4 || {}).who); else return } else { var cs = data.completedSteps || {}, sid = currentStep; if (cs[sid]) return; if (sid === '2.1') { var o = data.ownership || {}; ok = !!(o.ownerName && o.ownerRole) } else if (sid === '2.2') { var inc = data.incentives || {}; ok = !!(inc.current && inc.changes) } else if (sid === '2.3') { var rh = data.rhythm || {}; ok = !!(rh.day && rhAttNames().length) } else if (sid === '3.2') { var _c2 = data.capital || {}; ok = !!(String(_c2.aiBudget || '').trim() && String(_c2.periodStart || '').trim() && capAuditAnswered()) } else if (sid === '3.3') { ok = getStages().experiment.length > 0 } else if (sid === '4.2') { var gov = data.governance || {}; ok = !!(gov.meeting && gov.threshold && gov.reviewAttendees) } else if (sid === '4.3') { var st = data.stress || {}; ok = !!((st.tuningList || []).some(function (t) { return t })) } else if (sid === '1.2') { ok = (data.ideas || []).length >= 3 } else if (sid === '1.3') { ok = (data.selected || []).length > 0 } else if (sid === '2.4') { var sl = data.selected || [], pjj = data.projects || {}, stg = getStages(), _ad = {}; stg.experiment.concat(stg.operational || []).forEach(function (x) { _ad[x] = 1 }); ok = sl.length > 0 && sl.filter(function (i) { return !isArchived(i) && !_ad[i] }).every(function (i) { var pp = pjj[i] || {}; return pp.viable === true ? !!pp.objectives : pp.viable === false ? !!pp.noGoReason : false }) } else if (sid === '3.1') { var gp = getStages().explore.filter(function (i) { return ((data.projects || {})[i] || {}).viable === true }), pt = data.portfolio || {}; ok = gp.length > 0 && gp.every(function (i) { var pb = pt[i] || {}; return !!(pb.horizon && pb.risk && pb.reward) }) } else if (sid === '4.1') { var x2 = (data.expSelected || []).filter(function (i) { return !isArchived(i) }), tk = data.tracking || {}; ok = x2.every(function (i) { return (tk[i] || {}).status === 'killed' || (progArmed(i) && !progOverdue(i)) })/* twin: renderStep41 allArmed (aligned July 9) */ } else if (sid === '4.4') { var x3 = data.expSelected || [], rv = (data.review || {}).items || {}; var ai = x3.filter(function (i) { return !isArchived(i) }).concat((data.selected || []).filter(function (i) { return !isArchived(i) && x3.indexOf(i) < 0 && (data.projects || {})[i] && (data.projects || {})[i].viable === true })); ok = ai.every(function (i) { return !!(rv[i] || {}).decision })/* twin: renderStep44 allItems/allDecided (aligned July 9) */ } else return } b.disabled = !ok; var hp = document.querySelector('.done-helper'); if (hp) hp.style.display = ok ? 'none' : '' }
function paintGates() { var els = document.querySelectorAll('.gate-field'); for (var i = 0; i < els.length; i++) { var el = els[i], empty; if (el.classList.contains('gate-likert')) { empty = !el.querySelector('.lk-btn.sel') } else { empty = !String(el.value || '').trim() } el.classList.toggle('gate-empty', empty) } }
/* Clicking a disabled "Mark Complete" highlights the required fields still to
   fill in. Skip that when the button is disabled because the step belongs to
   someone else — the fields are not the problem, and flagging them red would
   send the reader off to fix the wrong thing. The helper text under the button
   already says what's going on. */
function gatePeek(ev) {
  var w = ev && ev.currentTarget; var b = w && w.querySelector('.done-btn');
  if (!b || !b.disabled) return;
  if (w.querySelector('.done-helper-locked')) return;
  gateArmed = true; paintGates();
}
function likert(label, id, val, lo, hi, help) { var h = '<div class="mb-5"><label class="form-label-md">' + esc(label) + '</label>' + (help ? '<p class="t-faint-sm" style="margin:-4px 0 8px">' + esc(help) + '</p>' : '') + '<div class="flx-center gap-2' + (/\*/.test(label) ? ' gate-field gate-likert' : '') + '"><span class="lk-cap">' + esc(lo) + '</span>'; for (var n = 1; n <= 5; n++) { var s = val === n; h += '<button onclick="likSet(\'' + id + '\',' + n + ')" class="lk-btn' + (s ? ' sel' : '') + '">' + n + '</button>' } return h + '<span class="lk-cap lk-cap-r">' + esc(hi) + '</span></div></div>' }
function milestone(sid) { var m = MILESTONES[sid]; if (!m || !isStepDone(sid)) return ''; return '<div class="milestone-mini"><div class="icon-check">\u2713</div><div><div class="milestone-mini-label">Milestone Reached</div><div class="milestone-mini-text">' + esc(m) + '</div></div></div>' }

/* ═══════════════════════════════════════════════════════════════
   STEP CAROUSEL — replaces video placeholders.
   4 slides per step: Why / What / How / Outcome.
   Auto-rotates via CSS animation. Pauses on hover.
   Eyebrow color picks up the phase color (teal/blue/brown/red).
   ═══════════════════════════════════════════════════════════════ */

var CAROUSEL_CONTENT = {
  "1.1": [
    {
      "kind": "Why",
      "headline": "The most common AI failures begin before the build.",
      "body": "AI initiatives can fail for many reasons, but the most common causes aren't technical. If you commit to a project before you've taken honest stock of your purpose, capabilities, culture, and decision rights, every later choice will rest on untested premises.",
      "example": "[RAND's 2024 study](https://www.rand.org/pubs/research_reports/RRA2680-1.html) of failed AI projects found that the leading cause was a misread of the problem itself. Four of the five root causes of failure were organizational, not technological."
    },
    {
      "kind": "What",
      "headline": "Five dimensions of readiness.",
      "body": "The battery covers five areas in two groups.",
      "bullets": [
        {
          "label": "Answer directly",
          "text": "Your organizational purpose and priorities, your current AI knowledge and capability, and whether your culture will support or resist change."
        },
        {
          "label": "Investigate",
          "text": "Conduct an audit of every AI initiative already running, and create a map of who holds the authority to approve, fund, advance, or kill a project."
        }
      ],
      "body2": "Together these answers form the baseline that anchors every later decision."
    },
    {
      "kind": "How",
      "headline": "Answer for the company you are, not the one you wish you were.",
      "body": "The instinct is to score generously and move on. Resist it. The uncomfortable answers \u2014 the stalled pilot nobody owns, the decision nobody can make \u2014 are the ones that teach you the most.",
      "example": "When they are asked who can kill a failing project, for many teams the answer is \"We don't know.\" Writing that down honestly is precisely the point of the exercise: once you have identified and logged structural gaps you will then be in a position to fix them."
    },
    {
      "kind": "Outcome",
      "headline": "Outputs that anchor what comes next.",
      "body": "When all five sections are complete, you will see your readiness radar \u2014 a single picture of your strengths and weak spots \u2014 and your Assessment Report under Outcomes will be unlocked.",
      "body2": "The profile recorded in this section becomes the reference point for everything that follows: which opportunities to pursue, whom to assign, where to build capabilities first. This starting point means you can move based on evidence rather than on a vague sense that your organization \"should do AI.\""
    }
  ],
  "1.2": [
    {
      "kind": "Why",
      "headline": "Start from the problem, not the technology.",
      "body": "The tempting question is \"what can AI do?\" But capability isn't strategy. Until you know which problems are holding the business back, a catalog of impressive AI features is just a solution looking for a problem to solve.",
      "example": "[McKinsey's 2025 State of AI](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) found that the organizations capturing real value redesign their work around the problem they are solving, rather than bolting AI onto what already exists \u2014 business need first, technology second."
    },
    {
      "kind": "What",
      "headline": "Aim wide before you aim well.",
      "body": "Generate ten to twenty candidate use cases without pausing to judge them; at this stage, range matters more than polish.",
      "body2": "The obvious ideas arrive first, but the ones worth pursuing usually surface only after you have pushed past them. Capture each as an idea card, ready to be filtered in the next step."
    },
    {
      "kind": "How",
      "headline": "Tie every idea to a friction you already have.",
      "body": "For each idea, name the specific friction it removes: the slow process, the bottleneck, the error you keep paying for. If you cannot name the friction, the idea is not ready yet \u2014 park it and move on.",
      "example": "An idea like \"use AI for quoting\" only earns its place once it is tied to a real cost \u2014 quotes that take three days when customers expect three hours. The friction is what makes it a candidate, not the technology."
    },
    {
      "kind": "Outcome",
      "headline": "A Blue Sky Portfolio to draw from.",
      "body": "What you leave with is a Blue Sky Portfolio: a captured pool of candidate use cases, each tied to a real business need and ready to be ranked.",
      "body2": "Nothing here is committed yet. Most of these ideas will not advance. And that is the point \u2014 a wide, honest pool is what lets you choose well in the next step, rather than settling for whatever was top of mind."
    }
  ],
  "1.3": [
    {
      "kind": "Why",
      "headline": "A long list is not a plan.",
      "body": "Brainstorming produces volume; this step turns volume into focus. Resources spread across too many initiatives at once rarely produce clear learning from any of them, so the field has to be narrowed before anything advances.",
      "example": "A [Harvard Business Review](https://hbr.org/2025/11/stop-running-so-many-ai-pilots) analysis argues that broad, shallow pilots build no lasting edge while a narrow set of carefully selected, focused bets delivers compounding value. [A BCG report](https://www.bcg.com/publications/2024/wheres-value-in-ai) suggests that a narrow approach is correlated with a doubling of return on investment."
    },
    {
      "kind": "What",
      "headline": "Conduct a viability check first, then rank the survivors.",
      "body": "Every idea passes through two filters before it can advance.",
      "bullets": [
        {
          "label": "Qualify",
          "text": "Five pass/fail gates \u2014 can you build it, resource it, fund it, and is it a cultural and strategic fit? Fail any one gate and the idea is disqualified."
        },
        {
          "label": "Score",
          "text": "Survivors are rated zero to ten on priority, value, cost, risk, and ease, producing a single score out of fifty."
        }
      ],
      "body2": "You then select use cases to carry into deeper assessment. On your first pass, select up to five to advance."
    },
    {
      "kind": "How",
      "headline": "A \"no\" on any gate is a \"no.\"",
      "body": "The gates are disqualifiers, not an average \u2014 one honest \"no\" should stop an idea even if you like it. Score only what clears all five, and resist nudging a favorite through a gate it plainly fails.",
      "example": "An idea can score high on value and still be the wrong bet: if the culture won't accept it, or you can't fund it this year, it fails a gate and stops there. Far better to learn that now than after launch."
    },
    {
      "kind": "Outcome",
      "headline": "A ranked shortlist, ready for a deeper dive.",
      "body": "You leave with a set of use cases that have cleared every gate and earned a score out of fifty \u2014 a ranked shortlist rather than a wish list.",
      "body2": "The ideas you set aside aren't deleted; they stay in the Blue Sky Portfolio and can return when conditions change. What advances is a focused, defensible set you can take into deeper assessment."
    }
  ],
  "2.1": [
    {
      "kind": "Why",
      "headline": "If everyone owns it, no one does.",
      "body": "An innovation pipeline needs one person who is accountable for it. If you spread the responsibility thinly across committees, decisions will stall because no one holds both the mandate and the obligation to act.",
      "example": "\"AI will touch all parts of an enterprise, including human employees and clients. Harnessing its potential and managing its risks requires the authority to take a view across the whole organization, steering macro-level innovation and managing change that touches on all parts of the business's identity and culture.\" \u2014 [Faisal Hoque et al.](https://sloanreview.mit.edu/article/why-ai-demands-a-new-breed-of-leaders/)"
    },
    {
      "kind": "What",
      "headline": "One owner, plus leads where the work happens.",
      "body": "Ownership has two parts.",
      "bullets": [
        {
          "label": "The Pipeline Owner",
          "text": "one named person with explicit authority to fund, advance, and kill projects across the portfolio."
        },
        {
          "label": "Embedded leads",
          "text": "a point person in each affected function or business unit, so the work gains traction where it actually happens."
        }
      ],
      "body2": "One person holds the portfolio; the others carry it into the business."
    },
    {
      "kind": "How",
      "headline": "Give the role teeth, not just a title.",
      "body": "Naming an owner is the easy part. What determines whether they will be effective is the authority they're given: can this person move budget, advance a project, or shut an initiative down without convening a committee? Without that authority, the role will just be a figurehead.",
      "example": "An owner who can kill a project that\u2019s not delivering can act in days. One who merely \"oversees AI\" has nothing to stand on when a sponsor pushes back."
    },
    {
      "kind": "Outcome",
      "headline": "A clear line of accountability.",
      "body": "You leave with a defined ownership structure: one accountable owner with real decision rights, and a named lead in each function the work touches.",
      "body2": "When a project stalls, it is now clear whose call it is to unblock it \u2014 and that person has the standing to make the call. Accountability stops being a question and becomes part of the structure."
    }
  ],
  "2.2": [
    {
      "kind": "Why",
      "headline": "People do what you reward them for.",
      "body": "Tell people that innovation matters, then measure them only on quarterly delivery, and they will protect delivery every time. That isn't disloyalty \u2014 it's a rational response to the system they're in. To change the behavior, change what the system rewards.",
      "example": "[Steven Kerr's classic study of reward systems](https://doi.org/10.2307/255378) named this \"the folly of rewarding A while hoping for B.\" An organization says it wants teamwork, then promotes people based on their individual outputs. The result is team members who compete instead of collaborating, following the path laid down by the rewards instead of the signposts in the mission statement."
    },
    {
      "kind": "What",
      "headline": "Tie evaluations to pipeline health.",
      "body": "Begin by naming what your incentives reward today \u2014 usually quarterly delivery and cost efficiency.",
      "body2": "Then tie part of what is measured in leadership evaluations to the health of the pipeline: active experiments running, how quickly failing projects are killed, development gate throughput, visible support for experimentation, and ideas surfaced from the frontline."
    },
    {
      "kind": "How",
      "headline": "Reward the learning, not just the wins.",
      "body": "If only wins earn rewards, people stop taking real risks and bury the experiments that fail. Reward the learning a killed project produces, and teams will surface failure fast instead of hiding it.",
      "example": "In practice, the manager who ends a weak project early and documents what it taught should fare better at review than one who let it run on to avoid admitting failure. Once evaluations reward this behavior, an honest failure becomes safe to report."
    },
    {
      "kind": "Outcome",
      "headline": "What you measure starts to happen.",
      "body": "You leave this phase with a revised incentive structure that rewards pipeline health alongside delivery, and a clear record of how it differs from the previous structure.",
      "body2": "This is where the culture you diagnosed in Phase 1 begins to move. Repeating the vision doesn't change behavior; changing what earns reward and recognition does."
    }
  ],
  "2.3": [
    {
      "kind": "Why",
      "headline": "The urgent crowds out the important.",
      "body": "When everything feels urgent, forward-looking work is the first thing to slip \u2014 there's always a fire that feels more pressing than next quarter's pipeline. A standing weekly session is the counterweight: it guarantees time for the future that daily pressure can't reclaim.",
      "example": "[A decade-long Harvard Business Review study](https://hbr.org/2002/02/beware-the-busy-manager) found that only about one in ten managers spend their time in a focused, purposeful way. The rest are consumed by reactive busyness \u2014 exactly the default a protected slot is built to resist."
    },
    {
      "kind": "What",
      "headline": "Put a standing weekly session on the calendar.",
      "body": "Set a recurring weekly session and fix the details that make it real: the day and time, who attends, and what the meeting is for.",
      "body2": "Keep it short and senior, gathering the people who can unblock and fund the work in a room every week. Give the session a working agenda: review where projects stand against their stage gates, surface new opportunities, clear blockers, and look at what recent experiments are teaching you."
    },
    {
      "kind": "How",
      "headline": "Consistency is key.",
      "body": "The discipline is in never moving the session. The weeks when you most want to cancel, because something is on fire, are exactly the weeks it earns its place. Hold the session consistently and, within a few months, the rhythm runs itself.",
      "example": "Pick a fixed slot \u2014 say, Tuesdays at 9 \u2014 and treat it as immovable. After a dozen weeks it stops being something people check on and becomes something they plan around, bringing decisions to it as a matter of course."
    },
    {
      "kind": "Outcome",
      "headline": "The pipeline gains a heartbeat.",
      "body": "You leave this phase with a standing weekly session on the calendar \u2014 a fixed time, the right people, and a clear agenda for the work the rest of the week tends to crowd out.",
      "body2": "Decisions that used to wait for a crisis or a quarterly offsite now have a regular place to happen. Innovation no longer depends on someone remembering to put it on the agenda."
    }
  ],
  "2.4": [
    {
      "kind": "Why",
      "headline": "Understand the project fully before you build it.",
      "body": "Before you commit real time and money to building an initiative, you need a full picture of it \u2014 what it will take, where it's weak, who must be involved. A flaw found now costs a conversation; found mid-build, it costs the project.",
      "example": "Decades of [new-product research](https://onlinelibrary.wiley.com/doi/full/10.1002/9781444316568.wiem05014) has found that a project's fate is largely set before development begins, by the depth of the up-front work defining what is being built and against what risks. Thin definition is the most common cause of expensive late failure."
    },
    {
      "kind": "What",
      "headline": "The whole project, examined from every side.",
      "body": "For each shortlisted idea, you build a full working definition and study it from several angles.",
      "bullets": [
        {
          "label": "Project definition",
          "text": "objectives, deliverables, timeline, resources, risks, and the metrics that will mark success."
        },
        {
          "label": "Gap and SWOT analyses",
          "text": "the skills, resources, and technology you already have, set against what the project will need, plus the project's internal strengths and weaknesses, and the external opportunities and threats around it."
        },
        {
          "label": "Budgeting",
          "text": "a careful, preliminary analysis of the lifetime costs of the project, broken down into phased development costs, rollout costs, and annual sustainment costs."
        }
      ],
      "body2": "By the end of this step, you will understand each project well enough to decide its future with confidence."
    },
    {
      "kind": "How",
      "headline": "Take each project one dimension at a time.",
      "body": "Go through the dimensions in turn for each project \u2014 the definition, the gaps, the SWOT, and the budget \u2014 and fill each one in concretely. Some answers you already know and just need to set down; others will take real digging. Be specific throughout: a named skill you're missing is useful; \"some training needed\" is not.",
      "example": "Specificity is what separates a real assessment from a box-ticked one. \"A skilled engineer we'd need to hire\" beats \"skills gap\"; \"a supplier for the vision models, since we can't build them in-house\" beats \"external partner needed.\" The precise version is what later decisions can actually build on."
    },
    {
      "kind": "Outcome",
      "headline": "A clear verdict on every idea, and the reasons behind it.",
      "body": "You leave this phase understanding each shortlisted project in real depth, and with a Go or No Go for each. Every Go is ready to move into the Exploration portfolio as a project worth developing further.",
      "body2": "A No Go isn't lost. The idea is set aside with its reason recorded \u2014 the gap, the missing partner, the weakness that settled it \u2014 so you can return to it if conditions change."
    }
  ],
  "3.1": [
    {
      "kind": "Why",
      "headline": "A set of strong projects can still be a weak portfolio.",
      "body": "Every Go project earned its place on its own merits. But a portfolio that's all big, transformative bets \u2014 or all small, safe wins \u2014 is fragile. The reliable wins fund and steady the ambitious bets, so balancing the two is a decision in itself.",
      "example": "As this [Fast Company](https://www.fastcompany.com/91358541/why-your-organization-needs-both-ai-moonshots-and-mundane-wins) article argues, with companies pouring hundreds of billions into AI and scrapping most of those projects, the winners run transformative gambles alongside modest, reliable wins rather than going all-in on either."
    },
    {
      "kind": "What",
      "headline": "Balance the portfolio.",
      "body": "The Go projects already populate your portfolio. Up to now, each has been judged on its own merits; this is the first point where you weigh them against one another.",
      "body2": "The aim is a balanced set of innovation projects. Weighing the mix across a few key criteria shows you where it's overloaded \u2014 too slow, too speculative, too thin on near-term return \u2014 so you can adjust while adjusting is still cheap, before capital and effort are committed in the steps that follow."
    },
    {
      "kind": "How",
      "headline": "The hard calls live in the middle.",
      "body": "Grade each project on three dimensions:",
      "bullets": [
        {
          "label": "Time horizon",
          "text": "short, medium, long."
        },
        {
          "label": "Risk level",
          "text": "low, medium, high."
        },
        {
          "label": "Reward potential",
          "text": "low, medium, high."
        }
      ],
      "body2": "Projects with scores at the extremes are easy to decide \u2014 short, low-risk work with a strong return is the easiest yes; a long project with a low reward rarely earns the resources it ties up. Most projects sit somewhere in the middle, and that is where the real weighing happens. Take the obvious wins, ration the long and high-risk bets, and keep enough quick returns in the mix to carry the slower, more ambitious work."
    },
    {
      "kind": "Outcome",
      "headline": "A portfolio you can defend as a mix.",
      "body": "You leave with every Go project rated on all three dimensions \u2014 time horizon, risk, and reward \u2014 and a clear view of how the projects are distributed within the portfolio: how the quick, low-risk wins balance the slower, more ambitious bets you've chosen to carry.",
      "body2": "That balanced picture is what the rest of Phase 3 works from. Capital allocation and experiment design both build on it, so the mix you set here decides where the money and the first experiments go."
    }
  ],
  "3.2": [
    {
      "kind": "Why",
      "headline": "Decide what the organization will spend before choosing what projects it funds.",
      "body": "Sustainment plateaus make single-year budgeting structurally blind: this year's launches are next year's fixed costs. A capacity plan states what the organization will make available for this portfolio, per year, across a multi-year horizon."
    },
    {
      "kind": "What",
      "headline": "A multi-year envelope that holds still.",
      "body": "Capacity per year across a one-to-five-year horizon. The dynamic portfolio flows through the static capacity. The unknown future portfolio is not missing from the plan; it is present as the capacity not yet consumed. The shape of the budget will vary depending on whether this planning period covers a fixed-term initiative or will roll seamlessly into another planning period."
    },
    {
      "kind": "How",
      "headline": "Set the figures, then leave them alone.",
      "body": "Enter the annual budget, extend it across the horizon, and date the period so the calendar and its quarters are anchored. Then set annual reserves that guarantee space for new project intake and sustainment caps that limit what can be spent on running costs for operational projects. For fixed-term innovation initiatives, the sustainment cap should rise significantly in the final year as new project intake eases."
    },
    {
      "kind": "Outcome",
      "headline": "A budget that every spending commitment is measured against.",
      "body": "Every decision to advance a project to the development or operational portfolios is weighed against this plan. Every quarterly review returns attention to how the live innovation portfolio fits with the funding available."
    }
  ],
  "3.3": [
    {
      "kind": "Why",
      "headline": "Decide against what's left, not what was set.",
      "body": "In most organizations, innovation projects are approved one at a time, and what gets weighed at approval is the near-term cost \u2014 the next experiment, the pilot \u2014 not the full development path behind it. Few stop to total what the whole portfolio will need if its projects run their course, so commitments accumulate until they exceed what the budget can carry. This step reverses that: a project advances only with its complete development cost counted, and only if the portfolio's remaining headroom can fund it.",
      "example": "When [Cooper, Edgett, and Kleinschmidt](https://www.tandfonline.com/doi/abs/10.1080/08956308.2000.11671338) studied why development portfolios overload, they found that standard selection methods judge each project on its own merits, with resource availability rarely forming part of the calculation."
    },
    {
      "kind": "What",
      "headline": "Two views: the sandbox and the real commitment.",
      "body": "Capital allocation runs across two tabs.",
      "bullets": [
        {
          "label": "Sandbox",
          "text": "every Go project with its development, rollout, and sustainment costs in view \u2014 select any batch and watch the capacity waterfall and cumulative curve redraw to show you what the portfolio will look like if you advance that set."
        },
        {
          "label": "Commit & Advance",
          "text": "the real position rather than a rehearsal \u2014 what's already promised against what's available. Set each advancing project's assumed start date and move it into the development portfolio; a batch that crosses capacity needs a funding plan before anything advances."
        }
      ],
      "body2": "On a first pass, three to five projects \u2014 led by the quick wins \u2014 is the right size."
    },
    {
      "kind": "How",
      "headline": "Rehearse in the sandbox. Then make the call.",
      "body": "Start the sandbox with your quick wins and then try different mixes of candidates to find a preferred group that fits the charts. The waterfall and cumulative curve redraw with every batch you select, so a budget breach shows up while it still costs nothing. When the mix holds, switch tabs and advance your chosen projects one at a time: each advance sets an assumed start date and commits the project's full program cost.",
      "example": "A breach found in the sandbox is a rehearsal problem \u2014 drop a candidate, swap the mix, try again. The same breach found after advancing is a promise you now have to fund."
    },
    {
      "kind": "Outcome",
      "headline": "A funded cohort in Development \u2014 and a budget that stays honest.",
      "body": "You leave with your first cohort advanced into the Development portfolio and with funding commitments your budget can support.",
      "body2": "Nothing here is set in stone: the capital picture keeps updating as projects advance, launch, or stop, and the sandbox is waiting to test out new commitments whenever the next candidates are ready."
    }
  ],
  "3.4": [
    {
      "kind": "Why",
      "headline": "Prove it in stages before you commit at scale.",
      "body": "You have designed the initiatives. Now you build toward them in stages. Instead of committing to a full rollout, break the work into bounded phases that are cheap to reverse.",
      "example": "Amazon's 2015 [shareholder letter](https://s2.q4cdn.com/299287126/files/doc_financials/annual/2015-Letter-to-Shareholders.PDF) split decisions into one-way doors, which are irreversible and costly, and two-way doors that you can walk back through. A good early phase is a two-way door. It is small enough to reverse, cheap enough to fail, and built so that you learn something whichever way it goes."
    },
    {
      "kind": "What",
      "headline": "Turn each project into a mapped development track.",
      "body": "You chose and funded this cohort at Allocate Capital. This step maps how each project will move through the Development stage, turning the steps sketched on the project card into a rigorous program. Every phase carries a budget, an owner, success metrics, and exit gate criteria.",
      "example": "[Robert Cooper](https://doi.org/10.1111/j.1540-5885.2008.00296.x), the developer of the stage-gate approach, found that one-size-fits-all development processes fail. The number of phases and gates should fit the size and risk of the project rather than follow a fixed template."
    },
    {
      "kind": "How",
      "headline": "Decide what each phase is meant to prove.",
      "body": "The fundamental question is whether the project can deliver its promised outcome. A development phase that answers part of that question has earned its budget. Different phases prove different things. An observation phase shows how the work happens today. An experiment tests whether the approach works at all. A pilot tests whether people will adopt it and how it fits your processes. Set each phase's success metrics and exit gate criteria against the thing it is meant to prove, so that its gate can deliver a clean pass or fail assessment on the outcome.",
      "example": "Take a vision system for catching production defects. The first phase of its development track might test whether the system can find, on a single production line, the flaws that a trained inspector finds. Later phases can then ask whether inspectors trust its judgment and what it would take to run it across the whole floor."
    },
    {
      "kind": "Outcome",
      "headline": "A mapped development track for every project.",
      "body": "You leave this step with a development track mapped for every project in the cohort. Each track sets out its phases, and every phase has a budget, an owner, success metrics, and exit gate criteria.",
      "body2": "This is the last step of preparation. The development tracks mapped here launch in Phase 4."
    }
  ],
  "4.1": [
    {
      "kind": "Why",
      "headline": "AI proves itself in the world, not just in the lab.",
      "body": "A development program is a sequence of encounters with reality: each phase, from the first observation work through to your last pilot, tests the technology and your organization against real conditions while the stakes are still small. Running the track is how you find out what actually works.",
      "example": "Google's retinal-screening model performed well in the lab, but it was only when [the company tested it in real clinics](https://www.technologyreview.com/2020/04/27/1000658/google-medical-ai-accurate-lab-real-life-clinic-covid-diabetes-retina-disease/) that they got to see how it actually behaved: the poor lighting conditions in many clinics meant that many scans were unreadable, showing that the current version wasn't ready to roll out yet."
    },
    {
      "kind": "What",
      "headline": "Watch the technology and the organization around it.",
      "body": "As each development phase runs, record two things. The first is how well the technology performs: whether it does the job under real conditions. The second is what it reveals about your organization: how the work is actually practiced around it \u2014 the processes it has to fit, the habits it has to change, the systems it has to connect to.",
      "example": "Make a special effort to record the awkward findings. A disappointing result or an organizational snag is not an embarrassment to be worked around \u2014 it is exactly the information the next gate needs."
    },
    {
      "kind": "How",
      "headline": "Take the gate as each phase ends.",
      "body": "When a phase ends, judge its evidence against the exit criteria written at Define Development Program and take the decision right here. Go marks the phase complete and opens the way to the next; Recycle records a fail-and-repeat, returning the phase to running with revised dates and budget; Kill stops the project and releases every phase not yet entered. If the evidence isn't in yet, take no decision \u2014 the gate stays open. The final gate's Go is the launch decision.",
      "body2": "One of the most common failure modes for an innovation portfolio is never killing anything. A kill taken at a gate is cheap by design \u2014 that is what the phases were for \u2014 and the released capital is now available to fund new potential winners."
    },
    {
      "kind": "Outcome",
      "headline": "Development programs running, evidence deciding what happens next.",
      "body": "You come out of this step with your programs running phase by phase and a live record of how the technology and the organization are each performing.",
      "body2": "From here, the work turns to putting the organization on a sound footing before you take on more projects."
    }
  ],
  "4.2": [
    {
      "kind": "Why",
      "headline": "An enduring innovation pipeline needs robust long-term management.",
      "body": "The ninety-day push builds real discipline, but without permanent management structures in place, it's easy to lose momentum. This step establishes leadership tools that will help manage pipeline health well beyond the initial jump-start period."
    },
    {
      "kind": "What",
      "headline": "Build a light management layer.",
      "body": "Set up a light-touch management layer that focuses just on the systems required to stay in control of the pipeline. Further governance processes to manage AI risk are dealt with under the Governance Jump-Start module."
    },
    {
      "kind": "How",
      "headline": "Put three standing mechanisms in place.",
      "body": "Set up:",
      "bullets": [
        {
          "label": "A standing leadership agenda item",
          "text": "pipeline health reviewed regularly in a senior meeting, against a few clear metrics."
        },
        {
          "label": "A pipeline intake rule",
          "text": "AI won't enter your organization only through this pipeline \u2014 departments buy tools, teams wire models into their workflows, vendors switch on AI features. Set a spending threshold that routes anything significant into the pipeline."
        },
        {
          "label": "A quarterly portfolio review",
          "text": "finance, operations, and technology leaders meet on a set date to weigh the whole portfolio and decide what continues, scales, or stops."
        }
      ],
      "body2": "These mechanisms only work if they are genuinely used. A gate that always approves, or a review that keeps slipping, does not provide real control."
    },
    {
      "kind": "Outcome",
      "headline": "Pipeline governance that stays in place.",
      "body": "You finish with the three mechanisms set up and scheduled: the meeting, the gate, and the review each assigned to real people and dates. Managing the pipeline is now part of how the business runs, rather than something that depends on the initial effort."
    }
  ],
  "4.3": [
    {
      "kind": "Why",
      "headline": "Take stock of how your organizational structure performed.",
      "body": "Running live experiments should put your organizational structures under real pressure. This step is where you look at how they held up and decide what needs changing."
    },
    {
      "kind": "What",
      "headline": "A light review, not a full redesign.",
      "body": "This is a quick health check, not a deep reorganization. You're looking for the few things most worth adjusting, rather than trying to rebuild from the ground up. Building the right culture for your AI-ready business and designing your organization to fit are each the subject of a 90-day Jump-Start module of their own."
    },
    {
      "kind": "How",
      "headline": "Review four areas, then list what to fix.",
      "body": "Look back over the first seventy days and rate how well each part of the structure is working:",
      "bullets": [
        {
          "label": "Decision rights",
          "text": "Are the right decisions getting made or are they still getting stuck?"
        },
        {
          "label": "The ownership model",
          "text": "Is it giving both a clear overall view and empowering people close to the work?"
        },
        {
          "label": "Incentives",
          "text": "Are the changes actually shifting behavior?"
        },
        {
          "label": "Culture",
          "text": "Is it starting to shift, or are old habits reasserting themselves?"
        }
      ],
      "body2": "Based on your answers, draw up a short list of the things most in need of adjustment. This is only useful if you're honest. Scoring every line highly tells you nothing about what to improve."
    },
    {
      "kind": "Outcome",
      "headline": "A clear list of what to adjust.",
      "body": "You finish with a clear picture of how the structure is performing and a short list of priorities to adjust. These kinds of changes are not one-time fixes: the structure will keep needing adjustment as the pipeline grows."
    }
  ],
  "4.4": [
    {
      "kind": "Why",
      "headline": "The first comprehensive pipeline review is where the cycle really begins.",
      "body": "Your organization won't undergo a complete transformation in ninety days, but the pipeline you build will keep the engine running. This review is the first turn of that cycle: you act on what you learned from the development phases, bring in new ideas, and carry the lessons forward. Repeated regularly, it's what keeps the pipeline running.",
      "example": "Lasting value comes from managing your AI transformation as [a portfolio that is reviewed and rebalanced over time](https://hbr.org/2026/01/manage-your-ai-investments-like-a-portfolio) \u2014 scaling what works and dropping what doesn't."
    },
    {
      "kind": "What",
      "headline": "The first judgments made on real results.",
      "body": "Every choice up to now rested on estimates: which ideas to pursue, which to fund, how to balance the portfolio. This review is the first time you judge those initiatives on their real-world outputs, working with live results rather than projections. It is also the point where those judgments begin to carry real weight, shaping what continues and what comes next."
    },
    {
      "kind": "How",
      "headline": "Decide how each initiative moves, then capture the learnings.",
      "body": "The review has three parts:",
      "bullets": [
        {
          "label": "Buy, sell, or hold",
          "text": "for each initiative, decide whether to scale it, stop it, or keep it running as is based on what you have learned so far."
        },
        {
          "label": "Replenish and rebalance",
          "text": "add new opportunities to the pipeline, and check whether the mix across time horizons and risk is still right."
        },
        {
          "label": "Capture the learnings",
          "text": "what worked, what didn't, and what you need to change for the next cycle."
        }
      ],
      "body2": "Your decisions should be based on the evidence you have gathered, not your initial enthusiasm for the ideas."
    },
    {
      "kind": "Outcome",
      "headline": "The ninety days are done. The engine is running.",
      "body": "You finish with a decision on every initiative, a replenished pipeline, and a clear set of lessons for the next round. You now have a working innovation pipeline and the review process needed to sustain it.",
      "body2": "The ninety days were the jump-start. Repeating this cycle is what turns that initial push into a lasting capability."
    }
  ]
};

function hexToRgba(hex, alpha) {
  var h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c }).join('');
  var r = parseInt(h.substr(0, 2), 16) || 0;
  var g = parseInt(h.substr(2, 2), 16) || 0;
  var b = parseInt(h.substr(4, 2), 16) || 0;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function phaseColorFor(stepId) {
  // Theme-aware program data: these hexes feed hexToRgba(), so they cannot be
  // CSS var() references. Light mode uses the phase base hues for contrast.
  var m = (typeof UI !== 'undefined' && UI.theme === 'dark')
    ? { '1': '#4FB39A', '2': '#6B9FE0', '3': '#C8956A', '4': '#E07788' }
    : { '1': '#1B6B5A', '2': '#2D5A8E', '3': '#8B5E3C', '4': '#9B2D3F' };
  return m[String(stepId).charAt(0)] || '#B8892A';
}

/* Icon for each slide kind */
function vpSlideIcon(kind) {
  return { Why: '?', What: '■', How: '▲', Outcome: '★' }[kind] || '●';
}

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

function vpCarousel(code, title, dur, content) {
  if (!content || !content.length) {
    return '<div class="vp"><div class="vp-play"><span class="vp-play-icon">\u25b6</span></div><div><div class="vp-title">' + esc(title) + '</div><div class="vp-meta">' + esc(dur) + ' \xb7 ' + esc(code) + '</div></div></div>';
  }
  var stepId = code.replace(/^V-/, '').split('.').slice(0, 2).join('.');
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
    + '<button class="vp-nav vp-prev" onclick="carouselGo(carouselState.idx-1, true)" aria-label="Previous slide">\u2039</button>'
    + '<button class="vp-nav vp-next" onclick="carouselGo(carouselState.idx+1, true)" aria-label="Next slide">\u203a</button>'
    + '<div class="vp-slides">' + slides + '</div>'
    + '<div class="vp-dots">' + dots + '</div>'
    + '</div>';
}

function vp(code, title, dur) { var stepId = code.replace(/^V-/, '').split('.').slice(0, 2).join('.'); return vpCarousel(code, title, dur, (CAROUSEL_CONTENT || {})[stepId]) }
/* The "Mark Complete" button at the foot of every step.
   `disabled` is the caller's own gate (required fields still empty) and `helper`
   is what to say about it. On top of that, a step assigned to someone else can
   only be signed off by them or an admin - see stepCompleteLock() in
   js/features/assignments.js. The check is against the step on screen
   (currentStep), so every section of step 1.1 follows 1.1's assignment. */
function doneBtn(onclick, disabled, label, complete, helper) {
  // Already complete: show that state as-is, whoever is looking.
  if (complete) { return '<div class="done-wrap">' + btn(label || '✓ Complete', onclick, 'bd done-btn done-btn-complete', '', false) + '</div>'; }

  // Not yours to sign off. This outranks the required-fields gate: telling a
  // member to fill in fields they are not responsible for is a dead end.
  var lock = (typeof stepCompleteLock === 'function') ? stepCompleteLock(currentStep) : '';
  if (lock) { disabled = true; helper = lock; }

  return '<div class="done-wrap" onclick="gatePeek(event)">'
    + btn(label || '✓ Mark Complete & Continue →', onclick, 'bd done-btn' + (lock ? ' done-btn-locked' : ''), '', disabled)
    + (disabled ? '<p class="done-helper' + (lock ? ' done-helper-locked' : '') + '">' + esc(helper || 'Complete required fields (*) first.') + '</p>' : '')
    + '</div>';
}
function pipeViz(activeStage,navMap,live){var st=getStages(); /* live (17 Sep 2026): on the dashboard the chevrons open the live portfolio pages */var nm=navMap||{bluesky:'out-bluesky',explore:'out-explore',experiment:'out-expbriefs',operate:'out-oper'};var stages=[{k:'bluesky',n:'Blue Sky',c:'#1B6B5A',cnt:bsNowList(st).length,nav:nm.bluesky},{k:'explore',n:'Exploration',c:'#2D5A8E',cnt:st.explore.length,nav:nm.explore},{k:'experiment',n:'Development',c:'#8B5E3C',cnt:st.experiment.length,nav:nm.experiment},{k:'operate',n:'Operational',c:'#9B2D3F',cnt:(st.operational||[]).length,nav:nm.operate}];var h='<div class="u-778010b">';var _dk=(typeof UI!=='undefined'&&UI.theme==='dark');stages.forEach(function(s,i){var lit=s.cnt>0||s.k===activeStage;
/* Fill opacity is theme-aware: translucent fills read rich on the dark ground but
   wash to pastel over the light one, killing the white labels (Faisal, July 10).
   Light mode therefore renders near-solid fills so white text keeps contrast. */
var _op=s.k===activeStage?1:(activeStage?(_dk?.32:.35):(_dk?.55:.95));
var _dim=activeStage&&s.k!==activeStage;
var _nameFill=_dim?(_dk?'rgba(244,246,249,.6)':'rgba(36,46,60,.8)'):'#fff';
var _cntFill=_dim?(_dk?'rgba(244,246,249,.5)':'rgba(36,46,60,.65)'):'rgba(255,255,255,.92)';
h+='<div class="phase-flex" style="--op:'+(lit?1:.4)+'" onclick="'+(live?'go(\'portfolio\',\''+s.nav+'\')':'go(\''+s.nav+'\')')+'"><svg viewBox="0 0 200 80" class="u-0cc49e2"><path d="'+(i===0?'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 Z':'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 L 30 40 Z')+'" fill="'+s.c+'" opacity="'+_op+'"'+(s.k===activeStage?' stroke="#000" stroke-width="1.5"':'')+'/><text x="'+(i===0?85:100)+'" y="34" text-anchor="middle" fill="'+_nameFill+'" font-size="13" font-weight="700" font-family="Helvetica Neue,Arial,sans-serif">'+s.n+'</text><text x="'+(i===0?85:100)+'" y="56" text-anchor="middle" fill="'+_cntFill+'" font-size="12" font-weight="600" font-family="Helvetica Neue,Arial,sans-serif">'+s.cnt+' item'+(s.cnt!==1?'s':'')+'</text></svg></div>'});return h+'</div>'}
// Sidebar/topbar handled by master

// Home handled by master
// Per-phase intro videos. Add an entry (and drop the matching .mp4 into assets/media/)
// as each phase's video is produced; the player appears automatically.
var PHASE_VIDEOS = {
  1: { src: 'assets/media/innov-phase1.mp4', label: 'Phase One \u00b7 Diagnose' },
  2: { src: 'assets/media/innov-phase2.mp4', label: 'Phase Two \u00b7 Organize' },
  3: { src: 'assets/media/innov-phase3.mp4', label: 'Phase Three \u00b7 Prepare' },
  4: { src: 'assets/media/innov-phase4.mp4', label: 'Phase Four \u00b7 Ignite' },
  5: { src: 'assets/media/innov-phase5.mp4', label: 'Phase Five \u00b7 Navigate' }
};
function renderPhaseLandingPipe(phaseId) {
  var p = PH.find(function (x) { return x.id === phaseId }); if (!p) return ''; var _w = '<div class="content-area pt-110"><div class="content-inner">' + (backBtn() ? '<div class="mb-3">' + backBtn() + '</div>' : ''); var _we = '</div></div>';
  var desc = PHASE_DESCS[phaseId] || {}; var flow = STEP_FLOW[phaseId] || [];
  var done = p.steps.filter(function (s) { return isStepDone(s.id) }).length; var total = p.steps.length; var pct = total ? Math.round(done / total * 100) : 0;

  var ideas = data.ideas || [], as = data.assessments || {}, sel = data.selected || [], ow = data.ownership || {}, rh = data.rhythm || {}, proj = data.projects || {}, cap = data.capital || {}, port = data.portfolio || {}, exp = data.experiments || {}, exSel = data.expSelected || [], trk = data.tracking || {}, gov = data.governance || {}, cu = data.culture || {};
  var cs = Object.values(cu).filter(function (v) { return typeof v === 'number' }); var cScore = cs.length ? (cs.reduce(function (a, b) { return a + b }, 0) / cs.length).toFixed(1) : '\u2014';

  var metrics = phaseId === 1 ? [{ l: 'Ideas Generated', v: ideas.length, ic: '◇' }, { l: 'Ideas Filtered', v: sel.length, ic: '◉' }, { l: 'Culture Average', v: cScore + '/5', ic: '▒' }, { l: 'Steps Complete', v: done + '/' + total, ic: '✓' }]
    : phaseId === 2 ? [{ l: 'Owner Set', v: ow.ownerName ? 'Yes' : 'No', ic: '○' }, { l: 'RACI Items', v: Object.keys(data.raci || {}).length, ic: '⊕' }, { l: 'Rhythm Set', v: rh.day ? 'Yes' : 'No', ic: '↻' }, { l: 'Projects Deepened', v: sel.filter(function (i) { return (proj[i] || {}).viable !== undefined }).length, ic: '◉' }]
      : phaseId === 3 ? [{ l: 'Portfolio Items', v: Object.keys(port).length, ic: '▶' }, { l: 'Budget Set', v: cap.aiBudget ? 'Yes' : 'No', ic: '◻' }, { l: 'Tracks Mapped', v: Object.keys(data.budgetPlans || {}).filter(function (k) { return bpHasDev(parseInt(k, 10)) }).length, ic: '△' }, { l: 'Quick Wins', v: Object.keys(port).filter(function (k) { return port[k] && port[k].horizon === 'quick' }).length, ic: '→' }]
        : [{ l: 'Programs Tracked', v: Object.keys(trk).filter(function (k) { return trk[k] && trk[k].status }).length, ic: '\u25b6' }, { l: 'Governance Set', v: gov.meeting ? 'Yes' : 'No', ic: '—' }, { l: 'Review Done', v: (data.completedSteps || {})['4.4'] ? 'Yes' : 'No', ic: '■' }, { l: 'Stress Tested', v: (data.completedSteps || {})['4.3'] ? 'Yes' : 'No', ic: '✕' }];

  var mNav = { 1: { '0': '1.2', '1': '1.3', '2': '1.1', '3': '1.1' }, 2: { '0': '2.1', '1': '2.1', '2': '2.3', '3': '2.4' }, 3: { '0': '3.1', '1': '3.3', '2': '3.4', '3': 'out-expbriefs' }, 4: { '0': '4.1', '1': '4.2', '2': '4.4', '3': '4.3' } };

  var h = _w;
  var _pv = PHASE_VIDEOS[phaseId];
  if (_pv) {
    h += '<div class="overview-video-card mb-6"><div class="overview-video-label" style="color:' + p.color + '">' + esc(_pv.label) + '</div>'
      + '<video class="overview-video" controls preload="auto" playsinline><source src="' + _pv.src + '" type="video/mp4">Your browser does not support embedded video.</video></div>';
  }
  h += vizTimeline(phaseId);
  h += '<div class="u-96f7104"><div style="width:64px;height:64px;border-radius:32px;background:' + p.color + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;flex-shrink:0">' + phaseId + '</div><div><div class="flx-center gap-2"><h1 class="u-09ee37b">' + p.name + '</h1>' + badge(p.days, p.color) + '</div><p class="u-ccba76a">' + esc(desc.n || '') + '</p></div></div>';

  // Metrics
  h += '<div class="u-f78be26">';
  metrics.forEach(function (m, i) { var dest = (mNav[phaseId] || {})[i]; h += card('<div class="t-center" data-clickable="' + (dest ? 1 : 0) + '" onclick="' + (dest ? 'go(\'' + dest + '\')' : '') + '" ><div class="u-e5e6f83">' + m.ic + '</div><div class="ph-score" style="--c:' + p.color + '">' + m.v + '</div><div class="u-5964388">' + m.l + '</div></div>', 'padding:16px;border-top:3px solid ' + p.color) });
  h += '</div>';

  // Progress (hidden on the Navigate landing - no steps to complete there)
  if (phaseId !== 5) h += card('<div class="flx-row-mb-12"><h3 class="u-3526083">Progress</h3>' + badge(done + '/' + total + ' steps \xb7 ' + pct + '%', pct === 100 ? '#1B6B5A' : p.color) + '</div><div class="u-bc01850"><div class="pct-fill" data-full="' + (pct === 100 ? 1 : 0) + '" style="--w:' + pct + '%;--c:' + p.color + '"></div></div><div class="u-6f946a0">' + flow.map(function (s, i) { var d = isStepDone(s.id); var r = '<div onclick="go(\'' + s.id + '\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:8px 12px;border-radius:8px;background:' + (d ? 'rgba(27,107,90,.06)' : 'transparent') + ';min-width:70px"><div style="width:36px;height:36px;border-radius:18px;background:' + (d ? '#1B6B5A' : p.color + '20') + ';color:' + (d ? '#fff' : p.color) + ';display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid ' + (d ? '#1B6B5A' : p.color) + '">' + (d ? '\u2713' : s.icon) + '</div><div class="flow-label" data-done="' + (d ? 1 : 0) + '">' + s.sh + '</div></div>'; if (i < flow.length - 1) r += '<div class="flow-conn" data-done="' + (d && isStepDone(flow[i + 1].id) ? 1 : 0) + '"></div>'; return r }).join('') + '</div>', 'margin-bottom:24px');

  // Phase-complete wrap-up: persistent home on the landing once every step in the phase is done (July 10)
  if (phaseId !== 5 && pct === 100 && PHASE_WRAPUPS[phaseId]) {
    h += '<div class="milestone-card">';
    h += '<div class="milestone-label">\u2713 Phase ' + phaseId + ' Complete</div>';
    h += '<div class="milestone-text">' + PHASE_WRAPUPS[phaseId] + '</div>';
    h += '</div>';
  }

  // Steps + Outcomes grid
  h += '<div class="gr-2-mb"><div><div class="label-tiny">Steps</div>';
  p.steps.forEach(function (s) { var d = isStepDone(s.id); h += '<div onclick="go(\'' + s.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid ' + (d ? '#1B6B5A' : p.color) + '"><div style="width:20px;height:20px;border-radius:10px;background:' + (d ? '#1B6B5A' : p.color + '20') + ';color:' + (d ? '#fff' : p.color) + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">' + (d ? '\u2713' : s.id.split('.')[1]) + '</div><span style="font-size:13px;font-weight:600;color:' + (d ? '#1B6B5A' : 'var(--paper)') + ';flex:1">' + s.id + ' ' + s.name + '</span>' + (d ? '<span class="u-5ca1883">\u2713</span>' : '') + '</div>' });
  h += '</div><div><div class="label-tiny">Outcomes</div>';
  (p.outcomes || []).forEach(function (o) { h += '<div onclick="go(\'' + o.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid ' + p.color + '"><span class="u-3dd9b4c">' + o.icon + '</span><span class="u-884cbc8">' + o.name + '</span><span class="u-38575ff">\u2192</span></div>' });
  h += '</div></div>';


  // Completion
  if (pct === 100) { var msg = phaseId === 1 ? 'You\'ve diagnosed your organization\'s AI readiness and built a ranked portfolio.' : phaseId === 2 ? 'Your organizational machinery is in place.' : phaseId === 3 ? 'Portfolio structured, capital allocated, experiments designed.' : 'Experiments launched, governance established, first review complete.'; var next = phaseId < 4 ? 'phase-' + (phaseId + 1) : '5.1'; var nextLabel = phaseId < 4 ? 'Continue to Phase ' + (phaseId + 1) + ': ' + PH[phaseId].name + ' \u2192' : 'Go to Pipeline Dashboard \u2192'; h += card('<div class="t-center"><div class="u-e0bd553">★</div><h3 class="h-sub">Phase ' + phaseId + ' Complete</h3><p class="u-bbfc088">' + esc(msg) + '</p>' + btn(nextLabel, 'go(\'' + next + '\')', 'bp', 'margin-top:12px') + '</div>', 'background:rgba(27,107,90,.06);border:2px solid #1B6B5A') }
  return h + _we

}
// === PHASE 1 STEPS === (extracted to js/steps/phase1.js)

// === PHASE 2 STEPS === (extracted to js/steps/phase2.js)

// === PHASE 3 STEPS === (extracted to js/steps/phase3.js)


// === PHASE 4 STEPS === (extracted to js/steps/phase4.js)

// === PHASE 5: NAVIGATE DASHBOARD === (extracted to js/pages/navigate.js)


// === OUTCOME PAGES (simplified but functional) ===

// === OUTCOME PAGES (simplified but functional) ===
function renderOutReport(){
var co=data.completedSections||{};if(!co['1.1']||!co['1.2']||!co['1.3']||!co['1.4']||!co['1.5'])return'<h2 class="h-section-tight">Assessment Report</h2>'+card('<div class="empty-state"><p class="t-faint">Complete all 5 assessment sections first.</p></div>');
var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},de=data.decisions||{};
var cultureKeys=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'];var cs=cultureKeys.map(function(k){return typeof cu[k]==='number'?cu[k]:0}).reduce(function(a,b){return a+b},0);
var gaps=Object.values(de).filter(function(d){return d&&d.gap}).length;
return'<div class="flx-row-mb-20"><div class="pdf-hd"><h2 class="h-section">Assessment Report</h2><p class="t-fade-fs13">From your Assessment Battery</p></div>'+'<div class="pdf-btn-dock" style="display:flex;align-items:center;gap:10px">'+lyDepthCtl()+pdfBtn('printReport()')+'</div></div>'+
card('<div class="u-e572595">Executive Summary</div><p class="t-body-paper">Organization with '+(k.usage==='advanced'?'advanced':k.usage==='moderate'?'moderate':'limited')+' AI capabilities, '+(cs<=12?'low':cs<=20?'moderate':'strong')+' cultural readiness ('+cs+'/30). '+gaps+' decision rights gap(s).</p>','background:rgba(27,107,90,.06);border:2px solid #1B6B5A;margin-bottom:20px')+
'<div class="u-8c6263e">'+card('<div class="t-center"><div class="score-num-go">'+cs+'/30</div><div class="t-fade-md">Culture Score</div></div>','padding:16px')+card('<div class="t-center"><div class="u-9aa6bb3">'+((cu.uncertainty||0)<=2?'Averse':(cu.uncertainty||0)<=3?'Moderate':'Tolerant')+'</div><div class="t-fade-md">Risk Appetite</div></div>','padding:16px')+card('<div class="t-center"><div style="font-size:24px;font-weight:800;color:'+(gaps?'#9B2D3F':'#1B6B5A')+'">'+gaps+'</div><div class="t-fade-md">Decision Gaps</div></div>','padding:16px')+'</div>'+
card('<h3 class="h-sub-md">Purpose & Direction</h3><div class="u-2b217c4"><strong>Mission:</strong> '+esc(p.mission)+'<br/><br/><strong>Friction Points:</strong><br/><span class="u-d07753c">'+esc(p.frictions)+'</span></div>','margin-bottom:12px')+
card('<h3 class="h-sub-md">Decision Rights</h3>'+[{k:'q1',l:'Approve experiments'},{k:'q2',l:'Advance projects'},{k:'q3',l:'Reallocate budget'},{k:'q4',l:'Kill projects'},{k:'q5',l:'Cross-functional resources'}].map(function(q){return'<div class="u-d92c727"><strong>'+q.l+':</strong> '+esc((de[q.k]||{}).who||'\u2014')+((de[q.k]||{}).gap?'<span class="u-61bd6e7"> ‼ '+esc(de[q.k].gap)+'</span>':'')+'</div>'}).join(''))+card('<h3 class="h-sub">Readiness Profile</h3><p class="t-fade-fs13">Scored across the five Phase 1 dimensions.</p>'+vizRadarLarge(getAssessmentScores()),'margin-top:20px;padding:24px;background:rgba(var(--fg-rgb),.02)')}
function renderOutBluesky(){
var ideas=data.ideas||[],as=data.assessments||{};
var bsAll=getStages().bluesky;
var bsNow=bsAll.filter(function(i){return(ideas[i]||{}).when!=='future'});
var bsFut=bsAll.filter(function(i){return(ideas[i]||{}).when==='future'});
var rows=bsNow.map(function(i){var idea=ideas[i]||{},a=as[i]||{};var allG=a.techCapable!==undefined&&a.resourcesAvailable!==undefined&&a.culturalFit!==undefined&&a.purposeAligned!==undefined&&a.affordable!==undefined;var feasible=a.techCapable&&a.resourcesAvailable&&a.culturalFit&&a.purposeAligned&&a.affordable;var disq=allG&&!feasible;var score=feasible?triageScore(i):null;return{i:i,idea:idea,a:a,score:score,disq:disq,feasible:feasible,g:disq?2:(score!==null?0:1)}}).sort(function(x,y){return x.g!==y.g?x.g-y.g:(y.score||0)-(x.score||0)});
var h='<div class="flx-between-top-mb"><div class="pdf-hd"><h2 class="h-section">Blue Sky Portfolio</h2><p class="t-lead">Ideas ranked by Filter &amp; Rank score. Expand a card to qualify, score, and select ideas for Exploration.</p></div>'+outputPrintRow('out-bluesky')+'</div>'+pipeViz('bluesky');
h+='<div class="mb-5">'+btn(UI.addForm?'Cancel':'+ Add New Idea','UI.addForm=!UI.addForm;UI.ec=null;UI.icDraft=null;render()','bs','font-size:13px')+'</div>';
if(UI.addForm)h+=renderIdeaForm();
h+=bsLegend();
var divDone=false;
rows.forEach(function(r){var idea=r.idea;var open=xOpen('bs'+r.i);
var col=r.disq?'#9B2D3F':'#1B6B5A';
if(r.disq&&!divDone){h+='<div class="t-faint-sm" style="margin:14px 0 8px;letter-spacing:.06em">DID NOT PASS QUALIFICATION</div>';divDone=true}
var head='<div class="xh" onclick="event.stopPropagation();UI.expanded[\'bs'+r.i+'\']=!UI.expanded[\'bs'+r.i+'\'];render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="h-card" style="flex:1;margin:0">'+esc(idea.name||'')+'</h4>'+(r.disq?badge('Disqualified','#9B2D3F'):badge('Now','#1B6B5A'))+'<span id="scoreOut_'+r.i+'" data-sflav="bs">'+(r.score!==null?'<span style="font-weight:700;font-size:14px;color:'+col+'">'+r.score+'<span style="font-size:11px;color:var(--text-faint)">/50</span></span>':r.disq?'':'<span class="t-faint-sm">unscored</span>')+'</span></div>';
var body='';
if(open){body='<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+ideaCardEdit(r.i)
+'<div class="pill-row">'+[{k:'techCapable',l:'Tech?'},{k:'resourcesAvailable',l:'Resources?'},{k:'culturalFit',l:'Culture?'},{k:'purposeAligned',l:'Purpose?'},{k:'affordable',l:'Affordable?'}].map(function(g){var v=r.a[g.k];return'<button onclick="toggleGate('+r.i+',\''+g.k+'\')" class="gate-btn'+(v===true?' pass':v===false?' fail':'')+'">'+(v===true?'\u2713':v===false?'\u2717':'\u25cb')+' '+g.l+'</button>'}).join('')+'</div>'
+(r.feasible?'<div class="u-46b97fa">'+[{k:'priority',l:'Priority'},{k:'risk',l:'Risk(10=low)'},{k:'value',l:'Value'},{k:'costScore',l:'Cost(10=low)'},{k:'difficulty',l:'Ease(10=easy)'}].map(function(d){return'<div><label class="t-faint-sm">'+d.l+'</label><input type="number" min="0" max="10" id="score_'+r.i+'_'+d.k+'" value="'+(r.a[d.k]!=null?r.a[d.k]:'')+'" onchange="saveScore('+r.i+',\''+d.k+'\')" class="score-mini"/></div>'}).join('')+'</div>':'')
+(r.feasible?'<div style="margin-top:6px">'+'<button onclick="askAdvanceIdea('+r.i+')" style="padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--text-faint)">Advance to Exploration Portfolio</button>'+'</div>':'')
+(r.disq?'<p class="t-faint-sm" style="margin-top:8px">Failed one or more feasibility gates. Change a gate above to requalify, or archive it.</p>':'')
+'<div style="margin-top:10px">'+archBtn(r.i)+'</div></div>'}
h+=card(head+body,'border-left:4px solid '+col+';margin-bottom:10px'+(r.disq?';background:rgba(155,45,63,.04)':'')+(open?'':';cursor:pointer'),xpandAttr('bs'+r.i,open))});
if(!ideas.length)h+=card('<div class="empty-state"><p class="t-faint">No ideas in the Blue Sky portfolio yet. Click + Add New Idea to capture your first use case.</p></div>');
else if(!rows.length)h+=card('<div class="empty-state"><p class="t-faint">'+(bsFut.length?'All remaining ideas are parked as Future \u2013 expand the Ideas for the Future section below, or move one to Now to work on it here.':'All current ideas have advanced to Exploration \u2013 add a new idea to keep the intake full.')+'</p></div>');
if(bsFut.length){var fOpen=xOpen('bsFold');
h+='<div class="u-3ae1f62"><button class="btn-ghost pad-chip-sm" style="color:#2D5A8E;border-color:rgba(45,90,142,.4)" onclick="UI.expanded.bsFold=!UI.expanded.bsFold;render()">'+(fOpen?'\u25be':'\u25b8')+' Ideas for the Future ('+bsFut.length+')</button>';
if(fOpen){bsFut.forEach(function(i){var idea=ideas[i]||{};var fo=xOpen('bsf'+i);
var fhead='<div class="xh" onclick="event.stopPropagation();UI.expanded[\'bsf'+i+'\']=!UI.expanded[\'bsf'+i+'\'];render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">'+(fo?'\u25be':'\u25b8')+'</span><h4 class="h-card" style="flex:1;margin:0">'+esc(idea.name||'')+'</h4>'+badge('Future','#2D5A8E')+'</div>';
var fbody=fo?'<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+ideaCardEdit(i)+'<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+btn('\u2192 Move to Now','moveIdeaToNow('+i+')','bs','font-size:12px')+archBtn(i)+'</div><p class="t-faint-sm" style="margin-top:8px">Moving to Now returns this idea to the ranked list above, where it can be qualified, scored, and selected.</p></div>':'';
h+=card(fhead+fbody,'border-left:4px solid #2D5A8E;margin-bottom:10px'+(fo?'':';cursor:pointer'),xpandAttr('bsf'+i,fo))})}
h+='</div>'}
h+=balancePanel(bsNow,'bluesky');
if(bsFut.length)h+='<p class="t-faint-sm" style="margin-top:-10px;margin-bottom:16px">Counts and balance cover Now ideas only \u2013 Future ideas join when moved to Now.</p>';
h+=archivePanel(['bluesky'],'obs');
return h}
function moveIdeaToNow(i) { if (!data.ideas || !data.ideas[i]) return; data.ideas[i].when = 'now'; Store.commit('ideas'); UI.expanded['bs' + i] = true; render() }
function renderOutOrgReady(){
var co=data.completedSteps||{};if(!(co['2.1']&&co['2.2']&&co['2.3']))return'<h2 class="h-section-tight">Org Readiness</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Steps 1\u20133 first.</p></div>');
var M=orgReadinessModel(),ow=M.ow,inc=M.inc,full=true; /* 17 Sep 2026 (Paul's ruling): one definitive version; the page shows everything */
var fig=function(v,l){return '<div class="t-center" style="flex:1;min-width:120px"><div class="score-num-md" style="font-size:26px">'+v+'</div><div class="fs-13" style="margin-top:3px">'+l+'</div></div>'};
var h='<div class="flx-row-mb-20"><div class="pdf-hd"><h2 class="h-section">Org Readiness Summary</h2><p class="t-fade-fs13">From Phase 2, Steps 1\u20133</p></div>'+pdfBtn('printOrgReady()')+'</div>';
h+=card('<div class="u-7d1bdc0">Summary</div><p class="t-body-paper">'+esc(M.summary)+'</p>','background:rgba(45,90,142,.06);border:2px solid #2D5A8E;margin-bottom:20px');
h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(M.leads.length,'Embedded leads')+fig(M.metrics.length,'Innovation metrics')+fig(M.done+' / '+M.chk.length,'Readiness checks')+'</div>','margin-bottom:16px'); /* the figures the document opens with */
h+=card('<h3 class="h-sub-lg">Organizational Readiness Checklist</h3>'+M.chk.map(function(c,i){return'<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:'+(i<M.chk.length-1?'1px solid rgba(var(--fg-rgb),.04)':'none')+'"><div style="width:20px;height:20px;border-radius:10px;background:'+(c.d?'#1B6B5A':'rgba(var(--fg-rgb),.06)')+';color:'+(c.d?'#fff':'#ccc')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">'+(c.d?'\u2713':'\u25cb')+'</div><div style="flex:1"><span style="font-size:13px;color:'+(c.d?'var(--paper)':'var(--text-faint)')+'">'+c.l+'</span>'+(full?'<div class="t-faint-sm" style="margin-top:3px">'+esc(c.ev)+'</div>':'')+'</div></div>'}).join('')+'<p class="t-faint-sm" style="margin-top:12px">'+M.done+' of '+M.chk.length+' complete ('+M.pct+'%)</p>','margin-bottom:20px');
h+='<div class="gr-2-mb-5">'+card('<h3 class="h-sub-md">Pipeline Owner</h3><p class="fs-13"><strong>'+esc(ow.ownerName)+'</strong> ('+esc(ow.ownerRole)+')<br/>'+esc(ow.authority)+'</p>')+card('<h3 class="h-sub-md">Innovation Rhythm</h3><p class="fs-13">Every <strong>'+esc(M.rh.day)+'</strong> at '+esc(M.rh.time||'TBD')+'<br/>'+esc(M.att.join(', '))+(full&&M.agenda.length?'<br/><strong>Agenda:</strong> '+esc(M.agenda.join('; ')):'')+'</p>')+'</div>';
h+='<div class="gr-2-mb-5">'+card('<h3 class="h-sub-md">Embedded Leads</h3><p class="fs-13">'+(M.leads.length?M.leads.map(function(l){return esc(l.name||'Unnamed')+(full&&l.dept?' <span class="t-faint-sm">\u2014 '+esc(l.dept)+'</span>':'')}).join('<br/>'):'<span class="t-faint">None yet</span>')+'</p>')+(full?card('<h3 class="h-sub-md">Engaged Senior Leaders</h3><p class="fs-13">'+(M.seniors.length?M.seniors.map(function(l){return esc(l.name||'Unnamed')+(l.role?' <span class="t-faint-sm">\u2014 '+esc(l.role)+'</span>':'')}).join('<br/>'):'<span class="t-faint">None yet</span>')+'</p>'):'')+'</div>';
h+=card('<h3 class="h-sub-md">Incentive Changes</h3><p class="fs-13"><strong>From:</strong> '+esc(inc.current)+'<br/><strong>To:</strong> '+esc(inc.changes)+'<br/><strong>Metrics:</strong> '+esc(M.metrics.join(', ')||'None selected')+'</p>');
return h} /* 17 Sep 2026 (Paul's ruling): the figures and the checklist under the summary; Summary / Full — Full adds the senior leaders, the leads' departments, the agenda, and the evidence beneath each check */
function renderOutGovFW(){
var co=data.completedSteps||{};if(!co['4.2'])return'<h2 class="h-section-tight">Governance Framework</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Phase 4 Step 2 first.</p></div>');
var gov=data.governance||{};
var h='<div class="flx-between-top-mb"><div class="pdf-hd">'+badge('Phase 4 Output','#9B2D3F')+'<h2 class="h-big">Governance Framework</h2><p class="t-stone-sm">Three mechanisms for sustainable innovation</p></div>'+pdfBtn('printGovFW()')+'</div>';
h+=card('<div class="u-dcfde71">Executive Summary</div><p class="u-ef1e93b">Governance embedded across three mechanisms: standing agenda in <strong>'+esc(gov.meeting||'leadership meetings')+'</strong>, gate reviews above <strong>'+esc(gov.threshold||'threshold')+'</strong>, quarterly reviews from <strong>'+esc(gov.firstReview||'TBD')+'</strong>.</p>','background:rgba(155,45,63,.04);border:1px solid rgba(155,45,63,.2);margin-bottom:20px');
var pillars=[{ic:'—',t:'Standing Leadership Agenda',c:'#1B6B5A',items:[{l:'Embedded in',v:gov.meeting},{l:'Metrics',v:gov.metrics||'\u2014'},{l:'Format',v:gov.format||'\u2014'}]},{ic:'◉',t:'Pipeline Intake Rule',c:'#2D5A8E',items:[{l:'Threshold',v:gov.threshold},{l:'Review process',v:gov.gateProcess||'\u2014'},{l:'Outside-pipeline audit',v:gov.outsideAudit||'\u2014'}]},{ic:'■',t:'Quarterly Review',c:'#8B5E3C',items:[{l:'Attendees',v:gov.reviewAttendees},{l:'Agenda',v:gov.reviewAgenda||'\u2014'},{l:'First review',v:gov.firstReview||'\u2014'}]}];
pillars.forEach(function(p){h+=card('<div class="u-9cd32e3"><span class="u-fcc53cb">'+p.ic+'</span><h3 class="u-534d57b">'+p.t+'</h3></div>'+p.items.map(function(it){return'<div class="u-a67e826"><div style="font-family:var(--mono);font-size:10px;font-weight:700;color:'+p.c+';text-transform:uppercase;letter-spacing:.1em;min-width:110px;padding-top:2px">'+it.l+'</div><div class="u-2131614">'+esc(it.v)+'</div></div>'}).join(''),'border-left:3px solid '+p.c+';margin-bottom:12px')});
h+='</div>';
return h}
function renderOutOrgRev(){
var co=data.completedSteps||{};if(!co['4.3'])return'<h2 class="h-section-tight">Org Design Review</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Phase 4 Step 3 first.</p></div>');
var stress=data.stress||{};
return'<div class="flx-between-top-mb"><div class="pdf-hd">'+badge('Phase 4 Output','#9B2D3F')+'<h2 class="h-section-loose">Organizational Design Review</h2></div>'+outputPrintRow('out-orgrev')+'</div>'+'<div class="gr-2-mb-5">'+
[{k:'decisions',l:'Decision Rights',ic:'◉'},{k:'ownership',l:'Ownership Model',ic:'+'},{k:'incentives',l:'Incentive Changes',ic:'▒'},{k:'culture',l:'Culture Shift',ic:'◉'}].map(function(q){var sc=stress[q.k+'Score']||0;return card('<div class="flx-center gap-2 mb-2"><span>'+q.ic+'</span><div class="u-2e5190f">'+q.l+'</div><div style="margin-left:auto;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;background:'+(sc>=4?'rgba(27,107,90,.08)':sc>=3?'rgba(139,94,60,.06)':'rgba(155,45,63,.06)')+';color:'+(sc>=4?'#1B6B5A':sc>=3?'#8B5E3C':'#9B2D3F')+'">'+sc+'/5</div></div><p class="t-soft-13">'+esc(stress[q.k]||'\u2014')+'</p>')}).join('')+'</div>'+
card('<h3 class="h-sub-md">Adjustment Plan</h3>'+(stress.tuningList||[]).filter(function(t){return t}).map(function(t,i){return'<div class="u-ebfe612"><strong class="u-d6ff56e">'+(i+1)+'.</strong> '+esc(t)+'</div>'}).join(''),'border:2px solid #9B2D3F')}
function renderOutCapplan(){var cap=data.capital||{};
if(!cap.aiBudget)return'<h2 class="h-section-tight">Capital Snapshot</h2>'+card('<div class="empty-state"><p class="t-faint">Set your Year 1 budget at Step 3.2.</p></div>');
var av=capAvailable(),ideas=data.ideas||[],stages=getStages(),proj=data.projects||{},trk=data.tracking||{};
var h='<div class="flx-between-top-mb"><div class="pdf-hd">'+badge('Phase 3 Output','#8B5E3C')+'<h2 class="h-big">Capital Snapshot</h2><p class="t-stone-sm">'+capSnapLead()+'</p></div>'+pdfBtn('printCapPlan()')+'</div>';
h+=card('<div class="u-64e97f0">Financial Summary</div>'+capCells(false)+((cap.reallocation||cap.gapPlan||cap.killNotes||killPotRows().length)?'<div class="gr-2" style="margin-top:12px">'+((cap.killNotes||killPotRows().length)?'<div><div class="t-faint-sm">KILL & PHASE-OUT POT \u2013 '+fmtMoney(killPotTotal())+'</div>'+killPotRows().map(function(r){return'<p class="fs-14" style="margin:4px 0 0">'+esc(r.d||'')+(r.a?' \u2013 '+esc(r.a):'')+' <span class="t-faint-sm">(Year '+killPotYearOf(r)+')</span></p>'}).join('')+(cap.killNotes?'<p class="fs-14" style="margin:4px 0 0">'+esc(cap.killNotes)+'</p>':'')+'</div>':'')+(cap.reallocation?'<div><div class="t-faint-sm">REALLOCATION SOURCES</div><p class="fs-14" style="margin:4px 0 0">'+esc(cap.reallocation)+'</p></div>':'')+(cap.gapPlan?'<div><div class="t-faint-sm">FUNDING GAP & PLAN</div><p class="fs-14" style="margin:4px 0 0">'+esc(cap.gapPlan)+'</p></div>':'')+'</div>':''),'background:rgba(139,94,60,.04);border:1px solid rgba(139,94,60,.2);margin-bottom:16px');
var devRows=stages.experiment.filter(function(i){return(trk[i]||{}).status!=='killed'});
if(orgMonthly()){h+=capKpiStrip();h+=card('<h3 class="h-sub-md">The Committed Calendar</h3>'+orgSwimlanes(),'margin-bottom:16px');h+=card('<h3 class="h-sub-md">Capacity Waterfall</h3>'+orgWaterfallChart(),'margin-bottom:16px')}
h+=card('<h3 class="h-sub-md" style="color:#8B5E3C">Committed \u2013 Development ('+devRows.length+')</h3>'+(devRows.length?devRows.map(function(i){var cS=devCost(i),c=projCosts(i);return'<div style="padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><div class="flx-row-mb"><h4 class="h-card" style="flex:1">'+esc((ideas[i]||{}).name)+'</h4><span class="t-faint-sm">Development '+fmtMoney(cS)+' \u00b7 est. rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 est. sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'+progSnapRO(i)+'</div>'}).join(''):'<p class="t-faint-sm">Nothing in Development at this snapshot.</p>'),'margin-bottom:16px');
var ops=stages.operational||[];
h+=card('<h3 class="h-sub-md" style="color:#9B2D3F">Committed \u2013 Operational ('+ops.length+')</h3>'+(ops.length?(function(){var _cr=capCommitments().rows;return ops.filter(function(i){return(trk[i]||{}).status!=='killed'}).map(function(i){var r=null;for(var k=0;k<_cr.length;k++)if(_cr[k].i===i&&_cr[k].stage==='Operational'){r=_cr[k];break}var amt=r?r.amt:0,lbl=r?r.label:'Full plan';return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">'+lbl+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(amt)+'</strong></div>'}).join('')})():'<p class="t-faint-sm">Nothing operational at this snapshot.</p>'),'margin-bottom:16px');
var opts=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
h+=card('<h3 class="h-sub-md" style="color:#2D5A8E">Exploration (potential future projects, no financial commitments yet) ('+opts.length+')</h3>'+(opts.length?opts.map(function(i){var c=projCosts(i);return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+(progContracted(i)?badge('Program contracted','#1B6B5A'):'')+badge(getScore(i)+'/50','#2D5A8E')+'<span class="t-faint-sm">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'}).join(''):'<p class="t-faint-sm">No Go projects waiting in Exploration.</p>'));
return h}
// === MAIN RENDER ===

// === PDF EXPORT FUNCTIONS ===
function printThemeTokens() {
  // Print windows are bare (no styles.css), so the swept var() references need
  // definitions. Print is always the light theme. Shadows are suppressed for paper;
  // font tokens are included so mono/serif stamps keep their faces in print.
  //
  // THIS IS THE ONLY STYLESHEET THE EXPORT GETS (17 Sep 2026). printDocument()
  // opens a bare window and writes a self-contained page into it, so nothing in
  // assets/css reaches the document — whatever this returns is all it has. The
  // @media print block of assets/css/styles.css still dresses a plain ⌘P of the
  // page on screen, so BOTH have to be kept in step, and the values here must
  // agree with the ones there.
  //
  // For the months between, the export printed the live document instead and
  // nothing called this; it was kept then for the standalone review builds under
  // <role>/dev/, which print through a window of their own, and because
  // tools/port-exec-readiness.js lists it as deliberately left with the shell
  // rather than lifted into a module. Both are still true.
  return ':root{--ink:#EAEEF4;--paper:#1E2530;--bg-rgb:234,238,244;--fg-rgb:30,37,48;' +
    '--stone:#303C4A;--text-muted:#303C4A;--text-fade:#404C5A;--text-faint:#58656F;' +
    '--faint-rgb:88,101,111;--ref-accent:#0A7FB5;' +
    '--text-body:#333E4B;--text-mid:#47525F;--text-hint:#2A3542;--text-bright:#273240;--text-soft:#3F4A58;--text-max:#1E2530;' +
    '--bg-elev:#FFFFFF;--menu-bg:#FFFFFF;--menu-fg:#1E2530;--warn-text:#8F6A00;--warn-pale:#7E6A00;' +
    '--ph1-t:#1B6B5A;--ph2-t:#2D5A8E;--ph3-t:#8B5E3C;--ph4-t:#9B2D3F;--ph5-t:#6B4C8A;' +
    '--gold:#E8621A;--gold-rgb:232,98,26;--gold-light:#F07A37;--gold-pale:#FDE8D8;--navy:#1E2530;--rule:rgba(15,45,74,.32);--rule-rgb:15,45,74;--head-blue:#076D9E;--gold-text:#B34208;' +
    '--ph1:#1B6B5A;--ph2:#2D5A8E;--ph3:#8B5E3C;--ph4:#9B2D3F;--ph5:#6B4C8A;' +
    '--surface:rgba(var(--fg-rgb),.06);--border-faint:rgba(var(--fg-rgb),.12);--border-soft:rgba(var(--fg-rgb),.08);' +
    '--border-softer:rgba(var(--fg-rgb),.06);--bg-card:rgba(var(--fg-rgb),.03);--bg-card-hover:rgba(232,98,26,.04);' +
    '--bg-input:rgba(var(--fg-rgb),.06);--shadow-card:none;--shadow-elev:none;' +
    "--serif:'Cormorant Garamond',Georgia,serif;--mono:'DM Mono',Menlo,Consolas,monospace;--sans:'Helvetica Neue',Arial,sans-serif}";
}

var PRINT_MODULE_NAME='90-Day AI Innovation Pipeline'; /* 16 Sep 2026 (Paul's ruling, family): the cover's kicker takes the Governance form — 90-Day and the module's name; the home page reads 90 Days to an AI Innovation Pipeline */

/* PRINT BASELINE (Paul's ruling, 12 Sep 2026; family): the cover's parts and the footer's words */
function printDateLine(){return new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
function printFooterText(){return '\u00a9 '+new Date().getFullYear()+' Next Chapter, LLC. All rights reserved.'} /* the same words as the site footer at nextchapter.org */
function printDocCover(title,lead,countLine){var org=(function(){var ent=(data&&data.enterprise&&String(data.enterprise.name||'').trim())||'';if(ent)return ent;var o=null;try{o=getOrg(currentOrgId)}catch(e){}return (o&&o.name)||''})(); /* 13 Sep 2026 (Paul's ruling; family): the cover names the organization as Organization Details (the Organization & Team panel) records it; the sign-in organization's label is the fallback only when that name is blank — ported to the Innovation Pipeline 16 Sep 2026 (Paul's ruling: the cover as Governance has it) */
return '<div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:85vh">'
+'<div style="font-family:var(--mono,monospace);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin:0 0 18px">NextChapter \u00b7 '+esc(PRINT_MODULE_NAME)+'</div>'
+'<div style="font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px">'+esc(title)+'</div>'
+(lead?'<div style="font-size:14px;color:#444;line-height:1.6;max-width:520px;margin:0 0 26px">'+esc(lead)+'</div>':'')
+'<div style="border-top:2px solid #111;padding-top:12px;color:#333">'+(org?'<div style="font-size:18px;font-weight:600;color:#111;margin:0 0 4px">'+esc(org)+'</div>':'')+'<div style="font-size:13px">'+printDateLine()+'</div></div>'
+'</div>'} /* PRINT COVER (Paul's ruling, 12 Sep 2026; family): NextChapter · module, the title, the lead, the organization a little bigger, the date alone; no phase, no count (the count argument is accepted and ignored) */
function _pdStrip(body){ /* the screen's heading block (title, lead, print control) comes off so the title lives on the cover only; every button goes */
  var m=body.indexOf('PDF</button></div>');if(m>=0)body=body.slice(m+18);
  return body.replace(/<button[\s\S]*?<\/button>/g,'')}
function _pdLead(body){var m=body.indexOf('PDF</button></div>');if(m<0)return '';var head=body.slice(0,m);var p=head.match(/<p[^>]*>([\s\S]*?)<\/p>/);return p?p[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim():''} /* the lead is the screen's own sub-line */

/* The export prints THIS document, not a second one.
   ────────────────────────────────────────────────────────────────────────────
   It used to open a popup, document.write() a whole page into it, re-link
   styles.css and the webfonts, and print from that window's load event. Chrome
   is happy with that; SAFARI IS NOT. Safari's popup blocker takes a window
   opened with no URL, and the about:blank document it hands back finishes its
   own load asynchronously – so the written markup is raced by that load and the
   tab is simply blank. The reported symptom was exactly that: "click ↓ PDF, on
   Safari nothing shows".

   Nothing in the export actually needed a second window. Everything the copy
   has to look right – styles.css, the loaded webfonts, the SVG sizing rules –
   is already in this document. So the content is mounted here instead, in a
   root that is display:none on screen and the ONLY visible thing in print
   (assets/css/styles.css, `html.is-printing`), and window.print() is called on
   the page itself. No popup, no blocker, no cross-document load to race, and
   the same code path on every browser.

   The paper pass – light tokens, controls removed, fields flattened – now lives
   in the stylesheet's @media print block rather than in a string here, so a
   plain ⌘P and the module pages' own "▾ Save as PDF" buttons get it too.

   The mounted copy is a clone of markup that already exists on screen, so ids
   inside it are duplicated for as long as it is mounted. That window is the
   print call and nothing else: the root is emptied again as soon as the dialog
   closes. */
var PRINT_ROOT_ID = 'pdfPrintRoot';
function printPage(title,contentFn){var raw=contentFn();printDocument(title,printDocCover(title,_pdLead(raw),'')+_pdStrip(raw),'')} /* 12 Sep 2026 (Paul's ruling): a cover, then the body without its heading */
function printDocument(title,content,extraCss,opts){ /* 14 Sep 2026: opts.preview shows the document as a sheet with its forced page breaks marked and a Show as pages button, and does not open the print dialog */ /* 13 Sep 2026: the shared print window – the family styles, an optional stylesheet for bespoke report documents, the content, the footer */
var w=window.open('');if(!w){alert('The print view was blocked by the browser. Allow pop-ups for this site and try again.');return}
w.document.write('<html><head><meta charset="utf-8"><title>'+title+'</title>'+
((window.Modules && Modules.isActive('pipeline')) ? '<link rel="stylesheet" href="'+(function(){try{return new URL('fonts/fonts.css', document.baseURI || location.href).href}catch(e){return 'fonts/fonts.css'}})()+'">' /* Part 1, live for the Pipeline: document.baseURI honours <base href="/apps/">; location.href would not */ : (window.Modules && (Modules.isActive('exec-readiness') || Modules.isActive('ai-governance'))) ? '<link rel="stylesheet" href="'+(function(){try{return new URL('fonts/print.css', document.baseURI || location.href).href}catch(e){return 'fonts/print.css'}})()+'">' /* Part 1, live for Executive Readiness (7 Oct 2026): print.css = exactly this window's Google weights; ER prints through its own printDocument (steps.js), this is the fallback; Responsible AI Governance too (7 Oct 2026): its own printPage uses fonts/print-governance.css, and this window, when a shell feature prints on its page, needs exactly print.css */ : '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:wght@400;600&display=swap" rel="stylesheet">')+
'<style>'+printThemeTokens()+'*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Helvetica Neue",Arial,sans-serif;max-width:750px;margin:40px auto;padding:0 40px;line-height:1.7;font-size:14px;color:#1e2530;background:#fff}'+
'h1,h2,h3,h4{color:#1a1612;break-after:avoid;page-break-after:avoid}a{color:#2D5A8E}'+
'.btn,.btn-ghost,.bp,.bs,.bg,.bg2,.bd{display:none !important}button{display:none !important}'+
'.cd{background:none;border:none;border-radius:0;padding:8px 0;margin-bottom:14px;page-break-inside:avoid}'+
'select{-webkit-appearance:none;appearance:none;border:none;background:none;font-weight:600;font-size:13px;color:#1a1612}textarea{border:none;background:none;font-size:13px;color:#1e2530;resize:none}'+
'table{border-collapse:collapse;width:100%}th,td{padding:7px 8px;vertical-align:top;border-bottom:1px solid #e0e0e0;text-align:left}'+
'*{-webkit-print-color-adjust:exact;print-color-adjust:exact}[style*="#F5F2EC"],[style*="#8A8278"],[style*="rgba(245,242,236"],[style*="rgba(138,130,120"],[style*="color:var(--paper)"]{color:#1e2530 !important}[style*="color:var(--stone)"],[style*="color:var(--text-muted)"],[style*="color:var(--text-faint)"]{color:#555 !important}@media print{body{margin:0;padding:0}}'+
'@page{margin:16mm 14mm 20mm 14mm;@top-left{content:""}@top-center{content:""}@top-right{content:""}@bottom-center{content:""}@bottom-left{content:"'+printFooterText()+'";font:9px "DM Mono",monospace;color:#666}@bottom-right{content:counter(page) " / " counter(pages);font:9px "DM Mono",monospace;color:#666}}'+ /* PRINT MARGINS (Paul's ruling, 12 Sep 2026; family): the document owns all six page corners — the top three empty, the copyright line bottom left, the page number bottom right — so the browser's own date, title, address, and count never print, whatever the user's Headers and footers setting */
'.print-footer{display:none}@media screen{.print-footer{display:block;margin-top:40px;padding-top:10px;border-top:1px solid #ddd;font-family:"DM Mono",monospace;font-size:9px;letter-spacing:.06em;color:#666}}'+ /* on screen, before printing, the copyright line ends the document */
(extraCss||'')+'</style></head><body>'+((opts&&opts.preview)?'<div class="preview-note" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:12px/1.5 var(--sans,sans-serif);color:#333;background:#FBF6EC;border:1px solid #E8D9B8;padding:8px 12px;margin:0 0 24px"><button onclick="window.print()" style="font:12px var(--sans,sans-serif);font-weight:600;padding:6px 14px;border:1px solid #333;border-radius:6px;background:#fff;color:#111;cursor:pointer;white-space:nowrap">Show as pages</button><span style="flex:1;min-width:240px">Preview. Dashed rules below mark where the document forces a page break; where the printer breaks a long section in the middle is set when it prints. Show as pages opens your browser\u2019s print preview, where the pages are exact, and Cancel returns here.</span></div>'+'<style>@media print{.preview-note{display:none}}@media screen{html{background:#e6e6e6}body{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 32px rgba(0,0,0,.08);padding:56px 64px !important;margin:24px auto !important}[style*="break-before:page"]::before,[style*="page-break-after:always"]:not([style*="display:flex"])::after,[style*="min-height:85vh"]+*::before{content:"page break";display:block;text-align:center;font:10px "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#999;border-top:1px dashed #bbb;padding-top:6px;margin:28px 0 24px}[style*="page-break-after:always"]+[style*="break-before:page"]::before{display:none}}</style>':'')+content+'<div class="print-footer">'+printFooterText()+'</div>'+((opts&&opts.preview)?'':'<scr'+'ipt>(function(){function p(){try{window.print()}catch(e){}}if(document.readyState==="complete"){setTimeout(p,60)}else{window.addEventListener("load",function(){setTimeout(p,60)})}})();<\/scr'+'ipt>')+'</body></html>');
w.document.close()} /* 18 Sep 2026: the document prints ITSELF. print() suspends the script that calls it, so calling it on the popup from a timer in the opener left the app frozen behind a dialog it did not own. Waiting for load also beats the fixed 500ms, which cuts a slow webfont out of the first layout */

/* Portfolio output pages are accordions – on screen the detail sits behind a fold.
   A PDF of a collapsed accordion is not a record, so the print pass forces every
   card (and every tab) open. Set only for the duration of the content render;
   printPage() calls contentFn() synchronously, so the flag never leaks into the UI. */
var PRINT_EXPAND = false;
function xOpen(key) { return PRINT_EXPAND || !!UI.expanded[key] }
function printPortfolio(title, contentFn) {
  PRINT_EXPAND = true;
  try { printPage(title, contentFn) } finally { PRINT_EXPAND = false }
}


function printReport(){printDocument('Assessment Report',assessmentReportDoc(),'')} /* 16 Sep 2026: the composed document, not the page */


function printOrgReady(){printDocument('Org Readiness',orgReadinessDoc(),'')} /* 16 Sep 2026: the composed document, not the page */


function printCapPlan(){printDocument('Capital Snapshot',printDocCover('Capital Snapshot',capSnapLead(),'')+capReportBody(),CAP_REPORT_CSS)} /* CAPITAL SNAPSHOT REPORT (Paul's ruling, 13 Sep 2026): its own document – every budget year, then the total */
/* ── CAPITAL SNAPSHOT REPORT (Paul's ruling, 13 Sep 2026) ──────────────────────────────
   The printed snapshot is its own document rendered from the data, never the screen cleaned up.
   One section per budget year, then a Budget Total section. Each section opens with its
   Financial Summary, the three KPI tiles, that year's committed calendar, and its capacity
   waterfall (the last thing on the section's first page); the committed lists begin on a
   new page. Year sections show what lands in that year; the Total section shows the whole
   plan, the program phases, and the Exploration pipeline. */
function capSnapLead(){return'A point-in-time picture of a fluid state, taken '+fmtDate(new Date())+' ('+fmtQuarter(fyQuarterOf(new Date()))+'). Commitments move as the portfolio moves \u2013 this page is a snapshot, not an end-of-task deliverable.'}
var CAP_REPORT_CSS='.cr-sec{page-break-before:always}.cr-hk{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8B5E3C;margin:0 0 6px}.cr-h{font-family:var(--serif,Georgia,serif);font-size:30px;font-weight:600;color:#111;margin:0 0 8px;line-height:1.15}.cr-rule{border-top:2px solid #111;margin:0 0 18px}'
+'.cr-fin{border:1px solid rgba(139,94,60,.35);background:rgba(139,94,60,.05);border-radius:8px;padding:16px 18px;margin:0 0 14px;page-break-inside:avoid}.cr-fin-k{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8B5E3C;margin:0 0 12px}'
+'.cr-cells{display:flex;gap:14px}.cr-cell{flex:1;text-align:center}.cr-num{font-size:26px;font-weight:800;color:#2D5A8E;line-height:1.1}.cr-lbl{font-size:12px;color:#4E5A68;margin-top:4px}'
+'.cr-note{font-size:12px;color:#39434F;margin:12px 0 0;line-height:1.5}.cr-note2{font-size:11.5px;color:#64707E;margin:4px 0 0;line-height:1.5}.cr-fin-x{display:flex;gap:18px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(139,94,60,.25)}.cr-fin-x>div{flex:1}.cr-fin-xk{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64707E;margin:0 0 3px}.cr-fin-x p{font-size:12px;margin:2px 0 0;color:#1E2530}'
+'.cr-kpis{display:flex;gap:10px;margin:0 0 14px;page-break-inside:avoid}.cr-kpi{flex:1;display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(30,37,48,.16);border-radius:10px;background:#fff}.cr-kpi-l{font-size:13px;font-weight:700;color:#1E2530}.cr-kpi-s{font-size:11.5px;color:#4E5A68}.cr-kpi-n{font-size:22px;font-weight:800;line-height:1;flex-shrink:0}'
+'.cr-card{border:1px solid rgba(30,37,48,.14);border-radius:8px;padding:12px 14px;margin:0 0 14px;page-break-inside:avoid}.cr-card h3{font-size:15px;font-weight:700;color:#1E2530;margin:0 0 8px}.cr-cap{font-size:11px;color:#4E5A68;margin-top:6px;line-height:1.5}.cr-sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:middle}'
+'.cr-lists{page-break-before:always}.cr-list{margin:0 0 18px}.cr-list h3{font-size:16px;font-weight:700;margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(30,37,48,.15)}.cr-item{padding:8px 0;border-bottom:1px solid rgba(30,37,48,.08);page-break-inside:avoid}.cr-item-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.cr-item-h h4{font-size:14px;font-weight:700;margin:0;color:#1E2530}.cr-item-m{font-size:12px;color:#4E5A68;white-space:nowrap}.cr-item-y{font-size:12.5px;color:#1E2530;margin:3px 0 0}.cr-item-y strong{color:#8B5E3C}'
+'table.cr-t{width:100%;border-collapse:collapse;margin:8px 0 2px;font-size:12px}table.cr-t th{text-align:left;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#64707E;font-weight:500;padding:4px 8px 4px 0;border-bottom:1px solid rgba(30,37,48,.15)}table.cr-t td{padding:5px 8px 5px 0;border-bottom:1px solid rgba(30,37,48,.07);vertical-align:top;color:#1E2530}table.cr-t td.r,table.cr-t th.r{text-align:right;padding-right:0}'
+'.cr-row{display:flex;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid rgba(30,37,48,.08);page-break-inside:avoid}.cr-row .n{flex:1;font-size:13.5px;color:#1E2530}.cr-row .m{font-size:12px;color:#4E5A68}.cr-row .a{min-width:70px;text-align:right;font-weight:700;color:#1E2530}.cr-badge{display:inline-block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.08em;padding:2px 7px;border-radius:10px;color:#fff;margin-right:6px;vertical-align:middle}.cr-empty{font-size:12.5px;color:#64707E}';
/* the shared KPI derivation: the same figures the screen's capKpiStrip shows, for one lens (a year number or 'T') */
function capKpiData(sel){var yt=orgYearTotals();if(!yt||!yt.length)return null;var cap=data.capital||{};var Y=envYearsOf();
if(sel==null)sel=1;var isT=sel==='T';if(!isT&&!(sel>=1&&sel<=Y))sel=1;
var r;if(isT){var _b=0,_t=0,_rs=0,_su=0;yt.forEach(function(x){_b+=x.budget;_t+=x.total;_rs+=(x.reserve||0);_su+=x.sus});r={budget:_b,total:_t,headroom:_b-_t,reserve:_rs,sus:_su,susShare:_t?_su/_t:0,capPct:0}}else r=yt[sel-1];
var lblY=isT?'all years':'Year '+sel;var pctC=r.budget?Math.min(1,r.total/r.budget):0;var scp=parseFloat(cap.susCap);
return{sel:sel,isT:isT,r:r,lblY:lblY,
t1:{f:pctC,c:pctC>.85?'#D4A017':'#45A188',label:'Committed, '+lblY,sub:fmtMoney(r.total)+' of '+fmtMoney(r.budget)},
t2:{v:fmtMoney(r.headroom),neg:r.headroom<0,label:'Headroom, '+lblY,sub:(r.reserve?fmtMoney(r.headroom-r.reserve)+' net of the intake reserve':'available for new projects')},
t3:{f:(!isT&&scp>0)?Math.min(1,r.capPct):r.susShare,c:(!isT&&scp>0&&r.capPct>1)?'#D4A017':'#C25B73',label:isT?'Sustainment share':'Sustainment vs cap',sub:(isT?Math.round(r.susShare*100)+'% of all committed':(scp>0?Math.round(r.susShare*100)+'% of Year '+sel+' \u00b7 cap '+scp+'%':Math.round(r.susShare*100)+'% of Year '+sel))}}}
/* per-item money landing in program months a..b (inclusive), from the same monthly series the charts use */
function capReportItemYear(e,a,b){var M=envYearsOf()*12;var s=orgProjectMonthly(e.i,e.op,M,null,e.sunk);var o={dev:0,roll:0,sus:0};for(var m=a;m<=b&&m<=M;m++){o.dev+=s[m-1].dev;o.roll+=s[m-1].roll;o.sus+=s[m-1].sus}o.dev=Math.round(o.dev);o.roll=Math.round(o.roll);o.sus=Math.round(o.sus);o.total=o.dev+o.roll+o.sus;return o}
function capReportArc(f,col){var R=26,C2=2*Math.PI*R;return'<svg viewBox="0 0 64 64" style="width:54px;height:54px;flex-shrink:0"><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="rgba(30,37,48,.10)" stroke-width="7"/><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="7" stroke-dasharray="'+(C2*f).toFixed(1)+' '+C2.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="#1E2530">'+Math.round(f*100)+'%</text></svg>'}
/* the committed calendar for program months a..b: one lane per committed item active in the window, segments clipped to it */
function capReportLanes(a,b){var M=envYearsOf()*12,ideas=data.ideas||[];var n=b-a+1;var C={dev:'#45A188',roll:'#5B8DD9',sus:'#C25B73'};
var lanes=[];orgCommittedSet().filter(function(e){return !e.sunk}).forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,null);var segs=[];['dev','roll','sus'].forEach(function(k){var st=0;for(var m=a;m<=b+1;m++){var on=m<=b&&m<=M&&s2[m-1][k]>0.5;if(on&&!st)st=m;if(!on&&st){segs.push({k:k,a:st,b:m-1});st=0}}});
if(segs.length)lanes.push({name:(ideas[e.i]||{}).name||('Item '+e.i),legacy:!!((((data.projects||{})[e.i])||{}).legacy),segs:segs})});
if(!lanes.length)return'<p class="cr-empty">Nothing committed lands in these months.</p>';
var shown=lanes.slice(0,12);var W=720,LH=22,pad=170,Hh=shown.length*LH+30,cw=(W-pad-16)/n;
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
for(var g=0;g<=n;g++){var gx=pad+g*cw;h+='<line x1="'+gx.toFixed(1)+'" y1="2" x2="'+gx.toFixed(1)+'" y2="'+(Hh-18)+'" stroke="rgba(30,37,48,'+((g%(n>12?6:3))===0?'.14':'.05')+')"/>'}
shown.forEach(function(L,ix){var y=4+ix*LH;
h+='<text x="'+(pad-8)+'" y="'+(y+12)+'" text-anchor="end" font-size="10" fill="#39434F">'+esc(L.name.length>26?L.name.slice(0,25)+'\u2026':L.name)+(L.legacy?' \u25c6':'')+'</text>';
L.segs.forEach(function(sg){var x=pad+(sg.a-a)*cw,w=Math.max(2,(sg.b-sg.a+1)*cw);h+='<rect x="'+x.toFixed(1)+'" y="'+(y+2)+'" width="'+w.toFixed(1)+'" height="13" rx="3" fill="'+C[sg.k]+'"/>'})});
var step=n>12?6:1;for(var t=a;t<=b;t++){if(step===1||t%6===0)h+='<text x="'+(pad+(t-a+.5)*cw).toFixed(1)+'" y="'+(Hh-6)+'" text-anchor="middle" font-size="9" fill="#4E5A68">'+t+'</text>'}
h+='</svg>';
if(lanes.length>shown.length)h+='<div class="cr-cap">+'+(lanes.length-shown.length)+' more committed items not shown</div>';
h+='<div class="cr-cap">One lane per committed item \u00b7 program months '+a+'\u2013'+b+' \u00b7 <span class="cr-sw" style="background:#45A188;margin-left:0"></span>development <span class="cr-sw" style="background:#5B8DD9"></span>rollout <span class="cr-sw" style="background:#C25B73"></span>sustainment'+(shown.some(function(L2){return L2.legacy})?' \u00b7 \u25c6 legacy':'')+'</div>';
return h}
/* the capacity waterfall for program months a..b, on a scale shared by every section (mx) so the years read against each other */
function capReportWaterfall(a,b,mx){var srs=orgMonthly();if(!srs)return'';var CD='#45A188',CR='#5B8DD9',CS='#C25B73';var n=b-a+1;
if(!mx)return'<p class="cr-empty">Nothing committed yet \u2013 the first batch draws the first bars.</p>';
var W=720,Hh=190,pad=28,bw=(W-pad*2)/n,base=Hh-24;var sy=function(v){return (Hh-52)*(v/mx)};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
h+='<line x1="'+pad+'" y1="'+base+'" x2="'+(W-pad)+'" y2="'+base+'" stroke="rgba(30,37,48,.25)"/>';
for(var m=a;m<=b;m++){var r=srs[m-1];if(!r)continue;var ix=m-a;var x=pad+ix*bw+bw*.15,w=Math.max(1,bw*.7);var yy=base;
if(r.sus>0){var yS=sy(r.sus);yy-=yS;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yS.toFixed(1)+'" fill="'+CS+'"/>'}
if(r.roll>0){var yR=sy(r.roll);yy-=yR;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yR.toFixed(1)+'" fill="'+CR+'"/>'}
if(r.dev>0){var yD=sy(r.dev);yy-=yD;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yD.toFixed(1)+'" fill="'+CD+'"/>'}}
var pts='';for(var m2=a;m2<=b;m2++){var sc=capSusCapLine(m2);if(sc>0){var x1=pad+(m2-a)*bw,x2=pad+(m2-a+1)*bw,cy=base-sy(sc);pts+=(pts===''?'M':'L')+x1.toFixed(1)+' '+cy.toFixed(1)+'L'+x2.toFixed(1)+' '+cy.toFixed(1)}}
if(pts)h+='<path d="'+pts+'" fill="none" stroke="#B8860B" stroke-width="1.5" stroke-dasharray="4,3"/>';
var step=n>12?6:1;for(var t=a;t<=b;t++){if(step===1||t%6===0)h+='<text x="'+(pad+(t-a+.5)*bw).toFixed(1)+'" y="'+(Hh-10)+'" text-anchor="middle" font-size="9" fill="#4E5A68">'+t+'</text>'}
h+='</svg>';
h+='<div class="cr-cap"><span class="cr-sw" style="background:'+CD+';margin-left:0"></span>Development <span class="cr-sw" style="background:'+CR+'"></span>Rollout <span class="cr-sw" style="background:'+CS+'"></span>Sustainment \u00b7 program months '+a+'\u2013'+b+(pts?'<br/><span style="display:inline-block;width:18px;border-top:2px dashed #B8860B;margin:0 4px 0 0;vertical-align:middle"></span> The dashed line is the sustainment cap \u2013 the run-cost ceiling for the year, at its monthly rate':'')+'</div>';
return h}
/* one section: a budget year (y = 1..Y) or the total (y = 'T') */
function capReportSection(y,L,mx,idx,count){var Y=envYearsOf(),cap=data.capital||{},ideas=data.ideas||[],stages=getStages(),trk=data.tracking||{},proj=data.projects||{};
var isT=y==='T';var a=isT?1:(y-1)*12+1,b=isT?Y*12:y*12;var d=isT?L.tot:L.years[y-1];
var h='<div class="'+(idx?'cr-sec':'')+'">';
h+='<div class="cr-hk">Capital Snapshot \u00b7 section '+(idx+1)+' of '+count+'</div><div class="cr-h">'+(isT?'Budget Total \u2013 '+Y+' years':'Budget Year '+y)+'</div><div class="cr-rule"></div>';
/* Financial Summary */
var cells=[{v:fmtMoney(d.budget),l:isT?'Budget \u2013 '+Y+' years':'Budget, Year '+y},{v:'\u2212 '+fmtMoney(d.committed),l:'Committed'}];
if(d.killPot)cells.push({v:'\u2212 '+fmtMoney(d.killPot),l:'Kill & phase-out'});
cells.push({v:fmtMoney(d.available),l:'Available',c:d.available<0?'#9B2D3F':'#1B6B5A'});
h+='<div class="cr-fin"><div class="cr-fin-k">Financial Summary</div><div class="cr-cells">'+cells.map(function(x){return'<div class="cr-cell"><div class="cr-num"'+(x.c?' style="color:'+x.c+'"':'')+'>'+x.v+'</div><div class="cr-lbl">'+x.l+'</div></div>'}).join('')+'</div>';
if(L.beyond)h+='<p class="cr-note">Committed funds falling beyond the planning window: '+fmtMoney(L.beyond)+' across '+L.beyondN+' project'+(L.beyondN>1?'s':'')+' \u2013 these months lie outside the '+Y+'-year period and are not counted above.</p>';
h+='<p class="cr-note2" style="margin-top:'+(L.beyond?4:12)+'px">Committed is the full cost of every live plan \u2013 all development, rollout, and sustainment months landing in '+(isT?'the '+Y+'-year window':'Year '+y)+'. This figure provides planning estimates. It does not track live spend.</p>';
var kr=killPotRows().filter(function(r){return isT||killPotYearOf(r)===y});var xs=[];
if(kr.length||(isT&&cap.killNotes))xs.push('<div><div class="cr-fin-xk">Kill & phase-out pot'+(isT?' \u2013 '+fmtMoney(killPotTotal()):'')+'</div>'+kr.map(function(r){return'<p>'+esc(r.d||'')+(r.a?' \u2013 '+esc(r.a):'')+(isT?' <span style="color:#64707E">(Year '+killPotYearOf(r)+')</span>':'')+'</p>'}).join('')+(isT&&cap.killNotes?'<p>'+esc(cap.killNotes)+'</p>':'')+'</div>');
if(isT&&cap.reallocation)xs.push('<div><div class="cr-fin-xk">Reallocation sources</div><p>'+esc(cap.reallocation)+'</p></div>');
if(isT&&cap.gapPlan)xs.push('<div><div class="cr-fin-xk">Funding gap & plan</div><p>'+esc(cap.gapPlan)+'</p></div>');
if(xs.length)h+='<div class="cr-fin-x">'+xs.join('')+'</div>';
h+='</div>';
/* KPI tiles */
var K=capKpiData(isT?'T':y);
if(K){var tile=function(inner,label,sub){return'<div class="cr-kpi">'+inner+'<div style="min-width:0"><div class="cr-kpi-l">'+label+'</div><div class="cr-kpi-s">'+sub+'</div></div></div>'};
h+='<div class="cr-kpis">'+tile(capReportArc(K.t1.f,K.t1.c),K.t1.label,K.t1.sub)+tile('<div class="cr-kpi-n" style="color:'+(K.t2.neg?'#C25B73':'#1B6B5A')+'">'+K.t2.v+'</div>',K.t2.label,K.t2.sub)+tile(capReportArc(K.t3.f,K.t3.c),K.t3.label,K.t3.sub)+'</div>'}
/* the year's calendar, then its waterfall \u2013 the last thing on the section's first page */
if(orgMonthly()){h+='<div class="cr-card"><h3>The Committed Calendar</h3>'+capReportLanes(a,b)+'</div>';h+='<div class="cr-card"><h3>Capacity Waterfall</h3>'+capReportWaterfall(a,b,mx)+'</div>'}
/* the committed lists, on a new page */
h+='<div class="cr-lists">';
var devRows=stages.experiment.filter(function(i){return(trk[i]||{}).status!=='killed'});
var landing=isT?'Within the planning window':'Landing in Year '+y;
h+='<div class="cr-list"><h3 style="color:#8B5E3C">Committed \u2013 Development ('+devRows.length+')</h3>';
if(devRows.length)devRows.forEach(function(i){var yr=capReportItemYear({i:i,op:false},a,b);
h+='<div class="cr-item"><div class="cr-item-h"><h4>'+esc((ideas[i]||{}).name||('Item '+i))+'</h4><span class="cr-item-m">Development '+fmtMoney(devCost(i))+' \u00b7 est. rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 est. sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>';
h+='<div class="cr-item-y">'+landing+': <strong>'+fmtMoney(yr.total)+'</strong> \u2013 development '+fmtMoney(yr.dev)+' \u00b7 rollout '+fmtMoney(yr.roll)+' \u00b7 sustainment '+fmtMoney(yr.sus)+'</div>';
if(isT){var rows=progOrdered(i);if(rows.length)h+='<table class="cr-t"><thead><tr><th>Program phase</th><th>Owner</th><th class="r">Months</th><th class="r">Cost</th><th class="r">Gate decision</th></tr></thead><tbody>'+rows.map(function(r){var sp=bpStepSpan(r);return'<tr><td>'+esc(r.name||'\u2014')+'</td><td>'+esc(r.powner||'\u2014')+'</td><td class="r">'+(sp?'m'+sp[0]+'\u2013'+sp[1]:'\u2014')+'</td><td class="r"><strong>'+fmtMoney(bpStepMoney(r))+'</strong></td><td class="r">'+esc(r.gateDec||'\u2014')+'</td></tr>'}).join('')+'</tbody></table>';else h+='<p class="cr-empty" style="margin-top:4px">No development phases recorded.</p>'}
h+='</div>'});
else h+='<p class="cr-empty">Nothing in Development at this snapshot.</p>';
var held=orgCommittedSet().filter(function(e){return e.sunk});
if(held.length){h+='<div class="cr-item"><div class="cr-item-h"><h4 style="font-weight:600">Development costs held from killed items</h4></div>'+held.map(function(e){var yr=capReportItemYear(e,a,b);return'<div class="cr-row"><span class="n">'+esc((ideas[e.i]||{}).name||('Item '+e.i))+'</span><span class="m">entered phases held</span><span class="a">'+fmtMoney(yr.total)+'</span></div>'}).join('')+'</div>'}
h+='</div>';
var ops=(stages.operational||[]).filter(function(i){return(trk[i]||{}).status!=='killed'});var _cr=capCommitments().rows;
h+='<div class="cr-list"><h3 style="color:#9B2D3F">Committed \u2013 Operational ('+ops.length+')</h3>';
if(ops.length)ops.forEach(function(i){var r=null;for(var k=0;k<_cr.length;k++)if(_cr[k].i===i&&_cr[k].stage==='Operational'){r=_cr[k];break}var yr=capReportItemYear({i:i,op:true},a,b);
h+='<div class="cr-row"><span class="n">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="m">'+(isT?(r?r.label:'Full plan'):(yr.dev?'development '+fmtMoney(yr.dev)+' \u00b7 ':'')+'rollout '+fmtMoney(yr.roll)+' \u00b7 sustainment '+fmtMoney(yr.sus))+'</span><span class="a">'+fmtMoney(isT?(r?r.amt:0):yr.total)+'</span></div>'});
else h+='<p class="cr-empty">Nothing operational at this snapshot.</p>';
h+='</div>';
if(isT){var opts=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
h+='<div class="cr-list"><h3 style="color:#2D5A8E">Exploration (potential future projects, no financial commitments yet) ('+opts.length+')</h3>';
if(opts.length)opts.forEach(function(i){h+='<div class="cr-row"><span class="n">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span>'+(progContracted(i)?'<span class="cr-badge" style="background:#1B6B5A">Program contracted</span>':'')+'<span class="cr-badge" style="background:#2D5A8E">'+getScore(i)+'/50</span></span><span class="m">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'});
else h+='<p class="cr-empty">No Go projects waiting in Exploration.</p>';
h+='</div>'}
h+='</div></div>';
return h}
/* the whole body: every budget year, then the total */
function capReportBody(){var cap=data.capital||{};
if(!cap.aiBudget)return'<p class="cr-empty">Set your Year 1 budget at Step 3.2.</p>';
var Y=envYearsOf(),L=capLens();var srs=orgMonthly();var mx=0;if(srs)srs.forEach(function(r){mx=Math.max(mx,r.dev+r.roll+r.sus,capSusCapLine(r.m))});
var h='';for(var y=1;y<=Y;y++)h+=capReportSection(y,L,mx,y-1,Y+1);h+=capReportSection('T',L,mx,Y,Y+1);return h}


function printGovFW(){printDocument('Governance Framework',govFrameworkDoc(),'')} /* 16 Sep 2026: the composed document, not the page */

function printOrgRev() { printPage('Organizational Design Review', renderOutOrgRev) }

function printBluesky() { printPortfolio('Blue Sky Portfolio', renderOutBluesky) }

function printExplore() { printPortfolio('Exploration Portfolio', renderOutExploreEnhanced) }

function printDevPort() { printPortfolio('Development Portfolio', renderOutExpbriefsFull) }

function printOper() { printPortfolio('Operational Portfolio', renderOutOperFull) }

// === ENHANCED OUTCOME PAGES (replacing skeletons) ===

/* RACI columns are keyed by stable person identity, never by position: 'owner' and 'finance'
   are fixed keys; leads and seniors carry generated ids. Cell keys are '<activity>:<personKey>',
   so letters follow the person when the lists change. ensureRaciModel() backfills missing ids
   and migrates legacy '<activity>-<columnIndex>' cells onto whoever holds that column now. */
/* The matrix holds nine people: the Pipeline Owner plus RACI_MAX_PEOPLE named
   between the two lists, in whatever split the organisation needs - six departments
   and two executives is as valid as the reverse. Step 2.1 stops offering "+ Add" at
   the ceiling, so the slice here is only a backstop for workspaces saved before the
   limit was enforced; without it their extra rows would silently widen the table. */
var RACI_MAX_PEOPLE = 8;
function raciPeopleCount() { var ow = data.ownership || {}; return (ow.leads || []).length + (ow.seniors || []).length }
function raciAtCap() { return raciPeopleCount() >= RACI_MAX_PEOPLE }
function raciCols() {
  var ow = data.ownership || {}; var cols = [{ k: 'owner', l: ow.ownerName || 'Pipeline Owner' }];
  var people = (ow.leads || []).filter(function (l) { return l && (l.name || l.dept) }).map(function (l) { return { k: l.id, l: l.name || l.dept } })
    .concat((ow.seniors || []).filter(function (sl) { return sl && (sl.name || sl.role) }).map(function (sl) { return { k: sl.id, l: sl.name || sl.role } }));
  people.slice(0, RACI_MAX_PEOPLE).forEach(function (c) { cols.push(c) });
  cols.push({ k: 'finance', l: 'Finance' }); return cols
}
function raciRoles() { return raciCols().map(function (c) { return c.l }) }
function ensureRaciModel() {
  try {
    var ow = data.ownership || {}, ch = false;
    ['leads', 'seniors'].forEach(function (k) { (ow[k] || []).forEach(function (pp) { if (pp && !pp.id) { pp.id = uid(); ch = true } }) });
    var r = data.raci || {}, legacy = Object.keys(r).filter(function (k) { return /^\d+-\d+$/.test(k) });
    if (legacy.length) { var cols = raciCols(); legacy.forEach(function (k) { var m = k.match(/^(\d+)-(\d+)$/), ri = parseInt(m[2], 10), col = cols[ri]; if (col && col.k && r[m[1] + ':' + col.k] === undefined) r[m[1] + ':' + col.k] = r[k]; delete r[k] }); ch = true }
    if (ch) { Store.commit('ownership'); Store.commit('raci') }
  } catch (e) { }
}
function purgeRaciFor(pid) { var r = data.raci || {}; var ch = false; Object.keys(r).forEach(function (k) { var ci = k.indexOf(':'); if (ci >= 0 && k.slice(ci + 1) === String(pid)) { delete r[k]; ch = true } }); if (ch) Store.commit('raci') }
/* addendum 188 (17 Aug 2026, Paul's ruling): the Architecture module's RACI graphics, ported onto the governance data model, and from there onto the Innovation Pipeline's 17 Sep 2026 (Paul's ruling: the matrix looks as Governance's does wherever it appears) \u2014 colored letter chips, click-to-cycle cells, and the legend row. The activity inputs, the accountable-count warning, and the team rows above the matrix are unchanged. saveGovRaci stays in place pending a dead-code ruling. */
function _raciChip(v,colors){return '<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:'+colors[v]+';color:#fff;font-size:13px;font-weight:700">'+v+'</span>'}
function _raciLegend(colors){var h='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--text-faint)">';
[['R','Responsible \u2014 does the work'],['A','Accountable \u2014 owns the decision, exactly one per activity'],['C','Consulted \u2014 input before'],['I','Informed \u2014 told after']].forEach(function(l){h+='<span><span style="display:inline-block;width:16px;height:16px;line-height:16px;border-radius:8px;background:'+colors[l[0]]+';color:#fff;font-size:10px;font-weight:700;text-align:center;margin-right:4px">'+l[0]+'</span>'+l[1]+'</span>'});
return h+'</div>'}
var RACI_COLORS={R:'#1B6B5A',A:'#2D5A8E',C:'#8B5E3C',I:'#6B7F8D'}; /* letters ride solid chips; Informed takes the slate-grey (Governance addendum 188) */
function raciCycle(key){if(Collab.lockedByOther('raci::'+key))return;ensureRaciModel();if(!data.raci)data.raci={};var order=['','R','A','C','I'];var cur=data.raci[key]||'';data.raci[key]=order[(order.indexOf(cur)+1)%order.length];Store.commit('raci',key);render()} /* the cell itself is the control, cycling R → A → C → I → blank */
function raciMatrix(ro){ensureRaciModel();
var raci=data.raci||{};var cols=raciCols();var colors=RACI_COLORS;
var acts=['Approve experiments','Advance projects','Allocate budget','Kill projects','Pipeline reporting','Weekly session','Quarterly review'];
var h=(ro?'':'<p style="font-size:12px;color:var(--text-faint);margin:0 0 6px">Click on a blank space on the matrix to assign roles.</p>')+'<div class="u-df74e8d"><table class="u-d1d587b"><thead><tr><th class="u-cd4ed5d">Activity</th>';
cols.forEach(function(c){h+='<th class="u-136497d">'+esc(c.l)+'</th>'});
h+='</tr></thead><tbody>';
acts.forEach(function(a,ai){var aCount=cols.filter(function(c){return raci[ai+':'+c.k]==='A'}).length;
h+='<tr style="background:'+(ai%2===0?'rgba(var(--fg-rgb),.04)':'rgba(var(--fg-rgb),.01)')+'"><td class="u-4a76a82">'+a+(ro||aCount===1?'':'<div style="font-size:11px;color:#C8860A;font-weight:600;margin-top:2px;min-height:15px">exactly one accountable name'+(aCount>1?' \u2014 '+aCount+' marked A':'')+'</div>')+'</td>';
cols.forEach(function(c){var key=ai+':'+c.k;var v=raci[key]||'';
if(ro){h+='<td class="u-47b192e">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.3);font-size:13px">\u2014</span>')+'</td>'}
else{h+='<td class="u-47b192e" id="raci_'+key+'" onclick="raciCycle(\''+key+'\')" title="Click to cycle R \u2192 A \u2192 C \u2192 I \u2192 blank" style="cursor:pointer">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.35);font-size:13px">\u2014</span>')+'</td>'}});
h+='</tr>'});
h+='</tbody></table></div>'+_raciLegend(colors);
return h} /* 17 Sep 2026 (Paul's ruling): Governance's matrix — coloured letter chips, click-to-cycle cells in place of the selects, the accountable-count note, the legend — on the 2.1 step and the output page alike */
/* Names are saved by onchange/oninput handlers that commit without a re-render, so
   the matrix would sit one render behind the lists above it: type a name and its
   column only appeared the next time something else redrew the step. Redraw just
   the matrix box instead of calling render() - a full render on blur would steal
   the focus that is on its way to the next input. The signature guard keeps the
   redundant blur redraw from rebuilding the selects under a click in progress. */
var _raciSig = null;
function refreshRaci() {
  var el = document.getElementById('raciBox'); if (!el) return;
  var sig = raciCols().map(function (c) { return c.k + '|' + c.l }).join('\u0001');
  if (sig === _raciSig) return;
  _raciSig = sig; el.innerHTML = raciMatrix(false)
}
function renderOutRaciFull(){
return'<div class="flx-between-top-mb"><div class="pdf-hd">'+badge('Phase 2 Output','#2D5A8E')+'<h2 class="h-big">RACI Matrix</h2><p class="t-stone-sm">R=Responsible A=Accountable C=Consulted I=Informed \u2013 filled out at Step 2.1 (Ownership &amp; Structure); this page is the printable record.</p></div>'+'<div style="display:flex;gap:8px">'+btn(UI.expanded.raciEdit?'\u2713 Done':'\u270E Edit','UI.expanded.raciEdit=!UI.expanded.raciEdit;render()','bs','font-size:13px')+pdfBtn('printRaci()')+'</div>'+'</div>'+raciMatrix(!UI.expanded.raciEdit)}
function printRaci(){printDocument('RACI Matrix',raciDoc(),'')} /* 16 Sep 2026: the matrix on its landscape page */
function saveRaci(key) { if (Collab.lockedByOther('raci::' + key)) return; if (!data.raci) data.raci = {}; data.raci[key] = val('raci_' + key); Store.commit('raci', key); var el = document.getElementById('raci_' + key); if (el) { var colors = { R: '#1B6B5A', A: '#2D5A8E', C: '#8B5E3C', I: 'rgba(var(--faint-rgb),.5)' }; el.style.setProperty('color', colors[data.raci[key]] || 'rgba(var(--faint-rgb),.4)', 'important') } }

function pcTabSet(i, n) { if (!UI.pcTab) UI.pcTab = {}; UI.pcTab[i] = n; render() }
function pcEditToggle(i) { if (!UI.pcEdit) UI.pcEdit = {}; UI.pcEdit[i] = !UI.pcEdit[i]; render() }
function projCardRO(i) {
  var p = (data.projects || {})[i] || {};
  var shell = function (inner) { return '<div style="margin-top:12px;padding:14px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:10px;background:rgba(var(--fg-rgb),.02)">' + inner + '</div>' };
  if (UI.pcEdit && UI.pcEdit[i]) {
    return shell('<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px"><span style="font-size:12px;font-weight:700;color:var(--paper);letter-spacing:.03em">PROJECT CARD \u2013 EDITING</span>' + btn('Done editing', 'pcEditToggle(' + i + ')', 'bg2', 'font-size:11px;padding:3px 10px') + '</div>' + assessBlock(i))
  }
  var tab = (UI.pcTab || {})[i] || 0;
  var tb = function (n, lbl) { return '<button class="btn-ghost pad-chip-sm" style="font-size:12px;padding:4px 12px;' + (tab === n ? 'background:rgba(var(--fg-rgb),.10);color:var(--paper)' : '') + '" onclick="pcTabSet(' + i + ',' + n + ')">' + lbl + '</button>' };
  var f = function (l, v) { return v ? '<div><div class="u-b25d981" style="margin-bottom:3px">' + l + '</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55">' + esc(v) + '</div></div>' : '' };
  var body = '';
  if (tab === 0) {
    var inner = f('Objectives', p.objectives) + f('Deliverables', p.deliverables) + f('Timeline', p.timeline) + f('Resources', p.resources) + f('Key risks', p.risks) + f('Success metrics', p.metrics) + f('Internal partners', p.partInt) + f('External partners', p.partExt);
    body = bpStatBand(i) + (inner ? '<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:14px 0 16px"></div><div class="gr-2" style="row-gap:16px">' + inner + '</div>' : '<p class="t-faint-sm" style="margin:4px 0">No project details yet \u2014 click Edit, or complete the deepened assessment at 2.4.</p>')
  }
  else if (tab === 1) {
    var _gi3 = gapItemsOf(i), sw = p.swot || {};
    var gAny = ['skills', 'resources', 'technology'].some(function (c3) { return (_gi3[c3] || []).length });
    var sAny = ['strengths', 'weaknesses', 'opportunities', 'threats'].some(function (k4) { return sw[k4] });
    if (!gAny && !sAny) body = '<p class="t-faint-sm" style="margin:4px 0">No analyses recorded yet \u2014 the gap analysis and SWOT live in the editable card.</p>';
    else {
      if (gAny) {
        var grow = function (lbl, c4) {
          var its = _gi3[c4] || []; if (!its.length) return ''; var hv = its.filter(function (x) { return x.have }), gp = its.filter(function (x) { return !x.have });
          var li = function (arr, col) { return arr.length ? arr.map(function (x) { return '<div class="fs-13" style="margin-bottom:3px' + (col ? ';color:' + col : '') + '">' + esc(x.name) + '</div>' }).join('') : '<div class="t-faint-sm">\u2014</div>' };
          return '<div style="margin-bottom:14px"><div style="font-size:14px;font-weight:700;color:var(--paper);margin-bottom:6px">' + lbl + '</div><div class="gr-3-sm"><div><div class="t-faint-sm" style="margin-bottom:4px">NEED</div>' + li(its) + '</div><div><div class="t-faint-sm" style="margin-bottom:4px">HAVE</div>' + li(hv) + '</div><div><div class="t-faint-sm" style="margin-bottom:4px">GAP</div>' + li(gp, '#D4A017') + '</div></div></div>'
        };
        var _blocks = [grow('Skills', 'skills'), grow('Resources', 'resources'), grow('Technology', 'technology')].filter(function (x) { return x });
        body += '<h4 class="h-mini">Gap Analysis</h4>' + _blocks.join('<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 14px"></div>')
      }
      if (sAny) {
        var _q4 = [{ k: 'strengths', l: '+ STRENGTHS', c: 'var(--ph1-t)', bg: 'rgba(27,107,90,.10)' }, { k: 'weaknesses', l: '\u2212 WEAKNESSES', c: '#C25B73', bg: 'rgba(155,45,63,.08)' }, { k: 'opportunities', l: '\u25c9 OPPORTUNITIES', c: 'var(--ph2-t)', bg: 'rgba(45,90,142,.10)' }, { k: 'threats', l: '\u25b3 THREATS', c: '#D4A017', bg: 'rgba(139,94,60,.10)' }];
        body += (gAny ? '<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:16px 0 14px"></div>' : '') + '<h4 class="h-mini">SWOT</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:10px;overflow:hidden">' + _q4.map(function (q) { return '<div style="background:' + q.bg + ';padding:12px;min-height:76px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:' + q.c + ';margin-bottom:5px">' + q.l + '</div><div class="u-2ad7718">' + esc(sw[q.k] || '\u2014') + '</div></div>' }).join('') + '</div>'
      }
    }
  }
  else { body = bpBudgetTab(i, true) }
  return shell('<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px">' + tb(0, 'Overview') + tb(1, 'Analyses') + tb(2, 'Budget') + '<span style="flex:1"></span>' + btn('Edit', 'pcEditToggle(' + i + ')', 'bg2', 'font-size:11px;padding:3px 10px') + '</div>' + body)
}
function devCardRO(i){var tr=((data.tracking||{})[i])||{};var f=function(l,v){return v?'<div><div class="u-b25d981">'+l+'</div><div class="u-2ad7718">'+esc(v)+'</div></div>':''};
var g=f('Results to date',tr.results)+f('Infrastructure learnings',tr.infraLearnings||tr.learnings) /* 16 Sep 2026 (seed check): the step and the seed write infraLearnings; the card read a key nothing wrote */+f('What\u2019s breaking / working',tr.breakWork);
return progSnapRO(i)+(g?'<div class="gr-2" style="margin-top:10px">'+g+'</div>':'')}
function expCardRO(i) {
  var e = (data.experiments || {})[i] || {}; var f = function (l, v) { return v ? '<div><div class="u-b25d981">' + l + '</div><div class="u-2ad7718">' + esc(v) + '</div></div>' : '' };
  var inner = f('Owner', e.owner) + f('Development Costs', e.budget) + f('Timeline', e.timeline) + f('Success metric', e.successMetric) + f('What was tested', e.testing) + f('Evaluation milestone', e.milestone);
  if (!inner) return '<p class="t-faint-sm">No experiment card recorded for this project.</p>';
  return '<div class="gr-2">' + inner + '</div>'
}
/* Program dashboard (P3, July 5). The Development portfolio card renders the
   project's development program - the plan's dev rows ordered by end month.
   Gates are decision records (Go / Kill / Hold / Recycle) taken as phases end;
   Kill routes through the inline confirm panel (released/held figures + a pot
   line, capLaunchPanel precedent). The terminal gate's Go is the launch
   decision. Seam advisories use the formal register (Paul ruling, July 5). */
function pdDoneRow(r) { return r.gateDec === 'go' || r.pstatus === 'complete' }
function phLight(r, sz) {
  var d = sz || 10; var c, t; if (r.gateDec === 'kill') { c = '#C25B73'; t = 'Killed at gate' } else if (pdDoneRow(r)) { c = '#34B04A'; t = 'Complete' } else if (r.gateDec === 'hold') { c = '#8B5E3C'; t = 'On hold' } else if (pdRunRow(r)) { c = '#D4A017'; t = 'Running' } else { c = ''; t = 'Unstarted' }
  return c ? '<span title="' + t + '" style="width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:' + c + ';display:inline-block;flex:0 0 auto"></span>' : '<span title="Unstarted" style="width:' + d + 'px;height:' + d + 'px;border-radius:50%;border:1.5px solid var(--text-faint);display:inline-block;box-sizing:border-box;flex:0 0 auto"></span>'
}
function pdRunRow(r) { return r.pstatus === 'running' && !r.gateDec }
function progSpentDone(i) { var t = 0; progOrdered(i).forEach(function (r) { if (pdDoneRow(r)) t += bpStepMoney(r) }); return t }
function progOrdered(i) { return bpRows(i, 'dev').filter(function (r) { return !!r }).slice().sort(function (x, y) { var sx = bpStepSpan(x), sy = bpStepSpan(y); return (sx ? sx[1] : 1e9) - (sy ? sy[1] : 1e9) }) }
function phGlyph(r) { if (r.gateDec === 'kill') return ['\u25cb', '#9B2D3F']; if (r.gateDec) return ['\u25c9', '#1B6B5A']; if (r.pstatus === 'complete') return ['\u25cf', '#1B6B5A']; if (r.pstatus === 'running') return ['\u25cf', '#D4A017']; return ['\u25cb', 'rgba(var(--faint-rgb),.6)'] }
function progStrip(i) {
  var rows = progOrdered(i); if (!rows.length) return ''; var done = rows.filter(function (r) { return r.gateDec || r.pstatus === 'complete' }).length;
  return '<span style="display:inline-flex;align-items:center;gap:3px;margin-left:8px" onclick="event.stopPropagation()">' + rows.map(function (r) { var g = phGlyph(r); return '<span title="' + esc(r.name || 'phase') + '" style="color:' + g[1] + ';font-size:22px;line-height:1">' + g[0] + '</span>' }).join('') + '<span class="t-faint-sm" style="margin-left:4px">' + done + '/' + rows.length + ' phases</span></span>'
}
function phStatusSel(i, r) { return '<select onclick="event.stopPropagation()" onchange="bpRowSave(' + i + ',\'dev\',\'' + r.id + '\',\'pstatus\',this.value)" style="font-size:12.5px;padding:4px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px">' + [['', 'Unstarted'], ['running', '\u25cf Running'], ['complete', '\u2713 Complete']].map(function (o) { return '<option value="' + o[0] + '"' + (String(r.pstatus || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>' }).join('') + '</select>' }
function devStatusSave(i, el) { var v = el.value; if (v === 'killed') { UI.expanded['kp' + i] = true; render(); return } fldSave('trk_' + i + '_status', v) }
function pausedNote(tr) { return (tr && tr.status === 'paused') ? '<p class="fs-13" style="margin:6px 0 0;color:var(--warn-text)">Paused \u2013 the financial commitment to this project remains in place. If the pause adds real costs (license months, restart work), add them to the paused phase\u2019s cost or add a phase covering the pause months. The committed sum will recalculate to take account of the addition.</p>' : '' }
function devStatusSel(i, tr) {
  var opts = [['', 'Set status...'], ['running', '\u25cf Running'], ['paused', '\u25cf Paused'], ['complete', '\u2713 Complete'], ['killed', '\u25cb Killed']];
  return '<div class="mb-4"><label class="form-label">Status</label><select id="trk_' + i + '_status" class="sel-helper" onchange="devStatusSave(' + i + ',this)">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(tr.status || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>' }).join('') + '</select></div>'
}
function progGate(i, id, dec) {
  if (Collab.lockedByOther('budgetPlans::' + i)) return; var r = bpRows(i, 'dev').filter(function (x) { return x && x.id === id })[0]; if (!r) return;
  if (dec === 'kill') { UI.expanded['gp_' + i + '_' + id] = false; UI.expanded['kp' + i] = id; render(); return }
  if (dec === 'go') { var _rows0 = progOrdered(i), _last0 = _rows0.length ? _rows0[_rows0.length - 1] : null; if (!(_last0 && _last0.id === id) && !confirm('Record Go for this gate?')) return } /* terminal Go goes uninterrupted to the launch panel's CONFIRM-OR-REVISE - no double confirm (ruled July 9) */
  r.gateDec = dec; r.gateAt = Date.now(); if (dec === 'go') r.pstatus = 'complete'; if (dec === 'recycle') r.pstatus = 'running'; UI.expanded['gp_' + i + '_' + id] = false; if (dec === 'go') UI.expanded['phx_' + i + '_' + id] = false; if (dec === 'recycle') { UI.expanded['phx_' + i + '_' + id] = true; UI.expanded['pde_' + i + '_' + id] = true } Store.commit('budgetPlans', i);
  var rowsT = progOrdered(i), last = rowsT.length ? rowsT[rowsT.length - 1] : null;
  if (dec === 'go' && last && last.id === id) { if (!data.tracking) data.tracking = {}; if (!data.tracking[i]) data.tracking[i] = {}; if (data.tracking[i].status !== 'complete') { data.tracking[i].status = 'complete'; Store.commit('tracking', i); data.capStale = true; Store.commit('capStale') } saveData(); doLaunch(i); return }
  saveData(); render()
}
function progGateUI(i, r, terminal) {
  if (r.gateDec) return '<span class="t-faint-sm">Gate: ' + esc(r.gateDec) + (r.gateAt ? ' \u00b7 ' + fmtDate(r.gateAt) : '') + (r.pgnote ? ' \u00b7 ' + esc(String(r.pgnote).slice(0, 80)) : '') + '</span> <button class="btn-ghost pad-chip-sm" onclick="event.stopPropagation();progGateClear(' + i + ',\'' + r.id + '\')" style="font-size:10px">retake</button>';
  var _beg = (r.pstatus === 'running' || r.pstatus === 'complete'); /* flow rule (ruled July 9): an unstarted phase has produced no new evidence, so its gate offers no Kill - portfolio-level kills stay on the review's Sell and the status select */
  var bb = function (lbl, dec, col) { return '<button onclick="event.stopPropagation();progGate(' + i + ',\'' + r.id + '\',\'' + dec + '\')" style="flex:1;min-width:70px;padding:8px 6px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid ' + col + '55;background:' + col + '18;color:' + col + '">' + lbl + '</button>' };
  return '<div onclick="event.stopPropagation()" style="border:1px solid rgba(var(--fg-rgb),.15);border-radius:8px;padding:10px;margin-top:6px;width:100%"><div style="font-weight:700;color:var(--paper);font-size:13px;letter-spacing:.04em;margin-bottom:8px">EXIT GATE DECISION' + (terminal ? ' <span class="t-faint-sm" style="font-weight:400">(terminal \u2013 Go is the launch decision)</span>' : '') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + bb(terminal ? 'Go \u2013 Launch' : 'Go', 'go', '#1B6B5A') + bb('Recycle', 'recycle', '#2D5A8E') + (_beg ? bb('Kill', 'kill', '#9B2D3F') : '') + '</div>'
    + '<p class="t-faint-sm" style="margin:6px 0 8px">Go confirms that the project has passed this gate and marks the phase complete. The project is now free to begin subsequent phases. Recycle records a fail-and-repeat decision: the phase returns to Running so you can extend its dates and budget.' + (_beg ? ' Kill opens the kill panel.' : '') + ' If the evidence is not in yet, take no decision \u2013 the gate simply stays open. To park a passing program for capital or priority reasons, pause it from the Development portfolio.</p>'
    + pgTa(i, r, 'pgnote', 'Gate note', 'Evidence against the exit criteria; conditions for the next phase') + '</div>'
}
function progGateClear(i, id) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var r = bpRows(i, 'dev').filter(function (x) { return x && x.id === id })[0]; if (!r) return; delete r.gateDec; delete r.gateAt; Store.commit('budgetPlans', i); saveData(); render() }
function progDash(i, killed) {
  var rows = progOrdered(i);
  var h = '<h4 style="font-size:15px;font-weight:700;color:var(--paper);margin:22px 0 10px">Development Phases</h4>';
  if (killed) h += '<p class="t-faint-sm" style="margin:0 0 10px">Funds remain committed for phases that have already begun (' + fmtMoney(killSunkDev(i)) + '). The remainder is released. Any wind-down costs should be recorded in the kill & phase-out pot (Step 3.3 or the Capital Planning Hub).</p>';
  if (!rows.length) return h + '<p class="t-faint-sm" style="margin:0 0 10px">No phases defined \u2013 build the program at Step 3.4 (Map Development Track).</p>';
  var pmn = planMonthNow(i), last = rows[rows.length - 1];
  var H41 = parseInt((bpGet(i) || {}).horizon, 10) || 3;
  var meta = function (l, v) { return '<div><div class="t-faint-sm" style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">' + l + '</div><div style="font-size:13.5px;color:var(--paper)">' + esc(v || '\u2014') + '</div></div>' };
  var crit = function (l, v, col) { return '<div style="flex:1;min-width:200px;border-left:2px solid ' + col + ';padding-left:10px"><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:' + col + ';margin-bottom:3px">' + l + '</div><div style="font-size:13px;color:var(--text-bright);line-height:1.5;white-space:pre-wrap">' + esc(v || '\u2014') + '</div></div>' };
  rows.forEach(function (r, x) {
    var sp = bpStepSpan(r);
    var pk = 'phx_' + i + '_' + r.id; var pOpen = !!UI.expanded[pk];
    var ek = 'pde_' + i + '_' + r.id; var editing = !killed && pOpen && !!UI.expanded[ek];
    var rec = (!killed && r.gateDec === 'recycle') ? '<p class="t-faint-sm" style="color:var(--warn-text);margin:8px 0 0">Recycled' + (r.gateAt ? ' ' + fmtDate(r.gateAt) : '') + ' \u2013 extend the time frame and revisit the phase budget before it runs again. New funds should be added to the existing phase budget for the additional work \u2013 the existing budget does not recycle automatically.</p>' : '';
    var late = ''; if (!killed && pmn != null && sp && sp[1] < pmn && !r.gateDec) late = '<p class="t-faint-sm" style="color:var(--warn-text);margin:8px 0 0">\u201c' + esc(r.name || '') + '\u201d ended in Month ' + sp[1] + ', but its exit gate decision has not yet been made \u2013 the step cannot close until it is.</p>';
    var seam = ''; if (!killed && x > 0 && pmn != null && sp && sp[0] <= pmn && !rows[x - 1].gateDec) seam = '<p class="t-faint-sm" style="color:var(--warn-text);margin:8px 0 0">\u201c' + esc(r.name || '') + '\u201d is scheduled to start in Month ' + sp[0] + ', but the exit gate decision at the end of \u201c' + esc(rows[x - 1].name || '') + '\u201d has not yet been made. Check that this overlap is intentional.</p>';
    h += '<div style="border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px;margin-bottom:12px;overflow:hidden">'
      + '<div onclick="UI.expanded[\'' + pk + '\']=!' + pOpen + ';render()" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;background:rgba(var(--fg-rgb),' + (pOpen ? '.05' : '.02') + ')">'
      + '<span style="color:var(--text-faint);font-size:13px">' + (pOpen ? '\u25be' : '\u25b8') + '</span>'
      + '<span style="color:var(--text-faint);font-weight:700;font-size:14px">' + (x + 1) + '.</span>'
      + '<strong style="font-size:14.5px;color:var(--paper)">' + esc(r.name || '(unnamed phase)') + '</strong>'
      + phLight(r, 11)
      + '<span style="margin-left:auto;display:inline-flex;gap:10px;align-items:center">' + (killed ? '' : phStatusSel(i, r)) + '</span>'
      + '</div>';
    if (pOpen) {
      h += '<div style="padding:2px 14px 12px 14px">';
      if (String(r.desc || '').trim()) h += '<p style="font-size:12.5px;color:var(--text-muted);font-style:italic;margin:8px 0 2px">' + esc(r.desc) + '</p>';
      if (editing) {
        h += '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn-ghost pad-chip-sm" style="font-size:10.5px" onclick="UI.expanded[\'' + ek + '\']=false;render()">Done editing</button></div>'
          + '<div class="flx-g3" style="align-items:center;margin:4px 0 2px"><span class="form-label" style="flex:2;margin:0">Phase name</span><span class="form-label" style="flex:0 0 136px;margin:0">Months</span><span class="form-label" style="flex:0 0 140px;margin:0">Phase budget</span></div>'
          + bpStepRow(i, 'dev', r, H41, true, true)
          + '<div style="max-width:260px;margin-top:8px">' + pgTa(i, r, 'powner', 'Owner *', 'e.g. Robin Vance') + '</div>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' + pgTa(i, r, 'pmetric', 'Success metrics *', 'e.g. Quote turnaround < 4 hours', 2) + pgTa(i, r, 'pexit', 'Exit gate criteria *', 'e.g. \u2265 90% routing accuracy over four weeks', 2) + '</div>';
      } else {
        h += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:10px"><div style="display:flex;gap:28px;flex-wrap:wrap">' + meta('Time frame', sp ? 'Months ' + sp[0] + '\u2013' + sp[1] : 'No dates') + meta('Owner', r.powner) + meta('Phase budget', fmtMoney(bpStepMoney(r))) + '</div>' + (killed ? '' : '<button class="btn-ghost pad-chip-sm" style="font-size:10.5px;flex:0 0 auto" onclick="event.stopPropagation();UI.expanded[\'' + ek + '\']=true;render()">Edit</button>') + '</div>'
          + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:14px">' + crit('Success metrics', r.pmetric, 'var(--ph1-t)') + crit('Exit gate criteria', r.pexit, '#D4A017') + '</div>';
      }
      h += (killed ? '' : '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + progGateUI(i, r, last && last.id === r.id) + '</div>')
        + '</div>';
    }
    if (seam || rec || late) h += '<div style="padding:0 14px 10px' + (pOpen ? '' : ';padding-top:2px') + '">' + rec + late + seam + '</div>';
    h += '</div>';
    if (UI.expanded['kp' + i] === r.id) h += '<div style="margin:-4px 0 12px">' + progKillPanel(i) + '</div>'
  });
  return h
}
function progSnapRO(i) {
  var rows = progOrdered(i); if (!rows.length) return '<p class="t-faint-sm">No development phases recorded.</p>';
  return '<div class="t-faint-sm" style="margin-bottom:4px">PROGRAM PHASES</div>' + rows.map(function (r) { var sp = bpStepSpan(r); return '<div class="row-line"><span class="fs-14" style="flex:3">' + esc(r.name || '\u2014') + (r.powner ? ' \u00b7 ' + esc(r.powner) : '') + '</span><span class="t-faint-sm" style="flex:1;text-align:right">' + (sp ? 'm' + sp[0] + '\u2013' + sp[1] : '\u2014') + '</span><span style="flex:1;text-align:right"><strong>' + fmtMoney(bpStepMoney(r)) + '</strong></span><span class="t-faint-sm" style="flex:1;text-align:right">' + esc(r.gateDec || '\u2014') + '</span></div>' }).join('')
}
function progKillPanel(i) {
  if (!UI.expanded['kp' + i]) return ''; var prev = killReleasePreview(i), nm = esc(((data.ideas || [])[i] || {}).name || ('Item ' + i)), lines;
  if (bpHasDev(i)) {
    var held = prev.phases.filter(function (q) { return q.entered }).map(function (q) { return esc(q.name || 'phase') }).join(', '); var rel = prev.phases.filter(function (q) { return !q.entered }).map(function (q) { return esc(q.name || 'phase') }).join(', ');
    lines = '<p class="t-faint-sm" style="margin:0 0 6px">Killing releases <strong>' + fmtMoney(prev.released) + '</strong> \u2013 ' + (rel ? 'the development phases not yet begun (' + rel + '), plus ' : '') + 'every rollout and sustainment month inside the planning window. ' + (prev.sunk ? 'Phases already begun stay committed and charted: <strong>' + fmtMoney(prev.sunk) + '</strong>' + (held ? ' (' + held + ')' : '') + '.' : 'No phase has begun, so nothing is held.') + '</p>'
  }
  else lines = '<p class="t-faint-sm" style="margin:0 0 6px">No development phases are defined \u2013 killing releases the full in-window plan, <strong>' + fmtMoney(prev.released) + '</strong>.</p>';
  return '<div style="border:1px solid rgba(155,45,63,.4);border-radius:8px;padding:12px;margin-top:10px;background:rgba(155,45,63,.05)"><div class="t-faint-sm" style="margin-bottom:6px">CONFIRM KILL \u2013 ' + nm + '</div>' + lines
    + '<p class="t-faint-sm" style="margin:0 0 6px">Does killing at this point carry costs of its own \u2013 contract exits, phase-outs, license runoff? Any amount entered is held as a line in the kill & phase-out pot (Step 3.3).</p>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="kd_' + i + '" placeholder="e.g. Contractor exit" style="flex:2;min-width:160px;font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px"><input id="ka_' + i + '" placeholder="e.g. $25K" style="flex:1;min-width:90px;font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px"></div>'
    + '<div style="display:flex;gap:8px;margin-top:8px">' + btn('Confirm kill', 'progKillConfirm(' + i + ')', 'bd', 'font-size:12px') + btn('Cancel', 'UI.expanded[\'kp' + i + '\']=false;render()', 'bg2', 'font-size:12px') + '</div></div>'
}
function progKillConfirm(i) {
  var kp = UI.expanded['kp' + i]; var d = $('kd_' + i), aE = $('ka_' + i); var dv = d ? String(d.value || '').trim() : '', av = aE ? String(aE.value || '').trim() : '';
  if (dv || costNum(av)) { if (!data.capital) data.capital = {}; if (!data.capital.killRows) data.capital.killRows = []; var nm = ((data.ideas || [])[i] || {}).name || ('Item ' + i); data.capital.killRows.push({ d: (dv || 'Wind-down') + ' \u2013 ' + nm, a: av }); Store.commit('capital') }
  UI.expanded['kp' + i] = false; fldSave('trk_' + i + '_status', 'killed');
  /* accounting rule (ruled July 9): the kill click never converts unspent money to spent - killSunkIds freezes on the PRE-decision entered set, then the gate record is written */
  if (typeof kp === 'string') { var r = bpRows(i, 'dev').filter(function (x) { return x && x.id === kp })[0]; if (r) { r.gateDec = 'kill'; r.gateAt = Date.now(); Store.commit('budgetPlans', i); render() } } if (UI.reviewSellPending === i) { delete UI.reviewSellPending; if (!data.review) data.review = {}; if (!data.review.items) data.review.items = {}; if (!data.review.items[i]) data.review.items[i] = {}; data.review.items[i].decision = 'sell'; saveData() }
}
function renderOutExpbriefsFull(){
var ideas=data.ideas||[],exp=data.experiments||{},exSel=data.expSelected||[],trk=data.tracking||{},stages=getStages();
var h='<div class="flx-between-top-mb"><div class="pdf-hd"><h2 class="h-section">Development Portfolio</h2><p class="t-lead">Programs in progress. Track phase status, take gate decisions as phases end, and launch completed projects to Operational \u2013 all from this page.</p></div>'+outputPrintRow(currentStep)+'</div>';
h+=pipeViz('experiment');
if(stages.experiment.length===0){h+=card('<div class="empty-state"><p class="t-faint">'+(exSel.length>0?'All programs have been launched to Operational.':'No projects in Development. Advance Go, graded projects from the Exploration portfolio.')+'</p></div>');return h+archivePanel(['experiment'],'oeb')}
stages.experiment.forEach(function(i,rank){var e=exp[i]||{},idea=ideas[i],tr=trk[i]||{};
var open=xOpen('oe'+i);var killed=tr.status==='killed';var pb=(data.portfolio||{})[i]||{};
var head='<div class="flx-row-mb-12-clean xh" style="cursor:pointer" onclick="event.stopPropagation();UI.expanded[\'oe'+i+'\']=!UI.expanded[\'oe'+i+'\'];render()"><div class="u-5d029f6">'+hzWarn(i,true)+'<span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><span class="u-0447ee5">#'+(rank+1)+'</span><h4 class="u-3a484c9"'+(killed?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+(tr.status?badge(tr.status,tr.status==='complete'?'#1B6B5A':tr.status==='running'?'#2D5A8E':killed?'#9B2D3F':'rgba(var(--faint-rgb),.5)'):'')+progStrip(i)+'</div>'+badge('Development','#8B5E3C')+((((data.projects||{})[i])||{}).legacy?badge('Legacy','#D4A017'):'')+'</div>';
var body='';
if(open){body=devPortBody(i)}h+=card(head+body,'margin-bottom:16px;border-left:4px solid '+(killed?'#9B2D3F':'#8B5E3C')+(open?'':';cursor:pointer'),xpandAttr('oe'+i,open))});
h+=balancePanel(stages.experiment,'experiment');
h+=archivePanel(['experiment'],'oeb');
return h}


function renderOutFinalportFull(){return renderOutPortfolioReview()} /* 17 Sep 2026 (Paul's ruling): the Portfolio Review page \u2014 the Development Portfolio\u2019s second appearance is gone */ /* the post-review portfolio IS the development portfolio's current state – one render, shared with the dashboard (Paul, July 7) */
function renderOutExploreEnhanced(){
var ideas=data.ideas||[],proj=data.projects||{},port=data.portfolio||{},as=data.assessments||{},stages=getStages();
var h='<div class="flx-between-top-mb"><div class="pdf-hd"><h2 class="h-section">Exploration Portfolio</h2><p class="t-lead">Run the deepened assessment and re-score, issue the Go / No-Go verdict, grade horizon, risk, and reward, then advance Go projects to Development \u2013 all from this page.</p></div>'+outputPrintRow('out-explore')+'</div>';
h+=pipeViz('explore');
if(!UI.oxTab)UI.oxTab=1;
h+='<div class="flx-g2-wrap mb-5">'+[{t:1,l:'Structured Portfolio'},{t:2,l:'Allocate Capital'}].map(function(tb){return'<button onclick="UI.oxTab='+tb.t+';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(UI.oxTab===tb.t?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(UI.oxTab===tb.t?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.02)')+';color:'+(UI.oxTab===tb.t?'var(--paper)':'var(--text-faint)')+'">'+tb.l+'</button>'}).join('')+'</div>';
if(UI.oxTab===2&&!PRINT_EXPAND)return h+allocCore();
if(stages.explore.length===0&&stages.noGo.length===0){h+=card('<div class="empty-state"><p class="t-faint">No projects in Exploration yet. Select ideas from the Blue Sky portfolio to begin.</p></div>');return h+archivePanel(['explore','noGo'],'oxp')}
if(stages.explore.length>0){
var _srt=stages.explore.slice().sort(function(a,b){return getScore(b)-getScore(a)});
var _grd=[],_awt=[],_inc=[];
_srt.forEach(function(i){var _pj=proj[i]||{},_pb=port[i]||{};if(_pj.viable===true&&_pb.horizon&&_pb.risk&&_pb.reward)_grd.push(i);else if(_pj.viable===true)_awt.push(i);else _inc.push(i)});
var _sec=function(t){return'<div class="flx-row-mb-12" style="margin-top:8px"><h3 class="u-ce641a4">'+t+'</h3></div>'};
var _cardFor=function(i){var idea=ideas[i],p=proj[i]||{},pb=port[i]||{},a1=as[i]||{},rs=p.rescore||{};var _kd=(((data.tracking||{})[i])||{}).status==='killed';var open=xOpen('ox'+i);
var graded=!!(pb.horizon&&pb.risk&&pb.reward);
var vBadge=p.viable===true?badge('Go','#1B6B5A'):'';
var head='<div class="flx-between xh" onclick="event.stopPropagation();UI.expanded[\'ox'+i+'\']=!UI.expanded[\'ox'+i+'\'];render()" style="cursor:pointer"><div style="display:flex;gap:8px"><span style="color:var(--stone);font-size:15px;padding-top:1px">'+(open?'\u25be':'\u25b8')+'</span><div><h4 class="h-card"'+(_kd?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+' '+(_kd?badge('Killed','#9B2D3F')+' ':'')+vBadge+(p.viable===true&&graded?' '+badge('Portfolio assessment complete','#8B5E3C'):'')+'</h4><p class="t-stone-snug">'+esc(p.objectives||(idea?idea.desc:''))+'</p></div></div><div class="w-min-50"><div class="score-num-md">'+getScore(i)+'</div><div class="t-faint-sm">/50</div></div></div>';
var body='';
if(open){body=expPortBody(i)}h+=card(head+body,'margin-bottom:10px;border-left:4px solid '+(p.viable===true?'#1B6B5A':'#2D5A8E')+(open?'':';cursor:pointer'),xpandAttr('ox'+i,open))};
h+=_sec('Structured Portfolio ('+_grd.length+')');
if(!_grd.length)h+='<p class="t-faint-sm" style="margin:0 0 14px">Nothing graded yet \u2013 the structured portfolio is the graded set.</p>';
_grd.forEach(_cardFor);
if(_awt.length){h+=_sec('Not Yet Positioned ('+_awt.length+')');_awt.forEach(_cardFor)}
if(_inc.length){h+=_sec('Incomplete ('+_inc.length+')');_inc.forEach(_cardFor)}}
h+=notAdvPanel('oxp');
h+=balancePanel(stages.explore,'explore');
h+=archivePanel(['explore','noGo'],'oxp');
if(PRINT_EXPAND)h+=allocCore(); /* the export is the whole page, both tabs */
return h}
function setViableAt(i, v) { if (lockBlocked('projects::' + i)) return; saveAssessFields(i); if (!data.projects) data.projects = {}; if (!data.projects[i]) data.projects[i] = {}; var e = $('pjr_' + i); if (e && e.value !== undefined && e.value !== '') data.projects[i].noGoReason = e.value; data.projects[i].viable = v; if (v === false) { data.capStale = true; Store.commit('capStale') } Store.commit('projects', i); render() }
function deepScoreOf(i) { var p = (data.projects || {})[i] || {}, a = (data.assessments || {})[i] || {}; if (!(p.rescore && p.rescoreDone && rsComplete(p.rescore))) return null; var r = p.rescore; return (r.priority != null ? r.priority : (a.priority || 0)) + (r.risk != null ? r.risk : (a.risk || 0)) + (r.value != null ? r.value : (a.value || 0)) + (r.costScore != null ? r.costScore : (a.costScore || 0)) + (r.difficulty != null ? r.difficulty : (a.difficulty || 0)) }
function rs3TotalHtml(i) {
  var p = (data.projects || {})[i] || {}; var deep = deepScoreOf(i), tri = triageScore(i); var deepTxt = (deep != null ? deep + '/50' : '\u2014');
  if (!(p.rescore3Done && rsComplete(p.rescore3 || {}))) return 'Post-experiment <strong>\u2014</strong> \u00b7 Deepened ' + deepTxt + ' \u00b7 First Pass ' + tri + '/50';
  var t3 = getScore(i); var base = (deep != null ? deep : tri); var d = t3 - base;
  return 'Post-experiment <strong>' + t3 + '/50</strong> \u00b7 Deepened ' + deepTxt + ' \u00b7 First Pass ' + tri + '/50 (' + (d >= 0 ? '+' : '') + d + ' vs ' + (deep != null ? 'deepened' : 'first pass') + ')'
}
function refreshPr3Total(i) { var p = (data.projects || {})[i] || {}; var t = document.getElementById('pr3Total_' + i); if (t) t.innerHTML = rs3TotalHtml(i); var b = document.getElementById('pr3Btn_' + i); if (b) { var comp = rsComplete(p.rescore3 || {}); b.disabled = !!p.rescore3Done || !comp; b.textContent = p.rescore3Done ? '\u2713 Re-scored' : '\u2713 Confirm Post-experiment Score' } }
function confirmRescore3At(i) { if (lockBlocked('projects::' + i)) return; var p = (data.projects || {})[i]; if (!p || !rsComplete(p.rescore3 || {})) return; p.rescore3Done = true; Store.commit('projects', i); render() }
function refreshPrsTotal(i) { var p = (data.projects || {})[i] || {}; var t = document.getElementById('prsTotal_' + i); if (t) t.innerHTML = rsTotalHtml(i); var b = document.getElementById('prsBtn_' + i); if (b) { var comp = rsComplete(p.rescore || {}); b.disabled = !!p.rescoreDone || !comp; b.textContent = p.rescoreDone ? '\u2713 Re-scored' : '\u2713 Confirm Re-score' } }
function confirmRescoreAt(i) { if (lockBlocked('projects::' + i)) return; var p = (data.projects || {})[i]; if (!p || !rsComplete(p.rescore || {})) return; p.rescoreDone = true; Store.commit('projects', i); render() }
function reconsiderNoGo(i) { if (lockBlocked('projects::' + i)) return; if (!data.projects || !data.projects[i]) return; delete data.projects[i].viable; data.capStale = true; Store.commit('projects', i); Store.commit('capStale'); render() }
function renderOutOperFull(){
var ideas=data.ideas||[],stages=getStages(),trk=data.tracking||{},exp=data.experiments||{},opsData=data.opsData||{};
var operational=stages.operational||[];
var h='<div class="flx-between-top-mb"><div class="pdf-hd"><h2 class="h-section">Operational Portfolio</h2><p class="t-lead">Live projects deployed in your business. Monitor performance and manage operations.</p></div>'+outputPrintRow('out-oper')+'</div>';
h+=pipeViz('operate');
if(!operational.length){h+=card('<div class="empty-state"><div class="u-947fc58">✕</div><p class="u-27e8e2c">No operational projects yet.</p><p class="u-97af957">Projects move here when launched from Development or given a "Buy/Scale" decision.</p></div>');return h+archivePanel(['operational'],'oop')}
operational.forEach(function(i){var idea=ideas[i],e=exp[i]||{},tr=trk[i]||{},ops=opsData[i]||{},pb=(data.portfolio||{})[i]||{};
var hColor=ops.health==='green'?'#1B6B5A':ops.health==='amber'?'#D4A017':ops.health==='red'?'#9B2D3F':'#2D5A8E';var opKilled=tr.status==='killed';if(opKilled)hColor='#9B2D3F';
var open=xOpen('oo'+i);
var head='<div class="u-c3626c3 xh" onclick="event.stopPropagation();UI.expanded[\'oo'+i+'\']=!UI.expanded[\'oo'+i+'\'];render()" style="cursor:pointer"><div class="flx-center gap-2 mb-1"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="u-6e57e18"'+(opKilled?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+(opKilled?badge('Killed','#9B2D3F'):badge('Operational','#1B6B5A'))+((((data.projects||{})[i])||{}).legacy?badge('Legacy','#D4A017'):'')+'</div><div class="u-7fc1635">'+['green','amber','red'].map(function(hh){return'<button title="'+(hh==='green'?'Health: on track':hh==='amber'?'Health: watch':'Health: at risk')+'" onclick="event.stopPropagation();setOpsHealth('+i+',\''+hh+'\')" style="width:28px;height:28px;border-radius:14px;border:'+(ops.health===hh?'2px solid #333':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(hh==='green'?'#1B6B5A':hh==='amber'?'#D4A017':'#9B2D3F')+';opacity:'+(ops.health===hh?1:.3)+';cursor:pointer"></button>'}).join('')+'</div></div>';
var body=!open?'':opPortBody(i);h+=card(head+body,'margin-bottom:16px;border-left:4px solid '+hColor+(open?'':';cursor:pointer'),xpandAttr('oo'+i,open))});
h+=balancePanel(stages.operational||[],'operational');
h+=archivePanel(['operational'],'oop');
return h}
function setOpsHealth(i, h) { updNested('opsData', i, 'health', h) }



/* Budget Envelope (chunk 2): the org's AI budget projected over 3–5 years. Year 1 IS
   capital.aiBudget – the live annual figure the engine binds to; years 2+ (capital.budgetY2..5)
   are planning context, consumed by the chunk-3 projection and the analytics surface.
   Envelope years are fiscal/org years; profiles run project-relative – the year-by-year
   chart meets them approximately, as ruled. */
function envYearsOf() { var n = parseInt((data.capital || {}).envYears, 10); return (n >= 1 && n <= 5) ? n : 3 }
/* Funding Plan lines (Paul ruling, July 5): each line is a funding SOURCE
   (description, amount, target year, optional project tag), never a per-project
   ring-fence. Authorization is the auditable step that adds the amount to that
   year's budget envelope; the envelope getter sums base + authorized additions,
   so 3.2, the Hub, and every chart read one composed figure. Authorized lines
   are read-only (revoke to edit). The per-year gap is derived, never entered. */
function fundLines() { return ((data.capital || {}).fundLines || []).filter(function (r) { return !!r }) }
function fundAddsYear(y) { var t = 0; fundLines().forEach(function (r) { if (r.st === 'auth' && parseInt(r.y, 10) === y) t += costNum(r.a) }); return Math.round(t) }
function envBudgetYear(y) { var cap = data.capital || {}; return (y === 1 ? costNum(cap.aiBudget) : costNum(cap['budgetY' + y])) + fundAddsYear(y) }
function flAdd() { if (Collab.lockedByOther('capital')) return; if (!data.capital) data.capital = {}; if (!data.capital.fundLines) data.capital.fundLines = []; data.capital.fundLines.push({ id: uid(), d: '', a: '', y: '1', proj: '', st: 'planned' }); Store.commit('capital'); render() }
function flSave(id, f, v) { if (Collab.lockedByOther('capital')) return; var r = fundLines().filter(function (x) { return x.id === id })[0]; if (!r || r.st === 'auth') return; if (['d', 'a', 'y', 'proj'].indexOf(f) < 0) return; r[f] = v; Store.commit('capital'); render() }
function flDel(id) { if (Collab.lockedByOther('capital')) return; var ls = (data.capital || {}).fundLines || []; for (var x = 0; x < ls.length; x++) { if (ls[x] && ls[x].id === id) { if (ls[x].st === 'auth') return; ls.splice(x, 1); break } } Store.commit('capital'); render() }
function flAuth(id) {
  if (Collab.lockedByOther('capital')) return; var r = fundLines().filter(function (x) { return x.id === id })[0]; if (!r || r.st === 'auth' || !String(r.d || '').trim() || !costNum(r.a)) return;
  r.st = 'auth'; r.at = Date.now(); var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null; r.by = (u && u.name) || ''; data.capStale = true; Store.commit('capital'); Store.commit('capStale'); saveData(); render()
}
function flRevoke(id) {
  if (Collab.lockedByOther('capital')) return; var r = fundLines().filter(function (x) { return x.id === id })[0]; if (!r || r.st !== 'auth') return;
  if (!confirm('Revoking removes ' + fmtMoney(costNum(r.a)) + ' from Year ' + (r.y || '1') + '\u2019s budget. Continue?')) return;
  r.st = 'planned'; delete r.at; delete r.by; data.capStale = true; Store.commit('capital'); Store.commit('capStale'); saveData(); render()
}
function fundNote() {
  var n = envYearsOf(), parts = []; for (var y = 1; y <= n; y++) { var a = fundAddsYear(y); if (a) parts.push('Year ' + y + ' +' + fmtMoney(a)) }
  return parts.length ? '<p class="t-faint-sm" style="margin:8px 0 0">The calculated figures include authorized funding-plan additions: ' + parts.join(' \u00b7 ') + ' (Funding Plan \u2013 Capital Planning Hub, Plan & Funding). The fields above hold the base budget.</p>' : ''
}
function fundPlanLines() {
  var n = envYearsOf(); var _fin = 'font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px';
  var h = ''; var yt = orgYearTotals();
  if (yt && yt.length) {
    var gaps = []; yt.forEach(function (r) { if (r.budgetSet && r.headroom < 0) gaps.push('Year ' + r.y + ': ' + fmtMoney(-r.headroom)) });
    h += '<p class="t-faint-sm" style="margin:0 0 8px">' + (gaps.length ? ('The funding gap is derived from the calendar \u2013 ' + gaps.join(' \u00b7 ') + '. The lines below are the sources that answer it.') : 'No funding gap on the current calendar \u2013 every envelope year\u2019s committed total sits inside its budget. Lines can still be planned ahead here.') + '</p>'
  }
  fundLines().forEach(function (r) {
    var auth = r.st === 'auth';
    h += '<div style="border:1px solid rgba(var(--fg-rgb),' + (auth ? '.16' : '.08') + ');border-radius:8px;padding:8px 10px;margin-bottom:6px">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
      + (auth
        ? '<span class="fs-13" style="flex:2;min-width:160px">' + esc(r.d || '') + '</span><strong>' + fmtMoney(costNum(r.a)) + '</strong><span class="t-faint-sm">Year ' + esc(r.y || '1') + (String(r.proj || '').trim() ? ' \u00b7 ' + esc(r.proj) : '') + '</span>'
        /* The three text boxes carry an id and data-live for one reason each:
           the id is how a sync repaint knows to put back what is being typed
           into them (they had none, so it could not), and data-live is what
           makes them save as they are typed instead of only when focus
           leaves. */
        : '<input id="fl_' + r.id + '_d" value="' + esc(r.d || '') + '" placeholder="e.g. Reallocate from the marketing automation line" onchange="flSave(\'' + r.id + '\',\'d\',this.value)" data-live="1" style="flex:2;min-width:170px;' + _fin + '"><input id="fl_' + r.id + '_a" value="' + esc(r.a || '') + '" placeholder="e.g. $150K" onchange="flSave(\'' + r.id + '\',\'a\',this.value)" data-live="1" style="flex:1;min-width:80px;' + _fin + '"><select onchange="flSave(\'' + r.id + '\',\'y\',this.value)" style="' + _fin + '">' + (function () { var o = ''; for (var y = 1; y <= n; y++)o += '<option value="' + y + '"' + (String(r.y || '1') === String(y) ? ' selected' : '') + '>Year ' + y + '</option>'; return o })() + '</select><input id="fl_' + r.id + '_proj" value="' + esc(r.proj || '') + '" placeholder="project tag (optional)" onchange="flSave(\'' + r.id + '\',\'proj\',this.value)" data-live="1" style="flex:1;min-width:120px;' + _fin + '">')
      + '</div>'
      + '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">'
      + (auth
        ? badge('authorized', '#1B6B5A') + '<span class="t-faint-sm">added to Year ' + esc(r.y || '1') + '\u2019s budget' + (r.at ? ' \u00b7 ' + fmtDate(r.at) : '') + (r.by ? ' \u00b7 ' + esc(r.by) : '') + '</span>' + btn('Revoke', 'flRevoke(\'' + r.id + '\')', 'bg2', 'font-size:11px;padding:3px 10px')
        : badge('planned', '#8B5E3C') + ((String(r.d || '').trim() && costNum(r.a)) ? btn('Authorize \u2013 add to budget', 'flAuth(\'' + r.id + '\')', 'bs', 'font-size:11px;padding:3px 10px') : '<span class="t-faint-sm">give the line a description and an amount to authorize it</span>') + btn('\u2715', 'flDel(\'' + r.id + '\')', 'bg2', 'font-size:11px;padding:3px 8px'))
      + '</div></div>'
  });
  h += btn('+ Add funding line', 'flAdd()', 'bg2', 'font-size:11px;padding:3px 10px');
  var adds = []; for (var y2 = 1; y2 <= n; y2++) { var a2 = fundAddsYear(y2); if (a2) adds.push('Year ' + y2 + ' +' + fmtMoney(a2)) }
  if (adds.length) h += '<p class="t-faint-sm" style="margin-top:8px">Authorized additions now in the budget: ' + adds.join(' \u00b7 ') + '.</p>';
  return h
}
function susCapOf(y) { var cap = data.capital || {}; var v = parseFloat(cap['susCapY' + y]); if (v > 0) return v; var g = parseFloat(cap.susCap); return g > 0 ? g : 0 }
function budgetEnvelopeRow() {
  var cap = data.capital || {}; var n = envYearsOf(); var h = '';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:130px">' + ta('Year 1 budget *', 'cap_aiBudget', cap.aiBudget, 'e.g. $3.5M', 1) + '</div>';
  for (var y = 2; y <= n; y++) { h += '<div style="flex:1;min-width:130px">' + ta('Year ' + y + ' budget', 'cap_budgetY' + y, cap['budgetY' + y], 'e.g. $4M', 1) + '</div>' }
  h += '</div>';
  h += '<div class="t-faint-sm" style="margin:10px 0 4px">INTAKE RESERVE (optional) \u2013 capacity held so next year\'s new projects can be admitted \u2013 headroom is reported net of this figure</div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
  for (var y2 = 1; y2 <= n; y2++) { h += '<div style="flex:1;min-width:130px">' + ta('Year ' + y2 + ' reserve', 'cap_reserveY' + y2, cap['reserveY' + y2], 'e.g. $700K', 1) + '</div>' }
  h += '</div>'; return h
}
function bpHeadlineCosts(i, p, ro) {
  var _ld = bpHasDev(i), _lr = bpHasRoll(i), _ls = bpHasSus(i); var ss = bpSusStartOpYear(i) || 2; var _any = _ld || _lr || _ls;
  return '<h4 class="h-mini">Costs' + (_any ? ' <span class="t-faint-sm" style="font-weight:400">(derived from budget plan)</span>' : '') + '</h4><div class="gr-3-sm"><div>' + ta('Estimated development costs', 'expl_' + i + '_cS', _ld ? fmtMoney(bpDevTotal(i)) : p.startupCost, 'e.g. $180K to build and prove it', 1, ro || _ld) + '</div><div>' + ta('Estimated rollout costs', 'expl_' + i + '_cO', _lr ? fmtMoney(bpRollTotal(i)) : p.rolloutCost, 'e.g. $40K to deploy, train, and launch', 1, ro || _lr) + '</div><div>' + ta('Estimated annual sustainment costs', 'expl_' + i + '_cR', _ls ? (fmtMoney(bpSusSteady(i) || bpSusOpYear(i, ss)) + (ss > 1 ? ' from Year ' + ss : '')) : p.runningCost, 'e.g. $60K per year in operation', 1, ro || _ls) + '</div></div>'
}
function bpHeadlineBudget(i, e) {
  if (bpHasDev(i)) return '<div class="mb-4"><label class="form-label" style="white-space:nowrap">Development Budget</label><textarea id="exp_' + i + '_budget" rows="1" class="ta-helper" readonly>' + esc(fmtMoney(bpDevTotal(i))) + '</textarea><div class="t-faint-sm" style="margin-top:2px;font-size:10px">Derived from budget plan</div>' + bpUndatedWarn(i) + '</div>';
  return '<div>' + ta('Development Budget', 'exp_' + i + '_budget', e.budget, 'e.g. $180K', 1) + '</div>'
}
function bpHeadlineOps(i, ops) {
  var _lr = bpHasRoll(i), _ls = bpHasSus(i); var ss = bpSusStartOpYear(i) || 2; var _n = '<div class="t-faint-sm" style="margin:-10px 0 6px">Derived from budget plan</div>';
  var rb = _lr ? (ta('Rollout Costs', 'ops_' + i + '_rolloutCost', fmtMoney(bpRollTotal(i)), 'e.g. $40K to deploy, train, and launch', 1, true) + _n) : (ta('Rollout Costs', 'ops_' + i + '_rolloutCost', ops.rolloutCost, 'e.g. $40K to deploy, train, and launch', 1));
  var sb = _ls ? (ta('Annual Sustainment Costs', 'ops_' + i + '_runCost', fmtMoney(bpSusSteady(i) || bpSusOpYear(i, ss)) + (ss > 1 ? ' from Year ' + ss : ''), 'e.g. $60K per year to keep this running', 1, true) + _n) : (ta('Annual Sustainment Costs', 'ops_' + i + '_runCost', ops.runCost, 'e.g. $60K per year to keep this running', 1));
  return '<div>' + rb + '</div><div style="margin-top:2px">' + sb + '</div>'
}
function gapItemsOf(i) {
  var p = (data.projects || {})[i] || {}; if (p.gapItems) return p.gapItems;
  var g = p.gap || {}, out = { skills: [], resources: [], technology: [] };
  ['skills', 'resources', 'technology'].forEach(function (c) {
    var n = 0;
    var sp = function (v) { return String(v || '').split(';').map(function (x) { return x.trim().replace(/\.$/, '') }).filter(function (x) { return x }) };
    sp(g[c + 'H']).forEach(function (nm) { out[c].push({ id: 'mig_' + c + '_' + (n++), name: nm, have: true }) });
    sp(g[c + 'N']).forEach(function (nm) { out[c].push({ id: 'mig_' + c + '_' + (n++), name: nm, have: false }) })
  });
  return out
}
function gapEnsure(i) { if (!data.projects) data.projects = {}; if (!data.projects[i]) data.projects[i] = {}; var p = data.projects[i]; if (!p.gapItems) p.gapItems = gapItemsOf(i); return p.gapItems }
function gapAdd(i, c, val) { if (Collab.lockedByOther('projects::' + i)) return; if (!String(val == null ? '' : val).trim()) return; gapEnsure(i)[c].push({ id: uid(), name: String(val).trim(), have: false }); Store.commit('projects', i); render() }
function gapHave(i, c, id) { if (Collab.lockedByOther('projects::' + i)) return; if (!id) return; var it = gapEnsure(i)[c].filter(function (x) { return x && x.id === id })[0]; if (it) it.have = true; Store.commit('projects', i); render() }
function gapUnHave(i, c, id) { if (Collab.lockedByOther('projects::' + i)) return; var it = gapEnsure(i)[c].filter(function (x) { return x && x.id === id })[0]; if (it) it.have = false; Store.commit('projects', i); render() }
function gapDel(i, c, id) { if (Collab.lockedByOther('projects::' + i)) return; var gi = gapEnsure(i); gi[c] = gi[c].filter(function (x) { return !x || x.id !== id }); Store.commit('projects', i); render() }
function assessBlock(i, ro) {
  var _swH = ro ? '' : ' onchange="fldSave(this.id,this.value)" oninput="fldSave(this.id,this.value,true)"';
  var p = (data.projects || {})[i] || {}, idea = (data.ideas || [])[i] || {};
  var _dt = '<div style="font-size:15px;font-weight:700;color:var(--paper);margin:0 0 12px">Project Details</div><div class="gr-2">' + ta('Objectives *', 'expl_' + i + '_obj', p.objectives || idea.strategic, 'What this project aims to achieve', 2, ro) + ta('Deliverables', 'expl_' + i + '_del', p.deliverables, 'What will be produced', 2, ro) + ta('Timeline', 'expl_' + i + '_tl', p.timeline, 'e.g. Prototype 2mo, Test 1mo', 2, ro) + ta('Resources', 'expl_' + i + '_res', p.resources, 'People, budget, technology', 2, ro) + ta('Key risks', 'expl_' + i + '_risk', p.risks || idea.risk, 'Main risks and concerns', 2, ro) + ta('Success metrics', 'expl_' + i + '_met', p.metrics, 'How we\'ll measure success', 2, ro) + '</div>' +
    '<h4 class="h-mini">Partnerships</h4><div class="gr-2">' + ta('Internal', 'expl_' + i + '_pI', p.partInt, 'e.g. IT for integration', 2, ro) + ta('External', 'expl_' + i + '_pE', p.partExt, 'e.g. AI vendor, consultant', 2, ro) + '</div>' +
    bpHeadlineCosts(i, p, ro);
  var _gi = gapItemsOf(i);
  var _gcol = function (c, lbl) {
    var items = _gi[c] || []; var have = items.filter(function (x) { return x.have }); var gap = items.filter(function (x) { return !x.have });
    var row = function (it, un) { return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span class="fs-13" style="flex:1">' + esc(it.name) + '</span><button onclick="' + (un ? 'gapUnHave' : 'gapDel') + '(' + i + ',\'' + c + '\',\'' + it.id + '\')" class="btn-ghost pad-chip-sm" style="width:22px;padding:1px" title="' + (un ? 'Move back to the gap' : 'Remove from the list') + '">\u2715</button></div>' };
    var needCol = '<div><div class="t-faint-sm" style="margin-bottom:4px">NEED \u2013 everything required</div>' + items.map(function (it) { return row(it, false) }).join('') + '<input value="" placeholder="+ Add a need\u2026" onchange="gapAdd(' + i + ',\'' + c + '\',this.value)" class="row-input" style="width:100%;font-size:12px;padding:5px 8px;opacity:.7"/></div>';
    var opts = items.filter(function (x) { return !x.have });
    var haveCol = '<div><div class="t-faint-sm" style="margin-bottom:4px">HAVE \u2013 already covered</div>' + have.map(function (it) { return row(it, true) }).join('') + (opts.length ? '<select onchange="gapHave(' + i + ',\'' + c + '\',this.value)" class="sel-helper" style="width:100%;font-size:12px;padding:5px 8px;opacity:.8"><option value="">+ Mark a need as covered\u2026</option>' + opts.map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + '</option>' }).join('') + '</select>' : '') + '</div>';
    var gapCol = '<div><div class="t-faint-sm" style="margin-bottom:4px">GAP \u2013 need minus have</div>' + (gap.length ? gap.map(function (it) { return '<div class="fs-13" style="margin-bottom:3px;color:var(--warn-text)">' + esc(it.name) + '</div>' }).join('') : '<div class="t-faint-sm">\u2014</div>') + '</div>';
    return '<div style="margin-bottom:24px"><div style="font-size:14px;font-weight:700;color:var(--paper);margin-bottom:8px">' + lbl + '</div><div class="gr-3-sm">' + needCol + haveCol + gapCol + '</div></div>'
  };
  var _an = '<div style="font-size:16px;font-weight:800;letter-spacing:.05em;color:var(--paper);margin:0 0 14px">ANALYSES</div>'
    + '<h4 class="h-mini">Gap Analysis</h4><div class="t-faint-sm" style="margin:2px 0 14px">List what the project needs, mark what is already covered \u2013 the gap is what remains.</div>' + _gcol('skills', 'Skills') + '<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 24px"></div>' + _gcol('resources', 'Resources') + '<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 24px"></div>' + _gcol('technology', 'Technology') + '<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 24px"></div>'
    + '<h4 class="h-mini">SWOT Analysis</h4><div class="swot-mini">' + [{ k: 'strengths', l: '+ Strengths', bg: 'rgba(27,107,90,.08)' }, { k: 'weaknesses', l: '\u2212 Weaknesses', bg: 'rgba(155,45,63,.06)' }, { k: 'opportunities', l: '\u25c9 Opportunities', bg: 'rgba(45,90,142,.08)' }, { k: 'threats', l: '\u25b3 Threats', bg: 'rgba(139,94,60,.08)' }].map(function (q) { return '<div style="background:' + q.bg + ';padding:12px"><div class="h-card-lg">' + q.l + '</div><textarea id="expl_' + i + '_sw_' + q.k + '" rows="2"' + _swH + (ro ? ' readonly' : '') + ' class="u-5eec54b">' + esc((p.swot || {})[q.k]) + '</textarea></div>' }).join('') + '</div>';
  var _tk = 'bta' + i; UI.cardTab = UI.cardTab || {}; var _ct = UI.cardTab[_tk] || 1;
  return bpTabBar(_tk, i, true) + (_ct === 2 ? bpBudgetTab(i, ro) : _ct === 3 ? _an : _dt)
}
function saveAssessFields(i) { if (i == null) return; if (Collab.lockedByOther('projects::' + i)) return; if (!data.projects) data.projects = {}; if (!data.projects[i]) data.projects[i] = {}; var P = data.projects[i]; var km = { obj: 'objectives', del: 'deliverables', tl: 'timeline', res: 'resources', risk: 'risks', met: 'metrics', cS: 'startupCost', cO: 'rolloutCost', cR: 'runningCost' }; Object.keys(km).forEach(function (f) { if ((f === 'cS' && bpHasDev(i)) || (f === 'cO' && bpHasRoll(i)) || (f === 'cR' && bpHasSus(i))) return; var e = $('expl_' + i + '_' + f); if (e) P[km[f]] = e.value }); var gap = P.gap || {};['skills', 'resources', 'technology'].forEach(function (g) { var eh = $('expl_' + i + '_' + g + 'H'), en = $('expl_' + i + '_' + g + 'N'); if (eh) gap[g + 'H'] = eh.value; if (en) gap[g + 'N'] = en.value }); P.gap = gap; var sw = P.swot || {};['strengths', 'weaknesses', 'opportunities', 'threats'].forEach(function (k) { var e = $('expl_' + i + '_sw_' + k); if (e) sw[k] = e.value }); P.swot = sw; var pI = $('expl_' + i + '_pI'), pE = $('expl_' + i + '_pE'); if (pI) P.partInt = pI.value; if (pE) P.partExt = pE.value }
function advanceToDevFromExplore(i) { var _pb = (data.portfolio || {})[i] || {}; if (((data.projects || {})[i] || {}).viable !== true || !(_pb.horizon && _pb.risk && _pb.reward)) return; if (!data.expSelected) data.expSelected = []; if (data.expSelected.indexOf(i) < 0) data.expSelected.push(i); if (!data.projects) data.projects = {}; if (!data.projects[i]) data.projects[i] = {}; data.projects[i].advancedAt = Date.now(); data.projects[i].committedSnap = bpSnapshot(i); Store.commit('projects', i); if (!data.experiments) data.experiments = {}; if (!data.experiments[i]) data.experiments[i] = {}; if (!String(data.experiments[i].budget || '').trim() && String(data.projects[i].startupCost || '').trim()) { data.experiments[i].budget = data.projects[i].startupCost; Store.commit('experiments', i) } data.capStale = true; Store.commit('expSelected'); Store.commit('capStale'); render() }


function doLaunch(i) { UI.expanded['lp' + i] = true; render() }
function capLaunchConfirm(i) {
  if (lockBlocked('opsData::' + i)) return;
  if (!data.opsData) data.opsData = {}; if (!data.opsData[i]) data.opsData[i] = {};
  var u = typeof getCurrentUser === 'function' ? (getCurrentUser() || {}) : {};
  data.opsData[i].launchConfirm = { at: Date.now(), by: u.name || '', note: 'Figures confirmed against actual launch', expectedFo: (bpHasAny(i) ? bpFirstOpMonth(i) : null) || null, actualPm: planMonthNow(i) };
  Store.commit('opsData', i); UI.expanded['lp' + i] = false; doLaunchGo(i)
}
function capLaunchPanel(i) {
  var pm = planMonthNow(i); var fo = bpHasAny(i) ? bpFirstOpMonth(i) : null; var H = bpHorizon(i);
  var h = '<div style="margin-top:10px;padding:12px 14px;border:1px solid rgba(212,160,23,.5);border-radius:8px;background:rgba(212,160,23,.06)">';
  h += '<div class="t-faint-sm" style="margin-bottom:6px">CONFIRM OR REVISE \u2013 LAUNCH</div>';
  if (pm == null || fo == null) { h += '<p class="fs-13" style="margin:0 0 8px">No anchored plan to check against \u2013 confirm to launch.</p>' }
  else if (pm === fo) { h += '<p class="fs-13" style="margin:0 0 8px">On schedule: the plan expected the first operational month exactly now (plan Month ' + fo + '). One click.</p>' }
  else {
    var lt = pm > fo; h += '<p class="fs-13" style="margin:0 0 8px">The plan expected the first operational month at plan Month ' + fo + '; the launch is happening at plan Month ' + pm + ' (' + Math.abs(pm - fo) + ' month' + (Math.abs(pm - fo) > 1 ? 's' : '') + (lt ? ' late' : ' early') + '). Rows that have not yet run are listed \u2013 revise them here if the dates move.</p>';
    var thr = Math.min(pm, fo);
    ['dev', 'roll'].forEach(function (kk) {
      bpRows(i, kk).forEach(function (x) {
        var sp = bpStepSpan(x); if (!sp || !bpStepMoney(x)) return; if (sp[1] < thr) return;
        h += '<div class="row-line"><span class="fs-14" style="flex:1">' + esc(x.name || '(unnamed step)') + ' <span class="t-faint-sm">' + (kk === 'dev' ? 'development' : 'rollout') + '</span></span><span class="t-faint-sm">From</span>' + bpMonthSel('lp_' + i + '_' + kk + '_' + x.id + '_f', x.from, 1, H, 'bpRowSave(' + i + ',\'' + kk + '\',\'' + x.id + '\',\'from\',this.value)') + '<span class="t-faint-sm">To</span>' + bpMonthSel('lp_' + i + '_' + kk + '_' + x.id + '_t', x.to, 1, H, 'bpRowSave(' + i + ',\'' + kk + '\',\'' + x.id + '\',\'to\',this.value)') + '</div>'
      })
    });
    bpRows(i, 'sus').forEach(function (ph) {
      var sp = bpPhaseSpan(ph); if (!sp || !bpPhaseAnnual(ph)) return; if (sp[0] < thr) return;
      h += '<div class="row-line"><span class="fs-14" style="flex:1">' + esc(ph.name || '(sustainment phase)') + ' <span class="t-faint-sm">sustainment</span></span><span class="t-faint-sm">From</span>' + bpMonthSel('lp_' + i + '_sus_' + ph.id + '_f', ph.from, 1, H, 'bpPhSave(' + i + ',\'' + ph.id + '\',\'from\',this.value)') + '</div>'
    })
  }
  h += '<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' + btn('Confirm & Launch \u2192', 'capLaunchConfirm(' + i + ')', 'bp', 'font-size:13px') + btn('Back', 'UI.expanded[\'lp' + i + '\']=false;render()', 'bg2', 'font-size:12px') + '<span class="t-faint-sm">The confirmation is saved for the quarterly review.</span></div></div>';
  return h
}
function doLaunchGo(i) { if (!data.launched) data.launched = []; if (data.launched.indexOf(i) < 0) data.launched.push(i); var _lp = (data.projects || {})[i] || {}; if (!data.opsData) data.opsData = {}; if (!data.opsData[i]) data.opsData[i] = {}; if (!String(data.opsData[i].runCost || '').trim() && String(_lp.runningCost || '').trim()) { data.opsData[i].runCost = _lp.runningCost; Store.commit('opsData', i) } if (!String(data.opsData[i].rolloutCost || '').trim() && String(_lp.rolloutCost || '').trim()) { data.opsData[i].rolloutCost = _lp.rolloutCost; Store.commit('opsData', i) } data.capStale = true; Store.commit('launched'); Store.commit('capStale'); render() }
function killFromLaunch(i) { if (lockBlocked('tracking::' + i)) return; if (!data.tracking) data.tracking = {}; if (!data.tracking[i]) data.tracking[i] = {}; data.tracking[i].status = 'killed'; data.capStale = true; Store.commit('tracking', i); Store.commit('capStale'); render() }
function reviveProject(i) { if (lockBlocked('tracking::' + i)) return; if (!data.tracking) data.tracking = {}; if (!data.tracking[i]) data.tracking[i] = {}; data.tracking[i].status = ''; if (data.tracking[i].killSunkIds) delete data.tracking[i].killSunkIds; data.capStale = true; Store.commit('capStale'); Store.commit('tracking', i); render() }
// === VISUALIZATION FUNCTIONS === (extracted to js/features/charts.js)


// === SIDEBAR === (extracted to js/features/sidebar.js)


// === PHASE LANDING (from pipeline) ===
// renderPhaseLanding is provided by pipeline module above

// === OUTCOME PAGES ===
// renderOutcome routes handled by pipeline module above
// renderPhase5 / renderPhase5Content → js/pages/navigate.js

function renderOutcome() {
  var id = currentStep; var ph = currentPhase;
  var _w = '<div class="content-area pt-110"><div class="content-inner">'; var _we = '</div></div>';
  var _bb = backBtn(); var backH = _bb ? '<div class="mb-5">' + _bb + '</div>' : '';
  // Route to pipeline's outcome renderers
  if (id === 'out-report') return _w + backH + renderOutReport() + _we;
  if (id === 'out-bluesky') return _w + backH + renderOutBluesky() + _we;
  if (id === 'out-orgready') return _w + backH + renderOutOrgReady() + _we;
  if (id === 'out-raci') return _w + backH + renderOutRaciFull() + _we;
  if (id === 'out-explore') return _w + backH + renderOutExploreEnhanced() + _we;
  if (id === 'out-devport') return _w + backH + renderOutExpbriefsFull() + _we; // alias: single canonical Development Portfolio
  if (id === 'out-capplan') return _w + backH + renderOutCapplan() + _we;
  if (id === 'out-expbriefs') return _w + backH + renderOutExpbriefsFull() + _we;
  if (id === 'out-govfw') return _w + backH + renderOutGovFW() + _we;
  if (id === 'out-orgrev') return _w + backH + renderOutOrgRev() + _we;
  if (id === 'out-finalport') return _w + backH + renderOutFinalportFull() + _we;
  if (id === 'out-oper') return _w + backH + renderOutOperFull() + _we;
  /* Every branch above wraps in _w; this one did not, so an outcome id with
     no renderer painted one bare line at y=0 — behind the fixed header, at
     every width. Same wrapper, same clearance as the rest. */
  return _w + backH + '<p class="inline-stone">Output: ' + esc(id) + '</p>' + _we;
}

// PDF export aliases (bridge pipeline names to master names)
// === COACH === (extracted to js/features/coach.js)


// === GROUP CHAT === (extracted to js/features/chat.js)


// === NOTES === (extracted to js/features/notes.js)


// === MODAL + PANEL INFRASTRUCTURE (shared) ===  help overlay → js/features/help.js
var currentModal = null;
// openHelp() → js/features/help.js
function closeModal() {
  currentModal = null;
  var mr = $('modalRoot'); if (mr) mr.innerHTML = '';
  /* A module that paints its own modals paints them into the page, not into
     #modalRoot (see render()), so clearing #modalRoot does not take one off
     the screen — only the next render does. The backdrop listener below calls
     this function, so without the re-render clicking outside a Leaders modal
     did nothing at all. */
  if (window.Modules && Modules.hook('renderModal')) render();
}

/* Any open modal closes when its backdrop (the area outside the card) is clicked.
   Delegated on document so it covers every modal — current and future — including
   ones without their own inline handler. Clicks inside the .modal card don't fire
   (their target isn't the .modal-bg). */
document.addEventListener('mousedown', function (e) {
  var t = e.target;
  if (t && t.classList && t.classList.contains('modal-bg')) closeModal();
});

/* Slide-out panels + the More menu close when you click outside them — but not
   when clicking their own toggle button/FAB (which handle open/close themselves). */
document.addEventListener('mousedown', function (e) {
  var t = e.target;
  function outside(ids) {
    for (var i = 0; i < ids.length; i++) { var el = document.getElementById(ids[i]); if (el && el.contains(t)) return false; }
    return true;
  }
  if (gchatOpen && outside(['gchatPanel', 'gchatNavBtn', 'gchatFab'])) toggleGChat();
  if (notesOpen && outside(['notesPanel', 'notesNavBtn', 'notesFab'])) toggleNotes();
  if (coachOpen && outside(['coachPanel', 'coachFab', 'fabPulse'])) toggleCoach();
  if (UI.navMore) { var wrap = document.querySelector('.nav-more-wrap'); if (!wrap || !wrap.contains(t)) closeNavMore(); }
  if (UI.userMenu) { var uw = document.querySelector('.nav-user-wrap'); if (!uw || !uw.contains(t)) closeUserMenu(); }
  if (UI.navModules) { var mw = document.querySelector('.nav-module-wrap'); if (!mw || !mw.contains(t)) closeNavModules(); }
});

// renderModal() (help overlay) → js/features/help.js

// === ORGANIZATION & TEAM === (extracted to js/features/org-admin.js)


// === VOICE ACTIVATION === (extracted to js/features/voice.js)

/* ── Restoring a session ───────────────────────────────────────────
   Is the session's user on this organization's roster?

   USERS comes from the ACTIVE MODULE's workspace document, and every module
   keeps its own. Walk into a program this organization has never opened and
   that document is empty, so a perfectly valid session looks stale and lands
   the user back on sign-in — which is what happened stepping from sign-up
   into a different program. When the roster is missing, refill it from the
   copy of the organization the registry already fetched before deciding the
   session is bad. See hydrateRosterFromRegistry in js/features/org-admin.js.

   Returns the roster id to sign in as, or '' if this session cannot be
   honoured here.

   Not simply "is userId in USERS", because a session made in one program has
   to be honoured in another and the two rosters may key the same person
   differently. Every workspace keeps its own copy of the team, and until the
   fix in org-admin.js each copy minted its own local id for a colleague the
   database already knew — so the id in the session existed in exactly one
   program. Matching on serverId as well is what carries an existing session
   across, and it is why this returns an id instead of a boolean: the caller
   must sign in as THIS roster's entry for that person, not as the id the
   session was carrying. */
function sessionRosterId(orgId, sess) {
  var userId = sess && (sess.userId || '');
  var serverId = (sess && sess.serverId) || '';
  function find() {
    var byId = USERS.filter(function (u) { return u.id === userId; })[0];
    if (byId) return byId.id;
    var key = serverId || userId;   // a pre-fix session carries only the local id
    var bySrv = key && USERS.filter(function (u) { return u.serverId && u.serverId === key; })[0];
    return bySrv ? bySrv.id : '';
  }
  var hit = find();
  if (hit) return hit;
  if (typeof hydrateRosterFromRegistry !== 'function') return '';
  if (!hydrateRosterFromRegistry(orgId, serverId || userId)) return '';
  applyTeamRoster();
  return find();
}

/* Open the organization a session record names and sign in as its member.
   Returns true when it worked; false leaves the caller to discard the record.
   Shared by boot and by the sign-in screen's "Continue as …", so the two can
   never disagree about what restoring a session means. */
function restoreSession(rec) {
  if (!rec || !rec.orgId || !getOrg(rec.orgId)) return false;
  setCurrentOrg(rec.orgId); loadData(); applyTeamRoster();
  var id = sessionRosterId(rec.orgId, rec);
  if (!id) return false;
  Auth.setSession(id);
  return true;
}

/* What "Continue as …" says, or null when there is nothing to offer. Reads the
   names out of the local registry and roster — no request, because this runs on
   the first paint of the sign-in screen. */
function resumeOffer(rec) {
  if (!rec || !rec.orgId) return null;
  var org = getOrg(rec.orgId); if (!org) return null;
  var roster = localRoster(rec.orgId);
  var key = rec.serverId || rec.userId;
  var who = roster.filter(function (u) { return u.id === rec.userId || (key && u.serverId === key); })[0];
  if (!who || !(who.name || who.username)) return null;
  return { orgId: rec.orgId, userId: rec.userId, serverId: rec.serverId || '', name: who.name || who.username, orgName: org.name || '' };
}

/* The "Continue as …" button. Restores the offered session and lands the
   account in one of its own programs, exactly as a fresh sign-in does — this
   IS a sign-in, just one whose credentials were accepted earlier. Returns false
   when the record no longer resolves, so the screen can withdraw the offer. */
function resumeSession(rec) {
  /* The record only names a workspace; the server session is the sign-in. Ask it
     first, and withdraw the offer when it has ended (Part 6). */
  Auth.currentSession(function (res) {
    var want = rec && (rec.serverId || rec.userId);
    if (!res || !res.ok || res.admin || res.mustChange || (want && res.userId && res.userId !== want)) {
      if (UI.entry) { UI.entry.resume = null; UI.entry.err = res && res.reason === 'network' ? authRefusal(res, '') : 'Your session has ended. Sign in again.'; }
      render(); return;
    }
    resumeSessionNow(rec);
  });
  return true;
}
function resumeSessionNow(rec) {
  if (!restoreSession(rec)) { if (UI.entry) { UI.entry.resume = null; UI.entry.err = 'That session is no longer valid — please sign in.'; } render(); return false; }
  try { Store.setSession(Auth.sessionRecord(currentOrgId, currentUserId)); } catch (e) { }
  UI.entry = null;
  if (window.Router && Router.landAfterAuth(accountType(currentOrgId))) return true;
  render();
  return true;
}

/* ── Is the restored session still the server's? (Directive 2 Oct 2026, Part 6) ──
   bootApp restores a session from this browser's own records, synchronously, so
   the first paint is the workspace and not a flash of sign-in. Those records only
   say WHICH workspace; the sign-in is the server's session cookie, and it can have
   ended (8 hours idle, the browser closed, a password changed elsewhere, signed
   out in another tab). So the server is asked as soon as the page is up, and a
   session it no longer recognises — or recognises as somebody else — is signed
   out here too. A network failure is not an answer and changes nothing. */
function confirmSessionWithServer() {
  if (SAMPLE_MODE) return;
  var hadMember = !!currentUserId && !isAppAdmin, hadAdmin = !!isAppAdmin;
  if (!hadMember && !hadAdmin) return;
  var me = getCurrentUser(), want = (me && me.serverId) || '';
  Auth.currentSession(function (res) {
    if (!res || res.reason === 'network') return;
    var stands = hadAdmin ? (res.ok && res.admin && !res.mustChange)
      : (res.ok && !res.admin && !res.mustChange && (!want || res.userId === want));
    if (stands) return;
    sessionEnded();
  });
}
/* The server says this browser is not signed in (or not as this person): clear the
   local records and show sign-in, the way signing out does, without asking. */
function sessionEnded() {
  try { Collab.leave(); } catch (e) { }
  try { chatShutdown(); } catch (e) { }
  try { sealSession(); } catch (e) { }
  Auth.clearSession();
  UI.adminNewOrg = null;
  UI.entry = { step: 'login', err: 'Your session has ended. Sign in again.', errors: {} };
  /* The sign-in page is a new load: carry the reason across so it can say why. */
  try { sessionStorage.setItem('nc-session-ended', '1'); } catch (e) { }
  if (window.Router && Router.served()) { Router.openAuth('login'); return; }
  render();
}

/* ── No password in this browser's storage (Directive 2 Oct 2026, 5.2 and 5.8.9) ──
   Before passwords moved to the server, this browser could hold the administrator's code in clear
   ('pipeline-admin', written by the old offline sign-in) and every cached workspace's roster carried
   each person's PIN. The server strips them now (Core\DocPrivacy), but a copy cached before that stays
   until something rewrites it. Remove both at start-up: the key outright, and `passcode` from every
   cached roster — written straight back to the local cache only, never sent anywhere. */
function scrubStoredPasswords() {
  try { localStorage.removeItem('pipeline-admin'); } catch (e) { }
  try {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('pipeline-org-data::') === 0) keys.push(k); }
    keys.forEach(function (k) {
      var raw = localStorage.getItem(k); if (!raw || raw.indexOf('passcode') < 0) return;
      var d = JSON.parse(raw); var changed = false;
      ['roster', 'members'].forEach(function (f) { (Array.isArray(d && d[f]) ? d[f] : []).forEach(function (u) { if (u && 'passcode' in u) { delete u.passcode; changed = true; } }); });
      if (changed) localStorage.setItem(k, JSON.stringify(d));
    });
  } catch (e) { }
}

// === Sample-data seeds → js/dev/seed.js ===
/* -- SAMPLE ORGANIZATION (Part 3): opened from Demo in a new tab; a private copy of the built-in sample in
   each person's browser (key pipeline-org-data::org_sample_local), never in the organization list, never sent
   to the server (see SAMPLE_TAB_ADDR at the top of this file). The sample people have no passwords. -- */
var SAMPLE_NOTE_TEXT = 'Sample organization: your changes stay in this browser only';
/* AI-Ready Architecture (21 Oct 2026): its build has the same Demo tab and Notes-in-More (Part 3). */
function sampleAppliesHere() { try { return !!(window.Modules && (Modules.isActive('pipeline') || Modules.isActive('exec-readiness') || Modules.isActive('ai-governance') || Modules.isActive('ai-architecture'))); } catch (e) { return false; } }
/* Part 4 (4.2.3) moved Reset all data out of the More menu into the admin console's Reset data — on the Pipeline (6 Oct 2026)
   Executive Readiness and Responsible AI Governance (7 Oct 2026), whose data that Reset now covers (OrganizationController::reset). Its own test, not
   sampleAppliesHere(): a program that has the sample tab but not yet the console's Reset would keep its menu item. */
/* AI-Ready Architecture (21 Oct 2026): its data is in the console's Reset (RESET_MODULES). */
function resetMovedToConsole() { try { return !!(window.Modules && (Modules.isActive('pipeline') || Modules.isActive('exec-readiness') || Modules.isActive('ai-governance') || Modules.isActive('ai-architecture'))); } catch (e) { return false; } }
function isSampleTab() { return !!SAMPLE_TAB_ADDR; }
function openSampleTab() {
  if (!currentUserId || SAMPLE_MODE || !sampleAppliesHere()) return;
  try { localStorage.setItem('sample-tab-pass', JSON.stringify({ t: Date.now() })); } catch (e) { }
  /* the program's own address, never the page's: from a door or a deep link (/login, /step/1.2) the router would rewrite the address and drop ?sample=1 */
  var u = (window.Router && Router.moduleUrl) ? Router.moduleUrl(Modules.activeId()) : location.pathname;
  window.open(u + (u.indexOf('?') >= 0 ? '&' : '?') + 'sample=1', '_blank');
}
/* The pass works once and for two minutes; a page opened from a file:// address cannot read its opener, so the pass is the dependable route. */
function sampleTabAccepted() {
  var ok = false;
  try { var p = JSON.parse(localStorage.getItem('sample-tab-pass') || 'null'); var age = p && typeof p.t === 'number' ? Date.now() - p.t : -1; if (age >= 0 && age < 120000) ok = true; } catch (e) { }
  try { localStorage.removeItem('sample-tab-pass'); } catch (e) { }
  if (!ok) { try { var w = window.opener; if (w && w !== window && w.currentUserId && !w.SAMPLE_MODE) ok = true; } catch (e) { } }
  return ok;
}
function prepareSampleData(fresh) {
  if (fresh || !data || !Array.isArray(data.roster) || !data.roster.length) {
    data = emptyData(); USERS.length = 0;
    var _c = window.confirm; window.confirm = function () { return true; };
    /* this program's own built-in sample (Modules.seeds: the Pipeline's seedData, Executive Readiness's ER.seedData) — its seed
       function, not runSeed: runSeed also writes the sample people to the server */
    var own = (window.Modules && Modules.seeds) ? Modules.seeds().filter(function (x) { return x.id === 'sample'; })[0] : null;
    /* A program may name a different sample for the Demo tab than its More-menu seed (21 Oct 2026): AI-Ready Architecture's
       build opens its demo on the FULL sample, which brings its own cast — the plain sample keeps the organization's people,
       and a demo starts with none. */
    var demo = (window.Modules && Modules.hook) ? Modules.hook('sampleSeed') : null;
    try { if (demo) demo(); else if (own) own.run(); else seedData(); } finally { window.confirm = _c; }
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
  var dropLoader = function () { try { if (window.hideBootLoader) window.hideBootLoader(); } catch (e) { } };   /* bootApp drops it at its end, which a sample tab never reaches */
  if (!sampleTabAccepted()) { SAMPLE_REFUSED = true; render(); dropLoader(); return true; }
  currentOrgId = SAMPLE_LOCAL_ID;   /* this tab's memory only: never setCurrentOrg, which stores the pointer the person's own tab uses */
  loadData();
  prepareSampleData(false);
  watchSampleNote();
  try { syncSidebarToViewport(true); } catch (e) { }
  render();
  dropLoader();
  return true;
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
  return a.querySelector('.content-inner') || a.querySelector('.hero-left') || a.querySelector('.pt-100 > .wrap') || a.querySelector('.u-70c6b34 > .u-4f90335') || backButtonBox(a) || null;
}
/* Last resort (7 Oct 2026, Responsible AI Governance's output pages): a page with none of the containers above holds its Back button
   in a box of its own, so the note goes first in that box, directly above the Back button (3.3.4). */
function backButtonBox(a) {
  var b = [].slice.call(a.querySelectorAll('button')).filter(function (x) { return /^\s*\u2190\s*Back\b/.test(x.textContent || ''); })[0];
  return b ? b.parentElement : null;
}
function ensureSampleNote() {
  if (!SAMPLE_MODE || SAMPLE_REFUSED || !currentUserId) return;
  var host = sampleNoteHost(); if (!host) return;
  var n = document.getElementById('sampleNote');
  if (n && n.parentNode === host && host.firstElementChild === n) return;
  if (n && n.parentNode) n.parentNode.removeChild(n);
  n = document.createElement('div'); n.id = 'sampleNote'; n.className = 'sample-note'; n.setAttribute('role', 'note'); n.textContent = SAMPLE_NOTE_TEXT;
  host.insertBefore(n, host.firstChild);
  /* 3.3.4: the note never sits under the top bar. A page that pads its own top by a fixed amount (Governance's output
     pages: 110px) sits under a top bar that has wrapped to a second row, so the note steps down below the bar (7 Oct 2026) */
  try { var nav = document.querySelector('nav'), nb = nav ? nav.getBoundingClientRect().bottom : 0, top = n.getBoundingClientRect().top + (window.pageYOffset || 0); if (nb && top < nb + 8) n.style.marginTop = Math.ceil(nb + 8 - top) + 'px'; } catch (e) { }
}
var _sampleObserver = null;
function watchSampleNote() {   /* pages drawn a moment after the rest (the screen loader) */
  if (_sampleObserver || typeof MutationObserver === 'undefined') return;
  var a = document.getElementById('app'); if (!a) return;
  _sampleObserver = new MutationObserver(function () { try { ensureSampleNote(); } catch (e) { } });
  _sampleObserver.observe(a, { childList: true, subtree: true });
}
function bootApp() {
  if (_bootDone) return false;
  _bootDone = true;
  if (isSampleTab()) return startSampleTab();   /* Part 3: a sample tab never reads the person's stored pointers or session */
  scrubStoredPasswords();   /* Part 5.2 / 5.8.9: nothing this browser stored earlier may still hold a password */
  currentOrgId = Store.getCurrentOrg();
  migrateLegacyData();
  if (currentOrgId && !getOrg(currentOrgId)) setCurrentOrg(null);
  (function () {
    /* ── Arriving AT a sign-in page is a request to sign in ─────────
       A remembered session used to be entered before this screen could
       render, wherever the load happened to be — so asking for a sign-in
       address put you into the app as whoever used this browser last, most
       often the organization's administrator, with no credentials typed and no
       way to decline. That is the "logged in as someone else" report, and why
       clearing cookies appeared to fix it.

       The rule is about the ADDRESS, not the program: every program now has its
       own /login, and each of them is a request to sign in. At a program's
       plain address a restored session is exactly right — the person is coming
       back to their work. At its /login it is an answer to a question nobody
       asked. So the record is not entered there —
       it is OFFERED, as "Continue as …" above the form (auth.js paintResume),
       and typing signs in as somebody else. The admin console keeps its own
       restore: /apps/admin lands on the console, which is where an app-admin
       session belongs, and never inside an organization. */
    var atAuth = !!(window.Router && Router.kind() === 'auth');
    var entryStep = atAuth ? (Router.boot().entryStep || 'login') : 'login';
    var offerOnly = atAuth && entryStep !== 'admin-login';

    var rem = null; try { rem = Store.getRemember(); } catch (e) { }
    var sess = null; try { sess = Store.getSession(); } catch (e) { }

    if (!offerOnly) {
      if (rem && getOrg(rem.orgId)) {
        if (restoreSession(rem)) { UI.entry = null; return; }
        try { Store.setRemember(null); } catch (e) { }
      }
      // Browser-session (stay signed in across refresh, cleared when the browser closes)
      if (sess && !sess.admin && getOrg(sess.orgId)) {
        if (restoreSession(sess)) { UI.entry = null; return; }
        try { Store.setSession(null); } catch (e) { }
      }
    }
    // App-admin session (the administrator signed in with their username and password).
    if (sess && sess.admin) {
      Auth.setAdminSession(true);   /* confirmed with the server below (confirmSessionWithServer) */
      if (!offerOnly && sess.orgId && getOrg(sess.orgId) && sess.userId && restoreSession(sess)) {
        UI.entry = null; return;
      }
      // Admin with no valid org/user to act as → land on the admin console.
      // Paint from the local mirror now, then repaint once the database's org
      // list is in, so a refresh on the console never shows a stale/empty list.
      UI.entry = { step: 'admin' };
      hydrateOrgsFromServer(function () { if (isAppAdmin && UI.entry && UI.entry.step === 'admin') render(); });
      return;
    }
    /* No session to restore (or an address that would rather ask) → start the
       entry flow, on the screen the URL asked for. A program's /login and the
       root /signup and /admin are separate addresses, not one screen with three
       states: arriving at /signup has to open sign-up, not sign-in with a click
       still to make. */
    if (currentOrgId) { loadData(); applyTeamRoster(); } else { data = emptyData(); USERS.length = 0; }
    Auth.setSession(null); UI.entry = { step: entryStep };
    try { if (sessionStorage.getItem('nc-session-ended')) { sessionStorage.removeItem('nc-session-ended'); UI.entry.err = 'Your session has ended. Sign in again.'; } } catch (e) { }
    if (entryStep === 'login') UI.entry.resume = resumeOffer(rem || (sess && !sess.admin ? sess : null));
  })();
  confirmSessionWithServer();
  /* A restored session sitting at an entry address — already signed in, at a
     door. Send the account through it (Router.landingUrl prefers this page's
     own program) rather than painting sign-in over a workspace it can open. */
  if (!UI.entry && window.Router && Router.kind() === 'auth'
    && Router.landAfterAuth(accountType())) return true;
  /* The roster is the ORGANIZATION's, but every program keeps its own copy in
     its workspace document — so a colleague added while you were in one program
     was invisible in every other one. Only two things ever read the database's
     member list: opening the Organization modal, which refreshes whichever
     document happens to be active, and a sign-in that does not navigate — and a
     sign-in at a program's door always navigates (Router.landAfterAuth returns
     before the pull in auth.js). That left the assignment picker on a step page
     listing one person while the org had several. Pull here, where the program
     has just been booted into: it is a no-op without an org serverId, silent on
     failure, and only re-renders when the roster actually changed. */
  try { if (currentUserId) notesLoad(); } catch (e) { } // warm this user's notes badge/panel
  /* Roster then assignments, and assignmentsLoad() now waits for the roster
     itself — these two were fired back to back here, and the mapping from a
     member's public id to their local roster id therefore raced the very
     request that fetches the roster. See assignmentsLoad(). */
  try { if (currentUserId) assignmentsLoad(); } catch (e) { } // roster + step assignments from the DB
  try { Store.startChangeSignal(); } catch (e) { } // multi-user change signal: storage events + polling (July 8)
  (function () { var fy = document.getElementById('footerYear'); if (fy) fy.textContent = new Date().getFullYear(); })();
  // Narrow windows start on the minimized rail — never on no rail at all.
  syncSidebarToViewport(true);
  /* A module URL may name a screen inside the program — /step/1.2, /phase/2 —
     so open that instead of Home. Set before the first render so the app never
     paints Home and then jumps. Ignored when the entry gate is up: the screen
     is still waiting behind sign-in, and bootApp will not have got here. */
  (function () {
    if (UI.entry || !window.Router) return;
    var to = Router.entryScreen();
    if (!to) return;
    currentPage = to.page;
    currentStep = to.step || null;
    if (currentStep) {
      // Resolve the phase the step belongs to, exactly as go() does — the
      // sidebar and the header read currentPhase, not the step id.
      for (var pi = 0; pi < PH.length; pi++) {
        if (currentPage === 'phase' && String(PH[pi].id) === String(currentStep)) { currentPhase = PH[pi]; break; }
        var steps = PH[pi].steps || [];
        for (var si = 0; si < steps.length; si++) { if (steps[si].id === currentStep) { currentPhase = PH[pi]; break; } }
        if (currentPhase) break;
        var outs = PH[pi].outcomes || [];
        for (var oi = 0; oi < outs.length; oi++) { if (outs[oi].id === currentStep) { currentPhase = PH[pi]; break; } }
        if (currentPhase) break;
      }
    }
  })();
  render();
  /* Sign-up asked for Profile (Store.setOpenProfile) and this is the load it
     asked across: the program is painted, so the panel has chrome to open over.
     Taken once — never on a later refresh — and only for someone actually
     signed in and inside a program; at the entry gate the request waits for the
     load that gets past it. */
  try {
    /* openOrgSetup, not openOrg: this is the panel raised straight after
       sign-up, so it wears the welcome framing (js/features/org-admin.js).
       Opening Profile from the More menu later still uses openOrg. */
    if (!UI.entry && currentUserId && Store.takeOpenProfile() && typeof openOrgSetup === 'function') openOrgSetup();
  } catch (e) { }
  // The app is on screen now — drop the boot loader that covered the load flash.
  try { if (window.hideBootLoader) window.hideBootLoader(); } catch (e) { }
  /* Re-evaluate the sidebar when the window crosses the 960px band — in BOTH
     directions. Minimized and maximized are different markup, not just
     different classes, so this repaints the rail rather than only restamping
     the state classes. */
  window.addEventListener('resize', function () {
    if (!syncSidebarToViewport()) return;
    if (typeof renderSidebar === 'function') renderSidebar();
    else if (typeof updateSidebarState === 'function') updateSidebarState();
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

/* PRINT OPTION on every Phase 5 page and every dashboard (Paul's ruling, 12 Sep 2026; family): a Save as PDF control at the top of each such page prints it as a document — cover, body without controls, the copyright footer */
function printBar(){return UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 10px">'+pdfBtn('printCurrentPage()')+'</div>'}
function isPhase5Step(id){var p=null;PH.forEach(function(x){if(x.id===5)p=x});return !!(p&&p.steps.some(function(s){return s.id===id}))}
function stepNameOf(id){var nm=id;PH.forEach(function(p){p.steps.forEach(function(s){if(s.id===id)nm=s.name})});return nm}
function _pbStrip(body){return String(body).replace(/<div class="print-bar"[\s\S]*?<\/div>/,'').replace(/<button[\s\S]*?<\/button>/g,'')}
/* ══ THE REPORTING ENGINE AND THE PAPER HELPERS — byte-exact from Executive Readiness (the family form; Governance's engine as ER carries it), ported to the Innovation Pipeline 16 Sep 2026 on Paul's ruling ══ */
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
/* ── documents composed for paper (15 Sep 2026, Paul's ruling): a document is designed from the page's content and laid out for the page; it is never the page's markup passed through ── */
function erHead(title,sub){return '<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* a section heading alone, for sections that are not a table of rows. 16 Sep 2026 (Paul's ruling, from the Values Architecture printout): the sub-line sits on its own line beneath the title, in its mono face, not inline with it */
function erHeadLg(title,sub){return erHead(title,sub).replace('font-size:24px','font-size:28px')} /* 16 Sep 2026 (Paul's ruling): a section heading a step above the register's group headings (24px), for documents whose groups carry their own */
function erAppendix(title,sub){return erHeadLg('Appendix','')+'<div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111;margin:0 0 12px;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* 16 Sep 2026 (Paul's ruling): an appendix is headed Appendix, with the section's own title beneath — never labelled beside the title; its sub-line beneath the title likewise */
function erFigRow(figs){return '<div class="er-figs" style="display:grid;grid-template-columns:repeat('+figs.length+',1fr);gap:10px;margin:0 0 22px;break-inside:avoid;page-break-inside:avoid">'+figs.map(function(f){return '<div style="border:1px solid #ddd;border-top:3px solid '+(f.col||'#111')+';border-radius:6px;padding:10px 8px;text-align:center"><b style="display:block;font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:600;line-height:1.1;color:'+(f.vcol||'#111')+'">'+esc(String(f.v))+'</b><span style="display:block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-top:4px">'+esc(f.l)+'</span>'+(f.sub?'<span style="display:block;font-size:10.5px;color:#777;margin-top:2px">'+esc(f.sub)+'</span>':'')+'</div>'}).join('')+'</div>'} /* a row of figures in boxes: the value, its label, an optional line beneath, a coloured rule above */
function erBarBlock(title,sub,rows){var tone=function(v){return v>=4?'#1B6B5A':v>=2.5?'#4E7FA6':'#9B2D3F'};return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+rows.map(function(r){var v=+r.v||0,m=r.max||5;return '<tr><td style="width:40%;padding:4px 8px 4px 0;font-size:11.5px;color:#555;border-bottom:1px solid #eee;vertical-align:middle">'+esc(r.l)+'</td><td style="padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle"><div style="height:7px;background:#eee;border-radius:4px"><div style="height:7px;width:'+Math.round(v/m*100)+'%;background:'+(v?tone(v):'#eee')+';border-radius:4px"></div></div></td><td style="width:64px;padding:4px 0 4px 8px;text-align:right;white-space:nowrap;font-family:var(--mono,monospace);font-size:12px;color:#111;border-bottom:1px solid #eee;vertical-align:middle">'+(v?v.toFixed(1)+' / '+m:'\u2014')+'</td></tr>'}).join('')+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling): a headed block of bars — label · bar · score, the Readiness Report's row form — unsplittable under the block rule */
function erBlock(inner){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+inner+'</div>'} /* 16 Sep 2026: the block rule as a wrapper — a unit that is never split across pages */
/* ── the single-record documents (14 Sep 2026): a heading per section over labelled rows, in the screen's own words; one form each ── */
function erSection(title,rowsHtml,sub){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub) /* 16 Sep 2026 (Paul's ruling): the section heading is erHead's — the sub-line beneath the title; one heading form */+'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px;break-inside:auto;page-break-inside:auto"><tbody>'+rowsHtml+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling; family): a block — a heading with its rows — is never split across pages; if it would be, it starts a new page. The block is unsplittable; the table inside stays splittable between rows so a block taller than a page still breaks between rows, never inside one */
function erRows(obj,fields){return fields.map(function(f){if(f.rows)return f.rows(obj).map(function(r){return lyRow(r.l,r.v)}).join(''); /* 16 Sep 2026: a field may supply its own rows (a list stored on the record) */var v=obj[f.k];var L=(typeof STRUCTURE_LABELS!=='undefined')&&STRUCTURE_LABELS[f.k];if(L&&L[v])v=L[v];return lyRow(f.l,v)}).join('')} /* a stored choice prints as its label */

/* ══ THE IDEA RECORD (16 Sep 2026): the record that runs the module — an idea, gaining a layer at each stage; the five portfolio outputs are its registers at successive stages. Labels are the app's own read-only cards' labels (expCardRO, projCardRO, devCardRO, opPortBody) ══ */
var IDEA_HORIZON_LABELS={quick:'Quick win',medium:'Medium-term bet',long:'Long-term bet'}; /* the words Step 3.1 gives the horizon values */
var IDEA_GATES=[{k:'techCapable',l:'Technology'},{k:'resourcesAvailable',l:'Resources'},{k:'culturalFit',l:'Culture'},{k:'purposeAligned',l:'Purpose'},{k:'affordable',l:'Affordability'}]; /* the five qualification gates of Step 1.3 */
function ideaRecs(list){return (list||[]).map(function(i){return {i:i}})} /* a register's records are indices into data.ideas, carried as {i} */
function ideaQual(i){var a=(data.assessments||{})[i]||{};var def=IDEA_GATES.filter(function(g){return a[g.k]!==undefined});if(!def.length)return {state:'none',text:''};var failed=IDEA_GATES.filter(function(g){return a[g.k]===false});if(def.length<IDEA_GATES.length)return {state:'partial',text:'Partly qualified ('+def.length+' of 5 gates answered)'};return failed.length?{state:'disq',text:'Did not pass: '+failed.map(function(g){return g.l}).join(', ')}:{state:'pass',text:'Passed all five gates'}}
function ideaBalanceBlock(items,stage,title){if(!items||!items.length)return '';var res=items.map(function(i){return resolveBands(i,stage)});var tot=res.length;
  var rows=[['Time horizon','h',[['quick','Quick'],['medium','Medium'],['long','Long']]],['Risk','r',[['low','Low'],['medium','Medium'],['high','High']]],['Reward','w',[['low','Low'],['medium','Medium'],['high','High']]]];
  var bars=rows.map(function(row){return '<tr><td style="width:24%;padding:8px 8px 8px 0;vertical-align:top;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#555;border-bottom:1px solid #eee">'+row[0]+'</td>'+row[2].map(function(b){var c=res.filter(function(x){return x.conf&&x[row[1]]===b[0]}).length,p=res.filter(function(x){return !x.conf&&x[row[1]]===b[0]}).length;var cw=Math.round(c/tot*100),pw=Math.round(p/tot*100);return '<td style="padding:8px 6px;vertical-align:top;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:3px"><span>'+b[1]+'</span><span style="font-family:var(--mono,monospace)">'+c+(p?' (+'+p+')':'')+'</span></div><div style="height:7px;border-radius:4px;background:#eee;overflow:hidden;display:flex"><div style="width:'+cw+'%;background:#555"></div><div style="width:'+pw+'%;background:#bbb"></div></div></td>'}).join('')+'</tr>'}).join('');
  var fl=balanceFlags(res);var sub=stage==='bluesky'?'From intake estimates \u2014 timeframe, triage risk and value':stage==='explore'?'Graded projects only':'Solid = positioned; lighter = provisional, suggested from the assessments';
  return erBlock(erHead(title||'Portfolio Balance',sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 '+(fl.length?'8px':'22px')+'"><tbody>'+bars+'</tbody></table>'+(fl.length?'<p style="font-size:12px;color:#333;margin:0 0 22px">'+fl.map(function(t){return '\u26A0 '+esc(t)}).join('<br>')+'</p>':''))} /* 17 Sep 2026 (Paul's ruling): the page's Portfolio Balance card on paper \u2014 three rows of three bands with counts, the flags beneath; greys, as the document's figures are */
LAYER_MAPS.idea={
  identity:function(r){var d=(data.ideas||[])[r.i]||{};return {title:d.name||'Unnamed idea',score:'',meta:[d.dept||'',d.cost||'',d.timeframe||'',d.when==='future'?'Parked for the future':''].filter(Boolean)}},
  layers:[
   {id:'idea',title:'The idea',stage:'1.2',present:function(r){var d=(data.ideas||[])[r.i]||{};return !!(d.desc||d.strategic||d.outcome||d.capabilities||d.risk)},fields:[
     {label:'Description',get:function(r){return ((data.ideas||[])[r.i]||{}).desc},summary:true},
     {label:'Strategic anchor',get:function(r){return ((data.ideas||[])[r.i]||{}).strategic},summary:true},
     {label:'Best and worst outcome',get:function(r){return ((data.ideas||[])[r.i]||{}).outcome}},
     {label:'Capabilities needed',get:function(r){return ((data.ideas||[])[r.i]||{}).capabilities}},
     {label:'Risk',get:function(r){return ((data.ideas||[])[r.i]||{}).risk}}]},
   {id:'rank',title:'Filter and rank',stage:'1.3',present:function(r){var a=(data.assessments||{})[r.i];return !!(a&&(IDEA_GATES.some(function(g){return a[g.k]!==undefined})||a.priority||a.value))},fields:[
     {label:'Qualification',get:function(r){return ideaQual(r.i).text},summary:true},
     {label:'Score',get:function(r){return ideaQual(r.i).state==='pass'?triageScore(r.i)+' / 50':''},summary:true},
     {label:'Priority',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.priority?a.priority+' / 10':''}},
     {label:'Risk (10 = low)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.risk?a.risk+' / 10':''}},
     {label:'Value',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.value?a.value+' / 10':''}},
     {label:'Cost (10 = low)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.costScore?a.costScore+' / 10':''}},
     {label:'Ease (10 = easy)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.difficulty?a.difficulty+' / 10':''}}]},
   {id:'exploration',title:'Exploration',stage:'2.4',present:function(r){var p=(data.projects||{})[r.i]||{};return !!(p.viable===true||p.viable===false||p.objectives||p.deliverables||p.noGoR)},fields:[
     {label:'Verdict',get:function(r){var p=(data.projects||{})[r.i]||{};return p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided'},summary:true},
     {label:'No-Go reason',get:function(r){return ((data.projects||{})[r.i]||{}).noGoR},summary:true},
     {label:'Objectives',get:function(r){return ((data.projects||{})[r.i]||{}).objectives},summary:true},
     {label:'Deliverables',get:function(r){return ((data.projects||{})[r.i]||{}).deliverables}},
     {label:'Timeline',get:function(r){return ((data.projects||{})[r.i]||{}).timeline}},
     {label:'Resources',get:function(r){return ((data.projects||{})[r.i]||{}).resources}},
     {label:'Key risks',get:function(r){return ((data.projects||{})[r.i]||{}).risks}},
     {label:'Success metrics',get:function(r){return ((data.projects||{})[r.i]||{}).metrics}},
     {label:'Internal partners',get:function(r){return ((data.projects||{})[r.i]||{}).partInt}},
     {label:'External partners',get:function(r){return ((data.projects||{})[r.i]||{}).partExt}}]},
   {id:'portfolio',title:'Portfolio placement',stage:'3.1',present:function(r){var p=(data.portfolio||{})[r.i]||{};return !!(p.horizon||p.risk||p.reward||p.notes)},fields:[
     {label:'Horizon',get:function(r){var p=(data.portfolio||{})[r.i]||{};return IDEA_HORIZON_LABELS[p.horizon]||(p.horizon?lyCap(p.horizon):'')},summary:true},
     {label:'Risk',get:function(r){var p=(data.portfolio||{})[r.i]||{};return p.risk?lyCap(p.risk):''},summary:true},
     {label:'Reward',get:function(r){var p=(data.portfolio||{})[r.i]||{};return p.reward?lyCap(p.reward):''},summary:true},
     {label:'Notes',get:function(r){return ((data.portfolio||{})[r.i]||{}).notes}}]},
   {id:'capital',title:'Capital',stage:'3.3',present:function(r){var p=(data.projects||{})[r.i]||{},b=(data.budgetPlans||{})[r.i]||{};return !!(p.startupCost||p.rolloutCost||p.runningCost||b.horizon||b.contingency)},fields:[
     {label:'Start-up cost',get:function(r){return ((data.projects||{})[r.i]||{}).startupCost},summary:true},
     {label:'Rollout cost',get:function(r){return ((data.projects||{})[r.i]||{}).rolloutCost},summary:true},
     {label:'Running cost',get:function(r){return ((data.projects||{})[r.i]||{}).runningCost},summary:true},
     {label:'Plan horizon',get:function(r){var b=(data.budgetPlans||{})[r.i]||{};return b.horizon?b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):''}},
     {label:'Contingency',get:function(r){var b=(data.budgetPlans||{})[r.i]||{};return b.contingency?b.contingency+'%':''}}]},
   {id:'development',title:'Development track',stage:'4.1',present:function(r){var t=(data.tracking||{})[r.i]||{};return !!(t.status||t.results||t.infraLearnings||t.breakWork)},fields:[
     {label:'Status',get:function(r){var t=(data.tracking||{})[r.i]||{};return t.status?lyCap(t.status):''},summary:true},
     {label:'Results to date',get:function(r){return ((data.tracking||{})[r.i]||{}).results},summary:true},
     {label:'Infrastructure learnings',get:function(r){return ((data.tracking||{})[r.i]||{}).infraLearnings}},
     {label:'What\u2019s breaking / working',get:function(r){return ((data.tracking||{})[r.i]||{}).breakWork}}]},
   {id:'review',title:'Portfolio review',stage:'4.4',present:function(r){var it=((data.review||{}).items||{})[r.i]||{};return !!it.decision},fields:[
     {label:'Decision',get:function(r){var it=((data.review||{}).items||{})[r.i]||{};return it.decision?lyCap(it.decision):''},summary:true}]},
   {id:'operations',title:'Operations',stage:'5',present:function(r){var o=(data.opsData||{})[r.i]||{};return (data.launched||[]).indexOf(r.i)>=0||!!(o.health||o.launchDate||o.performance||o.notes)},fields:[
     {label:'Health',get:function(r){var o=(data.opsData||{})[r.i]||{};return o.health?lyCap(o.health):''},summary:true},
     {label:'Launch date',get:function(r){var o=(data.opsData||{})[r.i]||{};return o.launchDate?lyDate(o.launchDate):''},summary:true},
     {label:'Owner',get:function(r){var o=(data.opsData||{})[r.i]||{},e=(data.experiments||{})[r.i]||{};return o.owner||e.owner}},
     {label:'Performance vs. success metric',get:function(r){return ((data.opsData||{})[r.i]||{}).performance},summary:true},
     {label:'Ongoing notes',get:function(r){return ((data.opsData||{})[r.i]||{}).notes}}]}
  ]};
var IDEA_LAYER_INDEX={idea:0,rank:1,exploration:2,portfolio:3,capital:4,development:5,review:6,operations:7}; /* the brief layer left 17 Sep 2026: its fields had no writer */ /* the layers of LAYER_MAPS.idea by index, so a register names the layer it prints up to */
/* ══ THE PROJECT RECORD (17 Sep 2026, Paul's ruling): once an idea is a project, its record is the project card — Overview (2.4), Analyses (the gap analysis and SWOT), Budget (3.3) — then the brief, the track, the review, and operations. The idea card is superseded and does not print. Summary draws on the Overview and the budget's figures; Full adds the analyses and the budget plan ══ */
function projLayerById(id){return LAYER_MAPS.idea.layers.filter(function(l){return l.id===id})[0]}
function bpMoney(i,fn){try{if(!bpHasAny(i))return '';var v=fn(i);return v?fmtMoney(v):''}catch(e){return ''}}
function bpSteps(i,k){var p=bpGet(i)||{};return (p[k]||[]).filter(function(st){return st&&(st.name||st.cost)}).map(function(st){return (st.name||'Unnamed')+(st.from&&st.to?' \u2014 months '+st.from+'\u2013'+st.to:'')+(st.cost?' \u2014 '+st.cost:'')})}
function bpSusLines(i){var p=bpGet(i)||{};return (p.sus||[]).filter(function(ph){return ph&&ph.name}).map(function(ph){var items=(ph.items||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return x.name+(x.cost?' '+x.cost:'')});return ph.name+(ph.from?' \u2014 from month '+ph.from+(ph.to&&ph.to!=='ongoing'?' to '+ph.to:', ongoing'):'')+(items.length?': '+items.join('; '):'')})}
function gapNames(i,cat,have){var g=gapItemsOf(i);return (g[cat]||[]).filter(function(x){return !!x.have===have}).map(function(x){return x.name})}
LAYER_MAPS.project={
  identity:function(r){var d=(data.ideas||[])[r.i]||{},pb=(data.portfolio||{})[r.i]||{};return {title:d.name||'Unnamed project',score:'',meta:[d.dept||'',IDEA_HORIZON_LABELS[pb.horizon]||'',ideaStageWord(r.i)].filter(Boolean)}},
  layers:[
   {id:'overview',title:'Overview',stage:'2.4',present:function(r){var p=(data.projects||{})[r.i]||{};return !!(p.viable===true||p.viable===false||p.objectives||p.deliverables||p.timeline||p.noGoR)},fields:[
     {label:'Verdict',get:function(r){var p=(data.projects||{})[r.i]||{};return p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided'},summary:true},
     {label:'No-Go reason',get:function(r){return ((data.projects||{})[r.i]||{}).noGoR},summary:true},
     {label:'Objectives',get:function(r){return ((data.projects||{})[r.i]||{}).objectives},summary:true},
     {label:'Deliverables',get:function(r){return ((data.projects||{})[r.i]||{}).deliverables},summary:true},
     {label:'Timeline',get:function(r){return ((data.projects||{})[r.i]||{}).timeline},summary:true},
     {label:'Resources',get:function(r){return ((data.projects||{})[r.i]||{}).resources}},
     {label:'Key risks',get:function(r){return ((data.projects||{})[r.i]||{}).risks}},
     {label:'Success metrics',get:function(r){return ((data.projects||{})[r.i]||{}).metrics}},
     {label:'Internal partners',get:function(r){return ((data.projects||{})[r.i]||{}).partInt}},
     {label:'External partners',get:function(r){return ((data.projects||{})[r.i]||{}).partExt}}]},
   projLayerById('portfolio'),
   {id:'analyses',title:'Analyses',stage:'3.2',present:function(r){var g=gapItemsOf(r.i),sw=((data.projects||{})[r.i]||{}).swot||{};return ['skills','resources','technology'].some(function(c){return (g[c]||[]).length})||['strengths','weaknesses','opportunities','threats'].some(function(k){return sw[k]})},fields:[
     {label:'Skills we have',list:true,get:function(r){return gapNames(r.i,'skills',true)}},
     {label:'Skills gap',list:true,get:function(r){return gapNames(r.i,'skills',false)}},
     {label:'Resources we have',list:true,get:function(r){return gapNames(r.i,'resources',true)}},
     {label:'Resources gap',list:true,get:function(r){return gapNames(r.i,'resources',false)}},
     {label:'Technology we have',list:true,get:function(r){return gapNames(r.i,'technology',true)}},
     {label:'Technology gap',list:true,get:function(r){return gapNames(r.i,'technology',false)}},
     {label:'Strengths',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).strengths}},
     {label:'Weaknesses',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).weaknesses}},
     {label:'Opportunities',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).opportunities}},
     {label:'Threats',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).threats}}]},
   {id:'budget',title:'Budget',stage:'3.3',present:function(r){var p=(data.projects||{})[r.i]||{};return bpHasAny(r.i)||!!(p.startupCost||p.rolloutCost||p.runningCost)},fields:[
     {label:'Lifetime cost',get:function(r){return bpMoney(r.i,bpLifetime)},summary:true},
     {label:'Development costs',get:function(r){return bpMoney(r.i,bpDevTotal)||((data.projects||{})[r.i]||{}).startupCost},summary:true},
     {label:'Rollout costs',get:function(r){return bpMoney(r.i,bpRollTotal)||((data.projects||{})[r.i]||{}).rolloutCost},summary:true},
     {label:'Annual sustainment costs',get:function(r){return bpMoney(r.i,bpSusSteady)||((data.projects||{})[r.i]||{}).runningCost},summary:true},
     {label:'Estimated project lifetime',get:function(r){var b=bpGet(r.i)||{};return b.horizon?b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):''}},
     {label:'Contingency',get:function(r){var b=bpGet(r.i)||{};return b.contingency?b.contingency+'%':''}},
     {label:'Development phases',list:true,get:function(r){return bpSteps(r.i,'dev')}},
     {label:'Rollout steps',list:true,get:function(r){return bpSteps(r.i,'roll')}},
     {label:'Sustainment',list:true,get:function(r){return bpSusLines(r.i)}}]},
   projLayerById('development'),projLayerById('review'),projLayerById('operations')
  ]};
var PROJECT_LAYER_INDEX={overview:0,portfolio:1,analyses:2,budget:3,development:4,review:5,operations:6};
/* ══ THE PROJECT ON PAPER AS CARDS (17 Sep 2026, Paul's ruling for the Exploration Portfolio): Summary prints each project's Overview card whole — every line — with the verdict and the Filter & Rank score right-justified on the name bar; Full gives each project two pages: the Overview card, the Analyses card (the gap analysis closed up, then the SWOT), and the portfolio position on the first; the budget on the second, with rollout steps and sustainment beside the development phases ══ */
var PC_LBL='font-family:var(--mono,monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#555;margin:0 0 2px';
function pcText(v,size){var t=lyText(v);return '<div style="font-size:'+(size||11.5)+'px;line-height:1.4;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div>'}
function projCardBar(i){var d=(data.ideas||[])[i]||{},p=(data.projects||{})[i]||{};var verdict=p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided';var sc=triageScore(i);
  return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 14px;border-bottom:1px solid #ddd;background:#f4f4f4;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div><span style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111">'+esc(d.name||'Unnamed project')+'</span>'+(d.dept?'<span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(d.dept)+'</span>':'')+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#111;white-space:nowrap">'+verdict+(sc?' \u00b7 '+sc+' / 50':'')+'</div></div>'}
function projStatBand(i,large){if(!bpHasAny(i))return ''; /* 17 Sep 2026 (Paul's ruling): the figures are 26px and blue on the Full card only; Summary keeps the smaller black form, or they dominate its page */var H=bpHorizon(i),life=bpLifetime(i),pk=bpPeakMonth(i),fo=bpFirstOpMonth(i),ssv=bpSusSteady(i);var mm=bpMonthly(i);var pkV=pk?Math.round(mm[pk-1].dev+mm[pk-1].roll+mm[pk-1].sus):0;var ct=parseFloat((bpGet(i)||{}).contingency)||0;
  var big=function(v,l,sub){return '<td style="text-align:center;padding:'+(large?'9px':'8px')+' 6px 6px;vertical-align:top"><div style="'+(large?'font-size:26px;font-weight:800;color:var(--ph2-t)':'font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111')+';line-height:1.1">'+v+'</div><div style="font-size:10.5px;color:#333;margin-top:2px">'+l+'</div>'+(sub?'<div style="font-size:9.5px;color:#777">'+sub+'</div>':'')+'</td>'};
  var h='<table style="width:100%;border-collapse:collapse;border-bottom:1px solid #eee"><tr>'+big(fmtMoney(life),'Lifetime cost','across '+H+' years')+big(fmtMoney(bpDevTotal(i)),'Development costs','')+big(fmtMoney(bpRollTotal(i)),'Rollout costs','')+big(ssv?fmtMoney(ssv):'\u2014','Annual sustainment costs','')+'</tr></table>';
  var l1=[];if(ct>0)l1.push('With '+ct+'% contingency: '+fmtMoney(Math.round(life*(1+ct/100)))+' lifetime.');if(fo)l1.push('First operational month: Month '+fo+'.');
  var lines=(l1.length?'<div>'+l1.join(' \u00b7 ')+'</div>':'')+(pk?'<div>Monthly costs peak at Month '+pk+': '+fmtMoney(pkV)+' per month.</div>':'');
  return h+(lines?'<div style="padding:6px 14px 2px;font-size:11.5px;line-height:1.5;color:#111;border-bottom:1px solid #eee">'+lines+'</div>':'')} /* 17 Sep 2026 (Paul's ruling): the Overview card's numbers, as the page's stat band gives them \u2014 the four figures, then contingency and first operational month on one line, the peak month on the next */
function projOverviewCard(i,big){var p=(data.projects||{})[i]||{};var F=[['Objectives',p.objectives],['Deliverables',p.deliverables],['Timeline',p.timeline],['Resources',p.resources],['Key risks',p.risks],['Success metrics',p.metrics],['Internal partners',p.partInt],['External partners',p.partExt]];
  var cells=F.map(function(f){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</td>'});var rows='';for(var k=0;k<cells.length;k+=2)rows+='<tr>'+cells[k]+cells[k+1]+'</tr>';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden">'+projCardBar(i)+projStatBand(i,big)+(p.noGoR?'<div style="padding:6px 14px 0"><div style="'+PC_LBL+'">No-Go reason</div>'+pcText(p.noGoR)+'</div>':'')+'<table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table></div>'}
function projAnalysesCard(i){var p=(data.projects||{})[i]||{},g=gapItemsOf(i),sw=p.swot||{};var gAny=['skills','resources','technology'].some(function(c){return (g[c]||[]).length}),sAny=['strengths','weaknesses','opportunities','threats'].some(function(k){return sw[k]});
  var h='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111;margin:0 0 6px">Analyses</div>';
  if(!gAny&&!sAny)return h+'<div style="font-size:11.5px;color:#888;font-style:italic">No analyses recorded yet.</div></div>';
  if(gAny){h+='<div style="'+PC_LBL+'">Gap analysis</div><table style="width:100%;border-collapse:collapse;margin:0 0 8px"><tbody>'+[['Skills','skills'],['Resources','resources'],['Technology','technology']].map(function(c){var its=g[c[1]]||[];if(!its.length)return '';var hv=its.filter(function(x){return x.have}).map(function(x){return esc(x.name)}),gp=its.filter(function(x){return !x.have}).map(function(x){return esc(x.name)});return '<tr><td style="width:22%;padding:3px 0;font-size:11.5px;font-weight:700;color:#111;vertical-align:top;border-bottom:1px solid #eee">'+c[0]+'</td><td style="width:39%;padding:3px 8px 3px 0;font-size:11px;line-height:1.3;vertical-align:top;border-bottom:1px solid #eee"><span style="color:#1B6B5A;font-weight:700">Have:</span> '+(hv.length?hv.join(', '):'\u2014')+'</td><td style="width:39%;padding:3px 0;font-size:11px;line-height:1.3;vertical-align:top;border-bottom:1px solid #eee;color:'+(gp.length?'#B8860B':'#111')+'"><span style="color:#B8860B;font-weight:700">Gap:</span> '+(gp.length?gp.join(', '):'\u2014')+'</td></tr>' /* 17 Sep 2026 (Paul's ruling): colour on the gap analysis \u2014 gaps in the page's amber, what is in hand in green */}).join('')+'</tbody></table>'}
  if(sAny){var Q=[{k:'strengths',l:'+ Strengths',c:'#1B6B5A',bg:'rgba(27,107,90,.10)'},{k:'weaknesses',l:'\u2212 Weaknesses',c:'#C25B73',bg:'rgba(155,45,63,.08)'},{k:'opportunities',l:'\u25c9 Opportunities',c:'#2D5A8E',bg:'rgba(45,90,142,.10)'},{k:'threats',l:'\u25b3 Threats',c:'#D4A017',bg:'rgba(139,94,60,.10)'}]; /* the page's four tints and label colours (17 Sep 2026, Paul's ruling: colour throughout this report, as on screen) */
  var qcell=function(q){return '<td style="width:50%;vertical-align:top;background:'+q.bg+';border-radius:5px;padding:7px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:'+q.c+';margin-bottom:3px">'+q.l+'</div>'+pcText(sw[q.k],11)+'</td>'};
  h+='<div style="'+PC_LBL+'">SWOT</div><table style="width:100%;border-collapse:separate;border-spacing:4px 4px;margin:0 -4px"><tr>'+qcell(Q[0])+qcell(Q[1])+'</tr><tr>'+qcell(Q[2])+qcell(Q[3])+'</tr></table>'}
  return h+'</div>'}
function projPositionBlock(i){var pb=(data.portfolio||{})[i]||{};var placed=!!(pb.horizon||pb.risk||pb.reward||pb.notes);
  var h='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111;margin:0 0 6px">Portfolio Position</div>';
  if(!placed)return h+'<div style="font-size:11.5px;color:#888;font-style:italic">Not yet placed in the portfolio (Step 3.1).</div></div>';
  var cell=function(l,v){return '<td style="width:33%;vertical-align:top;padding:2px 8px 2px 0"><div style="'+PC_LBL+'">'+l+'</div>'+pcText(v)+'</td>'};
  return h+'<table style="width:100%;border-collapse:collapse"><tr>'+cell('Horizon',IDEA_HORIZON_LABELS[pb.horizon]||(pb.horizon?lyCap(pb.horizon):''))+cell('Risk',pb.risk?lyCap(pb.risk):'')+cell('Reward',pb.reward?lyCap(pb.reward):'')+'</tr></table>'+(pb.notes?'<div style="margin-top:6px"><div style="'+PC_LBL+'">Notes</div>'+pcText(pb.notes)+'</div>':'')+'</div>'}
function projBudgetPage(i,opts){opts=opts||{};var d=(data.ideas||[])[i]||{},p=(data.projects||{})[i]||{},b=bpGet(i)||{};var has=bpHasAny(i);
  var h='<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 6px;padding-bottom:4px;border-bottom:3px solid #111"><div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111">Budget</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#555">'+esc(d.name||'')+'</div></div>';
  if(!has){h+='<div style="font-size:11.5px;color:#888;font-style:italic;margin:0 0 10px">No budget plan yet (Step 3.3).</div>';if(p.startupCost||p.rolloutCost||p.runningCost)h+=erFigRow([{v:p.startupCost||'\u2014',l:'Start-up cost'},{v:p.rolloutCost||'\u2014',l:'Rollout cost'},{v:p.runningCost||'\u2014',l:'Running cost'}]);return h}
  h+='<div style="font-size:11px;color:#333;margin:0 0 6px">'+(b.horizon?'Estimated project lifetime '+b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):'')+(b.contingency?(b.horizon?' \u00b7 ':'')+'Contingency '+b.contingency+'%':'')+'</div>';
  var th=function(t){return '<th style="text-align:left;padding:2px 4px;font-family:var(--mono,monospace);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v,extra){return '<td style="padding:2px 4px;font-size:10px;line-height:1.25;vertical-align:top;border-bottom:1px solid #eee;'+(extra||'')+'">'+v+'</td>'};
  var steps=function(list,withDesc){return (list||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return '<tr>'+td(esc(x.name||'Unnamed')+(withDesc&&x.desc?'<div style="color:#666;font-size:9px">'+esc(x.desc)+'</div>':''))+td(x.from&&x.to?esc(x.from+'\u2013'+x.to):'','white-space:nowrap')+td(esc(x.cost||''),'white-space:nowrap;text-align:right')+'</tr>'}).join('')};
  var left='<div style="'+PC_LBL+'">Development phases</div><table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Phase')+th('Months')+th('Cost')+'</tr></thead><tbody>'+(steps(b.dev,true)||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var rollout='<div style="'+PC_LBL+'">Rollout steps</div><table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Step')+th('Months')+th('Cost')+'</tr></thead><tbody>'+(steps(b.roll,false)||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var sus='<div style="'+PC_LBL+'">Sustainment</div><table style="width:100%;border-collapse:collapse"><thead><tr>'+th('Phase')+th('From')+th('Annual items')+'</tr></thead><tbody>'+((b.sus||[]).filter(function(ph){return ph&&ph.name}).map(function(ph){var items=(ph.items||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return esc(x.name||'')+(x.cost?' <span style="color:#555">'+esc(x.cost)+'</span>':'')}).join('<br>');return '<tr>'+td(esc(ph.name))+td(ph.from?'Month '+esc(ph.from)+(ph.to&&ph.to!=='ongoing'?'\u2013'+esc(ph.to):', ongoing'):'','white-space:nowrap')+td(items||'\u2014')+'</tr>'}).join('')||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var box=function(title,svg,cap,extra){var inner=String(svg||'').replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/<svg /g,'<svg style="width:100%;height:auto;max-height:'+cap+'px;display:block" ').replace(/class="t-faint-sm"/g,'style="font-size:9px;color:#777"');return inner?'<div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px 6px;margin:0 0 6px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono,monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#333;margin:0 0 2px">'+title+'</div>'+inner+(extra||'')+'</div>':''}; /* 17 Sep 2026 (Paul's rulings): each chart in its own box, its height capped so the page holds; the charts print in colour without their zoom buttons */
  h+=box('Monthly spend shape',bpChartShape(i),118,String(bpChartLegend()).replace(/class="t-faint-sm"/g,'style="font-size:9px;color:#777"'))+box('Step timeline',bpChartLanes(i),84)+box('How the lifetime total builds',bpChartWaterfall(i),128)+box('Cumulative cost \u2014 lifetime, including ongoing sustainment',bpChartCum(i),118);
  if(opts.noDevPhases)h+='<table style="width:100%;border-collapse:separate;border-spacing:0;margin-top:4px"><tr><td style="width:45%;vertical-align:top;padding:0 8px 0 0">'+rollout+'</td><td style="width:55%;vertical-align:top;padding:0 0 0 8px;border-left:1px solid #ddd">'+sus+'</td></tr></table>'; /* 17 Sep 2026 (Paul's ruling): where the development card already lists the phases, the budget page shows rollout and sustainment only */
  else h+='<table style="width:100%;border-collapse:separate;border-spacing:0;margin-top:4px"><tr><td style="width:36%;vertical-align:top;padding:0 8px 0 0">'+left+'</td><td style="width:30%;vertical-align:top;padding:0 8px;border-left:1px solid #ddd">'+rollout+'</td><td style="width:34%;vertical-align:top;padding:0 0 0 8px;border-left:1px solid #ddd">'+sus+'</td></tr></table>'; /* the three tables side by side, so the page closes up */
  return h}
function projectCardPages(i,depth,lead){var full=(depth==='full');var keepWith=function(head,card){return head?'<div style="break-inside:avoid;page-break-inside:avoid">'+head+card+'</div>':card}; /* a heading and its first card are one block */
  if(!full)return keepWith(lead,projOverviewCard(i,false));
  var page1='<div style="break-before:page;page-break-before:always">'+keepWith(lead,projOverviewCard(i,true))+projAnalysesCard(i)+projPositionBlock(i);
  if(!bpHasAny(i))return page1+'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div></div>'; /* 17 Sep 2026 (Paul's ruling): no empty budget page \u2014 a line under the portfolio position instead */
  return page1+'</div><div style="break-before:page;page-break-before:always">'+projBudgetPage(i)+'</div>'}
function projectCardGroups(groups,depth,docHead){var out='',first=true;groups.forEach(function(g){g.list.forEach(function(r,k){var lead=(first?(docHead||''):'')+(k===0?erHead(g.name,g.list.length+' project'+(g.list.length===1?'':'s')):'');out+=projectCardPages(r.i,depth,lead);first=false})});return depth==='full'?out:'<div style="break-before:page;page-break-before:always">'+out+'</div>'} /* the document's own heading rides on the first project's page; at Summary the cards flow on a page of their own */
/* ══ THE LATER STAGES ON PAPER (17 Sep 2026, Paul's ruling: the signed-off Exploration form applied to the remaining registers). Each program's stage card mirrors its page's read-only cards — the development brief and track, the review decision, the operations record — with the status or health coloured as the page colours it. Full adds the Exploration pages: overview, analyses, and position, then the budget where there is a plan ══ */
var STATUS_COLORS={complete:'#1B6B5A',running:'#2D5A8E',alive:'#2D5A8E',killed:'#9B2D3F',dead:'#9B2D3F',paused:'#8B5E3C',dormant:'#8B5E3C'};
var HEALTH_COLORS={green:'#1B6B5A',amber:'#D4A017',red:'#9B2D3F'};
function projStageBar(i,kind){var d=(data.ideas||[])[i]||{},tr=(data.tracking||{})[i]||{},ops=(data.opsData||{})[i]||{};var sc=triageScore(i);var right='';
  if(kind==='ops'){var killed=tr.status==='killed';var hw=killed?'Killed':(ops.health?lyCap(ops.health):'Health not yet reported');right='<span style="color:'+(killed?'#9B2D3F':(HEALTH_COLORS[ops.health]||'#666'))+';font-weight:700">'+hw+'</span>'}
  else{right='<span style="color:'+(STATUS_COLORS[tr.status]||'#666')+';font-weight:700">'+(tr.status?lyCap(tr.status):'Not yet started')+'</span>'}
  return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 14px;border-bottom:1px solid #ddd;background:#f4f4f4;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div><span style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111">'+esc(d.name||'Unnamed project')+'</span>'+(d.dept?'<span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(d.dept)+'</span>':'')+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#111;white-space:nowrap">'+right+(sc?' \u00b7 '+sc+' / 50':'')+'</div></div>'}
function pcGrid(F){var cells=F.map(function(f){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</td>'});var rows='';for(var k=0;k<cells.length;k+=2)rows+='<tr>'+cells[k]+(cells[k+1]||'<td></td>')+'</tr>';return '<table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table>'}
function pcSub(t){return '<div style="font-family:var(--serif,Georgia,serif);font-size:13px;font-weight:700;color:#111;padding:8px 14px 0">'+t+'</div>'}
function projDevCard(i,withPosition){var p=(data.projects||{})[i]||{},tr=(data.tracking||{})[i]||{},pb=(data.portfolio||{})[i]||{};var phases=progOrdered(i);
  var money=bpHasDev(i)?'Development budget <b>'+fmtMoney(bpDevTotal(i))+'</b>'+(bpHasRoll(i)?' \u00b7 Rollout <b>'+fmtMoney(bpRollTotal(i))+'</b>':'')+(bpSusSteady(i)?' \u00b7 Sustainment <b>'+fmtMoney(bpSusSteady(i))+'</b>/yr':''):'';
  var ph=phases.length?phases.map(function(r,ix){var sp=bpStepSpan(r);return '<div style="padding:6px 14px 6px;border-top:1px solid #eee;break-inside:avoid;page-break-inside:avoid"><div style="font-size:12px;color:#111"><b>Phase '+(ix+1)+' \u2014 '+esc(r.name||'Unnamed')+'</b>'+(r.powner?' <span style="color:#555">\u00b7 '+esc(r.powner)+'</span>':'')+(sp?' <span style="color:#555">\u00b7 months '+sp[0]+'\u2013'+sp[1]+'</span>':'')+(bpStepMoney(r)?' <span style="color:#555">\u00b7 '+fmtMoney(bpStepMoney(r))+'</span>':'')+'</div>'+(r.desc?'<div style="font-size:11px;color:#555;line-height:1.35;margin-top:1px">'+esc(r.desc)+'</div>':'')+'<div style="font-size:11px;line-height:1.35;margin-top:3px"><span style="color:#666">Success metrics:</span> '+(r.pmetric?esc(r.pmetric):'\u2014')+' &nbsp;<span style="color:#666">Exit gate:</span> '+(r.pexit?esc(r.pexit):'\u2014')+(r.gateDec?' &nbsp;<span style="color:#666">Gate taken:</span> <b>'+esc(r.gateDec)+'</b>'+(r.gateAt?' <span style="color:#666">'+fmtDate(r.gateAt)+'</span>':''):'')+'</div></div>'}).join(''):'<div style="padding:4px 14px 6px;font-size:11.5px;color:#888;font-style:italic">No development phases recorded.</div>';
  var pos=withPosition?'<div style="padding:6px 14px 8px;border-top:1px solid #eee;font-size:11.5px;color:#111"><span style="color:#666">Portfolio position:</span> '+((pb.horizon||pb.risk||pb.reward)?[IDEA_HORIZON_LABELS[pb.horizon]||(pb.horizon?lyCap(pb.horizon):''),pb.risk?lyCap(pb.risk)+' risk':'',pb.reward?lyCap(pb.reward)+' reward':''].filter(Boolean).join(' \u00b7 '):'not yet placed')+'</div>':'';
  var keep='break-inside:avoid;page-break-inside:avoid';
  return '<div class="er-block" style="'+keep+';border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden"><div style="'+keep+'">'+projStageBar(i,'dev')+pcSub('Development program')+pcGrid([['Objectives',p.objectives],['Deliverables',p.deliverables]])+(money?'<div style="padding:2px 14px 8px;font-size:11.5px;color:#111">'+money+'</div>':'')+'<div style="'+PC_LBL+';padding:4px 14px 2px">Program phases</div></div>'+ph+'<div style="'+keep+'">'+pcSub('Development track')+pcGrid([['Results to date',tr.results],['Infrastructure learnings',tr.infraLearnings||tr.learnings],['What\u2019s breaking / working',tr.breakWork]])+pos+'<div style="height:6px"></div></div></div>'} /* 17 Sep 2026 (Paul's finding: headings stranded): the card flows across pages like a long record \u2014 the bar with the program, each phase, and the track each stay whole, so the headings above are followed by the first program */ /* 17 Sep 2026 (Paul's ruling): the development card carries what the module records \u2014 Step 3.4\u2019s program (objectives, deliverables, the budget from the plan, each phase with its owner, months, budget, description, success metrics, exit gate criteria, and the gate taken) and the Development Portfolio page\u2019s track (status, results to date, learnings, what\u2019s breaking / working). The experiment brief it replaced was a retired design that only the seed still filled */
function projReviewBlock(i){var it=((data.review||{}).items||{})[i]||{};var col={buy:'#1B6B5A',hold:'#8B5E3C',sell:'#9B2D3F'}[it.decision]||'#888';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111">Portfolio Review</div><div style="font-family:var(--mono,monospace);font-size:12px;font-weight:700;color:'+col+'">'+(it.decision?lyCap(it.decision):'Not yet reviewed')+'</div></div>'+(it.note?pcText(it.note):'')+'</div>'}
function projOpsCard(i){var ops=(data.opsData||{})[i]||{},p=(data.projects||{})[i]||{};var roll=bpHasRoll(i)?fmtMoney(bpRollTotal(i)):(ops.rolloutCost||p.rolloutCost||''),sus=bpSusSteady(i)?fmtMoney(bpSusSteady(i))+'/yr':(ops.runningCost||p.runningCost||'');
  var cell=function(l,v,right){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px;'+(right?'text-align:right':'')+'"><div style="'+PC_LBL+'">'+l+'</div>'+pcText(v)+'</td>'};
  var corners='<table style="width:100%;border-collapse:collapse"><tbody><tr>'+cell('Owner',ops.owner||((progOrdered(i)[0]||{}).powner)||'')+cell('Launch date',ops.launchDate?lyDate(ops.launchDate):'',true)+'</tr><tr>'+cell('Rollout costs',roll)+cell('Annual sustainment cost',sus,true)+'</tr></tbody></table>';
  var rest=[['Success metrics',p.metrics],['Performance vs. success metric',ops.performance],['Ongoing notes',ops.notes]].map(function(f){return '<div style="padding:6px 14px 8px;border-top:1px solid #eee"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</div>'}).join('');
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden">'+projStageBar(i,'ops')+corners+rest+'<div style="height:6px"></div></div>'} /* 17 Sep 2026 (Paul's ruling): owner top left, launch date top right, rollout costs bottom left, annual sustainment cost bottom right (from the budget plan), the rest below */
function projectPagesFor(i,depth,lead,stage){var full=(depth==='full');var keepWith=function(head,card){return head?'<div style="break-inside:avoid;page-break-inside:avoid">'+head+card+'</div>':card}; /* a heading and its first card are one block */
  if(stage==='ops'){var opsCard=projOpsCard(i);if(!full)return keepWith(lead,opsCard);
    var pageP='<div style="break-before:page;page-break-before:always">'+projOverviewCard(i,true)+projAnalysesCard(i)+projPositionBlock(i)+(bpHasAny(i)?'':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div>')+'</div>'+(bpHasAny(i)?'<div style="break-before:page;page-break-before:always">'+projBudgetPage(i,{noDevPhases:true})+'</div>':'');
    return '<div style="break-before:page;page-break-before:always">'+keepWith(lead,opsCard)+'</div>'+pageP+'<div style="break-before:page;page-break-before:always">'+projDevCard(i,false)+'</div>'} /* 17 Sep 2026 (Paul's ruling): Operational Full is the operations page, then the project pages, then the development page */
  var devCard=projDevCard(i,!full)+(stage==='updated'?projReviewBlock(i):'');
  if(!full)return keepWith(lead,devCard);
  var pageB='<div style="break-before:page;page-break-before:always">'+projOverviewCard(i,true)+projAnalysesCard(i)+projPositionBlock(i)+(bpHasAny(i)?'':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div>')+'</div>';
  return '<div style="break-before:page;page-break-before:always">'+keepWith(lead,devCard)+'</div>'+pageB+(bpHasAny(i)?'<div style="break-before:page;page-break-before:always">'+projBudgetPage(i,{noDevPhases:true})+'</div>':'')}
function projectStageGroups(groups,depth,docHead,stage,noHeads){var out='',first=true;groups.forEach(function(g){g.list.forEach(function(r,k){var lead=noHeads?'':(first?(docHead||''):'')+(k===0?erHead(g.name,g.list.length+' program'+(g.list.length===1?'':'s')):'');out+=projectPagesFor(r.i,depth,lead,stage);first=false})});return depth==='full'?out:'<div style="break-before:page;page-break-before:always">'+out+'</div>'} /* 17 Sep 2026 (Paul's ruling, restated): cards stay whole; a heading rides its first card as one block (projectPagesFor); only a card longer than a page can spill, and that cannot be helped */
/* ══ THE PORTFOLIO REVIEW (17 Sep 2026, Paul's ruling): Ignite's third output, distilled from Step 4.4 — the Buy, Hold, or Sell call on every live initiative with its reasons, the capital and the balance after the decisions, the five learnings, and the history of closed cycles. One version; the page is a read-only report of the same ══ */
var RV_COLORS={buy:'#1B6B5A',hold:'#8B5E3C',sell:'#9B2D3F'};
function portfolioReviewModel(){var ideas=data.ideas||[],exSel=data.expSelected||[],trk=data.tracking||{},rev=data.review||{},launched=data.launched||[];
  var items=exSel.filter(function(i){return !isArchived(i)}).concat(launched.filter(function(i){return !isArchived(i)&&exSel.indexOf(i)<0})).concat((data.selected||[]).filter(function(i){return !isArchived(i)&&exSel.indexOf(i)<0&&launched.indexOf(i)<0&&(data.projects||{})[i]&&(data.projects||{})[i].viable===true})); /* the review's own set, as renderReviewSurface draws it */
  var stage=function(i){return launched.indexOf(i)>=0?'Operational':exSel.indexOf(i)>=0?'In development':'Exploration'};
  var recs=items.map(function(i){var ri=(rev.items||{})[i]||{};var c=projCosts(i);return {i:i,name:(ideas[i]||{}).name||'',dept:(ideas[i]||{}).dept||'',stage:stage(i),decision:ri.decision||'',rationale:ri.rationale||'',start:c.start,run:c.run,killed:(trk[i]||{}).status==='killed'}});
  var by=function(d){return recs.filter(function(r){return r.decision===d})};var groups=[{name:'Buy',key:'buy',list:by('buy')},{name:'Hold',key:'hold',list:by('hold')},{name:'Sell',key:'sell',list:by('sell')},{name:'Not yet decided',key:'',list:recs.filter(function(r){return !r.decision})}].filter(function(g){return g.list.length});
  var yN=1,yr=null;try{var eff=new Date(new Date().getFullYear(),new Date().getMonth()+1,1);var ps=(data.capital||{}).periodStart?new Date((data.capital||{}).periodStart):null;yN=ps?Math.max(1,Math.min(envYearsOf(),Math.floor(((eff.getFullYear()*12+eff.getMonth())-(ps.getFullYear()*12+ps.getMonth()))/12)+1)):1;var yts=orgYearTotals();yr=yts&&yts[yN-1]?yts[yN-1]:null}catch(e){yr=null}
  var learn=[['New opportunities',rev.newOpportunities],['Balance assessment',rev.balance],['What worked?',rev.worked],['What didn\u2019t?',rev.didnt],['Changes for next cycle?',rev.nextCycle]];
  return {items:items,recs:recs,groups:groups,decided:recs.filter(function(r){return r.decision}).length,buy:by('buy').length,hold:by('hold').length,sell:by('sell').length,yN:yN,yr:yr,balItems:items.filter(function(i){return (trk[i]||{}).status!=='killed'}),learn:learn,cycles:data.reviewCycles||[],complete:!!(data.completedSteps||{})['4.4']}}
function rvDecisionCard(r){var col=RV_COLORS[r.decision]||'#888';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-left:4px solid '+col+';border-radius:6px;margin:0 0 10px;padding:9px 14px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><div><span style="font-family:var(--serif,Georgia,serif);font-size:15px;font-weight:700;color:#111'+(r.killed?';text-decoration:line-through':'')+'">'+esc(r.name)+'</span><span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(r.stage)+(r.dept?' \u00b7 '+esc(r.dept):'')+'</span></div><div style="font-family:var(--mono,monospace);font-size:11px;white-space:nowrap"><span style="color:'+col+';font-weight:700">'+(RV_WORDS[r.decision]||'Not yet decided')+'</span><span style="color:#555"> \u00b7 start '+fmtMoney(r.start)+' \u00b7 run '+fmtMoney(r.run)+'/yr</span></div></div>'+(r.rationale?'<div style="margin-top:6px;font-size:12.5px;line-height:1.5;color:#111;padding:8px 12px;border-left:3px solid #07 6D9E55;background:rgba(7,109,158,.06);white-space:pre-line;-webkit-print-color-adjust:exact;print-color-adjust:exact">'.replace('#07 6D9E55','#076D9E55')+esc(r.rationale)+'</div>':'<div style="margin-top:6px;font-size:12px;color:#888;font-style:italic">No rationale recorded.</div>')+'</div>'}
function portfolioReviewDoc(){var M=portfolioReviewModel();
  var h=printDocCover('Portfolio Review','The first quarterly review of the live portfolio: the Buy, Hold, or Sell call on every initiative with its reasons, the portfolio\u2019s balance and capital after the decisions, and what the quarter taught.',M.decided+' of '+M.items.length+' decided');
  h+=erBlock(erHead('At a Glance',M.complete?'':M.decided+' of '+M.items.length+' initiatives decided \u2014 the review is still open')+erFigRow([{v:M.items.length,l:'Initiatives reviewed'},{v:M.buy,l:'Buy',col:'#1B6B5A',vcol:'#1B6B5A'},{v:M.hold,l:'Hold',col:'#8B5E3C',vcol:'#8B5E3C'},{v:M.sell,l:'Sell',col:'#9B2D3F',vcol:'#9B2D3F'}]));
  if(M.yr)h+=erBlock(erHead('Capital After the Decisions','Year '+M.yN+' of the planning window, as the calendar stands')+erFigRow([{v:fmtMoney(M.yr.total),l:'Committed, Year '+M.yN},{v:fmtMoney(M.yr.budget),l:'Budget, Year '+M.yN},{v:fmtMoney(M.yr.headroom),l:'Headroom',col:M.yr.headroom<0?'#9B2D3F':'#1B6B5A',vcol:M.yr.headroom<0?'#9B2D3F':'#1B6B5A'}]));
  h+=erHeadLg('The Decisions','')+M.groups.map(function(g){var cards=g.list.map(rvDecisionCard);return '<div style="break-inside:avoid;page-break-inside:avoid">'+erHead(g.name,g.list.length+' initiative'+(g.list.length===1?'':'s'))+(cards[0]||'')+'</div>'+cards.slice(1).join('')}).join(''); /* 17 Sep 2026 (Paul's rulings): the decisions follow the capital on the same page; a group\u2019s heading and its first initiative are one block, never split */
  h+=ideaBalanceBlock(M.balItems,'rb44','Portfolio Balance After the Review');
  h+=erBlock(erHead('Portfolio Learnings','What the quarter taught')+M.learn.map(function(l){var t=lyText(l[1]);return '<div style="margin:0 0 12px"><div style="'+PC_LBL+'">'+l[0]+'</div><div style="font-size:13px;line-height:1.55;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'}).join('')+'<div style="height:8px"></div>'); /* 17 Sep 2026 (Paul's ruling): plain labelled text, not the quoted form */
  if(M.cycles.length){var th=function(t){return '<th style="text-align:left;padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee">'+v+'</td>'};
    h+=erBlock(erHead('Review History',M.cycles.length+' closed cycle'+(M.cycles.length===1?'':'s'))+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+th('Closed')+th('Buy')+th('Hold')+th('Sell')+'</tr></thead><tbody>'+M.cycles.slice().reverse().map(function(cy){var it=(cy.review||{}).items||{};var n=function(d){return Object.keys(it).filter(function(k){return it[k].decision===d}).length};return '<tr>'+td(fmtDate(cy.at))+td(n('buy'))+td(n('hold'))+td(n('sell'))+'</tr>'}).join('')+'</tbody></table>')}
  return h}
function renderOutPortfolioReview(){var M=portfolioReviewModel();
  var fig=function(v,l,c){return '<div class="t-center" style="flex:1;min-width:110px"><div class="score-num-md" style="font-size:26px'+(c?';color:'+c:'')+'">'+v+'</div><div class="fs-13" style="margin-top:3px">'+l+'</div></div>'};
  var h='<div class="flx-between-top-mb"><div>'+badge('Phase 4 Output','#9B2D3F')+'<h2 class="h-big">Portfolio Review</h2><p class="t-stone-sm">The first quarterly review, distilled from Step 4.4 \u2014 read-only; the decisions are taken there.</p></div>'+pdfBtn('printCurrentOutput()')+'</div>';
  h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(M.items.length,'Initiatives reviewed')+fig(M.buy,'Buy','#1B6B5A')+fig(M.hold,'Hold','#8B5E3C')+fig(M.sell,'Sell','#9B2D3F')+'</div>'+(M.complete?'':'<p class="t-faint-sm" style="margin:10px 0 0">'+M.decided+' of '+M.items.length+' decided \u2014 the review is still open at Step 4.4.</p>'),'margin-bottom:16px');
  if(M.yr)h+=card('<h3 class="h-sub-md">Capital After the Decisions</h3><div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(fmtMoney(M.yr.total),'Committed, Year '+M.yN)+fig(fmtMoney(M.yr.budget),'Budget, Year '+M.yN)+fig(fmtMoney(M.yr.headroom),'Headroom',M.yr.headroom<0?'#9B2D3F':'#1B6B5A')+'</div>','margin-bottom:16px');
  M.groups.forEach(function(g){h+='<h3 class="h-sub-lg" style="margin:6px 0 10px">'+g.name+' <span class="t-faint-sm" style="font-weight:400">('+g.list.length+')</span></h3>'+g.list.map(function(r){var col=RV_COLORS[r.decision]||'rgba(var(--faint-rgb),.5)';return card('<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap"><div><h4 class="h-card" style="margin:0;display:inline'+(r.killed?';text-decoration:line-through;color:#9B2D3F':'')+'">'+esc(r.name)+'</h4> '+badge(r.stage,r.stage==='Operational'?'#1B6B5A':r.stage==='In development'?'#2D5A8E':'rgba(var(--faint-rgb),.5)')+'</div><span class="t-faint-sm">start '+fmtMoney(r.start)+' \u00b7 run '+fmtMoney(r.run)+'/yr</span></div>'+(r.rationale?'<p class="fs-13" style="margin:8px 0 0;color:var(--text-muted);line-height:1.55">'+esc(r.rationale)+'</p>':'<p class="t-faint-sm" style="margin:8px 0 0">No rationale recorded.</p>'),'margin-bottom:10px;border-left:4px solid '+col)}).join('')});
  h+=card('<h3 class="h-sub-lg">Portfolio Learnings</h3>'+M.learn.map(function(l){return '<div style="margin:0 0 12px"><div class="u-b25d981" style="margin-bottom:3px">'+l[0]+'</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55;white-space:pre-line">'+(l[1]?esc(l[1]):'<span class="t-faint">Not yet written</span>')+'</div></div>'}).join(''),'margin-bottom:16px');
  return h}
/* ══ THE LIVE PAGES FROM THE DASHBOARD (17 Sep 2026, Paul's ruling): running a review or opening a portfolio from the dashboard never returns to a step page. The Quarterly Review page mounts the shared review surface — one state with Step 4.4 — under its own heading, and prints the Portfolio Review; the portfolio pages mount the same renderers as the outputs, so a change on either is the same change ══ */
function renderReviewPage(){var h='<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
  h+='<div class="mb-6" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div>'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Quarterly <em>Portfolio Review</em></h1><p class="u-98b80d8">Every live initiative: Buy, Hold, or Sell, with the reason. Decisions made here are the same decisions as at Step 4.4.</p></div>'+'<div style="margin-top:8px">'+pdfBtn('printCurrentPage()')+'</div>'+'</div>';
  h+=renderReviewSurface();
  return h+'</div></div></div>'}
var PORTFOLIO_PAGES={'out-bluesky':function(){return renderOutBluesky()},'out-explore':function(){return renderOutExploreEnhanced()},'out-expbriefs':function(){return renderOutExpbriefsFull()},'out-oper':function(){return renderOutOperFull()}};
function renderPortfolioPage(){var id=currentStep;var fn=PORTFOLIO_PAGES[id];var h='<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
  h+='<div class="mb-3">'+badge('Ongoing','#6B4C8A')+' <span class="t-faint-sm">Live portfolio \u2014 the same record as the output page, from the dashboard</span></div>';
  h+=fn?fn():card('<p class="t-faint">No portfolio at this address.</p>');
  return h+'</div></div></div>'}
function outcomeNameOf(id){var nm=id;PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(o.id===id)nm=o.name})});if(id==='out-devport')nm='Development Portfolio';if(id==='out-expbriefs')nm='Development Portfolio';return nm} /* an output's name as the sidebar gives it (Part I §2); the development portfolio's two ids and the post-review portfolio spelled out */
var DEPTHED_OUTPUTS={'out-bluesky':1,'out-explore':1,'out-expbriefs':1,'out-devport':1,'out-oper':1,'out-report':1}; /* the Portfolio Review is one document */ /* Org Readiness left the list 17 Sep 2026: one definitive version */ /* the register documents offer Summary / Full (Part I §5) */
/* ══ THE REGISTER DOCUMENTS (16 Sep 2026): the five portfolio outputs print as registers of the idea record, each up to its own stage, grouped as its page groups. Composed for paper: a cover, a row of figures, then the register ══ */
var PRINT_DOCS={ /* 17 Sep 2026 (Paul's ruling): the Blue Sky register prints the idea record (the idea card and its ranking); the four project registers print the project record — the idea card is superseded once an idea is a project, and the record is the project card's overview, analyses, and budget, then its brief, track, review, and operations */
 'out-bluesky':function(){var st=getStages(),ideas=data.ideas||[],depth=(UI.printDepth||'summary');var all=st.bluesky;var now=all.filter(function(i){return (ideas[i]||{}).when!=='future'}),fut=all.filter(function(i){return (ideas[i]||{}).when==='future'});
   var q=function(i){return ideaQual(i).state};var ranked=now.filter(function(i){return q(i)==='pass'}).sort(function(a,b){return triageScore(b)-triageScore(a)}),partly=now.filter(function(i){return q(i)==='partial'||q(i)==='none'}),disq=now.filter(function(i){return q(i)==='disq'});
   var groups=[{name:'Ranked',list:ideaRecs(ranked)},{name:'Not yet qualified',list:ideaRecs(partly)},{name:'Did not pass qualification',list:ideaRecs(disq)},{name:'Ideas for the future',list:ideaRecs(fut)}].filter(function(g){return g.list.length});
   return printDocCover('Blue Sky Portfolio','Every idea not yet selected for exploration: the qualified ideas ranked by their Filter & Rank score, the ideas not yet qualified, the ideas that did not pass, and the ideas parked for the future.',all.length+' idea'+(all.length===1?'':'s')+' \u00b7 '+ranked.length+' ranked \u00b7 '+fut.length+' for the future')
    +erHeadLg('At a Glance','')+erFigRow([{v:all.length,l:'Ideas'},{v:ranked.length,l:'Ranked'},{v:disq.length,l:'Did not pass'},{v:fut.length,l:'For the future'}])
    +ideaBalanceBlock(now,'bluesky','Blue Sky Portfolio Balance')+'<div style="break-before:page;page-break-before:always">'+erHeadLg('The Ideas','')+lyRegister('idea',ideaRecs(ranked.concat(partly,disq,fut)),depth,IDEA_LAYER_INDEX.rank,groups)+'</div>'},
 'out-explore':function(){var st=getStages(),depth=(UI.printDepth||'summary'),pj=data.projects||{};var list=st.explore.concat(st.noGo||[]);
   var go=list.filter(function(i){return (pj[i]||{}).viable===true}),nogo=list.filter(function(i){return (pj[i]||{}).viable===false}),open=list.filter(function(i){var v=(pj[i]||{}).viable;return v!==true&&v!==false});
   var groups=[{name:'Go',list:ideaRecs(go)},{name:'Not yet decided',list:ideaRecs(open)},{name:'No-Go',list:ideaRecs(nogo)}].filter(function(g){return g.list.length});
   return printDocCover('Exploration Portfolio','The projects selected for exploration: each one\u2019s overview and verdict'+(depth==='full'?', its analyses, its portfolio position, and its budget':'')+'.',list.length+' idea'+(list.length===1?'':'s')+' \u00b7 '+go.length+' Go \u00b7 '+nogo.length+' No-Go')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'In exploration'},{v:go.length,l:'Go'},{v:open.length,l:'Not yet decided'},{v:nogo.length,l:'No-Go'}])
    +ideaBalanceBlock(list,'explore','Exploration Portfolio Balance')
    +projectCardGroups(groups,depth,erHeadLg('The Projects',''))} /* 17 Sep 2026 (Paul's ruling): the Exploration Portfolio prints its projects as cards \u2014 Summary the Overview card, every line, verdict and score on the name bar; Full two pages per project (overview, analyses, position; then the budget). No portfolio placement section in Summary */,
 'out-expbriefs':function(){var st=getStages(),depth=(UI.printDepth||'summary'),tk=data.tracking||{};var list=st.experiment;var by=function(sts){return list.filter(function(i){return sts.indexOf((tk[i]||{}).status||'')>=0})};
   var running=by(['running','alive']),complete=by(['complete']),paused=by(['paused','dormant']),killed=by(['killed','dead']),notStarted=list.filter(function(i){return !((tk[i]||{}).status)});
   var groups=[{name:'Running',list:ideaRecs(running)},{name:'Complete',list:ideaRecs(complete)},{name:'Not yet started',list:ideaRecs(notStarted)},{name:'Paused',list:ideaRecs(paused)},{name:'Killed',list:ideaRecs(killed)}].filter(function(g){return g.list.length});
   return printDocCover('Development Portfolio','The programs in development: each one\u2019s brief \u2014 owner, costs, timeline, success metric \u2014 and its track to date.',list.length+' program'+(list.length===1?'':'s')+' \u00b7 '+running.length+' running \u00b7 '+complete.length+' complete')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'Programs'},{v:running.length,l:'Running'},{v:complete.length,l:'Complete'},{v:killed.length,l:'Killed'}])
    +ideaBalanceBlock(list,'experiment','Development Portfolio Balance')
    +projectStageGroups(groups,depth,'','dev',true)} /* 17 Sep 2026 (Paul's ruling): no document heading and no group headings \u2014 every program here is in development, so the cards follow the figures on their own page */ /* 17 Sep 2026 (Paul's ruling): the Exploration form applied \u2014 each program's development card (brief and track); Full adds the overview, analyses, position, and budget pages */,
 'out-finalport':function(){return portfolioReviewDoc()}, /* 17 Sep 2026 (Paul's ruling): the Portfolio Review */
 'out-oper':function(){var st=getStages(),depth=(UI.printDepth||'summary'),ops=data.opsData||{};var list=st.operational;var byH=function(h){return list.filter(function(i){return ((ops[i]||{}).health||'')===h})};var green=byH('green'),amber=byH('amber'),red=byH('red'),none=list.filter(function(i){return !((ops[i]||{}).health)});
   var groups=[{name:'Live Projects',list:ideaRecs(list)}]; /* 17 Sep 2026 (Paul's ruling): one list, not grouped by health */
   return printDocCover('Operational Portfolio','The projects live in the business: each one\u2019s health, launch date, and performance against its success metric, with the brief and development track behind it.',list.length+' live project'+(list.length===1?'':'s')+' \u00b7 '+green.length+' green \u00b7 '+amber.length+' amber \u00b7 '+red.length+' red')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'Live projects'},{v:green.length,l:'Green',col:'#1B6B5A',vcol:'#1B6B5A'},{v:amber.length,l:'Amber',col:'#B8860B',vcol:'#B8860B'},{v:red.length,l:'Red',col:'#9B2D3F',vcol:'#9B2D3F'}])
    +ideaBalanceBlock(list,'operational','Operational Portfolio Balance')
    +projectStageGroups(groups,depth,'','ops',true)} /* 17 Sep 2026: likewise, no headings \u2014 every project here is live */ /* 17 Sep 2026: the operations card, health coloured as the page; Full adds the development card and the project pages */
};
PRINT_DOCS['out-devport']=PRINT_DOCS['out-expbriefs']; /* the development portfolio's second id */
PRINT_DOCS['5.1']=pipelineDashboardDoc; /* the dashboard, registered so the Report Manager can include it */
PRINT_DOCS['out-report']=assessmentReportDoc;
PRINT_DOCS['out-capplan']=function(){return '<style>'+CAP_REPORT_CSS+'</style>'+printDocCover('Capital Snapshot',capSnapLead(),'')+capReportBody()}; /* the Capital Snapshot Report as Paul ruled it on 13 Sep 2026, registered so the Report Manager can include it */
PRINT_DOCS['cap-hub']=capHubDoc;
function printCurrentPage(){ /* 16 Sep 2026: the Phase 5 pages print their own documents; any other step prints its page under a cover */
  if(currentPage==='cap-hub'){printCapHub();return}
  if(currentPage==='mgmt-hub'){printMgmtAnalytics();return}
  if(currentPage==='review'){printDocument('Portfolio Review',portfolioReviewDoc(),'');return} /* 17 Sep 2026: the review page prints the Portfolio Review */
  if(currentPage==='portfolio'){printCurrentOutput();return} /* a live portfolio page prints its output's document */
  if(currentPage==='phase5'||currentStep==='5.1'){printDocument('Pipeline Dashboard',pipelineDashboardDoc(),'');return}
  var id=currentStep;var title=stepNameOf(id);
  UI._printing=1;var body='';try{body=renderStepContentBody(id)}finally{UI._printing=0}
  printPage(title,function(){return body});
}
PRINT_DOCS['out-orgready']=orgReadinessDoc;PRINT_DOCS['out-govfw']=govFrameworkDoc;PRINT_DOCS['out-orgrev']=orgDesignReviewDoc;PRINT_DOCS['out-raci']=raciDoc;
function printCurrentOutput(){var id=currentStep;var fn=PRINT_DOCS[id];if(fn){printDocument(outcomeNameOf(id),fn(),'');return}UI._printing=1;var body='';try{body=renderOutcome()}finally{UI._printing=0}printPage(outcomeNameOf(id),function(){return body})} /* 16 Sep 2026: an output with a composed document prints it; one without prints its page under a cover, as the 12 Sep baseline did */
function outputPrintRow(id){return '<div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 12px">'+(DEPTHED_OUTPUTS[id]?lyDepthCtl():'')+pdfBtn('printCurrentOutput()')+'</div>'} /* 16 Sep 2026: the family's print control on an output page — the Summary / Full choice where the document offers it, then Save as PDF */
/* ══ THE SINGLE-RECORD DOCUMENTS (round 3, 16 Sep 2026): the outputs that are not registers, composed for paper in the page's own words ══ */
function erStatement(text){var t=lyText(text);return '<div style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin:0 0 22px;font-family:var(--serif,Georgia,serif);font-size:16px;line-height:1.5;white-space:pre-line;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div>'} /* a statement block: the page's summary paragraph, set in the serif */
/* ══ THE ASSESSMENT PROFILE BLOCKS — Governance's apBlock / apStrip (copy-pass item 8, 21 Aug 2026, ruled by Paul), ported to the Innovation Pipeline 17 Sep 2026 on his ruling that the Assessment Report's Full version present its scored questions as the Governance profile does. The frame-plus-attributed-block law: authored copy frames; user text is quoted, never woven. Governance's teal is the Pipeline's own module blue here — the head accent, #076D9E in its light value (17 Sep 2026, Paul's ruling, after a detour through the orange); each block is unsplittable ══ */
function apBlock(q,v){var t=String(v==null?'':v).trim();
return '<div style="margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin:0 0 4px">'+q+'</div>'+(t?'<div style="white-space:pre-wrap;font-size:14px;line-height:1.55;padding:10px 14px;border-left:3px solid #076D9E55;background:rgba(7,109,158,.06)">'+esc(t)+'</div>':'<div style="font-size:13px;color:var(--text-faint);font-style:italic">Not yet recorded.</div>')+'</div>'}
function apStrip(q,v,lo,hi){var has=(typeof v==='number'&&v>=1&&v<=5);var cells='';for(var i=1;i<=5;i++){cells+='<div class="ap-seg'+(has&&i===v?' on':'')+'" style="flex:1;height:8px;border-radius:4px;margin:0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(has&&i===v?'#076D9E':'rgba(138,130,120,.22)')+'"></div>'}
return '<div style="margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin:0 0 6px">'+q+'</div>'+(has?'<div style="display:flex;align-items:center">'+cells+'</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-faint);margin-top:3px"><span>'+lo+'</span><span>'+hi+'</span></div>':'<div style="font-size:13px;color:var(--text-faint);font-style:italic">Not yet recorded.</div>')+'</div>'}
function assessmentReportDoc(){var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},de=data.decisions||{},au=data.audit||[];var depth=(UI.printDepth||'summary'),full=(depth==='full');
  var cultureItems=[{k:'uncertainty',l:'Uncertainty'},{k:'aiLegitimacy',l:'AI legitimacy'},{k:'newProposals',l:'New proposals'},{k:'incentives',l:'Incentives'},{k:'frontline',l:'Frontline'},{k:'overall',l:'Overall'}];var cs=cultureItems.map(function(x){return typeof cu[x.k]==='number'?cu[x.k]:0}).reduce(function(a,b){return a+b},0);
  var gaps=Object.keys(de).filter(function(q){return de[q]&&de[q].gap}).length;var appetite=(cu.uncertainty||0)<=2?'Averse':(cu.uncertainty||0)<=3?'Moderate':'Tolerant';
  var summary='An organization with '+(k.usage==='advanced'?'advanced':k.usage==='moderate'?'moderate':'limited')+' AI capabilities and '+(cs<=12?'low':cs<=20?'moderate':'strong')+' cultural readiness ('+cs+' of 30), with '+gaps+' decision-rights gap'+(gaps===1?'':'s')+'.';
  var qs=[{k:'q1',l:'Approve experiments'},{k:'q2',l:'Advance projects'},{k:'q3',l:'Reallocate budget'},{k:'q4',l:'Kill projects'},{k:'q5',l:'Cross-functional resources'}];
  var h=printDocCover('Assessment Report','Where the organization stands before the pipeline begins: its purpose and frictions, its AI knowledge, its culture, its innovation record, and who holds each decision right.'+(full?' Every scored answer of the Assessment Battery follows.':''),'Culture '+cs+' / 30 \u00b7 '+gaps+' decision-rights gap'+(gaps===1?'':'s'));
  h+=erBlock(erHead('Executive Summary','')+erStatement(summary));
  h+=erBlock(erHead('At a Glance','')+erFigRow([{v:cs+' / 30',l:'Culture score'},{v:appetite,l:'Risk appetite'},{v:gaps,l:'Decision gaps'}]));
  var dims=getAssessmentScores();
  h+=erBarBlock('Readiness Profile','Scored across the five Phase 1 dimensions',dims.map(function(d){return {l:d.name,v:d.score,max:5}}));
  h+='<style>'+PIPE_RADAR_CSS+'</style>'+erBlock('<div style="border:1px solid #ddd;border-radius:6px;padding:10px 16px 4px;margin:-8px auto 22px;max-width:460px">'+vizRadarLarge(dims)+'</div>'); /* 17 Sep 2026 (Paul's ruling): the radar from the foot of the output page, beneath its bars */
  if(full)h+=erBlock(erHead('Purpose and Direction','Every answer of section 1.1, in the organization\u2019s own words')+apBlock('Mission',p.mission)+apBlock('Values',p.values)+apBlock('Short-term targets',p.shortTerm)+apBlock('Medium-term targets',p.mediumTerm)+apBlock('Long-term targets',p.longTerm)+apBlock('Key goals',p.goals)+apBlock('Friction points',p.frictions)+'<div style="height:8px"></div>'); /* the block rule: a section that would be cut starts a new page */
  else h+=erSection('Purpose and Direction',lyRow('Mission',p.mission)+lyRow('Friction points',p.frictions));
  if(full){
    h+=erBlock(erHead('AI Knowledge Base','The four answers of section 1.2')+apBlock('Current usage',k.usage?lyCap(k.usage):'')+apStrip('Leadership awareness',k.awareness,'Unaware','Very aware')+apBlock('Technical resources',k.resources?lyCap(k.resources):'')+apBlock('Learning processes',k.learning?lyCap(k.learning):'')+'<div style="height:8px"></div>');
    var CU_ENDS={uncertainty:['Uncomfortable','Comfortable'],aiLegitimacy:['Stigma','Accepted'],newProposals:['Shut down','Support'],incentives:['Punish','Reward'],frontline:['None','Strong'],overall:['Stagnant','Innovative']}; /* the endpoints as the step\u2019s Likert scales give them */
    h+=erBlock(erHead('Risk and Culture','The six answers of section 1.3 \u2014 together '+cs+' of 30')+cultureItems.map(function(x){return apStrip(x.l,cu[x.k],CU_ENDS[x.k][0],CU_ENDS[x.k][1])}).join('')+'<div style="height:8px"></div>');
    h+=erBlock(erHead('AI Innovation Audit',au.length?au.length+' past initiative'+(au.length===1?'':'s')+' \u2014 section 1.4':'Section 1.4')+(au.length?'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+['Initiative','Status'].map(function(t){return '<th style="text-align:left;padding:6px 10px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'}).join('')+'</tr></thead><tbody>'+au.map(function(a){return '<tr>'+[a.name,a.status?lyCap(a.status):''].map(function(v,ci){var t=lyText(v);return '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12.5px;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(ci===0?';font-weight:600':'')+'">'+esc(t?lyCap(t):'Not recorded')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>':'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Past initiatives','')+'</tbody></table>'));
  }
  if(full){var QT={q1:'Who can authorize a new experiment to start, including its budget?',q2:'Who decides that a successful experiment moves into serious development?',q3:'Who can move money between projects mid-year without a new budget round?',q4:'Who can stop a project that is not working?',q5:'Who can commit people from more than one function to the same initiative?'}; /* the step\u2019s own question texts */
    h+=erBlock(erHead('Decision Rights','The five answers of section 1.5'+(gaps?' \u2014 '+gaps+' gap'+(gaps===1?'':'s')+' noted':''))+qs.map(function(q){var dq=de[q.k]||{};return apBlock(QT[q.k],dq.who)}).join('')+apBlock('Recorded decision-rights gaps',qs.filter(function(q){return (de[q.k]||{}).gap}).map(function(q){return q.l+' \u2014 '+de[q.k].gap}).join('\n')))}
  else h+=erSection('Decision Rights',qs.map(function(q){var d=de[q.k]||{};return lyRowHtml(q.l,(d.who||'')+(d.gap?'<br>Gap: '+d.gap:''))}).join(''),gaps?gaps+' gap'+(gaps===1?'':'s')+' noted':'');
  return h} /* 17 Sep 2026 (Paul's ruling): Summary as before plus the radar; Full prints every scored answer of the Assessment Battery \u2014 the seven purpose fields, the four knowledge answers, the six culture answers as bars, the innovation audit as a table \u2014 the Governance assessment document's form */
function orgReadinessDoc(){var M=orgReadinessModel();var ow=M.ow,inc=M.inc;
  var h=printDocCover('Org Readiness','How the organization is set up to run the pipeline: who owns it, who leads it inside the functions, who backs it, how incentives are changing, and the rhythm the work keeps.',M.done+' of '+M.chk.length+' readiness checks complete');
  h+=erBlock(erHead('Summary','')+erStatement(M.summary));
  h+=erBlock(erHead('At a Glance','')+erFigRow([{v:M.leads.length,l:'Embedded leads'},{v:M.metrics.length,l:'Innovation metrics'},{v:M.done+' / '+M.chk.length,l:'Readiness checks'}]));
  var tick=function(d){return '<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;text-align:center;font-size:11px;font-weight:700;'+(d?'background:#111;color:#fff':'border:1.5px solid #999;color:#999')+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+(d?'\u2713':'')+'</span>'};
  h+=erSection('Organizational Readiness',M.chk.map(function(c){return '<tr><td style="width:30px;padding:7px 0 7px 2px;border-bottom:1px solid #eee;vertical-align:top">'+tick(c.d)+'</td><td style="padding:6px 10px 7px 4px;border-bottom:1px solid #eee;vertical-align:top"><div style="font-size:12.5px;font-weight:600;color:'+(c.d?'#111':'#555')+'">'+esc(c.l)+'</div><div style="font-size:11.5px;line-height:1.45;color:#555;margin-top:2px">'+esc(c.ev)+'</div></td></tr>'}).join(''),M.done+' of '+M.chk.length+' complete'); /* 17 Sep 2026 (Paul's ruling): a checklist on paper too \u2014 a tick per check met, the record beneath each, the count in the sub-line */
  var tbl=function(rows,cols){return '<table style="width:100%;border-collapse:collapse;margin:0 0 14px"><thead><tr>'+cols.map(function(t){return '<th style="text-align:left;padding:6px 10px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(v,ci){var t=lyText(v);return '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12.5px;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(ci===0?';font-weight:600':'')+'">'+esc(t?lyCap(t):'Not recorded')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'};
  h+=erBlock(erHead('Pipeline Owner','')+apBlock('Name',ow.ownerName)+apBlock('Role',ow.ownerRole)+apBlock('Authority',ow.authority)+'<div style="height:8px"></div>');
  h+=erBlock(erHead('Embedded Leads',M.leads.length?M.leads.length+' lead'+(M.leads.length===1?'':'s')+' \u2014 one per department that runs experiments':'')+(M.leads.length?tbl(M.leads.map(function(l){return [l.name,l.dept]}),['Lead','Department']):'<div style="font-size:13px;color:#888;font-style:italic;margin:0 0 14px">Not yet recorded.</div>'));
  h+=erBlock(erHead('Engaged Senior Leaders',M.seniors.length?M.seniors.length+' executive'+(M.seniors.length===1?'':'s')+' who visibly back the pipeline':'')+(M.seniors.length?tbl(M.seniors.map(function(l){return [l.name,l.role]}),['Executive','Position']):'<div style="font-size:13px;color:#888;font-style:italic;margin:0 0 14px">Not yet recorded.</div>'));
  h+=erBlock(erHead('Realigned Incentives','')+apBlock('Current structure',inc.current)+apBlock('Proposed changes',inc.changes)+apBlock('Innovation metrics',M.metrics.join('\n'))+'<div style="height:8px"></div>');
  h+=erBlock(erHead('Innovation Rhythm','')+apBlock('Session',M.session)+apBlock('Attendees',M.att.join('\n'))+apBlock('Standing agenda',M.agenda.join('\n'))+'<div style="height:8px"></div>');
  return h} /* 17 Sep 2026 (Paul's ruling): one definitive version \u2014 the Full of the day before, which added little and was not overwhelming; no Summary / Full. The checklist is a checklist on paper; the step numbers and the meta phrase are gone */
/* ══ ORG READINESS (17 Sep 2026, Paul's ruling): one model for the page and the document. The three steps' record — Ownership & Structure (owner, embedded leads, engaged senior leaders), Realign Incentives (current structure, proposed changes, metrics), Innovation Rhythm (session, attendees, agenda) — and the seven readiness checks, each carrying the record that satisfies it or what is missing. Summary is the checks and the record's main facts; Full is every field in the organization's own words and the checks with their evidence ══ */
function orgReadinessModel(){var ow=data.ownership||{},inc=data.incentives||{},rh=data.rhythm||{};var leads=(ow.leads||[]).filter(function(l){return l&&(l.name||l.dept)}),seniors=(ow.seniors||[]).filter(function(l){return l&&(l.name||l.role)});var att=rhAttNames(),agenda=rhAgList(),metrics=(inc.metrics||[]).filter(Boolean);var deep=!!(data.completedSteps||{})['2.4'];
  var session=rh.day?'Every '+rh.day+(rh.time?' at '+rh.time:''):'';
  var chk=[
   {l:'Pipeline owner named with explicit authority',d:!!ow.ownerName&&!!ow.authority,ev:ow.ownerName?(ow.ownerName+(ow.ownerRole?', '+ow.ownerRole:'')+(ow.authority?': '+ow.authority:' \u2014 no authority stated')):'No owner named'},
   {l:'At least one embedded lead assigned',d:leads.length>=1&&!!leads[0].name,ev:leads.length?leads.length+' lead'+(leads.length===1?'':'s')+': '+leads.map(function(l){return (l.name||'Unnamed')+(l.dept?' ('+l.dept+')':'')}).join(', '):'No embedded lead yet'},
   {l:'Incentive structure addresses experimentation',d:!!inc.changes,ev:inc.changes||'No proposed changes recorded'},
   {l:'Innovation metrics selected (2+)',d:metrics.length>=2,ev:metrics.length?metrics.length+' metric'+(metrics.length===1?'':'s')+': '+metrics.join(', ')+(metrics.length<2?' \u2014 one more needed':''):'No metrics selected'},
   {l:'Weekly innovation session scheduled',d:!!rh.day&&att.length>0,ev:rh.day?session+(att.length?', '+att.length+' attendee'+(att.length===1?'':'s'):' \u2014 no attendees named'):'No day set'},
   {l:'Standing agenda defined',d:agenda.length>0,ev:agenda.length?agenda.join('; '):'No agenda items'},
   {l:'First deep assessments completed',d:deep,ev:deep?'Step 2.4 marked complete':'Not yet: step 2.4 is not marked complete'}];
  var done=chk.filter(function(c){return c.d}).length;
  var summary=(ow.ownerName?ow.ownerName+(ow.ownerRole?' ('+ow.ownerRole+')':'')+' owns the pipeline. ':'No pipeline owner is named yet. ')+leads.length+' embedded lead'+(leads.length===1?'':'s')+'. '+(rh.day?'Innovation rhythm: every '+rh.day+(rh.time?' at '+rh.time:'')+'. ':'No innovation rhythm set. ')+(inc.changes?'Incentives realigning.':'Incentives not yet realigned.');
  return {ow:ow,inc:inc,rh:rh,leads:leads,seniors:seniors,att:att,agenda:agenda,metrics:metrics,session:session,chk:chk,done:done,pct:Math.round(done/chk.length*100),summary:summary}}
function govFrameworkDoc(){var gov=data.governance||{};
  var h=printDocCover('Governance Framework','The three mechanisms that keep innovation governed after day 90: the standing leadership agenda, the pipeline intake rule, and the quarterly review.','');
  var summary='Governance embedded across three mechanisms: a standing agenda in '+(gov.meeting||'the leadership meeting')+', gate reviews above '+(gov.threshold||'the intake threshold')+', and quarterly reviews from '+(gov.firstReview||'a date not yet set')+'.';
  h+='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid rgba(155,45,63,.2);background:rgba(155,45,63,.04);border-radius:8px;padding:14px 18px;margin:0 0 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#9B2D3F;margin:0 0 6px">Executive Summary</div><div style="font-size:14px;line-height:1.55;color:#111">'+esc(summary)+'</div></div>';
  var pillars=[{t:'Standing Leadership Agenda',c:'#1B6B5A',items:[['Embedded in',gov.meeting],['Metrics',gov.metrics],['Format',gov.format]]},{t:'Pipeline Intake Rule',c:'#2D5A8E',items:[['Threshold',gov.threshold],['Review process',gov.gateProcess],['Outside-pipeline audit',gov.outsideAudit]]},{t:'Quarterly Review',c:'#8B5E3C',items:[['Attendees',gov.reviewAttendees],['Agenda',gov.reviewAgenda],['First review',gov.firstReview]]}];
  pillars.forEach(function(p){h+='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-left:3px solid '+p.c+';border-radius:8px;padding:12px 16px;margin:0 0 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111;margin:0 0 8px">'+p.t+'</div>'+p.items.map(function(it){var t=lyText(it[1]);return '<div style="display:flex;gap:14px;padding:5px 0;border-top:1px solid #eee"><div style="font-family:var(--mono,monospace);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:'+p.c+';min-width:130px;padding-top:2px">'+it[0]+'</div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'}).join('')+'</div>'});
  return h} /* 17 Sep 2026 (Paul's ruling): a one-pager of the page's own cards \u2014 the executive summary card and the three mechanism cards with their coloured rules and mono labels \u2014 rather than the question-and-answer form */
function orgDesignReviewDoc(){var st=data.stress||{};var areas=[{k:'decisions',l:'Decision rights'},{k:'ownership',l:'Ownership model'},{k:'incentives',l:'Incentive changes'},{k:'culture',l:'Culture shift'}];var plan=(st.tuningList||[]).filter(function(t){return t});
  var scored=areas.filter(function(a){return st[a.k+'Score']});var avg=scored.length?(scored.reduce(function(s2,a){return s2+(+st[a.k+'Score']||0)},0)/scored.length):0;
  var h=printDocCover('Org Design Review','The stress test of the organization\u2019s design after the first cycle: how decision rights, the ownership model, the incentive changes, and the culture shift are holding, and the adjustments planned.',scored.length?'Average '+avg.toFixed(1)+' / 5 across '+scored.length+' area'+(scored.length===1?'':'s'):'');
  var box=function(a){var t=lyText(st[a.k]),sc=+st[a.k+'Score']||0;return '<td style="width:50%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px"><div style="font-size:13px;font-weight:700;color:#111">'+esc(a.l)+'</div><div style="padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(sc>=4?'rgba(27,107,90,.08)':sc>=3?'rgba(139,94,60,.06)':sc?'rgba(155,45,63,.06)':'#f4f4f4')+';color:'+(sc>=4?'#1B6B5A':sc>=3?'#8B5E3C':sc?'#9B2D3F':'#888')+'">'+(sc?sc+'/5':'\u2014')+'</div></div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div></td>'};
  h+=erHead('The Stress Test','Each area scored out of 5, as the page shows them');
  [[0,1],[2,3]].forEach(function(pair){h+=erBlock('<table style="width:calc(100% + 16px);margin:0 -8px 8px;border-collapse:separate;border-spacing:8px 0"><tr>'+box(areas[pair[0]])+box(areas[pair[1]])+'</tr></table>')}); /* 16 Sep 2026 (Paul's Decision Analyses ruling applied here): the page's four boxes kept on paper, two rows of two, each unsplittable, the score chip coloured as on the page */
  h+='<div style="height:8px"></div>';
  h+=erSection('Adjustment Plan',plan.length?lyList('Adjustments',plan.map(function(t,i){return (i+1)+'. '+t})):lyRow('Adjustments',''),plan.length?plan.length+' adjustment'+(plan.length===1?'':'s'):'');
  return h}
function raciDoc(opts){opts=opts||{};ensureRaciModel();var raci=data.raci||{},cols=raciCols();var acts=['Approve experiments','Advance projects','Allocate budget','Kill projects','Pipeline reporting','Weekly session','Quarterly review'];
  var th='font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#333;border-bottom:2px solid #111;padding:8px 8px';
  var pchip=function(v){return '<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:'+RACI_COLORS[v]+';color:#fff;font-size:13px;font-weight:700;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact">'+v+'</span>'}; /* the chip as it prints */
  var tbl='<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;'+th+'">Activity</th>'+cols.map(function(c){return '<th style="text-align:center;'+th+'">'+esc(c.l)+'</th>'}).join('')+'</tr></thead><tbody>'+acts.map(function(a,ai){return '<tr><td style="padding:9px 8px;border-bottom:1px solid #ddd;font-size:12.5px;font-weight:600;color:#111">'+esc(a)+'</td>'+cols.map(function(c){var v=raci[ai+':'+c.k]||'';return '<td style="text-align:center;padding:7px 8px;border-bottom:1px solid #ddd">'+(v?pchip(v):'<span style="color:#bbb;font-size:13px">\u2014</span>')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  var key=_raciLegend(RACI_COLORS).replace('color:var(--text-faint)','color:#555').replace(/-webkit-print-color-adjust|print-color-adjust/g,'').replace(/border-radius:8px;background:/g,'border-radius:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:');
  return printDocCover('RACI Matrix','Who is Responsible, Accountable, Consulted, and Informed for each of the pipeline\u2019s seven activities, as set at Step 2.1.',cols.length+' role'+(cols.length===1?'':'s')+' \u00b7 7 activities')
   +'<style>.raci-land{break-before:page;page-break-before:always;width:100%;margin-left:0}.raci-land table{table-layout:fixed}.raci-land th{white-space:normal;word-break:break-word;letter-spacing:.03em!important;padding:8px 3px!important}.raci-land th:first-child{width:23%}.raci-land td{padding:7px 3px!important}</style><div class="raci-land">'+(opts.sectionHead||'')+erHead('RACI Matrix','')+tbl+key+'</div>'} /* the matrix sits centred on its landscape page, as Governance's does (12 Sep 2026) */ 
var CAP_HUB_TABS=['Dashboard','Commitments','Plan & Funding']; /* the Capital Planning Hub\u2019s three tabs, as the page names them */
var PIPE_RADAR_CSS='.viz-radar{text-align:center;padding:8px 0}.viz-radar-svg{width:100%;max-width:520px;height:auto}'; /* the radar's two layout rules, from the stylesheet, for paper */
var PIPE_CHART_CSS='.user-av{border-radius:50%; display:inline-flex;align-items:center;justify-content:center; font-family:var(--mono);font-weight:700;letter-spacing:0; flex-shrink:0;line-height:1}.analytics-grid-2{display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px}.chart-card{padding: 24px; background: rgba(var(--fg-rgb),.025); border: 1px solid rgba(var(--fg-rgb),.08); display: flex; flex-direction: column}.chart-card-wide{grid-column: 1 / -1; margin-bottom: 16px}.chart-card-wide:last-child{margin-bottom: 0}.chart-title{font-family: var(--mono); font-size: 12px; letter-spacing: .15em; text-transform: uppercase; color: var(--paper); margin-bottom: 18px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap}.chart-subtitle{font-family: var(--sans); font-size: 12px; text-transform: none; letter-spacing: .01em; color: var(--stone); font-weight: 400}.chart-empty{padding: 32px 0; text-align: center; font-size: 13px; color: var(--stone); font-style: italic}.chart-donut-wrap{display: flex; align-items: center; gap: 24px; flex-wrap: wrap}.chart-donut-svg{width: 200px; height: 200px; flex-shrink: 0}.chart-legend{flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 8px}.chart-legend-row{display: grid; grid-template-columns: 12px 1fr auto auto; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(var(--fg-rgb),.04); font-family: var(--sans); font-size: 13px}.chart-legend-row:last-child{border-bottom: none}.chart-legend-dot{width: 10px; height: 10px; border-radius: 50%}.chart-legend-name{color: var(--paper)}.chart-legend-val{font-family: var(--mono); font-weight: 700; font-size: 14px}.chart-legend-pct{font-family: var(--mono); font-size: 11px; color: var(--stone); min-width: 38px; text-align: right}.cap-split-labels{display: flex; justify-content: space-between; margin-bottom: 12px; align-items: flex-end}.cap-split-side .cap-split-pct{font-family: var(--serif); font-size: 42px; font-weight: 300; line-height: 1}.cap-split-side .cap-split-name{font-family: var(--mono); font-size: 11px; letter-spacing: .15em; text-transform: uppercase; color: var(--stone); margin-top: 4px}.cap-split-right{text-align: right}.cap-split-bar{display: flex; height: 14px; background: rgba(var(--fg-rgb),.06); border-radius: 7px; overflow: hidden; margin-bottom: 14px}.cap-split-fill{height: 100%; transition: width .4s ease}.cap-split-foot{font-family: var(--sans); font-size: 12px; color: var(--stone); margin-top: 4px}.chart-bubble-svg{width: 100%; height: auto; max-height: 360px; display: block; margin-bottom: 16px}.bubble-legend{display: flex; gap: 32px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid rgba(var(--fg-rgb),.06)}.bubble-legend-group{display: flex; align-items: center; gap: 12px; flex-wrap: wrap}.bubble-legend-lbl{font-family: var(--mono); font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: var(--stone); margin-right: 4px}.bubble-legend-item{display: inline-flex; align-items: center; gap: 6px; font-family: var(--sans); font-size: 12px; color: var(--paper)}.bubble-legend-dot{width: 10px; height: 10px; border-radius: 50%}.bubble-priority-dot{border-radius: 50%; background: rgba(232,98,26,.6); border: 1px solid var(--gold)}.status-rows{display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px}.status-row{display: grid; grid-template-columns: 120px 1fr 30px; align-items: center; gap: 12px}.status-row-label{font-family: var(--sans); font-size: 14px; font-weight: 600}.status-row-bar{display: flex; height: 24px; gap: 2px; background: rgba(var(--fg-rgb),.04); border: 1px solid rgba(var(--fg-rgb),.06)}.status-seg{display: flex; align-items: center; justify-content: center; min-width: 2px; transition: filter .15s}.status-seg-n{font-family: var(--mono); font-size: 11px; font-weight: 700; color: #fff}.status-row-total{font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--gold); text-align: right}.owner-rows{display: flex; flex-direction: column; gap: 8px}.owner-row{display: grid; grid-template-columns: 32px 160px 1fr 30px; align-items: center; gap: 12px}.owner-row-av{display: flex; justify-content: center}.owner-row-name{font-family: var(--sans); font-size: 13px; color: var(--paper)}.owner-row-bar{height: 12px; background: rgba(var(--fg-rgb),.05); border-radius: 6px; overflow: hidden}.owner-row-fill{height: 100%; border-radius: 6px; transition: width .4s ease}.owner-row-n{font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--gold); text-align: right}.status-row{grid-template-columns: 90px 1fr 30px}.owner-row{grid-template-columns: 28px 110px 1fr 24px}.cap-split-side .cap-split-pct{font-size: 32px}.chart-card{break-inside:avoid;page-break-inside:avoid}'; /* 16 Sep 2026 (Paul's ruling): the dashboard's five charts print; their layout rules come from the stylesheet as the Capital Snapshot's do (CAP_REPORT_CSS), with each chart card unsplittable */
function _pdFormsToText(html){ /* 16 Sep 2026: a page that is a form prints its values as text — a select as its chosen option, an input as its value, a textarea as its content — and no handler survives */
  return html.replace(/<select[^>]*>([\s\S]*?)<\/select>/g,function(m,inner){var sel=inner.match(/<option[^>]*\sselected[^>]*>([^<]*)<\/option>/);var first=inner.match(/<option[^>]*>([^<]*)<\/option>/);var v=(sel?sel[1]:(first?first[1]:'')).trim();return '<span style="font-weight:600">'+(v||'\u2014')+'</span>'})
  .replace(/<textarea[^>]*>([\s\S]*?)<\/textarea>/g,function(m,inner){return '<span>'+(inner.trim()||'\u2014')+'</span>'})
  .replace(/<input([^>]*)>/g,function(m,attrs){var v=(attrs.match(/\svalue="([^"]*)"/)||[])[1]||'';var t=(attrs.match(/\stype="([^"]*)"/)||[])[1]||'text';if(t==='checkbox'||t==='radio')return /\schecked/.test(attrs)?'\u2713':'\u2014';return '<span style="font-weight:600">'+(v||'\u2014')+'</span>'})
  .replace(/ on(click|change|input|keyup|blur)="[^"]*"/g,'')}

function capHubDoc(){var tab=UI.hubTab||0;var body='';UI._printing=1;try{body=renderCapHub()}finally{UI._printing=0}
  return printDocCover('Capital Planning Hub \u2014 '+CAP_HUB_TABS[tab],'The portfolio\u2019s committed costs and remaining budget as they stand: the '+CAP_HUB_TABS[tab]+' view, every figure calculated from the projects themselves.','')+_pdFormsToText(_pdStrip(body))} /* the tab showing prints as its own document under a cover \u2014 Governance\u2019s Compliance Dashboard pattern (Rollout Guide Part II) */
function printCapHub(){printDocument('Capital Planning Hub',capHubDoc(),'')}
/* ══ THE CAPITAL SANDBOX ON PAPER (17 Sep 2026, Paul's ruling): the sandbox prints the scenario it shows — the standing baseline with whatever batch is ticked stacked on top — so different combinations print as different documents. Nothing here is a commitment; the title says so ══ */
function capSandboxDoc(){var ideas=data.ideas||[],stages=getStages(),proj=data.projects||{};var goP=stages.explore.filter(function(i){return (proj[i]||{}).viable===true});if(!UI.capSim)UI.capSim={};var sel=goP.filter(function(i){return UI.capSim[i]});
  var toExp=0;sel.forEach(function(i){toExp+=devCost(i)});var have=!!orgMonthly();var pmNow=have?progMonthOf(new Date()):null;var aAss=Math.max(1,(pmNow==null?0:pmNow)+1);
  var extras=sel.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return {i:i,anchor:(a2!=null&&a2>=1)?a2:aAss}});var br=have?capBreaches(extras):{};
  var title=sel.length?'Staged batch ('+sel.length+')':'The standing baseline';
  var h=printDocCover('Capital Sandbox','A capital expenditure scenario staging a specified batch of projects.',sel.length?sel.length+' candidate'+(sel.length===1?'':'s')+' staged \u00b7 '+fmtMoney(toExp)+' committed on advancing':'Nothing staged'); /* 17 Sep 2026 (Paul's ruling): the cover as he gave it */
  var th=function(t,r){return '<th style="text-align:'+(r?'right':'left')+';padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v,r){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;vertical-align:top;'+(r?'text-align:right;white-space:nowrap':'')+'">'+v+'</td>'};
  var rows=function(list){return list.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;var start=have?('Month '+((a2!=null&&a2>=1)?a2:aAss)+(sd?'':' (assumed)')):(sd?lyDate(sd):'Next month');return '<tr>'+td('<b>'+esc((ideas[i]||{}).name)+'</b>')+td(getScore(i)+' / 50',true)+td(fmtMoney(devCost(i)),true)+td(fmtMoney(opsRolloutCost(i)),true)+td(fmtMoney(opsSustainCost(i))+'/yr',true)+td(start)+'</tr>'}).join('')};
  var tbl=function(list){return '<table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Candidate')+th('Score',true)+th('Development',true)+th('Rollout',true)+th('Sustainment',true)+th('Start')+'</tr></thead><tbody>'+rows(list)+'</tbody></table>'};
  if(sel.length)h+=erBlock(erHead('The Staged Batch',sel.length+' of '+goP.length+' Go candidates ticked \u2014 unless dated, each is assumed to start next month (program Month '+aAss+')')+tbl(sel)+'<p style="font-size:11.5px;color:#333;margin:0 0 22px">Committed on advancing: <b>'+fmtMoney(toExp)+'</b> \u2014 the full plans, reflected across the years they touch.</p>');
  else h+=erBlock(erHead('The Staged Batch','Nothing ticked \u2014 the pages that follow show the committed portfolio alone')+(goP.length?'<p style="font-size:11.5px;color:#333;margin:0 0 6px">The Go candidates available to stage:</p>'+tbl(goP):'<p style="font-size:12px;color:#888;font-style:italic;margin:0 0 22px">No Go candidates yet \u2014 Go projects from Exploration appear here with their costs.</p>'));
  if(!have)return h+erBlock(erHead('On the Calendar','')+'<p style="font-size:12px;color:#888;font-style:italic">Set the period start date at Step 3.2 (Plan Capacity) to draw the batch on the program calendar.</p>');
  var strip=function(x){return String(x||'').replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/<svg /g,'<svg style="width:100%;height:auto;display:block" ')};
  var verdict=sel.length?(br.overCapMonth?'<p style="font-size:12px;color:#9B2D3F;margin:8px 0 0">\u26A0 With this batch, cumulative commitments cross capacity in Month '+br.overCapMonth+'. A funding plan would be required at Commit &amp; Advance.</p>':'<p style="font-size:12px;color:#333;margin:8px 0 0">Cumulative commitments stay under cumulative capacity across the horizon.</p>'):'';
  h+=erBlock(erHead('On the Calendar',sel.length?'The standing baseline with the staged batch stacked on top':'The standing baseline')+strip(orgWaterfallChart(extras))+verdict);
  h+=erBlock(erHead('Cumulative Commitments Against Capacity','')+strip(orgCumChart(extras)));
  h+=erBlock(erHead('The Committed Calendar',sel.length?'Swimlanes, the staged batch included':'Swimlanes')+strip(orgSwimlanes(extras)));
  var L=capLens(extras.length?extras:null);var k=function(v){return (v<0?'\u2212':'')+'$'+Math.round(Math.abs(v)/1000).toLocaleString('en-US')+'K'};var anyKill=L.years.some(function(r){return r.killPot});
  var yth=function(t,r){return '<th style="text-align:'+(r?'right':'left')+';padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var ytd=function(v,r,c){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;'+(r?'text-align:right;white-space:nowrap;font-family:var(--mono,monospace);':'')+(c?'color:'+c+';font-weight:700;':'')+'">'+v+'</td>'};
  var yrow=function(lbl,r,bold){return '<tr>'+ytd(bold?'<b>'+lbl+'</b>':lbl)+ytd(k(r.budget),true)+ytd(k(r.committed),true)+(anyKill?ytd(r.killPot?k(r.killPot):'\u2014',true):'')+ytd(k(r.available),true,r.available<0?'#9B2D3F':'#1B6B5A')+'</tr>'};
  h+='<div style="height:22px"></div>'+erBlock(erHead('The Years','Budget, committed cost, and what remains in each year of the planning window'+(sel.length?', with the staged batch included':''))+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+yth('Year')+yth('Budget',true)+yth('Committed',true)+(anyKill?yth('Kill & phase-out',true):'')+yth('Available',true)+'</tr></thead><tbody>'+L.years.map(function(r){return yrow('Year '+r.y,r)}).join('')+yrow('Total \u2014 '+L.years.length+' years',L.tot,true)+'</tbody></table>'); /* 17 Sep 2026 (Paul's ruling): a line per year and the total, in exact thousands so the arithmetic reads; the screen widget's one-year view and its paragraphs are gone */
  if(sel.length&&br.overCapMonth){ /* 17 Sep 2026 (Paul's ruling, on the chat's refinement): a funding plan is written for the batch that breaches, so it prints with that batch */
    var fl=fundLines(),ovs=((data.capital||{}).overrides||[]);var ytx=orgYearTotals()||[];var gaps=ytx.filter(function(r){return r.budgetSet&&r.headroom<0}).map(function(r){return 'Year '+r.y+': '+fmtMoney(-r.headroom)});
    var lines=fl.length?'<table style="width:100%;border-collapse:collapse;margin:0 0 8px"><thead><tr>'+th('Source')+th('Amount',true)+th('Year')+th('Project')+th('Status')+'</tr></thead><tbody>'+fl.map(function(r){var auth=r.st==='auth';return '<tr>'+td(esc(r.d||'')||'<span style="color:#888;font-style:italic">Not recorded</span>')+td(fmtMoney(costNum(r.a)),true)+td('Year '+esc(String(r.y||'1')))+td(esc(r.proj||'')||'\u2014')+td(auth?'Authorized'+(r.at?' \u00b7 '+fmtDate(r.at):'')+(r.by?' \u00b7 '+esc(r.by):''):'Planned')+'</tr>'}).join('')+'</tbody></table>':'<p style="font-size:12px;color:#888;font-style:italic;margin:0 0 8px">No funding lines recorded yet.</p>';
    var ov=ovs.length?'<div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;margin:10px 0 4px">Overrides on record</div>'+ovs.map(function(o){return '<div style="font-size:12px;color:#111;margin:0 0 3px">'+esc(o.reason||'')+' <span style="color:#555">\u2014 month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+(o.by?' \u00b7 '+esc(o.by):'')+'</span></div>'}).join(''):'';
    h+=erBlock(erHead('Capacity Breach Funding Plan','With this batch, cumulative commitments cross capacity in Month '+br.overCapMonth)+(gaps.length?'<p style="font-size:12px;color:#333;margin:0 0 8px">The funding gap on the committed calendar \u2014 '+gaps.join(' \u00b7 ')+'. The lines below are the sources that answer it.</p>':'<p style="font-size:12px;color:#333;margin:0 0 8px">The committed calendar itself sits inside its budget. The funding breach comes from the staged batch. The items below identify additional sources that may be drawn on to cover the funding breach, or that have been identified so far.</p>' /* 17 Sep 2026: Paul's copy, verbatim */)+lines+ov)}
  return h}
function printCapSandbox(){printDocument('Capital Sandbox',capSandboxDoc(),'')}
/* ══ PHASE 5 DOCUMENTS (round 4, 16 Sep 2026): the Pipeline Dashboard composed for paper; the Module Management document as Governance and ER print it; the print dispatch for the Phase 5 pages ══ */
function pipelineDashboardDoc(){var ideas=data.ideas||[],st=getStages(),rh=data.rhythm||{},gov=data.governance||{},trk=data.tracking||{},ops=data.opsData||{},pj=data.projects||{};var m=getPipelineMaturity();var att=rhAttNames();
  var css='<style>.gd-doc .gd-sec{font-size:22px;font-weight:800;color:#111;margin:0 0 14px}.gd-doc .gd-sec+.gd-sec{margin-top:26px}.gd-doc .gd-sub{font-size:17px;font-weight:700;color:#111;margin:18px 0 10px;break-after:avoid;page-break-after:avoid}.gd-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 12px;background:none;break-inside:avoid;page-break-inside:avoid}.gd-doc .viz-gauge-wrap{text-align:center}.gd-doc .viz-gauge-svg{width:180px;height:117px}.gd-doc .t-faint-sm{font-size:12px;color:#555}.gd-rev3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:0 0 14px}.gd-rev{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;break-inside:avoid}.gd-rev-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;line-height:1.35;min-height:32px}.gd-rev-v{font-size:19px;font-weight:800;margin-top:4px}.gd-rev-d{font-size:12px;color:#555;margin-top:2px}.gd-doc table.gd-sys{width:100%;border-collapse:collapse;font-size:12.5px;margin:0 0 6px}.gd-doc table.gd-sys th{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#333;border-bottom:1px solid #111;padding:6px 8px;text-align:left}.gd-doc table.gd-sys td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}.gd-doc .gd-sys .bg{margin-right:4px;font-size:11px;padding:2px 8px}.gd-arch{font-size:12px;color:#555;margin:4px 0 0}.gd-dom{font-size:16px;font-weight:700;color:#111;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}.gd-dom span{font-weight:400;color:#666;font-size:12px}.gd-none{font-size:12.5px;color:#666;font-style:italic;padding:4px 0}.gd-alert{border:2px solid #9B2D3F;color:#9B2D3F;font-weight:700;font-size:14px;padding:8px 12px;border-radius:6px;margin:0 0 14px}.gd-doc .u-778010b{display:flex;align-items:center;gap:0;margin:0 0 18px}.gd-doc .phase-flex{flex:1;opacity:var(--op)}.gd-doc .u-0cc49e2{width:100%;height:70px}.gd-lane{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;margin:0 0 12px;break-inside:avoid;page-break-inside:avoid}.gd-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.gd-subh{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:8px 0 2px}.gd-gl{break-inside:avoid;page-break-inside:avoid;margin:0 0 6px}.gd-gl .gd-dom{font-size:15px;margin:10px 0 2px}.gd-gl-p{font-size:13px;line-height:1.6;margin:2px 0 0;color:#111}.gd-lane-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px}.gd-lane-h h3{font-size:15px;font-weight:700;margin:0}.gd-lane .bg{font-size:11px;padding:2px 8px;margin-left:4px}.gd-warn{font-size:11px;font-weight:600;color:#C8860A;margin:0 0 4px}.gd-item{font-size:12.5px;color:#222;padding:3px 0;border-bottom:1px solid #eee}.gd-doc .analytics-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 12px}.gd-doc .chart-card{border:1px solid #ddd;border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}.gd-doc .chart-title{font-family:var(--mono,monospace);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#111;margin:0 0 12px}.gd-doc .chart-empty{padding:24px 0;text-align:center;font-size:12px;color:#666;font-style:italic}.gd-doc .chart-donut-wrap{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.gd-doc .chart-donut-svg{width:150px;height:150px;flex-shrink:0}.gd-doc .chart-legend{flex:1;min-width:120px;display:flex;flex-direction:column;gap:2px}.gd-doc .chart-legend-row{display:grid;grid-template-columns:12px 1fr auto auto;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee;font-size:12px}.gd-doc .chart-legend-dot{width:10px;height:10px;border-radius:50%}.gd-doc .chart-legend-name{color:#111}.gd-doc .chart-legend-val{font-family:var(--mono,monospace);font-weight:700;font-size:13px}.gd-doc .chart-legend-pct{font-family:var(--mono,monospace);font-size:11px;color:#555;min-width:34px;text-align:right}.gd-doc svg{max-width:100%}</style>'; /* Governance's dashboard stylesheet, verbatim (dashboardDoc, 14 Sep 2026) */
  var h=printDocCover('Pipeline Dashboard','Pipeline maturity, the next session and reviews, the live projects, and the four portfolios as they stand today.','');
  h+=css+'<style>'+PIPE_CHART_CSS+'</style><div class="gd-doc">';
  /* page one: Pipeline Overview \u2014 the coverage card as govCoverageCard draws it (gauge, score, label; the bars beside), the three cadence cards, the live projects */
  h+='<div style="break-after:page;page-break-after:always">';
  h+='<div class="gd-sec">Pipeline Overview</div>';
  /* the page's own maturity row and its two cards (17 Sep 2026, Paul's ruling: as the dashboard page draws them, nothing added) */
  h+='<style>.gd-doc .viz-dash-row{display:grid;grid-template-columns:240px 1fr;gap:32px;align-items:center;padding:24px;margin-bottom:24px;border:1px solid #ddd;border-radius:6px;break-inside:avoid;page-break-inside:avoid}.gd-doc .viz-gauge-wrap{text-align:center}.gd-doc .viz-gauge-svg{width:200px;height:130px;max-width:100%}.gd-doc .viz-gauge-score{font-family:var(--serif);font-size:36px;font-weight:300;margin-top:-8px;line-height:1}.gd-doc .viz-gauge-denom{font-size:18px;color:#4E5A68;font-weight:300;margin-left:2px}.gd-doc .viz-gauge-label{font-family:var(--mono);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#4E5A68;margin-top:8px}.gd-doc .viz-dim-bars{display:flex;flex-direction:column;gap:12px}.gd-doc .viz-dim-row{display:grid;grid-template-columns:120px 1fr 50px;align-items:center;gap:14px}.gd-doc .viz-dim-name{font-family:var(--sans);font-size:14px;font-weight:500;color:#1E2530}.gd-doc .viz-dim-track{height:10px;background:rgba(30,37,48,.06);border-radius:5px;overflow:hidden}.gd-doc .viz-dim-fill{height:100%;border-radius:5px}.gd-doc .viz-dim-val{font-family:var(--mono);font-size:13px;font-weight:700;text-align:right}.gd-doc .gr-2-mb{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}.gd-doc .cd{border-radius:6px;padding:16px 18px;margin:0;break-inside:avoid;page-break-inside:avoid}.gd-doc .u-49c8739{font-size:14px;font-weight:700;color:#6B4C8A;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.gd-doc .u-ac07cd3{font-size:20px;font-weight:800;color:#6B4C8A}.gd-doc .u-a4cb65d{font-size:13px;color:#64707E;margin-top:4px}.gd-doc .u-efdcc60{font-size:14px;font-weight:700;color:#9B2D3F;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.gd-doc .u-e48f6d6{font-size:20px;font-weight:800;color:#9B2D3F}</style>';
  h+='<div class="viz-dash-row">'+vizHealthGauge(m)+vizDimBars()+'</div>';
  h+='<div class="gr-2-mb">'+card('<div class="u-49c8739">Next Innovation Session</div><div class="u-ac07cd3">'+(rh.day||'\u2014')+' at '+(rh.time||'TBD')+'</div><div class="u-a4cb65d">'+(att.length?att.map(esc).join(', '):'TBD')+'</div>','background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.3)')+card('<div class="u-efdcc60">Next Quarterly Review</div><div class="u-e48f6d6">'+esc(nextReviewDateText())+'</div>','background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3)')+'</div>';
  var live=(st.operational||[]);
  h+='<div class="gd-sub">Operational Projects <span style="font-weight:400;color:#666;font-size:12px">('+live.length+')</span></div>';
  if(live.length){h+='<table class="gd-sys"><thead><tr><th style="width:34%">Project</th><th>Function</th><th style="width:22%">Status</th></tr></thead><tbody>';
    live.forEach(function(i){var killed=(trk[i]||{}).status==='killed';var hh=(ops[i]||{}).health;var col=killed?'#9B2D3F':({green:'#1B6B5A',amber:'#C8860A',red:'#9B2D3F'}[hh]||'#555');var word=killed?'Killed':hh?(hh==='green'?'On track':hh==='amber'?'Watch':'At risk'):'Health not reported';
      h+='<tr><td style="font-weight:600;color:#111">'+esc((ideas[i]||{}).name||'Unnamed project')+'</td><td>'+((ideas[i]||{}).desc?esc((ideas[i]||{}).desc):'<span style="color:#999">Not recorded</span>')+'</td><td style="font-weight:700;color:'+col+'">'+word+'</td></tr>'}); /* the status as coloured text: the page\u2019s badge class does not reach the print window */
    h+='</tbody></table>'}else h+='<div class="gd-none">No projects live yet.</div>';
  h+='</div>';
  /* page two: The Pipeline \u2014 the notice, the chevrons, the four portfolios as lanes; then Portfolio at a Glance follows at once */
  var stages=[{k:'bluesky',t:'Blue Sky',items:st.bluesky,col:'#1B6B5A'},{k:'explore',t:'Exploration',items:(st.explore||[]).concat(st.noGo||[]),col:'#2D5A8E'},{k:'experiment',t:'Development',items:st.experiment||[],col:'#8B5E3C'},{k:'operate',t:'Operational',items:st.operational||[],col:'#9B2D3F'}];
  h+='<div style="break-before:page;page-break-before:always"></div>'; /* 17 Sep 2026 (Paul's ruling): the pipeline starts on its own page, unlabelled */
  var reds=live.filter(function(i){return (ops[i]||{}).health==='red'&&(trk[i]||{}).status!=='killed'});if(reds.length)h+='<div class="gd-alert">\u26a0 '+reds.length+' operational project'+(reds.length===1?'':'s')+' at risk</div>';
  var chev=function(x,i){return '<div class="phase-flex" style="--op:1"><svg viewBox="0 0 200 80" class="u-0cc49e2"><path d="'+(i===0?'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 Z':'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 L 30 40 Z')+'" fill="'+x.col+'"/><text x="'+(i===0?85:100)+'" y="34" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" font-family="Helvetica Neue,Arial,sans-serif">'+esc(x.t)+'</text><text x="'+(i===0?85:100)+'" y="56" text-anchor="middle" fill="rgba(255,255,255,.92)" font-size="12" font-weight="600" font-family="Helvetica Neue,Arial,sans-serif">'+x.items.length+' item'+(x.items.length===1?'':'s')+'</text></svg></div>'};
  h+='<div class="u-778010b">'+stages.map(chev).join('')+'</div>';
  var cols=function(list){var half=Math.ceil(list.length/2);var col=function(l){return '<div>'+l.map(function(i){return '<div class="gd-item">'+esc((ideas[i]||{}).name||'Unnamed')+'</div>'}).join('')+'</div>'};return '<div class="gd-cols">'+col(list.slice(0,half))+col(list.slice(half))+'</div>'};
  var lane=function(t,c,bad,inner){return '<div class="gd-lane" style="border-top-color:'+c+'"><div class="gd-lane-h"><h3 style="color:'+c+'">'+t+'</h3><span>'+bad+'</span></div>'+inner+'</div>'};
  var sub=function(l,list,col){return list.length?'<div class="gd-subh" style="color:'+col+'">'+l+' ('+list.length+')</div>'+cols(list):''};
  var bs=stages[0],now=bs.items.filter(function(i){return (ideas[i]||{}).when!=='future'}),fut=bs.items.filter(function(i){return (ideas[i]||{}).when==='future'});
  var ex=stages[1],go=ex.items.filter(function(i){return (pj[i]||{}).viable===true}),nogo=ex.items.filter(function(i){return (pj[i]||{}).viable===false}),open=ex.items.filter(function(i){var v=(pj[i]||{}).viable;return v!==true&&v!==false});
  var dv=stages[2],byS=function(a){return dv.items.filter(function(i){return a.indexOf((trk[i]||{}).status||'')>=0})},running=byS(['running','alive']),complete=byS(['complete']),paused=byS(['paused','dormant']),dead=byS(['killed','dead']),fresh=dv.items.filter(function(i){return !((trk[i]||{}).status)});
  var op=stages[3],byH=function(hh){return op.items.filter(function(i){return ((ops[i]||{}).health||'')===hh&&(trk[i]||{}).status!=='killed'})},green=byH('green'),amber=byH('amber'),red=byH('red'),opKilled=op.items.filter(function(i){return (trk[i]||{}).status==='killed'}),unrep=op.items.filter(function(i){return !((ops[i]||{}).health)&&(trk[i]||{}).status!=='killed'});
  h+=lane('Blue Sky',bs.col,badge(bs.items.length+(bs.items.length===1?' item':' items'),bs.col),bs.items.length?(sub('Now',now,bs.col)+sub('For the future',fut,'#6B7F8D')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Exploration',ex.col,badge(go.length+' Go','#1B6B5A')+badge(nogo.length+' No-Go','#9B2D3F'),ex.items.length?(sub('Go',go,'#1B6B5A')+sub('Not yet decided',open,'#6B7F8D')+sub('No-Go',nogo,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Development',dv.col,badge(running.length+' running','#2D5A8E')+badge(complete.length+' complete','#1B6B5A'),dv.items.length?(sub('Running',running,'#2D5A8E')+sub('Complete',complete,'#1B6B5A')+sub('Not yet started',fresh,'#6B7F8D')+sub('Paused',paused,'#8B5E3C')+sub('Killed',dead,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Operational',op.col,badge(green.length+' on track','#1B6B5A')+badge(amber.length+' watch','#C8860A')+badge(red.length+' at risk','#9B2D3F'),op.items.length?(sub('On track',green,'#1B6B5A')+sub('Watch',amber,'#C8860A')+sub('At risk',red,'#9B2D3F')+sub('Health not reported',unrep,'#6B7F8D')+sub('Killed',opKilled,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  /* Portfolio at a Glance follows the Operational lane at once (17 Sep 2026, Paul's ruling: no gap) */
  var bm='';try{bm=vizBalanceMap()}catch(e){bm=''}
  h+='<div class="gd-sub">Portfolio at a Glance</div><div class="analytics-grid-2">'+vizStageDonut()+vizCapitalSplit()+'</div>'+vizPortfolioMap()+vizStatusBars()+vizOwnerLoad()+(bm?'<div class="chart-card chart-card-wide"><div class="chart-title">Balance Map <span class="chart-subtitle">Risk against reward, by horizon</span></div><div style="max-width:520px">'+bm+'</div></div>':'');
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')} /* 17 Sep 2026 (Paul's ruling, third time asked): the Governance dashboard document copied \u2014 its stylesheet, its coverage card (gauge, score, label, the bars beside), its cadence cards, its systems table, its lanes \u2014 with the Pipeline\u2019s data in their places */
/* MODULE MANAGEMENT DOCUMENT (Governance, 14 Sep 2026, Paul's ruling; ported to the Innovation Pipeline 16 Sep 2026 on his word): the Track Program page prints as its own document rather than a snapshot of the tab showing. Page one: the four figures; This Week; every shared step by phase with its owners, its due date, and its state. Page two: the burn-up beside the velocity chart; the workload by member; the signals. The tab buttons, the due-date fields, and the assignment controls do not print. The Pipeline's mgSteps supplies the shared steps of Phases 1–4 */
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
function printCapHubPage(){printCapHub()} /* the Capital Planning Hub's document, reached from the Phase 5 dispatch */
var RV_WORDS={buy:'Buy',hold:'Hold',sell:'Sell'};


/* ─── GLOBAL INPUT LENGTH CAP (family drop-in — 10,000 characters; ruled 17 Aug 2026) ───
   One rule for the whole app: no text field may hold more than 10,000 characters.
   This single document-level listener covers every existing field, every page and
   modal, and every field created later. Do not add per-field maxlength attributes;
   this block is the whole mechanism. */
(function(){
  var INPUT_CHAR_CAP=10000;
  var CAPPED_INPUT_TYPES=['text','search','email','url','tel','password'];
  document.addEventListener('input',function(e){
    var el=e.target;
    if(!el||!el.tagName)return;
    if(el.getAttribute&&el.getAttribute('data-uncapped')==='1')return; /* 14 Sep 2026 (Paul's ruling): authored report copy — the Report Manager's introduction, its section notes and its text pages — has no cap. The opt-out is the field's own, so nothing else loses the rule. */
    var isTextArea=(el.tagName==='TEXTAREA');
    var isTextInput=(el.tagName==='INPUT'&&CAPPED_INPUT_TYPES.indexOf(el.type)>=0);
    if(!isTextArea&&!isTextInput)return;
    var cap=INPUT_CHAR_CAP,own=el.getAttribute?parseInt(el.getAttribute('data-char-cap'),10):NaN;
    if(own>0&&own<cap)cap=own; /* 23 Oct 2026: a field may ask for a TIGHTER cap than the family rule (data-char-cap) — the AI Guide box is 2,000. Never a looser one. */
    if(typeof el.value==='string'&&el.value.length>cap){
      el.value=el.value.slice(0,cap); /* keep the first 10,000 characters (or the field's own cap); drop the rest */
    }
  },true); /* true = capture phase: the cap runs even if other code stops the event */
})();
/* ─── END GLOBAL INPUT LENGTH CAP ─── */

/* ─── CHARACTER LIMIT — USER-FACING FEEDBACK ───────────────────────────────
   Companion to the GLOBAL INPUT LENGTH CAP block above. That block is the
   enforcement and is deliberately silent; this block is the explanation, so a
   user never loses text without being told why.

   Every capped field gets its own live counter on the line directly beneath it
   ("124 / 10,000"), kept in step with typing and pasting. The counter is a
   sibling inserted after the field, never a change to the app's own markup, and
   it is re-attached automatically after render() repaints a screen — so fields
   the app creates later are covered for free.

   It listens on `window` in the capture phase, which runs BEFORE the cap's
   document-level listener. That ordering is the whole trick: it sees the value
   at its original length and can therefore say exactly how many characters were
   dropped, then reads the final value back on the next frame.

   Three states, so the limit is never a surprise:
     under 9,000   quiet grey count
     9,000-9,999   amber — you are close
     10,000        red, plus "Limit reached — N characters not added"        */
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  var CAP       = 10000;  /* must match INPUT_CHAR_CAP above */
  var WARN_FROM = 9000;   /* 90% — amber                                    */
  var MSG_MS    = 6000;   /* how long the "limit reached" line stays up     */
  var CAPPED_INPUT_TYPES = ['text', 'search', 'email', 'url', 'tel', 'password'];

  var live, queued = false, lastAnnounced = '';

  function isCapped(el) {
    if (!el || !el.tagName) return false;
    /* A field the cap does not apply to gets no counter either: "124 / 10,000"
       under a box with no limit states a rule that is not being enforced. Same
       opt-out the enforcement block reads, so the two cannot disagree. */
    if (el.getAttribute && el.getAttribute('data-uncapped') === '1') return false;
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && CAPPED_INPUT_TYPES.indexOf(el.type) >= 0;
  }

  /* A running count under a PIN box paints the length of a secret on screen for
     anyone looking over the shoulder, and no one is near 10,000 characters
     there anyway. Password fields are still capped, and still get the
     "limit reached" line if a paste is clipped. */
  /* Sign in, Create an account and Admin — the three `.entry-form` screens —
     are the second exception, ruled 4 Sep 2026 after "0 / 10,000" turned up
     under the Username box on the sign-in card.

     A username, an organization name and a PIN are short by definition. A
     ten-thousand character budget under each of them says nothing true about
     the field, and on a card that is only a handful of controls tall it reads
     as an error rather than as help. Worse, the counter goes in as the field's
     next sibling and these templates put each field's own error slot there —
     so it wedged itself between a field and its message and gave the card a
     line it never had.

     Enforcement is untouched: these fields are still capped by the GLOBAL
     INPUT LENGTH CAP block above. What goes is the permanent running count,
     which is the part that was only ever meant for the long answer fields.
     Everywhere else in the app the family rule stands unchanged. */
  function onCredentialScreen(el) {
    /* Walked rather than el.closest(): this block runs in the harness's
       hand-rolled DOM too, which has no closest(). */
    for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) {
      if (p.classList && p.classList.contains('entry-form')) return true;
    }
    return false;
  }

  /* The field's own budget: the family 10,000, or a tighter data-char-cap
     (23 Oct 2026 — the AI Guide box is 2,000). Same reading as the
     enforcement block above, so the count and the cut cannot disagree. */
  function capOf(el) {
    var own = el && el.getAttribute ? parseInt(el.getAttribute('data-char-cap'), 10) : NaN;
    return (own > 0 && own < CAP) ? own : CAP;
  }

  function wantsCounter(el) {
    if (!isCapped(el)) return false;
    if (el.tagName === 'INPUT' && el.type === 'password') return false;
    return !onCredentialScreen(el);
  }

  function n(v) { try { return v.toLocaleString(); } catch (e) { return String(v); } }

  function styles() {
    if (document.getElementById('nc-cc-style')) return;
    var css = document.createElement('style');
    css.id = 'nc-cc-style';
    css.textContent = [
      /* One flex row: the message (only when a paste was clipped) takes the
         left, the count always sits at the right under the field's edge. */
      '.nc-cc{display:flex;align-items:baseline;justify-content:flex-end;gap:12px;',
      'width:100%;box-sizing:border-box;margin:3px 1px 0;',
      'font-family:var(--sans,system-ui,-apple-system,"Segoe UI",sans-serif);',
      'font-size:11px;line-height:1.35;font-variant-numeric:tabular-nums;',
      /* --text-mid, not --text-faint: these cards are alpha washes over the
         page, and measured on that composited ground --text-faint is 4.45:1 in
         dark — just under AA. */
      'color:var(--text-mid,#47525F);pointer-events:none;',
      /* A counter must never be the thing that widens a row. */
      'flex:0 0 100%;order:99}',
      '.nc-cc-msg{display:none;margin-right:auto;text-align:left;font-weight:600}',
      '.nc-cc.is-msg .nc-cc-msg{display:block}',
      '.nc-cc.is-warn{color:var(--warn-text,#8F6A00)}',
      '.nc-cc.is-full{color:var(--ph4-t,#9B2D3F);font-weight:600}',
      /* The two alert states sit on their own solid ground. The quiet count is
         plain text on the card, but amber and red do not clear 4.5:1 there
         (light amber 4.04, dark red 4.29) — an opaque pill fixes both and
         makes the escalation visible as shape, not colour alone. Padding is
         always present so nothing shifts when a state turns on. */
      '.nc-cc-num,.nc-cc-msg{padding:1px 6px;border-radius:6px}',
      '.nc-cc.is-warn .nc-cc-num,.nc-cc.is-full .nc-cc-num,',
      '.nc-cc.is-full .nc-cc-msg{background:var(--bg-elev,#fff)}',
      '[data-theme="dark"] .nc-cc.is-warn .nc-cc-num,',
      '[data-theme="dark"] .nc-cc.is-full .nc-cc-num,',
      '[data-theme="dark"] .nc-cc.is-full .nc-cc-msg{background:var(--ink,#242E3C)}',
      '.nc-cc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;',
      'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}'
    ].join('');
    (document.head || document.documentElement).appendChild(css);

    live = document.createElement('div');
    live.className = 'nc-cc-sr';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }

  /* The counter for a field, created and inserted on first sight. */
  function counterFor(el) {
    var c = el.nextElementSibling;
    /* classList, not className: the moment a state class lands (is-warn,
       is-full, is-msg) an equality test stops matching, and this would insert a
       SECOND counter and lose the one carrying the message. */
    if (c && c.classList && c.classList.contains('nc-cc') && c.__ncFor === el) return c;
    if (!el.parentNode) return null;
    styles();
    c = document.createElement('div');
    c.className = 'nc-cc';
    /* The live region does the announcing; read twice is worse than not at
       all, and a count re-read on every keystroke is unusable. */
    c.setAttribute('aria-hidden', 'true');
    c.__ncFor = el;
    var msg = document.createElement('span');
    msg.className = 'nc-cc-msg';
    var num = document.createElement('span');
    num.className = 'nc-cc-num';
    c.appendChild(msg);
    c.appendChild(num);
    el.parentNode.insertBefore(c, el.nextSibling);
    seatIn(el.parentNode, c);
    return c;
  }

  /* ── The counter has to sit UNDER the field, not beside it ─────
     The counter goes in as the field's next sibling, which is right when the
     parent lays its children out in a block. `.nc-cc` above carries
     `flex:0 0 100%; order:99` for the case where the parent is a flex row —
     "a counter must never be the thing that widens a row" — and that rule does
     the job only if the row is allowed to WRAP.

     A row that is not gets the opposite of the intent. `flex-wrap` defaults to
     nowrap, so a 100%-basis item that may not shrink (0 0) stays on the single
     line and claims the whole of it, and every real control is squeezed to
     nothing beside it. Responsible AI Governance is full of rows built as
     `display:flex; gap:8px` with no wrap — its Board Members row is three
     fields, a select and a remove button, its Extraordinary Meeting Criteria
     row a `flex:1` textarea and a remove button — and on those the counter
     landed on the same line, pushed itself to the right-hand edge and
     collapsed the textarea to about 28px, showing one character of its own
     placeholder. Nothing was wrong with the program's markup; it simply did
     not opt into a wrap it had no reason to know was expected.

     So the seating is arranged here rather than assumed:

       flex row   let it wrap. The counter is the only item with a 100% basis,
                  so it is the only one that moves — onto its own line under
                  the field, which is where `order:99` was already sending it.
       grid       flex-wrap means nothing to a grid, and a counter dropped into
                  a grid becomes a cell and takes a column from the layout.
                  Span the whole row instead.

     Anything else — a block, a table cell, inline — is left exactly as it was:
     the counter is a plain next sibling and nothing about the parent changes. */
  function seatIn(parent, c) {
    if (!parent || parent.nodeType !== 1 || typeof getComputedStyle !== 'function') return;
    var cs;
    try { cs = getComputedStyle(parent); } catch (e) { return; }
    if (!cs) return;
    var display = cs.display || '';
    if (display === 'flex' || display === 'inline-flex') {
      /* Only when it is not already wrapping: an author who asked for wrap
         (or wrap-reverse) has a layout that already works, and overwriting it
         would be this function inventing a change nobody needed. */
      if ((cs.flexWrap || 'nowrap') === 'nowrap') parent.style.flexWrap = 'wrap';
      return;
    }
    if (display === 'grid' || display === 'inline-grid') c.style.gridColumn = '1 / -1';
  }

  function announce(text) {
    if (!live || text === lastAnnounced) return;
    lastAnnounced = text;
    live.textContent = '';
    setTimeout(function () { if (lastAnnounced === text) live.textContent = text; }, 60);
  }

  function paint(el, justDropped) {
    if (!wantsCounter(el)) return;
    var c = counterFor(el);
    if (!c) return;
    var len = typeof el.value === 'string' ? el.value.length : 0;
    var CAP = capOf(el), WARN_FROM = Math.round(CAP * 0.9);
    var full = len >= CAP;

    c.lastChild.textContent = n(len) + ' / ' + n(CAP);
    c.classList.toggle('is-warn', !full && len >= WARN_FROM);
    c.classList.toggle('is-full', full);

    if (justDropped > 0) {
      c.firstChild.textContent = 'Limit reached — ' + n(justDropped) + ' character' +
        (justDropped === 1 ? '' : 's') + ' not added';
      c.classList.add('is-msg');
      clearTimeout(c.__ncTimer);
      c.__ncTimer = setTimeout(function () { c.classList.remove('is-msg'); }, MSG_MS);
      announce('Character limit reached. ' + n(justDropped) + ' characters were not added. ' +
        n(Math.min(len, CAP)) + ' of ' + n(CAP) + ' characters used.');
    } else if (full) {
      announce('Character limit reached. ' + n(CAP) + ' of ' + n(CAP) + ' characters used.');
    } else if (len >= WARN_FROM) {
      announce(n(CAP - len) + ' characters remaining.');
    } else {
      lastAnnounced = '';
    }
  }

  /* Attach and refresh every field currently on screen. render() replaces whole
     screens, so this runs again whenever the DOM changes. */
  function syncAll() {
    queued = false;
    /* Sweep first: if a repaint swapped a field node out, the counter that was
       following it is now orphaned. Left alone these would pile up one per
       render. */
    var old = document.querySelectorAll('.nc-cc');
    for (var j = 0; j < old.length; j++) {
      if (old[j].__ncFor !== old[j].previousElementSibling) old[j].remove();
    }
    var fields = document.querySelectorAll('input,textarea');
    for (var i = 0; i < fields.length; i++) {
      if (wantsCounter(fields[i])) paint(fields[i], 0);
    }
  }

  function scheduleSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(syncAll);
  }

  /* Capture on `window` — this runs before the cap's document listener, so the
     value here is still the full pasted length. */
  window.addEventListener('input', function (e) {
    var el = e.target;
    if (!isCapped(el)) return;
    var len = (typeof el.value === 'string') ? el.value.length : 0;
    var cap = capOf(el);
    var over = len > cap ? len - cap : 0;
    /* Next frame: the cap has run and el.value is final. */
    requestAnimationFrame(function () { paint(el, over); });
  }, true);

  /* Values the app writes itself (a load, a sync merge, a reset) fire no input
     event, so re-read on the events that do follow them. */
  window.addEventListener('change', function (e) { if (isCapped(e.target)) paint(e.target, 0); }, true);
  window.addEventListener('focusin', function (e) { if (isCapped(e.target)) paint(e.target, 0); }, true);

  function start() {
    styles();
    syncAll();
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          /* Ignore the counters this block inserts, or it would loop. */
          var t = recs[i].target;
          if (t && t.classList && t.classList.contains('nc-cc')) continue;
          scheduleSync();
          return;
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
/* ─── END CHARACTER LIMIT — USER-FACING FEEDBACK ─────────────────────────── */
