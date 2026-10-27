-- ─────────────────────────────────────────────────────────────────────────────
--  Sweep 4R item 4 (addendum to the three module directives, 5 Oct 2026)
--  A lock belongs to a SESSION (a browser tab), not to a person.
--
--  Two tabs of the same person, or the app administrator's Open (which acts as the
--  organization's first member), must lock each other out like anyone else. The
--  holder is therefore the pair (user_public_id, tab_id): a claim, a heartbeat or a
--  release succeeds only for the same person in the same tab. A client that sends
--  no tab id uses '' — one tab per person, exactly the behaviour before this file.
--
--  Additive and reversible: ALTER TABLE `workspace_locks` DROP COLUMN `tab_id`;
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `workspace_locks`
  ADD COLUMN `tab_id` VARCHAR(40) NOT NULL DEFAULT '' AFTER `user_public_id`;
