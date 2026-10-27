<?php
namespace Models;

use Core\Model;

/**
 * Section locks — who is editing which part of a workspace, right now.
 *
 * The client has always had the lock UI (Collab in js/app.js: claim on focus,
 * paint "Locked · <name> is editing" for everyone else, refuse writes to a held
 * record, expire a lock whose holder goes quiet). What it did not have was a
 * shared place to keep them: localStorage is one browser, so two people on two
 * machines never saw each other's. This is that shared place.
 *
 * A lock is a HEARTBEAT, not a latch. Its holder refreshes `beat_at` every few
 * seconds; one that has not beaten for TTL_SECONDS is dead and anyone may take
 * it. Nothing has to be released explicitly for the system to stay correct — a
 * closed tab frees its locks by falling silent — but the client releases anyway
 * (on blur, on navigation, on sign-out) so a colleague is never made to wait out
 * the TTL for a field somebody merely passed through.
 *
 * @see api/sql/workspace-locks.sql
 */
class WorkspaceLock extends Model
{
    /** Seconds without a heartbeat after which a lock is considered abandoned.
     *  Matches Collab.LOCK_TTL in js/app.js — the two must agree or one side
     *  will show a lock the other has already given away. */
    public const TTL_SECONDS = 15;

    /**
     * Every live lock on a workspace, oldest claim first.
     *
     * Sweeps the dead ones on the way past. Reads are the frequent operation
     * (every client polls this every few seconds), so this is where the
     * cleaning gets done — no scheduled job, and the table never grows beyond
     * the people actually editing.
     *
     * @return array<int, array{section:string,user_public_id:string,user_name:string,claimed_at:string}>
     */
    public function live(int $orgId, string $module): array
    {
        $this->sweep();
        return $this->select(
            'SELECT section, user_public_id, tab_id, user_name, claimed_at, beat_at
               FROM workspace_locks
              WHERE organization_id = ? AND module = ?
                AND beat_at >= (NOW() - INTERVAL ? SECOND)
              ORDER BY claimed_at',
            [$orgId, $module, self::TTL_SECONDS]
        );
    }

    /**
     * Claim a section for a user, or refresh it if they already hold it.
     *
     * Returns the holder AFTER the attempt — which is the caller when the claim
     * succeeded, and somebody else when it did not. The client compares that id
     * with its own rather than trusting a boolean, so a refused claim tells it
     * who to name on screen.
     *
     * Atomicity is the point of the whole feature, so it is done in one
     * statement. INSERT … ON DUPLICATE KEY UPDATE with a guarded SET: the row is
     * taken over only when it is already mine or its heartbeat has expired.
     * Two browsers claiming the same free section at the same moment therefore
     * cannot both win — the unique key serialises them, and the loser's UPDATE
     * matches the guard as false and leaves the winner in place.
     *
     * @return array{user_public_id:string,user_name:string,mine:bool}
     */
    public function claim(int $orgId, string $module, string $section, string $userPublicId, string $userName, string $tabId = ''): array
    {
        /* Sweep 4R item 4 (addendum 5 Oct 2026): the holder is a SESSION — this person in this tab. Another tab of the same
           person is somebody else here, and so is the app administrator acting as the organization's first member. */
        $same = '(user_public_id = VALUES(user_public_id) AND tab_id = VALUES(tab_id))';
        $dead = 'beat_at < (NOW() - INTERVAL ' . self::TTL_SECONDS . ' SECOND)';
        /* Dead locks go first. MySQL applies the SET list below left to right and each later IF sees the values already
           changed, so once beat_at is refreshed an expired holder no longer reads as expired: a takeover of a dead lock
           would renew it in the OLD holder's name (true before this change too; the 4-second poll usually swept first). */
        $this->sweep();
        $this->execute(
            'INSERT INTO workspace_locks
                    (organization_id, module, section, user_public_id, tab_id, user_name, claimed_at, beat_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                claimed_at     = IF(' . $same . ', claimed_at, IF(' . $dead . ', NOW(), claimed_at)),
                user_name      = IF(' . $same . ' OR ' . $dead . ', VALUES(user_name), user_name),
                beat_at        = IF(' . $same . ' OR ' . $dead . ', NOW(), beat_at),
                tab_id         = IF(' . $same . ' OR ' . $dead . ', VALUES(tab_id), tab_id),
                user_public_id = IF(' . $same . ' OR ' . $dead . ', VALUES(user_public_id), user_public_id)',
            [$orgId, $module, $section, $userPublicId, $tabId, $userName]
        );

        $row = $this->selectOne(
            'SELECT user_public_id, tab_id, user_name FROM workspace_locks
              WHERE organization_id = ? AND module = ? AND section = ?',
            [$orgId, $module, $section]
        );

        return [
            'user_public_id' => (string) ($row['user_public_id'] ?? ''),
            'tab_id'         => (string) ($row['tab_id'] ?? ''),
            'user_name'      => (string) ($row['user_name'] ?? ''),
            'mine'           => ($row['user_public_id'] ?? '') === $userPublicId && (string) ($row['tab_id'] ?? '') === $tabId,
        ];
    }

    /** Release one section, but only if this session (this user, in this tab) is the one holding it. */
    public function release(int $orgId, string $module, string $section, string $userPublicId, string $tabId = ''): void
    {
        $this->execute(
            'DELETE FROM workspace_locks
              WHERE organization_id = ? AND module = ? AND section = ? AND user_public_id = ? AND tab_id = ?',
            [$orgId, $module, $section, $userPublicId, $tabId]
        );
    }

    /** Release everything this session holds in a workspace (sign-out, tab close). The person's other tabs keep theirs. */
    public function releaseAll(int $orgId, string $module, string $userPublicId, string $tabId = ''): void
    {
        $this->execute(
            'DELETE FROM workspace_locks
              WHERE organization_id = ? AND module = ? AND user_public_id = ? AND tab_id = ?',
            [$orgId, $module, $userPublicId, $tabId]
        );
    }

    /** Drop locks nobody has beaten for longer than the TTL. */
    public function sweep(): void
    {
        $this->execute(
            'DELETE FROM workspace_locks WHERE beat_at < (NOW() - INTERVAL ? SECOND)',
            [self::TTL_SECONDS]
        );
    }
}
