<?php
namespace Controllers;

use Core\Catalogue;
use Core\Controller;
use Core\Password;
use Core\Session;
use Core\SignInGuard;
use Core\Database;
use Core\Response;
use Models\Access;
use Models\Organization;
use Models\User;
use Validation\Validator;
use Throwable;

/**
 * Sign-up — one endpoint, both role spaces, and an entitlement.
 *
 * An account leaves this endpoint with three things written, not two: the
 * organization, its owner, and the set of programs it holds (org_modules) plus
 * the owner's grant over them (user_modules). Creating an account without an
 * entitlement would make it a workspace that can open nothing, since
 * Core\Controller::moduleFrom now consults the grant tables rather than
 * account_type alone.
 *
 * ── WHERE THE ANSWERS COME FROM ─────────────────────────────────────────────
 * There is ONE sign-up page for all twelve programs (/apps/signup), so nothing
 * about the account can be read off the address any more: `account_type` is a
 * choice the visitor makes on the form — Enterprise or Leaders — and arrives in
 * the body like every other field. It is validated here against the catalogue
 * rather than trusted: it is a client-supplied string, and an unrecognised one
 * (including from a caller written before roles existed, which sends nothing)
 * becomes 'enterprise', matching the column default. The FORM refuses a blank
 * answer instead of defaulting it, because it has a person to ask; this
 * endpoint has to decide something for a request that never came from it.
 *
 * The programs are not asked at all, by either party. An account starts with
 * its WHOLE role space, so `entitlementFor` builds the list from the catalogue
 * and any `modules` in the request is ignored — see the note there.
 *
 * The two role spaces are still asked for different things, which is the point:
 *
 *   ENTERPRISE  the organization is a team, and which programs each member
 *               gets is the Org Admin's decision afterwards. So it NAMES its
 *               organization — the name every screen labels the shared
 *               workspace with — starts with its whole role space in the pool,
 *               and the owner is granted all of it; the admin narrows it per
 *               member from the Team Members screen. Super Admin adjusts the
 *               pool itself.
 *
 *   LEADER      the organization is one person. There is no team to name, so
 *               no organization name is asked for and none is accepted: the
 *               workspace's name is DERIVED from the person's (see
 *               deriveLeaderOrgName). The pool is the whole Leaders space —
 *               a Leader has nobody to assign programs to, so a pool they
 *               cannot open is just a shorter launchpad.
 *
 * ── WHAT MUST BE UNIQUE, FOR BOTH ──────────────────────────────────────────
 * The USERNAME, across the whole installation, and the EMAIL with it. Sign-in
 * asks for a username and a PIN and nothing else (AuthController), so the
 * username is the entire identity: two accounts holding one means neither can
 * be signed into, and the resolver refuses rather than guessing between them.
 * The email is checked for a different reason — it is where the invitation, the
 * notification and the credential mail go, and one address serving two accounts
 * makes every one of those ambiguous to its recipient.
 *
 * Neither used to be checked here for an Enterprise sign-up: usernames were
 * unique per ORGANIZATION and this endpoint created the organization, so there
 * was nothing to collide with. That is exactly what let one person's username
 * and address sign up again under a new organization name. Both are now checked
 * before anything is written, and uq_user_username / uq_user_email
 * (api/sql/global-unique-login.sql) stand behind the checks for the race.
 */
