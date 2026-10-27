# AI Innovation Pipeline — Architecture (Frontend + Backend)

A full technical overview of the 90‑Day AI Innovation Pipeline app: what it's
built from, how the frontend and backend are organized, how they talk to each
other, and where data lives.

For the Pipeline workflow specifically (phases, steps, gates, outputs), see
[pipeline.md](pipeline.md). This document is the whole‑system view.

---

## 1. What it is

A single‑page web app that walks an organization through a 90‑day program to
build an "AI innovation pipeline". A team signs in, works through five phases of
guided steps, and the app tracks progress, portfolio, capital, and outputs.

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (no framework, no build step for logic), HTML partials, one CSS file |
| Backend | PHP 8 (small hand‑rolled MVC), served by Apache (XAMPP) |
| Database | MySQL / MariaDB (PDO, prepared statements) |
| Real‑time | Dependency‑free Node WebSocket relay (`tools/chat-server.js`) for Team Chat |
| Hosting (dev) | XAMPP — `http://localhost/pipeline/enterprises/` |

There is **no bundler/transpiler** for the app logic. JS files are plain global
`<script>`s loaded in order; the only "build" step regenerates a template
bundle (see §9).

---

## 2. Repository layout

> **2026-07-30 — this app moved to `htdocs/apps` and grew two roles.** The one
> `index.html` at `?module=<id>` became a PHP front controller serving
> `/apps/{role}/{program}` — twelve programs across two role spaces, one login.
> Read **[roles-and-modules.md](roles-and-modules.md)** first. The layout, boot
> sequence and cache-busting notes below are annotated where they changed;
> everything else in this document still holds.

```
apps/
├── index.php                   # front controller: URL → role + module
├── shell.html                  # the SPA markup index.php renders (never served raw)
├── config/catalogue.json       # THE definition of the roles and their modules
├── api/                        # PHP + MySQL backend (see §4)
├── assets/
│   ├── css/styles.css          # the one stylesheet
│   └── media/*.mp4, *.jpg       # phase/intro videos + posters
├── js/
│   ├── app.js                  # CORE: boot, state, go()/render(), Store/Auth/Collab seams, PH data
│   ├── screen-loader.js        # shared template-fetch + mount plumbing for screens
│   ├── templates-local.js      # generated bundle of the HTML partials (for file:// + first paint)
│   ├── home.js · learn.js · insights.js · auth.js · nav.js   # screen modules
│   ├── features/               # extracted feature modules (see §3.6)
│   │   ├── notes.js · help.js · coach.js · chat.js · email.js
│   │   ├── sidebar.js · charts.js · budget.js · org-admin.js
│   │   ├── assignments.js · voice.js
│   ├── steps/                  # pipeline step bodies
│   │   └── phase1.js · phase2.js · phase3.js · phase4.js
│   ├── pages/
│   │   └── navigate.js         # Navigate dashboard + Management/Capital hubs
│   └── dev/
│       └── seed.js             # sample-data seeds (dev/testing)
├── templates/                  # HTML partials for screens (home, learn, insights, login, setup, admin-login, nav)
├── tools/
│   ├── build-templates.js      # regenerates js/templates-local.js from templates/
│   ├── chat-server.js          # Node WebSocket relay for Team Chat
│   └── _unused/                # archived dead files
└── docs/
    ├── architecture.md         # this file
    └── pipeline.md             # the Pipeline workflow in depth
```

> **History:** `app.js` began as an ~8,000‑line monolith. It was decomposed into
> the `screens / features / steps / pages / dev` files above; `app.js` is now the
> ~3,000‑line core. All modules are plain global scripts — see §3.2.

---

## 3. Frontend architecture

### 3.1 Boot sequence
0. `index.php` resolves the URL against `config/catalogue.json` and renders
   `shell.html` with `<base href>`, `window.APP_BOOT` (the resolved role,
   module, page and step) and `window.APP_CATALOGUE` injected at the top of
   `<head>` — so the registry knows which program is running before `boot.js`
   writes its `<script>` tags. See roles-and-modules.md §3.
