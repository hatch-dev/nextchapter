/* ─────────────────────────────────────────────────────────────
   assignments.js — Pipeline step assignments (MySQL-backed)
   ─────────────────────────────────────────────────────────────
   Extracted from app.js (plain global script, loaded before app.js).
   Who is assigned to each pipeline step, persisted server-side via
   the /assignments API (table step_assignments) so assignments follow
   the team across devices — the same model as Notes and Team Chat.

   `data.assigns = { stepId: [localUserId, ...] }` remains the in-memory
   mirror the UI (and the Module Management hub) read from, keyed by the
   device's LOCAL user ids. The database is the source of truth and keys
   by each member's stable public_id (serverId); this module maps between
   the two on load and on every toggle. If the workspace isn't linked to a
   server org yet, it falls back to local-only behaviour so nothing breaks.

   Relies on app.js/org-admin.js globals: data, USERS, saveData, render,
   esc, userAv, UI, API_BASE, actorId, orgServerId, postJSON, showToast.
   ───────────────────────────────────────────────────────────── */

/* ── Identity + local⇄server id mapping ───────────────────────── */
function assignmentsOrg() { return (typeof orgServerId === 'function') ? orgServerId() : null; }
/* Which program these assignments belong to. Every program numbers its steps
   1.1 … 4.4, so without this an assignment on '1.1' would be one row shared by
   unrelated steps in every program at once — and, since assignment decides who
   may sign a step off, it would lock people out of work nobody had given them.
   Sent on both the read and the toggle; the server keys the row by it
   (api/sql/assignment-modules.sql). */
function assignmentsModule() {
  return (window.Modules && Modules.activeId()) || 'pipeline';
}
function assignUserServerId(uid) { var u = (USERS || []).find(function (x) { return x.id === uid; }); return (u && u.serverId) ? u.serverId : ''; }
function assignLocalUserId(pub) { var u = (USERS || []).find(function (x) { return x.serverId === pub; }); return u ? u.id : null; }

/* ── Read (local mirror) ──────────────────────────────────────── */
function getAssigns(taskId) {
  return (data.assigns || {})[taskId] || [];
}

/* ── Who may change assignments ───────────────────────────────────
   The app admin or the organization's administrator — the same authority
   that manages the team and org details (canManageOrg in js/app.js).
   Everyone else sees who is responsible but cannot change it. The server
   enforces the same rule in AssignmentController::set(); this is the UI
   half, so members are never shown a control that would be rejected. */
function canAssign() {
  return (typeof canManageOrg === 'function') ? canManageOrg() : false;
}

/* ── Who may mark a section complete ──────────────────────────────
   Assignment names who is responsible for finishing a section, so only
   those members may sign it off — plus the admins, who can always
   unblock a step (someone leaves, someone is away).

   A section with NOBODY assigned is ADMIN-ONLY (ruled 2026-09-09). It used
   to stay open to the whole team, on the reasoning that work must not stall
   waiting for an admin — but that made every unassigned step in the program
   signable by any member, which is not accountability, and it is what was
   reported. The two rules together mean a member can only ever complete work
   that has their name on it.

   Note which way this fails. Under the old rule, an assignment that failed to
   resolve on this device read as "unassigned" and therefore as OPEN; now it
   reads as "not yours", so a lost row costs somebody a click and an email
   rather than costing somebody else their sign-off. That is the safe
   direction, and assignmentsLoad() no longer loses rows anyway.

   Returns '' when the current user may complete the step, otherwise the
   reason they can't — which doneBtn() prints under the disabled button and
   completeBlocked() repeats if the write is attempted anyway, so the block
   always explains itself instead of just going grey. */
function stepCompleteLock(stepId) {
  var bar = stepAssignRefusal(stepId);
  if (!bar) return '';
  if (!bar.assigned) {
    return 'Nobody is assigned to this section yet. Ask an administrator to assign it to you, or to mark it complete.';
  }
  return 'This section is assigned to ' + bar.who + '. Only they or an administrator can mark it complete.';
}

/* ── Who may EDIT a step's fields ─────────────────────────────────
   The same rule, for typing rather than for signing off, and deliberately the
   same rule: being trusted to fill a section in but not to finish it — or to
   finish it but not to write it — is not a distinction anybody asked for, and
   two rules that disagree about who owns a section is how a team ends up
   arguing with the software.

   So: the assignee edits it, an administrator edits it, and for everybody else
   the step is read-only. A step with nobody assigned is administrator-only,
   exactly as its sign-off is.

   Returns '' when the current user may edit, otherwise the reason — which the
   read-only note prints at the top of the step and editBlocked() repeats if a
   write is attempted anyway. */
