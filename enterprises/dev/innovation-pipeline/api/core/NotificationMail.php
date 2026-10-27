<?php
namespace Core;

use Models\MailOutbox;
use Models\Organization;

/**
 * NotificationMail — the delivery half of the notification service.
 *
 * The directive of 3 Sep 2026 splits this work down the middle. The APP decides
 * that a notification is due, who it goes to, and what it says; it posts that
 * as JSON and is finished (js/features/email.js). Everything after the POST is
 * the service's, and this is it: turn one notification into one email per
 * recipient, attach the analytics PDF when the notification asks for one, and
 * record every attempt.
 *
 * ── The rules this follows ──────────────────────────────────────────────────
 *
 * 1. QUEUE FIRST, SEND SECOND — the same contract as Core\MemberInvite and
 *    Core\AssignmentNotice, for the same reason. The row is in mail_outbox
 *    before a socket is opened, so a deployment with no SMTP leaves a readable
 *    record rather than nothing at all, and the Super Admin console
 *    (GET /access/mail) can show what would have gone out.
 *
 * 2. ACCEPTING IS NOT DELIVERING. The app treats any 2xx as "sent" and never
 *    retries (Part 3, point 5), so the endpoint answers 2xx once the messages
 *    are queued — queued is the promise the service can actually keep. What
 *    happened to each one afterwards is in the response body and in the outbox,
 *    not in the status code.
 *
 * 3. THE APP'S HTML IS THE SOURCE, NOT THE EMAIL. For a completion the app
 *    sends a short notice followed by the whole Module Management analytics
 *    page, because that page is what has to become the PDF. Mailing the page
 *    itself as the body would put 200KB of app markup into an inbox that has
 *    none of the app's CSS. So the notice becomes the body, in the same house
 *    style as the rest of the suite's mail, and the report becomes the
 *    attachment — which is exactly what Part 3 describes the email as being.
 *
 * 4. NOTHING HERE THROWS. The only caller is an HTTP endpoint that has already
 *    promised the app an answer, and a notification that cannot be mailed must
 *    not become a 500 the app records as a failure it will never retry.
 */
class NotificationMail
{
    /** One notification, one step, one team. More addresses than this is not a
     *  roster — it is either a bug or somebody using the endpoint as a relay. */
    public const MAX_RECIPIENTS = 50;

