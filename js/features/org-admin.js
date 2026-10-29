/* ============================================================
   org-admin.js - Organization, team, and app-admin management
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   The Organization/Profile modal (renderOrgModal), team-member CRUD
   with MySQL sync, organization-details sync, and the app-admin
   console (renderAdminModal: all orgs + users, add/edit/delete,
   create-new-org). Shared modal plumbing (currentModal, closeModal)
   stays in app.js core. Relies on app.js globals: data, Store, Auth,
   currentModal, closeModal, render, esc, card, UI, API helpers.
   ============================================================ */

// === ORGANIZATION & TEAM ===
// Enterprise profile + team roster. Stored on data.enterprise (object) and
// data.members (array), persisted with the rest of data via saveData().
function orgInitials(name) {
  var p = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
}

var orgSetupMode = false;

/* A Leader account is an organization of ONE. Everything on this screen that
   assumes a company — a roster of other people, an industry, a headcount, an
   executive sponsor — has no answer for them, so it is not shown and not
   required. The organization row still exists (it is the tenant, and it is what
   owns the workspace); it just carries a name and nothing else.

   The check lives here rather than being threaded through every caller because
   four things need the same answer: what the modal renders, which detail fields
   are required, what the wizard asks, and whether "add team member" exists at
   all. Defensive typeof: org-admin.js loads before app.js. */
function isSoloAccount() {
  try { return typeof accountType === 'function' && accountType() === 'leader'; }
  catch (e) { return false; }
}
/* The organization-detail fields a given account is asked for. An enterprise
   fills in the company; a leader names their workspace and says what they are
   here to do. Both readOrgDetailFields() and validateOrgDetails() go through
   this, so a field that is not rendered is never demanded. */
function orgDetailFields() {
  return isSoloAccount() ? ['name', 'objective'] : ORG_DET_FIELDS;
}

/* The three dropdowns in the bar are mutually exclusive: opening one closes the
   others. The account menu (js/features/my-assignments.js) is the third, and had
   to be added to both of these — its backdrop covers the other triggers, so two
   open at once is only reachable from script, but a dropdown that stays open
   behind another one is still a bug waiting for the next trigger. */
function toggleNavMore(e) { if (e && e.stopPropagation) e.stopPropagation(); UI.navMore = !UI.navMore; if (UI.navMore) { UI.navModules = false; UI.userMenu = false; } render(); }
function closeNavMore() { if (UI.navMore) { UI.navMore = false; render(); } }
// Module switcher (registry in js/features/modules.js, markup in nav.js)
function toggleNavModules(e) { if (e && e.stopPropagation) e.stopPropagation(); UI.navModules = !UI.navModules; if (UI.navModules) { UI.navMore = false; UI.userMenu = false; } render(); }
function closeNavModules() { if (UI.navModules) { UI.navModules = false; render(); } }
function openOrg() { orgSetupMode = false; currentModal = 'org'; UI.orgEdit = null; UI.orgDetErrors = {}; UI.orgDetBusy = false; renderOrgModal(); pullOrgMembers(); }

/* The same panel, opened as a WELCOME rather than as an edit screen: the
   "let's get set up" eyebrow, "Set Up Your Organization & Team", and the line
   saying the organization name is the only thing needed to continue.

   This had been orphaned — sign-up stopped entering it when the first-run
   wizard was removed, so the markup and the Get Started button sat unreachable.
   Restored 10 Sep 2026 for the one open that IS a first run: the panel bootApp
   raises straight after sign-up (Store.takeOpenProfile). Opening Profile from
   the More menu later still says "Organization & Team", because by then it is
   an edit screen and welcoming somebody to an app they have been using for a
   fortnight reads as a bug.

   It is the SHELL's, so every program gets it — the panel, the copy and the
   sign-up flow are the shell's in all twelve.

   pullOrgMembers() for the same reason openOrg() calls it: this panel lists the
   team, and the workspace's copy of the roster can be behind the database's. */
function openOrgSetup() { orgSetupMode = true; currentModal = 'org'; UI.orgEdit = null; UI.orgDetErrors = {}; UI.orgDetBusy = false; renderOrgModal(); pullOrgMembers(); }

/* ── Admin: manage all organizations ───────────────── */
function openAdmin() { if (!isAppAdmin) { return; } currentModal = 'admin'; UI.adminUserEdit = null; UI.adminUserErr = {}; UI.adminNewOrg = null; UI.adminAccess = null; UI.adminData = null; UI.adminError = ''; renderAdminModal(); fetchAdminData(); }

/* Load every organization + its users from the database (source of truth). */
function fetchAdminData() {
  UI.adminError = '';
  try {
    fetch(API_BASE + '/organizations')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        UI.adminData = (res && res.success && res.data && Array.isArray(res.data.organizations)) ? res.data.organizations : [];
        if (currentModal === 'admin') renderAdminModal();
      })
      .catch(function () { UI.adminData = []; UI.adminError = 'Could not reach the server.'; if (currentModal === 'admin') renderAdminModal(); });
  } catch (e) { UI.adminData = []; UI.adminError = 'Could not reach the server.'; if (currentModal === 'admin') renderAdminModal(); }
}

/* Helpers for the DB-backed admin console. */
function findLocalOrgByServerId(sid) { return getOrgs().filter(function (o) { return o.serverId === sid; })[0] || null; }
function adminOrgById(pid) { return (UI.adminData || []).filter(function (o) { return o.id === pid; })[0] || null; }
function orgAdminActor(org) { var a = ((org && org.users) || []).filter(function (u) { return u.is_admin; })[0]; return a ? a.public_id : ''; }
function adminUserAvatar(u) { return { initials: orgInitials(u.name || '') || '?', color: u.is_admin ? '#B8892A' : '#4866A0' }; }
function fmtAdminDate(s) { try { return new Date(('' + s).replace(' ', 'T')).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return '' + s; } }

/* ── Cross-org data helpers (admin edits any org without switching) ── */
function getOrgData(id) { return Store.readOrg(id) || emptyData(); }
function saveOrgData(id, d) { Store.writeOrg(id, d); if (id === currentOrgId) { data = d; applyTeamRoster(); } }

/* ── Admin: organizations ─────────────────────────── */
function adminAddOrg() { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var nm = prompt('Name the new organization:'); if (nm === null) return; nm = (nm || '').trim();
  if (!nm) { alert('Please enter an organization name.'); return; }
  var keep = currentOrgId;
  createOrg(nm);                       // creates + sets current + seeds owner
  setCurrentOrg(keep);                 // restore the admin's active org
  if (keep) { loadData(); applyTeamRoster(); } else { data = emptyData(); USERS.length = 0; }
  renderAdminModal();
}
function adminRenameOrg(id) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var o = getOrg(id); if (!o) return;
  var nm = prompt('Organization name:', o.name); if (nm === null) return; nm = (nm || '').trim(); if (!nm) return;
  saveOrgs(getOrgs().map(function (x) { return x.id === id ? Object.assign({}, x, { name: nm }) : x; }));
  var d = getOrgData(id); d.enterprise = d.enterprise || {}; d.enterprise.name = nm; saveOrgData(id, d);
  renderAdminModal();
}
/* Make an organization's workspace ready to read, then cb(orgId).
   THE ONLY SAFE WAY IN. Every path that is about to show an org's data must
   come through here, because the answer to "does this org have a workspace?"
   lives on the server. Ask Store.loadOrg first; seed only if the server says
   there genuinely isn't one. Seeding on a guess writes a blank document over
   the team's program — which is exactly what a fresh browser used to do on its
   first sign-in. cb(null) if the org is unknown. */
function openOrgWorkspace(orgId, cb) {
  Store.loadOrg(orgId, function (hasWorkspace) {
    if (hasWorkspace) { cb(orgId); return; }
    var dbOrg = Store.dbOrg(orgId) || { id: orgId, name: (getOrg(orgId) || {}).name || '', users: [] };
    cb(seedWorkspaceFromDbOrg(dbOrg));
  });
}

/* The database's view of an organization, in the shapes a workspace document
   holds them. Both are ORG-level truth (the `organizations` and `users` tables);
   a workspace only caches them. Shared so the seed path and the repair path
   below cannot drift into producing different roster records. */
function enterpriseFromDbOrg(dbOrg) {
  return {
    name: dbOrg.name || '', industry: dbOrg.industry || '', size: dbOrg.company_size || '',
    region: dbOrg.region || '', website: dbOrg.website || '', maturity: dbOrg.ai_maturity || '',
    sponsor: dbOrg.executive_sponsor || '', objective: dbOrg.objective || ''
  };
}

/* ── Whose details are these? ─────────────────────────────────
   The ORGANIZATION's. Industry, headcount, region, AI maturity, the executive
   sponsor — none of that changes because the reader switched from the Pipeline
   to Executive Readiness, any more than the team or the theme does. The
   database agrees: they are columns on `organizations`, one row per tenant,
   and doneOrgDetails() has always written them there.

   Reading them, though, went to `data.enterprise` — a copy inside the
   WORKSPACE document, and workspaces are per program (workspaces is keyed
   (organization_id, module)). So details filled in while running one program
   were invisible from the other: the Pipeline showed a full company profile
   and Executive Readiness showed eight empty fields, over one organization
   whose database row had every one of them.

   So: the database record is the answer, and the workspace copy is the
   fallback for when there is no database — file://, offline, or an org that
   was never linked. Field by field rather than whole-object, because a fresh
   workspace is stamped with `enterprise:{name}` and nothing else, and an
   all-or-nothing choice would let that one field suppress the other seven. */
function orgDetails() {
  var local = (typeof data !== 'undefined' && data && data.enterprise) || {};
  var dbOrg = null;
  try { dbOrg = (typeof Store !== 'undefined') ? Store.dbOrg(currentOrgId) : null; } catch (e) { }
  if (!dbOrg) return local;
  var db = enterpriseFromDbOrg(dbOrg);
  var out = {};
  ORG_DET_FIELDS.forEach(function (f) { out[f] = db[f] || local[f] || ''; });
  return out;
}
function rosterFromDbOrg(dbOrg) {
  return (dbOrg.users || []).map(function (u, i) {
    return {
      id: u.public_id, serverId: u.public_id, name: u.name || '', username: u.username || '',
      role: u.role || '', scope: u.scope || 'All', email: u.email || '', dept: u.department || '',
      /* No password. This row MIRRORS a database account, and the database is
         the only place its credential lives (an Argon2id hash — Models\User,
         Directive 2 Oct 2026, Part 6). The workspace document never carries one
         (Core\DocPrivacy strips it in both directions). */
      admin: !!u.is_admin,
      /* Which programs this member may open. Carried on the roster because the
         roster IS the client's copy of the team — grantedModules() reads it off
         the signed-in user, and the member editor renders its tick boxes from
         it. `null` (an older API) means "not stated", which grantedModules
         deliberately reads as the organization's whole pool rather than none. */
      modules: u.modules || null,
      initials: orgInitials(u.name || '') || '?', color: ORG_PALETTE[i % ORG_PALETTE.length]
    };
  });
}

/* Put the real team into a workspace that does not know it, so a valid session
   is not mistaken for a stale one.

   Why this exists: the team is ORG-level truth (the `users` table), but every
   module keeps its OWN workspace document and caches the roster inside it. Open
   a program this organization has never opened and that document is rev 0. The
   signed-in user is then absent from USERS, bootApp reads that as "this session
   is stale", and a perfectly good session lands back on the sign-in screen —
   exactly what happened stepping from sign-up (which ran under the default
   program's chrome) into a different program.

   The test is "does the roster know THIS USER", not "is the roster empty":
   applyTeamRoster() fills an empty document with the demo team and writes it
   into data.roster, so by the time anyone asks, it is never empty. That demo
   team is placeholder data whose ids are nothing like a public_id, so replacing
   it with the real one is a fix in itself.

   Two guards keep it from ever clobbering a real roster: it acts only when the
   database says the wanted user belongs to this organization, and only when the
   roster in hand does not already contain them.

   No request is made — Store.ready() has already fetched GET /organizations,
   which returns each organization WITH its users, so the answer is in memory.
   Nothing is written either: currentUserId is not set yet this early in boot, so
   a save would have no actor to send and the server would refuse it. The next
   real save persists the roster; until then this is a per-load repair.

   Returns true when it changed something. */
function hydrateRosterFromRegistry(orgId, userId) {
  if (typeof data !== 'object' || !data) return false;

  var dbOrg = null;
  try { dbOrg = Store.dbOrg(orgId); } catch (e) { }
  if (!dbOrg || !dbOrg.users || !dbOrg.users.length) return false;

  if (userId) {
    /* `userId` may be the database's public_id or a roster's local id for the
       same person, so check both. A workspace that minted its own id for a
       colleague would otherwise answer "not our user" about someone the
       organization plainly has — which is what left a valid session stranded
       on sign-in after a program switch. */
    var known = dbOrg.users.some(function (u) { return u.public_id === userId; })
      || (Array.isArray(data.roster) && data.roster.some(function (u) { return u.serverId === userId; }));
    if (!known) return false;                                    // not our user to restore
    if (Array.isArray(data.roster) && data.roster.some(function (u) {
      return u.id === userId || u.serverId === userId;
    })) {
      return false;                                              // roster already knows them
    }
  }

  data.roster = rosterFromDbOrg(dbOrg);
  /* The details are org-level truth too, so top up the workspace's fallback
     copy from the record — field by field. The old test was "does the copy
     have a name", and a fresh workspace is stamped with exactly `{name}` and
     nothing else, so that one field vouched for seven that were never filled. */
  var db = enterpriseFromDbOrg(dbOrg);
  if (!data.enterprise) data.enterprise = {};
  ORG_DET_FIELDS.forEach(function (f) { if (!data.enterprise[f]) data.enterprise[f] = db[f]; });
  return true;
}

