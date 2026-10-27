<?php
namespace Controllers;

use Core\AnswerProjector;
use Core\Controller;
use Core\DocPrivacy;
use Core\Response;
use Models\Organization;
use Models\StepAnswer;
use Models\Workspace;
use Models\WorkspaceLock;
use Models\WorkspaceRevision;

/**
 * The organization's workspace — the 90-day program's working state.
 *
 *   GET  /workspace?org=<public_id>        → { rev, doc, schema_version }
 *   GET  /workspace/rev?org=<public_id>    → { rev }   (cheap change poll)
 *   POST /workspace {org, actor_id, base_rev, doc, schema_version, replace?}
 *                                          → { rev }   or HTTP 409 on a stale write
 *
 * The document is the source of truth for every phase's answers, ideas,
 * portfolio, capital and progress. It replaces what used to live in each
 * browser's localStorage, which is why the same team saw different data in
 * different browsers.
 *
 * Concurrency. `base_rev` is the rev the client's edit was based on. If another
 * member saved in the meantime the stored rev has moved and this save is
 * refused with 409 plus the current {rev, doc}, so the client can merge its
 * pending changes onto the fresh document and retry (see Store.handleStaleWrite
 * in js/app.js). Without this the last browser to hit save would silently wipe
 * everyone else's work.
 *
 * Access. Any member of the organization may read and write the workspace —
 * the program is shared team work, not privileged data. But "any member of the
 * organization" is the whole point: every endpoint here is addressed by the
 * organization's public id, which is a value the client sends, so without an
 * actor check holding an org id would be the same as being in that org. Reads
 * were unchecked and the write check was commented out; both are enforced now,
 * on all four endpoints, through Core\Controller::requireOrgMember.
 *
 * The actor is also handed to moduleFrom(), which is what applies the member's
 * own per-program grant on top of the organization's. Two members of the same
 * organization can therefore be entitled to different programs, and each is
 * refused the other's workspace — see api/sql/access.sql.
 *
 * Privacy WITHIN the organization. "Shared team work" is true of the program and
 * false of two things carried in the same document: Executive Readiness's
 * individual "Leadership Development" track (steps 1.4 / 2.4 / 3.5 / 4.4, one
 * leader's own reflections) and roster PINs. Both went to every member of the
 * team, whether or not any screen displayed them. Every response below that
 * carries a document now goes through Core\DocPrivacy first, and every write is
 * put back through it before it is stored — because a client handed a redacted
 * document would otherwise post it back and delete what it could not see. What
 * counts as private is declared in api/config/privacy.php.
 */
class WorkspaceController extends Controller
{
    /**
     * ── Why this class never decodes the document with assoc = true ──────
     *
     * json_decode($json, true) turns every empty JSON object {} into an empty
     * PHP array [], and json_encode() writes that back out as []. The app keeps
     * most of its state in objects keyed by id — rhythm{}, governance{},
     * projects{}, assessments{} — which are {} until first written. Round-trip
     * one through assoc mode and the app receives [] instead of {}. It then
     * does data.rhythm.time = '9:00', JavaScript happily sets a non-index
     * property on an array, and JSON.stringify DROPS it. The answer disappears
     * on the very next save, silently.
     *
     * Decoding to stdClass (assoc = false) keeps {} as {} and [] as [], so the
     * document survives the trip unchanged. Assoc mode is fine for read-only
     * work — the projector uses it — but never for anything we store or return.
     */

    public function show(): void
    {
        $org    = $this->requireOrg(isset($_GET['org']) ? (string) $_GET['org'] : '');
        $actor  = $this->requireOrgMember($_GET, (int) $org['id']);
        $module = $this->moduleFrom($_GET, $org, $actor);
        $row    = (new Workspace())->findByOrg((int) $org['id'], $module);

        // No workspace yet: a brand-new organization that has not saved once.
        // Report rev 0 with an empty document — the client seeds its own shape
        // (emptyData() in js/app.js), so the server never has to know it.
        if ($row === null) {
            Response::success(['rev' => 0, 'schema_version' => 1, 'module' => $module, 'doc' => null]);
        }

        Response::success([
            'rev'            => (int) $row['rev'],
            'schema_version' => (int) $row['schema_version'],
            'module'         => $module,
            // objects, not assoc — see above; and this member's view of it, not
            // the whole team's private work (privacy(), below).
            'doc'            => $this->privacy($module, $actor)->forRead(json_decode((string) $row['doc'])),
            'updated_at'     => $row['updated_at'],
            'updated_by'     => $row['updated_by'],
        ]);
    }

