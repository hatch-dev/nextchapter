/* ─────────────────────────────────────────────────────────────
   email.js — Email notifications (client-side; INERT until AWS wired)
   ─────────────────────────────────────────────────────────────
   Extracted from app.js (plain global script, loaded before app.js).
   notifySweepDeadlines() is called from render(); notifyStepComplete()
   fires when a step is marked complete. Relies on app.js globals:
   USERS, PH, data, Store, esc, fmtDate, card, mgmtHubContent, render.
   ───────────────────────────────────────────────────────────── */

/* ================= Email Notifications (Paul, July 7) =================
   Client-side complete; INERT until the dev team wires the AWS service.
   Contract (see AWS_Notifications_Contract.md in the handoff set):
   - Set NOTIFY_ENDPOINT to the service URL. The app POSTs JSON:
     {kind, subject, to:[emails], stepId, orgName, sentAt, pdf, html}
   - kind 'step-complete': html = completion notice + the full Module
     Management analytics page (stat band included). pdf:true — the
     service converts the html to PDF (wrap with the app stylesheet)
     and mails it as an attachment to every address in `to`.
   - kind 'deadline-reminder': plain notice, pdf:false, sent to the
     administrator-role member(s) plus the step's assignees.
   - Until the endpoint is set, every notification is recorded in the
     local outbox (data.notifications) with status 'pending'.
   Admin rule: roster members flagged admin:true, OR whose role text contains
   "admin" (case-insensitive) — directive of 3 Sep 2026, Part 4 correction B,
   superseding the July 9 flag-only ruling. No match => assignees only, and the
   outbox entry notes the gap.
   ======================================================================= */

/* ── The service URL ───────────────────────────────────────────
   Set this ONE constant to switch notifications on, for every program at once.
   It must start with https:// — the apps are served over HTTPS and a browser
   blocks a call to plain HTTP.

   It is a BASE, not a whole URL, because this shell is shared: the Pipeline,
   Executive Readiness and Responsible AI Governance all run the code in this
   file, so there is no per-app file to hold a per-app constant the way the
   directive assumes. The request body does not name the app it came from
   (deliberately — Part 6 forbids changing the fields), so the app is named in
   the PATH instead, which is exactly what Part 3 point 3 prescribes:

       NOTIFY_ENDPOINT = 'https://your-service/notify'
         → the Pipeline posts to  https://your-service/notify/pipeline
         → Governance posts to    https://your-service/notify/ai-governance

   Empty means inert, unchanged: nothing is sent, and every notification is
   still recorded in data.notifications as 'pending – endpoint not configured'. */
/* RELATIVE, and deliberately so. The directive assumes an absolute https:// URL
   on another host, and gives the reason: a page served over HTTPS cannot call a
   service over plain HTTP. A same-origin relative path satisfies that reason
   outright — it inherits the page's own scheme — and it is the one value that is
   correct in every environment. It resolves against the <base href> index.php
   writes, so this needs no per-deployment edit:

     locally   http://localhost/apps/            -> /apps/api/notify/<program>
     live      https://nextchapter.org/app/…/    -> /app/enterprise/api/notify/<program>

   The service is api/controllers/NotifyController.php, and api/index.php
   already answers the CORS pre-flight for every endpoint under api/.
   Set this to an absolute https:// base instead to point at an external
   service; nothing else in this file changes. */
var NOTIFY_ENDPOINT = 'api/notify';

/* The path segment each program is known by on the service. Separate from the
   internal module id on purpose — the service's names are the service's to
   choose, and renaming one here must not mean touching the dispatch logic.
   A program not listed falls back to its module id. */
var NOTIFY_PATHS = {
  'pipeline': 'pipeline',
  'exec-readiness': 'exec-readiness',
  'ai-governance': 'ai-governance'
};

/* The URL this program posts to, or '' when nothing is configured. Resolved at
   dispatch time rather than at load: one browser session can switch programs
   without reloading (js/modules/boot.js), and a URL captured at load would
   send the next program's notifications to the previous one's path. */
function notifyEndpoint() {
  if (!NOTIFY_ENDPOINT) return '';
  var id = '';
  try { id = (window.Modules && Modules.activeId && Modules.activeId()) || ''; } catch (e) { }
  if (!id) return NOTIFY_ENDPOINT;          // no active module: post to the base
  return NOTIFY_ENDPOINT.replace(/\/+$/, '') + '/' + (NOTIFY_PATHS[id] || id);
}
function notifyMemberEmails(list) { return (list || USERS || []).map(function (u) { return u && u.email }).filter(function (e) { return e && /\S+@\S+/.test(e) }) }
/* Who receives a deadline reminder as an administrator: the flag, OR a role
   text containing "admin" in any case. Directive of 3 Sep 2026, Part 4
   correction B — which SUPERSEDES the July 9 ruling that role text is a label
   and admin:true the only authority record. The flag stays in the test so the
   organization's creator never drops off reminders.

   One edit covers all three Enterprise programs: neither generated module
   carries its own copy, and the Governance reference already had this form. */
