<?php
namespace Models;

use Core\Model;

/**
 * Who changed what in a workspace, and when.
 *
 * One row per accepted write, holding only the top-level sections that write
 * changed, with their value before and after. The reasoning — why sections and
 * not snapshots, why coalescing is not optional, why the actor is stored as an
 * id — is in api/sql/workspace-history.sql; this is the implementation.
 *
 * Written from Models\Workspace, which is where the rev is decided and where
 * the before and after are both in hand. Read by
 * WorkspaceController::history(), which filters every row through
 * Core\DocPrivacy before it leaves the server.
 *
 * Nothing here may throw into a save. The document is the product; its history
 * is a convenience, and a convenience that can fail a write is worse than no
 * history at all. Every entry point swallows its own errors and says so.
 */
class WorkspaceRevision extends Model
{
    /** A write that continues this one — same member, same sections — folds in. */
    private const COALESCE_WINDOW_SECONDS = 120;

    /** Revisions kept per (organization, module). Older ones are pruned on write. */
    private const KEEP_PER_WORKSPACE = 200;

    /**
     * Record one accepted write.
     *
     * @param object|null $before  The document as it stood, or null on a first write.
     * @param object      $after   The document as it now stands.
     * @param string[]    $keys    Top-level keys this write claimed to touch. Empty
     *                             means "work it out" — the whole-document path,
     *                             which knows only that it replaced everything.
     * @param string[]    $removed Top-level keys this write deleted.
     * @param string|null $prevWriter  Who made the rev this one builds on
     *                                 (workspaces.updated_by as it stood). Used
     *                                 to decide whether this is the same piece
     *                                 of work continuing — see coalesceInto().
     */
    public function record(
        int $orgId,
        string $module,
        int $rev,
        int $baseRev,
        ?string $actor,
        ?object $before,
        object $after,
        array $keys = [],
        array $removed = [],
        ?string $prevWriter = null
    ): void {
        try {
            $changed = self::diffSections($before, $after, $keys, $removed);
            if (!$changed) {
                return;               // a save that changed nothing is not history
            }
            if ($this->coalesceInto($orgId, $module, $rev, $actor, $changed, $prevWriter)) {
                return;
            }
            $json = json_encode($changed, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($json === false) {
                return;
            }
            $this->execute(
                'INSERT INTO workspace_revisions
                    (organization_id, module, rev, base_rev, actor_public_id, changed)
                 VALUES (?, ?, ?, ?, ?, ?)',
                [$orgId, $module, $rev, $baseRev, $actor, $json]
            );
            $this->prune($orgId, $module);
        } catch (\Throwable $e) {
            error_log('workspace history not recorded for org ' . $orgId
                . ' module ' . $module . ' rev ' . $rev . ': ' . $e->getMessage());
        }
    }

    /**
     * Fold this write into the member's previous one when it is plainly the same
     * piece of work continuing: same member, inside the window.
     *
     * Without this the table is a keystroke log — the client saves about once a
     * second and a half while somebody types, so a paragraph is twenty rows
     * saying the same thing at growing lengths, and the history is unreadable
     * precisely where somebody worked hardest.
     *
     * The earliest `before` is kept and the latest `after` taken, per section,
     * so the folded row still describes one whole change: what the section said
     * when they started, and what it says now.
     *
     * @return bool true when it was folded and there is nothing more to do.
     */
    private function coalesceInto(int $orgId, string $module, int $rev, ?string $actor, array $changed, ?string $prevWriter): bool
    {
        $prev = $this->selectOne(
            'SELECT id, rev, actor_public_id, changed, updated_at
               FROM workspace_revisions
              WHERE organization_id = ? AND module = ?
              ORDER BY rev DESC
              LIMIT 1',
            [$orgId, $module]
        );
        if ($prev === null) {
            return false;
        }
        // A different member's change is a different entry, always: folding two
        // people's work into one row would attribute half of it to the wrong one.
        if ((string) $prev['actor_public_id'] !== (string) $actor) {
            return false;
        }
        if (strtotime((string) $prev['updated_at']) < time() - self::COALESCE_WINDOW_SECONDS) {
            return false;
        }
        /* Has anybody else written in between? Asked of the WORKSPACE's last
           writer, not of the revs.

           Adjacency was the obvious test and it was wrong: not every accepted
           write produces a history entry. A save that changes nothing still
           moves the rev — the client re-posts a section it has not altered
           often enough — so one of those between two real edits left the revs
           a step apart and split somebody's paragraph into two entries for no
           reason a reader could see. workspaces.updated_by is the honest
           answer: it names whoever made the rev this one builds on, whether or
           not that write was worth recording. */
        if ((int) $prev['rev'] >= $rev) {
            return false;                       // out of order; leave it alone
        }
        if ($prevWriter === null || (string) $prevWriter !== (string) $actor) {
            return false;
        }

        $held = json_decode((string) $prev['changed'], true);
        if (!is_array($held)) {
            return false;
        }
        foreach ($changed as $key => $pair) {
            if (array_key_exists($key, $held)) {
                $held[$key]['after'] = $pair['after'];   // their earlier `before` stands
            } else {
                $held[$key] = $pair;
            }
        }
        $json = json_encode($held, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return false;
        }
        $stmt = $this->db->prepare(
            'UPDATE workspace_revisions
                SET rev = ?, changed = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?'
        );
        $stmt->execute([$rev, $json, (int) $prev['id']]);
        return $stmt->rowCount() > 0;
    }

    /** Keep the table bounded; a long-running program must not grow for ever. */
    private function prune(int $orgId, string $module): void
    {
        $row = $this->selectOne(
            'SELECT rev FROM workspace_revisions
              WHERE organization_id = ? AND module = ?
              ORDER BY rev DESC LIMIT 1 OFFSET ' . (int) self::KEEP_PER_WORKSPACE,
            [$orgId, $module]
        );
        if ($row === null) {
            return;
        }
        $stmt = $this->db->prepare(
            'DELETE FROM workspace_revisions
              WHERE organization_id = ? AND module = ? AND rev <= ?'
        );
        $stmt->execute([$orgId, $module, (int) $row['rev']]);
    }

    /**
     * What happened in this workspace, newest first.
     *
     * @param int|null    $sinceRev Only revisions ABOVE this rev — which is how a
     *                              client that holds rev N asks "what have I just
     *                              been handed, and who did it".
     * @param string|null $actor    Only this member's changes.
     */
    public function forOrg(int $orgId, string $module, ?int $sinceRev = null, ?string $actor = null, int $limit = 50): array
    {
        $sql = 'SELECT rev, base_rev, actor_public_id, changed, created_at, updated_at
                  FROM workspace_revisions
                 WHERE organization_id = ? AND module = ?';
        $args = [$orgId, $module];
        if ($sinceRev !== null) {
            $sql .= ' AND rev > ?';
            $args[] = $sinceRev;
        }
        if ($actor !== null && $actor !== '') {
            $sql .= ' AND actor_public_id = ?';
            $args[] = $actor;
        }
        $sql .= ' ORDER BY rev DESC LIMIT ' . max(1, min(200, $limit));
        return $this->select($sql, $args);
    }

    /**
     * Which top-level sections this write actually changed, with both values.
     *
     * `$keys` is what the caller CLAIMED to change — the patch endpoint knows
     * exactly, the whole-document path does not and passes nothing, in which
     * case every top-level key is compared. Either way a key whose value did not
     * move is dropped: the client re-posts a whole section to change one field
     * in it, and a history that recorded every such write as a change to
     * everything would be no history at all.
     */
    private static function diffSections(?object $before, object $after, array $keys, array $removed): array
    {
        $out = [];
        $names = $keys;
        if (!$names) {
            $names = array_keys((array) $after);
            if ($before !== null) {
                $names = array_unique(array_merge($names, array_keys((array) $before)));
            }
        }
        foreach ($names as $key) {
            $key = (string) $key;
            if ($key === 'rev' || $key === 'schemaVersion') {
                continue;             // bookkeeping, not content — see MERGE_SKIP in js/app.js
            }
            $b = ($before !== null && property_exists($before, $key)) ? $before->$key : null;
            $a = property_exists($after, $key) ? $after->$key : null;
            if (self::same($b, $a)) {
                continue;
            }
            $out[$key] = ['before' => $b, 'after' => $a];
        }
        foreach ($removed as $key) {
            $key = (string) $key;
            if (isset($out[$key]) || $before === null || !property_exists($before, $key)) {
                continue;
            }
            $out[$key] = ['before' => $before->$key, 'after' => null];
        }
        return $out;
    }

    /**
     * Are two section values the same thing? Encoded rather than compared with
     * ==, because these are arbitrary nested JSON and PHP's loose comparison has
     * opinions about objects that JSON does not.
     */
    private static function same($a, $b): bool
    {
        return json_encode($a, JSON_UNESCAPED_SLASHES) === json_encode($b, JSON_UNESCAPED_SLASHES);
    }
}
