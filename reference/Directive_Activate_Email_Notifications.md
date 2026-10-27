# Directive: Activate Email Notifications in Every App

**To:** the development team
**From:** Paul Scade
**Date:** 3 September 2026
**Applies to:** every learning module app that contains the email notification code (Part 2, step 1, explains how to check)

---

## Part 1 — What this directive asks you to do

Each app already contains a complete email notification component. It was built in July and has been switched off since then, waiting for the AWS notification service. You have now built that service. This directive asks you to do two things:

1. Apply the code corrections in Part 4: correction A to the Innovation Pipeline, and correction B to both the Innovation Pipeline and Executive Readiness.
2. Switch the component on in every app, one app at a time, and confirm that emails arrive (Parts 2, 3, and 5).

Switching it on is one change per app: setting one constant to the service URL. Everything else is already written. Apart from the corrections in Part 4, do not change anything else in any app.

---

## Part 2 — Steps, for each app

Do these steps for one app, confirm the tests in Part 5 pass, and then move to the next app.

### Step 1. Find the constant

Open the app's main JavaScript file (for example `Architecture-app.js`, `Governance-app.js`, `Exec-Readiness-app.js`, or the Innovation Pipeline's `app.js`). Search for this exact line:

```
var NOTIFY_ENDPOINT='';
```

It should appear **exactly once**. In the four apps checked on 3 September 2026 (Architecture, Governance, Executive Readiness, Innovation Pipeline) it does.

- If it does not appear at all, that app has no notification component. There is nothing to switch on; note the app name in your own records and move to the next app.
- If it appears more than once, the file carries a duplicate copy of the notification code. Find the duplicate copy (it will start with the same line and contain the same nine `notify...` functions), remove it so that exactly one copy remains, confirm the app still loads and runs, and then continue.

### Step 2. Set the URL

Change the line to hold the full HTTPS URL of the notification service. For example:

```
var NOTIFY_ENDPOINT='https://YOUR-SERVICE-URL/notify';
```

Rules for the URL:

- It must start with `https://`. The apps run in the browser, and browsers block a page served over HTTPS from calling a service over plain HTTP.
- Use the URL for that app. Part 3, point 3, explains why each app may need its own URL.
- Change nothing else on that line and nothing else in the file, apart from the corrections in Part 4 where they apply.

### Step 3. Deploy the app

Deploy the changed app file in the normal way. Then open the app in a browser and reload with the cache cleared (Ctrl+Shift+R, or Cmd+Shift+R on a Mac), so the new file is loaded.

### Step 4. Run the tests in Part 5

Do all five tests. Only when all five pass for one app should you move to the next app.

---

## Part 3 — What the app sends, and what the service must do

This section describes what the app already does. Your service must match it. Where the service does not yet match, change the service. Do not change what the app sends.

### 1. The request

When a notification is due, the app sends one HTTP request:

- Method: `POST`
- Header: `Content-Type: application/json`
- Body: a JSON object with these fields, and only these fields:

```
{
  "kind":    "step-complete" or "deadline-reminder",
  "subject": text for the email subject line,
  "to":      a list of email addresses (strings),
  "stepId":  the step number, for example "2.7",
  "orgName": the organization's name as entered in the app, or an empty string,
  "sentAt":  the time the notification was created, as an ISO 8601 string,
  "pdf":     true or false,
  "html":    the email body as HTML
}
```

The app sends **no authentication header** and **no API key**. If your service needs a key, carry it in the URL itself, as part of the path or the query string, and set that full URL in Step 2.

### 2. The response

The service must answer with an HTTP status in the 200–299 range when it has accepted the notification. The app records the notification as sent when it sees a 2xx status, as failed with the status number otherwise, and as failed (network) if no response comes back.

Because the request comes from a web page, the service must send the correct **CORS headers**:

- `Access-Control-Allow-Origin` must include the domain each app is served from, or be `*`.
- `Access-Control-Allow-Methods` must include `POST`.
- `Access-Control-Allow-Headers` must include `Content-Type`.
- The service must answer the browser's `OPTIONS` pre-flight request with those headers and a 2xx status.

If the CORS headers are wrong, the browser blocks the request, the app records every notification as failed (network), and no email is sent. This is the most common reason for this kind of integration to fail silently, so test it first (Part 5, test 1).

### 3. One URL for all apps, or one per app

The request body does **not** name the app it came from. It carries the step number and the step name in the subject line (for example "Step 2.7 – Sovereignty Planning complete – analytics report"), and the organization's name, but nothing that says which app sent it.

If your service needs to know which app sent a notification, for example to choose a template, a sender address, or a log, give each app its own URL by adding the app name to the path (for example `.../notify/architecture`, `.../notify/governance`). Then set that app's URL in Step 2. If the service does not need to know, one URL for every app is fine. Decide which you need and apply it consistently.

### 4. The two kinds of notification

**Kind `step-complete`.** Sent when a user marks a step complete for the first time. It is not sent again if the same step is marked complete a second time.

- `to`: every member of the organization's roster who has a valid email address, which is the whole team.
- `subject`: the step number and name, followed by "complete – analytics report".
- `pdf`: `true`. The `html` field contains a short completion notice followed by the app's full Module Management analytics page. Your service must convert that HTML to a PDF, using the app's stylesheet so it renders correctly, and attach the PDF to the email.

**Kind `deadline-reminder`.** Sent once for a step that has a due date within the next seven days, is not yet complete, and has at least one person assigned to it. It is never sent for a step nobody is assigned to. It is sent at most once per step.

