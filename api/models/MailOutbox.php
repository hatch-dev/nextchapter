<?php
namespace Models;

use Core\Model;

/**
 * MailOutbox — every message the application has tried to send.
 *
 * Mail is the one side effect nobody can inspect after the fact: there is no
 * "sent items" to open, and a message that silently failed looks exactly like
 * one that was never triggered. So the row is written BEFORE the attempt
 * (`queued`), and dispatch marks it `sent` or `failed` with the reason.
 *
 * That ordering is also what makes adding a team member independent of mail
 * working at all. With no SMTP configured the invite is queued, the member is
 * still created, and the Super Admin console can read the message back and
 * hand over the details another way. Mail being unconfigured is a visible
 * pending item, never a failed operation.
 *
 * See api/sql/access.sql for the table, and Core\Mailer for the transport.
 */
class MailOutbox extends Model
{
    /** Record a message as queued. Returns its public id. */
    public function queue(array $attrs): string
    {
        $publicId = public_id('mail');

        $this->execute(
            'INSERT INTO mail_outbox
                (public_id, kind, to_email, to_name, subject, body_html, body_text,
                 status, organization_id, user_public_id)
             VALUES
                (:public_id, :kind, :to_email, :to_name, :subject, :body_html, :body_text,
                 :status, :organization_id, :user_public_id)',
            [
                ':public_id'       => $publicId,
                ':kind'            => $attrs['kind'] ?? 'generic',
                ':to_email'        => $attrs['to_email'],
                ':to_name'         => ($attrs['to_name'] ?? '') === '' ? null : $attrs['to_name'],
                ':subject'         => $attrs['subject'] ?? '',
                ':body_html'       => $attrs['body_html'] ?? '',
                ':body_text'       => ($attrs['body_text'] ?? '') === '' ? null : $attrs['body_text'],
                ':status'          => 'queued',
                ':organization_id' => $attrs['organization_id'] ?? null,
                ':user_public_id'  => ($attrs['user_public_id'] ?? '') === '' ? null : $attrs['user_public_id'],
            ]
        );

        return $publicId;
    }

    /** Mark a queued message delivered. */
    public function markSent(string $publicId): void
    {
        $this->execute(
            'UPDATE mail_outbox
                SET status = \'sent\', sent_at = NOW(), attempts = attempts + 1, error = NULL
              WHERE public_id = :pid',
            [':pid' => $publicId]
        );
    }

    /**
     * Mark an attempt failed, keeping the message queued for a retry.
     *
     * Status stays 'queued' rather than becoming 'failed' when the reason is
     * that no transport is configured: that is not a failure of this message,
     * it is a gap in the deployment, and flipping it to 'failed' would bury a
     * perfectly valid invite that will send the moment SMTP is filled in.
     */
    public function markFailed(string $publicId, string $error, bool $retryable = true): void
    {
        $this->execute(
            'UPDATE mail_outbox
                SET status = :status, attempts = attempts + 1, error = :error
              WHERE public_id = :pid',
            [
                ':status' => $retryable ? 'queued' : 'failed',
                ':error'  => mb_substr($error, 0, 2000),
                ':pid'    => $publicId,
            ]
        );
    }

    /** The most recent messages, newest first — the Super Admin console's view. */
    public function recent(int $limit = 50): array
    {
        $limit = max(1, min(200, $limit));
        return $this->select(
            "SELECT public_id, kind, to_email, to_name, subject, status, error,
                    attempts, organization_id, user_public_id, created_at, sent_at
               FROM mail_outbox ORDER BY id DESC LIMIT $limit"
        );
    }

    /** One message in full, including the rendered body. */
    public function findByPublicId(string $publicId): ?array
    {
        return $this->selectOne(
            'SELECT public_id, kind, to_email, to_name, subject, body_html, body_text,
                    status, error, attempts, organization_id, user_public_id,
                    created_at, sent_at
               FROM mail_outbox WHERE public_id = :pid',
            [':pid' => $publicId]
        );
    }

    /** Everything still waiting to go out, oldest first. */
    public function queued(int $limit = 25): array
    {
        $limit = max(1, min(200, $limit));
        return $this->select(
            "SELECT public_id, to_email, to_name, subject, body_html, body_text
               FROM mail_outbox WHERE status = 'queued' ORDER BY id ASC LIMIT $limit"
        );
    }
}
