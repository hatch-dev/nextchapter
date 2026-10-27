/* ─────────────────────────────────────────────────────────────
   auth.js — Entry / authentication flow (Sign in · Sign up · Admin)
   ─────────────────────────────────────────────────────────────
   The three pre-login screens, extracted out of app.js into the
   per-screen module pattern (markup in login.html / setup.html /
   admin-login.html; logic here). One cohesive feature → one module.

   ── SIGN-IN PER PROGRAM, ONE SIGN-UP ──────────────────────────
   The two screens answer "which role space?" in two different ways,
   because they are two different moments.

   SIGN-IN lives at /apps/{role}/{module}/login — every program has its
   own. You are entering a program you already have, so the address says
   which one, and the role space comes with it: roleKey() reads it off
   window.APP_BOOT and hydrateLogin/submitLogin never ask.

   SIGN-UP lives at /apps/signup, once, for all twelve. Creating an
   account is not entering a program — it is choosing which of the two
   audiences you belong to, and that choice then governs the whole space
   — so the form ASKS, and setupRole() reads the answer off the picker
   rather than off the URL. The twelve old per-program /signup addresses
   301 to it (index.php).

   What each role is asked, on SIGN-UP:

     · a Leader names no organization. A Leader account IS one person;
       there is no team to name, so the server derives the workspace name
       from theirs (SetupController);
     · an Enterprise account names its organization: it is a team, and
       that name is what every screen labels the shared workspace with.

   Neither is asked at SIGN-IN. That screen takes a username and a password
   and nothing else, for both roles: usernames are unique across the
   whole installation (uq_user_username — the server refuses a duplicate
   at sign-up and wherever a member is added or renamed), so the username
   is the identity and there is nothing for an organization to
   disambiguate. See AuthController.

   What each role GETS at sign-up is its whole space, six programs, either
   way — a pool for an Enterprise admin to assign, all six outright for a
   Leader. So there is no program picker: nothing on this screen chooses
   programs, and SetupController::entitlementFor ignores anything sent.

   Public API (window.Entry):
     Entry.mount(step, container)   render + hydrate the given step
                                    ('login' | 'setup' | 'admin-login'
                                     | 'admin'→admin sign-in when not yet admin
                                     | 'choose-password')
     Entry.startChoosePassword(kind, data, current)
                                    a temporary password, the administrator's
                                    first sign-in, or an old PIN (Part 5.5)
     Entry.gotoStep(step)           switch screens (updates UI.entry)

   State lives on UI.entry (set by app.js's gate):
     { step, user, remember, presetOrg/Name/User/Code, errors:{}, err, busy }
     A password is never held in UI.entry, so a re-render never restores one.
     (presetOrg is the SIGN-UP form's organization name; sign-in has none)
   Handlers mutate UI.entry then call render(); render() re-mounts and
   hydrate() reads back from UI.entry — one unidirectional data flow, so
   typed values, field errors and busy state all survive a re-render.

   Markup is the source of truth (login.html …). Over http(s) it is
   fetched live (via screen-loader's cache); on file:// and for the
   very first synchronous paint it comes from the templates-local.js
   bundle — regenerate that with `node build-templates.js` after edits.

   PASSWORDS (Directive 2 Oct 2026, Parts 5 and 6; live 6 Oct 2026). Sign-in
   is a username and a password; sign-up asks for the setup code and a password
   meeting the rule (passwordProblem, app.js) twice; the administrator signs in
   with a username and a password. The server checks all of it again and answers
   a sign-in with a session cookie (Auth.signIn, POST api/session).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SCREENS = ['login', 'setup', 'admin-login', 'choose-password'];
  var TPL = {};   // name → markup (seeded sync from the bundle, refreshed from .html over http)

  /* ── Templates ────────────────────────────────────────────
     Seed synchronously from the bundle (always loaded before this
     file) so the first render() paints without waiting on a fetch;
     then refresh from the live .html (source of truth) over http and
     re-render if that screen is currently showing. Reuses
     screen-loader's load() so there's no duplicate fetch logic. */
  SCREENS.forEach(function (name) {
    TPL[name] = (window.__LOCAL_TEMPLATES && window.__LOCAL_TEMPLATES[name]) || '';
    if (window.Screens && Screens.load) {
      Screens.load(name).then(function (html) {
        if (html && html !== TPL[name]) { TPL[name] = html; if (isActive(name) && window.render) window.render(); }
      }).catch(function () { /* keep the seeded copy */ });
    }
  });

  function stepToName(step) {
    if (step === 'setup') return 'setup';
    if (step === 'admin-login' || step === 'admin') return 'admin-login';
    if (step === 'choose-password') return 'choose-password';
    return 'login';
  }
  function isActive(name) {
    return typeof UI !== 'undefined' && UI && UI.entry && stepToName(UI.entry.step) === name;
  }

  /* ── Small DOM helpers ────────────────────────────────────── */
  function val(c, sel) { var el = c.querySelector(sel); return el ? el.value.trim() : ''; }
  function setVal(c, sel, v) { var el = c.querySelector(sel); if (el) el.value = v || ''; }
  function has(o) { for (var k in o) { if (o.hasOwnProperty(k)) return true; } return false; }
  function E() { return (UI.entry = UI.entry || { step: 'login' }); }

  /* ── Which role space a SIGN-IN belongs to ─────────────────
     The URL decided, and index.php already resolved it into
     window.APP_BOOT.role; Modules.activeRoleKey() reads it, falling back
     to the active module's own role on file:// and under the harness,
     where there is no front controller. Never off location.pathname,
     which is a string the visitor can edit.

     This is the SIGN-IN answer only. Sign-up has no program in its address
     and asks instead — see setupRole(). */
  function roleKey() {
    try { if (window.Modules && Modules.activeRoleKey) return Modules.activeRoleKey(); } catch (e) { }
    return 'enterprise';
  }

  /* ── Which role space a SIGN-UP is creating ────────────────
     The picker's answer, held on UI.entry so it survives the re-renders
     that submitting and failing cause. Empty until the visitor chooses:
     an account cannot be moved between the two spaces afterwards, so
     nothing is assumed on their behalf — validateSetup refuses an empty
     one rather than letting a default decide. */
  function setupRole() { return (UI.entry && UI.entry.accountType) || ''; }

  /** The program whose door this is, or null when the address names none.
      The launchpad, /apps/signup and /apps/admin all resolve a module anyway
      — the shell's chrome has to come from somewhere (index.php) — so asking
      Modules.active() there answers with the fallback program and gets the
      shared sign-up captioned "AI Innovation Pipeline". boot.moduleId is the
      honest question: it is null exactly when no program is behind the URL.
      Unserved pages (file://, the harness) have no boot at all and keep the
      active module, which is the only program they have. */
  function doorModule() {
    try {
      var boot = window.APP_BOOT || {};
      if (boot.base && !boot.moduleId) return null;
      return (window.Modules && Modules.active && Modules.active()) || null;
    } catch (e) { return null; }
  }
  /** Show or hide a slot for real: `hidden` alone loses to any class rule
      that sets `display`, which is how the old role picker kept showing. */
  function showSlot(c, name, on) {
    var el = c.querySelector('[data-slot="' + name + '"]');
    if (!el) return null;
    el.hidden = !on;
    el.style.display = on ? '' : 'none';
    return el;
  }

  /* ── Error rendering ──────────────────────────────────────── */
  function setFieldErr(c, field, msg) {
    var slot = c.querySelector('[data-err="' + field + '"]');
    var input = c.querySelector('[data-field="' + field + '"]');
    if (slot) slot.textContent = msg || '';
    if (input) input.classList.toggle('entry-input-err', !!msg);
  }
  function setGeneral(c, msg) {
    var g = c.querySelector('[data-err="_general"]');
    if (!g) return;
    if (msg) { g.textContent = msg; g.hidden = false; } else { g.textContent = ''; g.hidden = true; }
  }
  function paintErrors(c) {
    var errs = (UI.entry && UI.entry.errors) || {};
    c.querySelectorAll('[data-field]').forEach(function (el) { setFieldErr(c, el.dataset.field, errs[el.dataset.field] || ''); });
    setGeneral(c, (UI.entry && UI.entry.err) || '');
  }
  // Map the server's { field: [msg,…] } map to { field: msg }. Its field
  // names (organization_name/name/username/password/setup_code) match our data-field keys.
  function mapServerErrors(errors) {
    var o = {};
    for (var k in errors) { if (errors.hasOwnProperty(k) && errors[k] && errors[k].length) o[k] = errors[k][0]; }
    return o;
  }

  /* ── Shared wiring ────────────────────────────────────────── */
  function wireNav(c) {
    c.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { gotoStep(b.dataset.go); });
    });
  }
  // Clear a field's error the moment the user starts correcting it.
  function wireInputClearing(c) {
    c.querySelectorAll('[data-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        if (UI.entry) { if (UI.entry.errors) delete UI.entry.errors[el.dataset.field]; UI.entry.err = ''; }
        setFieldErr(c, el.dataset.field, ''); setGeneral(c, '');
      });
    });
  }
  function applyBusy(c, busy, busyLabel, idleLabel) {
    var b = c.querySelector('[data-submit]');
    if (!b) return;
    b.disabled = !!busy;
    b.innerHTML = busy ? busyLabel : idleLabel;
  }
  /* Focus the first errored field, else the first empty one, else the first —
     skipping any the screen has put away (a Leader's Organization). A hidden
     input still answers querySelectorAll, and focusing one silently does
     nothing, which left the caret nowhere at all on those screens. */
  function visibleFields(c) {
    var out = [];
    c.querySelectorAll('[data-field]').forEach(function (el) {
      var away = false;
      try { away = !!(el.closest && el.closest('[hidden]')); } catch (x) { }
      if (!away) out.push(el);
    });
    return out;
  }
  /* "Has this been answered?" — not the same as "does it have a value".
     A radio always carries one, so testing .value put the caret past the
     sign-up's unanswered role picker and into the name field, skipping the
     first question on the form. */
  function answered(el) {
    if (el.type === 'radio') {
      var group = c_root(el).querySelectorAll('input[name="' + el.name + '"]');
      for (var i = 0; i < group.length; i++) { if (group[i].checked) return true; }
      return false;
    }
    if (el.type === 'checkbox') return el.checked;
    return !!el.value;
  }
  function c_root(el) { return el.form || el.ownerDocument || document; }
  function focusFirst(c) {
    var errs = (UI.entry && UI.entry.errors) || {};
    var fields = visibleFields(c); if (!fields.length) return;
    for (var i = 0; i < fields.length; i++) { if (errs[fields[i].dataset.field]) { fields[i].focus(); return; } }
    for (var j = 0; j < fields.length; j++) { if (!answered(fields[j])) { fields[j].focus(); return; } }
    fields[0].focus();
  }

  /* ── Navigation between entry screens ─────────────────────── */
  /* Each entry screen has its own address — this program's /login, and the
     root /signup and /admin — so moving between them is a navigation, not a
     state change. That keeps them shareable and refreshable, and keeps the
     browser's Back button doing what it looks like it does (which is how you
     get back to the program you clicked "Create an account" from). Router
     .authUrl supplies the program half for /login and roots the other two. The
     in-place path below is the unserved case (file://, the harness), where
     these URLs do not exist. */
  var AUTH_URL = { login: 'login', setup: 'signup', 'admin-login': 'admin' };
  function gotoStep(step) {
    /* Not an entry screen: the launchpad is the way OUT of the admin console's
       passcode screen, which is the one door that belongs to no program and so
       has no program's sign-in to go back to. */
    if (step === 'launchpad') {
      if (window.Router && Router.served()) { Router.openLaunchpad(); return; }
      step = 'login';
    }
    if (window.Router && Router.served() && AUTH_URL[step]) {
      Router.openAuth(AUTH_URL[step]);
      return;
    }
    if (step === 'setup') {
      UI.entry = { step: 'setup', accountType: '', presetOrg: '', presetName: '', presetEmail: '', presetUser: '', presetCode: '', remember: false, errors: {}, err: '', busy: false };
      /* accountType empty, not defaulted: the picker asks, and nothing here
         answers for the visitor. No presetModules either — sign-up grants a
         whole role space, so there is nothing to pick. */
      window.render();
      return;
    }
    if (step === 'admin-login') {
      UI.entry = { step: 'admin-login', errors: {}, err: '', busy: false };
      window.render();
      return;
    }
    UI.entry = { step: 'login', errors: {}, err: '', busy: false };
    window.render();
  }

  /* ── Mount + hydrate ──────────────────────────────────────── */
  function mount(step, container) {
    var name = stepToName(step);
    var html = TPL[name];
    if (!html) { container.innerHTML = missingCard(name); return; }
    container.innerHTML = html;
    /* The door names the room. /apps/leaders/judgment-critical-thinking/login is the
       Decision Lab's own sign-in, so it says so — and index.php has already
       given the page that program's palette. Only /apps/admin belongs to no
       program (it reaches across all of them), and wears the suite's name
       over whichever module's chrome the shell happened to load. */
    var mn = container.querySelector('[data-slot="module-name"]');
    if (mn) {
      var suite = (window.APP_BOOT && APP_BOOT.suite) || {};
      var m = (name === 'admin-login' || (name === 'choose-password' && UI.entry && UI.entry.kind === 'admin')) ? null : doorModule();
      mn.textContent = (m && m.name) || suite.name || '90-Day Programs';
    }
    var form = container.querySelector('.entry-form');
    wireNav(container);
    wireInputClearing(container);
    if (name === 'login') hydrateLogin(container, form);
    else if (name === 'setup') hydrateSetup(container, form);
    else if (name === 'choose-password') hydrateChoose(container, form);
    else hydrateAdmin(container, form);
    paintErrors(container);
    if (!(UI.entry && UI.entry.busy)) focusFirst(container);
  }

  function missingCard(name) {
    return '<div class="login-screen"><div class="login-card">' +
      '<h1 class="login-title">Couldn’t load</h1>' +
      '<p class="login-sub">The ' + name + ' screen template is missing. If you are running from disk, run <code>node build-templates.js</code> and reload.</p>' +
      '</div></div>';
  }

  /* ── Sign in ──────────────────────────────────────────────── */
  /* Two fields, and the same two for both roles. An Organization field used to
     come first for an Enterprise account, because a username was only unique
     inside its own tenant; it is unique across the installation again — the
     server refuses a duplicate at sign-up and at every place a member can be
     added or renamed — so the username is the whole identity and the field had
     nothing left to disambiguate. See AuthController::login.

     roleKey() still travels with the request, but only so the app knows which
     role space to land in. It is not a credential and the server ignores it. */
  function hydrateLogin(c, form) {
    var e = E();
    var sub = c.querySelector('[data-slot="sub"]');
    /* A.5.2 (Directive 2 Oct 2026). A Leader account is one person with no organization, so its doors keep "your workspace". */
    if (sub) sub.textContent = roleKey() === 'leader' ? 'Enter your username and password to open your workspace.' : "Enter your username and password to open your organization's workspace.";
    /* The sign-up link is left as the template wrote it — "Create an account".
       It used to name the kind this door would make, which was true while each
       program had its own sign-up; it now leads to the one shared form, where
       Enterprise or Leaders is the first question, and promising one of them on
       the way in would be a promise the next screen re-opens. */
    setVal(c, '#loginUser', e.user);            // a password is never restored (never held in state)
    var rem = c.querySelector('#loginRemember');
    if (rem) { rem.checked = !!e.remember; rem.addEventListener('change', function () { E().remember = rem.checked; }); }
    paintResume(c);
    applyBusy(c, e.busy, 'Signing in…', 'Sign In &rarr;');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); submitLogin(c); });
  }

  /* ── "Continue as …" ──────────────────────────────────────
     A remembered session used to be entered on arrival, before this screen
     rendered — which meant asking for the sign-in page and being put into the
     app as whoever used this browser last, with no way to say "no, me". Now
     boot leaves the record here (UI.entry.resume) and the person decides. */
  function paintResume(c) {
    var r = (UI.entry && UI.entry.resume) || null;
    var box = c.querySelector('[data-slot="resume"]');
    if (!box) return;
    if (!r) { box.hidden = true; box.style.display = 'none'; return; }
    box.hidden = false; box.style.display = '';
    var who = c.querySelector('[data-slot="resume-name"]');
    if (who) who.textContent = r.name + (r.orgName ? ' · ' + r.orgName : '');
    var btn = c.querySelector('[data-resume]');
    if (btn) {
      btn.disabled = !!(UI.entry && UI.entry.busy);
      btn.addEventListener('click', function () {
        /* resumeSession() is a page load when it succeeds. If it cannot be
           honoured (the account was removed, the organization is gone), the
           offer is withdrawn and the form below is the answer. */
        /* resumeSession() asks the server whether that session still stands
           and withdraws the offer itself when it does not. */
        if (!resumeSession(r)) { UI.entry.resume = null; UI.entry.err = 'That session is no longer valid — please sign in.'; window.render(); }
      });
    }
  }

  function submitLogin(c) {
    var e = E();
    var user = val(c, '#loginUser');
    var pwEl = c.querySelector('#loginPassword');
    var password = pwEl ? pwEl.value : '';        /* never trimmed: a password is exactly what was typed */
    e.user = user;
    var errs = {};
    if (!user) errs.user = 'Enter your username.';
    if (!password) errs.password = 'Enter your password.';
    if (has(errs)) { e.errors = errs; e.err = ''; window.render(); return; }
    e.errors = {}; e.err = ''; e.busy = true; window.render();
    var remember = !!e.remember;
    /* The role space rides along for landing (Router.landAfterAuth), not for the
       credential check — the server ignores it. */
    Auth.signIn(user, password, remember, function (res) {
      if (!UI.entry) return;                    // navigated away mid-request
      UI.entry.busy = false;
      if (res && res.ok && res.mustChange) { startChoosePassword('member', res.data, password); return; }
      if (res && res.ok) { landMember(res, remember); return; }
      /* One message for an unknown username and a wrong password (A.5.3): the
         screen must not tell anyone which usernames exist. */
      if (res && res.reason === 'no-local') { UI.entry.err = 'Signed in, but this workspace could not be opened. Try again.'; window.render(); return; }
      UI.entry.err = authRefusal(res, password); window.render();
    }, roleKey());
  }

  /* A verified member, into their workspace — the end of a sign-in, and of
     Choose a new password. */
  function landMember(res, remember) {
    /* Whoever was signed in on this device before, it is not this person. An
       app-admin session left standing would keep the Super Admin bar, the
       console and canManageOrg() true for a member who just proved they are a
       member. */
    Auth.setAdminSession(false);
    switchToOrg(res.orgId); Auth.setSession(res.userId);
    applyLoginTheme();                        // every sign-in lands in dark mode (app.js)
    try { Store.setRemember(remember ? Auth.sessionRecord(res.orgId, res.userId) : null); } catch (x) { }
    try { Store.setSession(Auth.sessionRecord(res.orgId, res.userId)); } catch (x) { }
    /* Into the program whose door this was — Router.landingUrl prefers it. The
       session record is already in sessionStorage, so the load lands signed in. */
    if (window.Router && Router.landAfterAuth(accountType(res.orgId))) return;
    UI.entry = null; window.render();
    try { pullOrgMembers(); } catch (x) { }
    try { notesLoad(); } catch (x) { }
    try { assignmentsLoad(); } catch (x) { }
  }

  /* ── Choose a new password (Part 5.5) ────────────────────────
     A temporary password, the administrator's first sign-in (the published
     password works once), or a stored password that breaks the rule (an old
     PIN). The server refuses everything else until this is done (6.1.6). The
     password just typed is held in this closure only, never in UI.entry, and
     forgotten as soon as it has been replaced. */
  var _pendingCurrent = null;
  function startChoosePassword(kind, data, current) {
    _pendingCurrent = current;
    var sub = kind === 'admin' ? 'This password works only once. Choose your own to continue.'
      : (passwordProblem(current) ? 'Your password does not meet the current password rules. Choose a new one to continue.'
        : 'Your administrator set a temporary password. Choose your own to continue.');
    UI.entry = { step: 'choose-password', kind: kind, data: data || null, sub: sub, remember: !!(UI.entry && UI.entry.remember), errors: {}, err: '', busy: false };
    window.render();
  }
  function hydrateChoose(c, form) {
    var e = E();
    var eb = c.querySelector('[data-slot="module-name"]');
    if (eb && e.kind === 'admin') eb.textContent = 'Administrator';
    var sub = c.querySelector('[data-slot="sub"]'); if (sub) sub.textContent = e.sub || '';
    var back = c.querySelector('[data-leave]');
    if (back) back.addEventListener('click', function () { leaveChoosePassword(); });
    applyBusy(c, e.busy, 'Saving…', 'Save password');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); submitChoose(c); });
  }
  function submitChoose(c) {
    var e = E(); if (e.step !== 'choose-password' || e.busy) return;
    var a = c.querySelector('#newPassword'), b = c.querySelector('#confirmPassword');
    var p1 = a ? a.value : '', p2 = b ? b.value : '';
    var prob = passwordProblem(p1);
    if (prob) { e.errors = { password: prob }; e.err = ''; window.render(); return; }
    if (p1 !== p2) { e.errors = { confirm: 'The two passwords do not match.' }; e.err = ''; window.render(); return; }
    e.errors = {}; e.err = ''; e.busy = true; window.render();
    (e.kind === 'admin' ? Auth.changeAdminPassword : Auth.changePassword)(_pendingCurrent, p1, function (res) {
      if (!UI.entry || UI.entry.step !== 'choose-password') return;
      UI.entry.busy = false;
      if (!(res && res.ok)) {
        if (res && (res.reason === 'weak' || res.reason === 'common' || res.reason === 'same')) UI.entry.errors = { password: authRefusal(res, p1) };
        else UI.entry.err = authRefusal(res, p1);
        window.render(); return;
      }
      _pendingCurrent = null;
      if (e.kind === 'admin') { enterAppAsAdmin(); return; }
      UI.entry.busy = true; window.render();
      Auth.openVerified(e.data, function (r) {
        if (!UI.entry) return;
        UI.entry.busy = false;
        if (r && r.ok) { landMember(r, !!e.remember); return; }
        UI.entry.err = 'Your password is saved, but this workspace could not be opened. Sign in again.'; window.render();
      });
    });
  }
  function leaveChoosePassword() {
    _pendingCurrent = null;
    try { Auth.serverSignOut(); } catch (x) { }
    Auth.clearSession();
    gotoStep('login');
  }

  /* ── Sign up ──────────────────────────────────────────────── */
  /* One screen for all twelve programs, so the role space is the form's first
     question rather than the address's answer. Everything the screen says about
     itself below the picker — the title, the blurb, whether an Organization is
     asked for, what the account will hold — follows from that one control, so
     it all lives in applyRole() and is re-run whenever the choice changes. */
  function hydrateSetup(c, form) {
    var e = E();
    var back = c.querySelector('[data-back]'); if (back) back.hidden = (getOrgs().length === 0); // first run: nothing to go back to

    /* The picker. Re-checked from state on every mount, because a failed
       submit re-renders and the answer must not be lost with the values.
       Changing it repaints the dependent parts IN PLACE rather than calling
       render(): a full re-render is a fresh template, and the name, email and
       username typed above the fold would go with it. */
    c.querySelectorAll('input[name="setupAccountType"]').forEach(function (r) {
      r.checked = (r.value === setupRole());
      r.addEventListener('change', function () {
        if (!r.checked) return;
        E().accountType = r.value;
        /* Clear both refusals this answer settles. wireInputClearing does the
           same job for the text fields on `input`, but a radio is answered by
           clicking it, and "Choose Enterprise or Leaders" left standing over a
           chosen Enterprise is the form arguing with the screen. The
           Organization error goes with it because the field it belongs to may
           have just left: a message pinned to a hidden input can never be
           acted on. */
        if (UI.entry && UI.entry.errors) {
          delete UI.entry.errors.account_type;
          delete UI.entry.errors.organization_name;
        }
        setFieldErr(c, 'account_type', '');
        setFieldErr(c, 'organization_name', '');
        applyRole(c);
      });
    });
    applyRole(c);

    setVal(c, '#setupOrg', e.presetOrg);
    setVal(c, '#setupName', e.presetName);
    setVal(c, '#setupEmail', e.presetEmail);
    setVal(c, '#setupUser', e.presetUser);
    setVal(c, '#setupCode', e.presetCode);   // the passwords are never restored
    var rem = c.querySelector('#setupRemember');
    if (rem) { rem.checked = !!e.remember; rem.addEventListener('change', function () { E().remember = rem.checked; }); }
    applyBusy(c, e.busy, 'Creating…', 'Create &amp; Continue &rarr;');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); submitSetup(c); });
  }

  /* Everything on the sign-up screen that depends on which kind of account is
     being made. Three states, not two — "not yet chosen" is a real one, and it
     is where the screen starts:

       ·  none    the question is still open, so the screen asks it and claims
                  nothing. No Organization field (it belongs to one answer), no
                  note about what the account will hold (that is two different
                  sentences), and a title that describes the form rather than
                  the workspace.
       ·  enterprise  a team. It names the organization — the label every
                  screen gives the shared workspace, not a credential; nobody
                  types it to sign in — and starts with the whole Enterprise
                  space as a pool for its administrator to hand out.
       ·  leader  one person. No organization to name — the server derives the
                  workspace's name from theirs — and all six Leader programs
                  outright.

     The counts and the role names come from the catalogue rather than being
     written out here, so a seventh program in either space is described
     correctly the day it is added. */
  function applyRole(c) {
    var role = setupRole();
    var chosen = role === 'enterprise' || role === 'leader';

    showSlot(c, 'org-field', role === 'enterprise');

    var title = c.querySelector('[data-slot="title"]');
    if (title) title.innerHTML = role === 'enterprise'
      ? 'Set up your <em>organization</em>'
      : 'Create your <em>account</em>';

    var sub = c.querySelector('[data-slot="sub"]');
    if (sub) sub.textContent = !chosen
      ? 'Choose the kind of account you need, then create your workspace. The same sign-up covers every program.'
      : role === 'leader'
        ? 'Create your account and your own workspace. Everything you do here is yours alone.'
        : 'Create your workspace and your account. You can add the rest of your team next.';

    /* What this sign-up grants, said plainly before they submit — it is not a
       control they can change, and it is the difference the choice above
       actually makes. */
    var note = c.querySelector('[data-slot="program-note"]');
    if (!note) return;
    if (!chosen) { note.hidden = true; note.innerHTML = ''; return; }
    var count = roleProgramCount(role);
    var label = roleName(role);
    note.hidden = false;
    /* 'all 6 programs in Leaders' rather than 'all 6 Leaders programs': the
       role names come from the catalogue and one of them is already plural, so
       the sentence puts the name where either reads. */
    note.innerHTML = role === 'leader'
      ? 'Your account will start with <strong>all ' + count + ' programs</strong> in ' + escHtml(label) + '.'
      : 'Your organization will start with <strong>all ' + count + ' programs</strong> in ' + escHtml(label) + ', for you to assign to your team.';
  }

  /* The catalogue's own answers, with plain fallbacks for the unserved page —
     the harness boots without window.APP_CATALOGUE, and a sign-up screen that
     throws there would take the whole entry flow with it. */
  function roleProgramCount(role) {
    try {
      var list = (window.Modules && Modules.list && Modules.list(role)) || [];
      if (list.length) return list.length;
    } catch (e) { }
    return 6;
  }
  function roleName(role) {
    try {
      var r = window.Modules && Modules.roleByKey && Modules.roleByKey(role);
      if (r && r.name) return r.name;
    } catch (e) { }
    return role === 'leader' ? 'Leaders' : 'Enterprise';
  }

  function escHtml(s) {
    return s == null ? '' : String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* The rules, for both role spaces.

     WHICH SPACE is now a question this form asks, so it is a field like any
     other and is required like one. There is no default: the two spaces hold
     different programs and an account cannot be moved between them afterwards,
     so a blank answer has to come back as a blank answer rather than quietly
     becoming an Enterprise organization. (The server still defaults an
     unrecognised value to 'enterprise' — it has to decide something for a
     request that never came from this form — which is exactly why the refusal
     belongs here, where there is a person to ask.)

     An ENTERPRISE account names its organization: that name is what its members
     will type into the sign-in screen, so it is half of a credential and cannot
     be left to a default. A LEADER account has no organization to name — it is
     one person — and is not asked; the server derives the workspace's name from
     theirs (SetupController). The check is on `account_type` rather than on
     whether the field happens to be on screen, so a request that arrives without
     the form is judged by the same rule.

     Nothing here validates PROGRAMS: sign-up grants the chosen space entire, so
     there is no list to check. SetupController::entitlementFor is the authority
     and builds it from the catalogue. */
  function validateSetup(v) {
    var e = {};
    var leader = v.account_type === 'leader';
    var enterprise = v.account_type === 'enterprise';
    if (!leader && !enterprise) e.account_type = 'Choose Enterprise or Leaders.';
    /* Only once the space is known. Asking "not a Leader, so name your
       organization" of somebody who has not said which they are refuses a
       question they were never put — and the field is not even on screen to
       answer it in, so the message would sit against a hidden input under a
       picker that is already asking the only thing that matters. The server
       still requires one of anything that is not a Leader (SetupController):
       it has to judge requests that never came from this form, and this is the
       screen's own, narrower rule for the one case where there is a person to
       ask instead. */
    if (enterprise && !v.organization_name) e.organization_name = 'Enter an organization name.';
    if (!v.name) e.name = 'Enter your name.';
    /* Required: the notification machinery mails the roster, so an org whose
       owner has no address is silent from day one. Same rule and message as
       the admin member editor (org-admin.js validateMemberFields). */
    if (!v.email) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.';
    else if (v.email.length > 150) e.email = 'Email must be 150 characters or fewer.';
    if (!v.username) e.username = 'Choose a username.';
    else if (!/^[a-zA-Z0-9._-]+$/.test(v.username)) e.username = 'Use letters, numbers, dots, dashes or underscores only.';
    /* 5.9: creating an organization needs the setup code (the server checks it —
       this only says when it is empty). 5.1: the password rule, and typed twice. */
    if (!v.setup_code) e.setup_code = 'Enter the setup code.';
    var prob = passwordProblem(v.password);
    if (prob) e.password = prob;
    else if (v.password !== v.confirm) e.confirm = 'The two passwords do not match.';
    return e;
  }
  function submitSetup(c) {
    var e = E(), role = setupRole();
    var v = {
      /* Only from the field the visitor can actually see. A Leader's
         Organization cell is hidden, and sending whatever was typed into it
         before they switched would name a workspace by a route the form does
         not offer (the server ignores it too — SetupController). */
      organization_name: role === 'enterprise' ? val(c, '#setupOrg') : '',
      name: val(c, '#setupName'),
      email: val(c, '#setupEmail'),
      username: val(c, '#setupUser'),
      setup_code: val(c, '#setupCode'),
      password: (c.querySelector('#setupPassword') || {}).value || '',
      confirm: (c.querySelector('#setupConfirm') || {}).value || '',
      /* Which of the two role spaces this account is for — the picker's answer.
         Empty when nothing has been chosen, which validateSetup refuses below;
         the server validates it again against the catalogue regardless. */
      account_type: role
      /* No `modules`: sign-up grants the whole chosen space, and the server
         builds that list from the catalogue rather than from the request. */
    };
    e.presetOrg = role === 'enterprise' ? v.organization_name : e.presetOrg;
    e.presetName = v.name; e.presetEmail = v.email;
    e.presetUser = v.username; e.presetCode = v.setup_code;
    var errs = validateSetup(v);
    if (has(errs)) { e.errors = errs; e.err = ''; window.render(); return; }
    var remember = !!e.remember;
    e.errors = {}; e.err = ''; e.busy = true; window.render();
    var payload = { organization_name: v.organization_name, name: v.name, email: v.email, username: v.username, setup_code: v.setup_code, password: v.password, account_type: v.account_type, remember: remember };
    saveSetupToServer(payload, function (res) {
      if (!UI.entry) return;
      UI.entry.busy = false;
      /* The role space and the entitlement both come back on res.data — the
         server is the authority on what it recorded, so nothing from this form
         is re-sent here. */
      /* Signing yourself up signs you in: the server started the session. */
      if (res && res.ok) { finishSetup(v.organization_name, v.name, v.username, '', remember, res.data, v.email); return; }
      if (res && res.errors) {
        UI.entry.errors = mapServerErrors(res.errors);
        UI.entry.err = has(UI.entry.errors) ? '' : ((res.message) || 'Please check the highlighted fields.');
        window.render(); return;
      }
      if (res && res.reason === 'network') { UI.entry.err = 'Could not reach the setup service. Is the server running?'; window.render(); return; }
      UI.entry.err = (res && res.message) || 'Could not complete setup. Please try again.'; window.render();
    });
  }
  /* POST the setup form to the PHP + MySQL API. Callback-shaped:
     cb({ok:true,data}) | cb({ok:false,errors,message}) | cb({ok:false,reason:'network'}). */
  function saveSetupToServer(payload, cb) {
    try {
      fetch(API_BASE + '/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: (j || {}) }; }, function () { return { status: r.status, body: {} }; }); })
        .then(function (res) {
          var b = res.body;
          if (res.status >= 200 && res.status < 300 && b.success) { cb({ ok: true, data: b.data }); return; }
          if (b && b.errors) { cb({ ok: false, errors: b.errors, message: b.message }); return; }
          cb({ ok: false, message: (b && b.message) || ('Server error (' + res.status + ').') });
        })
        .catch(function () { cb({ ok: false, reason: 'network' }); });
    } catch (x) { cb({ ok: false, reason: 'network' }); }
  }

  /* ── The app administrator: a username and a password (Part 5.12) ──
     The account exists from installation — admin / NextChapter2026!, which works
     once and must then be replaced — so there is no first-use screen any more. */
  function hydrateAdmin(c, form) {
    var e = E();
    setVal(c, '#adminUser', e.user);
    applyBusy(c, e.busy, 'Working…', 'Enter &rarr;');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); submitAdmin(c); });
  }
  function submitAdmin(c) {
    var e = E();
    var user = val(c, '#adminUser');
    var pwEl = c.querySelector('#adminPassword'), password = pwEl ? pwEl.value : '';
    e.user = user;
    var errs = {};
    if (!user) errs.user = 'Enter your username.';
    if (!password) errs.password = 'Enter your password.';
    if (has(errs)) { e.errors = errs; e.err = ''; window.render(); return; }
    e.errors = {}; e.err = ''; e.busy = true; window.render();
    Auth.signInAdmin(user, password, function (res) {
      if (!UI.entry) return;
      UI.entry.busy = false;
      if (res && res.ok && res.mustChange) { startChoosePassword('admin', null, password); return; }
      if (res && res.ok) { enterAppAsAdmin(); return; }
      UI.entry.err = authRefusal(res, password); window.render();
    });
  }

  /* validateSetup is exported so the setup rules can be asserted directly
     (its siblings in org-admin.js are plain globals for the same reason). */
  window.Entry = { mount: mount, gotoStep: gotoStep, validateSetup: validateSetup, startChoosePassword: startChoosePassword };
})();
