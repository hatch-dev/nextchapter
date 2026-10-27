# AI Innovation Pipeline — API

A small, modular PHP + MySQL backend. Each concern lives in its own layer so new
features slot in without touching existing code.

```
api/
├── index.php              # front controller — the only entry point
├── .htaccess              # routes all requests to index.php
├── config/
│   ├── config.php         # app settings (debug, CORS, hashing cost)
│   └── database.php       # DB credentials (env-overridable)
├── core/                  # framework plumbing
│   ├── Database.php       # shared PDO connection (prepared statements)
│   ├── Router.php         # method+path -> controller
│   ├── Controller.php     # base controller (reads JSON body)
│   ├── Model.php          # base model (select/execute helpers)
│   └── Response.php       # uniform JSON envelope
├── controllers/
│   └── SetupController.php # org + first-user setup
├── models/
│   ├── Organization.php
│   └── User.php
├── validation/
│   └── Validator.php      # declarative, rule-based validation
├── helpers/
│   └── functions.php      # env(), config(), public_id(), initials_from()
├── routes/
│   └── api.php            # ONE place to register endpoints
└── sql/
    └── schema.sql         # database + tables
```

## Setup

1. Start Apache + MySQL in XAMPP.
2. Create the schema:
   ```
   C:\xampp\mysql\bin\mysql.exe -u root < api/sql/schema.sql
   ```
   (or paste `sql/schema.sql` into phpMyAdmin).
3. Confirm DB credentials in `config/database.php` (XAMPP default: `root` / empty).

## Endpoint

### `POST /pipeline/enterprises/api/setup`

Creates an organization and its first administrator in one transaction.

Request body (JSON):
```json
{
  "organization_name": "Acme Manufacturing",
  "name": "Maria Torres",
  "username": "maria",
  "pin": "1234"
}
```

Success — `201`:
```json
{
  "success": true,
  "data": {
    "organization": { "id": "org_ab12cd34ef56", "name": "Acme Manufacturing" },
    "user": { "id": "usr_9f8e7d6c5b4a", "name": "Maria Torres",
              "username": "maria", "role": "Administrator" }
  }
}
```

Validation failure — `422`:
```json
{
  "success": false,
  "message": "The submitted data was invalid.",
  "errors": { "username": ["That username is already taken. Please choose another."] }
}
```

### `POST /pipeline/enterprises/api/session`

Verifies a username + PIN against the database (bcrypt `password_verify`).

The username is the whole identity: it is unique across the installation
(`uq_user_username`), enforced at sign-up and wherever a member is added or
renamed, so this is a lookup rather than a search. An `organization` or
`account_type` in the body is accepted and ignored — older clients still send
them.

Request body (JSON):
```json
{ "username": "maria", "pin": "1234" }
```

Success — `200`:
```json
{
  "success": true,
  "data": {
    "user": { "id": "usr_9f8e7d6c5b4a", "name": "Maria Torres",
              "username": "maria", "role": "Administrator", "is_admin": true },
    "organization": { "id": "org_ab12cd34ef56", "name": "Acme Manufacturing" }
  }
}
```

Failure — `401` (`reason` is `no-user`, `ambiguous-user` or `bad-pin`).
`ambiguous-user` means two accounts hold that username — only possible in a
database that predates `uq_user_username`, and refused rather than guessed at:
```json
{ "success": false, "message": "Incorrect PIN.", "reason": "bad-pin" }
```

### `GET|POST /pipeline/enterprises/api/admin-session` and `POST /admin-passcode`

The app-admin passcode that unlocks the admin console (one hashed passcode for
the whole app).

- `GET /admin-session` → `{ "success": true, "data": { "exists": true|false } }`
  — drives the "Set up admin access" vs "Admin sign in" label.
