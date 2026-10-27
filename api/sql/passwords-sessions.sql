-- ─────────────────────────────────────────────────────────────
-- passwords-sessions.sql — Directive 2 Oct 2026, Parts 5 and 6 (live, 6 Oct 2026)
-- ─────────────────────────────────────────────────────────────
-- PINs become passwords, and identity moves from ids the browser sends to a
-- server session behind an HttpOnly cookie.
--
--  users.pin_hash     keeps its name (every query already reads it) but now holds a
--                     PASSWORD hash — Argon2id for every password set from now on.
--                     A bcrypt PIN hash already stored still verifies: a correct PIN
--                     signs in once with must_change (Part 6.1.15), so nobody is locked
--                     out and nothing has to be converted by hand.
--                     NULL = no sign-in yet (a member added without a password, or a
--                     sample person): sign-in answers 'no-credential'.
--  users.must_change  a temporary password: until it is replaced, the person can do
--                     nothing else (6.1.6).
--  app_admin.username the app administrator signs in with a username and a password
--                     (5.12); 'admin' for the row that already exists.
--  app_admin.must_change  the published default works once (5.12.2).
--  sessions           one row per signed-in browser; the cookie holds a random token and
--                     this table only its SHA-256 (6.1.3).
--  login_attempts     failed sign-ins, for the lockout (5 in 15 minutes) and the slow-down
--                     by internet address (6.1.7).
--  auth_events        sign-ins, failed sign-ins, password changes and temporary passwords,
--                     with time and username — never a request body (6.1.8).
--
-- Safe to run once on a database that has the earlier schema. Back up first.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE users
  MODIFY pin_hash VARCHAR(255) NULL COMMENT 'password hash (Argon2id; older rows bcrypt) — NULL: no sign-in yet',
  ADD COLUMN must_change TINYINT(1) NOT NULL DEFAULT 0 AFTER pin_hash;

ALTER TABLE app_admin
  ADD COLUMN username VARCHAR(60) NOT NULL DEFAULT 'admin' AFTER id,
  ADD COLUMN must_change TINYINT(1) NOT NULL DEFAULT 0 AFTER passcode_hash;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash     CHAR(64)      NOT NULL,
  kind           ENUM('member','admin') NOT NULL,
  user_public_id VARCHAR(32)   NULL,
  remember       TINYINT(1)    NOT NULL DEFAULT 0,
  must_change    TINYINT(1)    NOT NULL DEFAULT 0,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     DATETIME      NULL,
  PRIMARY KEY (token_hash),
  KEY ix_sessions_user (user_public_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_public_id) REFERENCES users (public_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username  VARCHAR(60)  NOT NULL,
  ip        VARCHAR(45)  NOT NULL DEFAULT '',
  at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_attempts_user (username, at),
  KEY ix_attempts_ip (ip, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_events (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event     VARCHAR(40)  NOT NULL,
  username  VARCHAR(60)  NOT NULL DEFAULT '',
  ip        VARCHAR(45)  NOT NULL DEFAULT '',
  at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_events_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
