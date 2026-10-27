<?php
namespace Controllers;

use Core\Controller;
use Core\Password;
use Core\Response;
use Core\Session;
use Core\SignInGuard;
use Models\Organization;
use Models\User;

/**
 * Sign-in with a username and a password (Directive 2 Oct 2026, Parts 5 and 6; live 6 Oct 2026).
 *
 * The username is the whole identity: usernames are unique across the installation
 * (uq_user_username — and 5.11), so resolving one is a lookup, not a search; if two rows ever
 * come back (a database written before the unique index) it refuses rather than choosing.
 *
 * A correct password starts a server session (Core\Session): an HttpOnly, SameSite=Strict
 * cookie — the browser keeps no password and no id that signs anybody in. The answer names the
 * organization and the member by public id, as before, plus mustChange: a temporary password,
 * or a stored one (an old PIN) that breaks the rule (6.1.15), must be replaced before anything
 * else (6.1.6).
 *
 * Refusals (6.2): 'no-user' and 'bad-password' are worded alike (A.5.3) so the screen cannot tell
 * which usernames exist; 'no-credential' (A.5.12); 'locked' after 5 failures in 15 minutes (A.5.4).
 */
class AuthController extends Controller
{
    /** POST /session {username, password, remember} */
    public function login(): void
    {
        $in       = $this->input();
        /* Sweep 4R item 1: the username only, ignoring capitals and every space; a full name is refused like any mismatch ('no-user', A.5.3) */
        $username = mb_strtolower((string) preg_replace('/\s+/u', '', (string) ($in['username'] ?? '')), 'UTF-8');
        /* A page loaded before this change still sends `pin`: it is the same field, and an old PIN
           signs in once (with mustChange). */
        $password = (string) ($in['password'] ?? ($in['pin'] ?? ''));
        $remember = !empty($in['remember']);

        if ($username === '' || mb_strlen($username) > 60) {
            Response::error('That username and password do not match.', 401, ['reason' => 'no-user']);
        }
        $wait = SignInGuard::lockedFor($username);
        if ($wait > 0) {
            Response::error('Too many attempts. Try again in 15 minutes.', 401, ['reason' => 'locked', 'retryAfterMinutes' => $wait]);
        }

        $matches = (new User())->findAllByUsername($username);
        $org = count($matches) === 1 ? (new Organization())->findById((int) $matches[0]['organization_id']) : null;
        if ($org === null) {
            SignInGuard::log('sign-in refused', $username);
            $this->refuse($username, 'no-user');
        }
        $user = $matches[0];
        if ($user['pin_hash'] === null || $user['pin_hash'] === '') {
            SignInGuard::log('sign-in refused: no credential', $username);
            Response::error('This person has no sign-in yet. Ask your administrator to set a password.', 401, ['reason' => 'no-credential']);
        }
        if (!Password::verify($password, (string) $user['pin_hash'])) {
            SignInGuard::log('sign-in refused', $username);
            $this->refuse($username, 'bad-password');
        }

        SignInGuard::succeeded($username);
        $mustChange = (int) $user['must_change'] === 1 || Password::problem($password) !== '';
        Session::start('member', (string) $user['public_id'], $remember, $mustChange);
        SignInGuard::log('sign-in', $username);
        Response::success($this->answer($org, $user, $mustChange));
    }

    /** GET /session — whether this browser is signed in, and as whom. */
    public function current(): void
    {
        $s = Session::current();
        if ($s === null) {
            Response::success(['ok' => false]);
        }
        if ($s['kind'] === 'admin') {
            $a = (new \Models\AdminCredential())->get();
            Response::success(['ok' => true, 'admin' => true, 'mustChange' => (int) $s['must_change'] === 1, 'username' => (string) ($a['username'] ?? 'admin')]);
        }
        $users = new User();
        $user  = $users->findByPublicId((string) $s['user_public_id']);
        $org   = $user !== null ? (new Organization())->findById((int) $user['organization_id']) : null;
        if ($user === null || $org === null) {
            Session::end();
            Response::success(['ok' => false]);
        }
        Response::success($this->answer($org, $user, (int) $s['must_change'] === 1));
    }

    /** POST /sign-out */
    public function signOut(): void
    {
        $s = Session::current();
        if ($s !== null) {
            $who = $s['kind'] === 'admin' ? (string) ((new \Models\AdminCredential())->get()['username'] ?? 'admin') : (string) (((new User())->findByPublicId((string) $s['user_public_id']) ?? [])['username'] ?? '');
            SignInGuard::log('sign-out', $who);
        }
        Session::end();
        Response::success(['ok' => true]);
    }

    /** POST /password {current, next} — a member replaces their own password (Change password; Choose a new password). */
    public function changePassword(): void
    {
        $in   = $this->input();
        $user = $this->sessionUser(true);
        if ($user === null) {
            Response::error('You must be signed in.', 401, ['reason' => 'signed-out']);
        }
        $users = new User();
        $cred  = $users->credentials((string) $user['public_id']);
        $current = (string) ($in['current'] ?? '');
        $next    = (string) ($in['next'] ?? '');
        if (!Password::verify($current, (string) ($cred['pin_hash'] ?? ''))) {
            Response::error('Your current password is not correct.', 403, ['reason' => 'bad-current']);
        }
        if ($next === $current) {
            Response::error('Choose a password different from your current one.', 422, ['reason' => 'same']);
        }
        $problem = Password::problem($next);
        if ($problem !== '') {
            Response::error($problem === 'common' ? 'That password is too common. Choose another.' : 'That password does not meet the rule.', 422, ['reason' => $problem]);
        }
        $users->setPassword((string) $user['public_id'], Password::hash($next), false);
        Session::clearMustChange();
        Session::endOthers((string) $user['public_id']);   /* 6.1.3: changing a password ends the person's other sessions */
        SignInGuard::log('password changed', (string) $user['username']);
        Response::success(['ok' => true]);
    }

    private function refuse(string $username, string $reason): void
    {
        if (SignInGuard::failed($username)) {
            Response::error('Too many attempts. Try again in 15 minutes.', 401, ['reason' => 'locked', 'retryAfterMinutes' => SignInGuard::MINUTES]);
        }
        Response::error('That username and password do not match.', 401, ['reason' => $reason]);
    }

    private function answer(array $org, array $user, bool $mustChange): array
    {
        return [
            'ok'         => true,
            'orgId'      => $org['public_id'],
            'userId'     => $user['public_id'],
            'mustChange' => $mustChange,
            'user' => [
                'id'       => $user['public_id'],
                'name'     => $user['name'],
                'username' => $user['username'],
                'role'     => $user['role'],
                'is_admin' => (bool) $user['is_admin'],
            ],
            'organization' => [
                'id'           => $org['public_id'],
                'name'         => $org['name'],
                'account_type' => $org['account_type'] ?? 'enterprise',
            ],
        ];
    }
}
