-- ============================================================
--  Sign-in is by USERNAME alone — username and email are unique
--  Run once:  mysql -u root pipeline < api/sql/global-unique-login.sql
--  (XAMPP default: user "root", empty password)
-- ============================================================
--
--  WHAT CHANGES, AND WHY
--  The sign-in screen no longer asks for an organization. That field existed
--  to make a username unambiguous — a username only had to be unique inside
--  its own tenant (uq_user_org_username, api/sql/org-scoped-login.sql), so the
--  organization was needed to say WHICH "maria" was signing in.
--
--  Asking for it turned out to be the wrong trade. Nobody types their
--  organization's name the way the database spells it, an invitation email is
--  the only place the code appears, and the field refused more legitimate
--  sign-ins than it ever disambiguated. So the ambiguity is removed at the
--  source instead: a username identifies exactly one person in the whole
--  installation again, and sign-in needs nothing but the username and PIN.
--
--  Email joins it. Two accounts on one address were always a problem — the
--  invitation, the notification and the password-bearing mail all go to an
--  address that now belongs to two people — and it was never checked anywhere.
--
--  NULLs are still free. `username` is NULL for a member who has no login yet
--  and `email` may be NULL on old rows; MySQL's unique indexes permit any
--  number of NULLs, so neither becomes required by this migration.
--
--  BEFORE YOU RUN IT: these indexes are WIDER than the ones they replace, so
--  rows that were legal can become illegal. The two SELECTs below list exactly
--  which — run them first. If either returns rows, the ALTER after it will
--  fail with "Duplicate entry" and change nothing; resolve the duplicates
--  (rename, re-address, or delete the account that should not exist) and run
--  the file again. It is safe to re-run: each step checks first.
-- ============================================================

-- ---------- pre-flight: what would collide ----------
-- Any username held by more than one account. Must be empty before the swap.
SELECT 'DUPLICATE USERNAMES — resolve these first' AS `check`;
SELECT u.username, COUNT(*) AS accounts,
       GROUP_CONCAT(CONCAT(u.public_id, ' @ ', o.name) SEPARATOR ' | ') AS held_by
  FROM users u
  JOIN organizations o ON o.id = u.organization_id
 WHERE u.username IS NOT NULL AND u.username <> ''
 GROUP BY u.username
HAVING COUNT(*) > 1;

-- Any email held by more than one account. Same rule.
SELECT 'DUPLICATE EMAILS — resolve these first' AS `check`;
SELECT u.email, COUNT(*) AS accounts,
       GROUP_CONCAT(CONCAT(u.public_id, ' @ ', o.name) SEPARATOR ' | ') AS held_by
  FROM users u
  JOIN organizations o ON o.id = u.organization_id
 WHERE u.email IS NOT NULL AND u.email <> ''
 GROUP BY u.email
HAVING COUNT(*) > 1;

-- ---------- drop the per-organization unique index, if it is still there ----------
SET @drop_scoped := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'users'
         AND INDEX_NAME   = 'uq_user_org_username'
    ),
    'ALTER TABLE `users` DROP INDEX `uq_user_org_username`',
    'DO 0'
  )
);
PREPARE stmt FROM @drop_scoped; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- the global unique index on username ----------
SET @add_username := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'users'
         AND INDEX_NAME   = 'uq_user_username'
    ),
    'DO 0',
    'ALTER TABLE `users` ADD UNIQUE KEY `uq_user_username` (`username`)'
  )
);
PREPARE stmt FROM @add_username; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- …and on email ----------
SET @add_email := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'users'
         AND INDEX_NAME   = 'uq_user_email'
    ),
    'DO 0',
    'ALTER TABLE `users` ADD UNIQUE KEY `uq_user_email` (`email`)'
  )
);
PREPARE stmt FROM @add_email; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- the sign-in lookup itself ----------
-- Sign-in now reads WHERE username = ?, which uq_user_username serves on its
-- own. `idx_user_org` stays: the roster (WHERE organization_id = ?) used to
-- ride on the composite index that has just been dropped.
