-- ============================================================
--  workspace-locks.sql — who is editing which section, right now
--  Run once, after workspace-modules.sql:
--      mysql -u root pipeline < api/sql/workspace-locks.sql
--
--  WHY THIS EXISTS
--  ---------------
--  The client has had a record-lock system since July — Collab in
--  js/app.js: it claims a lock when a field takes focus, paints
--  "Locked · <name> is editing" on everyone else's screen, refuses
--  writes to a held record, and lets a lock expire if its holder stops
--  beating. All of it worked. None of it was SHARED: read()/write()
--  went to localStorage, which is one browser. Two people on two
--  machines each held every lock they took and saw none of the other's,
--  so the one guard that could have stopped two users editing the same
--  thing never fired between them. Its own header said the dev team
--  would repoint it at the server. This is that server.
--
--  WHAT A "SECTION" IS
--  -------------------
--  Whatever the client calls a record: `capital`, `projects::3`,
--  `budgetPlans::1`, `raci::2.4` — the keys idToRecordKey() produces.
--  The server does not interpret them; it stores the string. That keeps
--  the vocabulary in one place (the client, which knows its own
--  document) and lets a new program add records without a migration.
--
--  LIVENESS
--  --------
--  A lock is a heartbeat, not a latch. `beat_at` is refreshed by its
--  holder every few seconds; a lock whose holder went quiet for longer
--  than the TTL (Core\WorkspaceLock::TTL_SECONDS, 15s — the same
--  Collab.LOCK_TTL the client has always used) is dead and may be taken
--  by anyone. A closed tab, a killed browser or a lost connection
--  therefore frees its locks on its own, with nothing to clean up by
--  hand. Rows are swept on read, so the table stays the size of the
--  people actually editing.
--
--  Idempotent: safe to run more than once.
-- ============================================================

USE `pipeline`;

CREATE TABLE IF NOT EXISTS `workspace_locks` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED NOT NULL,
  `module`          VARCHAR(40)  NOT NULL DEFAULT 'pipeline',
  -- The record key, exactly as the client names it (idToRecordKey).
  `section`         VARCHAR(160) NOT NULL,
  -- Who holds it. public_id, not the internal row id: it is what the
  -- client already sends as actor_id and what it compares against.
  `user_public_id`  VARCHAR(64)  NOT NULL,
  -- Denormalised on purpose: every other screen shows "Ada is editing"
  -- and a JOIN per poll, every 4 seconds, per person, buys nothing.
  `user_name`       VARCHAR(150) NOT NULL DEFAULT '',
  `claimed_at`      DATETIME     NOT NULL,
  `beat_at`         DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  -- One holder per section per program. This is the whole guarantee:
  -- the second claimant collides with the row and is told who has it.
  UNIQUE KEY `uq_lock_section` (`organization_id`, `module`, `section`),
  KEY `idx_lock_beat` (`beat_at`),
  CONSTRAINT `fk_lock_org` FOREIGN KEY (`organization_id`)
    REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
