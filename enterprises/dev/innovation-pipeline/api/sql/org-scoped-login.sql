-- ============================================================
--  Sign-in is scoped to an organization
--  Run once:  mysql -u root pipeline < api/sql/org-scoped-login.sql
--  (XAMPP default: user "root", empty password)
-- ============================================================
--
--  WHAT CHANGES
--  `users.username` was globally unique, because sign-in asked for a username
--  and a PIN and nothing else — so a username had to identify a person across
--  the whole installation. Two consequences, both of them wrong:
--
--    * one tenant's roster could block another's. The second organization to
--      want "maria", "admin" or "info" was told the name was taken, by an
--      organization it cannot see and has nothing to do with.
--    * "who is `maria`?" had exactly one answer per installation, and the app
--      answered it by searching. Any search that finds the wrong row signs the
--      wrong person in.
--
--  Sign-in now asks for the organization first (AuthController::login), so a
--  username only has to be unique inside its own tenant. This swaps the global
--  unique index for a composite one.
--
--  BEFORE YOU RUN IT, the composite index is narrower than the old one, so
--  nothing that was legal becomes illegal — there is no data to clean up and no
--  row can be rejected. It is safe to re-run: each step checks first.
--
--  Existing sign-ins keep working. Members sign in with the same username and
--  PIN; they now also name their organization, which is its name (or, if two
--  organizations share a name, the organization code shown in the admin console
--  and in every invitation email).
-- ============================================================

-- ---------- drop the global unique index, if it is still there ----------
SET @drop_old := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'users'
         AND INDEX_NAME   = 'uq_user_username'
    ),
    'ALTER TABLE `users` DROP INDEX `uq_user_username`',
    'DO 0'
  )
);
PREPARE stmt FROM @drop_old; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- add the per-organization unique index, if it is not ----------
SET @add_new := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'users'
         AND INDEX_NAME   = 'uq_user_org_username'
    ),
    'DO 0',
    'ALTER TABLE `users` ADD UNIQUE KEY `uq_user_org_username` (`organization_id`, `username`)'
  )
);
PREPARE stmt FROM @add_new; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- an index for the sign-in lookup itself ----------
-- Sign-in now reads WHERE organization_id = ? AND username = ?, which the
-- composite unique index above already serves. Nothing further is needed; this
-- comment is here so the next reader does not go looking for a missing one.