class SetupController extends Controller
{
    public function create(): void
    {
        $input = $this->input();

        /* Which role space this account signs up into — the six Enterprise
           programs or the six Leader ones. Resolved FIRST, because it decides
           whether an organization name is asked for at all. Validated against
           the catalogue so the set of roles is defined in exactly one place;
           anything unrecognised (including a caller written before roles
           existed, which sends nothing) becomes an enterprise account, matching
           the column default. */
        $accountType = strtolower(trim((string) ($input['account_type'] ?? '')));
        $roles       = array_keys((array) (config('modules.roles') ?? []));
        if ($accountType === '' || !in_array($accountType, $roles, true)) {
            $accountType = 'enterprise';
        }
        $isLeader = $accountType === 'leader';

        $rules = [
            'name'     => ['required', 'min:2',  'max:120'],
            'email'    => ['required', 'max:150'],
            'username' => ['required', 'min:3',  'max:60', 'regex:/^[a-zA-Z0-9_.-]+$/'],
            'password' => ['required', 'max:128'],
        ];
        $labels = [
            'name'     => 'Your name',
            'email'    => 'Email',
            'username' => 'Username',
            'password' => 'Password',
        ];
        /* Only an Enterprise account names an organization. A Leader is not
           merely allowed to omit it — anything they send is ignored, so a
           hand-made request cannot name (or rename) a workspace by a route that
           the form does not offer. */
        if (!$isLeader) {
            $rules  = ['organization_name' => ['required', 'min:2', 'max:150']] + $rules;
            $labels = ['organization_name' => 'Organization name'] + $labels;
        }

        /* 5.9 / 6.1.12: creating an organization needs the installation's setup code, checked HERE (never the
           browser alone). The app administrator creating one from the admin console is already authorised.
           A placeholder until Faisal's voucher and registration system replaces it. */
        $byAppAdmin = $this->isAppAdmin();
        if (!$byAppAdmin && trim((string) ($input['setup_code'] ?? '')) !== (string) config('config.setup_code')) {
            Response::error('That setup code is not recognized.', 422, ['reason' => 'bad-code', 'errors' => ['setup_code' => ['That setup code is not recognized.']]]);
        }

        $validator = new Validator($input, $rules, $labels);

        if ($validator->fails()) {
            Response::validationError($validator->errors());
        }

        $name     = $validator->value('name');
        $email    = trim((string) $validator->value('email'));
        $username = strtolower($validator->value('username'));
        $password = (string) ($input['password'] ?? '');
        /* 6.1.5: the rule and the common-password list, whatever the browser checked. */
        $problem  = Password::problem($password);
        if ($problem !== '') {
            Response::error($problem === 'common' ? 'That password is too common. Choose another.' : 'That password does not meet the rule.', 422, ['reason' => $problem, 'errors' => ['password' => [$problem === 'common' ? 'That password is too common. Choose another.' : 'At least 8 characters, including a number and a special character such as ! or #.']]]);
        }

        /* The programs this account starts with: its whole role space, either
           way. See the class note and entitlementFor. */
        $entitlement = $this->entitlementFor($accountType);

        /* Format check mirrors UserController: the length rule lives in the
           validator, the shape check here, so both entry points reject the
           same addresses with the same message. The owner's address is
           required because the notification machinery mails the roster - an
           organization created without one is silent from day one. */
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::validationError(['email' => ['Enter a valid email address.']]);
        }

        $orgModel  = new Organization();
        $userModel = new User();

        /* Both checks run for BOTH roles, before anything is written, and
           against the whole installation — see the class note. Reported
           together rather than one at a time: someone signing up with an
           address and a username that are both already theirs should be told
           so once, not sent round the form twice. */
        $taken = [];
        if ($userModel->usernameTakenByOther($username)) {
            $taken['username'] = ['That username is already taken. Choose another.'];   /* A.5.22 */
        }
        if ($userModel->emailTakenByOther($email)) {
            $taken['email'] = ['An account already uses that email address. Sign in instead, or use another address.'];
        }
        if ($taken !== []) {
            Response::validationError($taken);
        }

        if ($isLeader) {
            $orgName = $this->deriveLeaderOrgName($orgModel, $name, $username);
        } else {
            $orgName = $validator->value('organization_name');

            /* Organization names stay unique too, though nobody signs in with
               one any more. A name is how a workspace is identified everywhere
               a person reads one — the admin console, the roster, the
               invitation email, the org header — and two called the same thing
               is a support call waiting to happen. Organization::resolve still
               refuses to guess between them. */
            if ($orgModel->nameTakenByOther($orgName)) {
                Response::validationError([
                    'organization_name' => ['An organization is already called that. Choose a name your team will recognise as theirs.'],
                ]);
            }
        }

        $db = Database::connection();
        try {
            $db->beginTransaction();

            $organization = $orgModel->create($orgName, $accountType);

            $user = $userModel->create([
                'organization_id' => $organization['id'],
                'name'            => $name,
                'email'           => $email,
                'username'        => $username,
                'pin_hash'        => Password::hash($password),
                'role'            => 'Administrator',
                'initials'        => initials_from($name),
                'scope'           => 'All',
                'is_admin'        => true,
            ]);

            /* Inside the transaction with the organization and its owner: an
               account that exists but holds nothing can open no program at all,
               so the three either land together or none of them do. */
            $access = new Access();
            $access->setForOrg((int) $organization['id'], $entitlement);
            $access->grantAllOfOrgToUser($user['public_id'], (int) $organization['id']);

            /* Created from the admin console (5.7.4): the first person's password is TEMPORARY — they choose
               their own at their first sign-in. Signing yourself up, it is your own. */
            if ($byAppAdmin) {
                $userModel->setPassword((string) $user['public_id'], Password::hash($password), true);
            }

            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            /* The backstop for a duplicate key the checks above did not catch:
               two sign-ups racing for the same username, address or
               organization name, where both passed their check before either
               committed. WHICH index tripped decides which field hears about
               it — a message against a field the person did not fill in is a
               dead end, and the organization name is not even on a Leader's
               form. */
            if ($e instanceof \PDOException && $e->getCode() === '23000') {
                $detail = $e->getMessage();
                if (str_contains($detail, 'uq_user_username')) {
                    Response::validationError([
                        'username' => ['That username is already taken. Choose another.'],
                    ]);
                }
                if (str_contains($detail, 'uq_user_email')) {
                    Response::validationError([
                        'email' => ['An account was just created with that email address. Use another.'],
                    ]);
                }
                Response::validationError([
                    'organization_name' => ['That organization could not be created — the name may have just been taken. Try again.'],
                ]);
            }
            throw $e;
        }