/* Create a workspace for a database org, seeded with its details + roster, and
   return its local id. Uses the org's server public_id as the local id so the
   two stay linked. Callers must have confirmed the org has no workspace —
   go through openOrgWorkspace(), never call this directly. */
function seedWorkspaceFromDbOrg(dbOrg) {
  var localId = dbOrg.id; // reuse the server id locally so they're linked

  var list = getOrgs();
  if (!list.some(function (o) { return o.id === localId; })) {
    list.push({
      id: localId, name: dbOrg.name, accountType: dbOrg.account_type || 'enterprise',
      modules: dbOrg.modules || null, created: Date.now(), serverId: dbOrg.id
    });
    saveOrgs(list);
  }
  var d = emptyData();
  d.startDate = new Date().toISOString().split('T')[0];
  d.enterprise = enterpriseFromDbOrg(dbOrg);
  d.roster = rosterFromDbOrg(dbOrg);
  Store.writeOrg(localId, d);
  return localId;
}

/* Refresh the organization registry from the database, then cb().
   The database is the source of truth for which organizations exist; a browser
   that has never signed in here (new device, incognito) knows of none, so
   anything reading getOrgs() before a sign-in — the admin console most of all —
   must pull the list in first or it reports zero organizations.

   Only the LIST is fetched. Workspaces are pulled per organization, when one is
   actually opened (see openOrgWorkspace), so signing in as admin costs one
   request instead of one per organization. */
function hydrateOrgsFromServer(cb) {
  Store.refreshOrgs(function () { if (cb) cb(null); });
}

function adminOpenOrg(orgPublicId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var dbOrg = adminOrgById(orgPublicId); if (!dbOrg) return;
  // Load the workspace from the database before entering it — see openOrgWorkspace.
  openOrgWorkspace(dbOrg.id, function (localId) {
    if (!localId) return;
    try { Store.setRemember(null); } catch (e) { }
    switchToOrg(localId); Auth.setSession((USERS[0] && USERS[0].id) || null);
    persistAdminSession();
    UI.adminUserEdit = null; closeModal(); render();
  });
}
/* ── Reset data (Directive 2 Oct 2026, Part 4; live 6 Oct 2026) ─────────────────────────────
   The admin console's per-organization reset, under the reset scope law (Rollout item 68): the
   organization, its name, its administrators, their sign-ins and its AI settings stay; every other member
   is removed — from the ORGANIZATION, so from every program (ruled 6 Oct 2026) — with the work of every program
   whose directive is applied: the Pipeline's and, since 7 Oct 2026, Executive Readiness's and Responsible AI Governance's. One request; the server
   does all of it in one transaction (OrganizationController::reset). Replaces the More menu's Reset all data on both. */
function adminResetOrg(orgPublicId) {
  if (!isAppAdmin || !orgPublicId) return;
  if (!confirm('Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone.')) return;
  postJSON(API_BASE + '/organizations/reset', { id: orgPublicId },   /* the app administrator's session authorises it */
    function () {
      if (currentModal === 'admin') fetchAdminData();
      if (UI.entry && UI.entry.step === 'admin') { try { hydrateOrgsFromServer(function () { render(); }); } catch (e) { render(); } }
      /* The organization being viewed: its document was just replaced — read it now rather than at the next poll. */
      try { if (orgServerId() === orgPublicId && Store.checkRemote) Store.checkRemote(); } catch (e) { }
    },
    function (err) { alert((err && err.message) || 'Could not reset this organization.'); });
}

function adminDeleteOrg(orgPublicId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var org = adminOrgById(orgPublicId); if (!org) return;
  if (org.id === orgServerId()) { alert("You can't delete the organization you're currently in. Open another one first."); return; }
  if (!confirm('Delete "' + org.name + '" and all of its data? This cannot be undone.')) return;
  postJSON(API_BASE + '/organizations/delete', { id: orgPublicId, actor_id: orgAdminActor(org) },
    function () { fetchAdminData(); },
    function (err) { alert((err && err.message) || 'Could not delete this organization.'); });
}

/* ── Temporary passwords (Directive 2 Oct 2026, Part 5.7) ──────────────────────
   An administrator never sees or keeps a member's password. Adding someone, they
   give a temporary one (required); editing someone, an empty field leaves the
   password alone and a typed one replaces it. Either way it is sent once to
   POST /admin/temporary-password, marked must-change, and the member chooses
   their own at their next sign-in. The field is never filled back in — not even
   after a refused Save. */
function temporaryFieldHtml(id, isNew, err) {
  return '<div><label class="org-flabel" for="' + id + '">Temporary password' + (isNew ? ' <span style="color:#c0392b">*</span>' : '') + '</label>'
    + '<input id="' + id + '" class="field-input" type="password" autocomplete="new-password" value="" placeholder="' + (isNew ? '' : 'Leave empty to keep their password') + '"'
    + (err ? ' style="border-color:#c0392b"' : '') + '/>'
    + (err ? '<div class="org-field-err" style="color:#c0392b;font-size:12px;margin-top:4px">' + esc(err) + '</div>' : '')
    + '<div class="pw-rule">' + PASSWORD_RULE_TEXT + '</div>'
    + '<div class="pw-note">The person will be asked to choose their own password the next time they sign in.</div></div>';
}
/** '' when acceptable: required for someone new, optional (empty = unchanged) otherwise. */
function temporaryProblem(temp, isNew) {
  if (!temp) return isNew ? 'Give them a temporary password.' : '';
  return passwordProblem(temp);
}
/* ── Sweep 4R item 2 (addendum 5 Oct 2026, Paul's decision; wording approved): administrators make administrators, and an
   organization always has one. The server (UserController) applies the same rule and is the authority; a requested change
   is held in _pendingAdmin until it answers, so a refusal never leaves this browser believing something the server does not. ── */