function stepEditLock(stepId) {
  var bar = stepAssignRefusal(stepId);
  if (!bar) return '';
  if (!bar.assigned) {
    return 'Nobody is assigned to this step yet, so it is read-only. Ask an administrator to assign it to you.';
  }
  return 'This step is assigned to ' + bar.who + '. Only they or an administrator can edit it.';
}

/* The decision the two rules share. Returns null when this member has the run
   of the step, otherwise who is standing in their way — so each rule above
   only has to phrase it.

   A section with NOBODY assigned is ADMIN-ONLY (ruled 2026-09-09; extended to
   editing 2026-09-11). It used to stay open to the whole team, on the
   reasoning that work must not stall waiting for an admin — but that made
   every unassigned step in the program signable by any member, which is not
   accountability, and it is what was reported. The two rules together mean a
   member can only ever work on what has their name on it.

   Note which way this fails. Under the old rule, an assignment that failed to
   resolve on this device read as "unassigned" and therefore as OPEN; now it
   reads as "not yours", so a lost row costs somebody a click and an email
   rather than costing somebody else their work. That is the safe direction,
   and assignmentsLoad() no longer loses rows anyway. */
function stepAssignRefusal(stepId) {
  if (!stepId) return null;
  /* The same two preconditions the rest of the assignment feature carries
     (asgnAvailable, js/features/my-assignments.js). Neither is a loophole:
     · No signed-in member — the rule is about WHICH member, so it has nothing
       to say. Nobody reaches a step page signed out (the entry gate is up) and
       a save with no actor is refused by the server anyway.
     · A program with no assignment system at all — the Leaders programs have
       PH: [], nothing can ever be assigned in them, and gating on an empty
       list would lock every step in them for ever. */
  if (typeof currentUserId === 'undefined' || !currentUserId) return null;
  if (!(window.Modules && Modules.PH && Modules.PH().length)) return null;
  if (canAssign()) return null;                      // app admin / org admin

  var assigns = getAssigns(stepId);
  if (assigns.indexOf(currentUserId) >= 0) return null;  // assigned to me
  if (!assigns.length) return { assigned: false, who: '' };

  var names = assigns.map(function (uid) {
    var u = (USERS || []).find(function (x) { return x.id === uid; });
    return u ? u.name : null;
  }).filter(Boolean).sort();   // stable order: the DB returns rows in no order

  return { assigned: true, who: names.length ? nameList(names) : 'the assigned member' };
}

/* ── The same rule, ENFORCED ──────────────────────────────────────
   stepCompleteLock() was consulted in exactly one place — doneBtn(), which
   greys the button out — and in none of the twenty-odd handlers that actually
   write the completion. A disabled button is a statement, not a gate: the
   write still goes through from a stale render (the page was drawn before the
   assignment arrived), from the console, or from any path that reaches the
   handler another way. This is the same lesson the record locks learned, where
   an unmapped field id meant the write went through while somebody else held
   the card.

   So this is the twin of lockBlocked(): every program's confirmStepDone() and
   confirmSectionDone() ask it first, which is the one place all completion
   passes through in all three Enterprise programs.

   Takes the step id explicitly rather than reading currentStep, because a
   section's sign-off belongs to the step it sits on and the caller knows which
   that is. */
function completeBlocked(stepId) {
  var why = '';
  try { why = stepCompleteLock(stepId || (typeof currentStep !== 'undefined' ? currentStep : '')); } catch (e) { return false; }
  if (!why) return false;
  try { alert(why); } catch (e) { }
  return true;
}

/* Join names the way a person would write them:
     Ann                     ·  Ann or Ben  ·  Ann, Ben or Cara
   A step can have any number of assignees, so "A or B or C or D" would read
   like a machine wrote it. */
function nameList(names) {
  if (names.length <= 1) return names[0] || '';
  return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
}

/* The step's title, for the email the server sends on assignment.
   Step ids are '1.1' in all twelve programs and the titles live in each
   program's own spine, which the server cannot read — so the client that
   already has it on screen sends it. Absent, the message says "Step 1.1",
   which is correct if terse. */
function assignStepName(stepId) {
  try {
    var PHs = (window.Modules && Modules.PH()) || [];
    for (var i = 0; i < PHs.length; i++) {
      var steps = PHs[i].steps || [];
      for (var j = 0; j < steps.length; j++) {
        if (steps[j].id === stepId) return steps[j].name || '';
      }
      var outs = PHs[i].outcomes || [];
      for (var k = 0; k < outs.length; k++) {
        if (outs[k].id === stepId) return outs[k].name || '';
      }
    }
  } catch (e) { }
  return '';
}