    /**
     * This member's privacy filter for this module.
     *
     * One line, in one place, so no endpoint below can serve or store a document
     * without having gone through it. See Core\DocPrivacy.
     */
    private function privacy(string $module, ?array $actor): DocPrivacy
    {
        /* Sweep 4R item 3: the app administrator, or an administrator of the organization, may change its details */
        $mayEditAdmin = $this->isAppAdmin() || (int) ($actor['is_admin'] ?? 0) === 1;
        return new DocPrivacy($module, (string) (($actor['public_id'] ?? '')), $mayEditAdmin);
    }

    /** Just the rev — lets clients poll for "did anything change?" cheaply. */
    public function rev(): void
    {
        $org   = $this->requireOrg(isset($_GET['org']) ? (string) $_GET['org'] : '');
        $actor = $this->requireOrgMember($_GET, (int) $org['id']);
        Response::success([
            'rev' => (new Workspace())->revForOrg((int) $org['id'], $this->moduleFrom($_GET, $org, $actor)),
        ]);
    }

    public function save(): void
    {
        $input  = $this->input();
        $org    = $this->requireOrg((string) ($input['org'] ?? ''));
        $actor  = $this->requireOrgMember($input, (int) $org['id']);
        $module = $this->moduleFrom($input, $org, $actor);

        // Take the document from the raw body, object-shaped (see the note above).
        $doc = $this->documentFromBody();
        if ($doc === null) {
            Response::validationError(['doc' => ['A workspace document object is required.']]);
        }

        // base_rev absent means "I have no basis to compare" (first save after a
        // fresh load). Passing null skips the staleness check deliberately.
        $baseRev = array_key_exists('base_rev', $input) && $input['base_rev'] !== null
            ? (int) $input['base_rev']
            : null;

        /* ── A null base_rev may create, but it may not replace ──────────────
         * Skipping the staleness check is right for a write that has nothing to
         * be stale against: the first save for an organization's module, and
         * the sample-data seed, which means "throw this away and take mine".
         * Over a workspace that already holds work it is not a save, it is a
         * deletion of everyone else's — and that is exactly how it was used.
         *
         * A browser that could not READ the workspace (any workspace request
         * without an actor is refused above, and on a device that has never
         * opened the organization there was nobody to make it as) came up on an
         * empty document, and its first ordinary write posted that empty
         * document here with no base_rev. The whole program — the assessment
         * battery, the register, every answer — was replaced by someone who had
         * done nothing but log in. It was never one program's bug: none of this
         * is a module's code.
         *
         * So the intent has to be stated. `replace: true` is the seed saying it
         * means it (Store.commitSeed). Without it, a null base_rev over an
         * existing row is refused as stale, which sends the client down the
         * path it should have taken in the first place: read what is there,
         * merge, retry. Nothing local is lost — a 409 hands the document back
         * and Store.adoptDoc keeps every unsent edit.
         */
        $replace = !empty($input['replace']);

        $schemaVersion = isset($input['schema_version']) ? (int) $input['schema_version'] : 1;

        $workspace = new Workspace();
        $privacy   = $this->privacy($module, $actor);

        /* What this member sent is not necessarily what gets stored. The document
           they were served had everyone else's private sections removed and every
           roster PIN stripped, so posting it back whole would delete exactly the
           data the redaction was protecting. forWrite() re-grafts all of it from
           what is stored and keeps only this member's own entries from the body.
           It is also the authorization check: identity is resolved from the
           STORED document, so nothing in the request can claim another leader's
           section. See Core\DocPrivacy.

           Safe against a concurrent write for the same reason the whole-document
           path already is: base_rev. If somebody committed between this read and
           the UPDATE, save() refuses and the client merges and retries. */
        $stored = $workspace->findByOrg((int) $org['id'], $module);

        // The refusal the block above describes. Reported exactly like any other
        // stale write, because that is what it is — the client has no basis for
        // this write — and the client already knows how to answer one.
        if ($baseRev === null && !$replace && $stored !== null) {
            Response::send([
                'success' => false,
                'message' => 'This workspace already exists and your save named no revision to build on. Read it, merge and retry.',
                'stale'   => true,
                'data'    => [
                    'rev' => (int) $stored['rev'],
                    'doc' => $privacy->forRead(json_decode((string) $stored['doc'])),
                    // Who wrote what is being handed back. The client merges onto
                    // it and may have to tell this member that a value they saved
                    // was replaced — by a name, not by a guess at who happens to
                    // hold a lock just now (onRemoteOverwrite, js/app.js).
                    'updated_by' => $stored['updated_by'],
                ],
            ], 409);
        }

        $doc    = $this->reencode($privacy->forWrite(
            json_decode($doc),
            $stored !== null ? json_decode((string) $stored['doc']) : null
        )) ?? $doc;

        $newRev = $workspace->save((int) $org['id'], $doc, $baseRev, $actor['public_id'], $schemaVersion, $module);

        // Refused as stale: hand back the current state so the client can merge
        // its dirty records onto it rather than throwing the user's edit away.
        if ($newRev === null) {
            $current = $workspace->findByOrg((int) $org['id'], $module);
            Response::send([
                'success' => false,
                'message' => 'This workspace changed while you were editing. Merge and retry.',
                'stale'   => true,
                'data'    => [
                    'rev' => $current !== null ? (int) $current['rev'] : 0,
                    // Redacted like every other document this member receives —
                    // the client merges onto it, so an unfiltered copy here would
                    // hand back precisely what show() withholds.
                    'doc' => $current !== null
                        ? $privacy->forRead(json_decode((string) $current['doc']))
                        : null,
                    'updated_by' => $current !== null ? $current['updated_by'] : null,
                ],
            ], 409);
        }

        $this->projectAnswers($org, $module, json_decode($doc));

        Response::success(['rev' => $newRev, 'module' => $module]);
    }

