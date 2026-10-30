/* ─────────────────────────────────────────────────────────────
   boot.js — load the active module's code and chrome
   ─────────────────────────────────────────────────────────────
   shell.html lists the SHELL: the store, sign-in, header, sidebar,
   chat, notes, coach, help — everything every program shares. It
   does not list any program's own code, because which program is
   running isn't known until the URL has been resolved.

   This file closes that gap. It reads the active module out of the
   registry and writes its <script> (and stylesheet) tags into the
   document at exactly this point in the parse, so the module's code
   is in place before app.js runs and boots the app.

   document.write is deliberate. It is the one mechanism that keeps
   these scripts SYNCHRONOUS and IN ORDER relative to the tags around
   them, which is what a codebase of plain global scripts needs —
   app.js reads the module's phases at eval time. It only ever runs
   during the initial parse (never after load), which is the case
   the technique is safe in.

   It also applies an identity to the page before first paint: the
   wordmark, the document title, and the boot loader's wording, so the
   app never flashes another program's name. Inside a module that is
   the module's; on the launchpad and the shared entry screens — which
   belong to no single program — it is the suite's.
   Modules.applyIdentity() is public and idempotent so shell.html can
   call it the moment the boot loader has been parsed, then again on
   DOMContentLoaded for the header, without a flash in between.

   CONTRACT for a module's scripts: this file lives in <head>, so a
   module's code loads BEFORE the shell's. It must therefore be inert
   at load time — register with Modules.define() and nothing else. Its
   functions may use anything the shell provides, because by the time
   the app renders, all of it is there.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (!window.Modules) {
    if (window.console) console.error('[modules] registry.js must load before boot.js');
    return;
  }

  var BOOT = window.APP_BOOT || {};
  var m = Modules.active();

  /* ── The module's code and stylesheet ─────────────────────────
     Prefer the copies the front controller stamped with each file's
     mtime — that is what retires the hand-bumped ?v= cache tags. The
     catalogue's own unstamped paths are the file:// / harness case. */
  var mod = BOOT.module || m;
  function write(html) {
    // Guard against a late call (e.g. re-running this file after load), where
    // document.write would blank the page instead of appending to it.
    if (document.readyState === 'loading') document.write(html);
  }

  /* ── The program's colours ────────────────────────────────────
     assets/css/themes.css selects a palette on [data-app] at the root.
     index.php stamps it server-side so a served page paints in the right
     colour on the very first frame; this is the fallback for the cases
     that have no front controller — file:// and the test harness — where
     the attribute would otherwise never appear and every program would
     wear the suite's orange.

     Only when a program is genuinely open: the launchpad and the entry
     screens load a module for its chrome but must not take its colours,
     so a `kind` that is not 'module' is left alone. Absent BOOT (file://)
     means a module, which is what registry.js resolves to as well. */
  try {
    var root = document.documentElement;
    if (!root.getAttribute('data-app') && (!BOOT.kind || BOOT.kind === 'module') && m && m.id) {
      root.setAttribute('data-app', m.id);
    }
  } catch (e) { }
  (mod.styles || []).forEach(function (href) {
    write('<link rel="stylesheet" href="' + href + '">');
  });
  /* `defer` (12 Oct 2026, page speed): the shell's own scripts are deferred
     too, and deferred scripts run in document order, so these — written here
     in <head> — still run before every one of them, exactly as the contract
     above needs. What changes is that they no longer hold up the first paint:
     Responsible AI Governance's program.js alone is ~250 KB compressed. */
  (mod.scripts || []).forEach(function (src) {
    write('<script src="' + src + '" defer><\/script>');
  });

  /* ── Identity ─────────────────────────────────────────────────
     A module screen wears the program's name; the launchpad and the
     shared entry screens wear the suite's, because at that point the
     visitor has not chosen a program (and may not be entitled to the
     one that happens to be loaded for its chrome). */
  var suite = BOOT.suite || {};
  function identityFor(kind) {
    return (!kind || kind === 'module')
      ? { title: m.title, name: m.name, logo: m.logo || {} }
      : { title: suite.title || suite.name, name: suite.name, logo: suite.logo || {} };
  }
  var ident = identityFor(BOOT.kind);
  /* 30 Oct 2026: the Demo tab's window reads DEMO - before the program's name */
  function shownTitle(t) { return /[?&]sample=1(&|$)/.test(location.search) ? 'DEMO - ' + t : t; }

  // Runs on DOMContentLoaded for the elements, immediately for the title.
  try { if (ident.title) document.title = shownTitle(ident.title); } catch (e) { }

  /* `kind` overrides what the URL said at load. render() passes 'module' when
     it is actually painting a program, so the wordmark can never disagree with
     the screen — the case that produced "NEXT CHAPTER" above a Pipeline home. */
  function applyIdentity(kind) {
    if (kind) {
      ident = identityFor(kind);
      try { if (ident.title) document.title = shownTitle(ident.title); } catch (e) { }
    }
    var logo = ident.logo || {};
    var el = document.querySelector('.nav-logo');
    if (el) el.innerHTML = esc(logo.lead || ident.name) + ' <span>' + esc(logo.accent || '') + '</span>';
    var bw = document.querySelector('#appBootLoader .bl-word');
    if (bw) bw.innerHTML = esc(logo.lead || ident.name) + ' <i>' + esc(logo.accent || '') + '</i>';
    var bl = document.getElementById('appBootLoader');
    if (bl) bl.setAttribute('aria-label', 'Loading ' + (ident.name || 'the application'));
  }
  Modules.applyIdentity = applyIdentity;
  // A minimal escape: this runs before app.js defines the shared one.
  function esc(s) {
    return s == null ? '' : String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Wrapped, not passed directly: the listener would hand applyIdentity the
  // Event object, which is truthy and would be read as a `kind` override.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyIdentity(); });
  } else {
    applyIdentity();
  }
})();