- `POST /admin-session` with `{ "passcode": "…" }`:
  - first use (none set) → sets it (min 4 chars) → `{ "data": { "first": true } }`;
    too short → `422 { "reason": "weak", "first": true }`.
  - later uses → verifies → `{ "data": { "first": false } }`, or
    `401 { "reason": "bad-pin" }`.
- `POST /admin-passcode` with `{ "passcode": "…", "current_passcode": "…" }` →
  changes it → `{ "data": { "updated": true } }`. **The current passcode is
  required**; a wrong or missing one is `403 bad-current`. It was not, and that
  made this the widest hole in the API: one unauthenticated POST reset the
  credential that unlocks every organization in the database.

### Application access — `GET /access`, `POST /access/org`, `POST /access/user`

Which programs an organization holds, and which of those each member may open.
Two tables, two owners, one intersection — see `Models\Access` and
`docs/roles-and-modules.md` §4.

- `GET /access?org=<public_id>` → `{ "data": { "organization", "available",
  "modules", "members": [ { id, name, username, is_admin, modules } ] } }`.
  `available` is everything the account's role space contains; `modules` is what
  it actually holds.
- `POST /access/org` — **Super Admin only** (`passcode` re-verified per request):
  ```json
  { "id": "org_ab12…", "modules": ["pipeline", "exec-readiness"], "passcode": "…" }
  ```
  → `200 { "data": { "id", "modules", "members": { "usr_…": [ … ] } } }`. Clamped
  to the account's role space. Revoking here takes the program from every member
  at once; their individual grants survive, inert, so re-granting restores
  exactly who had it.
- `POST /access/user` — the Org Admin (`actor_id`) or the Super Admin
  (`passcode`): `{ "id": "usr_…", "modules": [ … ], "actor_id": "usr_…" }` →
  `200 { "data": { "id", "modules" } }`. **Clamped to the organization's
  entitlement**, so an admin can never hand out a program the organization does
  not have; the response is what was stored, not what was asked for.
- `GET /access/mail?passcode=…[&id=mail_…]` — **Super Admin only.** The invite
  outbox: every access email the app has tried to send and what became of it.
  The list omits message bodies on purpose (they carry credentials); ask for one
  by `id` to read it.

Every per-program endpoint — `/workspace`, `/workspace/answers`, `/assignments`,
`/notes`, `/messages` — resolves its module through the same gate
(`Core\Controller::moduleFrom`) and refuses with `403 org-entitlement` or
`403 user-grant`.

### Team members — `POST /users`, `POST /users/update`, `POST /users/delete`

The org administrator manages team members. Members are rows in `users` linked
to their organization; a member may have no username yet (stored NULL). PINs are
hashed.

- `POST /users` — add a member:
  ```json
  { "organization_id": "org_ab12…", "name": "John Smith", "username": "john",
    "role": "Analyst", "scope": "Ops", "email": "john@acme.com",
    "department": "Strategy", "passcode": "5678",
    "modules": ["pipeline"] }
  ```
  → `201 { "data": { "id": "usr_…", "modules": [ … ], "invite": { … } } }`.
  Unknown org → `404 no-org`; bad email → `422`.

  **Username and email must be unique across the whole installation**, not just
  within the organization — sign-in is by username alone, and the address is
  where the invitation and every later notification are sent. A collision is
  `422` against the offending field, and both are reported at once when both
  collide. `uq_user_username` / `uq_user_email` stand behind the checks; see
  `api/sql/global-unique-login.sql` to migrate an existing database.

  `modules` is the member's program access, clamped to the organization's own
  entitlement — the response echoes what was **stored**, not what was asked for.

  `invite` reports the access email this triggers (`status`: `sent` |
  `no-transport` | `send-failed` | `no-address`). Creating the member never
  fails because mail did: the message is recorded in `mail_outbox` first and the
  admin is told the truth about it. See `Core\MemberInvite`.
