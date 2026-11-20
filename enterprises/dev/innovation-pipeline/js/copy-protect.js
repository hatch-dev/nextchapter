/**
 * ─────────────────────────────────────────────────────────────
 * copy-protect.js — content copy protection (20 Nov 2026)
 * ─────────────────────────────────────────────────────────────
 * Every Enterprise and Leaders program, its role hub and its sign-in page.
 * Modelled on the WordPress plugin "WP Content Copy Protection & No Right
 * Click" (wordpress.org/plugins/wp-content-copy-protector), which does these
 * things on the page:
 *
 *   · no right-click menu                 (contextmenu)
 *   · no text selection                   (CSS user-select + selectstart)
 *   · no copy or cut                      (copy / cut events, Ctrl/Cmd+C, X)
 *   · no select-all, view-source, save, print shortcuts
 *                                          (Ctrl/Cmd + A, U, S, P)
 *   · no developer-tools shortcuts        (F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J/C)
 *   · no dragging images out of the page  (dragstart, -webkit-user-drag)
 *   · a short "content is protected" notice when one of these is stopped
 *
 * Plus two the plugin cannot do on a WordPress page and this app needs:
 *   · no long-press "Save image / Copy" callout on iPhone and iPad
 *   · no Download button in the program videos' controls (controlsList)
 *
 * What it deliberately leaves alone, because these programs are workbooks:
 *   · every field a person types in — <input>, <textarea>, <select> and
 *     anything contenteditable — keeps selection, copy, cut, paste, Ctrl+A
 *     and its right-click menu (spell-check suggestions live there). People
 *     paste their own drafts in and copy their own words out.
 *   · the app's own Copy buttons (AI Guide answers, temporary passwords, the
 *     Culture questionnaire): they write to the clipboard directly, or select
 *     a field first, so neither path is stopped here.
 *   · the app's own Print / ↓ PDF buttons: they call window.print() in code,
 *     which no keyboard rule touches. Only the Ctrl/Cmd+P shortcut is stopped.
 *   · anything inside an element marked data-allow-copy — the escape hatch for
 *     a block that should be copyable (e.g. a code to share).
 *
 * Not covered, by design: the launchpad, the shared sign-up, the admin console
 * (/apps/admin — administrators copy ids and addresses) and "not found".
 *
 * HONEST LIMITS. Like the plugin, this is a deterrent, not a lock. It stops
 * casual copying from the page; it cannot stop someone who disables
 * JavaScript, opens developer tools from the browser menu, saves the page from
 * the menu, reads the network traffic, or takes a screenshot. Anything that
 * must never leave the server must not be sent to the browser.
 *
 * Loaded synchronously in <head> straight after router.js (shell.html), so the
 * listeners are in place before any program content is drawn. APP_BOOT is
 * written by index.php above it.
 * ─────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ── Settings ─────────────────────────────────────────────── */
  var ROLES = { enterprises: 1, leaders: 1 };   // role slugs (config/catalogue.json) this applies to
  var NOTICE = 'This content is protected.';
  var BLOCK_DEVTOOLS_KEYS = true;               // F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J/C

  var boot = window.APP_BOOT || {};
  if (!ROLES[boot.roleSlug] || boot.kind === 'notfound') return;

  var doc = document, root = doc.documentElement;
  root.classList.add('copy-protected');

  /* ── Styles ───────────────────────────────────────────────── */
  var css =
    'html.copy-protected body{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}' +
    /* Fields must be selectable explicitly: on iOS Safari an inherited
       user-select:none can leave an <input> impossible to type in. */
    'html.copy-protected input,html.copy-protected textarea,html.copy-protected select,' +
    'html.copy-protected [contenteditable]:not([contenteditable="false"]),html.copy-protected [contenteditable] *,' +
    'html.copy-protected [data-allow-copy],html.copy-protected [data-allow-copy] *' +
    '{-webkit-user-select:text;-moz-user-select:text;user-select:text;-webkit-touch-callout:default}' +
    'html.copy-protected img,html.copy-protected video,html.copy-protected svg{-webkit-user-drag:none}' +
    '#copyProtectNotice{position:fixed;left:50%;bottom:28px;z-index:2147483646;transform:translate(-50%,12px);' +
    'padding:10px 18px;border-radius:8px;background:rgba(20,26,34,.92);color:#F4F6F9;' +
    'font:500 13px/1.3 "DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease}' +
    '#copyProtectNotice.on{opacity:1;transform:translate(-50%,0)}' +
    '@media print{#copyProtectNotice{display:none!important}}';
  var style = doc.createElement('style');
  style.id = 'copyProtectStyles';
  style.appendChild(doc.createTextNode(css));
  (doc.head || root).appendChild(style);

  /* ── Where a person is allowed to copy ────────────────────── */
  function el(node) { return node && node.nodeType === 1 ? node : (node && node.parentElement) || null; }
  function allowed(node) {
    var e = el(node);
    if (!e || !e.closest) return false;
    if (e.closest('input,textarea,select,[data-allow-copy]')) return true;
    return !!e.isContentEditable;
  }
  /* A copy can come from a field that holds the selection while the event
     targets something else (a button that selected a field, then copied). */
  function copyAllowed(e) { return allowed(e.target) || allowed(doc.activeElement); }

  /* ── The notice ───────────────────────────────────────────── */
  var noticeEl = null, noticeTimer = 0, lastShown = 0;
  function notice() {
    var now = Date.now();
    if (now - lastShown < 1200 && noticeEl && noticeEl.classList.contains('on')) return;
    lastShown = now;
    if (!doc.body) return;
    if (!noticeEl) {
      noticeEl = doc.createElement('div');
      noticeEl.id = 'copyProtectNotice';
      noticeEl.setAttribute('role', 'status');
      noticeEl.setAttribute('aria-live', 'polite');
      doc.body.appendChild(noticeEl);
    }
    noticeEl.textContent = NOTICE;
    void noticeEl.offsetWidth;   // restart the fade-in if it was already fading out
    noticeEl.classList.add('on');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { noticeEl.classList.remove('on'); }, 1800);
  }
  function stop(e, quiet) {
    e.preventDefault();
    e.stopPropagation();
    if (!quiet) notice();
    return false;
  }

  /* ── Listeners (capture phase: nothing in the app can see them first) ── */
  doc.addEventListener('contextmenu', function (e) { if (!allowed(e.target)) stop(e); }, true);
  doc.addEventListener('selectstart', function (e) { if (!allowed(e.target)) stop(e, true); }, true);
  doc.addEventListener('copy', function (e) { if (!copyAllowed(e)) stop(e); }, true);
  doc.addEventListener('cut', function (e) { if (!copyAllowed(e)) stop(e); }, true);
  doc.addEventListener('dragstart', function (e) {
    var t = el(e.target);
    // Only what the browser drags on its own (pictures, links); an element the
    // app makes draggable="true" is left to the app.
    if (t && t.matches && t.matches('img,video,svg,picture,a,img *,svg *') && t.getAttribute('draggable') !== 'true' && !allowed(t)) stop(e, true);
  }, true);

  doc.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase(), code = e.code || '';
    var mod = e.ctrlKey || e.metaKey;

    if (BLOCK_DEVTOOLS_KEYS) {
      if (key === 'f12' || code === 'F12') return stop(e);
      // Ctrl+Shift+I/J/C (Windows, Linux) and Cmd+Option+I/J/C (Mac). Option
      // changes e.key on a Mac keyboard, so read the physical key.
      if ((e.ctrlKey && e.shiftKey) || (e.metaKey && e.altKey)) {
        if (code === 'KeyI' || code === 'KeyJ' || code === 'KeyC') return stop(e);
      }
    }
    if (!mod || e.altKey) return;

    // View source and save page: never useful inside the app.
    if (key === 'u' || key === 's') return stop(e);
    // Print: the program's own Print / ↓ PDF buttons still work.
    if (key === 'p') return stop(e);
    // Select all / copy / cut: fine in a field, stopped everywhere else.
    if ((key === 'a' || key === 'c' || key === 'x') && !allowed(doc.activeElement) && !allowed(e.target)) return stop(e);
  }, true);

  /* ── Videos: no Download button in the player controls ────── */
  function noDownload(node) {
    if (!node || node.nodeType !== 1) return;
    var list = node.tagName === 'VIDEO' ? [node] : (node.getElementsByTagName ? node.getElementsByTagName('video') : []);
    for (var i = 0; i < list.length; i++) {
      var v = list[i], cl = v.getAttribute('controlslist') || '';
      if (!/\bnodownload\b/.test(cl)) v.setAttribute('controlslist', (cl + ' nodownload').trim());
    }
  }
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      for (var r = 0; r < records.length; r++) {
        var added = records[r].addedNodes;
        for (var a = 0; a < added.length; a++) noDownload(added[a]);
      }
    }).observe(root, { childList: true, subtree: true });
  }
})();
