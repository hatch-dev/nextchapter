/* ─────────────────────────────────────────────────────────────
   my-assignments.js — the account menu + "My Assignments"
   ─────────────────────────────────────────────────────────────
   Two surfaces over one list, both shared by every program that has
   an assignment system:

     the ACCOUNT MENU   the signed-in chip in the top bar used to sign
                        out on first click. It now opens a three-item
                        dropdown — Org Profile · View Assignments ·
                        Sign Out — built in js/nav.js and wired through
                        the same delegated data-act listener as the
                        More menu. Sign Out is unchanged, confirm and
                        all; it has simply moved one click away.
     MY ASSIGNMENTS     the steps data.assigns names this user on:
                        a modal from the menu, and the same list as a
                        card under the 90-Day Timeline on the module
                        overview (only when there is open work).

   Open tasks first — due-dated soonest first, undated after in program
   order — then completed ones greyed at the foot under a Completed
   marker, so finishing a step moves it down the list rather than off it.

   ── What a program supplies ───────────────────────────────────
   Nothing, normally. The list is built from the shell's own mgSteps()
   (js/pages/navigate.js), data.assigns (js/features/assignments.js),
   data.stepDue and isStepDone() — which already asks the program when
   completion is not a plain data.completedSteps lookup (js/app.js).

   A program whose assignable step list differs from the shell's says so
   with the `assignSteps` hook, returning [{id,name,ph:{id,name}}, …] in
   program order. Executive Readiness does: its four individual-track
   steps are one leader's own work, not the organization's, so they are
   not assignments and never appear here (ruled 12 Aug 2026).

   A program with no phase spine — the Leaders programs work one
   decision at a time — has no assignment system at all, so the menu
   item is not offered. Same rule the More menu applies to Track Program.

   Relies on app.js/nav.js globals: data, UI, isAppAdmin, getCurrentUser,
   userAv, esc, fmtDate, isStepDone, currentModal, closeModal, go, $,
   render, mgSteps, Modules.
   ───────────────────────────────────────────────────────────── */

/* ── The step list this program assigns against ───────────────── */
function asgnSteps() {
  try {
    var own = window.Modules && Modules.hook('assignSteps');
    return (own ? own() : (typeof mgSteps === 'function' ? mgSteps() : [])) || [];
  } catch (e) { return []; }
}

/* Whether this account, in this program, has an assignments list to open.
   The app administrator is signed in as nobody in particular — there is no
   `me` for the list to be about — and a program with no phases has no
   assignable steps. */
function asgnAvailable() {
  if (typeof isAppAdmin !== 'undefined' && isAppAdmin) return false;
  if (!getCurrentUser()) return false;
  return !!(window.Modules && Modules.PH().length);
}

/* ── The list ─────────────────────────────────────────────────── */
/* One walk of the program, split by completion. `done` is asked of
   isStepDone() rather than read out of data.completedSteps, so a program
   that stores completion its own way (Executive Readiness) is answered
   by the program. */
function asgnTasks(userId, wantDone) {
  var out = [], assigns = data.assigns || {}, due = data.stepDue || {};
  asgnSteps().forEach(function (s) {
    if ((assigns[s.id] || []).indexOf(userId) < 0) return;   // not this user's
    var done = false;
    try { done = !!isStepDone(s.id); } catch (e) { done = !!(data.completedSteps || {})[s.id]; }
    if (wantDone !== done) return;
    out.push({
      id: s.id, label: s.name,
      sub: 'Phase ' + s.ph.id + ' · ' + s.ph.name,
      /* The Completed section shows no dates: a deadline on finished work is
         noise, and an overdue-red row that is already done reads as an error. */
      due: wantDone ? null : (due[s.id] || null)
    });
  });
  return out;
}

/* Due-dated first (soonest first), undated after in program order; stable. */
function asgnOpenTasks(userId) {
  return asgnTasks(userId, false).map(function (x, i) { x._i = i; return x; }).sort(function (a, b) {
    if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : a._i - b._i;
    if (a.due) return -1;
    if (b.due) return 1;
    return a._i - b._i;
  });
}
function asgnDoneTasks(userId) { return asgnTasks(userId, true); }

/* ── Markup ───────────────────────────────────────────────────── */
function asgnGo(taskId) { closeModal(); go(taskId); }

