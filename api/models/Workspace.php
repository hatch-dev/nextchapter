<?php
namespace Models;

use Core\Model;

/**
 * The organization's workspace — a 90-day program's whole working state.
 *
 * One row per organization PER MODULE (see api/sql/workspace.sql). The suite
 * runs several programs — 'pipeline', 'exec-readiness', … — over one shared
 * sign-in and one shared team; each keeps its own document. `module` defaults
 * to 'pipeline' everywhere, so callers written before modules existed still
 * address the Pipeline's document exactly as they did.
 *
 * The state is stored as
 * one JSON document because that is how the app uses it: js/app.js keeps the
 * program in a single `data` object and every screen reads straight off it.
 * Storing it whole keeps the database as the source of truth without forcing a
 * rewrite of the app's ~200 read/write call sites.
 *
 * Concurrency: `rev` is bumped on every accepted save. A client sends the rev
 * its edit was based on; save() refuses (returns null) if the stored rev has
 * moved on, so a second writer can never silently clobber the first. The
 * controller turns that refusal into an HTTP 409 and the client merges.
 */
class Workspace extends Model
{
    /** The workspace row for an organization's module, or null if it has none yet. */
    public function findByOrg(int $orgId, string $module = 'pipeline'): ?array
    {
        return $this->selectOne(
            'SELECT organization_id, module, rev, schema_version, doc, updated_by, updated_at
               FROM workspaces
              WHERE organization_id = ? AND module = ?',
            [$orgId, $module]
        );
    }

    /**
     * The current rev only — a cheap poll so clients can ask "has anything
     * changed?" without transferring the whole document.
     * Returns 0 when the organization has no workspace for this module yet.
     */
    public function revForOrg(int $orgId, string $module = 'pipeline'): int
    {
        $row = $this->selectOne(
            'SELECT rev FROM workspaces WHERE organization_id = ? AND module = ?',
            [$orgId, $module]
        );
        return $row === null ? 0 : (int) $row['rev'];
    }

    /**
     * Save the document if the caller's base rev still matches what is stored.
     *
     * @param  string   $json    The document as JSON TEXT, stored verbatim.
     *                           Text, not an array, so that no encode/decode
     *                           step here can re-shape it — PHP's assoc decoding
     *                           silently rewrites empty objects {} to arrays [],
     *                           which corrupts the app's state (see
     *                           WorkspaceController's class note).
     * @param  int|null $baseRev The rev the edit was based on. null skips the
     *                           check (first write / deliberate overwrite).
     * @return int|null          The new rev, or null when the write was refused
     *                           as stale (the caller should re-read and merge).
     */
    public function save(int $orgId, string $json, ?int $baseRev, ?string $updatedBy, int $schemaVersion = 1, string $module = 'pipeline'): ?int
    {
        $existing = $this->findByOrg($orgId, $module);

        // First write for this organization's module: create the row.
        if ($existing === null) {
            $this->execute(
                'INSERT INTO workspaces (organization_id, module, rev, schema_version, doc, updated_by)
                 VALUES (?, ?, 1, ?, ?, ?)',
                [$orgId, $module, $schemaVersion, $json, $updatedBy]
            );
            $this->recordHistory($orgId, $module, 1, 0, $updatedBy, null, $json);
            return 1;
        }

        $storedRev = (int) $existing['rev'];

        // Optimistic concurrency: someone else has written since this edit began.
        if ($baseRev !== null && $baseRev !== $storedRev) {
            return null;
        }

        $newRev = $storedRev + 1;

        // The WHERE ... AND rev = ? makes the check atomic: if a concurrent
        // request slipped in between the SELECT above and this UPDATE, it
        // matches no row and we report the write as stale rather than losing it.
        $stmt = $this->db->prepare(
            'UPDATE workspaces
                SET rev = ?, schema_version = ?, doc = ?, updated_by = ?
              WHERE organization_id = ? AND module = ? AND rev = ?'
        );
        $stmt->execute([$newRev, $schemaVersion, $json, $updatedBy, $orgId, $module, $storedRev]);

        // Every accepted save moves `rev`, so a matched row is always a changed
        // row: zero here means the WHERE found nothing — a concurrent write
        // bumped the rev between the SELECT above and this UPDATE. Report it as
        // stale rather than losing either edit.
        if ($stmt->rowCount() === 0) {
            return null;
        }

        /* Recorded only now, after the UPDATE has been accepted: a history entry
           for a write that was refused as stale would describe a change nobody
           ever made. No section list — this path replaced the document whole and
           genuinely does not know what moved, so the recorder compares. */
        $this->recordHistory($orgId, $module, $newRev, $storedRev, $updatedBy, $existing['doc'], $json, [], [], $existing['updated_by']);

        return $newRev;
    }

    /**
     * Hand one accepted write to the history (Models\WorkspaceRevision).
     *
     * Documents arrive here as JSON TEXT — deliberately, so nothing in this
     * class can re-shape them (see the class note) — so the decode happens here
     * and object-shaped, for the same reason: assoc decoding turns an empty
     * object into an empty array, and a history that says a section changed from
     * {} to [] would report a change nobody made on every first write.
     *
     * Never throws. The document is the product and its history is a
     * convenience; a convenience that can fail a save is worse than none.
     */
    private function recordHistory(
        int $orgId,
        string $module,
        int $rev,
        int $baseRev,
        ?string $actor,
        ?string $beforeJson,
        string $afterJson,
        array $keys = [],
        array $removed = [],
        ?string $prevWriter = null
    ): void {
        try {
            $after = json_decode($afterJson);
            if (!is_object($after)) {
                return;
            }
            $before = $beforeJson === null ? null : json_decode($beforeJson);
            (new WorkspaceRevision())->record(
                $orgId,
                $module,
                $rev,
                $baseRev,
                $actor,
                is_object($before) ? $before : null,
                $after,
                $keys,
                $removed,
                $prevWriter
            );
        } catch (\Throwable $e) {
            error_log('workspace history skipped for org ' . $orgId . ': ' . $e->getMessage());
        }
    }