1. `shell.html` loads `assets/css/styles.css`, then every JS file in a fixed
   order (registry → boot → router → partials bundle → screen-loader → screen
   modules → feature/step/page modules → `app.js` last).
2. `app.js` defines the state, seams, and `render()`, then calls
   `Store.ready(bootApp)`.
3. `bootApp()` restores any remembered/active session (localStorage/sessionStorage),
   loads the org's data, warms notes + assignments, and calls `render()`.
4. `render()` shows the **entry gate** (sign‑in / setup / admin) if nobody is
   signed in, otherwise the app chrome + the current page.

### 3.2 The module system (plain global scripts)
Every JS file is a normal `<script>` — no `import`/`export`, no bundler.
Functions and state attach to the **global scope (`window`)**, so any file can
call any other file's functions by name. This is *why* the monolith could be
split cleanly: moving a group of `function` declarations into a new file loaded
**before** `app.js` changes nothing at runtime (references resolve at call time).

Two kinds of module:
- **Screen modules** (`home.js`, `nav.js`, `auth.js`, …) — use an IIFE and
  expose a small API (`window.renderHome`, `window.Nav`, `window.Entry`). Their
  markup lives in `templates/*.html`.
- **Feature/step/page modules** (`features/*`, `steps/*`, `pages/*`, `dev/*`) —
  plain global scripts (no IIFE); they hold cohesive groups of functions that
  the core and each other call globally. Many still build HTML as strings with
  inline `onclick` handlers, which is exactly why they must stay global.

**Load order matters only for load‑time reads** (a top‑level `var` one file reads
at parse time). Since every module is pure declarations (no work at load), order
among them is free; they all just need to be defined before `bootApp()` runs.

### 3.3 The screen system (`screen-loader.js` + `templates/`)
Post‑login "screens" (Home, Learn, Insights) and the pre‑login entry screens
(Login, Setup, Admin) and the Nav bar keep their **markup in `templates/*.html`**
and their **logic in a JS module**. `Screens.mount(name, container, opts)`:
1. fetches `templates/<name>.html` (cached; falls back to the
   `templates-local.js` bundle on `file://` or first synchronous paint),
2. injects it, wires declarative hooks (`data-nav`, `data-url`),
3. runs the reveal animation and an optional `afterMount` hydrator.

Dynamic screens (login/nav/insights) ship a static skeleton and hydrate values,
errors, badges, and lists in JS — keeping markup free of inline logic.

### 3.4 Rendering & navigation
- **`go(page, step)`** sets `currentPage` / `currentStep` / `currentPhase` and
  re‑renders. It bridges single‑arg calls (`go('1.2')` → step, `go('out-report')`
  → outcome) and maintains a back stack (`UI.navStack`).
- **`render()`** is the master: entry gate → top nav (`Nav.render()`) → dispatch
  on `currentPage` to the right page renderer → sidebar → post‑render passes.
- The whole UI is re‑rendered from state on every change (string‑built HTML
  injected into `#app`). There is no virtual DOM; focus/scroll are preserved
  manually across re‑renders.

### 3.5 State
| Global | What |
|---|---|
| `data` | the entire org workspace (pipeline answers, portfolio, capital, roster, assigns, …). One object; see `emptyData()`. |
| `UI` | ephemeral view state (active section, open panels, modal, zoom, theme, nav stack). Not persisted to the server. |
| `PH`, `MILESTONES`, `PHASE_*` | static pipeline definitions (phases → steps → outputs). |
| `USERS`, `currentOrgId`, `currentUserId`, `isAppAdmin` | the active session/roster. |

### 3.6 The three seams (the integration points)
`app.js` isolates all persistence and identity behind three objects, so the
storage backend can be repointed in one place:

- **`Store`** — all durable reads/writes. `Store.writeOrg/readOrg` persist the
  whole `data` document; `Store.commit(collection[, id])` marks a record dirty
  and flushes. **`Store` is backed by MySQL** via `/workspace`, with localStorage
  as an offline cache (see §6 and [data-persistence.md](data-persistence.md)). It
  also holds device‑local prefs and the two session tiers.