function notifyAdmins() { return (USERS || []).filter(function (u) { return u && (u.admin === true || /admin/i.test(u.role || '')) }) }
function notifyStepName(id) { var nm = id; (PH || []).forEach(function (p) { (p.steps || []).forEach(function (st) { if (st.id === id) nm = 'Step ' + st.id + ' \u2013 ' + st.name }) }); return nm }
function notifyQueue(kind, subject, to, stepId, pdf) {
  if (!to || !to.length) return;
  if (!data.notifications) data.notifications = [];
  var n = { at: Date.now(), kind: kind, subject: subject, to: to, stepId: stepId || '', pdf: !!pdf, status: NOTIFY_ENDPOINT ? 'sending' : 'pending \u2013 endpoint not configured' };
  data.notifications.push(n); if (data.notifications.length > 50) data.notifications = data.notifications.slice(-50);
  Store.commit('notifications');
  notifyDispatch(n); return n
}
function notifyEmailHtml(n) {
  var head = '<h2 style="font-family:Helvetica,Arial,sans-serif">' + esc(n.subject) + '</h2><p>' + (n.kind === 'step-complete' ? esc(notifyStepName(n.stepId)) + ' was marked complete on ' + fmtDate(n.at) + '. The current Module Management analytics report is attached.' : 'The assigned step ' + esc(notifyStepName(n.stepId)) + ' is due within one week (' + esc(((data.stepDue || {})[n.stepId] ? fmtDate((data.stepDue || {})[n.stepId]) : '')) + ').') + '</p>';
  /* Pin the analytics tab (1). A bare mgmtHubContent() renders whichever tab
     UI.mgTab happens to hold in this browser, so leaving Track Program on
     Assignments used to mail the assignment list under a subject line
     promising the analytics report. */
  return n.kind === 'step-complete' ? head + '<hr/>' + mgmtHubContent(null, 1) : head
}
function notifyDispatch(n) {
  if (window.SAMPLE_MODE) return;   /* Part 3: the sample tab sends no email */
  var url = notifyEndpoint();
  if (!url) return; /* inert until wired \u2013 outbox holds the record */
  try {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: n.kind, subject: n.subject, to: n.to, stepId: n.stepId, orgName: (data.enterprise || {}).name || '', sentAt: new Date(n.at).toISOString(), pdf: n.pdf, html: notifyEmailHtml(n) }) })
      .then(function (r) { n.status = r.ok ? 'sent' : 'failed (' + r.status + ')'; Store.commit('notifications'); render() })
      .catch(function () { n.status = 'failed (network)'; Store.commit('notifications'); render() })
  } catch (e) { n.status = 'failed'; Store.commit('notifications') }
}
function notifyStepComplete(id) {
  try {
    var to = notifyMemberEmails(); if (!to.length) return;
    notifyQueue('step-complete', notifyStepName(id) + ' complete \u2013 analytics report', to, id, true)
  } catch (e) { }
}
function notifySweepDeadlines() {
  try {
    var due = data.stepDue || {}, assigns = data.assigns || {}, co = data.completedSteps || {};
    if (!data.remind7) data.remind7 = {};
    var today = new Date(); today.setHours(0, 0, 0, 0);
    Object.keys(due).forEach(function (id) {
      if (!due[id] || co[id] || data.remind7[id]) return;
      var who = assigns[id] || []; if (!who.length) return; /* reminders are for ASSIGNED deadlines */
      var d = new Date(due[id] + 'T00:00:00'); var days = Math.round((d - today) / 86400000);
      if (days < 0 || days > 7) return;
      var admins = notifyAdmins();
      var to = notifyMemberEmails(admins.concat((USERS || []).filter(function (u) { return who.indexOf(u.id) >= 0 && admins.indexOf(u) < 0 })));
      if (!to.length) return;
      var n = notifyQueue('deadline-reminder', notifyStepName(id) + ' due ' + due[id], to, id, false);
      if (n && !admins.length) n.status += ' \u00b7 no administrator on the roster';
      data.remind7[id] = true; Store.commit('remind7')
    })
  } catch (e) { }
}
function notifyOutboxCard() { /* not mounted – kept demo-clean (Paul, July 7); remount in renderMgmtHub if an in-app delivery log is wanted once AWS is wired */
  var ns = (data.notifications || []).slice(-8).reverse();
  var rows = ns.map(function (n) { return '<div class="row-line"><span class="fs-13" style="flex:1">' + esc(n.subject) + '</span><span class="t-faint-sm">' + fmtDate(n.at) + ' \u00b7 ' + n.to.length + ' recipient' + (n.to.length > 1 ? 's' : '') + ' \u00b7 ' + esc(n.status) + '</span></div>' }).join('');
  return card('<h3 class="h-sub-md">Email Notifications</h3><p class="t-faint-sm" style="margin:-2px 0 8px">Step-completion reports go to the whole team; deadline reminders go to the administrator and the assignees one week out. ' + (NOTIFY_ENDPOINT ? 'Dispatching to the configured service.' : 'The dispatch service is not yet wired \u2013 notifications queue here until the dev team connects AWS.') + '</p>' + (rows || '<p class="t-faint-sm">\u2014</p>'), 'margin-bottom:16px')
}
