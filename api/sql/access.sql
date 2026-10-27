-- ============================================================
--  access.sql — application-level authorization + data isolation
--  Run once, after roles.sql / workspace-modules.sql / assignment-modules.sql:
--      mysql -u root pipeline < api/sql/access.sql
--
--  WHY THIS EXISTS
--  ---------------
--  Until now "which programs may this account open" had exactly one
--  answer: organizations.account_type, the role space (see roles.sql
--  and Core\Controller::moduleFrom). That is one column for the whole
--  organization, so every member of an Enterprise org could open all
--  six Enterprise programs and there was no way to say otherwise.
--
--  The suite now needs two finer answers, and they are different
--  questions, so they are two tables:
--
--    org_modules   WHICH PROGRAMS THE ORGANIZATION HAS.  The pool an
--                  Org Admin may assign from. Managed by the Super
--                  Admin. A Leader account is an organization of one,
--                  so this is also "the Leader apps this person chose
--                  at sign-up".
--
--    user_modules  WHICH OF THOSE A GIVEN MEMBER MAY OPEN.  Always a
--                  subset of the org's pool — the API intersects the
--                  two rather than trusting either alone, so revoking
--                  an org's program instantly revokes it for every
--                  member without touching a single user row.
--
--  Entitlement is now a JOIN, not a column. account_type stays exactly
--  as it was: it still decides which role space an account lives in and
--  is still what the URL /apps/{role}/... is checked against. What it
--  no longer does alone is decide access.
--
--  DATA ISOLATION
--  --------------
--  Two shared features were never scoped to a program and therefore
--  leaked across them:
--
--    notes     private per-user notes carried a `step` but no module,
--              so a note taken against decision 3 of The Decision Lab
--              appeared in the AI Innovation Pipeline's notes panel.
--    messages  team chat was one room per organization, so a message
--              sent while working in Executive Readiness showed up in
--              every other program the team opened.
--
--  Both gain a `module` column, defaulting to 'pipeline' for the same
--  reason workspaces.module did: every row already in the table was
--  written by the Pipeline, so existing data is correct as it stands
--  and nothing needs backfilling.
--
--  BACKFILL POLICY
--  ---------------
--  Existing accounts must not lose anything. Every organization is
--  granted its whole role space, and every existing user is granted
--  everything their organization has — which is precisely the access
--  they had the moment before this migration ran. New accounts choose
--  explicitly; old ones are grandfathered.
--
--  The module list below is a POINT-IN-TIME SNAPSHOT of
--  config/catalogue.json, which is the real source of truth and which
--  SQL cannot read. It is used only to seed grants for rows that exist
--  today. Adding a program to the catalogue later needs no edit here:
--  new grants are written by the application, not by this file.
--
--  Idempotent: safe to run more than once (IF NOT EXISTS + INSERT IGNORE
--  throughout, and the column adds are guarded for MySQL < 8.0.29).
-- ============================================================

USE `pipeline`;

-- ------------------------------------------------------------
--  1. org_modules — the organization's entitled pool
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `org_modules` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED NOT NULL,
  `module`          VARCHAR(40)  NOT NULL,          -- catalogue module.id
  `granted_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- One row per (organization, program). The application writes grants
  -- with INSERT IGNORE and deletes the difference, so re-granting what
  -- is already granted is a no-op rather than a duplicate.
  UNIQUE KEY `uq_org_module` (`organization_id`, `module`),
  CONSTRAINT `fk_orgmod_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  2. user_modules — the member's grant within that pool
-- ------------------------------------------------------------
-- Keyed by users.public_id rather than users.id, matching every other
-- table that points at a user (notes, messages, step_assignments): the
-- public id is what the client sends and what the API resolves, so a
-- grant lookup needs no extra join. users.public_id is UNIQUE
-- (uq_user_public_id in schema.sql), which is what lets it carry the FK.
CREATE TABLE IF NOT EXISTS `user_modules` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_public_id` VARCHAR(32)  NOT NULL,
  `module`         VARCHAR(40)  NOT NULL,           -- catalogue module.id
  `granted_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_module` (`user_public_id`, `module`),
  CONSTRAINT `fk_usermod_user`
    FOREIGN KEY (`user_public_id`) REFERENCES `users` (`public_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  3. mail_outbox — every message the app has tried to send
