# Email notifications

Two emails leave the programs on their own, without anybody pressing send:

| Kind | When | To |
|---|---|---|
| `step-complete` | a step is marked complete for the first time | everyone on the roster with an email address |
| `deadline-reminder` | a step is due within seven days, is not complete, and has at least one assignee | the administrators, plus the people assigned to it |

The completion email carries the Module Management analytics page as a PDF
attachment. The reminder is a short notice with no attachment.

This is **not** the same path as invites and assignment notices. Those are
composed on the server by `Core\MemberInvite` and `Core\AssignmentNotice` and
are triggered by a write to the database. These two are decided in the
**browser**, by the running program, and posted to a service. Both ends happen
to be in this repository now, but they are two ends: see "Why it is shaped like
this" below.

The contract is `reference/Directive_Activate_Email_Notifications.md`
(3 September 2026). Everything here implements it.

---

## The two halves

```
 BROWSER                                    SERVER
 js/features/email.js                       api/controllers/NotifyController.php
 ────────────────────                       ──────────────────────────────────
 notifyStepComplete(id)  ┐                  validate the eight fields
 notifySweepDeadlines()  ├→ notifyQueue()   ↓
                         │        ↓         Core\NotificationMail::deliver()
                         │  notifyDispatch()   ├→ Core\Pdf   (headless Chrome)
                         │        │            └→ Core\Mailer (SMTP + attachment)
                         │        └── POST ────→ ↓
                         └─ data.notifications   mail_outbox
                            (the local record)   (the server record)
```

The app records every notification it raises in `data.notifications` (the last
fifty) with a status of `sending` → `sent` / `failed (…)`, or
`pending – endpoint not configured` when the service is switched off. The
server records every message it actually tried to send in `mail_outbox`,
readable in the Super Admin console (`GET /access/mail`).

Both records exist because they answer different questions: the app's says
"did the browser get an answer", the server's says "did a mail server take it".

---

## Switching it on and off

One constant, in `js/features/email.js`:

```js
var NOTIFY_ENDPOINT = 'api/notify?k=<NOTIFY_KEY>';
```

Blank it and the whole component goes inert again — nothing is sent, every
notification still records locally as `pending – endpoint not configured`. That
is the state it shipped in from July until 11 September 2026.

The server half needs `NOTIFY_KEY` in `apps/.env`, and the two must match.
**With no `NOTIFY_KEY` the endpoint answers 503 and sends nothing.** It is never
open: an endpoint that mails arbitrary HTML to arbitrary addresses with no
credential is an open relay, and the app cannot send a credential any other way
(see below).

`GET /notify?k=…` reports what the deployment can actually do — whether SMTP is
configured and whether a browser was found for the PDF. Three different
failures all look like "no email arrived", so ask it first.

---

## Why it is shaped like this

Each of these is a constraint from the directive rather than a preference, and
each one is the reason something looks odd.

**The program is named in the URL, not in the body.** Part 6 forbids changing
the JSON fields, and the eight fields do not say which program sent them. Part 3
point 3 prescribes the alternative, so `NOTIFY_ENDPOINT` is a *base* and
`notifyEndpoint()` appends the program: `api/notify` → `api/notify/pipeline`.
The names come from `NOTIFY_PATHS`, deliberately separate from the module id so
the service can rename one without touching dispatch. It is resolved at
**dispatch** time, not at load: one browser session can switch programs without
reloading, and a URL captured at load would post the next program's
notifications to the previous one's path.

**One component, not one per app.** The directive assumes each app file carries
its own copy of the nine `notify*` functions. Here they live once, in
`js/features/email.js`, and all twelve programs run it — so there is one
constant, not four, and a correction to the shell fixes every program at once.
The standalone reference builds under `enterprises/dev/` still carry their own
copies; nothing ships from them and they remain switched off.

**The key is in the query string.** The app sends no authentication header and
no API key — Part 3 point 1 — and names the URL as the place a key may live.
So `notifyEndpoint()` splices the program into the *path*, ahead of the query;
appending to the whole string would produce `…/notify?k=KEY/pipeline`, which is
a perfectly well-formed URL that posts every program to the base under a key
that no longer matches.