function asgnRowHtml(t, isDone, today) {
  var overdue = !isDone && !!(t.due && t.due < today);
  return '<div onclick="asgnGo(\'' + esc(t.id) + '\')" role="link" tabindex="0" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.03);margin-bottom:8px;cursor:pointer'
    + (isDone ? ';opacity:.55' : '') + '" title="' + (isDone ? 'Open this step' : 'Open this task') + '">'
    + '<div style="flex:1"><div style="font-size:14px;font-weight:600;color:var(--paper)">' + esc(t.label) + '</div>'
    + '<div style="font-family:var(--mono);font-size:10px;color:var(--stone);margin-top:2px">' + esc(t.sub || '') + '</div></div>'
    + (isDone
      ? '<div style="font-family:var(--mono);font-size:11px;color:#1B6B5A;white-space:nowrap">✓ Done</div>'
      : (t.due
        ? '<div style="font-family:var(--mono);font-size:11px;color:' + (overdue ? '#9B2D3F' : 'var(--stone)') + ';white-space:nowrap">'
        + (overdue ? 'Overdue · ' : 'Due ') + esc(fmtDate(t.due)) + '</div>'
        : ''))
    + '<span style="color:var(--gold);font-size:14px">→</span></div>';
}

function asgnListHtml(userId) {
  var open = asgnOpenTasks(userId), done = asgnDoneTasks(userId);
  if (!open.length && !done.length) {
    return '<div style="font-family:var(--serif);font-size:15px;color:var(--stone);font-style:italic;text-align:center;padding:28px 0">'
      + 'No assignments yet. Tasks assigned to you in Track Program appear here.</div>';
  }
  var today = new Date().toISOString().split('T')[0], h = '';
  open.forEach(function (t) { h += asgnRowHtml(t, false, today); });
  if (!open.length) {
    h += '<div style="font-family:var(--serif);font-size:15px;color:var(--stone);font-style:italic;text-align:center;padding:14px 0 6px">No open assignments.</div>';
  }
  if (done.length) {
    h += '<div style="font-family:var(--mono);font-size:10px;color:var(--stone);letter-spacing:.08em;text-transform:uppercase;margin:14px 0 8px">Completed</div>';
    done.forEach(function (t) { h += asgnRowHtml(t, true, today); });
  }
  return h;
}

/* ── The modal ────────────────────────────────────────────────── */
function openAssignments() { currentModal = 'assignments'; renderAssignmentsModal(); }

function renderAssignmentsModal() {
  var mr = $('modalRoot'); if (!mr) return;
  if (currentModal !== 'assignments') return;   // never clears another modal's paint
  var cu = getCurrentUser();
  if (!cu) { mr.innerHTML = ''; currentModal = null; return; }
  var h = '<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal">';
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">' + userAv(cu, 34)
    + '<div><h3 class="h-sub-lg" style="margin:0">My Assignments</h3>'
    + '<div style="font-family:var(--mono);font-size:10px;color:var(--stone)">' + esc(cu.name)
    + (cu.role ? ' · ' + esc(cu.role) : '') + '</div></div></div>';
  h += '<div style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:16px">'
    + 'Tasks assigned to you in Track Program — click one to go straight to the work. '
    + 'Completed assignments drop to the foot of the list.</div>';
  h += asgnListHtml(cu.id);
  h += '<div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn-gold" onclick="closeModal()">Done</button></div>';
  h += '</div></div>';
  mr.innerHTML = h;
}

/* ── The overview card ────────────────────────────────────────────
   Under the 90-Day Timeline on the module overview, and only when the
   signed-in user has OPEN work: the card is a nudge, so a set of
   finished assignments must not keep it on the page. The modal still
   lists those, which is where completed work belongs. */
function asgnOverviewCard() {
  if (!asgnAvailable()) return '';
  var cu = getCurrentUser();
  if (!asgnOpenTasks(cu.id).length) return '';
  return '<div class="mb-6" style="border:1px solid rgba(var(--fg-rgb),.08);padding:20px 24px;background:rgba(var(--fg-rgb),.02)">'
    + '<h3 class="h-sub-md" style="margin:0 0 4px">My Assignments</h3>'
    + '<p class="t-faint-sm" style="margin:0 0 12px">Assigned to you — open tasks first, completed below.</p>'
    + asgnListHtml(cu.id)
    + '</div>';
}

/* ── The account menu's open/close state ──────────────────────────
   Lives here rather than in nav.js for the same reason toggleNavMore
   does not: the menu is opened from the chip and closed from three
   other places, and render() is what repaints it. Opening it closes
   the other two nav menus — three dropdowns stacked over each other is
   nobody's intent. */
function toggleUserMenu(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  var open = !UI.userMenu;
  UI.userMenu = open;
  if (open) { UI.navMore = false; UI.navModules = false; }
  render();
}
function closeUserMenu() { if (UI.userMenu) { UI.userMenu = false; render(); } }
