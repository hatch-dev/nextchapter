<?php
namespace Controllers;

use Core\Controller;
use Core\MemberInvite;
use Core\Password;
use Core\Response;
use Core\SignInGuard;
use Models\Access;
use Models\Organization;
use Models\User;
use Validation\Validator;

/**
 * Team members within an organization.
 *
 * Creating one now does three things rather than one: it inserts the member,
 * records which programs they may open (user_modules, clamped to what the
 * organization holds — see Models\Access), and emails them their access.
 *
 * The order matters. The member and their grant are written first and the mail
 * is attempted last, because mail is the only step that depends on something
 * outside this application. A mail server that is down, slow or simply not
 * configured yet must never turn "add a team member" into a failure — so the
 * invite's outcome is REPORTED in the response rather than thrown, and the
 * admin's UI says what actually happened. See Core\MemberInvite.
 */
class UserController extends Controller
{
    public function create(): void
    {
        $input = $this->input();

        $orgPublicId = isset($input['organization_id']) ? trim((string) $input['organization_id']) : '';
        $org = (new Organization())->findByPublicId($orgPublicId);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }

        $admin = $this->requireOrgAdmin($input, (int) $org['id']);

        $data = $this->validated($input, null);

        /* The new member's temporary password (7 Oct 2026, ruled by the user: it travels in the access email).
           It comes with this request, so it is checked against the rule BEFORE anything is created, stored only
           as a hash marked must_change (6.1.6), and handed to the invite for the one copy that is sent. It is
           never stored readable, returned or logged (6.1.1): the outbox keeps a copy with the password withheld. */
        $temporary = isset($input['temporary']) ? (string) $input['temporary'] : '';
        if ($temporary !== '') {
            $problem = Password::problem($temporary);
            if ($problem !== '') {
                Response::validationError(['temporary' => [$problem === 'common'
                    ? 'That password is too common. Choose another.'
                    : 'At least 8 characters, including a number and a special character such as ! or #.']]);
            }
        }

        $created = (new User())->create([
            'organization_id' => (int) $org['id'],
            'name'            => $data['name'],
            'username'        => $data['username'],
            'role'            => $data['role'],
            'scope'           => $data['scope'],
            'email'           => $data['email'],
            'department'      => $data['department'],
            'initials'        => initials_from($data['name']),
            'pin_hash'        => null,   /* no sign-in until a temporary password is set (5.7.2, POST /admin/temporary-password) */
            'is_admin'        => !empty($input['is_admin']),   /* Sweep 4R item 2: administrators make administrators (requireOrgAdmin above) */
        ]);

        /* Clamped to the organization's own entitlement, so an admin cannot
           hand out a program the organization does not have — and the stored
           set is echoed back rather than the requested one, so the UI shows
           what was actually granted instead of what was asked for. */
        $granted = (new Access())->setForUser(
            $created['public_id'],
            (int) $org['id'],
            $this->modulesFrom($input)
        );

        if ($temporary !== '') {
            (new User())->setPassword((string) $created['public_id'], Password::hash($temporary), true);
            SignInGuard::log('temporary password set', (string) $data['username']);
        }

        /* The temporary password is available here and nowhere else: what is stored is
           an Argon2id hash, so this is the only moment the invitation can carry it. */
        $invite = MemberInvite::send(
            [
                'public_id' => $created['public_id'],
                'name'      => $data['name'],
                'email'     => $data['email'],
                'username'  => $data['username'],
                'role'      => $data['role'],
                'temporary' => $temporary,
            ],
            $org,
            $granted,
            (string) ($admin['name'] ?? '')
        );

