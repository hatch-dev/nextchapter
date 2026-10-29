/* ─────────────────────────────────────────────────────────────
   registry.js — the roles and program modules this app can run
   ─────────────────────────────────────────────────────────────
   The suite is ONE application serving two audiences:

     Enterprise  /apps/enterprises/<module>   an organization and its
                                              team running a 90-day
                                              transformation program
     Leaders     /apps/leaders/<module>       an individual leader
                                              running a 90-day program

   Each role has six modules. All twelve share EVERYTHING that isn't
   the program itself — sign-in, sign-up, the admin console,
   organizations and team, the header and its Learn / Insights /
   theme / Team Chat / Notes / AI Guide actions, the sidebar chrome,
   notes, chat, printing. What differs is the content: the phases,
   the steps, the data a program collects, and its Home and Learn
   screens.

   ── Where the list lives ──────────────────────────────────────
   NOT here. config/catalogue.json is the single definition, read by
   index.php (routing), api/config/modules.php (the server allowlist)
   and the test harness. The front controller injects it into the page
   as window.APP_CATALOGUE before this file runs, so there is no fetch
   and no second copy to keep in step. This file is the API over it.

   ── The two halves of a module ────────────────────────────────
   STATIC (catalogue.json) — known before any of the module's code has
   loaded, because it says which code to load (js/modules/boot.js reads
   it through this file):

     id         STORAGE key: the workspaces.module column, the
                localStorage namespace, the coach/help scope. Frozen
                once a module has data.
     slug       URL segment. /apps/<role.slug>/<module.slug>
     status     'live' | 'planned' (planned → the shared placeholder)
     name/sub   how the switcher and the launchpad name it
     logo       the wordmark in the top-left and the sidebar
     title      document.title
     scripts    the module's code, in load order, loaded ONLY when
                this module is the active one
     styles     optional extra stylesheet, loaded after the shared one
     templates  screens whose markup this module overrides
                (templates/modules/<id>/<name>.html)

   RUNTIME — phases, milestones, the empty data document, the page
   renderers — registered by the module's own script through
   Modules.define(). See js/modules/pipeline/module.js for the
   reference implementation.

   ── Which module is running ───────────────────────────────────
   The URL decides, and index.php has already resolved it into
   window.APP_BOOT. There is no client-side guessing on a served page.
   The ?module=<id> / remembered-choice fallback below only runs when
   APP_BOOT is absent — opening the app from disk (file://) or under
   the Node test harness, neither of which has a front controller.

   To add a module: append an entry to config/catalogue.json, create
   js/modules/<id>/module.js calling Modules.define(), flip status to
   'live'. The server allowlist, the router, the launchpad and the
   switcher all read the catalogue, so nothing else needs editing.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── The catalogue ────────────────────────────────────────
     Injected by index.php. The empty fallback keeps a mis-served page
     from throwing at parse time; every accessor below degrades to
     something renderable rather than crashing the shell. */
  var ROLES = (window.APP_CATALOGUE && window.APP_CATALOGUE.length) ? window.APP_CATALOGUE : [];
  var BOOT = window.APP_BOOT || null;

  var DEFAULT_ROLE = 'enterprise';
  var DEFAULT_ID = 'pipeline';

  /* Flat list of every module in every role, each stamped with the role it
     belongs to — the lookup most callers actually want. */
  var ALL = [];
  for (var r = 0; r < ROLES.length; r++) {
    var mods = ROLES[r].modules || [];
    for (var i = 0; i < mods.length; i++) {
      mods[i].role = ROLES[r].key;
      mods[i].roleSlug = ROLES[r].slug;
      ALL.push(mods[i]);
    }
  }

  function roles() { return ROLES; }
  function all() { return ALL; }

  function roleByKey(key) {
    for (var i = 0; i < ROLES.length; i++) if (ROLES[i].key === key) return ROLES[i];
    return null;
  }
  function roleBySlug(slug) {
    for (var i = 0; i < ROLES.length; i++) if (ROLES[i].slug === slug) return ROLES[i];
    return null;
  }
  function byId(id) {
    if (!id) return null;
    for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i];
    return null;
  }
  function bySlug(roleSlug, moduleSlug) {
    var role = roleBySlug(roleSlug);
    if (!role) return null;
    var mods = role.modules || [];
    for (var i = 0; i < mods.length; i++) if (mods[i].slug === moduleSlug) return mods[i];
    return null;
  }
  /** The modules of one role, or of the active role when called bare —
      this is the list the header switcher and the role hub show. */
  function list(roleKey) {
    var role = roleByKey(roleKey || activeRoleKey());
    return (role && role.modules) || [];
  }

  /* ── Which module and role are running ────────────────────
     Resolved once. The answer decided which code was loaded, so it
     cannot change without a page load. */
  var _activeId = null;
  function activeId() {
    if (_activeId) return _activeId;
    var id = '';
    if (BOOT && BOOT.moduleId) {
      id = BOOT.moduleId;                       // served page: the URL already decided
    } else {
      // file:// or the harness — no front controller resolved the route.
      try {
        var m = /[?&]module=([^&]+)/.exec(location.search || '');
        if (m) id = decodeURIComponent(m[1]);
      } catch (e) { }
      if (!byId(id)) {
        try { id = localStorage.getItem('pipeline-module') || ''; } catch (e) { id = ''; }
      }
    }
    if (!byId(id)) id = DEFAULT_ID;
    if (!byId(id) && ALL.length) id = ALL[0].id;
    return (_activeId = id);
  }
  function active() { return byId(activeId()) || ALL[0] || {}; }
  function isActive(id) { return id === activeId(); }

  /** The role space the page is in. On the launchpad or an entry screen no
      module is showing, so APP_BOOT names the role directly; inside a module
      it is that module's role. */
  function activeRoleKey() {
    if (BOOT && BOOT.role) return BOOT.role;
    var m = byId(activeId());
    return (m && m.role) || DEFAULT_ROLE;
  }
  function activeRole() {
    return roleByKey(activeRoleKey()) || ROLES[0] ||
      { key: DEFAULT_ROLE, slug: 'enterprises', name: 'Enterprise', modules: [] };
  }
  function roleOf(moduleId) {
    var m = byId(moduleId);
    return m ? roleByKey(m.role) : null;
  }

  /* ── The runtime half ─────────────────────────────────────
     A module's own script calls Modules.define('<id>', {...}) as it
     loads. Only the active module's script is on the page, so there
     is exactly one runtime and no chance of two programs' globals
     colliding. */
  var _runtime = null;
  function define(id, def) {
    if (!isActive(id)) return;           // defensive: a stray script can't take over
    _runtime = def || {};
    _runtime.id = id;
  }
  function runtime() { return _runtime; }

  /* The "? Help" guide. Its own call because it is a large, self-contained
     document that lives in its own file (js/modules/<id>/help.js) rather than
     bloating the module's main script. Loaded after module.js. */
  function defineHelp(id, doc) {
    if (!isActive(id) || !_runtime) return;
    _runtime.help = doc;
  }
  function help() { return (_runtime && _runtime.help) || null; }

  /* Accessors the shell uses instead of reaching into the runtime, so a
     half-built module degrades to something renderable rather than throwing. */
  function PH() { return (_runtime && _runtime.PH) || []; }
  function MILESTONES() { return (_runtime && _runtime.MILESTONES) || {}; }
  function PHASE_WRAPUPS() { return (_runtime && _runtime.PHASE_WRAPUPS) || {}; }
  function emptyData() { return (_runtime && _runtime.emptyData) ? _runtime.emptyData() : {}; }
  function coachGreeting() {
    return (_runtime && _runtime.coachGreeting) ||
      'Welcome. I’m your guide through this module — ask me about any step or framework.';
  }
  /* The rest of the AI Guide, for a program whose coach is more than a
     greeting. Null means "use the shell's", which is the Pipeline's text and
     what every Enterprise program has shipped with.

       coachPresets  the quick-question chips: an array of strings, or of
                     {label, text} when the chip should read shorter than the
                     question it asks
       coachSystem   the system prompt — who the guide is and what it knows

     Either may be a FUNCTION, evaluated at the moment the panel is drawn. The
     Leaders programs need that: their guide is coaching one decision, so both
     the chips ("Help me build my case" until there is one, then "Challenge my
     case") and the prompt (which carries the answers written so far) depend on
     what is on screen. A plain value is fine for a program whose guide does
     not change with the page.

     The third piece, what the reader is looking at right now, is a hook
     (`coachContext`) because it is always a reading of live state. */
  function resolve(v) { return typeof v === 'function' ? v() : v; }
  function coachPresets() { return resolve(_runtime && _runtime.coachPresets) || null; }
  function coachSystem() { return resolve(_runtime && _runtime.coachSystem) || null; }
  /* The name the guide goes by (Directive_DEV_AllModules_AskDanni_28Oct2026): a program that sets coachName
     shows "Ask <name>" on the guide's button and panel title, and <name> above the guide's replies. Null keeps
     "AI Guide", which is what the Leaders programs still show. */
  function coachName() { return (_runtime && _runtime.coachName) || null; }
  /* How a phase's steps are grouped in the sidebar. Most programs are one flat
     list, which is the default here; Executive Readiness pulls its per-phase
     individual step out into a "Leadership Development" strand, because that
     step is the leader's own work rather than the organization's. The shell
     renders whatever shape comes back, so a program can name its own strands
     without the sidebar having to know any program's step ids. */
  function stepStrands(ph) {
    var f = _runtime && _runtime.stepStrands;
    var out = (typeof f === 'function') ? f(ph) : null;
    if (!out || !out.main) return { main: (ph && ph.steps) || [], strands: [] };
    return { main: out.main, strands: out.strands || [] };
  }

  /* The sample workspaces this program offers, as [{id, label, run}].
     Empty for a program that has none, which is the honest answer for the ten
     planned ones — the More menu then shows no seed item at all rather than a
     button that fills their workspace with another program's document.

     A seed is the program's own content by definition: the Pipeline's builds
     ideas, projects and a capital envelope; Executive Readiness's builds
     leaders, an org chart and a scored assessment battery. Neither document
     shares a single field with the other, so there is nothing here for the
     shell to supply — only a list for it to offer and a function to call.

     run() returns false if the operator declined the confirm; the caller
     (runSeed, js/dev/seed.js) then leaves the workspace alone. */
  function seeds() {
    var list = (_runtime && _runtime.seeds) || [];
    return list.filter(function (s) { return s && s.id && typeof s.run === 'function'; });
  }

  /* Extra entries this program contributes to the header's More menu, as
     [{id, label, run}] — same shape as seeds() above, and empty for a program
     that adds none, which is every Enterprise program so far.

     The menu's own items (zoom, Voice, Profile, Export/Import state, Reset)
     are the shell's and belong to every program. This is for an action only
     one program has: The Decision Lab's two "Export AI State" files, which
     write out the working document as markdown to paste into a chat. There is
     nowhere else in the chrome to put them, and building a second menu for two
     buttons would give the same program two More menus. */
  function moreItems() {
    var list = (_runtime && _runtime.moreItems) || [];
    return list.filter(function (s) { return s && s.id && typeof s.run === 'function'; });
  }

  /* A named function the active module supplies to REPLACE or PRECEDE a piece
     of shell behaviour, or null when it supplies none. Same idea as page()
     above, one level down: the shell asks, and falls back to its own version
     when nothing answers.

     Kept to behaviour a program genuinely cannot share. Two so far:

       isStepDone(id)   Executive Readiness stores the four individual-track
                        steps against the leader who did them, not against the
                        organization, so "is this done" is not a lookup in
                        data.completedSteps for every program.
       beforeNavigate() its step forms carry no per-keystroke save; the open
                        page is harvested at the moment of navigation instead.

     A module opting out of both is the normal case and costs nothing — the
     Pipeline defines neither. */
  function hook(name) {
    var f = _runtime && _runtime[name];
    return typeof f === 'function' ? f : null;
  }

  /* The renderer for a page id, or null when this module doesn't have that
     page (the shell then falls back to its own route table). */
  function page(name) {
    var p = _runtime && _runtime.pages && _runtime.pages[name];
    return typeof p === 'function' ? p : null;
  }
  /* True when this module ships its own markup for a shared screen. */
  function hasTemplate(name) {
    var t = active().templates || [];
    return t.indexOf(name) >= 0;
  }
  /* Where a screen's markup lives for the active module. The Pipeline keeps
     the original flat paths so nothing about it moved. */
  function templatePath(name) {
    return activeId() === DEFAULT_ID || !hasTemplate(name)
      ? 'templates/' + name + '.html'
      : 'templates/modules/' + activeId() + '/' + name + '.html';
  }
  /* Key into the templates-local.js bundle (file:// mode). */
  function templateKey(name) {
    return activeId() === DEFAULT_ID || !hasTemplate(name) ? name : activeId() + ':' + name;
  }

  /* ── Switching ────────────────────────────────────────────
     A module switch is a page load, not an in-place swap: each program
     brings its own code, and the browser has no way to unload the one
     already on the page. The load is cheap and invisible — same shell,
     same session (sessionStorage survives), same header — and it
     guarantees two programs' globals are never live at once. The choice
     is remembered so a bare file:// open lands back here. */
  function select(id) {
    var m = byId(id);
    if (!m) return;
    if (typeof closeNavModules === 'function') closeNavModules();
    if (id === activeId()) return;
    try { localStorage.setItem('pipeline-module', id); } catch (e) { }
    if (window.Router) { Router.open(id); return; }
    try { location.href = (location.pathname || '') + '?module=' + encodeURIComponent(id); } catch (e) { }
  }

  window.Modules = {
    // the catalogue
    roles: roles, all: all, list: list, byId: byId, bySlug: bySlug,
    roleByKey: roleByKey, roleBySlug: roleBySlug, roleOf: roleOf,
    // what is running
    activeId: activeId, active: active, isActive: isActive,
    activeRole: activeRole, activeRoleKey: activeRoleKey,
    // the runtime half
    define: define, runtime: runtime, select: select,
    defineHelp: defineHelp, help: help,
    PH: PH, MILESTONES: MILESTONES, PHASE_WRAPUPS: PHASE_WRAPUPS,
    emptyData: emptyData, coachGreeting: coachGreeting, page: page, hook: hook,
    coachPresets: coachPresets, coachSystem: coachSystem, coachName: coachName,
    stepStrands: stepStrands, seeds: seeds, moreItems: moreItems,
    hasTemplate: hasTemplate, templatePath: templatePath, templateKey: templateKey,
    DEFAULT_ID: DEFAULT_ID, DEFAULT_ROLE: DEFAULT_ROLE
  };
})();