    /**
     * Write only the sections the caller actually changed.
     *
     * WHY THIS EXISTS. save() replaces the document whole, so a client with a
     * slightly older copy of a section it never touched would put that older
     * copy back — two people working on different parts of the same program
     * could undo each other without either of them editing the same thing. The
     * optimistic rev check turned that into a 409 rather than silent loss, but a
     * 409 is a merge, and a merge is a guess. A write that names its sections
     * needs no guess: the parts nobody claimed to have changed are not written
     * at all, and cannot be lost.
     *
     * `$sections` is an object of top-level keys → new values, `$removed` a list
     * of top-level keys to delete. Everything else in the stored document is
     * left exactly as it is, whoever wrote it and whenever.
     *
     * CONCURRENCY. The patch applies to the CURRENT stored document, not to the
     * one the client last read — that is the point, and it is why two writers on
     * different sections both succeed instead of one being told to merge. The
     * read-modify-write is made safe by the same rev guard save() uses: if
     * anyone commits between the SELECT and the UPDATE, the UPDATE matches no
     * row and we start again with the newer document. Only a persistently
     * contended workspace exhausts the attempts, and then the caller gets the
     * ordinary stale answer.
     *
     * @param  object $sections  Top-level key → value. Decoded WITHOUT assoc, so
     *                           {} stays {} — see WorkspaceController's note.
     * @param  string[] $removed Top-level keys to delete.
     * @param  callable|null $sanitize  fn(object $sections, ?object $stored): object
     *                           — the caller's last word on what this write may
     *                           contain, evaluated against the document as it
     *                           stands INSIDE the retry loop. Used for per-member
     *                           privacy (Core\DocPrivacy); null leaves the
     *                           sections exactly as they were sent.
     * @return array{rev:int}|null  The new rev, or null if it could not be
     *                              applied (report as stale).
     */
    public function patch(int $orgId, object $sections, array $removed, ?string $updatedBy, int $schemaVersion, string $module, ?callable $sanitize = null): ?array
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $existing = $this->findByOrg($orgId, $module);

            // Nothing stored yet: the patch IS the document.
            if ($existing === null) {
                $write = $sanitize === null ? $sections : $sanitize($sections, null);
                $doc = new \stdClass();
                foreach ($write as $key => $value) {
                    $doc->$key = $value;
                }
                $json = json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                if ($json === false) {
                    return null;
                }
                $this->execute(
                    'INSERT INTO workspaces (organization_id, module, rev, schema_version, doc, updated_by)
                     VALUES (?, ?, 1, ?, ?, ?)',
                    [$orgId, $module, $schemaVersion, $json, $updatedBy]
                );
                $this->recordHistory($orgId, $module, 1, 0, $updatedBy, null, $json, array_keys((array) $write), $removed);
                return ['rev' => 1, 'doc' => $doc];
            }

            $storedRev = (int) $existing['rev'];
            $doc       = json_decode((string) $existing['doc']);   // objects, not assoc
            if (!is_object($doc)) {
                $doc = new \stdClass();
            }

            /* The last word on what this caller may actually write, applied HERE
               and not up in the controller: it has to see the document as it is
               at this instant. The loop re-reads on contention, and a decision
               taken against an earlier copy would graft that earlier copy back
               over whoever committed in between. Core\DocPrivacy is the
               implementation — a private section keeps everyone else's entries
               as stored and takes only the caller's own from the request. */
            $write = $sanitize === null ? $sections : $sanitize($sections, $doc);

            foreach ($write as $key => $value) {
                $doc->$key = $value;
            }
            foreach ($removed as $key) {
                if (is_string($key)) {
                    unset($doc->$key);
                }
            }

            $json = json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($json === false) {
                return null;
            }

            $newRev = $storedRev + 1;
            $stmt   = $this->db->prepare(
                'UPDATE workspaces
                    SET rev = ?, schema_version = ?, doc = ?, updated_by = ?
                  WHERE organization_id = ? AND module = ? AND rev = ?'
            );
            $stmt->execute([$newRev, $schemaVersion, $json, $updatedBy, $orgId, $module, $storedRev]);

            if ($stmt->rowCount() > 0) {
                /* The sections this write NAMED, so the history records what it
                   actually claimed rather than re-deriving it: a patch re-posts a
                   whole section to change one field in it, and the keys are the
                   truthful answer to "what did this write touch". */
                $this->recordHistory($orgId, $module, $newRev, $storedRev, $updatedBy, (string) $existing['doc'], $json, array_keys((array) $write), $removed, $existing['updated_by']);
                return ['rev' => $newRev, 'doc' => $doc];
            }
            // Someone committed in between. Re-read and apply to their document.
        }

        return null;
    }

    /**
     * Decode a stored row's `doc` into an array, for READING only (reporting,
     * projection). Never re-encode and store the result: assoc decoding turns
     * empty objects into empty arrays. To store, pass JSON text to save().
     */
    public function decodeDocForReading(array $row): array
    {
        $decoded = json_decode((string) $row['doc'], true);
        return is_array($decoded) ? $decoded : [];
    }
}
