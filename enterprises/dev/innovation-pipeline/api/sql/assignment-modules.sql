-- ============================================================
--  Step assignments, per program module
--  Run once, after workspace-modules.sql:
--      mysql -u root < api/sql/assignment-modules.sql
--
--  step_assignments answers "who is responsible for finishing this
--  section", and the app uses it to decide who may sign a step off
--  (stepCompleteLock, js/features/assignments.js). It was keyed by
--  (organization, step, member) — org-wide, from before the suite ran
--  more than one program.
--
--  Every program numbers its steps the same way. Step 1.1 is
--  "Brainstorm Ideas" in the AI Innovation Pipeline and "Assessment
--  Battery" in Executive Readiness, and there is one row for '1.1'. So
--  assigning a colleague to 1.1 in one program assigned them to a
--  completely unrelated 1.1 in the other, and — once the sign-off lock
--  was switched on for Executive Readiness — locked a step they had
--  never been asked about.
--
--  Same fix as the workspace document: the row is identified by
--  organization AND module. Existing rows are the Pipeline's, so the
--  column defaults to 'pipeline' and everything already in the table
--  is correct as it stands. Nothing needs backfilling, and a request
--  that omits the module is still served the Pipeline's assignments.
--
--  Idempotent: safe to run more than once (see the guards below).
-- ============================================================

USE `pipeline`;

-- ---------- step_assignments.module ----------
-- MySQL has no ADD COLUMN IF NOT EXISTS before 8.0.29, so check first.
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'step_assignments' AND COLUMN_NAME = 'module'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `step_assignments`
     ADD COLUMN `module` VARCHAR(40) NOT NULL DEFAULT ''pipeline'' AFTER `organization_id`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- One assignment per (organization, module, step, member).
--
-- ORDER MATTERS: the new key goes on BEFORE the old one comes off. The foreign
-- key on organization_id needs some index that starts with that column, and
-- dropping the only one first fails with errno 1553. The new composite key
-- leads with organization_id, so once it exists the constraint is satisfied and
-- the old key is free to go.
SET @has_new := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'step_assignments' AND INDEX_NAME = 'uq_assignment_module'
);
SET @sql := IF(@has_new = 0,
  'ALTER TABLE `step_assignments`
     ADD UNIQUE KEY `uq_assignment_module` (`organization_id`, `module`, `step_id`, `user_public_id`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_old := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'step_assignments' AND INDEX_NAME = 'uq_assignment'
);
SET @sql := IF(@has_old > 0, 'ALTER TABLE `step_assignments` DROP INDEX `uq_assignment`', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
