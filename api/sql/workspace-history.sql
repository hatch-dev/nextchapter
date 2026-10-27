-- ============================================================
-- workspace-history.sql — who changed what, and when
-- ============================================================
-- WHY THIS TABLE EXISTS
--
-- `workspaces` keeps one row per (organization, module) and overwrites it on
-- every save. It carries `updated_by`, so it can answer "who wrote this
-- document last" — and nothing else. There was no record of who had changed
-- any particular part of it, or when, or what it had said before.
--
-- The app needed that record and did not have it, so it reconstructed one in
-- the browser: js/app.js kept a ledger of the leaves THIS browser had sent
-- (`_authored`), in memory, capped at 400 entries and expiring after twenty
-- minutes, and used it to tell a member that something they had saved had been
-- replaced. It worked, and it could not be made correct:
--
--   · it died on reload, so a member who refreshed lost the record entirely;
--   · it only ever knew about this browser's own writes, so a change nobody
--     here made was invisible;
--   · it could not say WHEN anything happened;
--   · and it had no idea who had done it — the name in the notice was inferred
--     from whoever happened to be holding a lock at the moment it fired, which
--     named the wrong person whenever somebody was editing something unrelated
--     and named nobody at all in the ordinary case, where the writer had
--     finished and let go before the next poll came round.
--
-- History has to be recorded where the writes are serialised. That is here.
--
-- WHAT IS STORED
--
-- One row per accepted write, holding only the TOP-LEVEL SECTIONS that write
-- actually changed, with their value before and after. Not a snapshot: a
-- program document is tens of kilobytes and a busy step produces a revision
-- every couple of seconds, so whole copies would be gigabytes of mostly
-- identical JSON. The changed sections are exactly what the patch endpoint
-- already sends, and they are enough to render any field-level difference —
-- the client walks the pair with leafDiff() (js/app.js), the same function that
-- draws the collision notice today.
--
-- COALESCING. Typing debounces to about a second and a half, so one paragraph
-- is twenty-odd saves. A row per save is a keystroke log, not a history, so a
-- write that continues the same member's work on the same sections inside a
-- short window UPDATES the row it is continuing rather than adding another:
-- the `before` stays as it was when they started, the `after` moves on, and the
-- history reads as "Navdeep rewrote the Mission between 16:02 and 16:04".
-- See Models\WorkspaceRevision::record().
--
-- RETENTION. Capped per (organization, module) and pruned on write, so the
-- table cannot grow without bound on a program somebody keeps open for a
-- quarter.
--
-- PRIVACY. Rows are stored unfiltered and filtered ON READ, per member, by the
-- same Core\DocPrivacy that guards the document itself. A history endpoint that
-- skipped that would be a way around it — see WorkspaceController::history().
-- ============================================================

CREATE TABLE IF NOT EXISTS `workspace_revisions` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED    NOT NULL,
  `module`          VARCHAR(40)     NOT NULL DEFAULT 'pipeline',
  -- The rev this write produced — the same counter workspaces.rev carries, so
  -- a client that holds rev N can ask for everything that happened after it.
  -- On a coalesced row this is the LATEST rev folded into it.
  `rev`             INT UNSIGNED    NOT NULL,
  -- …and the rev it started from, so a coalesced row still says what it
  -- replaced. `before` belongs to this rev, `after` to `rev`.
  `base_rev`        INT UNSIGNED    NOT NULL DEFAULT 0,
  -- users.public_id of the member who made the change. The ID, never the name:
  -- people get renamed, and the roster is where names belong.
  `actor_public_id` VARCHAR(32)     NULL,
  -- {"purpose": {"before": …, "after": …}, …} — top-level sections only.
  `changed`         LONGTEXT        NOT NULL,
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Moves when a row is coalesced, so it reads as "up to this moment".
  `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- One row per rev per workspace. A coalesced row keeps the newest rev it
  -- covers, and the revs it swallowed are simply not present — which is what
  -- makes "everything after rev N" a plain range scan.
  UNIQUE KEY `uq_revision_org_module_rev` (`organization_id`, `module`, `rev`),
  -- The read: "what happened in this workspace after rev N", newest first.
  KEY `idx_revision_lookup` (`organization_id`, `module`, `rev`),
  -- The read the notice needs: "the last change this member made here".
  KEY `idx_revision_actor` (`organization_id`, `module`, `actor_public_id`, `rev`),
  CONSTRAINT `fk_revision_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
