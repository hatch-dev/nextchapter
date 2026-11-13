<?php
declare(strict_types=1);

namespace Core;

use Models\MailOutbox;

/**
 * Sends again what the outbox still holds as `queued`.
 *
 * Every message is written to mail_outbox before it is sent, so a send that
 * fails for a passing reason (a dropped socket, a mail server refusing one
 * login) leaves a row behind marked `queued`. Until 13 Nov 2026 nothing ever
 * looked at those rows again (MailOutbox::queued() had no caller): in the live
 * test 5 of 18 assignment emails were simply never delivered (F-17).
 *
 * Run from two places:
 *   · tools/mail-retry.php, on a schedule (Task Scheduler / cron), for all
 *     organizations;
 *   · after each notification request (NotifyController), for that one
 *     organization and a few rows only, so mail recovers even where no
 *     schedule has been set up.
 *
 * A retried message is the stored copy: its HTML and text, without the PDF a
 * step-complete report carried, and without the temporary password a member
 * invite carried (that is never stored — see Core\MemberInvite).
 */
final class MailRetry
{
    public const MAX_ATTEMPTS = 5;
    public const MAX_AGE_DAYS = 7;

    /**
     * @param int|null $orgId only this organization's mail (null: everyone's)
     * @param int      $minAgeSeconds leave rows younger than this alone (they may still be being sent)
     * @return array{tried:int, sent:int, failed:int}
     */
    public static function run(int $limit = 25, ?int $orgId = null, int $minAgeSeconds = 60): array
    {
        $out = ['tried' => 0, 'sent' => 0, 'failed' => 0];
        if (!Mailer::configured()) {
            return $out;
        }
        $outbox = new MailOutbox();
        $mailer = new Mailer();
        foreach ($outbox->retryable($limit, self::MAX_ATTEMPTS, self::MAX_AGE_DAYS, $orgId, $minAgeSeconds) as $row) {
            $out['tried']++;
            $result = $mailer->send(
                (string) $row['to_email'],
                (string) ($row['to_name'] ?? ''),
                (string) $row['subject'],
                (string) $row['body_html'],
                (string) ($row['body_text'] ?? '')
            );
            if (!empty($result['ok'])) {
                $outbox->markSent((string) $row['public_id']);
                $out['sent']++;
            } else {
                $outbox->markFailed((string) $row['public_id'], (string) ($result['error'] ?? 'unknown'), !empty($result['retryable']));
                $out['failed']++;
            }
        }
        return $out;
    }
}
