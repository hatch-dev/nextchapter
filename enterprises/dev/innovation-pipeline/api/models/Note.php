<?php
namespace Models;

use Core\Model;

/**
 * Private per-user notes, scoped to the program they were taken in.
 *
 * The `module` column arrived with api/sql/access.sql. Before it, a note
 * carried only a `step`, and every program in the suite numbers its own
 * anchors — step 1.1, decision 3 — so a note taken against The Decision Lab
 * showed up in the AI Innovation Pipeline's notes panel filed against a step
 * with nothing to do with it. Notes are private per user; they were not
 * private per program, and they had to be both.
 *
 * Existing rows default to 'pipeline' because that is what wrote every one of
 * them. See the same treatment of workspaces.module and step_assignments.module.
 */
class Note extends Model
{
    /** A user's notes for one program, newest first. */
    public function forUser(string $userPublicId, string $module): array
    {
        return $this->select(
            'SELECT id, step, module, body, created_at
               FROM notes WHERE user_public_id = :uid AND module = :module
              ORDER BY id DESC',
            [':uid' => $userPublicId, ':module' => $module]
        );
    }

    /** Insert a note and return the stored row. */
    public function create(string $userPublicId, string $body, ?string $step, string $module): array
    {
        $id = $this->execute(
            'INSERT INTO notes (user_public_id, module, step, body)
             VALUES (:uid, :module, :step, :body)',
            [
                ':uid'    => $userPublicId,
                ':module' => $module,
                ':step'   => ($step === '' ? null : $step),
                ':body'   => $body,
            ]
        );
        return $this->selectOne(
            'SELECT id, step, module, body, created_at FROM notes WHERE id = :id',
            [':id' => $id]
        );
    }

    /**
     * Delete a note, but only if it belongs to the given user.
     *
     * Not scoped by module on purpose: ownership is the security question here,
     * and the id already identifies exactly one row. Adding the module would
     * only make a delete fail when the client's idea of the current program has
     * moved on — a worse outcome with no safety gained.
     */
    public function deleteOwned(int $id, string $userPublicId): bool
    {
        $stmt = $this->db->prepare('DELETE FROM notes WHERE id = :id AND user_public_id = :uid');
        $stmt->execute([':id' => $id, ':uid' => $userPublicId]);
        return $stmt->rowCount() > 0;
    }
}