    /**
     * Refresh the readable Q&A trail from a document we have just accepted.
     *
     * Best-effort: step_answers is a derived convenience, so a failure must
     * never fail the user's save — the document is already committed and the
     * next save re-projects anyway. A module with no question map yet
     * (config/questions-<module>.php) simply isn't projected; its document is
     * still stored and served in full.
     *
     * Shared by save() and patch() so the trail cannot go stale on one path and
     * not the other. The projector only reads, so the assoc cast here is safe.
     */
    private function projectAnswers(array $org, string $module, $doc): void
    {
        try {
            $map = $this->questionMapFor($module);
            if ($map === null || !is_object($doc)) {
                return;
            }
            (new StepAnswer())->replaceForOrg(
                (int) $org['id'],
                (new AnswerProjector($map))->project(json_decode(json_encode($doc), true) ?: []),
                $module
            );
        } catch (\Throwable $e) {
            error_log('step_answers projection failed for org ' . $org['id'] . ' module ' . $module . ': ' . $e->getMessage());
        }
    }

    /**
     * ── POST /workspace/patch ────────────────────────────────────────────
     * {org, module, actor_id, sections:{key:value,…}, removed:[key,…],
     *  schema_version} → { rev }
     *
     * Write only the parts the client changed. Everything it did not name is
     * left as it stands, whoever wrote it — so two members working on different
     * sections of the same program cannot undo each other, and neither has to
     * be told to merge. Same authorization and same module resolution as save();
     * the difference is only in what gets written.
     *
     * A patch is not refused as stale. Applying to whatever is stored NOW is the
     * whole point (see Workspace::patch), and the client's own three-way merge
     * still reconciles the case this cannot help with — two people editing the
     * SAME section — which is also the case section locks exist to prevent.
     */
    public function patch(): void
    {
        $input  = $this->input();
        $org    = $this->requireOrg((string) ($input['org'] ?? ''));
        $actor  = $this->requireOrgMember($input, (int) $org['id']);
        $module = $this->moduleFrom($input, $org, $actor);

        // Object-shaped, for the reason in the class note: assoc decoding turns
        // an empty object into an empty array and the app loses the section.
        $body = json_decode((string) file_get_contents('php://input'));
        $sections = (is_object($body) && isset($body->sections) && is_object($body->sections))
            ? $body->sections : null;
        if ($sections === null) {
            Response::validationError(['sections' => ['A sections object is required.']]);
        }

        $removed = [];
        if (is_object($body) && isset($body->removed) && is_array($body->removed)) {
            foreach ($body->removed as $key) {
                if (is_string($key)) {
                    $removed[] = $key;
                }
            }
        }

        $schemaVersion = isset($input['schema_version']) ? (int) $input['schema_version'] : 1;
        $privacy       = $this->privacy($module, $actor);
        $removed       = $privacy->removable($removed);   /* Sweep 4R item 3: nor deleted by anyone else */

        /* Passed IN rather than applied here, so the filter runs against the
           document the patch is actually landing on. patch() re-reads on
           contention, and a section rebuilt from a copy read earlier in this
           request would put that earlier copy back over whoever committed in
           between — the exact loss the patch endpoint exists to prevent. */
        $result = (new Workspace())->patch(
            (int) $org['id'],
            $sections,
            $removed,
            $actor['public_id'],
            $schemaVersion,
            $module,
            static function (object $sections, ?object $stored) use ($privacy): object {
                return $privacy->forPatch($sections, $stored);
            }
        );

        if ($result === null) {
            // Could not be applied even after retrying — hand back the current
            // state and let the client fall back to its whole-document path.
            $current = (new Workspace())->findByOrg((int) $org['id'], $module);
            Response::send([
                'success' => false,
                'message' => 'This workspace is being written to to heavily. Retry.',
                'stale'   => true,
                'data'    => [
                    'rev' => $current !== null ? (int) $current['rev'] : 0,
                    'doc' => $current !== null
                        ? $privacy->forRead(json_decode((string) $current['doc']))
                        : null,
                    'updated_by' => $current !== null ? $current['updated_by'] : null,
                ],
            ], 409);
        }

        $this->projectAnswers($org, $module, $result['doc']);
        Response::success(['rev' => $result['rev'], 'module' => $module]);
    }