- `POST /users/update` — same fields plus `"id": "usr_…"` → `200`.
  A `modules` key is **honoured only from an org admin** — this endpoint is also
  reachable by a member editing their own profile, and without that rule anyone
  could grant themselves every program by adding one field to their own save.
  Omitting `modules` leaves the grant untouched.
- `POST /users/delete` — `{ "id": "usr_…" }` → `200 { "data": { "deleted": true } }`.

### Organization details — `POST /organizations/update`

Saves an organization's profile. All fields required (same contract as members).

```json
{ "id": "org_ab12…", "name": "Acme Manufacturing", "industry": "Industrial / Pharma",
  "company_size": "51–200", "region": "Boston, USA", "website": "acme.com",
  "ai_maturity": "Piloting", "executive_sponsor": "Jane CFO",
  "objective": "Stand up an AI pipeline in 90 days." }
```
→ `200 { "data": { "id": "org_…" } }`. Unknown org → `404 no-org`; any empty field
or a bad website → `422` with per-field errors.

### Team chat — `GET /messages`, `POST /messages`

Multi-user chat, **one room per (organization, program)**. Any member of the
organization who has been granted that program may read and post. It used to be
one room per organization, which made chat the loudest leak between programs in
the suite — a message sent while working in Executive Readiness appeared in the
Pipeline. Reading now requires membership too, as posting always did.

- `GET /messages?org=<public_id>&module=<id>&actor=<usr_…>&since=<id>` →
  `{ "data": { "module", "messages": [ … ] } }` (newest 100; pass `since` to
  fetch only newer than that id).
- `POST /messages` with `{ "org": "org_…", "module": "pipeline",
  "actor_id": "usr_…", "body": "hi" }`
  → `201 { "data": { "message": { id, module, user_name, initials, color, body, created_at } } }`.
  Non-member actor → `403`; empty/too-long body → `422`.

**Real-time delivery** is handled by a separate dependency-free Node WebSocket
relay, `../chat-server.js`:

```
node chat-server.js        # listens on ws://localhost:8090
```

It only fans messages out live to other clients in the same room; the DB is the
source of truth (via `POST /messages`). If the relay isn't running, the app falls
back to a 4-second poll of `GET /messages`, so chat still works — just not
instantly.

The relay rooms purely on the `org` parameter it is handed, so the client sends
`<org>::<module>` as that value (`chatConnect`, `js/features/chat.js`). Without
it the live fan-out would deliver a Decision Lab message into a Pipeline window —
the isolation the database has, undone by the socket that goes around it.

## Adding a new endpoint

1. Add a model in `models/` (extend `Core\Model`).
2. Add a controller in `controllers/` (extend `Core\Controller`).
3. Register the route in `routes/api.php`.

Nothing else changes — the router, autoloader, and front controller stay untouched.

## Security notes

- **Prepared statements everywhere** — user input is never concatenated into SQL.
- **PINs are hashed** with `password_hash()` (bcrypt) and only checked with
  `password_verify()`; the plain PIN is never stored.
- **Validation** runs before any DB work; a DB unique-key race is still caught.
- **Transactions** guarantee an org, its owner and their entitlement are created
  together or not at all — an account that exists but holds nothing can open no
  program.
- **Tenancy is enforced, not assumed.** Every org-scoped endpoint resolves an
  actor through `Controller::requireOrgMember()`. Before this, reads took an
  organization's public id and nothing else, so holding one was the same as
  being in that organization.
- **Program access is an intersection**, computed only in `Models\Access`, so
  revoking at the organization level cannot be undone by a stale user grant.
- **Grant writes replace the whole set** rather than adding/removing one at a
  time: the two-request shape loses a revocation whenever the second request
  fails, and a lost revocation is an access-control bug.
- Errors return a generic message; details appear only when `config.debug` is on.

**The standing caveat:** `actor_id` is client-supplied. Everything above is
defence in depth behind the app's own UI, not a substitute for real sessions —
see the note in `Core\Controller` and `docs/roles-and-modules.md` §7.