/* Said once per session, not once per assignment. The server queues every
   notice in mail_outbox whether or not a mail server is configured, so an
   admin assigning ten sections on a deployment with no SMTP would otherwise
   collect ten identical warnings. They need to know their colleague was not
   actually emailed; they do not need to be told ten times. */
var _assignMailWarned = false;
function assignNoticeToast(notified) {
  if (!notified || notified.sent) return;
  if (typeof showToast !== 'function') return;
  var s = notified.status;
  if (s === 'not-applicable') return;                       // nothing was meant to be sent
  if (s === 'no-address') {
    showToast('Assigned. That member has no email address on file, so they were not notified.', 'error');
    return;
  }
  if (_assignMailWarned) return;
  _assignMailWarned = true;
  showToast(s === 'no-transport'
    ? 'Assigned. No mail server is configured, so the notification is queued rather than sent.'
    : 'Assigned, but the notification email could not be sent. It is queued for a retry.', 'error');
}

/* ── Toggle: update locally + render instantly, then sync to DB ── */
function toggleAssign(taskId, uid) {
  if (!canAssign()) return; // not reachable from the UI; guards the console/stale render
  if (!data.assigns) data.assigns = {};
  var cur = data.assigns[taskId] || [];
  var willAssign = cur.indexOf(uid) < 0;
  data.assigns[taskId] = willAssign ? cur.concat([uid]) : cur.filter(function (x) { return x !== uid; });
  saveData();
  render();
  // Persist to the server when this workspace + member are linked to the DB.
  var org = assignmentsOrg(), actor = actorId(), sid = assignUserServerId(uid);
  if (org && actor && sid) {
    postJSON(API_BASE + '/assignments',
      {
        org: org, module: assignmentsModule(), actor_id: actor,
        step: taskId, user: sid, assigned: willAssign,
        /* Only on the way IN: the server sends nothing when unassigning, so a
           title would be carried for no reader. */
        step_name: willAssign ? assignStepName(taskId) : ''
      },
      function (res) { assignNoticeToast(res && res.data && res.data.notified); },
      function (err) { if (typeof showToast === 'function') showToast((err && err.message) || 'Could not save the assignment.', 'error'); });
  }
}

/* ── Load from DB (source of truth) → rebuild the local mirror ─── */
// Called on sign-in, boot restore, and when opening an organization —
// after the roster (USERS + serverIds) is available so public_ids map.
function assignmentsLoad(cb) {
  var org = assignmentsOrg();
  if (!org) { if (cb) cb(); return; }                 // local-only workspace

  /* The roster FIRST, and waited for. These two used to be fired back to back
     at boot with no wait between them (js/app.js), so the mapping below ran
     against whatever roster the workspace document happened to carry — and a
     member added since this program's document was last written was not in it.
     Every row belonging to such a member was dropped, the partial map was
     written over data.assigns and SAVED, and the loss went into the document
     for everyone. On screen that read as "nobody is assigned to this", which
     under the old rule meant "anybody may complete it".

     pullOrgMembers() is a no-op without an org serverId and silent on failure,
     so this only ever costs one request before the mapping is trustworthy. */
  var go = function () { assignmentsFetch(org, cb); };
  if (typeof pullOrgMembers === 'function') { try { pullOrgMembers(go); return; } catch (e) { } }
  go();
}

function assignmentsFetch(org, cb) {
  /* `actor` because reading assignments requires organization membership now —
     the endpoint took an org public id and nothing else, so anyone holding one
     could read who was accountable for what. */
  fetch(API_BASE + '/assignments?org=' + encodeURIComponent(org)
    + '&module=' + encodeURIComponent(assignmentsModule())
    + '&actor=' + encodeURIComponent(actorId()))
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res && res.success && res.data && Array.isArray(res.data.assignments)) {
        var map = {}, lost = 0;
        res.data.assignments.forEach(function (row) {
          var lid = assignLocalUserId(row.user_public_id);
          /* A member still not on this device's roster after the pull above —
             they may have been removed, or the pull may have failed. KEEP the
             row, addressed by the public id the server gave us. Nothing here
             matches a local id, so it can never read as "assigned to me"; what
             it does is keep the step honestly assigned to somebody, which is
             the answer that fails safe. Dropping it was the bug. */
          if (lid == null) { lost++; (map[row.step] = map[row.step] || []).push(row.user_public_id); return; }
          (map[row.step] = map[row.step] || []).push(lid);
        });
        if (lost) { try { console.warn('assignments: ' + lost + ' row(s) name a member who is not on this device\'s roster; kept unresolved'); } catch (e) { } }
        data.assigns = map;
        saveData();
        if (typeof currentUserId !== 'undefined' && currentUserId && typeof render === 'function') render();
      }
      if (cb) cb();
    })
    .catch(function () { if (cb) cb(); });
}