    /**
     * Deliver one notification to every address on it.
     *
     * @param array  $n      the validated notification (Part 3's eight fields)
     * @param string $module the program, taken from the URL path
     *
     * @return array{recipients:int, queued:int, sent:int, failed:int,
     *               pdf:string, mail:array<int,array<string,string>>}
     */
    public static function deliver(array $n, string $module): array
    {
        $kind    = (string) $n['kind'];
        $subject = (string) $n['subject'];
        $stepId  = (string) ($n['stepId'] ?? '');
        $orgName = (string) ($n['orgName'] ?? '');
        $wantPdf = $kind === 'step-complete' && !empty($n['pdf']);

        [$notice, $report] = self::split((string) ($n['html'] ?? ''));

        /* The PDF is rendered ONCE and attached to every copy. It is the same
           document for everybody, and Chrome is the expensive part of this
           request — rendering it per recipient would make a six-person team six
           times slower for an identical file. */
        $attachments = [];
        $pdfNote     = $wantPdf ? 'not rendered' : 'not requested';
        if ($wantPdf) {
            $error = null;
            $bytes = $report !== '' ? Pdf::render($report, $subject, $module, $error) : null;
            if ($bytes !== null) {
                $attachments[] = [
                    'name' => self::pdfName($stepId, $module),
                    'type' => 'application/pdf',
                    'data' => $bytes,
                ];
                $pdfNote = 'attached (' . self::kb(strlen($bytes)) . ')';
            } else {
                /* The email still goes. A completion notice with no attachment
                   is worth more than silence, and the reason is on the response
                   and in the log rather than swallowed. */
                $pdfNote = 'failed: ' . ($report === '' ? 'the notification carried no report' : (string) $error);
                error_log('notification PDF not rendered (' . $module . ' step ' . $stepId . '): ' . $pdfNote);
            }
        }

        $orgId   = self::orgId($orgName);
        $program = self::programName($module);
        $html    = self::html($program, $subject, $notice, $kind, count($attachments) > 0);
        $text    = self::text($program, $subject, $notice, $kind, count($attachments) > 0);

        $outbox  = new MailOutbox();
        $sent    = 0;
        $failed  = 0;
        $queued  = 0;
        $mail    = [];

        foreach ($n['to'] as $email) {
            $email = (string) $email;
            try {
                $mailId = $outbox->queue([
                    'kind'            => 'notify-' . $kind,
                    'to_email'        => $email,
                    'to_name'         => '',
                    'subject'         => $subject,
                    'body_html'       => $html,
                    'body_text'       => $text,
                    'organization_id' => $orgId,
                ]);
                $queued++;
            } catch (\Throwable $e) {
                $failed++;
                $mail[] = ['to' => $email, 'status' => 'queue-failed', 'error' => $e->getMessage()];
                error_log('notification could not be queued for ' . $email . ': ' . $e->getMessage());
                continue;
            }

            if (!Mailer::configured()) {
                $mail[] = ['to' => $email, 'status' => 'no-transport'];
                continue;
            }

            try {
                $result = (new Mailer())->send($email, '', $subject, $html, $text, $attachments);
            } catch (\Throwable $e) {
                $result = ['ok' => false, 'error' => $e->getMessage(), 'retryable' => true];
            }

            if (!empty($result['ok'])) {
                $outbox->markSent($mailId);
                $sent++;
                $mail[] = ['to' => $email, 'status' => 'sent'];
                continue;
            }

            $outbox->markFailed($mailId, (string) ($result['error'] ?? 'unknown'), (bool) ($result['retryable'] ?? true));
            $failed++;
            $mail[] = ['to' => $email, 'status' => 'send-failed', 'error' => (string) ($result['error'] ?? 'unknown')];
        }

        return [
            'recipients' => count($n['to']),
            'queued'     => $queued,
            'sent'       => $sent,
            'failed'     => $failed,
            'pdf'        => $pdfNote,
            'mail'       => $mail,
        ];
    }

    /* ── Taking the notification apart ──────────────────────────── */

    /**
     * Split the app's html into the notice and the report behind it.
     *
     * notifyEmailHtml() builds a completion body as `notice + '<hr/>' + hub`,
     * and that separator is the only seam in it. Matched loosely (any spelling
     * of the tag, any attributes) and only on the FIRST one, because the
     * analytics page contains rules of its own.
     *
     * A reminder has no separator and no report: the whole thing is the notice.
     *
     * @return array{0:string, 1:string}  [notice, report]
     */
    private static function split(string $html): array
    {
        if (preg_match('/<hr\b[^>]*>/i', $html, $m, PREG_OFFSET_CAPTURE) === 1) {
            $at = (int) $m[0][1];
            return [substr($html, 0, $at), substr($html, $at + strlen($m[0][0]))];
        }
        return [$html, ''];
    }

