# Roles and modules

How the suite is organised: **two roles, six programs each, one login.**

    /apps/enterprises/{program}      an organization and its team
    /apps/leaders/{program}          an individual leader

Both roles share one identity system, one admin console, one database and one
application shell. What a role decides is which six of the twelve programs an
account may open.

**Every program has its own sign-in. Sign-up is one screen for all twelve.**
There is no shared `/apps/login` — that path 404s. A sign-in that belongs to a
program already knows which audience it is for, so it does not ask: the role
space comes from the URL.

Sign-**up** is the other way round, at `/apps/signup`. Creating an account is
not entering a program — it chooses which of the two audiences you belong to,
and that answer then governs every program in that space — so the form asks
**Enterprise or Leaders**, and the account starts with that whole space, six
programs, either way. The twelve old `/apps/{role}/{program}/signup` addresses
301 there. See §5.

---

## 1. The shape of it

```
                       ┌──────────────────────────────┐
                       │  /apps/          launchpad   │   signed out: every
                       └───────┬──────────────┬───────┘   program, each card
                               │              │           to its own door
                               │              │           signed in: the ones
                               │              │           this account can open
                               │              │
        ┌──────────────────────▼───┐     ┌────▼─────────────────────┐
        │  /apps/enterprises       │     │  /apps/leaders           │
        │  ────────────────────────│     │  ────────────────────────│
        │  executive-readiness    ●│     │  judgment-critical…     ●│
        │  innovation-pipeline    ●│     │  friction-map           ○│
        │  responsible-ai-gov…    ●│     │  connection-practice    ○│
        │  ai-ready-architecture  ○│     │  conscience-ethical…    ●│
        │  ai-ready-culture       ○│     │  authorship-studio      ○│
        │  workforce-readiness    ○│     │  narrative-forge        ○│
        └────────────┬─────────────┘     └────────────┬─────────────┘
                     │                                │
        ┌────────────▼─────────────────────────────────────────────┐
        │  /apps/{role}/{program}/login   its own sign-in          │
        │                                                          │
        │  the two screens that belong to no program by design:    │
        │  /apps/signup                   one sign-up, all twelve  │
        │                                 — it asks which space    │
        │  /apps/admin                    the app-admin console    │
        └──────────────────────────────────────────────────────────┘
                 ● live    ○ catalogued, content in development
```

The twelve, their order and their discipline tags mirror the marketing site's
**For Enterprises** and **For Leaders** module lists. Keep them in step — the
site is where people meet these names first, and a chooser that renames or
re-describes them makes the reader do the matching:

| # | Enterprise | | Leaders | |
|---|---|---|---|---|
| I | Executive Readiness | AI fluency & judgment | The Decision Lab | Critical thinking & judgment |
| II | AI Innovation Pipeline | Innovation strategy | The Friction Map | Adaptive learning & curiosity |
| III | Responsible AI Governance | Managing AI risk | The Connection Practice | Emotional intelligence |
| IV | AI-Ready Architecture | The technical foundation | Conscience | Ethical reasoning & moral courage |
| V | AI-Ready Culture | Working with and for humans | The Authorship Studio | Creative & original thinking |
| VI | Workforce Readiness | Closing the capability gap | The Narrative Forge | Narrative & communication mastery |

Five are live — Executive Readiness, the AI Innovation Pipeline and Responsible
AI Governance on the Enterprise side, Judgment and Conscience on the Leaders
side. `exec-readiness` and `pipeline` predate roles and their ids are
**frozen**: they are the `workspaces.module` values every existing workspace is
stored under.

Responsible AI Governance went live on 2026-09-01, ported off
`enterprises/dev/responsible-ai-governance/` the same way Executive Readiness
was. Its id is `ai-governance` and its slug is `responsible-ai-governance`; it
is the first Enterprise program to bring PAGE IDS OF ITS OWN — `portfolio`,
`system`, `ethicsov`, `govreview` and `mgmt-hub`, on top of the five every
program has. Those needed no routing change: `go()` leaves an unrecognised page
id alone, `render()` asks the module before its own table, and `js/router.js`
addresses whatever `currentPage` says. It is also the first to ship its own
`insights` page rather than the shell's shelf.

Everything outside the program itself is shared: sign-in, sign-up, the admin
console, organizations and team, the header, the sidebar chrome, Team Chat,
Notes, the AI Guide, printing. A program supplies its phases, its steps, the
shape of the data it collects, its Home / Learn screens — **and its colours**.
That split is older than roles (see `architecture.md`); roles group the
programs, they do not change what a program is.

