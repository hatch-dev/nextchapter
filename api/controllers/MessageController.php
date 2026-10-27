<?php
namespace Controllers;

use Core\Controller;
use Core\Response;
use Models\Message;
use Models\Organization;
use Models\User;

/**
 * Team chat — one room per (organization, program).
 *
 * Reading the room now requires membership, as posting to it always did. It
 * did not before: the history endpoint took an organization's public id and
 * nothing else, so anyone holding that id could read a team's whole
 * conversation. Both ends resolve their module through the shared gate, so a
 * member also cannot read the room of a program they have not been granted.
 */
class MessageController extends Controller
{
    private const MAX_LEN = 2000;

    public function index(): void
    {
        $orgPublicId = isset($_GET['org']) ? trim((string) $_GET['org']) : '';
        $since       = isset($_GET['since']) ? (int) $_GET['since'] : 0;

        $org = (new Organization())->findByPublicId($orgPublicId);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }

        $actor  = $this->requireOrgMember($_GET, (int) $org['id']);
        $module = $this->moduleFrom($_GET, $org, $actor);

        $messages = (new Message())->recent((int) $org['id'], $module, $since);
        Response::success(['module' => $module, 'messages' => $messages]);
    }

    /**
     * GET /chat/ticket?org=&module= — admission to the live relay (tools/chat-server.js).
     *
     * The relay used to put anyone who connected with ?org=<id> into that organization's room. It has no
     * database and cannot read the session cookie (another port, another path), so the API vouches
     * instead: the same gate as reading the room (a member of the organization with the program, or the
     * app administrator), then a ticket signed with CHAT_RELAY_SECRET naming that one room, valid 60 s —
     * long enough to connect, too short to be worth passing on. Directive 2 Oct 2026, Part 6.1.4.
     */
    public function ticket(): void
    {
        $org = (new Organization())->findByPublicId(isset($_GET['org']) ? trim((string) $_GET['org']) : '');
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }
        $actor  = $this->requireOrgMember($_GET, (int) $org['id']);
        $module = $this->moduleFrom($_GET, $org, $actor);
        $secret = (string) env('CHAT_RELAY_SECRET', '');
        if ($secret === '') {
            Response::error('Live chat is not configured.', 503, ['reason' => 'chat-off']);
        }
        $room    = $org['public_id'] . '::' . $module;
        $b64     = static fn(string $s): string => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
        $payload = $b64((string) json_encode(['room' => $room, 'exp' => time() + 60]));
        $sig     = $b64(hash_hmac('sha256', $payload, $secret, true));
        Response::success(['ticket' => $payload . '.' . $sig, 'room' => $room]);
    }

    public function store(): void
    {
        $input       = $this->input();
        $orgPublicId = isset($input['org']) ? trim((string) $input['org']) : '';
        $body        = isset($input['body']) ? trim((string) $input['body']) : '';

        $org = (new Organization())->findByPublicId($orgPublicId);
        if ($org === null) {
            Response::error('Organization not found.', 404, ['reason' => 'no-org']);
        }

        $actor  = $this->requireOrgMember($input, (int) $org['id']);
        $module = $this->moduleFrom($input, $org, $actor);

        if ($body === '') {
            Response::validationError(['body' => ['Message cannot be empty.']]);
        }
        if (mb_strlen($body) > self::MAX_LEN) {
            Response::validationError(['body' => ['Message is too long (max ' . self::MAX_LEN . ' characters).']]);
        }

        /* requireOrgMember returns the lean sign-in projection; the chat row
           carries the author's avatar, so re-read the full record. */
        $author = (new User())->findByPublicId((string) $actor['public_id']) ?? $actor;

        $saved = (new Message())->create([
            'organization_id' => (int) $org['id'],
            'module'          => $module,
            'user_public_id'  => $author['public_id'],
            'user_name'       => $author['name'],
            'initials'        => ($author['initials'] ?? '') ?: initials_from((string) $author['name']),
            'color'           => ($author['color'] ?? '') ?: '#4866A0',
            'body'            => $body,
        ]);

        Response::success(['message' => $saved], 201);
    }
}
