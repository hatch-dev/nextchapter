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
    var isTextArea=(el.tagName==='TEXTAREA');
    var isTextInput=(el.tagName==='INPUT'&&CAPPED_INPUT_TYPES.indexOf(el.type)>=0);
    if(!isTextArea&&!isTextInput)return;
    if(typeof el.value==='string'&&el.value.length>INPUT_CHAR_CAP){
      el.value=el.value.slice(0,INPUT_CHAR_CAP); /* keep the first 10,000 characters; drop the rest */
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
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && CAPPED_INPUT_TYPES.indexOf(el.type) >= 0;
  }

  /* A running count under a PIN box paints the length of a secret on screen for
     anyone looking over the shoulder, and no one is near 10,000 characters
     there anyway. Password fields are still capped, and still get the
     "limit reached" line if a paste is clipped. */
  function wantsCounter(el) {
    return isCapped(el) && !(el.tagName === 'INPUT' && el.type === 'password');
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
    return c;
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
    var over = len > CAP ? len - CAP : 0;
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
