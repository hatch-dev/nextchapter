<?php
namespace Controllers;

use Core\Controller;
use Core\Response;
use Core\Database;
use Models\Access;
use Models\Workspace;
use Models\Organization;
use Models\User;
use Validation\Validator;

class OrganizationController extends Controller
{
    public function index(): void
    {
        $userModel = new User();
        $access    = new Access();

        /* 6.1.4: the app administrator sees every organization; a member, only their own; nobody signed in,
           none (this list carries every member's name, username and email). */
        $orgs = (new Organization())->all();
        if (!$this->isAppAdmin()) {
            $me = \Core\Session::current() !== null ? $this->sessionUser(true) : null;
            $orgs = $me === null ? [] : array_values(array_filter($orgs, fn($o) => (int) $o['id'] === (int) $me['organization_id']));
        }
        /* Two queries for the whole console rather than two per organization.
           This response is what the Super Admin's list of every organization,
           every member and every assignment is built from, so an N+1 here is
           an N+1 on the one screen that always asks for everything. */
        $orgGrants = $access->forOrgs(array_column($orgs, 'id'));
        $aiByOrg   = $this->isAppAdmin() ? $this->aiFeaturesByOrg() : [];

        $out = [];
        foreach ($orgs as $o) {
            $users = $userModel->byOrganization((int) $o['id']);
            $pool  = $orgGrants[(int) $o['id']] ?? [];

            $userGrants = $access->forUsers(array_column($users, 'public_id'));
            foreach ($users as &$u) {
                $u['is_admin'] = (bool) $u['is_admin'];
                /* Intersected with the pool, exactly as the access check does
                   (Access::forUser). A console that listed the raw grant would
                   show a member as having a program their organization no
                   longer holds — and they would then be refused it, which is
                   the console disagreeing with the system it administers. */
                $u['modules'] = array_values(array_intersect(
                    $userGrants[$u['public_id']] ?? [],
                    $pool
                ));
            }
            unset($u);

            $out[] = [
                'id'                => $o['public_id'],
                'name'              => $o['name'],
                /* The role space: 'enterprise' or 'leader'. The browser rebuilds
                   its entire organization registry from this response on every
                   load, so a field missing here does not exist client-side —
                   omit it and every Leader account reads as an enterprise one
                   and asks the API for programs it is not allowed to open. */
                'account_type'      => $o['account_type'] ?? 'enterprise',
                /* The programs this organization holds — the pool its admin may
                   assign from, and what the launchpad shows. Like account_type
                   above, the browser has no other source for it: the registry
                   is rebuilt from this response on every load. */
                'modules'           => $pool,
                'industry'          => $o['industry'],
                'company_size'      => $o['company_size'],
                'region'            => $o['region'],
                'website'           => $o['website'],
                'ai_maturity'       => $o['ai_maturity'],
                'executive_sponsor' => $o['executive_sponsor'],
                'objective'         => $o['objective'],
                'created_at'        => $o['created_at'],
                'users'             => $users,
            ];
            if ($this->isAppAdmin()) {
                $out[count($out) - 1]['ai'] = $aiByOrg[(int) $o['id']] ?? ['aiGuide' => null, 'voice' => null, 'programs' => []];
            }
        }
        Response::success(['organizations' => $out]);
    }

