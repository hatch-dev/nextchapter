-- ─────────────────────────────────────────────────────────────
-- roles.sql — give every organization a role space
-- ─────────────────────────────────────────────────────────────
-- The suite serves two audiences over one identity system:
--
--   enterprise  an organization and its team running a 90-day
--               transformation program   /apps/enterprises/<module>
--   leader      an individual leader running a 90-day program
--               /apps/leaders/<module>
--
-- The tenant is the organization either way — a Leader account is an
-- organization of one — so the role lives on `organizations`, not on
-- `users`. That keeps exactly one answer to "which programs may this
-- workspace open", which is the only question the column exists to
-- answer (WorkspaceController::moduleFrom).
--
-- DEFAULT 'enterprise' is deliberate: every organization that existed
-- before roles did was an enterprise one, and both live modules
-- (pipeline, exec-readiness) are enterprise modules. Existing rows need
-- no backfill.
--
-- NOTE on users.role — that column is unrelated. It has always held a
-- job title ("Administrator", "Head of Ops") shown next to a member's
-- name. It is NOT this. Nothing here touches it.
--
-- Run once:
--   mysql -u root pipeline < api/sql/roles.sql
-- Idempotent on MySQL 8 / MariaDB 10.4+ (IF NOT EXISTS); on older
-- servers drop the IF NOT EXISTS and expect an error on a second run.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE `organizations`
  ADD COLUMN IF NOT EXISTS `account_type` VARCHAR(20) NOT NULL DEFAULT 'enterprise'
  AFTER `name`;

-- Every module a workspace has ever saved belongs to the enterprise
-- space today, so no data migration is needed. Should that change, the
-- fix-up is: set account_type from the role that owns the org's
-- workspaces (see config/catalogue.json for the mapping).
