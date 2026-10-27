<?php
namespace Controllers;

use Core\Controller;
use Core\Database;
use Core\Response;
use Models\Assignment;
use Models\Organization;
use Models\User;

/**
 * Sample-data seed — mirror the demo team into the normalized tables.
 *
 *   POST /seed { org, actor_id, members[], assignments{} } → { members, assignments, map }
 *
 * The seed button in the app fills the workspace document (ideas, portfolio,
 * progress, …) and that document already persists through /workspace. What it
 * could NOT do was turn the demo roster into real `users` rows or their step
 * assignments into `step_assignments` rows — that data lived only inside the
 * JSON blob. This endpoint closes that gap so the seeded team is visible in the
 * admin console, can sign in, and owns real assignment rows.
 *
 * "Replace each time": every seeded member carries is_seed = 1. On each seed we
 * delete the org's previous seed members first (their assignments cascade away),
 * then recreate the current set — so re-seeding is clean and idempotent and
 * never touches real (is_seed = 0) members.
 *
 * Access. The caller must be a member of the organization (the seed lives in
 * the signed-in "More" menu). It is a developer/demo convenience, so it does not
 * demand org-admin the way the normal team editor does.
 */
class SeedController extends Controller
{
    public function sync(): void
    {
        $input = $this->input();
        $org   = $this->requireOrg((string) ($input['org'] ?? ''));
        /* The BASE gate, the one every other module-scoped endpoint uses
           (AssignmentController, MessageController, WorkspaceController). It
           reads actor_id out of the request itself and 403s a caller who is not
           a member of this organization.

           This controller used to carry a private copy of the same name. Two
           things were wrong with it and the first hid the second: PHP refuses
           to narrow an inherited method's visibility, so declaring it `private`
           against the base's `protected` was a FATAL at class load — every
           POST /seed died before a line of it ran, which is the 500 behind
           "Could not save the sample team to the database". And the copy's
           membership check had been commented out, so had it ever loaded it
           would have accepted any actor id at all. */
        $this->requireOrgMember($input, (int) $org['id']);
        /* A seed builds ONE program's sample workspace, so the assignments that
           come with it belong to that program — see Controller::moduleFrom. */
        $module = $this->moduleFrom($input, $org);

        $members     = isset($input['members']) && is_array($input['members']) ? $input['members'] : [];
        $assignments = isset($input['assignments']) && is_array($input['assignments']) ? $input['assignments'] : [];

        $userModel = new User();
        $asgModel  = new Assignment();
        $db        = Database::connection();

        $db->beginTransaction();
        try {
            // Wipe the previous seed cohort; step_assignments cascade with them.
            $userModel->deleteSeedForOrg((int) $org['id']);

            // Recreate the members, remembering local_id → new public_id so the
            // assignments (which reference the local ids) can be re-pointed.
            $map = [];
            foreach ($members as $m) {
                if (!is_array($m)) {
                    continue;
                }
                $localId  = trim((string) ($m['local_id'] ?? ''));
                $name     = trim((string) ($m['name'] ?? ''));
                $username = strtolower(trim((string) ($m['username'] ?? '')));
                if ($localId === '' || $name === '' || $username === '') {
                    continue; // a seed member needs at least a name and a login
                }
                // Never clobber a real account. Seed rows were just deleted, so
                // anything left on this username is somebody real — and the scope
                // is the whole installation now, because sign-in is by username
                // alone and the unique index behind it is global too
                // (api/sql/global-unique-login.sql). Sample data must not be the
                // reason a real person cannot sign in, so it yields.
                if ($userModel->usernameTakenByOther($username)) {
                    continue;
                }

                // Addresses are unique too (uq_user_email). A sample member's
                // is decoration — nothing is ever sent to it — so a collision
                // drops the address rather than the member, which would
                // otherwise leave a hole in sample data that other seeded rows
                // (assignments, notes) still point at.
                $email = trim((string) ($m['email'] ?? ''));
                if ($email !== '' && $userModel->emailTakenByOther($email)) {
                    $email = '';
                }

                $created = $userModel->create([
                    'organization_id' => (int) $org['id'],
                    'name'            => $name,
                    'username'        => $username,
                    'role'            => trim((string) ($m['role'] ?? '')),
                    'scope'           => trim((string) ($m['scope'] ?? 'All')),
                    'email'           => $email,
                    'department'      => trim((string) ($m['department'] ?? '')),
                    'initials'        => trim((string) ($m['initials'] ?? '')) ?: initials_from($name),
                    'color'           => trim((string) ($m['color'] ?? '')) ?: '#B8892A',
                    'pin_hash'        => null,   /* sample people have no sign-in (Directive 2 Oct 2026, 5.2.2) */
                    'is_admin'        => false,
                    'is_seed'         => true,
                ]);
                $map[$localId] = $created['public_id'];
            }

            // Re-point the seeded assignments onto the new member public ids.
            $asgCount = 0;
            foreach ($assignments as $step => $localIds) {
                $step = trim((string) $step);
                if ($step === '' || !preg_match('/^[0-9]+\.[0-9]+$/', $step) || !is_array($localIds)) {
                    continue;
                }
                foreach ($localIds as $lid) {
                    $lid = trim((string) $lid);
                    if (isset($map[$lid])) {
                        $asgModel->set((int) $org['id'], $module, $step, $map[$lid], true);
                        $asgCount++;
                    }
                }
            }

            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('Seed sync failed for org ' . $org['id'] . ': ' . $e->getMessage());
            Response::error('Could not save the sample team to the database.', 500, ['reason' => 'seed-failed']);
        }

        Response::success(['members' => count($map), 'assignments' => $asgCount, 'map' => $map]);
    }

    /** Resolve the org by public id or 404. */
    private function requireOrg(string $orgPublicId): array
    {
        $org = (new Organization())->findByPublicId(trim($orgPublicId));
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }
        return $org;
    }

}