    /**
     * The AI Guide and Voice switches, per organization (29 Oct 2026). The admin console sets them for an
     * organization as a whole: every program of RESET_MODULES it has a workspace document for. A program it
     * has not opened yet has nothing to change; its document starts with both on (emptyData()).
     * Per switch: true / false when its programs agree, null when they differ ("Mixed") or there are none.
     * A document without settings counts as both off, as in the browser (js/features/coach.js, aiGuideOn).
     */
    private function aiFeaturesByOrg(): array
    {
        $in   = implode(',', array_fill(0, count(self::RESET_MODULES), '?'));
        $stmt = Database::connection()->prepare('SELECT organization_id, module, doc FROM workspaces WHERE module IN (' . $in . ')');
        $stmt->execute(self::RESET_MODULES);
        $seen = [];
        foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $r) {
            $doc = json_decode((string) $r['doc']);
            $s   = (is_object($doc) && isset($doc->settings) && is_object($doc->settings)) ? $doc->settings : null;
            $seen[(int) $r['organization_id']][$r['module']] = [
                'aiGuide' => $s !== null && !empty($s->aiGuide),
                'voice'   => $s !== null && !empty($s->voice),
            ];
        }
        $out = [];
        foreach ($seen as $orgId => $byModule) {
            $agreed = static function (string $key) use ($byModule): ?bool {
                $values = array_unique(array_column($byModule, $key));
                return count($values) === 1 ? (bool) reset($values) : null;
            };
            $out[$orgId] = ['aiGuide' => $agreed('aiGuide'), 'voice' => $agreed('voice'), 'programs' => array_keys($byModule)];
        }
        return $out;
    }

    /** POST /organizations/ai-features {id, key: 'aiGuide'|'voice', on} — the admin console only. */
    public function aiFeatures(): void
    {
        $this->requireAppAdmin();
        $input = $this->input();
        $key   = (string) ($input['key'] ?? '');
        if ($key !== 'aiGuide' && $key !== 'voice') {
            Response::error('Unknown setting.', 422, ['reason' => 'bad-key']);
        }
        $on  = !empty($input['on']);
        $org = (new Organization())->findByPublicId(trim((string) ($input['id'] ?? '')));
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }
        $orgId     = (int) $org['id'];
        $workspace = new Workspace();
        $changed   = [];
        foreach (self::RESET_MODULES as $module) {
            $stored = $workspace->findByOrg($orgId, $module);
            if ($stored === null) continue;
            /* Built from the document as it is at the moment of writing (patch re-reads on contention), so the
               other switch is never put back to an older value. A new revision: open browsers merge it on their next poll. */
            $set = static function (object $sections, ?object $doc) use ($key, $on): object {
                $s = ($doc !== null && isset($doc->settings) && is_object($doc->settings)) ? clone $doc->settings : new \stdClass();
                $s->$key = $on;
                return (object) ['settings' => $s];
            };
            $result = $workspace->patch($orgId, new \stdClass(), [], null, (int) $stored['schema_version'], $module, $set);
            if ($result === null) {
                Response::error('Someone saved at the same moment. Try again.', 409, ['reason' => 'busy', 'changed' => $changed]);
            }
            $changed[] = $module;
        }
        Response::success(['programs' => $changed]);
    }

    public function delete(): void
    {
        $input    = $this->input();
        $publicId = isset($input['id']) ? trim((string) $input['id']) : '';

        $orgModel = new Organization();
        $org = $orgModel->findByPublicId($publicId);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }

        $this->requireOrgAdmin($input, (int) $org['id']);
        $orgModel->deleteByPublicId($publicId);

        Response::success(['deleted' => true]);
    }

    /**
     * Reset an organization's data (Directive 2 Oct 2026, Part 4; ruled 6 Oct 2026 for the live app).
     *
     * The reset scope law (Rollout item 68): the organization, its name, its administrators, their
     * sign-ins and its AI settings stay; every other team member is removed, with their sign-in,
     * together with all the program data. Members belong to the ORGANIZATION, so removing one here
     * removes them from every program, not only the Pipeline (ruled 6 Oct 2026).
     *
     * "The program data" is that of every program whose directive is applied: the AI Innovation
     * Pipeline (6 Oct 2026), Executive Readiness and Responsible AI Governance (7 Oct 2026, each its own directive
     * of the same date).
     * Each program's workspace document is replaced by its own empty document (api/config/empty-docs.json,
     * generated from js/modules/<id>/module.js by tools/build-empty-docs.js) carrying the administrators,
     * the organization's name and its AI settings; its answers, assignments, notes, chat and locks go.
     * The Pipeline's document is always written (as before); another program's only when the organization
     * has one — a program it never opened has nothing to reset. The history of revisions is kept: it is
     * the record of who changed what, and the reset itself becomes its newest entry. Programs whose
     * directive is not yet applied are not touched.
     *
     * One transaction: either all of it happens or none of it does. The admin console only — the app
     * administrator's session.
     */
    /* AI-Ready Architecture joined 21 Oct 2026: its build carries the same reset law (Rollout item 68, as amended). */
    private const RESET_MODULES = ['pipeline', 'exec-readiness', 'ai-governance', 'ai-architecture'];

    public function reset(): void
    {
        $this->requireAppAdmin();   /* the admin console only: the app administrator's session (first: no organization is confirmed to anyone else) */
        $input    = $this->input();
        $publicId = isset($input['id']) ? trim((string) $input['id']) : '';

        $org = (new Organization())->findByPublicId($publicId);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }

        $templates = json_decode((string) @file_get_contents(dirname(__DIR__) . '/config/empty-docs.json'));
        foreach (self::RESET_MODULES as $m) {
            if (!is_object($templates) || !isset($templates->{$m}) || !is_object($templates->{$m})) {
                Response::error('The empty document of ' . $m . ' is missing (run tools/build-empty-docs.js).', 500, ['reason' => 'no-template']);
            }
        }

        $orgId     = (int) $org['id'];
        $workspace = new Workspace();

        $db = Database::connection();
        $admins = $db->prepare('SELECT public_id FROM users WHERE organization_id = ? AND is_admin = 1');
        $admins->execute([$orgId]);
        $adminIds = array_column($admins->fetchAll(), 'public_id');

        /* Each program's fresh document: its empty one, then what stays. The roster keeps the stored
           rows of the administrators (their local ids are what the document's other records point at);
           with no stored document there is nothing to keep and the app rebuilds it from the database. */
        $plans = [];
        foreach (self::RESET_MODULES as $module) {
            $stored = $workspace->findByOrg($orgId, $module);
            if ($stored === null && $module !== 'pipeline') continue;
            $was   = $stored !== null ? json_decode((string) $stored['doc']) : null;
            $fresh = $templates->{$module};
            $keepRoster = [];
            if (is_object($was) && isset($was->roster) && is_array($was->roster)) {
                foreach ($was->roster as $row) {
                    if (!is_object($row)) continue;
                    $sid = isset($row->serverId) ? (string) $row->serverId : '';
                    if (($sid !== '' && in_array($sid, $adminIds, true)) || ($sid === '' && !empty($row->admin))) {
                        unset($row->passcode);
                        $keepRoster[] = $row;
                    }
                }
            }
            $fresh->roster     = $keepRoster ? $keepRoster : null;
            $fresh->settings   = (is_object($was) && isset($was->settings) && is_object($was->settings))
                ? $was->settings
                : (object) ['aiGuide' => true, 'voice' => true];
            $fresh->enterprise = (object) ['name' => (is_object($was) && isset($was->enterprise->name) && $was->enterprise->name !== '')
                ? (string) $was->enterprise->name
                : (string) $org['name']];
            $fresh->orgSetup   = true;
            $fresh->startDate  = date('Y-m-d');   /* as a new organization starts its program (createOrg) */
            $fresh->bf12       = true;
            $plans[$module] = [
                'json'   => json_encode($fresh, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'schema' => $stored !== null ? (int) $stored['schema_version'] : 1,
            ];
        }

        $revs = [];
        $db->beginTransaction();
        try {
            $del = $db->prepare('DELETE FROM users WHERE organization_id = ? AND is_admin = 0');   /* their notes, assignments and program grants go with them (FK cascade) */
            $del->execute([$orgId]);
            $removed = $del->rowCount();
            foreach (self::RESET_MODULES as $module) {
                foreach (['step_answers', 'step_assignments', 'messages', 'workspace_locks'] as $table) {
                    $db->prepare('DELETE FROM ' . $table . ' WHERE organization_id = ? AND module = ?')->execute([$orgId, $module]);
                }
                if ($adminIds) {
                    $in = implode(',', array_fill(0, count($adminIds), '?'));
                    $db->prepare('DELETE FROM notes WHERE module = ? AND user_public_id IN (' . $in . ')')->execute(array_merge([$module], $adminIds));
                }
            }
            foreach ($plans as $module => $plan) {
                $rev = $workspace->save($orgId, $plan['json'], null, null, $plan['schema'], $module);
                if ($rev === null) {
                    throw new \RuntimeException('the workspace changed during the reset');
                }
                $revs[$module] = $rev;
            }
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            Response::error('The reset could not be completed; nothing was changed.', 409, ['reason' => 'reset-failed']);
        }

        Response::success(['reset' => true, 'removed' => $removed, 'administrators' => count($adminIds),
            'rev' => $revs['pipeline'] ?? null, 'module' => 'pipeline', 'modules' => $revs]);
    }

    public function members(): void
    {
        $orgPublicId = isset($_GET['org']) ? trim((string) $_GET['org']) : '';
        $org = (new Organization())->findByPublicId($orgPublicId);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }
        $this->requireOrgMember($_GET, (int) $org['id']);   /* 6.1.4 */

        $access = new Access();
        $pool   = $access->forOrg((int) $org['id']);
        $grants = $access->forUsers(array_column($members = (new User())->byOrganization((int) $org['id']), 'public_id'));

        foreach ($members as &$m) {
            $m['is_admin'] = (bool) $m['is_admin'];
            $m['modules']  = array_values(array_intersect($grants[$m['public_id']] ?? [], $pool));
        }
        unset($m);

        /* The roster reconciler (reconcileRosterFromServer, js/features/org-admin.js)
           treats the database as the source of truth for the team, and program
           access is part of what a member IS now — so it rides in with them
           rather than needing a second request per member. */
        Response::success(['members' => $members, 'modules' => $pool]);
    }

    public function update(): void
    {
        $input    = $this->input();
        $publicId = isset($input['id']) ? trim((string) $input['id']) : '';

        $orgModel = new Organization();
        $org      = $orgModel->findByPublicId($publicId);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }

        $this->requireOrgAdmin($input, (int) $org['id']);

        $data = $this->validated($input, (string) ($org['account_type'] ?? 'enterprise'));

        /* Renaming is the other way two organizations end up sharing a name,
           and the name is what this one's members type to sign in. Same rule
           and same reason as sign-up (SetupController::create). */
        if ($orgModel->nameTakenByOther($data['name'], $publicId)) {
            Response::validationError([
                'name' => ['Another organization is already called that. Pick a name your team will recognise as theirs.'],
            ]);
        }

        $orgModel->updateDetails($publicId, $data);

        Response::success(['id' => $publicId]);
    }

    /**
     * Only the NAME is required. Everything else about an organization —
     * industry, headcount, region, website, maturity, sponsor, objective — is
     * optional, for every account type (10 Sep 2026). It used to be required
     * for an enterprise, which meant a new account could not get past the
     * organization screen without inventing seven answers on the spot, several
     * of which ("AI maturity", "executive sponsor") a person signing up has no
     * reason to have decided yet.
     *
     * The length and shape rules stay and still apply to whatever IS given: a
     * field being optional is not the same as a field being unchecked.
     *
     * @param string $accountType Kept because callers pass it and the leader
     *   space may diverge again; it no longer changes what is required.
     */
    private function validated(array $input, string $accountType = 'enterprise'): array
    {
        $validator = new Validator(
            $input,
            [
                // The name is the workspace's identity in both spaces — always required.
                'name'              => ['required', 'min:2', 'max:150'],
                'industry'          => ['max:120'],
                'company_size'      => ['max:40'],
                'region'            => ['max:120'],
                'website'           => ['max:150'],
                'ai_maturity'       => ['max:40'],
                'executive_sponsor' => ['max:120'],
                'objective'         => ['max:1000'],
            ],
            [
                'name'              => 'Organization name',
                'industry'          => 'Industry',
                'company_size'      => 'Company size',
                'region'            => 'Region / HQ',
                'website'           => 'Website',
                'ai_maturity'       => 'AI maturity',
                'executive_sponsor' => 'Executive sponsor',
                'objective'         => 'Primary objective',
            ]
        );
        if ($validator->fails()) {
            Response::validationError($validator->errors());
        }

        // Shape-check the website only when there is one. A solo account is
        // never asked for it, and "" must not fail a pattern it was never given.
        $website = trim((string) ($input['website'] ?? ''));
        if ($website !== '' && preg_match('#^(https?://)?([\w-]+\.)+[\w-]{2,}(/\S*)?$#i', $website) !== 1) {
            Response::validationError(['website' => ['Enter a valid website (e.g. acme.com).']]);
        }

        return [
            'name'              => trim((string) $input['name']),
            'industry'          => trim((string) ($input['industry'] ?? '')),
            'company_size'      => trim((string) ($input['company_size'] ?? '')),
            'region'            => trim((string) ($input['region'] ?? '')),
            'website'           => $website,
            'ai_maturity'       => trim((string) ($input['ai_maturity'] ?? '')),
            'executive_sponsor' => trim((string) ($input['executive_sponsor'] ?? '')),
            'objective'         => trim((string) ($input['objective'] ?? '')),
        ];
    }
}