- **`Auth`** — sign‑in. `Auth.signIn` (member), `Auth.signInAdmin` (app admin),
  session get/set. Repointed at the PHP API (§7) with a local fallback.
- **`Collab`** — a live‑collaboration seam: `Collab.lockedByOther(recordKey)`
  guards edits so two users don't clobber the same record.

### 3.7 Feature → file map
| Feature | Module | Server‑backed? |
|---|---|---|
| Home / Learn / Insights | `home.js`/`learn.js`/`insights.js` + `templates/` | static content |
| Sign in / Setup / Admin passcode | `auth.js` + `templates/{login,setup,admin-login}.html` | ✅ `/session`, `/setup`, `/admin-*` |
| Top nav bar | `nav.js` + `templates/nav.html` | — |
| Pipeline step bodies (1.1–4.4) | `steps/phase1–4.js` | via `Store` (local) |
| Navigate dashboard + Mgmt/Cap hubs | `pages/navigate.js` | via `Store` (local) |
| Analytics charts | `features/charts.js` | — |
| Capital/budget/calendar engine | `features/budget.js` | via `Store` (local) |
| Organization + team + admin console | `features/org-admin.js` | ✅ `/organizations`, `/users` |
| **Step assignments** | `features/assignments.js` | ✅ `/assignments` (MySQL) |
| Private notes | `features/notes.js` | ✅ `/notes` (MySQL) |
| Team chat | `features/chat.js` | ✅ `/messages` + WS relay |
| Email notifications | `features/email.js` | ✅ `/notify/{module}` (queued to `mail_outbox`; the analytics report is rebuilt for mail and attached as a PDF) |
| Help / Coach / Voice | `features/{help,coach,voice}.js` | — |
| Sample-data seeds | `dev/seed.js` | local only |

---

## 4. Backend architecture (PHP MVC under `api/`)

A small, hand‑rolled MVC. **One entry point, one route table, thin controllers,
prepared‑statement models, a uniform JSON envelope.** Adding a feature means
adding a controller + model + route — never editing the front controller.

### 4.1 Request lifecycle
```
Apache (.htaccess) ─▶ api/index.php (front controller)
   1. require helpers/functions.php
   2. register PSR-4-ish autoloader (Core\, Controllers\, Models\, Validation\)
   3. error/exception handlers → JSON 500 (never leak raw errors)
   4. CORS + preflight
   5. load routes/api.php  → builds the Router
   6. Router::dispatch(method, path) → [Controller, method]
```

### 4.2 Layers (`api/`)
| Path | Role |
|---|---|
| `index.php` | front controller (only entry point) |
| `.htaccess` | rewrites every request to `index.php` |
| `composer.json` · `vendor/` | the API's ONE third-party dependency: the official Anthropic PHP SDK (plus Guzzle, its HTTP client), used by ClaudeController. `vendor/` is git-ignored — run `composer install` in `api/` after deploying, or `index.php` refuses to start and says so. Everything else here is still hand-rolled and dependency-free. |
| `config/config.php` | debug flag, CORS origins, bcrypt cost |
| `config/claude.php` | the AI Guide's model, effort and API key (read from `apps/.env`). The MODEL is decided here, not by the page. |
| `config/database.php` | DB creds (env‑overridable; XAMPP default root/empty, db `pipeline`) |
| `core/Router.php` | maps `METHOD /path` → `[Controller::class, 'method']` |
| `core/Controller.php` | base: `input()` (JSON body), `requireOrgAdmin()`, `requireOrgAdminOrSelf()` |
| `core/Model.php` | base: `select()`, `selectOne()`, `execute()` — all prepared statements |
| `core/Response.php` | uniform envelope + `success`/`error`/`validationError` |
| `core/Database.php` | shared PDO handle |
| `controllers/*` | Setup, Auth, Admin, User, Organization, Message, Note, Assignment, **Claude** |
| `models/*` | Organization, User, Message, Note, AdminCredential, **Assignment** |
| `validation/Validator.php` | declarative rule‑based validation |
| `helpers/functions.php` | `load_env()` (reads `apps/.env`), `env()`, `config()`, `public_id()`, `initials_from()` |
| `routes/api.php` | the ONE place endpoints are registered |
| `sql/schema.sql` | database + tables (idempotent, `IF NOT EXISTS`) |