-- ------------------------------------------------------------
-- The invite mail an Org Admin triggers when they add a team member is
-- the first thing this application has ever posted out, and mail is the
-- one side effect you cannot inspect after the fact. So it is recorded
-- BEFORE it is attempted: the row is written 'queued', dispatch flips it
-- to 'sent' or 'failed' with the reason, and the Super Admin console
-- reads the table. With no SMTP configured every row simply stays
-- 'queued' and the invite is still readable/copyable from the console —
-- adding a member never fails because mail is not set up yet.
--
-- Deliberately carries NO foreign keys: deleting a user or an
-- organization must not erase the record of what was sent to them.
CREATE TABLE IF NOT EXISTS `mail_outbox` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id`       VARCHAR(32)  NOT NULL,
  `kind`            VARCHAR(40)  NOT NULL,          -- 'member-invite' | …
  `to_email`        VARCHAR(190) NOT NULL,
  `to_name`         VARCHAR(150) NULL,
  `subject`         VARCHAR(255) NOT NULL,
  `body_html`       MEDIUMTEXT   NOT NULL,
  `body_text`       MEDIUMTEXT   NULL,
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'queued',  -- queued|sent|failed
  `error`           TEXT         NULL,
  `attempts`        INT UNSIGNED NOT NULL DEFAULT 0,
  `organization_id` INT UNSIGNED NULL,
  `user_public_id`  VARCHAR(32)  NULL,
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at`         TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mail_public_id` (`public_id`),
  KEY `idx_mail_status` (`status`),
  KEY `idx_mail_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  4. notes.module — a note belongs to the program it was taken in
-- ------------------------------------------------------------
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notes' AND COLUMN_NAME = 'module'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `notes`
     ADD COLUMN `module` VARCHAR(40) NOT NULL DEFAULT ''pipeline'' AFTER `user_public_id`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notes' AND INDEX_NAME = 'idx_notes_user_module'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE `notes` ADD KEY `idx_notes_user_module` (`user_public_id`, `module`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
--  5. messages.module — one chat room per (organization, program)
-- ------------------------------------------------------------
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'module'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `messages`
     ADD COLUMN `module` VARCHAR(40) NOT NULL DEFAULT ''pipeline'' AFTER `organization_id`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Chat pages by (org, module, id > since); the composite index leads with
-- organization_id so the existing FK keeps an index it can use.
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND INDEX_NAME = 'idx_msg_org_module'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE `messages` ADD KEY `idx_msg_org_module` (`organization_id`, `module`, `id`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
--  6. Backfill — grandfather every account into what it already had
-- ------------------------------------------------------------
-- Snapshot of config/catalogue.json. See the header: this seeds grants
-- for rows that exist TODAY and is never consulted again.
INSERT IGNORE INTO `org_modules` (`organization_id`, `module`)
SELECT o.`id`, c.`module`
  FROM `organizations` o
  JOIN (
              SELECT 'exec-readiness'      AS `module`, 'enterprise' AS `role`
    UNION ALL SELECT 'pipeline',                        'enterprise'
    UNION ALL SELECT 'ai-governance',                   'enterprise'
    UNION ALL SELECT 'ai-architecture',                 'enterprise'
    UNION ALL SELECT 'ai-culture',                      'enterprise'
    UNION ALL SELECT 'workforce-readiness',             'enterprise'
    UNION ALL SELECT 'decision-lab',                    'leader'
    UNION ALL SELECT 'friction-map',                    'leader'
    UNION ALL SELECT 'connection-practice',             'leader'
    UNION ALL SELECT 'ethics-engine',                   'leader'
    UNION ALL SELECT 'authorship-studio',               'leader'
    UNION ALL SELECT 'narrative-forge',                 'leader'
  ) c ON c.`role` = COALESCE(o.`account_type`, 'enterprise');

-- Every existing member keeps everything their organization has, which is
-- exactly the access they had a moment ago. Derived from org_modules
-- rather than from the snapshot above, so the two can never disagree.
INSERT IGNORE INTO `user_modules` (`user_public_id`, `module`)
SELECT u.`public_id`, om.`module`
  FROM `users` u
  JOIN `org_modules` om ON om.`organization_id` = u.`organization_id`;