var LAST_ADMIN_MSG = 'An organization needs at least one administrator. Make someone else an administrator first.';
function adminCountIn(list) { return (list || []).filter(function (x) { return x && x.admin === true; }).length; }
function adminTickHtml(id, on) { return '<label class="admin-tick"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '/> <span>Administrator</span></label>'; }
var _pendingAdmin = {};   /* local member id -> the administrator flag asked for, until the server answers */

/** Send it; cb(null) on success, cb(message) otherwise. */
function sendTemporaryPassword(orgPublicId, userPublicId, temp, cb) {
  if (!temp) { cb(null); return; }
  if (!orgPublicId || !userPublicId) { cb('The temporary password could not be set: this member is not in the database yet.'); return; }
  Auth.setTemporaryPassword(orgPublicId, userPublicId, temp, function (res) {
    cb(res && res.ok ? null : 'Saved, but the temporary password was not set: ' + authRefusal(res, temp));
  });
}

/* ── Admin: users (within any org) — all persisted to MySQL ─────────── */
/* ── The admin console's user editor ──────────────────────────────────────
   `values` is what has been TYPED, and from the first Save onwards it is what
   the editor renders from. Without it, Save on an incomplete form re-rendered
   the editor out of the user record — `{}` for a new user — so every field the
   admin had filled in was erased by the act of being told one was missing. The
   admin retyped six fields to correct one, or lost the lot.

   Both sibling forms already worked this way: adminNewOrgSave keeps
   UI.adminNewOrg.values, and saveProfile writes the typed values straight back
   onto the member before validating. This is that same rule in the one editor
   that had been left out of it. */
function adminEditUser(orgId, userId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ UI.adminUserEdit = { orgId: orgId, userId: userId }; UI.adminUserErr = {}; renderAdminModal(); }
function adminAddUser(orgId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ UI.adminUserEdit = { orgId: orgId, userId: 'new' }; UI.adminUserErr = {}; renderAdminModal(); }
function adminCancelUser() { UI.adminUserEdit = null; UI.adminUserErr = {}; renderAdminModal(); }

/** Read the editor's text fields off the DOM. */
function adminReadUserFields() {
  var v = {};
  ['name', 'username', 'role', 'scope', 'email', 'dept'].forEach(function (f) {
    var el = $('au_' + f); v[f] = el ? el.value.trim() : '';
  });
  var t = $('au_temporary'); v.temporary = t ? t.value : '';   /* never trimmed, never kept */
  var a = $('au_admin'); if (a) v.admin = a.checked === true;   /* Sweep 4R item 2 (A.5.29) */
  return v;
}

/** What a field shows: what was typed if this editor has been submitted, else
    what is stored. Never `u[key]` once `values` exists — a blank the admin
    deliberately cleared has to stay blank. */
function adminUserFieldValue(u, key) {
  var typed = (UI.adminUserEdit && UI.adminUserEdit.values) || null;
  if (typed) return typed[key] || '';
  return (u && u[key]) || '';
}

/* Required-field validation for the admin user editor (server also enforces). */
function validateAdminUserFields(v, isNew) {
  var e = {};
  if (!v.name) e.name = 'Name is required.'; else if (v.name.length < 2) e.name = 'Name must be at least 2 characters.'; else if (v.name.length > 120) e.name = 'Name must be 120 characters or fewer.';
  if (!v.username) e.username = 'Username is required.'; else if (!/^[a-zA-Z0-9_.-]+$/.test(v.username)) e.username = 'Use only letters, numbers, and . _ -'; else if (v.username.length < 3) e.username = 'Username must be at least 3 characters.'; else if (v.username.length > 60) e.username = 'Username must be 60 characters or fewer.';
  if (!v.role) e.role = 'Role / title is required.'; else if (v.role.length > 60) e.role = 'Role must be 60 characters or fewer.';
  if (!v.scope) e.scope = 'Scope / focus is required.'; else if (v.scope.length > 60) e.scope = 'Scope must be 60 characters or fewer.';
  if (!v.email) e.email = 'Email is required.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.'; else if (v.email.length > 150) e.email = 'Email must be 150 characters or fewer.';
  if (!v.dept) e.dept = 'Department is required.'; else if (v.dept.length > 80) e.dept = 'Department must be 80 characters or fewer.';
  // A temporary password: required for a new user; on edit, empty keeps theirs (5.7).
  var tp = temporaryProblem(v.temporary, isNew); if (tp) e.temporary = tp;
  return e;
}

function adminSaveUser(orgPublicId, userPublicId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  if (UI.adminUserBusy) return;
  var isNew = (userPublicId === 'new');
  var v = adminReadUserFields();

  var org = adminOrgById(orgPublicId); var actor = orgAdminActor(org);
  /* Sweep 4R item 2: demoting the last administrator is refused before anything changes (A.5.30) */
  if (!isNew && v.admin === false) {
    var _ousers = (org && org.users) || [], _tu = _ousers.filter(function (x) { return x.public_id === userPublicId; })[0];
    if (_tu && _tu.is_admin && _ousers.filter(function (x) { return x.is_admin; }).length <= 1) { alert(LAST_ADMIN_MSG); renderAdminModal(); return; }
  }

  /* Everything on screen, remembered before anything can reject it — the text
     fields and the access ticks alike. The re-render below rebuilds both from
     scratch, so whatever is not held here is gone. */
  var poolMods = (window.Modules ? Modules.list((org && org.account_type) || 'enterprise') : [])
    .filter(function (m) { return ((org && org.modules) || []).indexOf(m.id) >= 0; });
  if (UI.adminUserEdit) {
    UI.adminUserEdit.values = Object.assign({}, v); delete UI.adminUserEdit.values.temporary;   /* a password is never put back on screen */
    if (poolMods.length) UI.adminUserEdit.modules = adminReadPicker('aum_', poolMods);
  }

  var errs = validateAdminUserFields(v, isNew);
  if (Object.keys(errs).length) { UI.adminUserErr = errs; renderAdminModal(); return; }

  var payload = { actor_id: actor, name: v.name, username: v.username, role: v.role, scope: v.scope, email: v.email, department: v.dept };
  if (typeof v.admin === 'boolean') payload.is_admin = v.admin;   /* Sweep 4R item 2 */

  /* The access picker, read above with the rest of the screen. Sent only when
     the editor actually rendered one — an organization with an empty plan has
     no boxes, and an empty array there would mean "revoke everything" rather
     than "unchanged". */
  if (poolMods.length) payload.modules = (UI.adminUserEdit && UI.adminUserEdit.modules) || [];

  var url;
  /* A new member's temporary password goes WITH the add (7 Oct 2026): the server checks it before creating anyone,
     stores only its hash, and puts it in the access email. Editing someone still sends it on its own (5.7.3). */
  if (isNew) { payload.organization_id = orgPublicId; url = API_BASE + '/users'; if (v.temporary) payload.temporary = v.temporary; }
  else { payload.id = userPublicId; url = API_BASE + '/users/update'; }

  UI.adminUserErr = {}; UI.adminUserBusy = true; renderAdminModal();
  postJSON(url, payload,
    function (res) {
      var savedId = isNew ? (res && res.data && res.data.id) : userPublicId;
      var inv = res && res.data && res.data.invite;
      /* The account exists; an edited member's new temporary password follows on its own (5.7) — a new
         member's already went with the add — then report. */
      sendTemporaryPassword(orgPublicId, savedId, isNew ? '' : v.temporary, function (problem) {
        UI.adminUserBusy = false; UI.adminUserEdit = null; UI.adminUserErr = {}; fetchAdminData();
        if (problem) { alert(problem); return; }
        // Adding a user from the console sends the same invite as adding one from
        // the Team screen; say what became of it either way.
        if (inv) showToast(inviteMessage(inv, { name: v.name, email: v.email }, !!v.temporary));
      });
    },
    function (err) {
      UI.adminUserBusy = false;
      UI.adminUserErr = mapServerFieldErrors(err && err.errors);
      if (!Object.keys(UI.adminUserErr).length) UI.adminUserErr = { _general: (err && err.message) || 'Could not save this user.' };
      renderAdminModal();
    });
}
function adminDeleteUser(orgPublicId, userPublicId) { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var org = adminOrgById(orgPublicId);
  var u = ((org && org.users) || []).filter(function (x) { return x.public_id === userPublicId; })[0];
  if (u && u.is_admin && ((org && org.users) || []).filter(function (x) { return x.is_admin; }).length <= 1) { alert(LAST_ADMIN_MSG); return; }   /* Sweep 4R item 2 (A.5.30): an administrator may go while another remains */
  if (!confirm('Delete ' + ((u && u.name) || 'this user') + '?')) return;
  postJSON(API_BASE + '/users/delete', { id: userPublicId, actor_id: orgAdminActor(org) },
    function () { UI.adminUserEdit = null; fetchAdminData(); },
    function (err) { alert((err && err.message) || 'Could not delete this user.'); });
}

/* ═══ Super Admin: application access ══════════════════════════════════════
   The console reaches across every organization, so it is where the two levels
   of entitlement are actually visible together:

     an ORGANIZATION'S PLAN   which programs it holds at all (org_modules).
                              Only the Super Admin sets this.
     a MEMBER'S ACCESS        which of those each person may open
                              (user_modules), clamped to the plan above.

   Both are written through /access (AccessController), which checks the app
   administrator's server session on every request (Directive 2 Oct 2026,
   Part 6) rather than trusting that this browser once signed in.

   No new CSS anywhere in here: the pickers reuse the sign-up screen's role
   tiles, and everything around them reuses the console's own classes. */

/** Every module of a role space, for the plan picker. */
function adminRoleModules(accountTypeKey) {
  return (window.Modules ? Modules.list(accountTypeKey || 'enterprise') : []);
}

/** A reusable checkbox grid over a module list. `idPrefix` namespaces the DOM ids. */
/* `lockNonLive` for the pickers that decide who may OPEN a program: a program
   still in development has nothing behind it to open, so it cannot be granted.
   The organization's PLAN is a different question — what an account holds is the
   app administrator's to set, and a plan may well be sold before a program
   ships — so that picker leaves them selectable. */
function adminModulePickerHtml(idPrefix, mods, selected, disabled, lockNonLive) {
  if (!mods.length) return '<p class="t-stone-md" style="font-size:13px;margin:4px 0 0">No programs available.</p>';
  var sel = selected || [];
  var h = '<fieldset class="entry-roles entry-roles-row">';
  mods.forEach(function (m) {
    var soon = m.status !== 'live';
    var off = disabled || (lockNonLive && soon);
    h += '<label class="entry-role' + (lockNonLive && soon ? ' entry-role-soon' : '') + '"'
      + (lockNonLive && soon ? ' title="Not available yet — this program is still in development"' : '') + '>'
      + '<input type="checkbox" id="' + esc(idPrefix) + esc(m.id) + '" value="' + esc(m.id) + '"'
      + (sel.indexOf(m.id) >= 0 ? ' checked' : '') + (off ? ' disabled' : '') + '/>'
      + '<span class="entry-role-body">'
      + '<span class="entry-role-name">' + esc(m.name) + '</span>'
      + '<span class="entry-role-sub">' + esc(m.tag || m.sub || '')
      + (soon ? ' · in development' : '') + '</span>'
      + '</span></label>';
  });
  return h + '</fieldset>';
}

/** Read a picker back out of the DOM. */
function adminReadPicker(idPrefix, mods) {
  var out = [];
  mods.forEach(function (m) { var el = $(idPrefix + m.id); if (el && el.checked) out.push(m.id); });
  return out;
}

/* ── An organization's plan ─────────────────────────────────────── */
function adminAccessOpen(orgId) {
  UI.adminUserEdit = null; UI.adminNewOrg = null;
  UI.adminAccess = { orgId: orgId, busy: false, error: '' };
  renderAdminModal();
}
function adminAccessCancel() { UI.adminAccess = null; renderAdminModal(); }

function adminAccessSave(orgId) {
  if (UI.adminAccess && UI.adminAccess.busy) return;
  var org = adminOrgById(orgId); if (!org) return;
  var mods = adminRoleModules(org.account_type);
  var wanted = adminReadPicker('aap_', mods);

  UI.adminAccess.busy = true; UI.adminAccess.error = ''; renderAdminModal();
  postJSON(API_BASE + '/access/org', { id: orgId, modules: wanted },
    function () { UI.adminAccess = null; fetchAdminData(); },
    function (err) {
      UI.adminAccess.busy = false;
      UI.adminAccess.error = (err && err.reason === 'forbidden') ? 'Your admin session has ended. Sign in again to change an organization’s plan.'
        : ((err && err.message) || 'Could not update this organization’s plan.');
      renderAdminModal();
    });
}

function adminAccessEditorHtml(o) {
  var st = UI.adminAccess || {};
  var mods = adminRoleModules(o.account_type);
  var h = '<div class="org-card editing admin-user-editor">';
  h += '<div class="org-card-head"><div class="org-card-headtxt">Programs on this plan</div></div>';
  if (st.error) h += '<div class="entry-err" style="margin:0 0 12px;color:#c0392b;font-size:13px">' + esc(st.error) + '</div>';
  h += '<p class="t-stone-md" style="font-size:13px;margin:0 0 10px">'
    + 'What this ' + esc(o.account_type === 'leader' ? 'individual' : 'organization') + ' holds. '
    + 'Its administrator can only assign programs from this set, and removing one takes it away from '
    + 'every member at once — their individual access is remembered, so putting it back restores who had it.'
    + '</p>';
  h += adminModulePickerHtml('aap_', mods, o.modules || []);
  h += '<div class="org-edit-actions">';
  h += '<button class="org-btn-save" onclick="adminAccessSave(\'' + esc(o.id) + '\')"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Saving…' : 'Save plan') + '</button>';
  h += '<button class="org-btn-cancel" onclick="adminAccessCancel()"' + (st.busy ? ' disabled' : '') + '>Cancel</button>';
  h += '</div></div>';
  return h;
}

/** One line naming a member's programs, for the console's user rows. */
function adminUserAccessLine(o, u) {
  var pool = o.modules || [];
  var mine = u.modules || [];
  if (!pool.length) return 'No programs on this plan';
  if (mine.length === pool.length && pool.length) return 'All ' + pool.length + ' programs';
  if (!mine.length) return 'No program access';
  return mine.map(function (id) {
    var m = window.Modules && Modules.byId(id);
    return (m && m.name) || id;
  }).join(' · ');
}

function adminUserEditorHtml(orgId, u) {
  u = u || {};
  // The DB returns the field as `department`; map it to the `dept` input.
  if (u.department != null && u.dept == null) u.dept = u.department;
  var fe = UI.adminUserErr || {};
  var busy = !!UI.adminUserBusy;
  var isNew = (u.public_id == null);
  // key is the input id; src (optional) is where to read the value from on the user object.
  function f(label, key, ph, type, opts) {
    opts = opts || {};
    var req = opts.req !== false;
    var err = fe[key];
    return '<div><label class="org-flabel">' + label + (req ? ' <span style="color:#c0392b">*</span>' : '') + '</label>'
      + '<input id="au_' + key + '" class="field-input" type="' + (type || 'text') + '" value="' + esc(adminUserFieldValue(u, key)) + '" placeholder="' + esc(ph) + '" autocomplete="off"' + (err ? ' style="border-color:#c0392b"' : '') + '/>'
      + (err ? '<div class="org-field-err" style="color:#c0392b;font-size:12px;margin-top:4px">' + esc(err) + '</div>' : '') + '</div>';
  }
  var idArg = isNew ? 'new' : u.public_id;
  var h = '<div class="org-card editing admin-user-editor">';
  h += '<div class="org-card-head">' + userAv(isNew ? { initials: '?', color: '#8A7B72' } : adminUserAvatar(u), 36) + '<div class="org-card-headtxt">' + (isNew ? 'New user' : 'Editing user') + '</div></div>';
  if (fe._general) h += '<div class="entry-err" style="margin:0 0 12px;color:#c0392b;font-size:13px">' + esc(fe._general) + '</div>';
  h += '<div class="org-edit-grid">';
  h += f('Name', 'name', 'Full name');
  h += f('Username', 'username', 'e.g. maria');
  h += f('Role / title', 'role', 'e.g. Pipeline Owner');
  h += f('Scope / focus', 'scope', 'e.g. Operations');
  h += f('Email', 'email', 'name@company.com', 'email');
  h += f('Department', 'dept', 'e.g. Strategy');
  h += temporaryFieldHtml('au_temporary', isNew, fe.temporary);
  var _typed = (UI.adminUserEdit && UI.adminUserEdit.values) || null;
  h += adminTickHtml('au_admin', (_typed && ('admin' in _typed)) ? !!_typed.admin : !!u.is_admin);   /* Sweep 4R item 2 (A.5.29) */
  h += '</div>';

  /* Which of the organization's programs this person may open. The options are
     the ORGANIZATION'S plan, not the whole role space — the server clamps to it
     anyway (Models\Access::setForUser), and offering a box that silently does
     nothing when ticked is worse than not offering it. */
  var org = adminOrgById(orgId) || {};
  var poolMods = (window.Modules ? Modules.list(org.account_type || 'enterprise') : [])
    .filter(function (m) { return (org.modules || []).indexOf(m.id) >= 0; });
  h += '<div style="margin-top:16px"><label class="org-flabel">Application access</label>';
  if (!poolMods.length) {
    h += '<p class="t-stone-md" style="font-size:13px;margin:4px 0 0">'
      + 'This organization has no programs on its plan yet — set one first.</p>';
  } else {
    h += '<p class="t-stone-md" style="font-size:13px;margin:4px 0 10px">'
      + (isNew
        ? 'They will be emailed links to whatever you tick here, with their username and the temporary password.'   /* 7 Oct 2026: the invite carries it */
        : 'They can only open the programs ticked here.')
      + '</p>';
    /* Per-USER access: in-development programs cannot be granted (see the
       picker). Ticks survive a rejected Save the same way the fields above do —
       held on UI.adminUserEdit.modules, which is only set once this editor has
       been submitted, so an untouched editor still shows what is stored. */
    var ticked = (UI.adminUserEdit && UI.adminUserEdit.modules)
      || (isNew ? [] : (u.modules || []));
    h += adminModulePickerHtml('aum_', poolMods, ticked, false, true);
  }
  h += '</div>';

  h += '<div class="org-edit-actions">';
  h += '<button class="org-btn-save" onclick="adminSaveUser(\'' + orgId + '\',\'' + idArg + '\')"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Saving…' : 'Save') + '</button>';
  h += '<button class="org-btn-cancel" onclick="adminCancelUser()"' + (busy ? ' disabled' : '') + '>Cancel</button>';
  if (!isNew) h += '<button class="org-btn-del" onclick="adminDeleteUser(\'' + orgId + '\',\'' + u.public_id + '\')">Delete</button>';
  h += '</div></div>';
  return h;
}

/* ── Admin: create a new organization + its first administrator ──────── */
/* The new-organization form shows on two surfaces: the in-app admin modal and
   the pre-login admin console (renderAdminConsole in app.js). Repaint whichever
   one is on screen, so the same server-backed form serves both. */
function adminSurfaceRender() {
  if (currentModal === 'admin') { renderAdminModal(); return; }
  if (isAppAdmin && UI.entry && UI.entry.step === 'admin') { render(); return; }
  renderAdminModal();
}
function adminNewOrgOpen() { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ UI.adminUserEdit = null; UI.adminNewOrg = { open: true, errors: {}, busy: false }; adminSurfaceRender(); }
function adminNewOrgCancel() { UI.adminNewOrg = null; adminSurfaceRender(); }

