<?php
namespace Models;

use Core\Model;

/**
 * Access — which programs an organization has, and which of those a member may open.
 *
 * Two grant tables, one question each (see api/sql/access.sql):
 *
 *   org_modules   the organization's POOL. What it has bought / been given.
 *                 Managed by the Super Admin. For a Leader account — an
 *                 organization of one — this is the set of Leader programs the
 *                 person chose at sign-up.
 *
 *   user_modules  a member's GRANT within that pool. Written by the Org Admin
 *                 when they add or edit a team member.
 *
 * The rule the whole application enforces is the INTERSECTION of the two, and
 * it is computed in exactly one place — forUser() below. Nothing else may
 * decide this: revoking a program from an organization has to revoke it from
 * every member of that organization instantly, without rewriting a single user
 * row, and an intersection is what makes that true. A user_modules row for a
 * program the org no longer holds is inert, not authoritative.
 *
 * Both writers are REPLACE-THE-SET operations rather than add/remove pairs.
 * The client sends the full list it wants the record to end up with, and the
 * model computes the difference. That makes a save idempotent and immune to a
 * lost "remove" — the two-request add/remove shape loses a revocation whenever
 * the second request fails, and a lost revocation is an access-control bug.
 */
class Access extends Model
{
    /* ── Organizations ──────────────────────────────────────────── */

    /** Every module id this organization holds. */
    public function forOrg(int $organizationId): array
    {
        return array_column($this->select(
            'SELECT module FROM org_modules WHERE organization_id = :oid ORDER BY module',
            [':oid' => $organizationId]
        ), 'module');
    }

    /**
     * The same, for many organizations at once — organization id → [module, …].
     *
     * The Super Admin console lists every organization with its programs, and
     * the per-org call above would make that N+1 queries against a table whose
     * whole job is to be consulted constantly.
     */
    public function forOrgs(array $organizationIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $organizationIds)));
        if ($ids === []) {
            return [];
        }
        $in   = implode(',', array_fill(0, count($ids), '?'));
        $rows = $this->select(
            "SELECT organization_id, module FROM org_modules
              WHERE organization_id IN ($in) ORDER BY module",
            $ids
        );

        $out = array_fill_keys($ids, []);
        foreach ($rows as $r) {
            $out[(int) $r['organization_id']][] = (string) $r['module'];
        }
        return $out;
    }

    /** Replace an organization's pool with exactly $modules. */
    public function setForOrg(int $organizationId, array $modules): array
    {
        $wanted = $this->clean($modules);
        $this->replaceSet(
            'org_modules',
            'organization_id',
            $organizationId,
            $this->forOrg($organizationId),
            $wanted
        );
        return $wanted;
    }

    /* ── Users ──────────────────────────────────────────────────── */

    /**
     * What this member may actually open: their grant, intersected with what
     * their organization holds. This is THE access answer — every check in the
     * API resolves to this method.
     */
    public function forUser(string $userPublicId, int $organizationId): array
    {
        return array_values(array_intersect(
            $this->grantedToUser($userPublicId),
            $this->forOrg($organizationId)
        ));
    }

    /**
     * The raw user_modules rows, WITHOUT the org intersection.
     *
     * Only two callers should want this: the editor that renders the admin's
     * tick boxes (which must show a box ticked even while the org's pool is
     * being changed around it) and setForUser's difference. Anything deciding
     * access wants forUser().
     */
    public function grantedToUser(string $userPublicId): array
    {
        return array_column($this->select(
            'SELECT module FROM user_modules WHERE user_public_id = :uid ORDER BY module',
            [':uid' => $userPublicId]
        ), 'module');
    }

    /** grantedToUser() for many members at once — public_id → [module, …]. */
    public function forUsers(array $userPublicIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('strval', $userPublicIds))));
        if ($ids === []) {
            return [];
        }
        $in   = implode(',', array_fill(0, count($ids), '?'));
        $rows = $this->select(
            "SELECT user_public_id, module FROM user_modules
              WHERE user_public_id IN ($in) ORDER BY module",
            $ids
        );

        $out = array_fill_keys($ids, []);
        foreach ($rows as $r) {
            $out[(string) $r['user_public_id']][] = (string) $r['module'];
        }
        return $out;
    }

    /**
     * Replace a member's grant with exactly $modules, clamped to the pool.
     *
     * The clamp is not a convenience — it is the guarantee that user_modules
     * can never name something the organization does not hold, so a later
     * change to the pool cannot silently widen anyone's access.
     *
     * @return array The modules actually stored (the clamped set).
     */
    public function setForUser(string $userPublicId, int $organizationId, array $modules): array
    {
        $pool   = $this->forOrg($organizationId);
        $wanted = array_values(array_intersect($this->clean($modules), $pool));

        $this->replaceSet(
            'user_modules',
            'user_public_id',
            $userPublicId,
            $this->grantedToUser($userPublicId),
            $wanted
        );
        return $wanted;
    }

    /** Grant every module the organization holds — the owner's grant at set-up. */
    public function grantAllOfOrgToUser(string $userPublicId, int $organizationId): array
    {
        return $this->setForUser($userPublicId, $organizationId, $this->forOrg($organizationId));
    }

    /* ── Internals ──────────────────────────────────────────────── */

    /**
     * Bring one owner's rows in $table to exactly $wanted.
     *
     * INSERT IGNORE + a targeted DELETE rather than "delete all, re-insert":
     * granted_at is a record of when access was given, and wiping the set on
     * every save would reset that timestamp for programs nobody touched.
     */
    private function replaceSet(
        string $table,
        string $ownerColumn,
        $ownerValue,
        array $current,
        array $wanted
    ): void {
        foreach (array_diff($wanted, $current) as $module) {
            $this->execute(
                "INSERT IGNORE INTO $table ($ownerColumn, module) VALUES (:owner, :module)",
                [':owner' => $ownerValue, ':module' => $module]
            );
        }

        $gone = array_values(array_diff($current, $wanted));
        if ($gone === []) {
            return;
        }
        $in     = implode(',', array_fill(0, count($gone), '?'));
        $params = array_merge([$ownerValue], $gone);
        $stmt   = $this->db->prepare(
            "DELETE FROM $table WHERE $ownerColumn = ? AND module IN ($in)"
        );
        $stmt->execute($params);
    }

    /**
     * Normalise a client-supplied list: strings only, trimmed, de-duplicated,
     * and every id checked against the catalogue.
     *
     * The catalogue check matters because these values reach a WHERE clause and
     * a filename-shaped module id; they are parameterised everywhere, but an
     * unknown id stored as a grant is a row that can never be matched and never
     * be revoked through the UI, so it is rejected at the door instead.
     */
    private function clean(array $modules): array
    {
        $known = array_keys((array) (config('modules.modules') ?? []));
        $out   = [];
        foreach ($modules as $m) {
            if (!is_string($m) && !is_numeric($m)) {
                continue;
            }
            $m = trim((string) $m);
            if ($m !== '' && in_array($m, $known, true) && !in_array($m, $out, true)) {
                $out[] = $m;
            }
        }
        sort($out);
        return $out;
    }
}