    /** The organization row's id, when the name it was given resolves to one.
     *  orgName is the only identifier the app sends (Part 3 forbids adding
     *  another), so a blank, unknown or ambiguous name simply means the outbox
     *  row is not filed under an organization — never that the mail stops. */
    private static function orgId(string $orgName): ?int
    {
        if (trim($orgName) === '') {
            return null;
        }
        try {
            $r = (new Organization())->resolve($orgName);
            return ($r['status'] ?? '') === 'ok' ? (int) $r['organization']['id'] : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function programName(string $module): string
    {
        try {
            $name = Catalogue::name($module);
            return $name !== '' ? $name : $module;
        } catch (\Throwable $e) {
            return $module;
        }
    }

    private static function pdfName(string $stepId, string $module): string
    {
        $step = preg_replace('/[^0-9.]/', '', $stepId) ?? '';
        return ($step !== '' ? 'Step-' . $step . '-' : '') . $module . '-analytics-report.pdf';
    }

    private static function kb(int $bytes): string
    {
        return $bytes >= 1048576
            ? round($bytes / 1048576, 1) . ' MB'
            : max(1, (int) round($bytes / 1024)) . ' KB';
    }

    /* ── Rendering ──────────────────────────────────────────────── */

    /**
     * Inline-styled, table-free, one column of short blocks — the same shape as
     * MemberInvite and AssignmentNotice, and for the same reason: no stylesheet
     * is ever loaded in an inbox, and this is the layout that survives every
     * client. The app's own markup does not come in here; only its words do.
     */
    private static function html(string $program, string $subject, string $notice, string $kind, bool $hasPdf): string
    {
        $e      = static fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
        $notice = self::sanitize($notice);
        $accent = $kind === 'deadline-reminder' ? '#B8892A' : '#076D9E';
        $eyebrow = $kind === 'deadline-reminder' ? 'Deadline reminder' : 'Step complete';

        return
        '<div style="font-family:Helvetica,Arial,sans-serif;background:#f6f4f0;padding:28px 16px">' .
          '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9d5cd;border-radius:6px;padding:32px">' .

            '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:' . $accent . '">' .
              $e($program) . ' &middot; ' . $e($eyebrow) .
            '</div>' .
            '<h1 style="font-size:22px;line-height:1.35;margin:10px 0 18px;color:#1c1a17">' . $e($subject) . '</h1>' .

            '<div style="font-size:15px;line-height:1.6;color:#413d36">' . $notice . '</div>' .

            ($hasPdf
              ? '<div style="background:#faf9f6;border:1px solid #e6e2da;border-radius:4px;padding:16px;margin:22px 0 0">' .
                  '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b8579;margin-bottom:4px">Attached</div>' .
                  '<div style="font-size:14px;color:#1c1a17">The Module Management analytics report, as a PDF.</div>' .
                '</div>'
              : '') .

            '<p style="font-size:12.5px;line-height:1.6;color:#8b8579;margin:26px 0 0;' .
               'border-top:1px solid #e6e2da;padding-top:16px">' .
              'Sent automatically by ' . $e($program) . '. There is nothing to reply to at this address.' .
            '</p>' .

          '</div>' .
        '</div>';
    }

    private static function text(string $program, string $subject, string $notice, string $kind, bool $hasPdf): string
    {
        $plain = trim(html_entity_decode(strip_tags(self::sanitize($notice)), ENT_QUOTES, 'UTF-8'));
        $plain = trim(preg_replace('/\n{3,}/', "\n\n", preg_replace('/[ \t]+/', ' ', $plain) ?? '') ?? '');

        return $program . ' — ' . $subject . "\n\n"
            . ($plain !== '' ? $plain . "\n\n" : '')
            . ($hasPdf ? "The Module Management analytics report is attached as a PDF.\n\n" : '')
            . 'Sent automatically by ' . $program . '. There is nothing to reply to at this address.';
    }

    /**
     * Keep the notice's words and its light markup; drop everything that could
     * act.
     *
     * The notice arrives over an unauthenticated POST, so it is untrusted input
     * that is about to be put in front of people in their mail client. Strip to
     * a small tag set and remove every attribute — `style` included, because
     * the email's own styling is here and the app's is not.
     */
    private static function sanitize(string $html): string
    {
        $html = preg_replace('#<(script|style|iframe|object|embed)\b.*?</\1\s*>#is', '', $html) ?? '';
        $html = strip_tags($html, '<p><br><strong><b><em><i><h2><h3><ul><ol><li>');
        /* strip_tags keeps the attributes on the tags it allows. */
        $html = preg_replace('#<\s*([a-z0-9]+)\b[^>]*>#i', '<$1>', $html) ?? '';
        /* The app writes its notice as an <h2> followed by a <p>; the subject
           is already the email's headline, so a second copy of it is noise. */
        $html = preg_replace('#<h2>.*?</h2>#is', '', $html) ?? '';
        return trim($html);
    }
}
