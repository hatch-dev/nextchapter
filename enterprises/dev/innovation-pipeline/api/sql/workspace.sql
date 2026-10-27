-- ============================================================
--  AI Innovation Pipeline — workspace persistence
--  Run once, after schema.sql:  mysql -u root < api/sql/workspace.sql
--
--  Moves the 90-day program's working state out of each browser's
--  localStorage and into MySQL, so a team sees the same data from any
--  browser or machine.
--
--  Two tables, two different jobs:
--
--   `workspaces`   The SOURCE OF TRUTH. One row per organization holding
--                  the whole program state as a JSON document — every
--                  phase's answers, ideas, portfolio, capital, RACI, and
--                  progress. The app reads and writes this document whole
--                  (it mirrors the shape of emptyData() in js/app.js).
--
--   `step_answers` A DERIVED, QUERYABLE PROJECTION. The server rewrites
--                  these rows from the document on every save (see
--                  Core\AnswerProjector). One row per answered question,
--                  tagged with its phase and step, so the Q&A can be read
--                  with plain SQL for reporting/export without parsing
--                  JSON. Never written by the app directly — deleting a
--                  row here changes nothing; the document wins.
-- ============================================================

USE `pipeline`;

-- ---------- workspaces ----------
-- One row per organization. `rev` powers optimistic concurrency: the client
-- sends the rev it based its edit on, and the save is rejected (HTTP 409) if
-- the stored rev has moved on — so two people editing at once can't silently
-- overwrite each other. See WorkspaceController::save().
CREATE TABLE IF NOT EXISTS `workspaces` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED NOT NULL,
  `module`          VARCHAR(40)  NOT NULL DEFAULT 'pipeline', -- which program: 'pipeline', 'exec-readiness', …
  `rev`             INT UNSIGNED NOT NULL DEFAULT 0,   -- bumped on every accepted save
  `schema_version`  INT UNSIGNED NOT NULL DEFAULT 1,   -- mirrors Store.schemaVersion() on the client
  `doc`             LONGTEXT     NOT NULL,             -- the whole program state, JSON-encoded
  `updated_by`      VARCHAR(32)  NULL,                 -- users.public_id of the last writer
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Each organization runs several programs; one workspace per org per module.
  UNIQUE KEY `uq_workspace_org_module` (`organization_id`, `module`),
  CONSTRAINT `fk_workspace_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- step_answers ----------
-- The readable Q&A trail: one row per question the team has answered, tagged
-- with the phase and step it belongs to. Rebuilt from `workspaces`.`doc` on
-- every save, so it is always consistent with the document.
--
--   SELECT step_id, question_text, answer
--     FROM step_answers
--    WHERE organization_id = 1 AND phase = 1
--    ORDER BY step_id;
CREATE TABLE IF NOT EXISTS `step_answers` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED NOT NULL,
  `module`          VARCHAR(40)  NOT NULL DEFAULT 'pipeline', -- the program these answers belong to
  `phase`           TINYINT UNSIGNED NOT NULL,         -- 1-5, matches the module's PH array
  `step_id`         VARCHAR(20)  NOT NULL,             -- e.g. '1.1', '3.2'
  `section`         VARCHAR(60)  NULL,                 -- sub-section within the step, when it has one
  `question_key`    VARCHAR(120) NOT NULL,             -- dot-path into the doc, e.g. 'purpose.mission'
  `question_text`   VARCHAR(255) NOT NULL,             -- the question as the user was asked it
  `answer`          TEXT         NULL,                 -- the answer, as text
  `updated_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- One row per question per org per module: the projector upserts on this key.
  UNIQUE KEY `uq_answer_module` (`organization_id`, `module`, `question_key`),
  KEY `idx_answer_phase` (`organization_id`, `phase`),
  KEY `idx_answer_step`  (`organization_id`, `step_id`),
  CONSTRAINT `fk_answer_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
