<?php
namespace Controllers;

use Core\Controller;
use Core\Response;
use Models\Assignment;
use Models\Organization;
use Models\User;

/**
 * Step assignments — assign / unassign organization members to pipeline steps.
 *
 *   GET  /assignments?org=<public_id>&module=<id>  → every assignment for the org's program
 *   POST /assignments {org, module, actor_id, step, user, assigned}
 *        toggle one member on/off a step (assigned = true|false)
 *
 * Assignments are scoped to a PROGRAM as well as an organization. Every
 * program numbers its steps 1.1 … 4.4, so without the module an assignment on
 * '1.1' applied to an unrelated step in every other program at once. `module`
 * is optional and means the Pipeline when omitted, exactly as it does for the
 * workspace (Controller::moduleFrom).
 *
 * Reading is open to the whole organization: everyone needs to see who is
 * responsible for which section. "The whole organization" is now enforced
 * rather than assumed — both ends resolve an actor and run the module through
 * moduleFrom(), so a member cannot read or write the assignments of a program
 * they have not been granted.
 *
 * WRITING is restricted to the app admin or the organization's administrator —
 * the same authority that manages the team and org details. Assignment says who
 * is accountable for completing a section, so it is not something a member may
 * hand to themselves or off to someone else. The UI hides the control
 * (canAssign() in js/features/assignments.js); this is where it is enforced.
 *
 * The target member must belong to the organization.
 */
class AssignmentController extends Controller
{
    public function index(): void
    {
        $org    = $this->requireOrg(isset($_GET['org']) ? (string) $_GET['org'] : '');
        $actor  = $this->requireOrgMember($_GET, (int) $org['id']);
        $module = $this->moduleFrom($_GET, $org, $actor);
        Response::success([
            'module'      => $module,
            'assignments' => (new Assignment())->forOrg((int) $org['id'], $module),
        ]);
    }

    public function set(): void
    {
        $input  = $this->input();
        $org    = $this->requireOrg((string) ($input['org'] ?? ''));
        $actor  = $this->requireOrgMember($input, (int) $org['id']);
        $module = $this->moduleFrom($input, $org, $actor);

        // Only the organization's administrator may decide who is responsible
        // for a section. Sends 403 and stops otherwise.
        $this->requireOrgAdmin($input, (int) $org['id']);

        $step = trim((string) ($input['step'] ?? ''));
        if ($step === '' || !preg_match('/^[0-9]+\.[0-9]+$/', $step)) {
            Response::validationError(['step' => ['A valid step id (e.g. "1.1") is required.']]);
        }

        // Target member must also belong to this organization.
        $targetPublicId = trim((string) ($input['user'] ?? ''));
        $target = $targetPublicId !== '' ? (new User())->findByPublicId($targetPublicId) : null;
        if ($target === null || (int) $target['organization_id'] !== (int) $org['id']) {
            Response::error('That member is not part of this organization.', 422, ['reason' => 'no-member']);
        }

        $assigned = filter_var($input['assigned'] ?? false, FILTER_VALIDATE_BOOLEAN);

        /* Read before writing: set() is idempotent, so afterwards there is no
           way to tell a new assignment from a repeat. The UI's picker is a
           toggle and a double-click is one request too many, not two emails. */
        $model = new Assignment();
        $wasAlready = $model->isAssigned((int) $org['id'], $module, $step, $targetPublicId);
        $model->set((int) $org['id'], $module, $step, $targetPublicId, $assigned);

        /* Tell the member. Assignment decides who may sign a section off
           (stepCompleteLock, js/features/assignments.js), so work handed over
           in silence is work nobody knows is waiting for them.

           Three things are deliberately NOT notified:
             · unassigning — the ruling was "tell them when they are assigned";
               a "this was taken off you" message is a separate decision;
             · a repeat of an assignment they already had;
             · an administrator assigning themselves, who already knows.

           Core\AssignmentNotice queues the message before it opens a socket,
           so a deployment with no SMTP leaves a readable row in mail_outbox
           rather than nothing, and NEVER turns a saved assignment into a
           failed request. The result rides back on the response so the UI can
           say what actually happened instead of assuming. */
        $notice = ['sent' => false, 'status' => 'not-applicable'];
        if ($assigned && !$wasAlready && $targetPublicId !== (string) ($actor['public_id'] ?? '')) {
            try {
                $notice = \Core\AssignmentNotice::send(
                    $target,
                    $org,
                    $module,
                    $step,
                    (string) ($input['step_name'] ?? ''),
                    (string) ($actor['name'] ?? '')
                );
            } catch (\Throwable $e) {
                /* The assignment is committed. Mail is the side effect, and a
                   side effect must not rewrite the outcome of the write. */
                error_log('assignment notice failed: ' . $e->getMessage());
                $notice = ['sent' => false, 'status' => 'error', 'error' => $e->getMessage()];
            }
        }

        Response::success([
            'module'   => $module,
            'step'     => $step,
            'user'     => $targetPublicId,
            'assigned' => $assigned,
            'notified' => $notice,
        ]);
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