function validateNewOrgFields(v) {
  var e = {};
  if (!v.organization_name) e.organization_name = 'Organization name is required.'; else if (v.organization_name.length < 2) e.organization_name = 'Must be at least 2 characters.'; else if (v.organization_name.length > 150) e.organization_name = 'Must be 150 characters or fewer.';
  if (!v.name) e.name = 'Administrator name is required.'; else if (v.name.length < 2) e.name = 'Must be at least 2 characters.'; else if (v.name.length > 120) e.name = 'Must be 120 characters or fewer.';
  /* Required by POST /setup (the notification machinery mails the roster), so
     the form must ask for it — same rule and message as the setup screen. */
  if (!v.email) e.email = 'Email is required.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.'; else if (v.email.length > 150) e.email = 'Must be 150 characters or fewer.';
  if (!v.username) e.username = 'Username is required.'; else if (!/^[a-zA-Z0-9_.-]+$/.test(v.username)) e.username = 'Use only letters, numbers, and . _ -'; else if (v.username.length < 3) e.username = 'Must be at least 3 characters.'; else if (v.username.length > 60) e.username = 'Must be 60 characters or fewer.';
  /* Created from the admin console, the first person's password is temporary (5.7.4): they choose their own at first sign-in. */
  var tp = temporaryProblem(v.password, true); if (tp) e.password = tp;
  return e;
}

function adminNewOrgSave() { if (!isAppAdmin) return;   /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  if (!UI.adminNewOrg || UI.adminNewOrg.busy) return;
  var keys = ['organization_name', 'name', 'email', 'username'];
  var v = {}; keys.forEach(function (k) { var el = $('nao_' + k); v[k] = el ? el.value.trim() : ''; });
  var pw = $('nao_password'); v.password = pw ? pw.value : '';
  UI.adminNewOrg.values = Object.assign({}, v); delete UI.adminNewOrg.values.password; // keep what was typed — except the password
  var errs = validateNewOrgFields(v);
  if (Object.keys(errs).length) { UI.adminNewOrg.errors = errs; adminSurfaceRender(); return; }

  UI.adminNewOrg.errors = {}; UI.adminNewOrg.busy = true; adminSurfaceRender();
  postJSON(API_BASE + '/setup', { organization_name: v.organization_name, name: v.name, email: v.email, username: v.username, password: v.password },
    function () {
      UI.adminNewOrg = null; showToast('✓ Organization created. Give its administrator the temporary password.');
      if (currentModal === 'admin') fetchAdminData();
      // Pull the registry back from the database so the console lists the new
      // org under its real id — the id every later save and sign-in uses.
      hydrateOrgsFromServer(function () { adminSurfaceRender(); });
    },
    function (err) {
      UI.adminNewOrg.busy = false;
      UI.adminNewOrg.errors = (err && err.errors) ? mapServerFieldErrors(err.errors) : {};
      if (!Object.keys(UI.adminNewOrg.errors).length) UI.adminNewOrg.errors = { _general: (err && err.message) || 'Could not create the organization.' };
      adminSurfaceRender();
    });
}

function adminNewOrgFormHtml() {
  var st = UI.adminNewOrg || {}; var fe = st.errors || {}; var busy = !!st.busy; var vals = st.values || {};
  function f(label, key, ph, type) {
    var err = fe[key];
    return '<div><label class="org-flabel">' + label + ' <span style="color:#c0392b">*</span></label>'
      + '<input id="nao_' + key + '" class="field-input" type="' + (type || 'text') + '" placeholder="' + esc(ph) + '" autocomplete="off" value="' + esc(vals[key] || '') + '"' + (err ? ' style="border-color:#c0392b"' : '') + '/>'
      + (err ? '<div class="org-field-err" style="color:#c0392b;font-size:12px;margin-top:4px">' + esc(err) + '</div>' : '') + '</div>';
  }
  var h = '<div class="org-card editing" style="margin-top:10px">';
  h += '<div class="org-card-head"><div class="org-card-headtxt">New organization &amp; its administrator</div></div>';
  if (fe._general) h += '<div class="entry-err" style="margin:0 0 12px;color:#c0392b;font-size:13px">' + esc(fe._general) + '</div>';
  h += '<div class="org-edit-grid">';
  h += f('Organization name', 'organization_name', 'e.g. Acme Manufacturing');
  h += f('Administrator name', 'name', 'e.g. Maria Torres');
  h += f('Email', 'email', 'e.g. maria@acme.com', 'email');
  h += f('Username', 'username', 'e.g. maria');
  h += temporaryFieldHtml('nao_password', true, fe.password);
  h += '</div>';
  h += '<div class="org-edit-actions">';
  h += '<button class="org-btn-save" onclick="adminNewOrgSave()"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Creating…' : 'Create organization') + '</button>';
  h += '<button class="org-btn-cancel" onclick="adminNewOrgCancel()"' + (busy ? ' disabled' : '') + '>Cancel</button>';
  h += '</div></div>';
  return h;
}

function renderAdminModal() {
  var mr = $('modalRoot'); if (!mr) return;
  if (currentModal !== 'admin') { mr.innerHTML = ''; return; }
  var h = '<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal">';
  h += '<h3>Admin</h3>';
  if (UI.adminData == null) {
    h += '<div class="u-e6b5a04">Loading organizations from the database...</div>';
    h += '<div class="u-ea28b89"><button class="btn-gold" onclick="closeModal()">Done</button></div></div></div>';
    mr.innerHTML = h; return;
  }
  /* Newest organization first (29 Oct 2026). created_at is "YYYY-MM-DD hh:mm:ss", so it sorts as text. */
  var orgs = (UI.adminData || []).slice().sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
  var totalUsers = 0; orgs.forEach(function (o) { totalUsers += (o.users || []).length; });
  var ed = UI.adminUserEdit || null;
  var acc = UI.adminAccess || null;
  var curSid = orgServerId();
  /* Both audiences in one count. A Leader account is an organization of one, so
     it appears in this list like any other — but calling twelve individuals
     "12 organizations" hides the thing the Super Admin most needs to see. */
  var leaderCount = orgs.filter(function (o) { return o.account_type === 'leader'; }).length;
  var entCount = orgs.length - leaderCount;
  h += '<div class="u-e6b5a04">Every account in the database, with its programs and who can open them. '
    + entCount + ' organization' + (entCount === 1 ? '' : 's')
    + ' \xb7 ' + leaderCount + ' leader' + (leaderCount === 1 ? '' : 's')
    + ' \xb7 ' + totalUsers + ' user' + (totalUsers === 1 ? '' : 's') + '.</div>';
  if (UI.adminError) h += '<div class="entry-err" style="margin:0 0 12px;color:#c0392b">' + esc(UI.adminError) + ' <button class="org-btn-cancel admin-mini-btn" onclick="fetchAdminData()">Retry</button></div>';
  /* New Organization and Done at the top (29 Oct 2026): at the bottom they sat under every organization's member list. */
  h += '<div style="display:flex;justify-content:center;align-items:center;gap:12px;margin:0 0 14px">';
  if (!(UI.adminNewOrg && UI.adminNewOrg.open)) h += '<button class="admin-adduser" onclick="adminNewOrgOpen()">+ New Organization</button>';
  h += '<button class="btn-gold" onclick="closeModal()">Done</button></div>';
  // Create a brand-new organization + its first administrator.
  if (UI.adminNewOrg && UI.adminNewOrg.open) { h += adminNewOrgFormHtml(); }
  if (!orgs.length && !UI.adminError) h += '<div class="u-e6b5a04" style="opacity:.7">No organizations yet.</div>';
  h += '<div class="admin-mgr-list">';
  orgs.forEach(function (o) {
    var cur = (o.id === curSid);
    var users = o.users || [];
    var hasLocal = !!findLocalOrgByServerId(o.id);
    var isLeader = o.account_type === 'leader';
    var plan = o.modules || [];
    h += '<div class="admin-mgr-org' + (cur ? ' admin-org-current' : '') + '">';
    // Org header
    h += '<div class="admin-mgr-orghead"><div class="entry-org-badge">' + esc((o.name || '?').slice(0, 1).toUpperCase()) + '</div>';
    h += '<div class="admin-mgr-orgmeta"><div class="admin-org-name">' + esc(o.name) + (cur ? ' <span class="org-you">Current</span>' : '') + '</div>';
    /* The role space, then the plan. Both are new to this line and both earn
       their place: which space an account is in decides which six programs it
       could ever hold, and how many it actually holds is the number that
       explains everything listed under it. */
    h += '<div class="admin-org-sub">' + (isLeader ? 'Leader' : 'Enterprise')
      + ' \xb7 ' + plan.length + ' program' + (plan.length === 1 ? '' : 's')
      + ' \xb7 ' + users.length + ' user' + (users.length === 1 ? '' : 's')
      + ' \xb7 created ' + esc(fmtAdminDate(o.created_at)) + '</div>';
    /* The organization code. Sign-in asks for the organization first, and its
       NAME is normally the answer — but if two organizations ever share one,
       this is what their members have to type instead. The console is where
       someone is asked for it, so it is written here rather than looked up. */
    h += '<div class="admin-org-sub">Sign-in code: <code>' + esc(o.id) + '</code></div></div>';
    h += '<div class="admin-mgr-orgactions">';
    h += '<button class="org-btn-cancel admin-mini-btn" onclick="adminAccessOpen(\'' + o.id + '\')">Programs</button>';
    if (!cur) h += '<button class="org-btn-cancel admin-mini-btn" onclick="adminOpenOrg(\'' + o.id + '\')">Open</button>';
    h += '<button class="org-btn-cancel admin-mini-btn" onclick="adminResetOrg(\'' + o.id + '\')">Reset data</button>';
    if (!cur) h += '<button class="org-row-btn org-row-del" title="Delete organization" onclick="adminDeleteOrg(\'' + o.id + '\')">\xd7</button>';
    h += '</div></div>';
    h += adminAiFeaturesRowHtml(o);
    // The organization's plan, when it is the one being edited.
    if (acc && acc.orgId === o.id) h += adminAccessEditorHtml(o);
    // Users
    h += '<div class="admin-mgr-users">';
    users.forEach(function (u) {
      if (ed && ed.orgId === o.id && ed.userId === u.public_id) { h += adminUserEditorHtml(o.id, u); return; }
      h += '<div class="admin-mgr-userrow">' + userAv(adminUserAvatar(u), 28)
        + '<div class="admin-mgr-uinfo"><span class="admin-user-name">' + esc(u.name || 'Unnamed') + '</span> <span class="admin-user-uname">@' + esc(u.username || '—') + '</span>'
        /* Which programs this person can open, on the row itself. It is the
           answer the Super Admin console exists to give, and it was not visible
           anywhere before — not on the row, not in the editor, not in the API.

           A DIV, not a span: .admin-mgr-uinfo is `white-space: nowrap`, so an
           inline element runs straight on from the username with no gap. A
           block child takes its own line without touching the stylesheet. */
        + '<div class="admin-org-sub">' + esc(adminUserAccessLine(o, u)) + '</div></div>'
        + '<span class="admin-user-role">' + esc(u.role || '') + '</span>'
        + '<button class="org-row-btn" title="Edit user" onclick="adminEditUser(\'' + o.id + '\',\'' + u.public_id + '\')">\u270E</button>'
        + '</div>';
    });
    if (ed && ed.orgId === o.id && ed.userId === 'new') { h += adminUserEditorHtml(o.id, {}); }
    /* A Leader account is an organization of ONE. Offering "+ Add user" on one
       invites the console to create a second person inside a tenant whose whole
       design is that there is never more than one — the launchpad, the
       workspace and the chat room all assume it. */
    else if (!isLeader) { h += '<button class="admin-adduser" onclick="adminAddUser(\'' + o.id + '\')">+ Add user</button>'; }
    h += '</div>';
    h += '</div>';
  });
  h += '</div>';
  h += '</div></div>';
  mr.innerHTML = h;
  Array.prototype.forEach.call(mr.querySelectorAll('input[data-ai-mixed]'), function (el) { el.indeterminate = true; });
}

/* ── Admin: the AI Guide and Voice, per organization (29 Oct 2026) ──────────────
   One pair of switches on each organization's card, for every program it has opened that carries them
   (OrganizationController::aiFeatures). Programs that disagree show as Mixed until a switch is set. The
   organization's own administrators still set them per program on its Organization & Team page. */
function adminAiFeaturesRowHtml(o) {
  var ai = o.ai; if (!ai) return '';
  var row = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:8px 16px 10px;font-family:var(--sans);font-style:normal;font-size:13px;color:var(--paper)';
  var cap = '<span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)">AI features</span>';
  if (!ai.programs || !ai.programs.length) {
    if (o.account_type === 'leader') return '';
    return '<div class="admin-org-ai" style="' + row + '">' + cap + '<span style="color:var(--stone)">On when its first program opens.</span></div>';
  }
  function sw(key, label) {
    var v = ai[key];
    return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600">'
      + '<input type="checkbox" role="switch" style="width:16px;height:16px;margin:0;accent-color:var(--gold);cursor:pointer"'
      + (v === true ? ' checked' : '') + (v === null ? ' data-ai-mixed="1"' : '')
      + ' onchange="adminSetAiFeature(\'' + o.id + '\',\'' + key + '\',this.checked)"/> ' + label
      + (v === null ? ' <span style="font-weight:400;color:var(--stone)">(mixed)</span>' : '') + '</label>';
  }
  return '<div class="admin-org-ai" style="' + row + '">' + cap + sw('aiGuide', 'AI Guide') + sw('voice', 'Voice') + '</div>';
}
function adminSetAiFeature(orgPublicId, key, on) {
  if (!isAppAdmin || (key !== 'aiGuide' && key !== 'voice')) return;
  var org = adminOrgById(orgPublicId);
  if (org && org.ai) { org.ai[key] = !!on; renderAdminModal(); }
  postJSON(API_BASE + '/organizations/ai-features', { id: orgPublicId, key: key, on: !!on },   /* the app administrator's session authorises it */
    function () {
      /* The organization being viewed: read its new settings now rather than at the next poll. */
      try { if (orgServerId() === orgPublicId && Store.checkRemote) Store.checkRemote(); } catch (e) { }
    },
    function (err) { alert((err && err.message) || 'Could not change the AI features for this organization.'); fetchAdminData(); });
}