/* ── UI: the "Assigned to" bar + member picker ────────────────── */
function stepAssignBar(stepId) {
  if (!stepId) return '';
  return '<div class="assign-bar">'
    + '<div class="assign-bar-lbl">Assigned to</div>'
    + assignBtn(stepId)
    + '</div>';
}

function assignBtn(taskId) {
  var assigns = getAssigns(taskId);
  var mayAssign = canAssign();
  // The picker can only be open for someone allowed to use it — a member who
  // opened it and then lost authority (admin left the org) must not keep it.
  var isOpen = mayAssign && UI.assignOpen === taskId;
  var h = '<div class="assign-wrap">';

  // Who is responsible. Everyone sees this; only an admin can click it.
  var unknown = 0;
  assigns.forEach(function (uid) {
    var u = USERS.find(function (x) { return x.id === uid });
    /* An assignment kept unresolved by assignmentsLoad — the member is not on
       this device's roster. Counted rather than skipped: the bar saying nothing
       while the step is locked is precisely the confusion being fixed. */
    if (!u) { unknown++; return; }
    var who = esc(u.name) + ' – responsible for this section';
    if (mayAssign) {
      h += '<span class="assign-av" style="cursor:pointer" title="' + who + '. Click to manage assignments" onclick="event.stopPropagation();UI.assignOpen=UI.assignOpen===\'' + taskId + '\'?null:\'' + taskId + '\';render()">' + userAv(u, 24) + '</span>';
    } else {
      h += '<span class="assign-av" title="' + who + '">' + userAv(u, 24) + '</span>';
    }
  });

  if (unknown) {
    h += '<span class="t-faint-sm" title="This section is assigned to a member who is not on this program’s team list yet.">'
      + unknown + (unknown === 1 ? ' other member' : ' other members') + '</span>';
  }

  if (!mayAssign) {
    // Members get no control — just the state of play, so the bar still says
    // something rather than looking broken or empty.
    if (!assigns.length) h += '<span class="t-faint-sm">Not yet assigned — an administrator must assign or complete it</span>';
    return h + '</div>';
  }

  // + Assign button (admins only)
  h += '<button class="assign-add" style="width:24px;height:24px;padding:0;border-radius:50%;border:1px dashed rgba(var(--fg-rgb),.45);background:none;display:inline-flex;align-items:center;justify-content:center;font-size:14px;line-height:1" title="Assign members" onclick="event.stopPropagation();UI.assignOpen=UI.assignOpen===\'' + taskId + '\'?null:\'' + taskId + '\';render()">+</button>';
  // Picker popover
  if (isOpen) {
    h += '<div class="assign-pop">';
    h += '<div class="t-faint-sm" style="padding:6px 8px 4px">Assign the members responsible for completing this section – including yourself. Click a name to assign or unassign; changes save instantly.</div>';
    var _sorted = USERS.slice().sort(function (a, b) { var sa = assigns.indexOf(a.id) >= 0 ? 0 : 1, sb = assigns.indexOf(b.id) >= 0 ? 0 : 1; return sa - sb });
    _sorted.forEach(function (u) {
      var isSel = assigns.indexOf(u.id) >= 0;
      h += '<button class="assign-row"' + (isSel ? '' : ' style="opacity:.55"') + ' title="' + (isSel ? 'Click to remove' : 'Click to assign') + '" onclick="event.stopPropagation();toggleAssign(\'' + taskId + '\',\'' + u.id + '\')">'
        + userAv(u, 22)
        + '<div class="assign-row-text"><div class="assign-row-name">' + esc(u.name) + '</div>'
        + '<div class="assign-row-role">' + esc(u.role) + '</div></div>'
        + '<span class="assign-row-check">' + (isSel ? '✓' : '+') + '</span>'
        + '</button>';
    });
    h += '<button class="assign-close" onclick="event.stopPropagation();UI.assignOpen=null;render()">Done</button>';
    h += '</div>';
  }
  return h + '</div>';
}