    /**
     * ── Section locks ────────────────────────────────────────────────────
     *   GET  /workspace/locks?org=&module=&actor=   → { locks:[…], ttl }
     *   POST /workspace/locks/claim   {org, module, actor_id, sections:[…]}
     *   POST /workspace/locks/release {org, module, actor_id, sections:[…]|all}
     *
     * Who is editing which section, right now. The client has always had the
     * lock behaviour (Collab in js/app.js); what it lacked was somewhere shared
     * to keep the locks, so two people on two machines never saw each other's.
     * See api/sql/workspace-locks.sql.
     */
    public function locks(): void
    {
        $org    = $this->requireOrg(isset($_GET['org']) ? (string) $_GET['org'] : '');
        $actor  = $this->requireOrgMember($_GET, (int) $org['id']);
        $module = $this->moduleFrom($_GET, $org, $actor);
        $tab    = self::tabFrom($_GET);

        Response::success([
            'module' => $module,
            'ttl'    => WorkspaceLock::TTL_SECONDS,
            'locks'  => array_map(static function (array $row) use ($actor, $tab): array {
                return [
                    'section' => $row['section'],
                    'user'    => $row['user_public_id'],
                    'tab'     => (string) ($row['tab_id'] ?? ''),
                    'name'    => $row['user_name'],
                    'mine'    => $row['user_public_id'] === $actor['public_id'] && (string) ($row['tab_id'] ?? '') === $tab,   /* Sweep 4R item 4: this tab's */
                ];
            }, (new WorkspaceLock())->live((int) $org['id'], $module)),
        ]);
    }

