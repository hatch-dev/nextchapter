/* ─────────────────────────────────────────────────────────────
   screen-loader.js — shared infrastructure for per-screen modules
   ─────────────────────────────────────────────────────────────
   Each migrated screen lives in two files:

     <name>.html   pure markup (no inline JS — no onclick attributes)
     <name>.js     logic: calls Screens.mount('<name>', …)

   This module provides the plumbing all screen modules share:

     Screens.mount(name, container, opts)
       1. Fetches <name>.html (cached after first load)
       2. Verifies the user hasn't navigated away mid-fetch
       3. Injects the markup inside the app's zoom wrapper
       4. Wires declarative event hooks (see below)
       5. Plays the staggered .reveal animation
       6. Calls opts.afterMount(container) for screen-specific logic

   Declarative event hooks (replacing inline onclick handlers):
     data-nav="<pageId>"   → calls go(pageId)
     data-url="<href>"     → opens external URL in new tab

   Load order (index.html):
     screen-loader.js → home.js, learn.js, … → app.js

   Runs both ways:
     http(s)://  templates fetched live from the .html files
     file://     templates read from templates-local.js (browsers
                 block fetch from disk). That bundle is generated
                 from the .html files — after editing a screen's
                 .html, run `node build-templates.js` to refresh it.
   ───────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var cache = {};   // name → markup string

  /* ─── Template fetching ─────────────────────────────────── */
  // Resolution order:
  //   1. In-memory cache (after first load)
  //   2. On file:// — templates-local.js bundle (fetch is blocked
  //      by browsers when the app is opened directly from disk)
  //   3. Over http(s) — fetch <name>.html (the source of truth),
  //      falling back to the bundle if the fetch fails
  function local(name) {
    return (window.__LOCAL_TEMPLATES && window.__LOCAL_TEMPLATES[name]) || null;
  }
  function load(name) {
    if (cache[name]) return Promise.resolve(cache[name]);
    if (location.protocol === 'file:') {
      var t = local(name);
      return t ? Promise.resolve(cache[name] = t)
               : Promise.reject(new Error(name + ' missing from templates-local.js — run `node build-templates.js`'));
    }
    return fetch(name + '.html', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(name + '.html → HTTP ' + res.status);
      return res.text();
    }).then(function (html) {
      cache[name] = html;
      return html;
    }).catch(function (err) {
      var t = local(name);                 // graceful fallback
      if (t) return (cache[name] = t);
      throw err;
    });
  }

  /* ─── Event wiring ──────────────────────────────────────── */
  function wire(container) {
    // Internal navigation: data-nav="<pageId>" → go(pageId)
    container.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        go(el.dataset.nav);
      });
    });
    // External links: data-url="<href>" → open in new tab
    container.querySelectorAll('[data-url]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.open(el.dataset.url, '_blank', 'noopener');
      });
    });
  }

  /* ─── Reveal animation ──────────────────────────────────── */
  // Mirrors the staggered fade-in in app.js's dispatcher, but scoped
  // to the screen so it runs predictably after async template loads.
  function reveal(container) {
    container.querySelectorAll('.reveal').forEach(function (el, i) {
      setTimeout(function () { el.classList.add('visible'); }, i * 60);
    });
  }

  /* ─── Error card ────────────────────────────────────────── */
  function errorCard(name, err) {
    var fileProto = (location.protocol === 'file:');
    return '<div class="zoom-wrap"><div class="wrap" style="padding:120px 24px">' +
      '<h2 style="margin:0 0 8px">Couldn\u2019t load this screen</h2>' +
      '<p class="t-stone">' + (fileProto
        ? 'Running from disk, but ' + name + ' is missing from <code>templates-local.js</code>. Regenerate it with <code>node build-templates.js</code> (or serve the folder over HTTP).'
        : 'Failed to fetch ' + name + '.html \u2014 check that the file is deployed next to index.html.') +
      '</p><pre class="t-stone-13" style="opacity:.6">' + String(err && err.message || err) + '</pre>' +
      '</div></div>';
  }

  /* ─── Mount pipeline ────────────────────────────────────── */
  function mount(name, container, opts) {
    opts = opts || {};
    var pageId = opts.pageId || name;
    load(name).then(function (html) {
      // User may have navigated away — or signed out — while loading.
      if (window.currentPage !== pageId) return;
      if (typeof window.getCurrentUser === 'function' && !window.getCurrentUser()) return;
      var z = (window.UI && window.UI.zoom) || 1;
      var zs = (z && z !== 1) ? (' style="zoom:' + z + '"') : '';
      container.innerHTML = '<div class="zoom-wrap" id="zoomWrap"' + zs + '>' + html + '</div>';
      wire(container);
      reveal(container);
      if (typeof opts.afterMount === 'function') opts.afterMount(container);
    }).catch(function (err) {
      if (window.currentPage !== pageId) return;
      container.innerHTML = errorCard(name, err);
      if (window.console && console.error) console.error('[Screens]', name, err);
    });
  }

  window.Screens = { load: load, mount: mount, wire: wire, reveal: reveal };
})();
