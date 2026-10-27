# Data Persistence — How the Workspace Is Saved

How the 90-day program's data gets from a text box in the browser into MySQL and
back out again in a different browser, on a different machine.

For the whole-system view see [architecture.md](architecture.md); for the
pipeline workflow itself see [pipeline.md](pipeline.md).

---

## 1. The short version

Everything a team fills in — every phase's answers, ideas, portfolio, capital
plan, RACI, progress — lives in **one JSON document per organization**, in the
`workspaces` table. The database is the source of truth. Any browser, any
machine, same data.

Alongside it, the server keeps a **readable Q&A trail** in `step_answers`: one
row per answered question, tagged with its phase and step, rebuilt on every
save. That table is derived — you can drop and rebuild it, and nothing is lost.

```
   browser                         PHP API                     MySQL
   ───────                         ───────                     ─────
   data {}          POST /workspace          ┌──────────────┐
   (js/app.js)  ──────────────────────────►  │ workspaces   │  the source of truth
      ▲             {org, base_rev, doc}     │  rev | doc   │
      │                                      └──────┬───────┘
      │                                             │ AnswerProjector
      │          GET /workspace                     ▼
      └──────────────────────────────────    ┌──────────────┐
                    {rev, doc}               │ step_answers │  derived, queryable
                                             └──────────────┘
```

### Why one document and not a table per phase

The app keeps the whole program in a single `data` object and every screen reads
straight off it (`data.purpose.mission`, `data.ideas[3].name`). There are ~40
heterogeneous collections and ~200 read/write call sites. Storing the document
whole put the database in charge **without rewriting any of them**. The
`step_answers` projection buys back the one thing a document loses — being able
to ask SQL "what did they answer in Phase 1?".

---

## 2. Where each kind of data lives

| Data | Home | Why |
|---|---|---|
| Program state (all phase answers, ideas, portfolio, capital, progress) | MySQL `workspaces.doc` | Shared by the team, must follow them across browsers |
| Per-phase Q&A trail | MySQL `step_answers` | Derived from the document, for reporting/export |
| Organizations, members, PINs | MySQL `organizations`, `users` | Shared |
| Chat, notes, step assignments | MySQL `messages`, `notes`, `step_assignments` | Shared; already had their own tables |
| Theme, zoom, sidebar state | `localStorage` | *Should* differ per browser |
| Sign-in session | `sessionStorage` | Per browser, cleared on close |
| "Remember me" | `localStorage` | Per device, by definition |
| Cached copy of the workspace | `localStorage` | So a dropped connection doesn't blank the app |

**localStorage is no longer authoritative for program data.** It is a cache. On
boot the cache is refilled from MySQL; if the two disagree, the database wins.

---

## 3. The client seam — `Store` (js/app.js)

Every durable read and write goes through `Store`. That is what made this
migration small: `Store` was already the only door, so only `Store` had to
learn about the server.

```
  saveData()          ─┐
  Store.commit(...)    ├──►  writeOrg(id, doc)  ──►  localStorage mirror
  (~200 call sites)   ─┘                        └──►  scheduleFlush() ──► POST /workspace

  loadData()          ────►  orgRaw(id)  ──►  in-memory cache (warmed from MySQL)
```

Key pieces, all in the `Store` IIFE near the top of `js/app.js`:

| Function | Job |
|---|---|
| `ready(cb)` | Boot seam. Fetches the org list + the active org's workspace, **then** runs `bootApp()`. Every synchronous getter serves from that warm cache afterwards, so no other call site had to change. |
| `loadOrg(id, cb)` | Pulls one org's workspace into the cache. `cb(hasWorkspace)`. **Any path about to read or seed an org's data must go through this** — see §6. |
| `writeOrg(id, doc)` | The single write path. Mirrors locally, queues the save. |
| `scheduleFlush(id)` | Debounces 600 ms, so a burst of edits is one request. |
| `flushOrg(id)` | `POST /workspace` with `base_rev`. Handles 409 by merging. |
| `checkRemote()` | Polls `GET /workspace/rev` every 5 s; pulls the document only if the rev moved. |
| `adoptDoc(id, doc, rev)` | Takes on a newer document without stealing what the user is typing (captures/restores focus + caret). |

### Server mode vs file mode

`server.enabled` is true when the page is served over http(s). Opened straight
from disk (`file://`) there is no API, so the app falls back to the original
localStorage-only behaviour and still runs. Everything below applies to server
mode.

---

## 4. Two people editing at once

Each save carries the rev it was based on:

```
A loads rev 4 ─┐
B loads rev 4 ─┘

A saves (base_rev 4) → accepted, now rev 5
B saves (base_rev 4) → 409 stale + the current {rev 5, doc}
                     → B merges its unsaved records onto A's document
                     → B re-saves (base_rev 5) → accepted, rev 6
```

Both edits survive. Without `base_rev`, whoever saved last would silently
flatten the other's work.

The merge is **record-level last-writer-wins**: `Store.mergeDirtyInto()` replays
only the records this browser actually touched (the `_dirty` set) onto the fresh
document. Two people editing *the same field* is still last-writer-wins; two
people editing different fields both keep their work.

---

## 5. Offline

A save that fails on the network is not lost:

1. The edit is already in the localStorage mirror.
2. `setOnline(false)` → `onConnectionChange()` puts up the offline banner —
   *"Offline — your recent changes are not saved yet. Retrying…"*
3. The save retries every 5 s.
4. On success the banner clears and the queued document goes up.

Reads fall back to the cached document, so the app keeps working. The banner is
the contract: **while it is up, the work exists only in this browser.**

---

## 6. Two traps worth knowing about

These are the bugs this migration had to fix. Both were silent. Please don't
reintroduce them.

### Never seed a workspace on a guess

`readOrg()` returns null both for *"this org has no workspace"* and for *"I
haven't fetched it yet"*. Treat the second as the first and you seed a blank
document over the team's program — which is exactly what a fresh browser used to
do on its first sign-in.

Always ask the server first. `Store.loadOrg()` answers definitively, and
`openOrgWorkspace()` (js/features/org-admin.js) is the only sanctioned way in:

```js
openOrgWorkspace(orgId, function (id) {   // loads from MySQL; seeds ONLY if it
  switchToOrg(id);                         // genuinely has no workspace yet
  render();
});
```

When offline, `loadOrg` deliberately reports "has a workspace" even when it
can't tell — refusing to seed is always safer than risking a clobber.

### Never decode the document with `assoc = true` and store it back

`json_decode($json, true)` turns every empty object `{}` into an empty PHP array
`[]`, and `json_encode()` writes it back as `[]`. The app stores most state in
objects keyed by id (`rhythm{}`, `projects{}`, `assessments{}`), all `{}` until
first written. Round-trip one through assoc mode and the browser gets `[]`, then
does `data.rhythm.time = '9:00'` — JavaScript happily sets a non-index property
on an array, and `JSON.stringify` **drops it**. The answer vanishes on the next
save, with no error anywhere.

So `WorkspaceController` decodes to `stdClass` and stores the document as
**verbatim JSON text**. Assoc mode is fine for read-only work (the projector
uses it), never for anything stored or returned.

---

## 7. The Q&A trail

`step_answers` is rebuilt from the document on every save by
`Core\AnswerProjector`, driven by the declarative map in
**`api/config/questions.php`**:

```php
['phase' => 1, 'step' => '1.1', 'section' => 'Purpose',
 'path' => 'purpose.mission', 'text' => 'Mission'],
```

Query it directly:

```sql
SELECT step_id, question_text, answer
  FROM step_answers
 WHERE organization_id = 1 AND phase = 1
 ORDER BY step_id;
```

or over HTTP: `GET api/workspace/answers?org=<public_id>&phase=1`.

### Adding a question

Add a row to `api/config/questions.php`. That's it — no schema change, no code
change. The `path` must match the app's write path exactly; a typo silently
yields no row, so check the field's id in the step renderer and the `fldSave()`
prefix map in `js/app.js` (`p`→purpose, `k`→knowledge, `ow`→ownership,
`inc`→incentives, `rh`→rhythm, `cap`→capital, `gov`→governance, `str`→stress).

### What belongs in the map

Only **scalar** answers: one path, one answer. Lists of plain strings
(`rhythm.attendees`) are fine — they render as a comma-separated line.
Repeating collections (`ideas[]`, `projects{}`, `budgetPlans{}`) are **not**
questions; they are records with their own shape, they live in the document, and
flattening them into one `answer` column would lose it.

Unanswered questions get no row: the table holds what a team *said*, not a row of
nulls for every question they haven't reached.

---

## 8. The endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/workspace?org=<id>` | The document + its rev. `doc: null`, `rev: 0` when the org has never saved. |
| `POST` | `/workspace` | Save. Body `{org, actor_id, base_rev, doc, schema_version}`. → `{rev}`, or **409** `{stale: true, data: {rev, doc}}`. |
| `GET` | `/workspace/rev?org=<id>` | Just the rev — the cheap change poll. |
| `GET` | `/workspace/answers?org=<id>[&phase=N]` | The readable Q&A trail. |

Any member of the organization may read and write the workspace — the program is
shared team work. `actor_id` must belong to the org; it is recorded as
`updated_by`.

> Like the rest of this API, `actor_id` is client-supplied and trusted. It is a
> layer behind the role-based UI, not a substitute for real sessions — the same
> caveat already noted on `Core\Controller::requireOrgAdmin()`.

---

## 9. Files

| File | Role |
|---|---|
| `api/sql/workspace.sql` | The two tables. Run once, after `schema.sql`. |
| `api/models/Workspace.php` | The document + the optimistic-concurrency save. |
| `api/models/StepAnswer.php` | The derived Q&A rows. |
| `api/core/AnswerProjector.php` | Document → answer rows. Pure, no database. |
| `api/config/questions.php` | **The question map.** Add questions here. |
| `api/controllers/WorkspaceController.php` | The endpoints. Read its class note before touching JSON. |
| `js/app.js` → `Store` | The client seam: cache, debounce, flush, merge, poll. |
| `js/features/org-admin.js` → `openOrgWorkspace` | The only safe way into an org's workspace. |

## 10. Setup

```bash
mysql -u root < api/sql/schema.sql      # first (organizations, users, ...)
mysql -u root < api/sql/workspace.sql   # then (workspaces, step_answers)
```

Existing organizations need no migration: an org with no `workspaces` row simply
reports `rev: 0`, and the first sign-in seeds one from its members.
