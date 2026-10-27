<?php
namespace Controllers;

use Core\Controller;
use Core\Response;
use Models\Note;
use Models\Organization;
use Models\User;

/**
 * Private per-user notes.
 *
 * Notes are scoped to a member AND to the program they were written in. The
 * member half was always true; the program half arrived with the access work —
 * see Models\Note for why the two are different questions.
 *
 * The module a request names is resolved through the shared moduleFrom() gate
 * like every other per-program endpoint, so a member cannot read or write notes
 * filed under a program they have not been granted.
 */
class NoteController extends Controller
{
    private const MAX_LEN = 5000;

    public function index(): void
    {
        $actor = $this->requireActor(isset($_GET['actor_id']) ? (string) $_GET['actor_id'] : '');
        Response::success(['notes' => (new Note())->forUser($actor['public_id'], $this->moduleForActor($_GET, $actor))]);
    }

    public function store(): void
    {
        $input = $this->input();
        $actor = $this->requireActor($input['actor_id'] ?? '');

        $body = trim((string) ($input['body'] ?? ''));
        $step = trim((string) ($input['step'] ?? ''));
        if ($body === '') {
            Response::validationError(['body' => ['Note cannot be empty.']]);
        }
        if (mb_strlen($body) > self::MAX_LEN) {
            Response::validationError(['body' => ['Note is too long.']]);
        }

        $saved = (new Note())->create($actor['public_id'], $body, $step, $this->moduleForActor($input, $actor));
        Response::success(['note' => $saved], 201);
    }

    public function delete(): void
    {
        $input = $this->input();
        $actor = $this->requireActor($input['actor_id'] ?? '');
        $id    = (int) ($input['id'] ?? 0);

        if (!(new Note())->deleteOwned($id, $actor['public_id'])) {
            Response::error('Note not found.', 404, ['reason' => 'no-note']);
        }
        Response::success(['deleted' => true]);
    }

    private function requireActor(string $actorId): array
    {
        /* The session's member (Directive 2 Oct 2026, Part 6); the app administrator, as the member they name. */
        $actorId = trim($actorId);
        $actor = $this->isAppAdmin() && $actorId !== '' ? (new User())->findByPublicId($actorId) : $this->sessionUser();
        if ($actor === null) {
            Response::error('You must be signed in.', 403, ['reason' => 'forbidden']);
        }
        return $actor;
    }

    /**
     * Which program these notes belong to, run through the same gate as every
     * other per-program endpoint (Core\Controller::moduleFrom).
     *
     * A note is addressed by its author rather than by an organization, so the
     * org has to be looked up from the actor before the gate can be applied.
     * That lookup is the reason this is a method and not one inline call: the
     * entitlement rules live on the organization, and skipping it would leave
     * notes as the one endpoint where naming any module at all was enough.
     */
    private function moduleForActor(array $src, array $actor): string
    {
        $org = (new Organization())->findById((int) $actor['organization_id']);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }
        return $this->moduleFrom($src, $org, $actor);
    }
}
