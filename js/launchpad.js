/* ─────────────────────────────────────────────────────────────
   launchpad.js — the screens that belong to no single program
   ─────────────────────────────────────────────────────────────
   Three routes have no module behind them, and this file renders all
   three:

     /apps/                 the launchpad — every program this account
                            can open, grouped by role
     /apps/enterprises      a role hub — that role's six programs
     anything unrecognised  the 404

   They sit BETWEEN the entry screens and a program: you have signed
   in, but you have not yet said which of the twelve 90-day programs
   you are here for.

   ── SIGNED OUT, IT IS THE FRONT DOOR ──────────────────────────
   These three addresses name no program, and every program keeps its
   own SIGN-IN (/apps/{role}/{program}/login) — so there is no shared
   sign-in form to put here, and painting one would quietly restore the
   common one that per-program doors replaced. Instead the launchpad
   shows the whole catalogue to a signed-out visitor and each card leads
   to that program's door.

   SIGNING UP is the other half, and it is not per-program: one account
   covers a whole role space, so the launchpad links to the one shared
   /apps/signup rather than sending someone into a program to find it.
   That link is also where the sign-up screen's own "All programs" back
   button lands, so the two screens point at each other.

   Nothing is disclosed by any of it: the twelve programs are the
   marketing site's public list, and the page holds no organization, no
   roster and no session.

   That is also why the "not in your plan" and "no access" markings are
   only applied to somebody signed IN. To a visitor with no account
   they would be describing an account that does not exist.

   Chrome. These screens hide the program header, the sidebar and the
   AI Guide, exactly as the entry screens do — every one of those is
   scoped to a program, and none has been chosen yet. What they need
   instead (who is signed in, a way out) they carry themselves.

   Markup is built here rather than in templates/, following the admin
   console: these screens are short, entirely data-driven, and painted
   before any template fetch could resolve.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function esc(s) {
    return s == null ? '' : String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** True when the current URL is one of these screens rather than a program. */
  function owns() {
    var k = window.Router && Router.kind();
    return k === 'launchpad' || k === 'role' || k === 'notfound';
  }

  /** Whether anyone is signed in on this page. Everything about entitlement
      below is a statement about an ACCOUNT, and there is none to describe when
      the answer is no. */
  function signedIn() {
    try { return !!(currentUserId && getCurrentUser()); } catch (e) { return false; }
  }

  /* ── Which roles to show ──────────────────────────────────
     Signed in, normally exactly one: your own. The app administrator sees
     both, because the console's whole job is reaching across accounts. A role
     hub shows the role in the URL — including one this account cannot use,
     which is what makes the "not part of your account" message land on the
     page the user actually asked for. Signed out, both: nobody has chosen an
     audience yet, and this is where they do. */
  function rolesToShow() {
    var all = (window.Modules && Modules.roles()) || [];
    if (window.Router && Router.kind() === 'role') {
      var here = Modules.activeRole();
      return here ? [here] : all;
    }
    if (!signedIn()) return all;
    if (typeof isAppAdmin !== 'undefined' && isAppAdmin) return all;
    var mine = window.Modules && Modules.roleByKey(currentAccountType());
    return mine ? [mine] : all;
  }

  function currentAccountType() {
    try { return accountType(); } catch (e) { return 'enterprise'; }
  }

  function allowed(roleKey) {
    if (!signedIn()) return true;
    if (typeof isAppAdmin !== 'undefined' && isAppAdmin) return true;
    return !window.Router || Router.roleAllowed(currentAccountType(), roleKey);
  }

  /* Whether this account holds one particular program.
     Role and grant are separate questions and the launchpad shows both, because
     they have different answers and different fixes: a whole role space that is
     "not part of your account" is a different sentence from one program inside
     your own space that nobody has given you. */
  function granted(m) {
    if (!signedIn()) return true;
    if (typeof isAppAdmin !== 'undefined' && isAppAdmin) return true;
    if (typeof canOpenModule !== 'function') return true;
    return canOpenModule(m.id);
  }

  /* ── Pieces ───────────────────────────────────────────────── */
  function topBar() {
    var u = (typeof getCurrentUser === 'function' && getCurrentUser()) || null;
    var suite = (window.APP_BOOT && APP_BOOT.suite) || {};
    var logo = suite.logo || {};
    return '<div class="lp-top">' +
      '<div class="lp-word">' + esc(logo.lead || suite.name || '') +
      ' <i>' + esc(logo.accent || '') + '</i></div>' +
      (u ? '<div class="lp-who">' +
        '<span class="lp-who-name">' + esc(u.name || '') + '</span>' +
        '<button class="entry-link" onclick="signOut()">Sign out</button>' +
        '</div>' : '') +
      '</div>';
  }

  function moduleCard(m, roleOk) {
    var live = m.status === 'live';
    /* Signed in, a card opens the program. Signed out, it opens that program's
       own sign-in — the card IS the choice of door, and sending someone to the
       program first only to be bounced back is a page load spent saying
       nothing. */
    var url = (window.Router &&
      (signedIn() ? Router.moduleUrl(m.id) : Router.authUrl('login', m.id))) || '#';
    /* Open only when BOTH are true: the role space is this account's, and this
       particular program has been granted to whoever is signed in. */
    var open = roleOk && granted(m);
    var cls = 'lp-card' + (live ? '' : ' lp-card-soon') + (open ? '' : ' lp-card-locked');
    /* The status pill gets its own line rather than trailing the name. Inline,
       it wrapped after the longer names and pushed the discipline line down,
       so no two cards in a row lined up. */
    var pill = !roleOk ? '<span class="lp-tag lp-tag-locked">Not in your plan</span>'
      : !open ? '<span class="lp-tag lp-tag-locked">No access</span>'
        : live ? '' : '<span class="lp-tag">In development</span>';
    /* Name over discipline, the way the marketing site lists these twelve — it
       is where people meet the names first, and a chooser that re-describes
       them makes the reader do the matching. `sub` is the longer sentence and
       stays in the data for the header switcher and the module's own screen;
       the short tag reads faster down a column of six. */
    var body =
      '<div class="lp-card-mini">' + esc((m.logo && m.logo.mini) || '··') + '</div>' +
      '<div class="lp-card-body">' +
      '<div class="lp-card-name">' + esc(m.name) + '</div>' +
      '<div class="lp-card-tag">' + esc(m.tag || m.sub || '') + '</div>' +
      (pill ? '<div class="lp-card-meta">' + pill + '</div>' : '') +
      '</div>';
    return open
      ? '<a class="' + cls + '" href="' + esc(url) + '">' + body + '</a>'
      : '<div class="' + cls + '" aria-disabled="true">' + body + '</div>';
  }

  function roleSection(role) {
    var ok = allowed(role.key);
    var mods = role.modules || [];
    /* Inside your own role space, say plainly when some of it is not yours.
       Without this the greyed cards read as broken rather than as unassigned,
       and the person who can fix it — the org administrator — is never named. */
    var withheld = ok && mods.some(function (m) { return !granted(m); });
    return '<section class="lp-role">' +
      '<div class="lp-role-head">' +
      '<h2 class="lp-role-name">' + esc(role.name) + '</h2>' +
      '<p class="lp-role-sub">' + esc(role.sub || '') + '</p>' +
      '</div>' +
      (ok ? '' : '<div class="lp-locked-note">These programs are not part of your ' +
        esc(currentAccountType()) + ' account.</div>') +
      (withheld ? '<div class="lp-locked-note">You have been given access to some of these programs. ' +
        'Your organization administrator can change what you can open.</div>' : '') +
      '<div class="lp-grid">' + mods.map(function (m) { return moduleCard(m, ok); }).join('') + '</div>' +
      '</section>';
  }

  /* ── The screens ──────────────────────────────────────────── */
  function launchpadHtml() {
    var roles = rolesToShow();
    var mine = signedIn();
    return '<div class="lp-screen">' + topBar() +
      '<div class="lp-lead">' +
      '<div class="login-eyebrow">' + (mine ? 'Your programs' : 'The programs') + '</div>' +
      '<h1 class="lp-title">Choose a <em>program</em></h1>' +
      '<p class="lp-sub">' + (mine
        ? 'Every program shares this workspace — the same organization, ' +
        'the same team, the same notes and chat. Pick up wherever you left off.'
        : 'Each program has its own sign-in — choose the one you are here for and ' +
        'sign in at its door. One account covers a whole set of them.') + '</p>' +
      (mine ? '' : signUpCta()) +
      '</div>' +
      roles.map(roleSection).join('') +
      '</div>';
  }

  /* The way in for somebody who has no account yet. It belongs on this screen
     rather than on a program's, because what a sign-up creates is a role space
     — all six Enterprise programs or all six Leader ones — and this is the only
     screen that shows both sets side by side. Signed in, it is not offered:
     there is nothing here for an account that already exists. */
  function signUpCta() {
    var url = (window.Router && Router.authUrl('signup')) || 'signup';
    return '<p class="lp-signup">New here? ' +
      '<a class="entry-link" href="' + esc(url) + '">Create an account</a></p>';
  }

  function notFoundHtml() {
    var home = (window.Router && Router.launchpadUrl()) || '/';
    return '<div class="lp-screen">' + topBar() +
      '<div class="lp-lead">' +
      '<div class="login-eyebrow">404</div>' +
      '<h1 class="lp-title">No program at <em>this address</em></h1>' +
      '<p class="lp-sub">The role or program in this URL isn’t one of the twelve. ' +
      'It may have been renamed since the link was made.</p>' +
      '<a class="soon-back" href="' + esc(home) + '">&larr; All programs</a>' +
      '</div></div>';
  }

  function html() {
    return (window.Router && Router.kind() === 'notfound') ? notFoundHtml() : launchpadHtml();
  }

  /** Paint the screen and strip the program chrome around it. */
  function render(container) {
    var nav = document.querySelector('nav');
    var tabs = document.getElementById('navTabs');
    var right = document.getElementById('navRight');
    var side = document.getElementById('pipSidebar');
    var toggle = document.getElementById('sidebarToggle');
    if (tabs) tabs.innerHTML = '';
    if (right) right.innerHTML = '';
    if (nav) nav.style.display = 'none';
    if (side) side.style.display = 'none';
    // The hamburger opens a program's sidebar; there is no program here.
    if (toggle) toggle.style.display = 'none';
    // Same for the mobile nav drawer — it belongs to a program's header.
    var drawer = document.getElementById('navDrawerHost');
    if (drawer) { drawer.innerHTML = ''; drawer.className = ''; }
    if (window.UI) UI.navDrawer = false;
    container.classList.remove('sidebar-mini');
    container.classList.add('sidebar-collapsed');
    if (typeof setCoachVisible === 'function') setCoachVisible(false);
    container.innerHTML = html();
  }

  window.Launchpad = { owns: owns, render: render, html: html };
})();