        Response::success([
            'id'      => $created['public_id'],
            'modules' => $granted,
            'invite'  => $invite,
        ], 201);
    }

    public function update(): void
    {
        $input    = $this->input();
        $publicId = isset($input['id']) ? trim((string) $input['id']) : '';

        $userModel = new User();
        $target    = $userModel->findByPublicId($publicId);
        if ($target === null) {
            Response::error('Team member not found.', 404, ['reason' => 'no-user']);
        }

        $actor = $this->requireOrgAdminOrSelf($input, (int) $target['organization_id'], $target['public_id']);

        $data = $this->validated($input, $publicId);

        /* Sweep 4R item 2 (addendum 5 Oct 2026, Paul's decision): only an administrator of this organization (or the app
           administrator acting for one) changes who is an administrator; from anyone else the key is ignored, as `modules`
           is below. An organization is never left without one: demoting the last is refused BEFORE anything changes. */
        $actorIsOrgAdmin = (int) $actor['is_admin'] === 1 && (int) $actor['organization_id'] === (int) $target['organization_id'];
        $wantAdmin = ($actorIsOrgAdmin && array_key_exists('is_admin', $input)) ? !empty($input['is_admin']) : null;
        if ($wantAdmin === false && (int) $target['is_admin'] === 1 && $userModel->countAdmins((int) $target['organization_id']) <= 1) {
            Response::error('An organization needs at least one administrator. Make someone else an administrator first.', 409, ['reason' => 'last-admin']);
        }

        $attrs = [
            'name'       => $data['name'],
            'username'   => $data['username'],
            'role'       => $data['role'],
            'scope'      => $data['scope'],
            'email'      => $data['email'],
            'department' => $data['department'],
            'initials'   => initials_from($data['name']),
        ];

        $userModel->updateByPublicId($publicId, $attrs);
        if ($wantAdmin !== null) {
            $userModel->setAdmin($publicId, $wantAdmin);
        }

        /* Program access is the ADMIN'S to change, not the member's. update()
           is reachable by either (requireOrgAdminOrSelf — members may edit
           their own profile), so a `modules` key arriving from a member editing
           themselves is ignored rather than obeyed: without this a non-admin
           could grant themselves every program the organization holds by
           adding one field to their own profile save.

           A request that names no `modules` at all leaves the grant untouched,
           so the profile editor does not have to know about access to be able
           to save a changed phone number. */
        $granted = null;
        if (array_key_exists('modules', $input)) {
            $isOrgAdmin = (int) $actor['is_admin'] === 1
                && (int) $actor['organization_id'] === (int) $target['organization_id'];
            if ($isOrgAdmin) {
                $granted = (new Access())->setForUser(
                    $publicId,
                    (int) $target['organization_id'],
                    $this->modulesFrom($input)
                );
            }
        }

        Response::success(array_filter(
            ['id' => $publicId, 'modules' => $granted, 'is_admin' => $wantAdmin],
            static fn($v) => $v !== null
        ));
    }

    public function delete(): void
    {
        $input    = $this->input();
        $publicId = isset($input['id']) ? trim((string) $input['id']) : '';

        $userModel = new User();
        $target    = $userModel->findByPublicId($publicId);
        if ($target === null) {
            Response::error('Team member not found.', 404, ['reason' => 'no-user']);
        }

        $this->requireOrgAdmin($input, (int) $target['organization_id']);

        /* Sweep 4R item 2: the last administrator is never removed */
        if ((int) $target['is_admin'] === 1 && $userModel->countAdmins((int) $target['organization_id']) <= 1) {
            Response::error('An organization needs at least one administrator. Make someone else an administrator first.', 409, ['reason' => 'last-admin']);
        }

        $userModel->deleteByPublicId($publicId);
        Response::success(['deleted' => true]);
    }

    /**
     * Validate a member profile, and refuse a username or an email address that
     * already belongs to somebody else.
     *
     * Both checks are INSTALLATION-WIDE, not scoped to this organization. They
     * used to be scoped, because sign-in asked for the organization first and
     * two teams could each have a "maria" without either being reachable from
     * the other's sign-in. That field is gone (AuthController): the username is
     * now the whole identity, so a second "maria" anywhere makes the first
     * one's sign-in ambiguous, and the address is what carries her invitation.
     *
     * The consequence is real and worth stating: an admin CAN now be refused a
     * username by an organization they cannot see, and cannot be told whose it
     * is. That is the price of signing in with one field, and the message says
     * only that it is taken.
     *
     * $exceptPublicId is the member being edited, so keeping your own username
     * or address is never a conflict; null when creating.
     */
    private function validated(array $input, ?string $exceptPublicId): array
    {
        $isUpdate = $exceptPublicId !== null;

        $rules = [
            'name'       => ['required', 'min:2', 'max:120'],
            'username'   => ['required', 'min:3', 'max:60'],
            'role'       => ['required', 'max:60'],
            'scope'      => ['required', 'max:60'],
            'email'      => ['required', 'max:150'],
            'department' => ['required', 'max:80'],
        ];

        $validator = new Validator(
            $input,
            $rules,
            [
                'name'       => 'Name',
                'username'   => 'Username',
                'role'       => 'Role / title',
                'scope'      => 'Scope / focus',
                'email'      => 'Email',
                'department' => 'Department',
            ]
        );
        if ($validator->fails()) {
            Response::validationError($validator->errors());
        }

        $username = strtolower(trim((string) ($input['username'] ?? '')));
        if (preg_match('/^[a-zA-Z0-9_.-]+$/', $username) !== 1) {
            Response::validationError(['username' => ['Username may only contain letters, numbers, and . _ -']]);
        }
        $email = trim((string) ($input['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::validationError(['email' => ['Enter a valid email address.']]);
        }

        /* Reported together, so an admin retyping a colleague's details is sent
           back to the form once rather than twice. */
        $userModel = new User();
        $taken = [];
        if ($userModel->usernameTakenByOther($username, $exceptPublicId)) {
            $taken['username'] = ['That username is already taken. Choose another.'];   /* A.5.22 */
        }
        if ($userModel->emailTakenByOther($email, $exceptPublicId)) {
            $taken['email'] = ['That email address already belongs to an account. Use another.'];
        }
        if ($taken !== []) {
            Response::validationError($taken);
        }

        return [
            'name'       => trim((string) $input['name']),
            'username'   => $username,
            'role'       => trim((string) ($input['role'] ?? '')),
            'scope'      => trim((string) ($input['scope'] ?? '')),
            'email'      => $email,
            'department' => trim((string) ($input['department'] ?? '')),
        ];
    }

    /**
     * The requested program list, as a plain array of strings.
     *
     * Accepts a JSON array (what the app sends) or a comma-separated string (a
     * form post, and far easier to drive from curl while testing). Nothing is
     * validated here — Models\Access does that, against both the catalogue and
     * the organization's entitlement, because it is the only place that knows
     * the second half of the answer.
     */
    private function modulesFrom(array $input): array
    {
        $modules = $input['modules'] ?? [];
        if (is_string($modules)) {
            $modules = $modules === '' ? [] : explode(',', $modules);
        }
        return is_array($modules) ? $modules : [];
    }
}