    /** Claim (or heartbeat) sections for the caller. Reports the real holder of
     *  each, which is somebody else when the claim was refused. */
    public function claimLocks(): void
    {
        $input  = $this->input();
        $org    = $this->requireOrg((string) ($input['org'] ?? ''));
        $actor  = $this->requireOrgMember($input, (int) $org['id']);
        $module = $this->moduleFrom($input, $org, $actor);

        $model  = new WorkspaceLock();
        $name   = (string) ($actor['name'] ?? '');
        $result = [];
        foreach ($this->sectionList($input) as $section) {
            $holder = $model->claim((int) $org['id'], $module, $section, $actor['public_id'], $name, self::tabFrom($input));
            $result[] = [
                'section' => $section,
                'user'    => $holder['user_public_id'],
                'tab'     => $holder['tab_id'],
                'name'    => $holder['user_name'],
                'mine'    => $holder['mine'],
            ];
        }

        Response::success(['module' => $module, 'ttl' => WorkspaceLock::TTL_SECONDS, 'locks' => $result]);
    }

    /** Release named sections, or every section this member holds (`all`). */
    public function releaseLocks(): void
    {
        $input  = $this->input();
        $org    = $this->requireOrg((string) ($input['org'] ?? ''));
        $actor  = $this->requireOrgMember($input, (int) $org['id']);
        $module = $this->moduleFrom($input, $org, $actor);
        $model  = new WorkspaceLock();

        if (!empty($input['all'])) {
            $model->releaseAll((int) $org['id'], $module, $actor['public_id'], self::tabFrom($input));
        } else {
            foreach ($this->sectionList($input) as $section) {
                $model->release((int) $org['id'], $module, $section, $actor['public_id'], self::tabFrom($input));
            }
        }

        Response::success(['module' => $module]);
    }

    /** Sweep 4R item 4: the session (browser tab) a lock request comes from. A tab id is the client's own random
        token, so only its shape is checked; '' (an older client) is one tab per person, as before. */
    private static function tabFrom(array $src): string
    {
        $t = (string) ($src['tab'] ?? '');
        return preg_match('/^[A-Za-z0-9_-]{1,40}$/', $t) === 1 ? $t : '';
    }

    /** `sections` from a request body: strings only, deduplicated, bounded. */
    private function sectionList(array $input): array
    {
        $raw = $input['sections'] ?? [];
        if (is_string($raw)) {
            $raw = [$raw];
        }
        if (!is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $section) {
            if (!is_string($section)) {
                continue;
            }
            $section = trim($section);
            if ($section === '' || strlen($section) > 160 || isset($out[$section])) {
                continue;
            }
            $out[$section] = true;
            if (count($out) >= 100) {   // a person is not editing a hundred things
                break;
            }
        }
        return array_keys($out);
    }

    /**
     * The readable Q&A trail for reporting/export.
     *   GET /workspace/answers?org=<public_id>[&phase=1]
     */
    public function answers(): void
    {
        $org    = $this->requireOrg(isset($_GET['org']) ? (string) $_GET['org'] : '');
        $actor  = $this->requireOrgMember($_GET, (int) $org['id']);
        $module = $this->moduleFrom($_GET, $org, $actor);
        $model  = new StepAnswer();

        $phase = isset($_GET['phase']) ? (int) $_GET['phase'] : 0;
        $rows  = $phase >= 1 && $phase <= 5
            ? $model->forPhase((int) $org['id'], $phase, $module)
            : $model->forOrg((int) $org['id'], $module);

        Response::success(['module' => $module, 'answers' => $rows]);
    }