### 4.3 Response envelope
Every response is JSON:
```
success →  { "success": true,  "data": { … } }
error   →  { "success": false, "message": "…", "reason"?: "…" }
422     →  { "success": false, "message": "…", "errors": { field: [msg,…] } }
```

### 4.4 Endpoint reference (`api/routes/api.php`)
Base URL: `/pipeline/enterprises/api`

| Method + path | Controller | Purpose |
|---|---|---|
| `POST /setup` | Setup | create org + first admin (one transaction) → 201 |
| `POST /session` | Auth | member sign‑in (organization + username + PIN, bcrypt) |
| `GET /admin-session` | Admin | does an app‑admin passcode exist? |
| `POST /admin-session` | Admin | set‑or‑verify the app‑admin passcode |
| `POST /admin-passcode` | Admin | change the passcode |
| `POST /users` · `/users/update` · `/users/delete` | User | team‑member CRUD (org‑admin only) |
| `GET /organizations` | Organization | all orgs + users (admin console) |
| `GET /organizations/members` | Organization | roster for one org |
| `POST /organizations/update` · `/organizations/delete` | Organization | org details / delete (org‑admin) |
| `GET /messages` · `POST /messages` | Message | team chat history / post (org member) |
| `GET /notes` · `POST /notes` · `POST /notes/delete` | Note | private per‑user notes |
| `GET /assignments` · `POST /assignments` | Assignment | pipeline step assignments (org member) |
| `GET /workspace` · `POST /workspace` | Workspace | **the program state** — fetch / save the org's document (409 on a stale save) |
| `GET /workspace/rev` | Workspace | just the rev — the cheap change poll |
| `GET /workspace/answers` | Workspace | the readable per‑phase Q&A trail (`&phase=N` to filter) |
| `POST /claude` | Claude | **every AI feature in every program** — the AI Guide, The Decision Lab's Challenge card and decision profile, Conscience's profile. The browser cannot call Anthropic directly (no CORS, and the key would ship with the page), so it calls this and the server holds the key. **The one endpoint that does NOT use the envelope on success**: it returns the Messages API response verbatim, because four call sites already read `j.content[i].text` and two of them are generated. Errors do use the envelope. 503 when no `ANTHROPIC_API_KEY` is set. |

---

## 5. Database schema (`api/sql/schema.sql` + `api/sql/workspace.sql`)

Eight tables. IDs are surfaced to the app as stable **`public_id`** strings
(`org_…`, `usr_…`), never the auto‑increment integers.

| Table | Key columns | Notes |
|---|---|---|
| `organizations` | `id`, `public_id` (unique), name + detail cols | one row per workspace |
| `users` | `id`, `public_id` (unique), `organization_id` (FK), `username`, `pin_hash`, `is_admin`, `email`, `department`, `initials`, `color` | PIN stored bcrypt; `username` unique **per organization** (`uq_user_org_username`, NULL allowed) — see `api/sql/org-scoped-login.sql` |
| `messages` | `id`, `organization_id` (FK cascade), `user_public_id`, name/initials/color, `body`, `created_at` | team chat, org‑scoped |
| `notes` | `id`, `user_public_id` (FK cascade), `step`, `body`, `created_at` | private per user |
| `step_assignments` | `id`, `organization_id` (FK), `step_id`, `user_public_id` (FK), unique `(org, step, user)` | who is assigned to each step |
| `app_admin` | `id`, `passcode_hash` | single row: the admin‑console passcode |
| `workspaces` | `id`, `organization_id` (FK, unique), `rev`, `schema_version`, `doc`, `updated_by` | **the program state** — one JSON document per org; `rev` drives optimistic concurrency |
| `step_answers` | `id`, `organization_id` (FK), `phase`, `step_id`, `section`, `question_key`, `question_text`, `answer`, unique `(org, question_key)` | **derived** from `workspaces.doc` on every save; the readable per‑phase Q&A trail |