The colours are the one thing every program differs in and no program owns any
of the rest: the spacing, type scale, cards, buttons, forms, tables, modals and
navigation are all `assets/css/styles.css`, identical everywhere. Each program's
palette is a single block in `assets/css/themes.css`, selected on `data-app` at
the root, in light and dark — see `architecture.md` §9.1.

### What a Leaders program is, and how it differs

The two live Leaders programs are the first that are **not** a 90-day spine,
and the shell had to grow a few seams to hold them. Worth knowing before
reading `js/modules/decision-lab/` or `js/modules/ethics-engine/`:

| | Enterprise programs | Leaders programs |
|---|---|---|
| Shape | five phases → numbered steps → outputs | a list of decisions, each worked through eight sections on a board |
| Tenant | an organization and its team | an organization of one |
| Pages | the shell's `pipeline` / `phase` / `step` / `outcome` / `phase5` | their own `assess` / `lab` / `detail` / `dashboard` (+ `drills` / `drill` in Conscience) |
| Left menu | the phase/step sidebar | none — the board's own drawers replaced it |
| Tabs | the shell's five | six, declared in the catalogue's `tabs` map |
| Modals | `#modalRoot` | painted into the page, as their reference builds did |

The seams that made that possible are all optional and all default to the old
behaviour, so nothing about the Enterprise programs changed:

| Seam | Where | What it does |
|---|---|---|
| `tabs` map drives the strip | `js/nav.js` | a module naming a different tab SET gets the strip rebuilt from its own map, in its own key order |
| `tabFor(page)` | `js/nav.js` | which tab owns a page the shell has never heard of |
| `renderModal()` | `js/app.js` | markup appended after the page, outside the zoom wrapper |
| `noteScope()` / `noteScopeLabel()` | `js/features/notes.js` | what a note is filed against — a decision id here, a step id everywhere else |
| `coachPresets` / `coachSystem` / `coachContext()` | `js/features/coach.js` | the AI Guide's chips, prompt and context line; values or functions |
| `moreItems` | `js/nav.js` | extra entries in the … More menu (The Decision Lab's two AI-state exports) |
| `beforeNavigate(page, step)` | `js/app.js` | now receives where the app is going, so a module can reset its own view state |
| array records in `mergeDirtyInto` | `js/app.js` | `data.decisions` is an id-keyed ARRAY, and a 409 overlay had to learn that shape |

### The two ports

Neither program was written here. Each was built as a complete standalone copy
of the whole application under `leaders/dev/<program>/`, and what is in
`js/modules/<id>/program.js` is **generated** from it:

```
node tools/port-leader-module.js all --emit    # regenerate both program.js
node tools/leader-module-smoke.js all          # render every page, pull every handler
```

Do not hand-edit `program.js` — the next port drops the edit. Everything that
had to change to run on the shell is a *graft* in the port script, anchored on
an exact slice of the reference so a changed reference fails the port loudly
rather than shipping the graft unapplied. `module.js` and `help.js` beside it
are hand-written and safe to edit.

The stylesheets are generated too, and are the DIFFERENCE rather than the fork:

```
node tools/module-css-delta.js assets/css/styles.css \
     leaders/dev/judgment-critical-thinking/DL-styles.css \
     assets/css/modules/decision-lab.css --title "Judgment"
```

Same story for the exec-readiness port, which came first and keeps its own copy
of the machinery (`tools/port-exec-readiness.js`) because its output is
byte-diffed against the reference.

---

## 2. One catalogue, four readers

`config/catalogue.json` is the **only** place the roles and their programs are
defined. Four things read it and nothing keeps a second copy:

| Reader | Uses it for |
|---|---|
| `index.php` | resolving `/apps/{role}/{program}` → a role + a module |
| `js/modules/registry.js` | the client API over it (injected as `window.APP_CATALOGUE`) |
| `api/config/modules.php` | the server's allowlist and role check |
| `api/core/Catalogue.php` | names, tags and absolute URLs, for the invite email |
| `tools/_unused/harness.js` | reads the file straight off disk |

`modules.php` and `Catalogue.php` are two readers of the same file rather than
two copies of the list: the first reduces it to the module→role map that a
per-request authorization check needs, the second keeps the display fields that
only the invite email wants. Neither defines anything.

A module entry has two identifiers, and the difference matters:

- **`id`** is the *storage* key — the `workspaces.module` column, the
  localStorage namespace, the coach/help scope. **Frozen** once a module has
  data. `pipeline` and `exec-readiness` keep the ids they were born with, so
  every workspace saved before roles existed is addressed exactly as it was.
- **`slug`** is the *URL* segment. Safe to rename; only links break.

Plus `status`: `live` (has its own code) or `planned` (renders the shared
placeholder). A planned module is a **real route** — real URL, real workspace
key, real entry in the launchpad, the switcher and the server allowlist. Only
its content is missing.

### Adding a program

1. Append an entry to `config/catalogue.json`.
2. Add its palette to `assets/css/themes.css` — one `[data-app="<id>"]` block
   and its `@media screen` dark twin, keyed on the module **`id`**. Check it
   with `node tools/theme-contrast.js --strict`, which fails on a catalogue
   program that has none.
3. Create `js/modules/<id>/module.js` calling `Modules.define()`.
4. Set `status: "live"` and point `scripts` at it.

Nothing else. The router, the launchpad, the switcher, the server allowlist, the
entitlement gate and the harness all follow the catalogue, and `index.php`
stamps `data-app` from it so the colours attach on their own.

### Renaming one of the ten placeholders

Change its `name`, `tag`, `sub`, `slug` and `logo` — `tag` is the short
uppercase discipline line the site and the launchpad show under the name;
`sub` is the longer sentence used by the header switcher and the module's own
screen. Leave `id` alone unless you are certain it has never been saved
against.

---

## 3. URLs

| URL | What it is |
|---|---|
| `/apps/` | launchpad — the programs this account can open; signed out, all twelve, each card leading to that program's own sign-in, plus the link to `/apps/signup` |
| `/apps/signup` | the one sign-up, for all twelve programs — it asks Enterprise or Leaders |
| `/apps/admin` | the app-administrator console — the other entry screen that belongs to no program |
| `/apps/enterprises` | role hub — that role's six programs |
| `/apps/enterprises/innovation-pipeline` | a program |
| `/apps/enterprises/innovation-pipeline/login` | that program's own sign-in |
| `/apps/enterprises/innovation-pipeline/signup` | **301** → `/apps/signup`. Kept alive so the twelve old links heal themselves |
| `/apps/leaders/decision-lab` | **301** → `/apps/leaders/judgment-critical-thinking`, page and step carried across. The address Judgment answered at until the 2026-08-31 rename |
| `/apps/leaders/ethics-engine` | **301** → `/apps/leaders/conscience-ethical-reasoning`, page and step carried across. The address Conscience answered at until the 2026-08-31 rename |
| `/apps/login` | **gone** — 404. Every program carries its own sign-in |
| `/apps/enterprises/executive-readiness/step/1.2` | a screen inside a program |
| `/apps/leaders/judgment-critical-thinking/detail/<id>` | the same, where the program's screens are its own — here, one decision's board |
| `/apps/{enterprises,leaders}/dev/<program>/` | a standalone REVIEW build — plain files, no sign-in |
| anything else | 404 (a real 404 status, rendered by the app) |

The `dev/` row is the one exception to "every URL here is a route". Each of
those folders holds a self-contained copy of a program with its own
`index.html`, kept so a reviewer can open it cold. `.htaccess` serves that tree
directly and never routes it — and, because `enterprises` and `leaders` are
therefore real directories on disk, it also has to force the role-hub URLs back
to the front controller. Without that, `/apps/enterprises` served an Apache
file listing instead of the role hub, which is where signing in lands you.

`index.php` is the front controller. It resolves the path against the catalogue
and renders `shell.html` with three things injected at the top of `<head>`:

- **`<base href="/apps/">`** — every relative asset, template and `api/` call in
  the app was written for the root, and `/apps/leaders/x/step/1.2` is four
  segments deep. One tag fixes all of them, and keeps the install directory
  configurable: nothing hard-codes `/apps`.
- **`window.APP_BOOT`** — the resolved route (role, module, page, step) plus the
  active module with its scripts already stamped.
- **`window.APP_CATALOGUE`** — the roles and their modules.

Two consequences worth knowing:

- **Asset versions come from `filemtime`.** The hand-bumped `?v=20260728-dark`
  tags are gone; a changed file is refetched because its mtime changed, and an
  unchanged one is always served from cache. Nothing to remember on deploy.
- **`shell.html` is never served directly** (denied in `.htaccess`). It is a
  template. Open `/apps/`.

### Moving around

`js/router.js` owns URL construction and history.

- **Inside a program** — `go('step','1.2')` — is a re-render, and the URL
  follows with `replaceState`. Not `pushState`: the app's own Back button walks
  `UI.navStack`, and a browser history entry per click would fight it. What the
  URL buys is that refresh, bookmark and copy-link all work.
- **Between programs or roles** is a real page load. Each program brings its own
  code and the browser cannot unload the one already running, so a load is the
  only way to guarantee two programs' globals are never live at once. The shell,
  the session (sessionStorage) and the header survive it, so it is invisible.

Old `index.html?module=<id>` links 301 to the program's real URL, and
`/pipeline/enterprises/index.html` redirects into `/apps`.

---

## 4. Who may open what

The tenant is the **organization** in both roles — a Leader account is an
organization of one — so the role lives on `organizations.account_type`
(`'enterprise' | 'leader'`, `api/sql/roles.sql`).

> `users.role` is **unrelated**. It has always held a job title
> ("Administrator", "Head of Ops") shown next to a member's name. Nothing here
> touches it.

Access is **four questions, asked in order**, and all four live in one method —
`Core\Controller::moduleFrom()`. Everything that is scoped per program goes
through it: the workspace, its Q&A projection, step assignments, private notes
and team chat.

| # | Gate | Source | Fails with |
|---|---|---|---|
| 1 | Does this module exist? | `config/catalogue.json` | `422` |
| 2 | Is it in this account's role space? | `organizations.account_type` | `403 role` |
| 3 | Does the organization hold it? | `org_modules` | `403 org-entitlement` |
| 4 | Was this member given it? | `user_modules` | `403 user-grant` |

Gates 3 and 4 are the **entitlement**, added when team members stopped all
having the same access (`api/sql/access.sql`). They are two tables because they
answer two different questions with two different owners:

- **`org_modules`** — what the account has *bought*. The Super Admin sets it.
  For a Leader account, it is the set of programs the person chose at sign-up.
- **`user_modules`** — which of those one member may *open*. The Org Admin sets
  it, from the Team Members screen.

The effective answer is the **intersection**, computed in exactly one place
(`Models\Access::forUser`). That is what makes revoking a program from an
organization revoke it from every member instantly, without rewriting a single
user row — and what makes restoring it give the program back to precisely the
people who had it before, since their `user_modules` rows were never deleted,
only rendered inert.

Membership is checked too, and this is newer than it should be: every endpoint
above is addressed by the organization's **public id**, a value the client
sends. Reads were unchecked and the write check was commented out, so holding
an org id was the same as being in that org. `Controller::requireOrgMember()`
now runs on all of them.

The client mirrors all of this, and only cosmetically:

| | |
|---|---|
| `Router.roleAllowed()` / `enforceRole()` | bounce before rendering a screen every save would fail |
| `grantedModules()` / `canOpenModule()` (`js/app.js`) | the same intersection, for the launchpad and the header switcher |

`grantedModules()` treats **unknown as everything, not nothing**: a registry
record written before entitlements existed carries no `modules`, and reading
that silence as "no access" would empty every launchpad mid-deploy. The server
is what refuses.

Three details that are easy to get wrong and are already handled:

- **A request naming no module** means the Pipeline, as it always has — but only
  for an account that can actually open the Pipeline. Otherwise it resolves to
  the caller's own first grant, so its work is never filed under a module it can
  never open again (`Controller::fallbackModule`). That method picks a *name*;
  the four gates above are what authorize it.
- **The launchpad, a role hub, `/apps/signup` and the admin console load the
  default module for chrome**, and for a Leader that default is an Enterprise
  program. `Store.moduleId()` therefore never asks the API for a workspace
  outside the account's own space. A program's own `/login` is not in this list:
  it already resolved a module — its own — and wears its palette. What separates
  the two, since both are `kind: 'auth'`, is `boot.moduleId`: null exactly when
  no program is behind the URL, which is also how `auth.js` decides whether to
  caption the screen with a program's name or the suite's.
- **The org registry is rebuilt from the database on every load.** Anything the
  browser keeps only locally is gone by the next refresh, so `account_type` rides
  in with the registry (`orgRecord()` — one mapper, used by both places that
  rebuild it) and with the sign-in response.

### Sign-up: one screen, and the one question it asks

Sign-up lives at `/apps/signup`, once, for all twelve programs. Nothing about
the account can be read off that address, which is the point: **Enterprise or
Leaders** is a choice the visitor makes on the form, and it decides everything
below it — whether an organization is named, what the account holds, and how
they will sign in afterwards.

It is deliberately not pre-selected. The two spaces hold different programs and
an account cannot be moved between them afterwards, so `Entry.validateSetup`
refuses a blank answer rather than letting a default decide. (`SetupController`
still falls back to `enterprise` for an unrecognised value — it has to decide
something for a request that never came from the form — which is exactly why the
refusal belongs on the client, where there is a person to ask.) The value
travels in the request **body** and is re-validated against the catalogue
regardless.

What each role is asked for differs, and that is the point:

| | Enterprise | Leader |
|---|---|---|
| Organization name | **asked** — it is half of its members' sign-in credential | **not asked, and not accepted** — an account of one has no team to name; the server derives the workspace name from the person's (`deriveLeaderOrgName`) |
| Programs | the whole Enterprise space as a pool, for the admin to hand out per member later | the whole Leaders space, held outright — a Leader has nobody to assign to, so a pool they cannot open is just a shorter launchpad |
| Username uniqueness | per organization, as for every member | across **all Leader accounts** — see below |
| Sign-in afterwards | organization + username + PIN | username + PIN |

Nothing on the form picks **programs**. `SetupController::entitlementFor` builds
the list from the catalogue and takes no input at all, so a hand-made request
cannot hand itself an entitlement the form does not offer — nor a shorter one.

The Leader username rule is a consequence, not a policy: having no organization
to name at sign-up means having none to type at sign-in, so the username is the
whole credential there. `AuthController::resolveLeader` looks it up within the
Leader accounts and refuses to guess if it ever finds two — the same three-valued
answer `Organization::resolve` gives, for the same reason.

### What a new member is sent

Adding a team member emails them their program links, their username and the
passcode the admin set (`api/core/MemberInvite.php`). Three things about it:

- **Queue first, send second.** The message is written to `mail_outbox` before
  any socket opens, so adding a member never fails because mail is down or not
  configured. With `MAIL_HOST` empty every invite simply stays `queued` and the
  admin is told so — not told it was sent.
- **The outcome is reported, not assumed.** `POST /users` returns an `invite`
  block and the UI says what actually happened. An admin who believes an email
  went out will not think to pass the details on by hand.
- **The passcode travels in clear text**, which is what was asked for and is a
  reasonable trade for an admin-chosen PIN. The message says so and tells the
  recipient to change it. If that stops being acceptable, send a one-time link
  from `MemberInvite` instead — nothing else in the system needs to know.

Transport is a small hand-rolled SMTP client (`api/core/Mailer.php`), configured
from `apps/.env`. See `.env.example`.

---

## 5. Where things live

```
apps/
  .htaccess              front controller rules; static trees serve themselves
  index.php              route → role + module → renders shell.html
  shell.html             the SPA markup (never served raw)
  config/catalogue.json  THE definition of roles and modules
  js/
    router.js            every URL in the app
    launchpad.js         launchpad, role hub, 404
    modules/
      registry.js        the API over the catalogue
      boot.js            writes the active module's <script> tags
      _placeholder/      the one module that stands in for the eight planned ones
      pipeline/  exec-readiness/          module.js + its own step bodies
      ai-governance/                       module.js + help.js (hand-written)
      decision-lab/  ethics-engine/       module.js + help.js (hand-written)
                                          program.js         (GENERATED)
  assets/
    css/modules/<id>.css   the module stylesheet — the DIFFERENCE, generated
    media/<id>/            the program's videos
  templates/modules/<id>/  Home and Learn, when a module ships its own
  api/
    config/modules.php   the server's view of the catalogue (the role check)
    core/Controller.php  moduleFrom() — THE access gate; requireOrgMember()
    core/Catalogue.php   the richer view of the catalogue (names, URLs)
    core/Mailer.php      dependency-free SMTP client
    core/MemberInvite.php  the message a new team member receives
    models/Access.php    org_modules ∩ user_modules — THE access answer
    models/MailOutbox.php  every message the app has tried to send
    controllers/AccessController.php  reading and changing who may open what
    sql/roles.sql        the account_type migration
    sql/access.sql       the grant tables, the outbox, module-scoping for
                         notes + messages, and the grandfathering backfill
    sql/workspace-modules.sql  one workspace row per (organization, module)
  templates/             screen markup (setup.html carries the role picker)
  tools/
    lib/js-port.js               the porting machinery (lexer, closure, rewriter)
    port-leader-module.js        DL + EE  → js/modules/<id>/program.js
    port-exec-readiness.js       ER       → js/modules/exec-readiness/steps.js
    port-ai-governance.js        RG       → js/modules/ai-governance/program.js
    module-css-delta.js          a fork's stylesheet → the module's difference
    leader-module-smoke.js       every DL/EE page rendered, every handler pulled
    exec-readiness-smoke.js      the same for Executive Readiness
    ai-governance-smoke.js       the same for Responsible AI Governance, plus
                                 the module-isolation checks (the seed, the
                                 export, every request, and the Pipeline's
                                 workspace read back over the same storage)
    _unused/harness.js           the behavioural suite — `node tools/_unused/harness.js`
```

---

## 6. Deploying this change

1. `mysql -u root pipeline < api/sql/roles.sql` — adds `account_type`,
   defaulting every existing organization to `enterprise`. A LEADER account
   must carry `account_type = 'leader'`, and sign-up records it from the role
   picker: it is what `Store.moduleId()` consults to decide which module a
   workspace request may name, so an account stamped `enterprise` has its
   Decision Lab document filed under `exec-readiness` instead.
2. `mysql -u root pipeline < api/sql/workspace-modules.sql` — one workspace row
   per (organization, module). Already run for Executive Readiness; the Leaders
   programs need nothing further.
3. `mysql -u root pipeline < api/sql/access.sql` — the two grant tables, the
   mail outbox, and the `module` column on `notes` and `messages`. **It also
   grandfathers every existing account**: each organization is granted its whole
   role space and each existing member everything their organization has, which
   is exactly the access they had the moment before. Nobody loses anything, and
   nothing needs backfilling by hand. Idempotent.
4. Fill in the `MAIL_*` keys in `apps/.env` (see `.env.example`) if invites
   should actually send. Skipping this is safe: invites queue instead, and the
   admin is told they are queued.
5. Serve `htdocs/apps` with `mod_rewrite` and `AllowOverride All`.
6. Keep `pipeline/enterprises/index.html` (the redirect) until old links die.

**Accounts that opened a Leaders program before it was built** were served the
shared placeholder, which saved the *Pipeline's* empty document under their
module key — and there `decisions` is an id-keyed object, not the array these
programs work in. Each module repairs the shape before anything reads it
(`normalize()` in its `module.js`), so those rows need no migration; leave them
alone and they correct themselves on first open.

After editing any `templates/*.html`, run `node tools/build-templates.js`; after
any change at all, run `node tools/_unused/harness.js`. After a re-port, also
run the smoke test for the module you re-ported.

---

## 7. Known limits

- **An account is still in exactly one role space.** `org_modules` makes the set
  of programs per-account, but `moduleFrom`'s gate 2 and `AccessController`'s
  clamp both hold an organization to its own space, so a Leaders add-on for an
  Enterprise customer is not yet possible. Those two places are what change.
- **`actor_id` is still client-supplied.** Every gate in §4 is scoped by an
  actor the browser sends, so all of it is defence in depth behind the app's own
  UI rather than a substitute for sessions — see the note in `Core\Controller`.
  The auth-token migration is what fixes it, and it fixes all four gates at once.
- **The Super Admin is a shared passcode, not an account.** It is now verified
  on every access write rather than trusted from a flag in the browser
  (`AccessController::requireSuperAdmin`), and changing it requires the current
  one — until this work, a single unauthenticated `POST /admin-passcode` could
  reset the credential that unlocks every organization. It is still one secret
  with no per-person identity and no audit trail of who used it.
- **Queued mail is never retried on a schedule.** `mail_outbox` keeps failed and
  unconfigured invites queued, and the Super Admin console lists them, but
  nothing re-attempts delivery by itself yet.
- **Eight of the twelve programs are placeholders.** Real routes, real
  workspaces, no content.
- **A Leaders account still sees Team Chat.** The header is the shell's and is
  the same in every program, so an organization of one is offered a chat room
  it is alone in. Harmless, and not worth a per-role header until a second
  thing wants one.
- **The launchpad builds its markup in JavaScript**, following the admin console
  rather than the `templates/` pattern, because it is short, entirely
  data-driven, and painted before any template fetch could resolve.
