<?php
namespace Models;

use Core\Model;

/**
 * Step assignments — which members are assigned to which step, scoped to an
 * organization AND a program module. One row per (organization, module, step,
 * member).
 *
 * The module is part of the key because every program numbers its steps the
 * same way: '1.1' is a different piece of work in each, and one row for it
 * meant that assigning someone in one program assigned them in all of them.
 * See api/sql/assignment-modules.sql.
 */
class Assignment extends Model
{
    /** Every assignment for one organization's program: [{step, user_public_id}, ...]. */
    public function forOrg(int $organizationId, string $module): array
    {
        return $this->select(
            'SELECT step_id AS step, user_public_id
               FROM step_assignments
              WHERE organization_id = :oid AND module = :mod
              ORDER BY step_id',
            [':oid' => $organizationId, ':mod' => $module]
        );
    }

    /** Is this member already on this step? */
    public function isAssigned(int $organizationId, string $module, string $stepId, string $userPublicId): bool
    {
        $rows = $this->select(
            'SELECT 1 AS hit
               FROM step_assignments
              WHERE organization_id = :oid AND module = :mod
                AND step_id = :step AND user_public_id = :uid
              LIMIT 1',
            [
                ':oid'  => $organizationId, ':mod' => $module,
                ':step' => $stepId,         ':uid' => $userPublicId,
            ]
        );
        return $rows !== [];
    }

    /**
     * Assign or unassign a member to a step of one program (idempotent).
     * assigned=true inserts the row (ignored if it already exists);
     * assigned=false removes it. Returns true on success.
     */
    public function set(int $organizationId, string $module, string $stepId, string $userPublicId, bool $assigned): bool
    {
        if ($assigned) {
            $stmt = $this->db->prepare(
                'INSERT INTO step_assignments (organization_id, module, step_id, user_public_id)
                 VALUES (:oid, :mod, :step, :uid)
                 ON DUPLICATE KEY UPDATE user_public_id = user_public_id'
            );
        } else {
            $stmt = $this->db->prepare(
                'DELETE FROM step_assignments
                  WHERE organization_id = :oid AND module = :mod
                    AND step_id = :step AND user_public_id = :uid'
            );
        }
        return $stmt->execute([
            ':oid'  => $organizationId, ':mod' => $module,
            ':step' => $stepId,         ':uid' => $userPublicId,
        ]);
    }
}