Relationships: `users.organization_id → organizations.id`;
`messages`/`step_assignments`/`workspaces`/`step_answers.organization_id →
organizations.id` (cascade delete);
`notes`/`step_assignments.user_public_id → users.public_id` (cascade).

The last two live in `api/sql/workspace.sql` — run it after `schema.sql`. See
[data-persistence.md](data-persistence.md).

---

## 6. Persistence & data‑flow — **the important part**

**Everything shared lives in MySQL.** localStorage keeps only what *should*
differ per browser — plus a cache of the workspace so a dropped connection
doesn't blank the app.

| Data | Where it lives | How |
|---|---|---|
| Org registry, users/roster, org details | **MySQL** | `/organizations`, `/users`, `/setup` |
| Team chat | **MySQL** (+ WS relay) | `/messages` |
| Private notes | **MySQL** | `/notes` |
| **Step assignments** | **MySQL** | `/assignments` (mirrored into `data.assigns` locally) |
| App‑admin passcode | **MySQL** | `/admin-*` |
| **The pipeline `data` document** (all step answers, portfolio, capital, tracking, review, …) | **MySQL** `workspaces.doc` | `/workspace` via `Store.writeOrg` / `readOrg` |
| **Per‑phase Q&A trail** (derived, queryable) | **MySQL** `step_answers` | projected server‑side on every save |
| Cached copy of the workspace | localStorage | offline fallback only — **not authoritative** |
| Device prefs (theme, zoom, sidebar) | localStorage | `Store.setPref` |
| "Remember me" (survives browser close) | localStorage | `pipeline-remember` |
| "Stay signed in" (survives refresh) | sessionStorage | `pipeline-session` |

So: **identity, team, chat, notes, assignments _and_ the pipeline working data
are all true multi‑user/multi‑device.** A team sees the same program from any
browser or machine; if the cache and the database disagree, the database wins.

`Store` being the one door for every durable read/write is what made that
migration small — the ~200 call sites still call `Store.commit()` / `saveData()`
and know nothing about the network. Saves are debounced (600 ms) and carry a
`base_rev`, so two people editing at once merge instead of clobbering.

> **→ [data-persistence.md](data-persistence.md)** is the full account: the
> document model, the concurrency rules, the offline path, the question map, and
> **two silent traps** (seeding a workspace on a guess; PHP's assoc decoding
> turning `{}` into `[]`) that will corrupt data if reintroduced. Read it before
> touching `Store` or `WorkspaceController`.

**The local↔server id bridge:** server rows key by `public_id`; the device‑local
`data`/roster key by local ids. Roster members carry a `serverId` (= `public_id`)
stamped at setup and back‑filled on sign‑in. Features like assignments map between
the two on load (public_id → local id) and on write (local id → public_id).

---

## 7. Auth & sessions

- **Every program has its own sign‑in; there is one sign‑up.** Sign‑in is
  `/apps/{role}/{program}/login` — twelve of them — so the address settles the
  role space before the form is drawn and it is not a control on it. Sign‑up is
  `/apps/signup`, once, for all twelve: creating an account chooses an audience
  rather than entering a program, so the form **asks** (Enterprise or Leaders)
  and the answer governs the whole space. The old per‑program `/signup`
  addresses 301 there. There is still no shared `/apps/login` — that one 404s.
  `/apps/signup` and `/apps/admin` are the two entry screens that belong to no
  program, and neither wears a program's palette. See
  `docs/roles-and-modules.md` §5.
