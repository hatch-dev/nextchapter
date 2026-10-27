<?php
namespace Controllers;

use Core\Controller;
use Core\Password;
use Core\Response;
use Core\Session;
use Core\SignInGuard;
use Models\AdminCredential;
use Models\Organization;
use Models\User;

/**
 * The app administrator, and temporary passwords (Directive 2 Oct 2026, Parts 5.7, 5.12, 6.1; live 6 Oct 2026).
 *
 * The administrator signs in with a username and a password; the account exists from installation
 * (admin / NextChapter2026!, one-time — Models\AdminCredential) and the first-use flow that let whoever
 * first opened the console set its code is gone. Every Super Admin action is now authorised by this
 * session instead of a passcode re-sent with each request.
 */
class AdminController extends Controller
{
    /** GET /admin-session — the account always exists now; kept for pages that still ask. */
    public function status(): void
    {
        Response::success(['exists' => true]);
    }

    /** POST /admin-session {username, password} */
    public function login(): void
    {
        $in       = $this->input();
        $model    = new AdminCredential();
        $account  = $model->get();
        /* A page loaded before this change sends only {passcode}: it means the existing account. */
        $username = mb_strtolower((string) preg_replace('/\s+/u', '', (string) ($in['username'] ?? AdminCredential::DEFAULT_USERNAME)), 'UTF-8');   /* Sweep 4R item 6: every space ignored */
        $password = (string) ($in['password'] ?? ($in['passcode'] ?? ''));

        $wait = SignInGuard::lockedFor('@admin:' . $username);
        if ($wait > 0) {
            Response::error('Too many attempts. Try again in 15 minutes.', 401, ['reason' => 'locked', 'retryAfterMinutes' => $wait]);
        }
        if ($username !== mb_strtolower((string) preg_replace('/\s+/u', '', (string) $account['username']), 'UTF-8') || !$model->verify($password)) {
            SignInGuard::log('admin sign-in refused', $username);
            if (SignInGuard::failed('@admin:' . $username)) {
                Response::error('Too many attempts. Try again in 15 minutes.', 401, ['reason' => 'locked', 'retryAfterMinutes' => SignInGuard::MINUTES]);
            }
            Response::error('That username and password do not match.', 401, ['reason' => 'bad-password']);
        }
        SignInGuard::succeeded('@admin:' . $username);
        $mustChange = (int) $account['must_change'] === 1 || Password::problem($password) !== '';
        Session::start('admin', null, false, $mustChange);
        SignInGuard::log('admin sign-in', $username);
        Response::success(['ok' => true, 'mustChange' => $mustChange, 'first' => false]);
    }

    /** POST /admin/password {current, next} */
    public function changePassword(): void
    {
        $in = $this->input();
        $s  = Session::current();
        if ($s === null || $s['kind'] !== 'admin') {
            Response::error('Administrator access is required.', 403, ['reason' => 'not-admin']);
        }
        $model   = new AdminCredential();
        $current = (string) ($in['current'] ?? '');
        $next    = (string) ($in['next'] ?? '');
        if (!$model->verify($current)) {
            Response::error('Your current password is not correct.', 403, ['reason' => 'bad-current']);
        }
        if ($next === $current) {
            Response::error('Choose a password different from your current one.', 422, ['reason' => 'same']);
        }
        $problem = Password::problem($next);
        if ($problem !== '') {
            Response::error($problem === 'common' ? 'That password is too common. Choose another.' : 'That password does not meet the rule.', 422, ['reason' => $problem]);
        }
        $model->setPassword($next);
        Session::clearMustChange();
        Session::endOthers(null);
        SignInGuard::log('admin password changed', (string) $model->get()['username']);
        Response::success(['ok' => true]);
    }

    /** POST /admin/username {username} — unique against every member's (5.11). Not in 6.2: for Param. */
    public function changeUsername(): void
    {
        $this->requireAppAdmin();
        $username = mb_strtolower(trim((string) ($this->input()['username'] ?? '')), 'UTF-8');
        if ($username === '' || mb_strlen($username) > 60 || !preg_match('/^[a-z0-9_.-]+$/', $username)) {
            Response::error('That username is not valid.', 422, ['reason' => 'invalid']);
        }
        if ((new User())->findAllByUsername($username) !== []) {
            Response::error('That username is already taken. Choose another.', 422, ['reason' => 'taken']);
        }
        (new AdminCredential())->setUsername($username);
        SignInGuard::log('admin username changed', $username);
        Response::success(['ok' => true]);
    }

    /**
     * POST /admin/temporary-password {orgId, userId, temporary} (6.2): set a member's temporary password,
     * marked must_change. An administrator of that organization, or the app administrator (6.1.13).
     */
    public function temporaryPassword(): void
    {
        $in  = $this->input();
        $org = (new Organization())->findByPublicId(trim((string) ($in['orgId'] ?? '')));
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }
        if (!$this->isAppAdmin()) {
            $me = $this->sessionUser();
            if ($me === null || (int) $me['is_admin'] !== 1 || (int) $me['organization_id'] !== (int) $org['id']) {
                Response::error('Only the organization administrator can set a password.', 403, ['reason' => 'not-admin']);
            }
        }
        $users  = new User();
        $target = $users->findByPublicId(trim((string) ($in['userId'] ?? '')));
        if ($target === null || (int) $target['organization_id'] !== (int) $org['id']) {
            Response::error('That person is not in this organization.', 404, ['reason' => 'no-user']);
        }
        $temporary = (string) ($in['temporary'] ?? '');
        $problem   = Password::problem($temporary);
        if ($problem !== '') {
            Response::error($problem === 'common' ? 'That password is too common. Choose another.' : 'That password does not meet the rule.', 422, ['reason' => $problem]);
        }
        $users->setPassword((string) $target['public_id'], Password::hash($temporary), true);
        Session::endAllFor((string) $target['public_id']);
        SignInGuard::log('temporary password set', (string) $target['username']);
        Response::success(['ok' => true]);
    }
}
