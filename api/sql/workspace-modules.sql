-- ============================================================
--  Program modules — one workspace per (organization, module)
--  Run once, after workspace.sql:
--      mysql -u root < api/sql/workspace-modules.sql
--
--  The suite ships several 90-day programs (AI Innovation Pipeline,
--  Executive Readiness, …). They share one shell — the same sign-in,
--  the same organizations, the same team, the same header — but each
--  keeps its own working state. That state is still one JSON document;
--  what changes is that a document is now identified by organization
--  AND module rather than by organization alone.
--
--  Existing rows are the Pipeline's, so the column defaults to
--  'pipeline' and every row already in the table is correct as it
--  stands. Nothing needs backfilling and no client breaks: a request
--  that omits the module is served the Pipeline's document, exactly
--  as before.
--
--  Idempotent: safe to run more than once (see the guards below).
-- ============================================================

USE `pipeline`;

-- ---------- workspaces.module ----------
-- MySQL has no ADD COLUMN IF NOT EXISTS before 8.0.29, so check first.
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workspaces' AND COLUMN_NAME = 'module'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `workspaces`
     ADD COLUMN `module` VARCHAR(40) NOT NULL DEFAULT ''pipeline'' AFTER `organization_id`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- One workspace per organization PER MODULE. The old unique key allowed one
-- row per organization full stop, which would reject the second module's very
-- first save, so it is replaced rather than added to.
--
-- ORDER MATTERS: the new key goes on BEFORE the old one comes off. The
-- foreign key on organization_id needs some index that starts with that
-- column, and dropping the only one first fails with errno 1553. The new
-- composite key leads with organization_id, so once it exists the constraint
-- is satisfied and the old key is free to go.
SET @has_new := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workspaces' AND INDEX_NAME = 'uq_workspace_org_module'
);
SET @sql := IF(@has_new = 0,
  'ALTER TABLE `workspaces` ADD UNIQUE KEY `uq_workspace_org_module` (`organization_id`, `module`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_old := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workspaces' AND INDEX_NAME = 'uq_workspace_org'
);
SET @sql := IF(@has_old > 0, 'ALTER TABLE `workspaces` DROP INDEX `uq_workspace_org`', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- step_answers.module ----------
-- The readable Q&A projection is per module too: each program asks its own
-- questions, and two modules' answers must not collide on question_key.
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'step_answers' AND COLUMN_NAME = 'module'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `step_answers`
     ADD COLUMN `module` VARCHAR(40) NOT NULL DEFAULT ''pipeline'' AFTER `organization_id`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Same order for the same reason: add the replacement, then drop the original.
SET @has_new := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'step_answers' AND INDEX_NAME = 'uq_answer_module'
);
SET @sql := IF(@has_new = 0,
  'ALTER TABLE `step_answers` ADD UNIQUE KEY `uq_answer_module` (`organization_id`, `module`, `question_key`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_old := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'step_answers' AND INDEX_NAME = 'uq_answer'
);
SET @sql := IF(@has_old > 0, 'ALTER TABLE `step_answers` DROP INDEX `uq_answer`', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