- **Enterprise sign‑in:** `Auth.signIn(organization, username, pin, cb)` →
  `POST /session`. The organization comes first and is part of the credential: a
  username identifies a person *inside* a tenant, never across the installation.
  The server resolves the organization (its name, or its `public_id` as a code —
  `Organization::resolve`), looks the member up as `(organization, username)`,
  then verifies the bcrypt PIN. On success the app opens (or hydrates from the
  DB) the local workspace **named by the ids in the response** — it never
  searches for the username itself, which is what used to sign people in as
  another organization's administrator. Network error → device‑local fallback,
  scoped to the same named organization.
- **Leader sign‑in has no organization field**, because a Leader account is one
  person and sign‑up never asks for one. The door sends
  `account_type: leader` and the server resolves the username within the Leader
  accounts (`AuthController::resolveLeader`), a scope `SetupController` keeps
  unique. The role is not a credential and grants nothing — it only says which
  rows to look in, and the PIN is still verified against the row found. Two
  matches would be refused, not guessed between.
- **A remembered session is offered, not entered, at a program's `/login`.**
  Arriving at a sign‑in address is a request to sign in, so boot puts the stored
  record behind a "Continue as …" button (`resumeOffer` / `resumeSession`)
  instead of restoring it silently. At a program's plain URL it still restores
  directly — and a visitor with no session there is sent to that program's
  `/login` rather than shown a form under an address claiming a program.
- **App‑admin:** a separate passcode (`/admin-session`) unlocks a console listing
  every org + user. `isAppAdmin` gates the admin UI.
- **Two session tiers:** sessionStorage (`pipeline-session`, survives refresh,
  cleared on browser close) written on every login/setup; localStorage
  (`pipeline-remember`) only when "Remember me" is ticked.
- **Trust model (current):** mutating endpoints take a client‑supplied
  `actor_id` and the server checks role/membership server‑side
  (`requireOrgAdmin` / `requireOrgMember`). This is defence‑in‑depth behind the
  role‑based UI, **not** a cryptographic session — a real auth‑token migration is
  planned. Do not treat `actor_id` as unforgeable.

---

## 8. Real‑time (Team Chat)

`tools/chat-server.js` is a **dependency‑free Node WebSocket relay** (pure
`http` + `crypto`; implements the WS handshake + frame codec). Run it with
`node tools/chat-server.js` (port 8090). The frontend (`features/chat.js`):
1. loads history via `GET /messages`,
2. connects `ws://<host>:8090/?org=&user=` and relays new posts to the org room,
3. falls back to 4‑second polling if the relay is down.
Messages are persisted by `POST /messages`; the relay only fans out, it has no DB.

---

## 9. Build & templates

The only build step bundles the HTML partials so the app also runs from
`file://` and paints the first frame synchronously:

```
node tools/build-templates.js      # reads templates/*.html → writes js/templates-local.js
```
Run it after editing any `templates/*.html`. `SCREENS` in that script lists the
partials to bundle (home, learn, insights, login, setup, admin-login, nav).

Cache-busting is automatic since the front controller landed: `index.php`
appends each file's `filemtime` to every local `<script src>` / `<link href>`,
and to the active module's scripts. The hand-bumped `?v=<date>` tags are gone —
nothing to remember when shipping JS changes.

### 9.1 Theming — one design system, twelve palettes

Every program shares the design system (spacing, type scale, cards, buttons,
sidebar, modals) and differs only in **colour**. That split is enforced by where
things live:

| File | Holds |
|---|---|
| `assets/css/styles.css` | the whole design system, plus a fallback accent |
| `assets/css/themes.css` | **one palette per program, in light and dark** |
| `assets/css/modules/<id>.css` | that program's own screens (generated) |

The active program is stamped on the root element by `index.php`:

```html
<html data-app="decision-lab" data-theme="dark">
```

`data-theme` (light \| dark) was already there; `data-app` selects the palette.
12 programs × 2 modes = **24 schemes from one attribute pair**, with no extra
stylesheet per program. No `data-app` — the launchpad, sign-in, sign-up and the
admin console — takes the suite palette, because those screens belong to no
single program.

