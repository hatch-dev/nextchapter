<?php
namespace Controllers;

use Core\Catalogue;
use Core\Controller;
use Core\Response;
use Models\Access;
use Models\MailOutbox;
use Models\Organization;
use Models\User;

/**
 * Application access — reading and changing who may open what.
 *
 *   GET  /access?org=<public_id>            an organization's pool + every
 *                                           member's grant within it
 *   POST /access/org    {id, modules, passcode}    set an organization's pool
 *   POST /access/user   {id, modules, actor_id}    set one member's grant
 *   GET  /access/mail   ?passcode=                 the invite outbox
 *
 * ── Two different authorities ───────────────────────────────────────────────
 *
 * Changing an ORGANIZATION'S pool is the Super Admin's, and is gated on the
 * app-admin passcode. It decides what an account has bought; nobody inside the
 * account may widen it.
 *
 * Changing a MEMBER'S grant is the Org Admin's, gated on requireOrgAdmin, and
 * clamped by Models\Access to the pool above. It decides which of the things
 * the organization already has this person may open.
 *
 * Keeping those two in one file is deliberate — they are the same subject read
 * at two levels, and splitting them would make it easy to change one rule and
 * forget it has a twin.
 *
 * The passcode gate is the same shared secret the console already runs on
 * (AdminController). It is not a per-person credential and is not pretending to
 * be one; it is the existing authority for "this browser is the Super Admin",
 * and this endpoint is bound to it rather than inventing a second, weaker one.
 */
class AccessController extends Controller
{
    /** An organization's pool, plus each member's effective grant. */
    public function show(): void
    {
        $org = $this->requireOrg(isset($_GET['org']) ? (string) $_GET['org'] : '');
        $this->requireOrgMember($_GET, (int) $org['id']);   /* 6.1.4: a member of this organization, or the app administrator */

        $access = new Access();
        $pool   = $access->forOrg((int) $org['id']);
        $users  = (new User())->byOrganization((int) $org['id']);
        $grants = $access->forUsers(array_column($users, 'public_id'));

        $members = [];
        foreach ($users as $u) {
            $members[] = [
                'id'       => $u['public_id'],
                'name'     => $u['name'],
                'username' => $u['username'],
                'is_admin' => (bool) $u['is_admin'],
                'modules'  => array_values(array_intersect($grants[$u['public_id']] ?? [], $pool)),
            ];
        }

        Response::success([
            'organization' => [
                'id'           => $org['public_id'],
                'name'         => $org['name'],
                'account_type' => $org['account_type'] ?? 'enterprise',
            ],
            /* Everything this organization COULD hold, so the console can
               render the full set of tick boxes without a second source. */
            'available' => Catalogue::modulesForRole((string) ($org['account_type'] ?? 'enterprise')),
            'modules'   => $pool,
            'members'   => $members,
        ]);
    }

    /** Super Admin: set what an organization holds. */
    public function setOrg(): void
    {
        $input = $this->input();
        $this->requireSuperAdmin($input['passcode'] ?? '');

        $org = $this->requireOrg((string) ($input['id'] ?? ''));

        /* Clamped to the role space. Granting an Enterprise organization a
           Leader program would create an entitlement that moduleFrom's role
           gate refuses on every request — an access record that grants nothing
           and can only confuse whoever reads it next. Cross-role selling is a
           real possibility, but it is a change to that gate, not something to
           back into through a console that quietly writes unusable rows. */
        $role      = (string) ($org['account_type'] ?? 'enterprise');
        $available = Catalogue::modulesForRole($role);
        $wanted    = array_values(array_intersect($this->modulesFrom($input), $available));

        $access = new Access();
        $stored = $access->setForOrg((int) $org['id'], $wanted);

        /* Revoking from the organization leaves each member's user_modules row
           in place but inert (Access::forUser intersects). That is on purpose:
           re-granting the program to the organization restores exactly who had
           it before, rather than silently resetting everyone to nothing. */
        Response::success([
            'id'      => $org['public_id'],
            'modules' => $stored,
            'members' => $this->effectiveGrants((int) $org['id'], $stored),
        ]);
    }

    /** Org Admin: set which of the organization's programs one member may open. */
    public function setUser(): void
    {
        $input    = $this->input();
        $publicId = trim((string) ($input['id'] ?? ''));

        $target = (new User())->findByPublicId($publicId);
        if ($target === null) {
            Response::error('Team member not found.', 404, ['reason' => 'no-user']);
        }

        /* The app administrator's session, or the organization's own administrator's. */
        if (!$this->isSuperAdmin($input['passcode'] ?? '')) {
            $this->requireOrgAdmin($input, (int) $target['organization_id']);
        }

        $stored = (new Access())->setForUser(
            $publicId,
            (int) $target['organization_id'],
            $this->modulesFrom($input)
        );

        Response::success(['id' => $publicId, 'modules' => $stored]);
    }

    /**
     * Super Admin: the invite outbox.
     *
     * Bodies are held back from the list — an invite carries a passcode in the
     * clear, and a console that paints every one of them onto one screen turns
     * a targeted disclosure into a bulk one. Ask for a single message by id to
     * read it.
     */
    public function mail(): void
    {
        $this->requireSuperAdmin(isset($_GET['passcode']) ? (string) $_GET['passcode'] : '');

        $outbox = new MailOutbox();
        $id     = isset($_GET['id']) ? trim((string) $_GET['id']) : '';

        if ($id !== '') {
            $row = $outbox->findByPublicId($id);
            if ($row === null) {
                Response::error('Message not found.', 404, ['reason' => 'no-mail']);
            }
            Response::success(['message' => $row]);
        }

        Response::success([
            'configured' => \Core\Mailer::configured(),
            'messages'   => $outbox->recent(50),
        ]);
    }

    /* ── Internals ──────────────────────────────────────────────── */

    /** member public_id → the programs they can actually open. */
    private function effectiveGrants(int $orgId, array $pool): array
    {
        $access = new Access();
        $users  = (new User())->byOrganization($orgId);
        $grants = $access->forUsers(array_column($users, 'public_id'));

        $out = [];
        foreach ($users as $u) {
            $out[$u['public_id']] = array_values(array_intersect($grants[$u['public_id']] ?? [], $pool));
        }
        return $out;
    }

    /* The app administrator's session (Directive 2 Oct 2026, Part 6): a passcode in the request is ignored. */
    private function isSuperAdmin($unused = null): bool
    {
        return $this->isAppAdmin();
    }

    private function requireSuperAdmin($unused = null): void
    {
        $this->requireAppAdmin();
    }

    private function modulesFrom(array $input): array
    {
        $modules = $input['modules'] ?? [];
        if (is_string($modules)) {
            $modules = $modules === '' ? [] : explode(',', $modules);
        }
        return is_array($modules) ? $modules : [];
    }

    private function requireOrg(string $orgPublicId): array
    {
        $org = (new Organization())->findByPublicId(trim($orgPublicId));
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }
        return $org;
    }
}
