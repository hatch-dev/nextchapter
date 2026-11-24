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

    /**
     * A MySQL named lock, so two requests asking to send the same notification at the same moment take turns
     * at "has this already been queued?" (live test, 13 Nov 2026, F-15: two people completing a step together
     * mailed everyone twice). Held only around the check and the queueing, never around the sending.
     */
    public function lock(string $name, int $timeoutSeconds = 20): bool
    {
        $row = $this->selectOne('SELECT GET_LOCK(:n, :t) AS got', [':n' => mb_substr($name, 0, 64), ':t' => $timeoutSeconds]);
        return (int) ($row['got'] ?? 0) === 1;
    }

    public function unlock(string $name): void
    {
        $this->selectOne('SELECT RELEASE_LOCK(:n) AS released', [':n' => mb_substr($name, 0, 64)]);
    }

    /** Has this exact message (organization, kind family, recipient, subject) been queued in the last $seconds? */
    public function queuedRecently(int $orgId, string $kindPrefix, string $toEmail, string $subject, int $seconds): bool
    {
        $row = $this->selectOne(
            'SELECT 1 AS hit FROM mail_outbox
              WHERE organization_id = :org AND kind LIKE :kind AND to_email = :to AND subject = :subject
                AND status <> \'cancelled\' AND created_at >= (NOW() - INTERVAL ' . max(1, $seconds) . ' SECOND)
              LIMIT 1',
            [':org' => $orgId, ':kind' => $kindPrefix . '%', ':to' => $toEmail, ':subject' => $subject]
        );
        return $row !== null;
    }

    /**
     * Messages a retry may still send: queued, tried fewer than $maxAttempts times, not older than $days, and
     * at least $minAgeSeconds old (a younger one may still be in its first send). Ages are measured by the
     * database's own clock, the one created_at was written with — PHP's may be in another time zone.
     */
    public function retryable(int $limit = 25, int $maxAttempts = 5, int $days = 7, ?int $orgId = null, int $minAgeSeconds = 60): array
    {
        $limit = max(1, min(200, $limit));
        return $this->select(
            "SELECT public_id, kind, to_email, to_name, subject, body_html, body_text, attempts, organization_id, user_public_id, created_at
               FROM mail_outbox
              WHERE status = 'queued' AND attempts < " . max(1, $maxAttempts) . '
                AND created_at >= (NOW() - INTERVAL ' . max(1, $days) . ' DAY)
                AND created_at <= (NOW() - INTERVAL ' . max(0, $minAgeSeconds) . ' SECOND)'
                . ($orgId !== null ? ' AND organization_id = ' . (int) $orgId : '') . "
              ORDER BY id ASC LIMIT $limit"
        );
    }

    /**
     * Nothing still waiting goes to somebody who is no longer in the organization (P-16, 24 Nov 2026).
     *
     * A removed member's reminders, assignment notices and invitation stayed queued, and a retry sent them up to a week
     * later. Called after anyone is removed; by address, because a reminder's row does not say which person it is for,
     * and addresses are unique across the installation. The rows are kept, marked 'cancelled', so the record still
     * says what was never sent and why.
     */
    public function cancelForFormerMembers(int $orgId): void
    {
        $this->execute(
            "UPDATE mail_outbox m
                SET m.status = 'cancelled', m.error = 'Not sent: the recipient is no longer in the organization.'
              WHERE m.organization_id = :org AND m.status = 'queued'
                AND NOT EXISTS (SELECT 1 FROM users u
                                 WHERE u.organization_id = m.organization_id AND LOWER(TRIM(u.email)) = LOWER(TRIM(m.to_email)))",
            [':org' => $orgId]
        );
    }

    /** May this message still go out? Asked at the moment of sending, for whatever removed them without being asked. */
    public function isForMember(int $orgId, string $email): bool
    {
        return $this->selectOne(
            'SELECT 1 AS hit FROM users WHERE organization_id = :org AND LOWER(TRIM(email)) = LOWER(TRIM(:email)) LIMIT 1',
            [':org' => $orgId, ':email' => $email]
        ) !== null;
    }

    public function markCancelled(string $publicId, string $why = 'Not sent: the recipient is no longer in the organization.'): void
    {
        $this->execute(
            "UPDATE mail_outbox SET status = 'cancelled', error = :why WHERE public_id = :pid AND status = 'queued'",
            [':why' => $why, ':pid' => $publicId]
        );
    }

    /** Has the same message to the same person been queued again since, and not cancelled (P-24)? */
    public function hasNewerCopy(string $publicId): bool
    {
        return $this->selectOne(
            "SELECT 1 AS hit FROM mail_outbox m JOIN mail_outbox n
                 ON n.organization_id = m.organization_id AND n.kind = m.kind AND n.subject = m.subject
                AND n.user_public_id = m.user_public_id AND n.id > m.id AND n.status <> 'cancelled'
              WHERE m.public_id = :pid LIMIT 1",
            [':pid' => $publicId]
        ) !== null;
    }

    /** Every copy of one message, whoever to and whatever came of it, from an hour before $since on (P-23). */
    public function copies(int $orgId, string $kindPrefix, string $subject, string $since): array
    {
        return $this->select(
            'SELECT to_email, status FROM mail_outbox
              WHERE organization_id = :org AND kind LIKE :kind AND subject = :subject AND created_at >= (:since - INTERVAL 1 HOUR)',
            [':org' => $orgId, ':kind' => $kindPrefix . '%', ':subject' => $subject, ':since' => $since]
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