A palette states five colours (`--accent`, `--accent-light`, `--accent-strong`,
`--accent-soft`, `--on-accent` + the `--accent-rgb` channels). Everything
downstream is aliased from them, so **`--gold` means "this program's accent"**;
the name is historical, from when there was one program.

Three rules that are easy to break:

- **`data-app` belongs on the root and nowhere else.** The aliases resolve on
  the element that carries them, so on a descendant you get the right
  `--accent` and the wrong `--gold` — the theme half-working rather than
  visibly broken.
- **Never hard-code an accent.** `rgba(232, 98, 26, …)` is the Pipeline's
  orange; written literally it survives every retheme. Use
  `rgba(var(--gold-rgb), …)`. The harness fails if a literal comes back, and
  `module-css-delta.js` tokenises each fork's on the way out.
- **Dark overrides are scoped to `@media screen`.** Paper is always the light
  theme, and a per-program dark rule is a two-attribute selector no single print
  rule can outrank. Scoping the dark side to screen means print gets the light
  accent for free — see the note in `themes.css`.

```
node tools/theme-contrast.js --strict
```

grades all 24 schemes against the real backgrounds (WCAG AA, 4.5:1) and fails if
a catalogue program has no palette. Adding a program is one block plus its dark
twin; nothing else needs editing.

---

## 10. Running locally

1. Start **Apache + MySQL** in XAMPP.
2. Create/upgrade the schema (idempotent):
   `C:\xampp\mysql\bin\mysql.exe -u root pipeline < api/sql/schema.sql`
3. `cd api && composer install` — the API's one dependency (the Anthropic PHP
   SDK, for `POST /claude`). `index.php` refuses to start without it and says so.
4. `cp .env.example .env` and paste an `ANTHROPIC_API_KEY` into it. Skippable:
   without a key every AI feature answers 503 with a readable message and the
   rest of the app is unaffected.
5. Open `http://localhost/pipeline/enterprises/` and set up an organization.
6. (Optional) `node tools/chat-server.js` for real‑time chat.

Must be served over **http://** (the PHP API can't be reached from `file://`).

---

## 11. Conventions & gotchas

- **Everything is global** by design — new logic is a `function` in the right
  module; call it by name from anywhere.
- **`data` is the workspace.** Read/write through `Store` (`saveData()` /
  `Store.commit(key)`), never touch `localStorage` directly — it is only a
  cache now, and writing to it directly bypasses the save to MySQL.
- **Never seed a workspace on a guess.** `readOrg()` returning null can mean
  "not fetched yet". Enter an org through `openOrgWorkspace()`, which asks the
  server first — see [data-persistence.md §6](data-persistence.md).
- **Never `json_decode($doc, true)` and store it back** — assoc mode rewrites
  `{}` to `[]` and silently corrupts the document. Same doc, §6.
- **`blob`/`step` etc.** — mind MySQL reserved words; the schema backticks them.
- **`*/` inside header comments** will close a block comment early — a real bug
  hit during the refactor; keep header prose clear of it.
- After editing a screen partial, **rebuild the template bundle** (§9).

---

## 12. Roadmap / open items

- **Cryptographic auth tokens** to replace the client‑supplied `actor_id` trust
  model.
- **The pre‑login admin console's "+ New Organization" / "Delete"** still call
  the local‑only `createOrg()` / `deleteOrgById()`; the in‑app admin panel
  (`openAdmin()`) is the DB‑backed one. Point them at `/setup` and
  `/organizations/delete`.
- **Retry queued mail.** `mail_outbox` keeps everything that could not be sent,
  but nothing re-sends it; a message queued while SMTP was unconfigured goes out
  only if something re-triggers it. A completion report re-sent from the outbox
  would also lose its PDF, which is rendered at send time and not stored.
- Continue the `app.js` decomposition (foundational `lib/` helpers; the
  tightly‑coupled pipeline/outcome renderers remain in core for now).

---

### See also
- [pipeline.md](pipeline.md) — the Pipeline workflow (phases, steps, gates, outputs) in depth.
- `api/README.md` — API‑local notes (endpoint list there predates later endpoints; this document is authoritative).