// First-run gate: force org/team setup once if it has never been completed
// and no organization has been named yet.
function finishOrgSetup() {
  saveEnterprise();
  var nm = (data.enterprise && data.enterprise.name || '').trim();
  if (!nm) { var el = $('ent_name'); if (el) el.focus(); alert('Please enter your organization name to continue.'); return; }
  data.orgSetup = true; saveData();
  orgSetupMode = false; closeModal();
  /* Wherever this wizard was opened from, the account belongs in one of its own
     programs once it closes. Stays put when it was opened from inside one. The
     save has to land before the page does — see navigateWhenSaved. */
  if (window.Router && Router.served() && Router.kind() !== 'module') {
    navigateWhenSaved(function () { Router.landAfterAuth(accountType()); });
    return;
  }
  if (window.Router && Router.landAfterAuth(accountType())) return;
  render();
}

// Team roster customizations persist on data.roster and are applied to the
// live USERS list at startup, so edits/deletes survive reloads and propagate
// to sign-in, assignments, and the nav chip.
var ORG_PALETTE = ['#B8892A', '#4866A0', '#458363', '#8158A0', '#8B5E3C', '#6B4C8A', '#9B2D3F', '#2D5A8E'];

function persistRoster() {
  // Never persist an unsaved draft, and never leak the internal _draft flag.
  data.roster = USERS.filter(function (u) { return !u._draft; }).map(function (u) {
    var c = Object.assign({}, u); delete c._draft; return c;
  });
  saveData();
}

function applyTeamRoster() {
  try {
    USERS.length = 0;
    if (Array.isArray(data.roster) && data.roster.length) {
      data.roster.forEach(function (u) { USERS.push(u); });
      // fold any legacy "additional members" into the roster once
      if (Array.isArray(data.members) && data.members.length) {
        data.members.forEach(function (m) {
          USERS.push({
            id: m.id || uid(), name: m.name || '', role: m.role || '', email: m.email || '', dept: m.dept || '',
            scope: '', initials: orgInitials(m.name) || '?', color: ORG_PALETTE[USERS.length % ORG_PALETTE.length]
          });
        });
        data.members = [];
      }
    } else {
      // No roster yet for this org → seed from the default team
      DEFAULT_ROSTER.forEach(function (u) { USERS.push(Object.assign({}, u)); });
    }
    /* No passwords here at all (Directive 2 Oct 2026, Part 5): they live only
       as Argon2id hashes in the database, and the workspace document is
       stripped of them in both directions (Core\DocPrivacy). */
    /* A roster cached or seeded before Part 5 may still carry a PIN (the generated programs' sample teams do):
       nothing in the browser keeps one (Directive 2 Oct 2026, 5.2.1). */
    USERS.forEach(function (u) { if (u) delete u.passcode; });
    data.roster = USERS.map(function (u) { return Object.assign({}, u); });
  } catch (e) { }
}

function scrollEditorIntoView(focus) {
  setTimeout(function () {
    var el = document.querySelector('.org-card.editing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (focus) { var f = el.querySelector('input'); if (f) f.focus(); }
    }
  }, 60);
}
function editProfile(id) { if (!canEditMember(id)) return; discardDraftMember(); UI.orgEdit = id; UI.orgEditErrors = {}; UI.orgEditBusy = false; renderOrgModal(); scrollEditorIntoView(false); }
function cancelEditProfile() {
  var u = USERS.find(function (x) { return x.id === UI.orgEdit; });
  if (u && u._draft) { var i = USERS.indexOf(u); if (i >= 0) USERS.splice(i, 1); } // throw away the unsaved draft
  UI.orgEdit = null; UI.orgEditErrors = {}; UI.orgEditBusy = false; render(); renderOrgModal();
}

/* ── Team-member ⇄ MySQL sync ─────────────────────────────────────────
   The current org is linked to its DB org via `serverId` (stamped at setup).
   Each roster member gets a `serverId` once persisted. Saves create-or-update
   the member row; deletes remove it. If the org has no serverId (a legacy
   local-only org), sync is skipped and edits stay local. */
function orgServerId() { var o = getOrg(currentOrgId); return (o && o.serverId) ? o.serverId : null; }

function memberPayload(u) {
  var p = {
    actor_id: actorId(),
    name: u.name || '', username: (u.username || '').trim(), role: u.role || '',
    scope: u.scope || '', email: u.email || '', department: u.dept || ''
  };
  /* No password travels with a profile. A temporary one goes separately, to
     POST /admin/temporary-password (sendTemporaryPassword), and only from an
     administrator (Directive 2 Oct 2026, Part 5.7). */
  /* Which programs this member may open. Sent only when the roster actually
     states it: the server leaves a grant untouched when `modules` is absent, so
     omitting it is how a member editing their own profile — or any older call
     site — saves a changed phone number without silently rewriting their own
     access to whatever the form happened to render. An explicit empty array is
     a real instruction and IS sent. */
  if (u.modules && u.modules.length !== undefined) p.modules = u.modules;
  if ((u.id in _pendingAdmin) && canManageOrg()) p.is_admin = _pendingAdmin[u.id];   /* Sweep 4R item 2: only a change an administrator asked for */
  return p;
}

function memberSyncError(err, action) {
  if (err && err.reason === 'network') return 'Saved on this device, but the server was unreachable — this team member is not in the database yet.';
  return (err && err.message) || ('Could not ' + action + ' this team member on the server.');
}

/* Map the server's { field: [msg] } errors onto the editor's field ids. */
function mapServerFieldErrors(errors) {
  var out = {}, map = { department: 'dept' };
  if (!errors) return out;
  for (var k in errors) { if (errors.hasOwnProperty(k) && errors[k] && errors[k].length) out[map[k] || k] = errors[k][0]; }
  return out;
}

/* Create or update the member in MySQL. Callback-shaped so the editor can show
   inline results: cb({ok:true}) | cb({ok:false, fieldErrors, message}). If the
   org isn't linked to a DB record, the change stays local and reports ok. */
function syncMemberToServer(u, cb, temporary) {
  var orgSid = orgServerId();
  if (!orgSid || !u) { if (u && (u.id in _pendingAdmin)) { u.admin = _pendingAdmin[u.id]; delete _pendingAdmin[u.id]; } if (cb) cb({ ok: true, localOnly: true }); return; }
  var p = memberPayload(u);
  /* A NEW member's temporary password travels with the add (7 Oct 2026) and lands in their access email;
     it is read once from the editor, never kept on the member or in the roster. */
  if (!u.serverId && temporary) p.temporary = temporary;
  function onErr(err) { if (cb) cb({ ok: false, fieldErrors: mapServerFieldErrors(err && err.errors), message: memberSyncError(err, u.serverId ? 'update' : 'add') }); }
  if (u.serverId) {
    p.id = u.serverId;
    postJSON(API_BASE + '/users/update', p, function (res) {
      var d = (res && res.data) || {};
      if (d.modules) { u.modules = d.modules; persistRoster(); }
      if (u.id in _pendingAdmin) { u.admin = (d.is_admin !== undefined) ? !!d.is_admin : _pendingAdmin[u.id]; delete _pendingAdmin[u.id]; persistRoster(); }   /* Sweep 4R item 2 */
      if (cb) cb({ ok: true });
    }, onErr);
  } else {
    p.organization_id = orgSid;
    postJSON(API_BASE + '/users', p, function (res) {
      var d = (res && res.data) || {};
      if (d.id) { u.serverId = d.id; }
      if (u.id in _pendingAdmin) { u.admin = _pendingAdmin[u.id]; delete _pendingAdmin[u.id]; }   /* Sweep 4R item 2: created as asked */
      /* The server clamps the requested grant to what the organization holds,
         so adopt what it stored rather than what was asked for — otherwise the
         editor would keep showing a program that was not actually given. */
      if (d.modules) u.modules = d.modules;
      if (d.id || d.modules) persistRoster();
      /* The invite is the whole point of adding someone, and it is the one step
         that can quietly not happen (no SMTP, a refused relay). Pass its
         outcome back so the editor can say so instead of implying success. */
      if (cb) cb({ ok: true, invite: d.invite || null });
    }, onErr);
  }
}

/* Pull the org's members from the DB (source of truth) and reconcile the local
   roster so the app reflects what's actually stored — fixes local/DB drift such
   as a stale username. Re-renders if anything changed. */
function pullOrgMembers(cb) {
  var sid = orgServerId();
  if (!sid) { if (cb) cb(false); return; }
  try {
    fetch(API_BASE + '/organizations/members?org=' + encodeURIComponent(sid))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var changed = false;
        if (res && res.success && res.data && Array.isArray(res.data.members)) {
          /* The organization's own entitlement comes back with the roster. It
             lives on the registry record, not the workspace, because it is
             org-level truth that every program's document would otherwise keep
             its own drifting copy of. */
          if (res.data.modules) adoptOrgModules(res.data.modules);
          changed = reconcileRosterFromServer(res.data.members);
          if (changed) { try { render(); } catch (e) { } if (currentModal === 'org') renderOrgModal(); }
        }
        if (cb) cb(changed);
      })
      .catch(function () { if (cb) cb(false); });
  } catch (e) { if (cb) cb(false); }
}

/* Record what the current organization is entitled to, on the registry record
   the whole app reads it from (orgModules → grantedModules in app.js). Also
   patches the cached DB org so the admin console and the member editor agree
   without waiting for a reload. */
function adoptOrgModules(modules) {
  if (!modules || modules.length === undefined) return;
  var list = getOrgs(), hit = false;
  list.forEach(function (o) {
    if (o.id !== currentOrgId) return;
    o.modules = modules; hit = true;
  });
  if (hit) saveOrgs(list);
  try { Store.patchDbOrg(orgServerId(), { modules: modules }); } catch (e) { }
}

/* Update the local roster to match the DB member list (DB wins). Matches by
   serverId; adds DB members missing locally; drops locally-linked members the
   server no longer has. Keeps unsynced drafts and the signed-in user. */
function reconcileRosterFromServer(dbMembers) {
  var changed = false, byServer = {}, seen = {};
  function isAdmin(m) { return m.is_admin === true || m.is_admin === 1 || m.is_admin === '1'; }
  USERS.forEach(function (u) { if (u.serverId) byServer[u.serverId] = u; });

  dbMembers.forEach(function (m) {
    seen[m.public_id] = true;
    var local = byServer[m.public_id];
    if (!local) {
      // No serverId match — adopt an existing unlinked local member (by username
      // or name) so we fix its data instead of creating a duplicate.
      var uname = (m.username || '').trim().toLowerCase(), nm = (m.name || '').trim().toLowerCase();
      local = USERS.filter(function (x) {
        return !x.serverId && ((uname && (x.username || '').trim().toLowerCase() === uname) || (nm && (x.name || '').trim().toLowerCase() === nm));
      })[0];
      if (local) { local.serverId = m.public_id; byServer[m.public_id] = local; changed = true; }
    }
    if (local) {
      [['name', 'name'], ['username', 'username'], ['role', 'role'], ['scope', 'scope'], ['email', 'email'], ['dept', 'department']].forEach(function (p) {
        var val = m[p[1]] || '';
        if ((local[p[0]] || '') !== val) { local[p[0]] = val; changed = true; }
      });
      if (!!local.admin !== isAdmin(m)) { local.admin = isAdmin(m); changed = true; }
      /* Program access is part of what a member IS, and the database is the
         source of truth for it like every other field here. Compared as a
         joined string so a re-ordered but identical list is not reported as a
         change — this runs on every sign-in and every org-modal open, and each
         false positive is a re-render. */
      var grants = m.modules || null;
      if ((grants || []).join(',') !== (local.modules || []).join(',')) { local.modules = grants; changed = true; }
      if (m.name) local.initials = orgInitials(m.name);
    } else {
      USERS.push({
        /* The database's id, not a fresh one. A person belongs to the
           ORGANIZATION, and every program's workspace keeps its own roster
           copy — so minting a local id here gave the same colleague a
           different key in each program. The session stores that key, which
           meant signing in under one program and switching to another looked
           like a stale session and dropped the reader on sign-in. Same rule
           finishSetup and rosterFromDbOrg already follow: where the database
           has an id, it IS the id. uid() is only for someone it has never
           heard of. */
        id: m.public_id || uid(), serverId: m.public_id, name: m.name || '', username: m.username || '',
        role: m.role || '', scope: m.scope || '', email: m.email || '', dept: m.department || '',
        // No password, for the reason in rosterFromDbOrg: this row mirrors a
        // database account and the credential stays there.
        admin: isAdmin(m), modules: m.modules || null,
        initials: orgInitials(m.name || '') || '?', color: ORG_PALETTE[USERS.length % ORG_PALETTE.length]
      });
      changed = true;
    }
  });

  // Drop members that were linked to the server but no longer exist there.
  for (var i = USERS.length - 1; i >= 0; i--) {
    var u = USERS[i];
    if (u.serverId && !seen[u.serverId] && u.id !== currentUserId) { USERS.splice(i, 1); changed = true; }
  }
  if (changed) persistRoster();
  return changed;
}