**A 2xx means accepted, not delivered.** The app treats any 2xx as `sent` and
never retries (Part 3 point 5). So the endpoint answers 2xx as soon as the
messages are queued — queued is the promise the server can keep — and what
happened to each one is in the response body and in `mail_outbox`. A refused
mailbox must not come back as an error the app files as a network failure and
forgets.

**Nothing is allowed to break the app.** A dead service, a bad URL, a 500: the
app records the failure, shows the user nothing, and carries on (Part 5,
test 5). On the server, a missing browser or a failed render does not stop the
email — it goes without the attachment and says so.

---

## The PDF

`Core\Pdf` shells out to the Chrome already on the machine
(`--headless --print-to-pdf`). Part 3 requires the report to be rendered "using
the app's stylesheet", and that stylesheet is 440KB of custom properties, grid
and container queries; the PHP libraries that render without a browser engine
support roughly none of it and would produce a valid PDF that looks nothing
like the page the email promises.

The document it builds mirrors the app's own export path (`printPage()` in
`js/app.js`) — `is-printing` on the root, content inside `#pdfPrintRoot`,
`data-app` set so the program's palette applies — so the attachment renders
through the same rules as the in-app **Download as PDF** button rather than
through a second, nearly-matching set. The one deliberate difference is the
tab: the in-app button exports whichever tab is open, the email always forces
analytics, because the subject line promises the analytics report (Part 4,
correction A). It prints light by default; the app defaults to dark, which is
the wrong choice for something that may be printed. `NOTIFY_PDF_THEME=dark`
matches the screen.

Chrome is looked for in the usual places on Windows, Linux and macOS.
`CHROME_BIN` names it when it is somewhere else. It runs against its own
throwaway profile directory — without that, a headless run collides with the
copy of Chrome the developer has open and exits having rendered nothing, which
is the most confusing way for this to fail, because the command looks right.

Budget roughly 3 seconds for the render and a second or two per recipient for
SMTP. The endpoint raises its own time limit to 180s for that reason.

---

## What the app sends

Exactly these eight fields, and Part 6 keeps it that way:

```json
{
  "kind":    "step-complete" | "deadline-reminder",
  "subject": "Step 2.7 – Sovereignty Planning complete – analytics report",
  "to":      ["someone@example.com"],
  "stepId":  "2.7",
  "orgName": "Aurora Glass",
  "sentAt":  "2026-09-11T13:05:00.000Z",
  "pdf":     true,
  "html":    "<h2>…</h2><p>…</p><hr/><div class=\"card\">…the analytics page…</div>"
}
```

`orgName` is the only identifier of the organization there is, so
`NotificationMail` resolves it through `Organization::resolve()` to file the
outbox row. A blank, unknown or ambiguous name means the row is not filed under
an organization — never that the mail stops.

For a completion, `html` is a short notice, then `<hr/>`, then the whole
analytics page. The service splits on that first `<hr/>`: the notice becomes the
email body (restyled into the same house chrome as every other message the
suite sends, because no stylesheet is ever loaded in an inbox) and the page
behind it becomes the PDF. Mailing the page itself as the body would put 200KB
of app markup into a client that has none of the app's CSS.

The notice is sanitized before it goes into the body — a small tag set, every
attribute removed. It arrived over an unauthenticated POST and is about to be
put in front of people in their mail client.

---

## Who counts as an administrator

`notifyAdmins()` — the flag on the roster record, **or** a role text containing
"admin" in any case. Part 4 correction B of the directive, which supersedes a
July 9 ruling that the flag was the only authority record. The flag stays in
the test so the organization's creator never drops off reminders.

Worth knowing before someone is surprised by it: a role like "Domain
Administrator" or "sysadmin" now receives deadline reminders.

---

## Testing without sending anything