        /* Signing yourself up signs you in (a session, 6.1.3). The app administrator stays the app administrator. */
        if (!$byAppAdmin) {
            Session::start('member', (string) $user['public_id'], !empty($input['remember']), false);
            SignInGuard::log('organization set up', $username);
        } else {
            SignInGuard::log('temporary password set', $username);
        }

        Response::success([
            'ok'         => true,
            'orgId'      => $organization['public_id'],
            'userId'     => $user['public_id'],
            'mustChange' => $byAppAdmin,
            'organization' => [
                'id'           => $organization['public_id'],
                'name'         => $organization['name'],
                'account_type' => $organization['account_type'],
                /* The browser rebuilds its whole registry from responses like
                   this one, and the launchpad decides what to show from the
                   entitlement. Omitted, a freshly created account would see an
                   empty launchpad until the next full page load. */
                'modules'      => $entitlement,
            ],
            'user' => [
                'id'       => $user['public_id'],
                'name'     => $name,
                'email'    => $email,
                'username' => $username,
                'role'     => 'Administrator',
                'modules'  => $entitlement,
            ],
        ], 201);
    }

    /**
     * The name of a Leader's workspace, which they were never asked for.
     *
     * Every account is an organization row — a Leader's is simply an
     * organization of one — and that row's name is what the admin console, the
     * roster and the org header all print. So one has to exist, and the only
     * material to build it from is the person themselves.
     *
     * Their own name first, because that is what a workspace of one should be
     * called. Names are not unique, though, and organization names must be
     * (Organization::resolve refuses to guess between two, which would strand
     * an Enterprise team that happened to pick the same string) — so a taken
     * name falls back to the username, which IS unique among Leaders by the
     * check above, and then to the username with a counter for the remaining
     * case: a collision with an ENTERPRISE organization already called that.
     * The loop is bounded; it cannot spin.
     */
    private function deriveLeaderOrgName(Organization $orgModel, string $name, string $username): string
    {
        $candidates = [$name, $name . ' (' . $username . ')'];
        for ($n = 2; $n <= 50; $n++) {
            $candidates[] = $name . ' (' . $username . ' ' . $n . ')';
        }

        foreach ($candidates as $candidate) {
            if (!$orgModel->nameTakenByOther($candidate)) {
                return $candidate;
            }
        }

        /* Fifty names taken is not a real state of the world, but a workspace
           with no name is worse than an ugly one — and public ids are unique by
           construction. */
        return $name . ' (' . public_id('org') . ')';
    }

    /**
     * Which programs a brand-new account holds: the whole of its role space.
     *
     * Both spaces, for the same reason arrived at from two directions. An
     * Enterprise organization takes the lot as a POOL — the Org Admin then
     * narrows it per member, which is a decision that belongs to them and not
     * to whoever filled in the sign-up form. A Leader takes the lot because
     * there is nobody to narrow it for: a Leader account is one person, so a
     * pool they cannot open is just a launchpad with things greyed out.
     *
     * Deliberately takes no input. A Leader used to send the one program whose
     * sign-up page they used, back when each program had its own; with a single
     * shared sign-up there is no address to read that from and no list on the
     * form to fill it from, so anything arriving in `modules` is ignored rather
     * than honoured — a request cannot hand itself an entitlement the form does
     * not offer, and cannot hand itself a SHORTER one either.
     *
     * The catalogue is the only source. It cannot return an empty list for a
     * role that exists, but an account holding nothing could open nothing at
     * all — Core\Controller::moduleFrom consults the grant tables — so an empty
     * one is refused here rather than written and discovered later.
     */
    private function entitlementFor(string $accountType): array
    {
        $available = Catalogue::modulesForRole($accountType);

        if ($available === []) {
            Response::error('No programs are configured for that kind of account.', 500);
        }

        return $available;
    }
}