/* Client-side validation for a team-member profile. Returns { field: message }.

   `isNew` decides what the Temporary password field means: required for a
   new member, and for one who already exists, empty means "leave their
   password as it is" (Directive 2 Oct 2026, Part 5.7). The admin console's
   sibling editor works the same way (validateAdminUserFields). */
function validateMemberFields(v, id, isNew) {
  var e = {};
  if (!v.name) e.name = 'Name is required.';
  else if (v.name.length < 2) e.name = 'Name must be at least 2 characters.';
  else if (v.name.length > 120) e.name = 'Name must be 120 characters or fewer.';

  if (!v.username) e.username = 'Username is required.';
  else if (!/^[a-zA-Z0-9_.-]+$/.test(v.username)) e.username = 'Use only letters, numbers, and . _ -';
  else if (v.username.length < 3) e.username = 'Username must be at least 3 characters.';
  else if (v.username.length > 60) e.username = 'Username must be 60 characters or fewer.';
  /* Only this team's roster is in reach here, so this catches the common
     collision immediately and without a round trip. It is NOT the rule: a
     username has to be unique across the whole installation now, because
     sign-in is by username alone (AuthController), and only the server can see
     that far. It answers 422 against this same field, which the save path
     paints exactly as it paints this. */
  else if (USERS.some(function (x) { return x.id !== id && (x.username || '').trim().toLowerCase() === v.username.toLowerCase(); }))
    e.username = 'That username is already taken. Choose another.';   /* A.5.22 */

  if (!v.role) e.role = 'Role / title is required.';
  else if (v.role.length > 60) e.role = 'Role must be 60 characters or fewer.';

  if (!v.scope) e.scope = 'Scope / focus is required.';
  else if (v.scope.length > 60) e.scope = 'Scope must be 60 characters or fewer.';

  if (!v.email) e.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.';
  else if (v.email.length > 150) e.email = 'Email must be 150 characters or fewer.';
  // Same shape as the username check above, and the same caveat: one address
  // per account is an installation-wide rule the server owns (it is where the
  // invitation and every notification go), and this only sees this team.
  else if (USERS.some(function (x) { return x.id !== id && (x.email || '').trim().toLowerCase() === v.email.trim().toLowerCase(); }))
    e.email = 'That email address already belongs to an account. Use another.';

  if (!v.dept) e.dept = 'Department is required.';
  else if (v.dept.length > 80) e.dept = 'Department must be 80 characters or fewer.';

  var tp = temporaryProblem(v.temporary || '', isNew); if (tp) e.temporary = tp;
  return e;
}

/* ── Per-member application access ────────────────────────────────────────
   The Org Admin decides which of the organization's programs each team member
   may open. The pool is the organization's entitlement (org_modules); the
   selection is that member's grant (user_modules); the server clamps the second
   to the first, so nothing here can hand out a program the organization does
   not hold — see Models\Access.

   No new CSS. The picker reuses the sign-up screen's role tiles verbatim
   (.entry-roles / .entry-role / .entry-role-name / .entry-role-sub), which
   already style a checked tile through `.entry-role:has(input:checked)`. That
   is also why toggling one does NOT re-render: the browser paints the checked
   state itself, and a re-render would throw away everything typed into the
   fields above. The count line is the one thing that has to be told, and it is
   told directly. The DOM is read back at save time, so a missed onchange
   cannot desynchronise the saved grant from what is on screen. */

/** The programs the current organization holds, as catalogue entries. */
function orgModuleEntries() {
  var pool = (typeof orgModules === 'function') ? orgModules(currentOrgId) : [];
  return (window.Modules ? Modules.list(accountType()) : []).filter(function (m) {
    return pool.indexOf(m.id) >= 0;
  });
}

/** A member's grant, defaulting an unstated one to everything the org has. */
function memberModules(u) {
  if (u && u.modules && u.modules.length !== undefined) return u.modules;
  /* A DRAFT has never had a grant, so it starts empty and the admin chooses.
     A SAVED member with no stated grant predates this feature (or came from an
     older API); they had everything, and reading silence as "nothing" would
     revoke access from the whole team the first time anyone opened an editor. */
  return (u && u._draft) ? [] : orgModuleEntries().map(function (m) { return m.id; });
}

function memberAccessSummary(u) {
  var granted = memberModules(u), entries = orgModuleEntries();
  if (!entries.length) return '<span class="org-unnamed">No programs on this plan</span>';
  var names = entries.filter(function (m) { return granted.indexOf(m.id) >= 0; })
    .map(function (m) { return esc(m.name); });
  if (!names.length) return '<span class="org-unnamed">No program access</span>';
  if (names.length === entries.length) return 'All ' + names.length + ' programs';
  return names.join(' \xb7 ');
}

function memberAccessHtml(u, canEdit) {
  var entries = orgModuleEntries(), granted = memberModules(u);
  var h = '<div class="mb-6" style="margin-top:16px">';
  h += '<label class="org-flabel">Application access</label>';

  if (!entries.length) {
    return h + '<p class="t-stone-md" style="font-size:13px;margin:4px 0 0">'
      + 'This organization has no programs on its plan yet. An administrator can add them from the admin console.'
      + '</p></div>';
  }

  h += '<p class="t-stone-md" style="font-size:13px;margin:4px 0 10px">'
    + (canEdit
      ? 'Choose which programs this person can open. They will only see these — every other program, and its data, stays out of reach.'
      : 'The programs you can open. Only your organization administrator can change this.')
    + ' <span id="rmcount_' + esc(u.id) + '">' + granted.length + ' of ' + entries.length + ' selected</span></p>';

  h += '<fieldset class="entry-roles entry-roles-row">';
  entries.forEach(function (m) {
    var on = granted.indexOf(m.id) >= 0;
    /* A program still in development cannot be handed to anyone: there is
       nothing behind it but the placeholder screen, so ticking it would grant
       access to a program that does not exist yet. It stays on the list —
       the plan is worth seeing — but inert, and it says why. Whatever is
       already stored against it is left alone: the box keeps its state and
       readMemberModules still reads it, so opening this editor cannot quietly
       rewrite a grant made before the rule existed. */
    var soon = m.status !== 'live';
    var off = soon || !canEdit;
    h += '<label class="entry-role' + (soon ? ' entry-role-soon' : '') + '"'
      + (soon ? ' title="Not available yet — this program is still in development"' : '') + '>'
      + '<input type="checkbox" id="rm_' + esc(u.id) + '_' + esc(m.id) + '" value="' + esc(m.id) + '"'
      + (on ? ' checked' : '') + (off ? ' disabled' : '')
      + ' onchange="memberAccessChanged(\'' + esc(u.id) + '\')"/>'
      + '<span class="entry-role-body">'
      + '<span class="entry-role-name">' + esc(m.name) + '</span>'
      + '<span class="entry-role-sub">' + esc(m.tag || m.sub || '')
      + (soon ? ' · in development' : '') + '</span>'
      + '</span></label>';
  });
  h += '</fieldset></div>';
  return h;
}

/** Read the picker back out of the DOM — the source of truth while editing. */
function readMemberModules(id) {
  var out = [];
  orgModuleEntries().forEach(function (m) {
    var el = $('rm_' + id + '_' + m.id);
    if (el && el.checked) out.push(m.id);
  });
  return out;
}

/** Keep the "n of m selected" line honest without re-rendering the editor. */
function memberAccessChanged(id) {
  var el = $('rmcount_' + id); if (!el) return;
  el.textContent = readMemberModules(id).length + ' of ' + orgModuleEntries().length + ' selected';
}

/* Focus the first errored field in the editor. */
function focusFirstMemberErr(id, errs) {
  var order = ['name', 'username', 'role', 'scope', 'email', 'dept', 'temporary'];
  for (var i = 0; i < order.length; i++) {
    if (errs[order[i]]) { var el = $('ru_' + id + '_' + order[i]); if (el) { el.focus(); if (el.select) el.select(); } return; }
  }
}

/* Clear one field's error as the user types, without a full re-render (keeps caret). */
function clearMemberFieldErr(field) {
  if (UI.orgEditErrors) delete UI.orgEditErrors[field];
  var id = UI.orgEdit; if (!id) return;
  var el = $('ru_' + id + '_' + field);
  if (el) { el.style.borderColor = ''; var err = el.parentNode && el.parentNode.querySelector('.org-field-err'); if (err) err.parentNode.removeChild(err); }
}

function deleteMemberOnServer(serverId) {
  if (!serverId) return;
  postJSON(API_BASE + '/users/delete', { id: serverId, actor_id: actorId() }, null, null);
}

/* Small POST-JSON helper that unwraps the API's { success, data } envelope. */
function postJSON(url, body, onOk, onErr) {
  try {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: (j || {}) }; }, function () { return { status: r.status, body: {} }; }); })
      .then(function (res) {
        if (res.status >= 200 && res.status < 300 && res.body.success) { if (onOk) onOk(res.body); }
        else if (onErr) onErr(res.body);
      })
      .catch(function () { if (onErr) onErr({ reason: 'network' }); });
  } catch (e) { if (onErr) onErr({ reason: 'network' }); }
}

function saveProfile(id) {
  if (!canEditMember(id)) return;
  var u = USERS.find(function (x) { return x.id === id }); if (!u) return;
  if (UI.orgEditBusy) return; // guard against double-submit
  /* Sweep 4R item 2: the Administrator box, from an administrator's editor only; the last one is never unticked (A.5.30) */
  var aEl = $('ru_' + id + '_admin'), wantAdmin = (aEl && canManageOrg()) ? aEl.checked === true : null;
  if (wantAdmin === false && u.admin === true && adminCountIn(USERS) <= 1) { alert(LAST_ADMIN_MSG); aEl.checked = true; return; }
  if (wantAdmin !== null && wantAdmin !== (u.admin === true)) _pendingAdmin[u.id] = wantAdmin; else delete _pendingAdmin[u.id];

  // Read the typed values and reflect them in memory immediately, so any
  // re-render (including a validation error) keeps exactly what was typed.
  var isNew = !u.serverId;
  var vals = {};
  ['name', 'username', 'role', 'scope', 'email', 'dept'].forEach(function (f) {
    var el = $('ru_' + id + '_' + f); vals[f] = el ? el.value.trim() : '';
    /* Everything typed goes straight back onto the member so a re-render keeps it. */
    u[f] = vals[f];
  });
  /* The temporary password: only in an administrator's editor for someone else
     (5.10 — your own password is Change password), read once, never stored. */
  var tEl = $('ru_' + id + '_temporary'); vals.temporary = tEl ? tEl.value : '';
  if (tEl) tEl.value = '';
  if (u.name) u.initials = orgInitials(u.name);

  /* The access picker, read off the DOM for the same reason as the fields
     above: whatever is on screen is what gets saved, and a re-render caused by
     a validation error redraws it from here. Only an admin's editor renders the
     picker at all, so a member saving their own profile leaves `modules`
     untouched and memberPayload() then omits it — which is what tells the
     server to leave the grant alone. */
  if (canManageOrg()) u.modules = readMemberModules(id);

  // Client-side validation → inline errors, editor stays open (values preserved).
  var errs = validateMemberFields(vals, id, isNew && !!tEl);
  if (Object.keys(errs).length) { UI.orgEditErrors = errs; UI.orgEditBusy = false; renderOrgModal(); focusFirstMemberErr(id, errs); return; }

  // Valid → it's a real member now; save locally.
  delete u._draft;
  persistRoster();

  // Persist to MySQL; show server validation errors inline (no alert).
  UI.orgEditErrors = {}; UI.orgEditBusy = true; renderOrgModal();
  syncMemberToServer(u, function (result) {
    if (result && result.ok) {
      /* Then an edited member's new temporary password, if one was typed (5.7). A new member's went with the add. */
      sendTemporaryPassword(orgServerId(), u.serverId, (result.localOnly || isNew) ? '' : vals.temporary, function (problem) {
        UI.orgEditBusy = false;
        UI.orgEdit = null; UI.orgEditErrors = {}; render(); renderOrgModal();
        if (problem) { alert(problem); return; }
        if (result.invite) showToast(inviteMessage(result.invite, u, !!vals.temporary));
      });
      return;
    }
    UI.orgEditBusy = false;
    delete _pendingAdmin[u.id];   /* refused: the flag stays what the server holds */
    if (result && result.fieldErrors && Object.keys(result.fieldErrors).length) {
      UI.orgEditErrors = result.fieldErrors; renderOrgModal(); focusFirstMemberErr(id, result.fieldErrors); return;
    }
    UI.orgEditErrors = { _general: (result && result.message) || 'Could not save this team member.' }; renderOrgModal();
  }, isNew ? vals.temporary : '');   /* a new member's temporary password goes with the add, and into their access email */
}

/* What actually happened to the invitation, in the admin's words.

   Adding a member succeeds whether or not the mail went — the account exists
   either way — so this never says "failed". It says what is true, because an
   admin who believes an email was sent will not think to pass the credentials
   on by hand, and the new member simply never arrives. */
