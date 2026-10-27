-- ============================================================
--  AI Innovation Pipeline — database schema
--  Run once:  mysql -u root < api/sql/schema.sql
--  (XAMPP default: user "root", empty password)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `pipeline`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pipeline`;

-- ---------- organizations ----------
CREATE TABLE IF NOT EXISTS `organizations` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id`         VARCHAR(32)  NOT NULL,         -- app-facing id, e.g. org_a1b2c3d
  `name`              VARCHAR(150) NOT NULL,
  `account_type`      VARCHAR(20)  NOT NULL DEFAULT 'enterprise',  -- role space: enterprise | leader (api/sql/roles.sql)
  `industry`          VARCHAR(120) NULL,
  `company_size`      VARCHAR(40)  NULL,
  `region`            VARCHAR(120) NULL,
  `website`           VARCHAR(150) NULL,
  `ai_maturity`       VARCHAR(40)  NULL,
  `executive_sponsor` VARCHAR(120) NULL,
  `objective`         TEXT         NULL,
  `created_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_org_public_id` (`public_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS `users` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id`        VARCHAR(32)  NOT NULL,          -- app-facing id, e.g. usr_a1b2c3d
  `organization_id`  INT UNSIGNED NOT NULL,
  `name`             VARCHAR(120) NOT NULL,
  `username`         VARCHAR(60)  NULL,              -- NULL allowed: a member may have no login yet
  `pin_hash`         VARCHAR(255) NOT NULL,          -- password_hash() of the PIN
  `role`             VARCHAR(60)  NOT NULL DEFAULT 'Administrator',
  `initials`         VARCHAR(8)   NOT NULL DEFAULT '',
  `color`            VARCHAR(16)  NOT NULL DEFAULT '#B8892A',
  `scope`            VARCHAR(60)  NOT NULL DEFAULT 'All',
  `email`            VARCHAR(150) NULL,
  `department`       VARCHAR(80)  NULL,
  `is_admin`         TINYINT(1)   NOT NULL DEFAULT 0,
  `is_seed`          TINYINT(1)   NOT NULL DEFAULT 0,   -- 1 = created by the sample-data seed; wiped on re-seed
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_public_id` (`public_id`),
  -- Sign-in asks for a username and a PIN and nothing else, so a username has
  -- to identify one person across the WHOLE installation — and an email address
  -- has to as well, because the invitation, the notification and the credential
  -- mail are all sent to it. Both indexes permit any number of NULLs, so a
  -- member with no login yet (username NULL) is still legal.
  -- See api/sql/global-unique-login.sql to migrate an existing database.
  UNIQUE KEY `uq_user_username` (`username`),
  UNIQUE KEY `uq_user_email`    (`email`),
  KEY `idx_user_org` (`organization_id`),
  CONSTRAINT `fk_user_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- messages ----------
-- Team-chat messages, one row per message, scoped to an organization.
CREATE TABLE IF NOT EXISTS `messages` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED NOT NULL,
  `user_public_id`  VARCHAR(32)  NULL,
  `user_name`       VARCHAR(120) NOT NULL,
  `initials`        VARCHAR(8)   NOT NULL DEFAULT '',
  `color`           VARCHAR(16)  NOT NULL DEFAULT '#4866A0',
  `body`            TEXT         NOT NULL,
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_org` (`organization_id`),
  CONSTRAINT `fk_msg_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- notes ----------
-- Private per-user notes (each user sees only their own).
CREATE TABLE IF NOT EXISTS `notes` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_public_id` VARCHAR(32)  NOT NULL,
  `step`           VARCHAR(20)  NULL,
  `body`           TEXT         NOT NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notes_user` (`user_public_id`),
  CONSTRAINT `fk_notes_user`
    FOREIGN KEY (`user_public_id`) REFERENCES `users` (`public_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- step_assignments ----------
-- Who is assigned to each step, per organization AND program module. One row
-- per (organization, module, step, member): every program numbers its steps the
-- same way, so '1.1' without a module meant one assignment shared by unrelated
-- steps in different programs. Keyed by the member's stable
-- public_id so assignments follow the user across devices. Toggling a member
-- on a step inserts/deletes a row; the whole set for an org loads on sign-in.
CREATE TABLE IF NOT EXISTS `step_assignments` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` INT UNSIGNED NOT NULL,
  `module`          VARCHAR(40)  NOT NULL DEFAULT 'pipeline',  -- which program
  `step_id`         VARCHAR(20)  NOT NULL,             -- e.g. '1.1', '3.2'
  `user_public_id`  VARCHAR(32)  NOT NULL,             -- users.public_id of the assignee
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assignment_module` (`organization_id`, `module`, `step_id`, `user_public_id`),
  KEY `idx_asg_org` (`organization_id`),
  CONSTRAINT `fk_asg_org`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asg_user`
    FOREIGN KEY (`user_public_id`) REFERENCES `users` (`public_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- app_admin ----------
-- One row for the whole app: the passcode that unlocks the admin console.
CREATE TABLE IF NOT EXISTS `app_admin` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `passcode_hash`  VARCHAR(255) NOT NULL,             -- password_hash() of the passcode
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