`tools/notify-sink.js` is a stand-in for the service — it answers the way the
directive says a service must, prints every request, and writes each body's
`html` to `tools/_notify-out/` so the completion report can be opened in a
browser. Point `NOTIFY_ENDPOINT` at it to exercise the request, the pre-flight,
the per-program path and the email HTML without a mailbox anywhere in it.

```
node tools/notify-sink.js
```

then, in the browser console, `NOTIFY_ENDPOINT = 'http://localhost:4599/notify'`.

The app half is pinned by the `NOTIFY:` block in `tools/_unused/harness.js`
(`node tools/_unused/harness.js`).

---

## Part 5 acceptance tests, by hand

The directive's five tests, as they run against this deployment. Do all five
before calling a program done. Where the app is concerned they are identical
for all three live programs — one component serves them all — but the URL path
differs, so run test 1 once per program.

### Before you start

1. `GET http://localhost/apps/api/notify?k=<NOTIFY_KEY>` in a browser tab.
   It must answer `mail.configured: true` and `pdf.available: true`. If either
   is false, fix that first — every one of the tests below fails as "no email
   arrived" and none of them will tell you which of the two it was.
2. Sign into a program and open **More → Organization & Team**. Give at least
   two roster members real addresses you can read. One of them must count as an
   administrator — either the admin flag, or a role containing the word "admin".
3. Hard-reload with the cache cleared (Ctrl+Shift+R), so the new
   `js/features/email.js` is the one running.

### Test 1 — the request reaches the service

Open DevTools (F12) → Network. Mark any not-yet-complete step complete.

- A `POST` to `api/notify/<program>?k=…` appears, status **200**.
- Its response body reads `"accepted":true` with `"sent":` equal to the number
  of addresses on the roster.

If it shows as blocked or failed with a CORS error in the Console, the service's
headers are wrong — but note that on this install the app and the API are the
same origin, so no pre-flight is sent at all. To exercise CORS properly, point
`NOTIFY_ENDPOINT` at the absolute URL of a different host.

### Test 2 — the completion email arrives, with the PDF

Within a minute or two each of those addresses has an email subject
"Step N.N – <name> complete – analytics report", with a PDF attached.

- Open the PDF. It must show the **analytics** page, correctly styled.
- Before marking the step, switch the Module Management hub to a tab that is
  **not** analytics. The PDF must still show analytics — that is correction A.
- If the PDF is missing entirely, the response body says why in its `pdf` field
  (`failed: no browser found`, `failed: the browser did not finish…`).
- If the PDF is unstyled, `assets/css/styles.css` was not readable by PHP.

### Test 3 — completing the same step again sends nothing

Un-complete the step, then complete it again. No new POST in the Network tab
and no new email: `stampStepDone()` only fires on the first stamp.

### Test 4 — a deadline reminder arrives, once

In the Module Management hub, assign a step to a roster member and give it a due
date within the next seven days (today counts). Reload.

- One `POST` with `"kind":"deadline-reminder"`, and an email subject
  "Step N.N – <name> due <date>" reaching the administrator and the assignee.
- Reload again: **no** second POST and no second email.
- Repeat with a member whose role text contains "admin" but whose admin flag is
  not set. They must receive it — that is correction B.

### Test 5 — a bad URL does not break the app

In the DevTools console: `NOTIFY_ENDPOINT = 'https://no-such-host.invalid/notify'`,
then mark a step complete. The app must carry on normally — no error shown, no
frozen page. Then reload to restore the real value.

### Reading the app's own record

In the console, `data.notifications` is the last fifty, each with a `status`:

| status | meaning |
|---|---|
| `sent` | the service answered 2xx |
| `failed (404)`, `failed (401)` | it answered, badly — wrong path, or a key that does not match `NOTIFY_KEY` |
| `failed (network)` | nothing answered at all — service down, or CORS |
| `pending – endpoint not configured` | `NOTIFY_ENDPOINT` is blank. If you see this after deploying, the old file is still cached: hard-reload |

And on the server, `mail_outbox` holds one row per recipient per notification,
with `kind` of `notify-step-complete` or `notify-deadline-reminder` and the
SMTP error on anything that failed.