function inviteMessage(invite, u, withPassword) {
  var who = (u && u.name) ? u.name : 'the new member';
  switch (invite && invite.status) {
    case 'sent':
      return 'Access email sent to ' + (u.email || who) + (withPassword ? ', with their temporary password.' : '.');
    case 'no-transport':
      return 'Member added. The access email is queued — no mail server is configured yet, so send their sign-in details' + (withPassword ? ', including the temporary password you chose,' : '') + ' on for now.';
    case 'send-failed':
      return 'Member added, but the access email could not be sent (' + ((invite.error || '').slice(0, 80) || 'unknown error') + ').' + (withPassword ? ' Give them the temporary password you chose yourself: a retry will not carry it.' : ' It stays queued for a retry.');
    case 'no-address':
      return 'Member added. No email address on file, so no access email was sent.';
    default:
      return 'Member added.';
  }
}

function addProfile() {
  if (!canManageOrg()) return;
  discardDraftMember();       // never keep more than one unsaved draft
  var id = uid();
  // A DRAFT: held in memory only (not persisted) until it's saved with a name,
  // so clicking "Add team member" no longer leaves empty "Unnamed" rows behind.
  USERS.push({ id: id, name: '', username: '', role: '', scope: '', email: '', dept: '', initials: '?', color: ORG_PALETTE[USERS.length % ORG_PALETTE.length], _draft: true });
  UI.orgEdit = id;            // open the new profile straight into the editor
  UI.orgEditErrors = {}; UI.orgEditBusy = false;
  render(); renderOrgModal();  // no persistRoster() — a draft isn't a saved member yet
  scrollEditorIntoView(true); // bring the new editor up into view and focus it
}

/* Drop any unsaved draft member from the in-memory roster. */
function discardDraftMember() {
  for (var i = USERS.length - 1; i >= 0; i--) { if (USERS[i]._draft) USERS.splice(i, 1); }
  if (UI.orgEdit && !USERS.some(function (x) { return x.id === UI.orgEdit; })) UI.orgEdit = null;
}

/* Remove already-saved members that are completely empty (orphans left by the
   old add-then-persist behaviour). Never touches the signed-in user or a draft. */
function pruneEmptyMembers() {
  var before = USERS.length;
  for (var i = USERS.length - 1; i >= 0; i--) {
    var u = USERS[i];
    if (u._draft || u.id === currentUserId || u.id === UI.orgEdit) continue; // keep drafts, self, and the open editor
    var empty = !(u.name || '').trim() && !(u.username || '').trim() && !(u.email || '').trim()
      && !(u.role || '').trim() && !(u.scope || '').trim() && !(u.dept || '').trim();
    if (empty) USERS.splice(i, 1);
  }
  if (USERS.length !== before) persistRoster();
}

function removeProfile(id) {
  if (!canManageOrg()) return;
  var _ru = USERS.find(function (x) { return x.id === id }); if (_ru && _ru.admin === true && adminCountIn(USERS) <= 1) { alert(LAST_ADMIN_MSG); return; }   /* Sweep 4R item 2 (A.5.30) */
  if (id === currentUserId) { alert("You're signed in as this profile, so it can't be deleted here. Switch to another user first, then delete it."); return; }
  var u = USERS.find(function (x) { return x.id === id });
  var label = (u && u.name) ? (' \u2014 ' + u.name) : '';
  if (!confirm('Delete this team member' + label + '? They will also be removed from sign-in and task assignments.')) return;
  var serverId = u && u.serverId;
  var i = USERS.findIndex(function (x) { return x.id === id });
  if (i >= 0) USERS.splice(i, 1);
  if (UI.orgEdit === id) UI.orgEdit = null;
  persistRoster(); render(); renderOrgModal();
  deleteMemberOnServer(serverId); // remove from MySQL too
}

/* The per-field draft save behind each input's onchange. DONE (doneOrgDetails)
   is what validates and sends to the server; this only keeps what has been
   typed so far from being lost to a re-render.

   It writes the draft to the cached organization record as well as the
   workspace copy, because orgDetails() reads the record first — without this a
   typed value would vanish from the field the moment anything re-rendered. */
function saveEnterprise() {
  if (!canManageOrg()) return;
  if (!data.enterprise) data.enterprise = {};
  ORG_DET_FIELDS.forEach(function (f) {
    var el = $('ent_' + f); if (el) data.enterprise[f] = el.value;
  });
  cacheOrgDetails(data.enterprise);
  saveData();
}

/* Mirror organization details into the cached database record, so every
   surface reading orgDetails() sees them at once. */
function cacheOrgDetails(v) {
  try {
    if (typeof Store === 'undefined' || !Store.patchDbOrg) return;
    Store.patchDbOrg(currentOrgId, {
      name: v.name, industry: v.industry, company_size: v.size, region: v.region,
      website: v.website, ai_maturity: v.maturity, executive_sponsor: v.sponsor, objective: v.objective
    });
  } catch (e) { }
}

/* ── Organization Details ⇄ MySQL (organizations table) ───────────────
   All fields required, inline validation matching the team-member editor. */
var ORG_DET_FIELDS = ['name', 'industry', 'size', 'region', 'website', 'maturity', 'sponsor', 'objective'];

function readOrgDetailFields() {
  var v = {};
  // Read every field, so a value already stored for a hidden one is preserved
  // on save rather than being blanked by an input that was never rendered.
  // The stored value comes from orgDetails(), not the workspace copy: a field
  // this account never sees (a Leader's industry, say) must round-trip the
  // ORGANIZATION's value, or saving from one program would blank what another
  // one put there.
  var stored = orgDetails();
  ORG_DET_FIELDS.forEach(function (f) {
    var el = $('ent_' + f);
    v[f] = el ? ('' + el.value).trim() : (stored[f] || '');
  });
  return v;
}

/* ONLY the name is required (10 Sep 2026). Everything else about an
   organization is optional, for every account type.

   Seven required fields stood between a new account and the rest of the app,
   and several of them — "AI maturity", "Executive sponsor" — ask for a decision
   somebody signing up has no reason to have made yet. The answer to that is not
   a smaller form; it is letting them get on and come back.

   Optional is NOT unchecked: every length and shape rule below still applies to
   whatever is actually filled in. `api/controllers/OrganizationController.php`
   carries the same rules and is the half that has to be true, since this file
   runs in a browser and can be edited. Change one and change the other. */
function validateOrgDetails(v) {
  var e = {};
  if (!v.name) e.name = 'Organization name is required.';
  else if (v.name.length < 2) e.name = 'Organization name must be at least 2 characters.';
  else if (v.name.length > 150) e.name = 'Organization name must be 150 characters or fewer.';

  if (v.industry && v.industry.length > 120) e.industry = 'Industry must be 120 characters or fewer.';
  if (v.region && v.region.length > 120) e.region = 'Region must be 120 characters or fewer.';
  if (v.sponsor && v.sponsor.length > 120) e.sponsor = 'Executive sponsor must be 120 characters or fewer.';
  if (v.objective && v.objective.length > 1000) e.objective = 'Primary objective must be 1000 characters or fewer.';

  /* The shape check runs only when there IS a website: "" must not fail a
     pattern it was never given. */
  if (v.website) {
    if (!/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v.website)) e.website = 'Enter a valid website (e.g. acme.com).';
    else if (v.website.length > 150) e.website = 'Website must be 150 characters or fewer.';
  }
  return e;
}

function focusFirstOrgDetErr(errs) {
  for (var i = 0; i < ORG_DET_FIELDS.length; i++) {
    if (errs[ORG_DET_FIELDS[i]]) { var el = $('ent_' + ORG_DET_FIELDS[i]); if (el) { el.focus(); if (el.select) el.select(); } return; }
  }
}

function clearOrgDetErr(field) {
  if (UI.orgDetErrors) delete UI.orgDetErrors[field];
  var el = $('ent_' + field);
  if (el) { el.style.borderColor = ''; var err = el.parentNode && el.parentNode.querySelector('.org-field-err'); if (err) err.parentNode.removeChild(err); }
}

/* Keep the org registry name in step with the edited name. */
function updateLocalOrgName(name) {
  var list = getOrgs(), changed = false;
  for (var i = 0; i < list.length; i++) { if (list[i].id === currentOrgId && list[i].name !== name) { list[i].name = name; changed = true; } }
  if (changed) saveOrgs(list);
}

/* Map the server's { field: [msg] } errors back onto the editor's field ids. */
function mapOrgServerErrors(errors) {
  var out = {}, map = { company_size: 'size', ai_maturity: 'maturity', executive_sponsor: 'sponsor' };
  if (!errors) return out;
  for (var k in errors) { if (errors.hasOwnProperty(k) && errors[k] && errors[k].length) out[map[k] || k] = errors[k][0]; }
  return out;
}

function syncOrgDetailsToServer(v, cb) {
  var orgSid = orgServerId();
  if (!orgSid) { if (cb) cb({ ok: true, localOnly: true }); return; } // org not linked → local-only
  var payload = {
    id: orgSid, actor_id: actorId(), name: v.name, industry: v.industry, company_size: v.size, region: v.region,
    website: v.website, ai_maturity: v.maturity, executive_sponsor: v.sponsor, objective: v.objective
  };
  postJSON(API_BASE + '/organizations/update', payload,
    function () { if (cb) cb({ ok: true }); },
    function (err) {
      if (cb) cb({
        ok: false, fieldErrors: mapOrgServerErrors(err && err.errors),
        message: (err && err.reason === 'network')
          ? 'Saved on this device, but the server was unreachable — organization details are not in the database yet.'
          : ((err && err.message) || 'Could not save organization details.')
      });
    });
}

/* Lightweight floating toast (lives on <body>, so it survives modal close). */
function showToast(msg, kind) {
  try {
    var t = document.getElementById('appToast');
    if (!t) { t = document.createElement('div'); t.id = 'appToast'; document.body.appendChild(t); }
    var bg = kind === 'error' ? '#c0392b' : '#1f9d55';
    t.textContent = msg;
    t.setAttribute('style', 'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:100000;'
      + 'background:' + bg + ';color:#fff;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;'
      + 'box-shadow:0 10px 30px rgba(0,0,0,.28);opacity:0;transition:opacity .25s ease, top .25s ease;pointer-events:none');
    void t.offsetWidth;                 // force reflow so the transition runs
    t.style.opacity = '1'; t.style.top = '32px';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.style.opacity = '0'; t.style.top = '24px'; }, 2400);
  } catch (e) { }
}

function doneOrgDetails(isSetup) {
  if (!canManageOrg()) { closeModal(); return; }
  if (UI.orgDetBusy) return;
  var vals = readOrgDetailFields();
  var errs = validateOrgDetails(vals);
  if (Object.keys(errs).length) { UI.orgDetErrors = errs; renderOrgModal(); focusFirstOrgDetErr(errs); return; }

  // Commit locally: the cached organization record (what every surface reads)
  // and the workspace copy (the fallback when there is no database).
  if (!data.enterprise) data.enterprise = {};
  ORG_DET_FIELDS.forEach(function (f) { data.enterprise[f] = vals[f]; });
  cacheOrgDetails(vals);
  updateLocalOrgName(vals.name);
  saveData();

  // Persist to MySQL; inline server errors (no alert).
  UI.orgDetErrors = {}; UI.orgDetBusy = true; renderOrgModal();
  syncOrgDetailsToServer(vals, function (result) {
    UI.orgDetBusy = false;
    if (result && result.ok) {
      UI.orgDetErrors = {};
      showToast('✓ Organization details saved');
      // Let the success message register, then close the modal.
      setTimeout(function () { if (isSetup) { finishOrgSetup(); } else { closeModal(); } }, 800);
      return;
    }
    if (result && result.fieldErrors && Object.keys(result.fieldErrors).length) { UI.orgDetErrors = result.fieldErrors; renderOrgModal(); focusFirstOrgDetErr(result.fieldErrors); return; }
    UI.orgDetErrors = { _general: (result && result.message) || 'Could not save organization details.' }; renderOrgModal();
  });
}