- `to`: every roster member who counts as an administrator, plus the people assigned to the step. A roster member counts as an administrator if the administrator flag is set on their record, **or** if their role text contains the word “admin” in any combination of upper and lower case (for example “Program Administrator”). Part 4, correction B, makes every app apply this rule.
- `subject`: the step number and name, followed by "due" and the date.
- `pdf`: `false`. The `html` field is a short notice only. No attachment.

If the roster has no administrator, the reminder goes to the assignees alone.

### 5. What the app does while the service is down

If the service does not respond, or responds with an error, the app records the failure and carries on working. It does not retry. It does not show the user an error. The record of every notification, sent or failed, is kept inside the app's saved data (the last fifty), and can be inspected as described in Part 5.

---

## Part 4 — Code corrections before switching on

Make these corrections first, then switch each app on as in Part 2. Each correction replaces exactly one line. Copy the replacement line exactly as printed; do not retype it.

### Correction A — Innovation Pipeline (`app.js`): the completion email must always carry the analytics page

The Module Management hub in this app has tabs. The completion email is built from that hub, and in this app it is built from whatever tab the user last had open. In the other apps the email always forces the analytics tab first. Make the Pipeline do the same.

Find this exact line (it appears once, inside the function `notifyEmailHtml`):

```
return n.kind==='step-complete'?head+'<hr/>'+mgmtHubContent():head}
```

Replace it with this exact line:

```
return n.kind==='step-complete'?head+'<hr/>'+(function(){var _t=UI.mgTab;UI.mgTab=1;var hub=mgmtHubContent();UI.mgTab=_t;return hub;})():head} /* the completion email always embeds the analytics tab */
```

This is the same line the Governance and Executive Readiness apps already carry. It sets the hub to the analytics tab while the email body is built, then puts the tab back as it was. After the change, open the app, go to the Module Management hub, switch to a tab that is not analytics, mark a step complete, and confirm (Part 5, test 2) that the PDF shows the analytics page.

### Correction B — Innovation Pipeline (`app.js`) and Executive Readiness (`Exec-Readiness-app.js`): who counts as an administrator

The Governance app decides who receives deadline reminders as an administrator by two tests: the administrator flag on the roster record, or a role text containing the word “admin”. The Architecture app has already been changed to match. The Innovation Pipeline and Executive Readiness still use the flag alone. Bring both into line.

In **each** of the two files, find this exact line (it appears once in each):

```
function notifyAdmins(){return (USERS||[]).filter(function(u){return u&&u.admin===true})} /* flag-based (ruled July 9): role text is a label, admin:true is the authority record */
```

Replace it with this exact line:

```
function notifyAdmins(){return (USERS||[]).filter(function(u){return u&&(u.admin===true||/admin/i.test(u.role||''))})} /* the administrator flag, or a role containing “admin”, counts; the flag stays so the organization’s creator never drops off reminders */
```

After the change, confirm with Part 5, test 4, using a roster member whose role text contains “admin” but whose administrator flag is not set: that member must receive the reminder.

---

## Part 5 — Acceptance tests, per app

Run all five tests on each app after switching it on. A test passes only if every point in it is true. Where a test fails, find the cause and fix it, then run the test again; the notes under each test say where to look first.

**Test 1 — the request reaches the service.**
Open the app in a browser. Open the browser's developer tools (F12) and go to the Network tab. In the app, mark any step complete. In the Network tab you should see a `POST` request to your service URL with status 200 (or another 2xx). If you see a CORS error in the Console tab, or the request shows as blocked or failed, the service's CORS headers are wrong (Part 3, point 2). Fix the service and repeat.

**Test 2 — a step-completion email arrives, with the PDF.**
Give at least two roster members real email addresses you can read. Mark a step complete that has not been completed before. Within a few minutes, every one of those addresses should receive an email whose subject is the step number and name followed by "complete – analytics report", with a PDF attached. Open the PDF and confirm it shows the analytics page, correctly styled. If the PDF shows a different page of the hub, the app needs Part 4, correction A. If the PDF is unstyled, the service is not applying the app's stylesheet when it converts the HTML.

**Test 3 — completing the same step again sends nothing.**
Mark the same step as not complete, then complete again. No new request should appear in the Network tab, and no new email should arrive.

**Test 4 — a deadline reminder arrives, once.**
In the app, assign a step to one roster member and give it a due date within the next seven days (today counts). Make sure one roster member counts as an administrator, either by the administrator flag or by a role containing the word “admin”. Reload the app. A `deadline-reminder` request should be sent, and an email whose subject is the step number and name followed by "due" and the date should arrive at the administrator and the assignee. Reload the app again. No second request and no second email.

**Test 5 — a bad URL does not break the app.**
Temporarily set the constant to a URL that does not exist, deploy, reload, and mark a step complete. The app must keep working normally: no error shown to the user, no frozen page. Then set the constant back to the correct URL and deploy again.

To inspect the app's own record of notifications for any of these tests: in the developer tools Console, the app's saved data includes a list named `notifications`. Each entry has a `status` of `sent`, `failed (…)`, or `pending – endpoint not configured`. If you see `pending – endpoint not configured` after deploying, the new file has not been loaded; clear the cache and reload.

---

## Part 6 — What not to do

- Do not change the JSON fields the app sends, their names, or the order in which things happen.
- Do not add headers, keys, or retries in the app. Anything the service needs beyond what the app sends is handled on the service side.
- Apart from the corrections in Part 4, do not remove, move, or edit any other line in any app file.
- Do not turn on the "Email Notifications" panel inside the app. It exists in the code but is intentionally hidden. Leave it hidden.
