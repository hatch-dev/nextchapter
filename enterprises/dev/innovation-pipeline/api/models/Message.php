<?php
namespace Models;

use Core\Model;

/**
 * Team-chat messages: one room per (organization, program).
 *
 * The room used to be the organization alone, which made Team Chat the loudest
 * leak between programs in the suite — a message sent while the team was
 * working in Executive Readiness appeared in the AI Innovation Pipeline, out of
 * its context and in front of people who may not even have that program. Chat
 * is a per-program conversation, so it is keyed like every other per-program
 * table (see api/sql/access.sql).
 *
 * Existing rows default to 'pipeline': every message in the table was written
 * before a second program existed.
 */
class Message extends Model
{
    /** Insert a message and return the stored row (with id + timestamp). */
    public function create(array $a): array
    {
        $id = $this->execute(
            'INSERT INTO messages
                (organization_id, module, user_public_id, user_name, initials, color, body)
             VALUES
                (:oid, :module, :uid, :name, :initials, :color, :body)',
            [
                ':oid'      => $a['organization_id'],
                ':module'   => $a['module'],
                ':uid'      => $a['user_public_id'] ?? null,
                ':name'     => $a['user_name'],
                ':initials' => $a['initials'] ?? '',
                ':color'    => $a['color'] ?? '#4866A0',
                ':body'     => $a['body'],
            ]
        );
        return $this->selectOne(
            'SELECT id, module, user_public_id, user_name, initials, color, body, created_at
               FROM messages WHERE id = :id',
            [':id' => $id]
        );
    }

    /** Recent messages in one program's room, newer than $sinceId, oldest first. */
    public function recent(int $organizationId, string $module, int $sinceId = 0, int $limit = 100): array
    {
        $rows = $this->select(
            'SELECT id, module, user_public_id, user_name, initials, color, body, created_at
               FROM messages
              WHERE organization_id = :oid AND module = :module AND id > :since
              ORDER BY id DESC LIMIT ' . (int) $limit,
            [':oid' => $organizationId, ':module' => $module, ':since' => $sinceId]
        );
        return array_reverse($rows);
    }
}