function renderOrgModal() {
  var mr = $('modalRoot'); if (!mr) return;
  if (currentModal !== 'org') { mr.innerHTML = ''; return; }
  pruneEmptyMembers(); // clean up any empty "Unnamed" rows from earlier
  var e = orgDetails(), members = data.members || [];
  var sizeOpts = [['', 'Select size\u2026'], ['1\u201350', '1\u201350'], ['51\u2013200', '51\u2013200'], ['201\u20131,000', '201\u20131,000'], ['1,001\u20135,000', '1,001\u20135,000'], ['5,000+', '5,000+']];
  var matOpts = [['', 'Select stage\u2026'], ['Exploring', 'Exploring'], ['Piloting', 'Piloting'], ['Scaling', 'Scaling'], ['Operating', 'Operating']];
  function einp(id, v, ph, type) { return '<input id="' + id + '" class="field-input" type="' + (type || 'text') + '" value="' + esc(v || '') + '" placeholder="' + esc(ph) + '" onchange="saveEnterprise()"/>'; }
  function esel(id, v, opts) { var s = '<select id="' + id + '" class="field-sel" onchange="saveEnterprise()">'; opts.forEach(function (o) { s += '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }); return s + '</select>'; }
  function fl(label, ctrl) { return '<div><label class="form-label">' + esc(label) + '</label>' + ctrl + '</div>'; }

  var solo = isSoloAccount();   // Leader account \u2014 an organization of one

  var h = '<div class="modal-bg"' + (orgSetupMode ? '' : ' onclick="if(event.target===this)closeModal()"') + '>';
  h += '<div class="modal">';
  if (orgSetupMode) {
    h += '<div class="org-setup-eyebrow">Welcome \u2014 let\u2019s get set up</div>';
    h += '<h3>Set Up Your Organization &amp; Team</h3>';
    h += '<div class="u-e6b5a04">Before you start, tell us about your organization and confirm who\u2019s on the team. You can change any of this later from the <strong class="t-paper">Profile</strong> button. An organization name is required to continue.</div>';
  } else if (solo) {
    h += '<h3>Your Profile</h3>';
    h += '<div class="u-e6b5a04">Your details and what you\u2019re here to work on over the 90 days.</div>';
  } else {
    h += '<h3>Organization &amp; Team</h3>';
    h += '<div class="u-e6b5a04">' + (aiSwitchesApply() ? '' : 'Capture the enterprise context and the people driving the 90-day pipeline.') + '</div>';
  }
  if (canSetAiFeatures()) h += aiFeaturesFold();   /* Part 2: at the top of the page, administrators only */

  // Role-based access: admins manage everything; members may edit only themselves.
  var canEdit = canManageOrg();
  if (!canEdit) h += '<div class="entry-err" style="margin:0 0 16px;color:#4a5568;background:#eef1f5;border:1px solid #d6dbe3;border-radius:8px;padding:10px 14px;font-size:13px">You can edit your own profile. Only the organization administrator can add or change other team members and organization details.</div>';

  // Team members — compact roster; edit expands one profile at a time
  /* For a solo account this is a roster of one. It stays — the member record is
     where the name and email live, and those must stay editable — but it is
     titled as a profile and nobody is offered a team to add to. */
  h += '<div class="mb-6"><div class="section-label mb-3">'
    + (solo ? 'You' : 'Team Members <span class="org-count">\xb7 ' + USERS.length + '</span>') + '</div>';
  h += '<p class="t-stone-md" style="margin-bottom:14px;font-size:13px">'
    + (solo ? 'Your name and email, used for sign-in and notifications.'
      : 'These people appear in sign-in, task assignments, and team chat.') + '</p>';
  if (!solo && canEdit && USERS.length > 7) h += '<div style="text-align:center;margin:0 0 12px">' + btn('+ Add team member', 'addProfile()', 'bs') + '</div>';
  h += '<div class="org-list">';
  USERS.forEach(function (u) {
    var isMe = (u.id === currentUserId);
    if (canEditMember(u.id) && UI.orgEdit === u.id) {
      // Inline editor for the active profile
      var fe = UI.orgEditErrors || {};
      var busy = !!UI.orgEditBusy;
      // One field cell: label + input (red border if errored) + inline error text.
      function ofield(field, label, opts) {
        opts = opts || {};
        var err = fe[field];
        var attrs = ' id="ru_' + u.id + '_' + field + '" class="field-input"';
        if (opts.type) attrs += ' type="' + opts.type + '"';
        if (opts.autocomplete === false) attrs += ' autocomplete="off"';
        if (err) attrs += ' style="border-color:#c0392b"';
        // opts.val overrides what the field shows.
        attrs += ' value="' + esc(opts.val !== undefined ? opts.val : (u[field] || '')) + '" placeholder="' + esc(opts.ph || '') + '"';
        attrs += ' oninput="clearMemberFieldErr(\'' + field + '\')"';
        return '<div><label class="org-flabel">' + esc(label) + (opts.req ? ' <span style="color:#c0392b">*</span>' : '') + '</label>'
          + '<input' + attrs + '/>'
          + (err ? '<div class="org-field-err" style="color:#c0392b;font-size:12px;margin-top:4px">' + esc(err) + '</div>' : '')
          + '</div>';
      }
      h += '<div class="org-card editing">';
      h += '<div class="org-card-head">' + userAv(u, 40) + '<div class="org-card-headtxt">Editing profile</div></div>';
      if (fe._general) h += '<div class="entry-err" style="margin:0 0 12px;color:#c0392b;font-size:13px">' + esc(fe._general) + '</div>';
      h += '<div class="org-edit-grid">';
      h += ofield('name', 'Name', { ph: 'Full name', req: true });
      h += ofield('username', 'Username', { ph: 'e.g. maria', autocomplete: false, req: true });
      h += ofield('role', 'Role / title', { ph: 'e.g. Pipeline Owner', req: true });
      h += ofield('scope', 'Scope / focus', { ph: 'e.g. Operations', req: true });
      h += ofield('email', 'Email', { ph: 'name@company.com', type: 'email', req: true });
      h += ofield('dept', 'Department', { ph: 'e.g. Strategy', req: true });
      /* A temporary password, for an administrator editing someone else
         (Directive 2 Oct 2026, 5.7 and 5.10). Your own password is Change
         password, in the account menu; nobody's is ever shown back. */
      if (canEdit && !isMe) h += temporaryFieldHtml('ru_' + u.id + '_temporary', !u.serverId, fe.temporary);
      if (canEdit) h += adminTickHtml('ru_' + u.id + '_admin', (u.id in _pendingAdmin) ? _pendingAdmin[u.id] : u.admin === true);   /* Sweep 4R item 2 (A.5.29): administrators only; new members too */
      h += '</div>';
      /* Which programs this person may open. Admin-only: a member editing
         their own profile is shown what they have, not a set of switches over
         it — and the server ignores a `modules` key from a non-admin anyway
         (UserController::update), so the two halves agree. */
      h += memberAccessHtml(u, canEdit);
      h += '<div class="org-edit-actions">';
      h += '<button class="org-btn-save" onclick="saveProfile(\'' + u.id + '\')"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Saving\u2026' : 'Save') + '</button>';
      h += '<button class="org-btn-cancel" onclick="cancelEditProfile()"' + (busy ? ' disabled' : '') + '>Cancel</button>';
      if (canManageOrg()) h += '<button class="org-btn-del" onclick="removeProfile(\'' + u.id + '\')"' + ((isMe || busy) ? ' disabled' : '') + (isMe ? ' title="Signed-in profile \u2014 switch users to delete"' : '') + '>Delete</button>';
      h += '</div>';
      h += '</div>';
    } else {
      // Compact read-only row
      var meta = [esc(u.role || ''), (u.scope && u.scope !== 'All') ? esc(u.scope) : ''].filter(Boolean).join(' \xb7 ');
      var sub = [esc(u.email || ''), esc(u.dept || '')].filter(Boolean).join(' \xb7 ');
      h += '<div class="org-row">';
      h += userAv(u, 38);
      h += '<div class="org-row-main"><div class="org-row-name">' + (esc(u.name) || '<span class="org-unnamed">Unnamed</span>') + (isMe ? ' <span class="org-you">You</span>' : '') + '</div>';
      if (meta) h += '<div class="org-row-meta">' + meta + '</div>';
      if (sub) h += '<div class="org-row-sub">' + sub + '</div>';
      /* Which programs they can open, on the row itself. The whole point of
         per-member access is that two people on this list differ, and a roster
         that does not show the difference makes the admin open every profile in
         turn to find out who has what. */
      if (!solo) h += '<div class="org-row-sub">' + memberAccessSummary(u) + '</div>';
      h += '</div>';
      if (canEditMember(u.id)) {
        h += '<div class="org-row-actions">';
        h += '<button class="org-row-btn" title="Edit profile" aria-label="Edit" onclick="editProfile(\'' + u.id + '\')">\u270E</button>';
        if (canManageOrg()) h += '<button class="org-row-btn org-row-del" title="' + (isMe ? 'Signed-in profile \u2014 switch users to delete' : 'Delete profile') + '" aria-label="Delete" onclick="removeProfile(\'' + u.id + '\')"' + (isMe ? ' disabled' : '') + '>\xd7</button>';
        h += '</div>';
      }
      h += '</div>';
    }
  });
  h += '</div>';
  if (!solo && canEdit) h += '<div style="text-align:center">' + btn('+ Add team member', 'addProfile()', 'bs') + '</div>';
  h += '</div>';

  // Organization details (kept at the bottom of the page) — all required, inline validation.
  var de = UI.orgDetErrors || {};
  var roDis = canEdit ? '' : ' disabled';   // read-only for non-admins
  function dstyle(field) { return de[field] ? ' style="border-color:#c0392b"' : ''; }
  // The asterisk tracks what validateOrgDetails() actually demands: for a solo
  // account that is the name alone, so the objective must not wear one.
  /* The star marks a field that will refuse the form, and only the name does
     that now (validateOrgDetails). Starring the other seven while they are
     optional would be the form lying about what it wants. */
  function dlab(label, field) {
    var req = canEdit && field === 'name';
    return '<label class="form-label">' + esc(label) + (req ? ' <span style="color:#c0392b">*</span>' : '') + '</label>';
  }
  function derr(field) { return de[field] ? '<div class="org-field-err" style="color:#c0392b;font-size:12px;margin-top:4px">' + esc(de[field]) + '</div>' : ''; }
  function dhandlers(field) { return canEdit ? ' onchange="saveEnterprise()" oninput="clearOrgDetErr(\'' + field + '\')"' : ''; }
  function dinp(field, label, ph, type) {
    return '<div>' + dlab(label, field)
      + '<input id="ent_' + field + '" class="field-input" type="' + (type || 'text') + '" value="' + esc(e[field] || '') + '" placeholder="' + esc(ph) + '"' + dstyle(field) + roDis + dhandlers(field) + '/>'
      + derr(field) + '</div>';
  }
  function dsel(field, label, opts) {
    var s = '<div>' + dlab(label, field) + '<select id="ent_' + field + '" class="field-sel"' + dstyle(field) + roDis + (canEdit ? ' onchange="saveEnterprise();clearOrgDetErr(\'' + field + '\')"' : '') + '>';
    opts.forEach(function (o) { s += '<option value="' + esc(o[0]) + '"' + (e[field] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; });
    return s + '</select>' + derr(field) + '</div>';
  }
  /* The company block — industry, headcount, region, sponsor. An organization
     of one has none of these, so a solo account is asked for a workspace name
     and an objective and nothing else (orgDetailFields()). The columns still
     exist and any value already stored is preserved on save; it is the ASKING
     that is enterprise-only. */
  h += '<div class="mb-6 org-subhead"><div class="section-label mb-3">'
    + (solo ? 'Your Workspace' : 'Organization Details') + '</div>';
  if (!canEdit) h += '<p class="ent-ro-note">Only administrators can change the organization’s details.</p>';   /* Sweep 4R item 3 (A.5.31): the fields below are read-only */
  if (de._general) h += '<div class="entry-err" style="margin:0 0 12px;color:#c0392b;font-size:13px">' + esc(de._general) + '</div>';
  h += '<div class="org-grid">';
  h += dinp('name', solo ? 'Workspace name' : 'Organization name', solo ? 'e.g. Maria Torres' : 'e.g. Acme Manufacturing');
  if (!solo) {
    h += dinp('industry', 'Industry', 'e.g. Industrial / Pharma');
    h += dsel('size', 'Company size', sizeOpts);
    h += dinp('region', 'Region / HQ', 'e.g. Boston, USA');
    h += dinp('website', 'Website', 'e.g. acme.com');
    h += dsel('maturity', 'AI maturity', matOpts);
    h += dinp('sponsor', 'Executive sponsor', 'e.g. CEO / CFO name');
  }
  h += '</div>';
  h += '<div style="margin-top:14px"><div>' + dlab('Primary objective', 'objective')
    + '<textarea id="ent_objective" class="field-ta" rows="2" placeholder="'
    + (solo ? 'What do you want to be able to do by day 90?'
      : 'What is the enterprise aiming to achieve with AI in the next 90 days?')
    + '"' + dstyle('objective') + roDis + dhandlers('objective') + '>' + esc(e.objective || '') + '</textarea>'
    + derr('objective') + '</div></div>';
  h += '</div>';

  var odBusy = !!UI.orgDetBusy;
  if (canEdit) {
    /* "Get Started", not "Done" (10 Sep 2026). This screen is the first thing a
       new account meets, and with every field but the name now optional the
       button's job is to let them into the app, not to declare the form
       finished. The label is unconditional: the setup-mode branch that used to
       carry it is unreachable — openOrgSetup() has had no caller since sign-up
       stopped entering it, so `orgSetupMode` is always false here.

       What the button DOES is unchanged: doneOrgDetails() still validates,
       writes locally, and posts to MySQL before closing. */
    h += '<div class="u-ea28b89"><button class="btn-gold" onclick="doneOrgDetails(' + (orgSetupMode ? 'true' : 'false') + ')"' + (odBusy ? ' disabled' : '') + '>' + (odBusy ? 'Saving…' : 'Get Started') + '</button></div>';
  } else {
    h += '<div class="u-ea28b89"><button class="btn-gold" onclick="closeModal()">Close</button></div>';
  }
  h += '</div></div>';
  mr.innerHTML = h;
}
