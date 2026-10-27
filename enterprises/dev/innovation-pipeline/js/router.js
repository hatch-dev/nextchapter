/* ─────────────────────────────────────────────────────────────
   router.js — every URL in the application, in one place
   ─────────────────────────────────────────────────────────────
   The app has ONE shell and many addresses. index.php resolved the
   address on the way in and left the answer in window.APP_BOOT; this
   file is the other direction — turning app state back into URLs, and
   keeping the address bar honest as the user moves.

     /apps/                                   launchpad — pick a role
     /apps/signup                             the one sign-up, all programs
     /apps/admin                              the app-admin console
     /apps/enterprises                        role hub — that role's six
     /apps/enterprises/innovation-pipeline    a module
     /apps/leaders/judgment-critical-thinking/login     that program's sign-in
     /apps/leaders/judgment-critical-thinking/step/1.2  a step inside one

   ── Two kinds of movement ─────────────────────────────────────
   WITHIN a module — go('step','1.2') — is a re-render, and the URL
   follows it with replaceState. No load, no history entry per click:
   the app's own Back button walks UI.navStack, and stacking a browser
   entry on every step would fight it. What the URL buys is that a
   refresh, a copied link or a bookmark comes back to the same screen.

   BETWEEN modules or roles is a real page load. Each program brings
   its own code and the browser cannot unload the one already running,
   so a load is the only way to guarantee two programs' globals are
   never live at once. See js/modules/registry.js → select().

   ── Access ────────────────────────────────────────────────────
   The front controller serves any valid URL to anyone; it holds no
   session. enforceRole() is the client half — once the app knows who
   is signed in, a URL in a role space the account is not entitled to
   sends them to their own launchpad. The authoritative check is the
   API's (see api/config/modules.php); this one only saves the user
   from a screen full of nothing.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var BOOT = window.APP_BOOT || {};

  /* The install directory, always with a trailing slash. Everything this
     file builds is rooted here, so the app is not tied to /apps/. Without
     a front controller (file://, the harness) there is no base and the
     builders below degrade to the ?module= form. */
  function base() { return BOOT.base || ''; }
  function served() { return !!BOOT.base; }

  /* What the front controller decided this page is:
     'launchpad' | 'auth' | 'role' | 'module' | 'notfound'. */
  function kind() { return BOOT.kind || (served() ? 'module' : 'module'); }
  function boot() { return BOOT; }

  /* ── Building URLs ──────────────────────────────────────── */
  function seg(s) { return encodeURIComponent(String(s)); }

  function launchpadUrl() { return base() || '?'; }

  function roleUrl(roleKey) {
    var role = window.Modules && Modules.roleByKey(roleKey);
    return role ? base() + seg(role.slug) : launchpadUrl();
  }

  /* DEV COPY, single-program mount (13 Oct 2026): installed at
     /apps/enterprises/dev/innovation-pipeline/, whose address IS the pinned
     program (index.php reads every path that way). Its own screens therefore
     carry no <role>/<module> segment; every other program keeps it. */
  function isPinned(m) { var p = BOOT.pinned; return !!(p && m && m.roleSlug === p.role && m.slug === p.module); }
  /* 16 Oct 2026: a program can have a door of its own — /apps/enterprises/dev/executive-readiness is Executive
     Readiness, served by this same install. BOOT.doors ("<role>/<module>" => its address, no trailing slash) comes
     from index.php, so every link to such a program, from either door, goes to its own address. */
  function doorOf(m) { var d = BOOT.doors; return (d && m && d[m.roleSlug + '/' + m.slug]) || ''; }

  /** /apps/<role>/<module>[/<page>[/<step>]] — the canonical address of a
      screen. Falls back to ?module= when nothing served the page. */
  function moduleUrl(moduleId, page, step) {
    var m = window.Modules && Modules.byId(moduleId);
    if (!m) return launchpadUrl();
    if (!served()) return 'index.php?module=' + seg(m.id);
    var door = doorOf(m);
    if (door) return door + (page ? '/' + seg(page) + (step ? '/' + seg(step) : '') : '');
    if (isPinned(m)) {
      if (!page) return base().replace(/\/$/, '');
      return base() + seg(page) + (step ? '/' + seg(step) : '');
    }
    var url = base() + seg(m.roleSlug) + '/' + seg(m.slug);
    if (page) url += '/' + seg(page);
    if (page && step) url += '/' + seg(step);
    return url;
  }

  /** The address of an entry screen. Two shapes, because the three screens do
      not all belong to the same thing:

      login — a PROGRAM's own door, /apps/<role>/<module>/login. Every program
      has one, so the URL carries which program (and therefore which role space)
      is being entered and the form never has to ask. Defaults to the module the
      page already loaded, which is the program the visitor asked for.

      signup and admin — the ROOT addresses, /apps/signup and /apps/admin. Both
      reach across every program, so neither can sit under one: sign-up is where
      an account decides which of the two audiences it is for (the question the
      form now asks), and the admin console spans every organization. Any
      moduleId passed for these is ignored, deliberately — a sign-up link from a
      program's sign-in screen goes to the same one shared page. */
  function authUrl(screen, moduleId) {
    screen = screen || 'login';
    if (screen === 'admin' || screen === 'admin-login') return base() + 'admin';
    if (screen === 'signup' || screen === 'setup') return base() + 'signup';
    var m = (window.Modules && (Modules.byId(moduleId) || Modules.active())) || null;
    if (!m || !m.roleSlug || !served()) return base() + seg(screen);
    if (doorOf(m)) return doorOf(m) + '/' + seg(screen);
    if (isPinned(m)) return base() + seg(screen);
    return base() + seg(m.roleSlug) + '/' + seg(m.slug) + '/' + seg(screen);
  }

  /* ── Moving ─────────────────────────────────────────────── */
  /** Open another module (a real page load — see the header comment). */
  function open(moduleId, page, step) {
    try { location.href = moduleUrl(moduleId, page, step); } catch (e) { }
  }
  function openRole(roleKey) {
    try { location.href = roleUrl(roleKey); } catch (e) { }
  }
  function openLaunchpad() {
    try { location.href = launchpadUrl(); } catch (e) { }
  }
  function openAuth(screen, moduleId) {
    try { location.href = authUrl(screen, moduleId); } catch (e) { }
  }

  /** Point the address bar at the screen the app just rendered.
      Called from go(); silent on unserved pages and on the entry screens,
      whose URL is already right. */
  function sync(page, step) {
    if (!served() || !window.history || !history.replaceState) return;
    if (kind() !== 'module') return;             // launchpad/auth own their URL
    var id = window.Modules && Modules.activeId();
    if (!id) return;
    /* A sample tab keeps ?sample=1 (Directive 2 Oct 2026, Part 3): without it a reload after any click would load
       the person's real workspace into the tab that says it holds only the private sample. */
    var q = (window.SAMPLE_MODE || window.SAMPLE_TAB_ADDR) ? '?sample=1' : '';
    try { history.replaceState(null, '', moduleUrl(id, page, step) + q); } catch (e) { }
  }

  /* ── The screen the app should open on ──────────────────── */
  /** The deep link the URL asked for, as go()'s two arguments, or null when
      the URL named no particular screen (land on the module's home). */
  function entryScreen() {
    if (kind() !== 'module' || !BOOT.page) return null;
    return { page: BOOT.page, step: BOOT.step || undefined };
  }

  /* ── Access ─────────────────────────────────────────────── */
  /** True when an account of `accountType` may use this role space. Today the
      rule is simply "your own space"; when accounts start buying across roles
      this is the one function that changes (and its server twin in
      api/config/modules.php). */
  function roleAllowed(accountType, roleKey) {
    if (!accountType) return true;               // unknown yet — don't bounce
    return accountType === roleKey;
  }

  /** Bounce a signed-in account out of a role space it cannot use, or off a
      program inside its own space that it has not been granted. Returns true
      when it redirected, so the caller can stop rendering.

      Both are cosmetic — the API refuses either on its own (moduleFrom's four
      gates) — but a screen whose every save 403s is worse than the launchpad,
      where the reason is written down. The grant check deliberately runs only
      when the answer is KNOWN: canOpenModule falls back to the whole role space
      when the registry has not warmed yet, so a slow first paint never bounces
      someone off a program they do have. */
  function enforceRole(accountType) {
    if (!served() || !accountType) return false;
    if (kind() === 'launchpad' || kind() === 'auth') return false;
    var here = window.Modules && Modules.activeRoleKey();
    if (here && !roleAllowed(accountType, here)) { openRole(accountType); return true; }

    var id = window.Modules && Modules.activeId();
    if (id && typeof canOpenModule === 'function' && !canOpenModule(id)) {
      openLaunchpad();
      return true;
    }
    return false;
  }

  /** The screen a just-authenticated account opens on: one of its own
      programs, and its Home.

      Each program has its own SIGN-IN, so the usual answer is simply "the
      program whose door you came through" — you asked for the Decision Lab, you
      signed in at the Decision Lab, you land in the Decision Lab. The rest of
      the list only matters when that program is not one this account holds (an
      enterprise account signing in at a Leaders door), and for the two root
      addresses — /apps/signup and /apps/admin — which name no program at all,
      so a brand-new account lands by rule 3 or 4:

        1. the program this page belongs to, if the account may open it;
        2. the one they last opened (Modules.select remembers it), if this
           account may still open it and it is in their own role space;
        3. otherwise the catalogue's default program, if it is one of theirs;
        4. otherwise the first LIVE program they are entitled to — a
           placeholder's "in development" screen is not somewhere to land;
        5. otherwise any program they are entitled to.

      Only an account with NO program at all falls back to the role hub, which
      is the one screen that explains why it is empty. */
  function landingUrl(accountType) {
    var role = accountType || 'enterprise';
    var mods = (window.Modules && Modules.list(role)) || [];
    var open = mods.filter(function (m) {
      return typeof canOpenModule !== 'function' || canOpenModule(m.id);
    });
    if (!open.length) return roleUrl(role);

    function first(id) { return id ? (open.filter(function (m) { return m.id === id; })[0] || null) : null; }
    var last = null;
    try { last = localStorage.getItem('pipeline-module'); } catch (e) { }
    var pick = first(BOOT.moduleId)
      || first(last)
      || first(window.Modules && Modules.DEFAULT_ID)
      || open.filter(function (m) { return m.status === 'live'; })[0]
      || open[0];
    return moduleUrl(pick.id);
  }

  /** Send a just-authenticated account there.

      A sign-in that happened INSIDE a program stays where it was, unless the
      program is in the other role's space. Returns true when it navigated, so
      the caller stops rendering: this is a page load, and painting the old
      screen first would only flash. */
  function landAfterAuth(accountType) {
    if (!served()) return false;
    if (kind() === 'auth' || kind() === 'launchpad' || kind() === 'notfound') {
      try { location.href = landingUrl(accountType); } catch (e) { }
      return true;
    }
    return enforceRole(accountType);
  }

  window.Router = {
    base: base, served: served, kind: kind, boot: boot,
    launchpadUrl: launchpadUrl, roleUrl: roleUrl, moduleUrl: moduleUrl, authUrl: authUrl,
    open: open, openRole: openRole, openLaunchpad: openLaunchpad, openAuth: openAuth,
    sync: sync, entryScreen: entryScreen,
    roleAllowed: roleAllowed, enforceRole: enforceRole,
    landingUrl: landingUrl, landAfterAuth: landAfterAuth
  };
})();