    /**
     * ── GET /workspace/history ───────────────────────────────────────────
     * {org, module, since?, actor?, limit?} → { entries: [ {rev, base_rev,
     *   actor, changed:{section:{before,after}}, at}, … ] }, newest first.
     *
     * Who changed what in this workspace, and when. `since` is a rev — which is
     * how a client that has just been handed a newer document asks what it has
     * just been handed and who did it, instead of guessing from a ledger it
     * keeps in memory (see api/sql/workspace-history.sql for what that guessing
     * cost). `actor` narrows it to one member's changes, which is the other
     * question worth asking: what did this person last do here.
     *
     * PRIVACY. Every row goes through the same Core\DocPrivacy filter as the
     * document itself, and it has to: the sections stored in a revision are the
     * document's own sections, so an unfiltered history would hand a member
     * exactly what show() withholds — another leader's private track, a roster
     * PIN — with a timestamp on it. The filter needs the whole document's shape
     * to know who the caller IS (it resolves their leader id through the
     * roster), so each side of a revision is grafted onto the CURRENT document
     * before filtering and taken back out afterwards.
     */
    public function history(): void
    {
        $org    = $this->requireOrg(isset($_GET['org']) ? (string) $_GET['org'] : '');
        $actor  = $this->requireOrgMember($_GET, (int) $org['id']);
        $module = $this->moduleFrom($_GET, $org, $actor);

        $since = (isset($_GET['since']) && $_GET['since'] !== '') ? (int) $_GET['since'] : null;
        $who   = isset($_GET['actor_id']) ? (string) $_GET['actor_id'] : '';
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;

        $rows    = (new WorkspaceRevision())->forOrg((int) $org['id'], $module, $since, $who, $limit);
        $stored  = (new Workspace())->findByOrg((int) $org['id'], $module);
        $current = $stored !== null ? json_decode((string) $stored['doc']) : null;
        $privacy = $this->privacy($module, $actor);

        $entries = [];
        foreach ($rows as $row) {
            $changed = json_decode((string) $row['changed']);
            if (!is_object($changed)) {
                continue;
            }
            $entries[] = [
                'rev'      => (int) $row['rev'],
                'base_rev' => (int) $row['base_rev'],
                'actor'    => $row['actor_public_id'],
                'changed'  => $this->filterChanged($privacy, $changed, $current),
                'at'       => $row['updated_at'],
                'started'  => $row['created_at'],
            ];
        }

        Response::success(['module' => $module, 'rev' => $stored !== null ? (int) $stored['rev'] : 0, 'entries' => $entries]);
    }

    /**
     * One revision's {section: {before, after}}, filtered per member.
     *
     * DocPrivacy reads whole documents — it has to, because working out which
     * entries are the caller's own means finding them in the roster first. A
     * revision holds only the sections that moved, so each side is grafted onto
     * the current document, filtered there, and the sections lifted back out:
     * the filter sees the shape it expects and the answer is still only about
     * this revision. A section the filter removed entirely comes back as null,
     * which is the honest report — something changed here that is not yours to
     * read — rather than a hole the reader cannot see.
     */
    private function filterChanged(DocPrivacy $privacy, object $changed, ?object $current): object
    {
        $out = new \stdClass();
        foreach ($changed as $key => $pair) {
            $side = new \stdClass();
            foreach (['before', 'after'] as $which) {
                $value = is_object($pair) && property_exists($pair, $which) ? $pair->$which : null;
                if ($value === null) {
                    $side->$which = null;
                    continue;
                }
                $host = $current !== null ? json_decode(json_encode($current)) : new \stdClass();
                if (!is_object($host)) {
                    $host = new \stdClass();
                }
                $host->$key = $value;
                $seen = $privacy->forRead($host);
                $side->$which = (is_object($seen) && property_exists($seen, $key)) ? $seen->$key : null;
            }
            $out->$key = $side;
        }
        return $out;
    }

    /**
     * The question map used to project this module's readable Q&A trail, or
     * null when the module has none yet. The Pipeline's lives in
     * config/questions.php; every other module in config/questions-<id>.php.
     */
    private function questionMapFor(string $module): ?array
    {
        $map = config($module === $this->defaultModule() ? 'questions' : 'questions-' . $module);
        return is_array($map) && $map !== [] ? $map : null;
    }

    /**
     * The request body's `doc`, re-encoded as JSON text with its object/array
     * shapes intact — ready to store verbatim.
     *
     * Decoded WITHOUT assoc so {} stays {} (see the class note). We hand the
     * model text rather than a structure so nothing downstream can re-shape the
     * document by accident: what the browser sent is exactly what is stored.
     *
     * @return string|null JSON text, or null when the body carries no document.
     */
    private function documentFromBody(): ?string
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return null;
        }

        $body = json_decode($raw);
        if (!is_object($body) || !isset($body->doc) || !is_object($body->doc)) {
            return null;
        }

        $json = json_encode($body->doc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return $json === false ? null : $json;
    }

    /**
     * A document object back to the JSON TEXT the model stores.
     *
     * Same flags as documentFromBody() so a document that goes through the
     * privacy filter is byte-identical to one that did not need to, and null on
     * an encode failure so the caller can keep what it already had rather than
     * store nothing.
     */
    private function reencode(object $doc): ?string
    {
        $json = json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return $json === false ? null : $json;
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
