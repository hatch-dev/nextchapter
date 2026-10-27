<?php
namespace Core;

use Models\Access;
use Models\User;

/**
 * Base controller.
 *
 * Shared plumbing every controller can lean on: decoding the JSON request body,
 * and authorizing that the caller is an organization administrator.
 * Endpoint-specific logic lives in the concrete controllers.
 */
abstract class Controller
{
    /**
     * Read and decode the JSON request body into an associative array.
     * Falls back to form-encoded POST data so the endpoint works either way.
     */
    protected function input(): array
    {
        $raw = file_get_contents('php://input');

        if ($raw !== false && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // Fallback: classic form submission.
        return $_POST ?? [];
    }

    /* ── Identity: the session (Directive 2 Oct 2026, Parts 6.1.3, 6.1.4, 6.1.6; live 6 Oct 2026) ─────────
       Every check below used to read an id the browser sent (actor_id / actor) and trust it. The person is now
       whoever the session cookie names (Core\Session). A browser may still send actor_id — the app always has —
       and it is read for one thing only: which of an organization's administrators the APP administrator is
       acting as when they work inside it. */

    /** True for the app administrator's session (and not while it still holds the one-time password). */
    protected function isAppAdmin(): bool
    {
        $s = Session::current();
        return $s !== null && $s['kind'] === 'admin' && (int) $s['must_change'] === 0;
    }

    /** The signed-in member's row, or null. A temporary password must be replaced first (6.1.6). */
    protected function sessionUser(bool $allowMustChange = false): ?array
    {
        $s = Session::current();
        if ($s === null || $s['kind'] !== 'member' || (string) $s['user_public_id'] === '') return null;
        if ((int) $s['must_change'] === 1 && !$allowMustChange) {
            Response::error('Choose a new password first.', 403, ['reason' => 'must-change']);
        }
        return (new User())->findByPublicId((string) $s['user_public_id']);
    }

    /** Who the app administrator acts as inside an organization: the administrator they named, else its first. */
    protected function appAdminActsAs(array $src, int $orgId): ?array
    {
        $users = new User();
        $named = trim((string) ($src['actor_id'] ?? $src['actor'] ?? ''));
        if ($named !== '') {
            $u = $users->findByPublicId($named);
            if ($u !== null && (int) $u['organization_id'] === $orgId) return $u;
        }
        foreach ($users->byOrganization($orgId) as $u) {
            if ((int) $u['is_admin'] === 1) return $users->findByPublicId((string) $u['public_id']);
        }
        return null;
    }

    /** Refuse unless this is the app administrator's session. */
    protected function requireAppAdmin(): void
    {
        if (!$this->isAppAdmin()) {
            Response::error('Administrator access is required.', 403, ['reason' => 'forbidden']);
        }
    }

    /** Refuse unless someone is signed in (a member of any organization, or the app administrator). */
    protected function requireSignedIn(): void
    {
        if (!$this->isAppAdmin() && $this->sessionUser() === null) {
            Response::error('You must be signed in.', 401, ['reason' => 'signed-out']);
        }
    }

    /**
     * Authorize that the session is the administrator of the given organization, or the app
     * administrator. Sends 403 and exits otherwise. Returns the actor row (for the app
     * administrator, the organization administrator they act as).
     */
    protected function requireOrgAdmin(array $input, int $orgId): array
    {
        if ($this->isAppAdmin()) {
            $as = $this->appAdminActsAs($input, $orgId);
            if ($as !== null) return $as;
            return ['id' => 0, 'public_id' => null, 'organization_id' => $orgId, 'is_admin' => 1, 'name' => 'Administrator'];
        }
        $actor = $this->sessionUser();
        if ($actor === null
            || (int) $actor['is_admin'] !== 1
            || (int) $actor['organization_id'] !== $orgId) {
            Response::error('Only the organization administrator can make this change.', 403, ['reason' => 'forbidden']);
        }

        return $actor;
    }

    /**
     * Authorize that the session is the org administrator OR the target user themselves
     * (members may edit their own profile), or the app administrator. Sends 403 otherwise.
     */
    protected function requireOrgAdminOrSelf(array $input, int $orgId, string $targetPublicId): array
    {
        if ($this->isAppAdmin()) {
            return $this->requireOrgAdmin($input, $orgId);
        }
        $actor = $this->sessionUser();
        if ($actor === null) {
            Response::error('You are not allowed to make this change.', 403, ['reason' => 'forbidden']);
        }

        $isAdmin = (int) $actor['is_admin'] === 1 && (int) $actor['organization_id'] === $orgId;
        $isSelf  = $actor['public_id'] === $targetPublicId;
        if (!$isAdmin && !$isSelf) {
            Response::error('You can only edit your own profile.', 403, ['reason' => 'forbidden']);
        }

        return $actor;
    }

    /**
     * The role/module catalogue, read from config/catalogue.json through
     * api/config/modules.php — the same file index.php routes with and the
     * browser is handed, so the API can never disagree with the app about
     * which modules exist or which role owns one.
     */
    protected function catalogue(): array
    {
        static $c = null;
        return $c ??= (array) (config('modules') ?? ['default' => 'pipeline', 'roles' => [], 'modules' => []]);
    }

    /** What a request means when it names no module (every pre-modules caller). */
    protected function defaultModule(): string
    {
        return (string) ($this->catalogue()['default'] ?? 'pipeline');
    }

    /**
     * Which program a request is about, validated against the catalogue, the
     * organization's role space, the organization's entitlement, and — when an
     * actor is known — that member's own grant.
     *
     * Lives here rather than in one controller because more than one table is
     * now scoped per program. The workspace document was first; step
     * assignments followed, once it became clear that both programs number
     * their steps 1.1 … 4.4 and an org-wide assignment therefore meant
     * "assigned in every program at once" — assigning 1.1 in the Pipeline
     * locked 1.1 in Executive Readiness, a step with nothing to do with it.
     * Anything else that grows a module column should use this too, so the
     * rule stays in one place.
     *
     * ── The four gates, in order ────────────────────────────────────────────
     *   1. KNOWN      the module is in config/catalogue.json          → 422
     *   2. ROLE       it belongs to this account's role space         → 403
     *   3. POOL       the organization holds it (org_modules)         → 403
     *   4. GRANT      this member was given it (user_modules)         → 403
     *
     * Gates 3 and 4 are the application-level authorization the suite grew when
     * team members stopped all having the same access; gates 1 and 2 are older
     * and unchanged. They run in this order because the messages differ and the
     * most specific true statement is the useful one: "your organization does
     * not have this program" is a different problem, with a different person
     * fixing it, from "you have not been given this program".
     *
     * Gate 4 is skipped when $actor is null, which is not a loophole — it is
     * the same trust boundary the rest of the API sits behind. Access is scoped
     * by an actor id the client supplies, so this is defence in depth behind
     * the app's own UI rather than a substitute for sessions. See the note on
     * requireOrgAdmin, and docs/roles-and-modules.md §7.
     *
     * @param array      $src   $_GET or the decoded request body.
     * @param array      $org   The organization the request is scoped to.
     * @param array|null $actor The member making the request, when known.
     */
    protected function moduleFrom(array $src, array $org, ?array $actor = null): string
    {
        $owners  = (array) ($this->catalogue()['modules'] ?? []);
        $account = (string) ($org['account_type'] ?? 'enterprise');
        $module  = trim((string) ($src['module'] ?? ''));

        if ($module === '') {
            return $this->fallbackModule($org, $account, $actor);
        }

        if (!isset($owners[$module])) {
            Response::validationError(['module' => ['Unknown program module: ' . $module]]);
        }

        if ($owners[$module] !== $account) {
            Response::error(
                'This program is not part of your ' . $account . ' account.',
                403,
                ['reason' => 'role', 'module' => $module, 'required_role' => $owners[$module]]
            );
        }

        $access = new Access();

        if (!in_array($module, $access->forOrg((int) $org['id']), true)) {
            Response::error(
                'This program is not part of your organization’s plan.',
                403,
                ['reason' => 'org-entitlement', 'module' => $module]
            );
        }

        if ($actor !== null
            && !in_array($module, $access->forUser((string) $actor['public_id'], (int) $org['id']), true)) {
            Response::error(
                'You have not been given access to this program. Ask your organization administrator.',
                403,
                ['reason' => 'user-grant', 'module' => $module]
            );
        }

        return $module;
    }

    /**
     * What a request naming NO module means.
     *
     * It has always meant the Pipeline — every caller written before modules
     * existed omits it, and every one of them meant that. It still does, for an
     * account that can open the Pipeline. Otherwise the answer has to be some
     * program this caller may actually use, because the alternative is filing
     * their work under a module they can never open again.
     *
     * Preference order: the default → the actor's own first grant → the
     * organization's first entitlement → the role space's first module. The
     * last is a floor, not a grant: it is only reached by an account that holds
     * nothing at all, and moduleFrom's gates are what refuse the request. This
     * method picks a name; it never authorizes one.
     */
    private function fallbackModule(array $org, string $account, ?array $actor): string
    {
        $owners   = (array) ($this->catalogue()['modules'] ?? []);
        $fallback = $this->defaultModule();
        $access   = new Access();

        $usable = $actor !== null
            ? $access->forUser((string) $actor['public_id'], (int) $org['id'])
            : $access->forOrg((int) $org['id']);

        if (($owners[$fallback] ?? null) === $account && in_array($fallback, $usable, true)) {
            return $fallback;
        }
        if ($usable !== []) {
            return $usable[0];
        }

        $mine = (array) ($this->catalogue()['roles'][$account] ?? []);
        return $mine[0] ?? $fallback;
    }

    /**
     * Authorize that the caller is a member of the given organization, and
     * return their row.
     *
     * This is the boundary that keeps one organization's work out of another's.
     * The workspace document, its Q&A projection, its chat and its assignments
     * are all addressed by the organization's public id alone, which is a value
     * the client sends — so without this check, holding any organization's
     * public id is the same as being in it.
     *
     * @param bool $required When false, a missing/unknown actor returns null
     *   instead of 403. Reserved for reads that legitimately happen before
     *   anyone is signed in; a caller passing false is stating that the data it
     *   is about to return is not organization-private.
     */
    protected function requireOrgMember(array $src, int $orgId, bool $required = true): ?array
    {
        /* The session's member, or — for the app administrator — the member they act as (6.1.4). */
        $actor = $this->isAppAdmin() ? $this->appAdminActsAs($src, $orgId) : $this->sessionUser();

        if ($actor === null || (int) $actor['organization_id'] !== $orgId) {
            if (!$required) {
                return null;
            }
            Response::error(
                'You must be a member of this organization.',
                403,
                ['reason' => 'not-a-member']
            );
        }

        return $actor;
    }
}
