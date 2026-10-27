/* ─────────────────────────────────────────────────────────────
   nav.js — Top navigation bar (tabs + right-side actions + More menu)
   ─────────────────────────────────────────────────────────────
   Extracted out of app.js's render() into the per-screen module
   pattern (markup in nav.html, logic here), mirroring auth.js.

   The nav is persistent chrome, not a screen you route to: it is
   injected into the two fixed containers #navTabs and #navRight on
   every render(). app.js's render() calls Nav.render() for the
   signed-in state; the entry-gate path clears the containers itself.

   Public API (window.Nav):
     Nav.render()   rebuild + hydrate the tabs and right-side actions

   Wiring: one delegated click listener on <nav> reads data-tab /
   data-act (see ACTIONS), so re-injecting innerHTML never loses
   handlers and there is no inline JS in the markup. The existing
   mousedown outside-close listener in app.js still targets
   .nav-more-wrap, which this markup preserves — and .nav-user-wrap
   for the account menu behind the user chip, which must NOT reuse
   that class (see hydrateRight).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var TPL = '';
  var _tabsHtml = null, _rightHtml = null;   // parsed once from TPL; invalidated on refresh

  /* ── Template: sync seed from the bundle, refresh from nav.html ── */
  TPL = (window.__LOCAL_TEMPLATES && window.__LOCAL_TEMPLATES.nav) || '';
  if (window.Screens && Screens.load) {
    Screens.load('nav').then(function (html) {
      if (html && html !== TPL) { TPL = html; _tabsHtml = _rightHtml = null; if (window.render) window.render(); }
    }).catch(function () { /* keep the seeded copy */ });
  }
  function ensureParsed() {
    if (_tabsHtml !== null) return;
    var d = document.createElement('div'); d.innerHTML = TPL || '';
    var t = d.querySelector('[data-region="tabs"]'), r = d.querySelector('[data-region="right"]');
    _tabsHtml = t ? t.innerHTML : '';
    _rightHtml = r ? r.innerHTML : '';
  }

  /* ── Tabs ─────────────────────────────────────────────────── */
  // A tab is active for its own page, plus the sub-pages that live under it.
  // A step belongs to the tab its PHASE belongs to, so 5.x lights the last tab
  // (Navigate / Lead) rather than the program tab every other step sits under.
  function tabActive(id) {
    /* Which tab owns the page on screen. The rules below are the shell's five
       tabs over the shell's page ids; a program that routes to pages of its own
       (the Leaders programs' Assess / Practice / Dashboard) answers for itself
       and gets asked first. Returning nothing falls through, so a hook only has
       to speak up about the pages it actually knows. */
    var own = window.Modules && Modules.hook('tabFor');
    if (own) {
      var t = own(currentPage, currentStep);
      if (t) return t === id;
    }
    var p5step = (currentPage === 'step' && String(currentStep || '').indexOf('5.') === 0);
    if (p5step) return id === 'phase5';
    return currentPage === id
      || (currentPage === 'step' && id === 'pipeline')
      || (currentPage === 'phase' && id === 'pipeline')
      || (currentPage === 'outcome' && id === 'pipeline')
      || (currentPage === 'cap-hub' && id === 'phase5');
  }

  /* The tab STRIP. nav.html ships the shell's five — home, learn, pipeline,
     phase5, insights — and for the Enterprise programs that set is exactly
     right: only the wording follows the module (the Pipeline's "Pipeline /
     Navigate" is Executive Readiness's "Readiness / Lead").

     The Leaders programs do not fit it. Their shape is Assess → Practice →
     Dashboard, six tabs over page ids the shell has never heard of, so the
     strip is rebuilt from the catalogue's `tabs` map when that map names a
     different set. Key order in the JSON is the order on screen.

     Rebuilt only when it differs, so the two Enterprise programs keep the
     markup that came out of nav.html, attributes and all. */
  function retabIfNeeded(nt, labels) {
    var want = [];
    for (var k in labels) if (Object.prototype.hasOwnProperty.call(labels, k)) want.push(k);
    if (!want.length) return;
    var have = [];
    nt.querySelectorAll('[data-tab]').forEach(function (b) { have.push(b.getAttribute('data-tab')); });
    if (have.length === want.length && have.join('|') === want.join('|')) return;
    nt.innerHTML = want.map(function (id) {
      return '<button class="nav-tab" data-tab="' + esc(id) + '">' + esc(labels[id]) + '</button>';
    }).join('');
  }

  function hydrateTabs(nt) {
    var labels = (window.Modules && Modules.active().tabs) || {};
    retabIfNeeded(nt, labels);
    nt.querySelectorAll('[data-tab]').forEach(function (b) {
      var id = b.dataset.tab;
      if (labels[id]) b.textContent = labels[id];
      b.classList.toggle('active', tabActive(id));
    });
  }

  /* ── Module switcher ──────────────────────────────────────── */
  // Registry lives in js/features/modules.js; this only renders it.
  function hydrateModules(nr) {
    if (!window.Modules) return;
    var cur = Modules.active();
    var nameEl = nr.querySelector('[data-slot="module-name"]');
    if (nameEl) nameEl.textContent = cur ? cur.name : '';

    var btn = nr.querySelector('[data-act="modules"]');
    if (btn) {
      btn.classList.toggle('nav-module-open', !!UI.navModules);
      btn.setAttribute('aria-expanded', UI.navModules ? 'true' : 'false');
    }
    var menu = nr.querySelector('[data-slot="module-menu"]');
    if (menu) menu.innerHTML = UI.navModules ? moduleMenuHtml(cur) : '';
  }

  /* The switchable-programs list. Shared verbatim by the header dropdown and
     the drawer — one filter, one set of flags, so the two can never disagree
     about which programs this account may open. */
  function moduleListHtml() {
    /* Only the account's OWN role space. Modules.list() is role-scoped, so an
       Enterprise header never offers a Leaders program the API would refuse —
       the other six are reachable from the launchpad, where the reason they
       are unavailable can actually be explained. */
    /* And only the programs this account was actually GIVEN. The switcher is a
       list of doors you can walk through; one that opens onto a 403 is worse
       than one that is not there. The launchpad still lists the rest, greyed,
       because that is the screen where "not in your plan" can be explained. */
    return Modules.list().filter(function (m) {
      return typeof canOpenModule !== 'function' || Modules.isActive(m.id) || canOpenModule(m.id);
    }).map(function (m, i) {
      var isCur = Modules.isActive(m.id);
      var soon = !isCur && m.status === 'planned';   // catalogued but not built yet
      var cls = 'nav-module-item' + (isCur ? ' nav-module-item-on' : '') + (soon ? ' nav-module-item-soon' : '');
      return '<button class="' + cls + '" role="menuitem" data-act="module-pick" data-module="' + esc(m.id) + '"'
        + (soon ? ' disabled aria-disabled="true"' : '') + '>'
        + '<span class="nav-module-num">' + ('0' + (i + 1)).slice(-2) + '</span>'
        + '<span class="nav-module-text">'
        + '<span class="nav-module-item-name">' + esc(m.name) + '</span>'
        /* The discipline line, not the long sentence — the same kicker the
           marketing site and the launchpad set under each program's name, so
           the three places these twelve are listed all read alike. `sub` is
           the fallback for anything catalogued without a tag. */
        + '<span class="nav-module-item-sub">' + esc(m.tag || m.sub || '') + '</span>'
        + '</span>'
        + (isCur ? '<span class="nav-module-flag">Current</span>' : (soon ? '<span class="nav-module-flag nav-module-flag-soon">Soon</span>' : '<span class="nav-module-go" aria-hidden="true">&rarr;</span>'))
        + '</button>';
    }).join('');
  }

  function moduleMenuHtml(cur) {
    var role = Modules.activeRole() || {};
    var all = (window.Router && Router.launchpadUrl()) || '';
    return '<div class="nav-more-backdrop" data-act="close-modules"></div>' +
      '<div class="nav-module-menu" role="menu" aria-label="Switch module">' +
      '<div class="nav-module-head">' + esc(role.name || 'Switch') + ' programs</div>' +
      moduleListHtml() +
      (all ? '<a class="nav-module-all" role="menuitem" href="' + esc(all) + '">All programs &rarr;</a>' : '') +
      '</div>';
  }

  /* ── Right side (user chip · actions · More menu) ─────────── */
  function hydrateRight(nr) {
    var cu = getCurrentUser();
    hydrateModules(nr);
    var chip = nr.querySelector('[data-slot="userchip"]');
    if (chip) {
      /* The chip is a MENU, not a sign-out button. It used to sign out on first
         click, which put the most destructive action in the top bar under the
         lightest gesture and left the account's own two screens — the
         organization, and the work assigned to them — reachable only from More.
         Sign Out is still here, still with its confirm; it is now the third
         item rather than the whole control (js/features/my-assignments.js).

         Its own wrapper class, NOT nav-more-wrap: the outside-click closer in
         app.js finds the More menu with querySelector('.nav-more-wrap'), which
         returns the FIRST one in the document — so a second element carrying
         that class ahead of the More button would make every click inside the
         More menu read as a click outside it. */
      chip.innerHTML = (cu || isAppAdmin)
        ? '<span class="nav-user-wrap">'
            + '<div class="nav-user-chip' + (UI.userMenu ? ' nav-user-chip-on' : '') + '"' + ' data-act="usermenu"' /* Sweep 4R item 9: the sample tab has the account menu too, holding only Sign Out */
            + ' title="' + (isAppAdmin ? 'App administrator - account menu' : 'Account menu') + '"'
            + ' aria-haspopup="true" aria-expanded="' + (UI.userMenu ? 'true' : 'false') + '">'
            + (isAppAdmin ? userAv({ initials: 'AD', color: '#9B2D3F' }, 26) : userAv(cu, 26))
            + '<div class="nav-user-name">' + (isAppAdmin ? 'Admin' : esc(cu.name.split(' ')[0]))
            + '<span class="nav-user-caret" aria-hidden="true">&#9662;</span></div></div>'
            + (UI.userMenu ? userMenuHtml() : '')
          + '</span>'
        : '';
    }
    var themeLbl = nr.querySelector('[data-slot="theme-label"]');
    if (themeLbl) themeLbl.textContent = (UI.theme === 'dark' ? 'Light Mode' : 'Dark Mode');

    var gb = nr.querySelector('#gchatNavBtn'); if (gb) gb.classList.toggle('nav-action-on', !!gchatOpen);
    var gu = nr.querySelector('#gchatUnread'); if (gu) { gu.textContent = gchatUnreadCount; gu.style.display = gchatUnreadCount > 0 ? '' : 'none'; }

    var nb = nr.querySelector('#notesNavBtn'); if (nb) nb.classList.toggle('nav-action-on', !!notesOpen);
    var demoHere = !!(window.sampleAppliesHere && sampleAppliesHere());
    var dmb = nr.querySelector('#sampleNavBtn'); if (dmb) dmb.style.display = (demoHere && !SAMPLE_MODE) ? '' : 'none';
    if (nb) nb.style.display = demoHere ? 'none' : '';
    if (gb) gb.style.display = SAMPLE_MODE ? 'none' : '';
    var mwr = nr.querySelector('.nav-module-wrap'); if (mwr) mwr.style.display = SAMPLE_MODE ? 'none' : '';
    var nc = nr.querySelector('#notesCount'); if (nc) { nc.textContent = notesData.length; nc.style.display = notesData.length ? '' : 'none'; }

    var mb = nr.querySelector('[data-act="more"]');
    if (mb) { mb.classList.toggle('nav-action-on', !!UI.navMore); mb.setAttribute('aria-expanded', UI.navMore ? 'true' : 'false'); }

    /* The hamburger stands in for this whole region below 820px, so anything
       that would have announced itself on a chip has to announce itself here:
       unread Team Chat messages are the only thing in the drawer that arrives
       on its own. Notes gets no dot — that number is how many notes exist, not
       news. */
    var db = nr.querySelector('[data-act="drawer"]');
    if (db) {
      db.setAttribute('aria-expanded', UI.navDrawer ? 'true' : 'false');
      db.classList.toggle('nav-drawer-btn-on', !!UI.navDrawer);
      db.classList.toggle('nav-drawer-btn-dot', gchatUnreadCount > 0);
      db.setAttribute('aria-label', gchatUnreadCount > 0 ? ('Menu — ' + gchatUnreadCount + ' unread') : 'Menu');
    }
    var mm = nr.querySelector('[data-slot="more-menu"]');
    if (mm) mm.innerHTML = UI.navMore ? moreMenuHtml() : '';
  }

  /* The account menu behind the chip. Three items, and each one is offered only
     to an account it means something for:

       Org Profile        the same Organization & Team modal as More → Profile,
                          and hidden for the app administrator for the same
                          reason it is hidden there — they belong to no org.
       View Assignments   only where there is an assignment system to list:
                          a signed-in member, in a program with a phase spine
                          (asgnAvailable, js/features/my-assignments.js).
       Sign Out           always, unchanged, confirm and all.

     Built from the shell's nav-more-* classes so it is the same menu the More
     button opens, in a different place — nothing here is styled twice. */
  function userMenuHtml() {
    if (SAMPLE_MODE) return '<div class="nav-more-backdrop" data-act="close-usermenu"></div><div class="nav-more-menu" role="menu" aria-label="Account"><button class="nav-more-item" role="menuitem" data-act="signout"><span class="nav-more-ic">&#8594;</span> Sign Out</button></div>';   /* Sweep 4R item 9: the sample tab's account menu: Sign Out, which closes the sample */
    return '<div class="nav-more-backdrop" data-act="close-usermenu"></div>' +
      '<div class="nav-more-menu" role="menu" aria-label="Account">' +
      (isAppAdmin ? '' : '<button class="nav-more-item" role="menuitem" data-act="user-profile"><span class="nav-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span> Org Profile</button>') +
      ((typeof asgnAvailable === 'function' && asgnAvailable())
        ? '<button class="nav-more-item" role="menuitem" data-act="user-assignments"><span class="nav-more-ic">&#9776;</span> View Assignments</button>'
        : '') +
      '<div class="nav-more-sep"></div>' +
      '<button class="nav-more-item" role="menuitem" data-act="signout"><span class="nav-more-ic">&#8594;</span> Sign Out</button>' +
      '</div>';
  }

  /* Seeds and a program's own More items appear in both the header menu and
     the drawer, so each one is built once and the caller says which shape it
     wants. Same data-act, same data attributes; only the row class differs. */
  function seedsData() {
    /* js/dev/seed.js is the dev-only file that runs them, and its own header
       says it need not ship. Without it there is nothing to run, so offer
       nothing — rather than a menu item that throws when pressed. */
    if (typeof runSeed !== 'function') return [];
    return (window.Modules && Modules.seeds()) || [];
  }

  function seedItemsHtml() {
    return seedsData().map(function (s) {
      return '<button class="nav-more-item" role="menuitem" data-act="seed" data-seed="' + esc(s.id) + '">'
        + '<span class="nav-more-ic">&#8635;</span> ' + esc(s.label || 'Seed sample data') + '</button>';
    }).join('');
  }

  function seedRowsHtml() {
    return seedsData().map(function (s) {
      return '<button class="nav-dr-row" data-act="seed" data-seed="' + esc(s.id) + '">'
        + '<span class="nav-dr-ic">&#8635;</span>'
        + '<span class="nav-dr-label">' + esc(s.label || 'Seed sample data') + '</span></button>';
    }).join('');
  }

  /* Actions only the active program has (Modules.moreItems). Rendered beside
     the seeds and wired the same way, so a program adds an entry by declaring
     it and nothing here needs editing. */
  function moduleItemsHtml() {
    var items = (window.Modules && Modules.moreItems()) || [];
    return items.map(function (m) {
      return '<button class="nav-more-item" role="menuitem" data-act="module-item" data-item="' + esc(m.id) + '">'
        + '<span class="nav-more-ic">' + (m.icon || '&#8595;') + '</span> ' + esc(m.label || m.id) + '</button>';
    }).join('');
  }

  function moduleRowsHtml() {
    var items = (window.Modules && Modules.moreItems()) || [];
    return items.map(function (m) {
      return '<button class="nav-dr-row" data-act="module-item" data-item="' + esc(m.id) + '">'
        + '<span class="nav-dr-ic">' + (m.icon || '&#8595;') + '</span>'
        + '<span class="nav-dr-label">' + esc(m.label || m.id) + '</span></button>';
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     MOBILE NAVIGATION DRAWER
     ═══════════════════════════════════════════════════════════
     Everything in the right-hand region of the header — the program switcher,
     the account chip and the More menu — becomes one sheet on a phone, rather
     than three dropdowns competing for a bar 366px wide. Below 820px the chips
     are hidden and a single hamburger opens this.

     Why a drawer rather than smaller chips: <nav> is position:fixed, so the
     moment the cluster is wider than the bar its tail leaves the screen with
     no scroll to reach it — at 390px that took Team Chat, Notes and the More
     button itself off the right edge. Shrinking buys a few pixels and loses
     them again to the next long program or account name. A sheet has its own
     height and its own scroll, so it cannot run out of room.

     THE 820 IS STATED TWICE — here as NARROW_NAV, and as the @media block in
     assets/css/styles.css that hides the chips and shows the hamburger. Change
     one and you change the other, or the controls are duplicated or gone.

     The rows carry the SAME data-act values as the chips and menu items they
     replace, so the delegated listener runs them unchanged; nothing here is
     wired twice or forked into a mobile copy. */
  var NARROW_NAV = '(max-width:820px)';

  function navIsNarrow() {
    try { return !!(window.matchMedia && window.matchMedia(NARROW_NAV).matches); }
    catch (e) { return false; }
  }

  function drawerRow(act, icon, label, extra, on, cls) {
    return '<button class="nav-dr-row' + (on ? ' nav-dr-row-on' : '') + (cls ? ' ' + cls : '') + '" data-act="' + act + '">'
      + '<span class="nav-dr-ic">' + icon + '</span>'
      + '<span class="nav-dr-label">' + label + '</span>'
      + (extra || '') + '</button>';
  }

  /* A count belongs on the row it counts, where there is room to read it —
     not floated off the corner of a chip that is no longer on screen. */
  function drawerCount(n2) {
    return n2 > 0 ? '<span class="nav-dr-count">' + n2 + '</span>' : '';
  }

  function drawerSection(title, body) {
    return body ? '<div class="nav-dr-sec"><div class="nav-dr-sec-head">' + title + '</div>' + body + '</div>' : '';
  }

  function drawerHtml() {
    var cu = getCurrentUser();
    var role = (window.Modules && Modules.activeRole()) || {};
    var cur = (window.Modules && Modules.active()) || {};
    var z = UI.zoom || 1;

    /* Account: the chip's own menu, opened out. Same avatar, and its items keep
       the conditions they have in the header — no org screens for the app
       administrator, no assignments where the program has no assignment
       system. */
    var account = ((cu || isAppAdmin) && !SAMPLE_MODE)
      ? '<div class="nav-dr-user">'
          + (isAppAdmin ? userAv({ initials: 'AD', color: '#9B2D3F' }, 40) : userAv(cu, 40))
          + '<div class="nav-dr-user-txt">'
          + '<div class="nav-dr-user-name">' + (isAppAdmin ? 'Admin' : esc(cu.name || '')) + '</div>'
          + '<div class="nav-dr-user-role">' + (isAppAdmin ? 'App administrator' : esc((cu && cu.role) || '')) + '</div>'
          + '</div>'
          /* Sign Out belongs to the account, so it sits ON the account — beside
             the name it signs out of, reachable without scrolling the sheet.
             It used to be the last row at the bottom, four sections down past
             the program switcher. There is only ever ONE of these: the same
             action offered twice in one panel is noise, not convenience. */
          + '<button class="nav-dr-signout" data-act="signout" title="Sign out">'
            + '<span class="nav-dr-signout-ic" aria-hidden="true">&#8594;</span> Sign Out</button>'
          + '</div>'
          + (isAppAdmin ? '' : drawerRow('user-profile', '&#9679;', 'Organization &amp; Team'))
          + ((typeof asgnAvailable === 'function' && asgnAvailable())
              ? drawerRow('user-assignments', '&#9776;', 'My Assignments') : '')
          + (SAMPLE_MODE ? '' : drawerRow('user-password', '&#9679;', 'Change password'))
      : '';

    /* The program switcher as a list, not a dropdown inside a dropdown. Same
       source and same filter as the header's menu — see moduleListHtml. */
    var programs = SAMPLE_MODE ? '' : moduleListHtml();
    var all = (window.Router && Router.launchpadUrl()) || '';

    var actions =
      drawerRow('help', '?', 'Help') +
      drawerRow('theme', '&#9680;', UI.theme === 'dark' ? 'Light Mode' : 'Dark Mode') +
      (SAMPLE_MODE ? '' : drawerRow('gchat', '&#8801;', 'Team Chat', drawerCount(gchatUnreadCount), gchatOpen)) +
      (SAMPLE_MODE ? '' : drawerRow('notes', '&#9998;', 'Notes', drawerCount(notesData.length), notesOpen));

    var tools =
      (Modules.PH().length ? drawerRow('track', '&#9638;', 'Track Program', '', currentPage === 'mgmt-hub') : '') +
      (voiceOn() ? drawerRow('voice', '&#9673;', 'Voice') : '') +
      (isAppAdmin ? drawerRow('admin', '&#9638;', 'Admin') : '') +
      (SAMPLE_MODE ? sampleDrawerRowsHtml() : seedRowsHtml()) +
      moduleRowsHtml() +
      (SAMPLE_MODE ? '' : drawerRow('export', '&#8595;', 'Export state') +
      drawerRow('import', '&#8593;', 'Import state')) + /* Sweep 4R item 9 (addendum 5 Oct 2026; amends Part 3): not in the sample tab */
      ((SAMPLE_MODE || !canManageOrg() || (window.resetMovedToConsole && resetMovedToConsole())) ? '' : drawerRow('reset',   /* Sweep 4R item 10: Reset is offered to administrators only */ '&#10005;', 'Reset all data', '', false, 'nav-dr-danger'));

    var view = '<div class="nav-dr-zoom">'
      + '<span class="nav-dr-zoom-lbl">Zoom</span>'
      + '<button class="nav-dr-zbtn" data-act="zoomout" aria-label="Zoom out"' + (z <= 0.5 ? ' disabled' : '') + '>&minus;</button>'
      + '<span class="nav-dr-zoom-val">' + Math.round(z * 100) + '%</span>'
      + '<button class="nav-dr-zbtn" data-act="zoomin" aria-label="Zoom in"' + (z >= 2 ? ' disabled' : '') + '>+</button>'
      + '<button class="nav-dr-zchip" data-act="zoomfit">Fit</button>'
      + '<button class="nav-dr-zchip" data-act="zoomreset">Reset</button>'
      + '</div>';

    return '<div class="nav-dr-scrim" data-act="close-drawer"></div>'
      + '<aside id="navDrawer" class="nav-dr" role="dialog" aria-modal="true" aria-label="Menu"'
      + (UI.navDrawer ? '' : ' aria-hidden="true"') + '>'
      + '<div class="nav-dr-head">'
        + '<div class="nav-dr-title">' + esc(cur.name || role.name || 'Menu') + '</div>'
        + '<button class="nav-dr-close" data-act="close-drawer" aria-label="Close menu">&times;</button>'
      + '</div>'
      + '<div class="nav-dr-body">'
        + drawerSection('Account', account)
        + drawerSection(esc(role.name || 'Switch') + ' programs',
            programs + (all ? '<a class="nav-dr-all" href="' + esc(all) + '">All programs &rarr;</a>' : ''))
        + drawerSection('Workspace', actions)
        + drawerSection('Tools', tools)
        + drawerSection('Display', view)
      + '</div></aside>';
  }

  /* The markup is written on every render and shown with a class, not created
     on open: a panel inserted already at its final position has nothing to
     slide from and the transition never plays. Built only while narrow — on a
     desktop the host stays empty rather than holding forty buttons that are
     unreachable and still in the tab order. */
  function renderDrawer() {
    var host = document.getElementById('navDrawerHost');
    if (!host) return;
    if (!navIsNarrow()) { host.innerHTML = ''; host.className = ''; return; }
    var wasOpen = host.className.indexOf('nav-dr-open') >= 0;
    host.innerHTML = drawerHtml();
    host.className = UI.navDrawer ? 'nav-dr-open' : '';
    if (UI.navDrawer && !wasOpen) {
      var c = host.querySelector('.nav-dr-close');
      if (c) { try { c.focus(); } catch (e) { } }
    }
  }

  function toggleNavDrawer(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    UI.navDrawer = !UI.navDrawer;
    /* One sheet at a time: this replaces the header's three dropdowns, so none
       of them may be left open behind it. */
    if (UI.navDrawer) { UI.navMore = false; UI.navModules = false; UI.userMenu = false; }
    render();
  }

  function closeNavDrawer() { if (UI.navDrawer) { UI.navDrawer = false; render(); } }
  window.toggleNavDrawer = toggleNavDrawer;
  window.closeNavDrawer = closeNavDrawer;

  /* Part 3 (Pipeline only): Notes leaves the top bar for Demo and lives in More, above Org & Team, with its count;
     the sample tab offers Start the sample again and Close the sample instead of the sample items. */
  function notesMoreItemHtml() {
    if (!(window.sampleAppliesHere && sampleAppliesHere()) || SAMPLE_MODE) return '';
    return '<button class="nav-more-item" role="menuitem" data-act="notes-more"><span class="nav-more-ic">&#9998;</span> Notes <span class="notes-count">' + notesData.length + '</span></button>';
  }
  function sampleMoreItemsHtml() {
    return '<button class="nav-more-item" role="menuitem" data-act="sample-restart"><span class="nav-more-ic">&#8635;</span> Start the sample again</button>'
      + '<button class="nav-more-item" role="menuitem" data-act="sample-close"><span class="nav-more-ic">&#10005;</span> Close the sample</button>';
  }
  function sampleDrawerRowsHtml() { return drawerRow('sample-restart', '&#8635;', 'Start the sample again') + drawerRow('sample-close', '&#10005;', 'Close the sample'); }

  function moreMenuHtml() {
    var z = UI.zoom || 1, zp = Math.round(z * 100);
    return '<div class="nav-more-backdrop" data-act="close-more"></div>' +
      '<div class="nav-more-menu" role="menu">' +
      '<div class="nav-more-zoom"><div class="nmz-head"><span class="nmz-lbl">View</span><span class="nmz-val">' + zp + '%</span></div>' +
      '<div class="nmz-row">' +
      '<button class="nmz-btn" data-act="zoomout" title="Zoom out" aria-label="Zoom out"' + (z <= 0.5 ? ' disabled' : '') + '>−</button>' +
      '<button class="nmz-btn" data-act="zoomin" title="Zoom in" aria-label="Zoom in"' + (z >= 2 ? ' disabled' : '') + '>+</button>' +
      '<button class="nmz-chip" data-act="zoomfit" title="Fit page to screen">Fit</button>' +
      '<button class="nmz-chip" data-act="zoomreset" title="Reset to 100%">Reset</button>' +
      '</div></div>' +
      '<div class="nav-more-sep"></div>' +
      /* Track Program is the phase-by-phase progress board, and it reads the
         phase spine. A program that declares no phases — the Leaders programs
         work one decision at a time, not a 90-day plan — has nothing for it to
         show, so it is not offered rather than opening blank. */
      (Modules.PH().length
        ? '<button class="nav-more-item' + (currentPage === 'mgmt-hub' ? ' nav-action-on' : '') + '" role="menuitem" data-act="track"><span class="nav-more-ic">▦</span> Track Program</button>'
        : '') +
      (voiceOn() ? '<button class="nav-more-item" role="menuitem" data-act="voice"><span class="nav-more-ic">&#9673;</span> Voice</button>' : '') +
      notesMoreItemHtml() +
      (isAppAdmin || SAMPLE_MODE ? '' : '<button class="nav-more-item" role="menuitem" data-act="profile"><span class="nav-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span> Profile</button>') +
      /* Directive 2 Oct 2026, 5.6 / A.5.11: every signed-in person's own password, in the More menu; the sample
         tab has Start again / Close in its place (3.2.7). The app administrator changes theirs here too. */
      (SAMPLE_MODE ? '' : '<button class="nav-more-item" role="menuitem" data-act="password"><span class="nav-more-ic">&#9679;</span> Change password</button>') +
      (isAppAdmin ? '<button class="nav-more-item" role="menuitem" data-act="admin"><span class="nav-more-ic">&#9638;</span> Admin</button>' : '') +
      '<div class="nav-more-sep"></div>' +
      (SAMPLE_MODE ? sampleMoreItemsHtml() : seedItemsHtml()) +
      moduleItemsHtml() +
      (SAMPLE_MODE ? '' : '<button class="nav-more-item" role="menuitem" data-act="export"><span class="nav-more-ic">&#8595;</span> Export state</button>' +
      '<button class="nav-more-item" role="menuitem" data-act="import"><span class="nav-more-ic">&#8593;</span> Import state</button>') + /* Sweep 4R item 9 (addendum 5 Oct 2026; amends Part 3): not in the sample tab */
      ((SAMPLE_MODE || !canManageOrg() || (window.resetMovedToConsole && resetMovedToConsole())) ? '' : /* Sweep 4R item 10: administrators only */ '<button class="nav-more-item nav-more-danger" role="menuitem" data-act="reset"><span class="nav-more-ic">&#10005;</span> Reset all data</button>') +
      '</div>';
  }

  /* ── Delegated wiring (attached once to <nav>) ────────────── */
  var ACTIONS = {
    help: function () { openHelp(); },
    theme: function () { toggleTheme(); },
    gchat: function () { toggleGChat(); },
    notes: function () { toggleNotes(); },
    demo: function () { openSampleTab(); },
    'notes-more': function () { closeNavMore(); toggleNotes(); },
    'sample-restart': function () { closeNavMore(); restartSample(); },
    'sample-close': function () { closeNavMore(); closeSample(); },
    more: function (e) { toggleNavMore(e); },
    modules: function (e) { toggleNavModules(e); },
    'close-modules': function () { closeNavModules(); },
    'module-pick': function (e) {
      var el = e.target.closest('[data-module]');
      if (el && window.Modules) Modules.select(el.getAttribute('data-module'));
    },
    signout: function () { closeUserMenu(); signOut(); },
    usermenu: function (e) { toggleUserMenu(e); },
    'close-usermenu': function () { closeUserMenu(); },
    'user-profile': function () { closeUserMenu(); openOrg(); },
    'user-assignments': function () { closeUserMenu(); openAssignments(); },
    'user-password': function () { closeUserMenu(); openChangePassword(); },
    'close-more': function () { closeNavMore(); },
    track: function () { closeNavMore(); go('mgmt-hub'); },
    voice: function () { closeNavMore(); toggleVoice(); },
    profile: function () { closeNavMore(); openOrg(); },
    password: function () { closeNavMore(); openChangePassword(); },
    admin: function () { closeNavMore(); openAdmin(); },
    seed: function (e) {
      closeNavMore();
      var el = e.target.closest('[data-seed]');
      runSeed(el && el.getAttribute('data-seed'));
    },
    'module-item': function (e) {
      closeNavMore();
      var el = e.target.closest('[data-item]'), id = el && el.getAttribute('data-item');
      var m = ((window.Modules && Modules.moreItems()) || []).filter(function (x) { return x.id === id; })[0];
      if (m) m.run();
    },
    export: function () { closeNavMore(); exportState(); },
    import: function () { closeNavMore(); importState(); },
    reset: function () { closeNavMore(); clearData(); },
    drawer: function (e) { toggleNavDrawer(e); },
    'close-drawer': function () { closeNavDrawer(); },
    zoomout: function () { zoomOut(); },
    zoomin: function () { zoomIn(); },
    zoomfit: function () { zoomFit(); },
    zoomreset: function () { zoomReset(); }
  };

  /* Zoom is the one thing you press repeatedly, and a sheet that shut on the
     first tap would make "90%" a four-gesture journey. Everything else in the
     drawer is a destination, and a drawer still covering the screen you were
     sent to is the classic mobile-nav bug. */
  var KEEPS_DRAWER_OPEN = { zoomout: 1, zoomin: 1, zoomfit: 1, zoomreset: 1, drawer: 1, 'close-drawer': 1 };

  var _wired = false;
  function wireOnce() {
    if (_wired) return;
    var nav = document.querySelector('nav'); if (!nav) return;
    function onClick(e) {
      var t = e.target.closest && e.target.closest('[data-tab],[data-act]');
      if (!t) return;
      if (t.hasAttribute('data-tab')) { closeNavDrawer(); go(t.getAttribute('data-tab')); return; }
      var act = t.getAttribute('data-act');
      /* Cleared BEFORE the action runs, because most actions render — clearing
         after would paint the open drawer and then leave it there. */
      var closing = UI.navDrawer && !KEEPS_DRAWER_OPEN[act];
      if (closing) UI.navDrawer = false;
      var fn = ACTIONS[act];
      if (fn) fn(e);
      /* An action that opens a modal or a panel does not always re-render the
         chrome, and the drawer would stay on screen over it. */
      if (closing) render();
    }
    nav.addEventListener('click', onClick);
    /* The drawer lives outside <nav> (see shell.html), so it needs the same
       listener rather than relying on the header's. */
    var host = document.getElementById('navDrawerHost');
    if (host) host.addEventListener('click', onClick);
    _wired = true;
  }

  /* ── Public entry point ───────────────────────────────────── */
  function render() {
    var nt = document.getElementById('navTabs'), nr = document.getElementById('navRight');
    if (!nt || !nr) return;
    ensureParsed();
    _wasNarrow = navIsNarrow();
    nt.innerHTML = _tabsHtml; hydrateTabs(nt);
    nr.innerHTML = _rightHtml; hydrateRight(nr);
    renderDrawer();
    wireOnce();
  }

  /* The header is different markup on either side of 820px, not just different
     CSS: the drawer exists only while narrow, and the chips only while wide.
     A drawer left open as the window grows would be a sheet with no way to
     open it again, so the crossing closes it and rebuilds. Only the crossing —
     every other resize leaves the nav alone. */
  var _wasNarrow = null;
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', function () {
      var now = navIsNarrow();
      if (now === _wasNarrow) return;
      _wasNarrow = now;
      if (!now) UI.navDrawer = false;
      render();
    });
  }

  window.Nav = { render: render };
})();
