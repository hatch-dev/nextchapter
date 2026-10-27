<?php
namespace Core;

use Models\MailOutbox;

/**
 * AssignmentNotice — the message a member receives when a step is assigned
 * to them.
 *
 * Assignment is not a label: it decides who may sign a section off
 * (stepCompleteLock, js/features/assignments.js), so being given one and not
 * being told is the difference between work that is waiting for you and work
 * you do not know exists. Nothing told anybody — AssignmentController::set()
 * wrote the row and returned — so this is that message.
 *
 * ── The three rules this follows ────────────────────────────────────────────
 *
 * 1. QUEUE FIRST, SEND SECOND, exactly as Core\MemberInvite does. The row is
 *    in mail_outbox before a socket is opened, so a deployment with no SMTP
 *    leaves a readable record instead of nothing, and the Super Admin console
 *    can see what would have gone out. Assigning must never fail because of
 *    mail — the assignment itself is already committed by the time we get here.
 *
 * 2. ONLY ON ASSIGN, AND ONLY ON A CHANGE. Unassigning sends nothing: the
 *    request was "tell them when they are assigned", and a message saying work
 *    has been taken away is a different decision that nobody has made. Nor is
 *    anything sent when the row already existed — the UI toggles, and a
 *    double-click must not be two emails.
 *
 * 3. NOBODY IS EMAILED ABOUT THEMSELVES. An administrator assigning their own
 *    name already knows; the mail would only be noise, and noise is how a
 *    notification stops being read.
 *
 * The step's NAME comes from the client, because it is the program's to know:
 * step ids are '1.1' in all twelve programs and their titles live in each
 * program's own JS, not in the catalogue this file can read. It is trimmed,
 * length-capped and escaped here, and the message degrades to "Step 1.1" when
 * it is missing — an older client, or a caller that does not send it.
 *
 * The HTML is inline-styled and table-free for the same reason MemberInvite's
 * is: it is one column of short blocks, which survives every mail client, and
 * the project's stylesheet is never loaded in an inbox.
 */
class AssignmentNotice
{
    /** A step title longer than this is not a title. */
    private const MAX_STEP_NAME = 160;

    /**
     * Compose, record and try to deliver one assignment notice.
     *
     * @param array  $member    public_id, name, email  — the person assigned
     * @param array  $org       id (int), public_id, name
     * @param string $module    module id, e.g. 'pipeline'
     * @param string $step      step id, e.g. '1.1'
     * @param string $stepName  the step's title, if the caller knows it
     * @param string $assignedBy the administrator's display name, if known
     *
     * @return array{queued:bool, mail_id?:string, sent:bool, status:string, error?:string}
     *         Handed back to the admin who made the assignment so the UI can
     *         say what actually happened rather than assuming it worked.
     */
    public static function send(
        array $member,
        array $org,
        string $module,
        string $step,
        string $stepName = '',
        string $assignedBy = ''
    ): array {
        $email = trim((string) ($member['email'] ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            /* A member with no address on file is a normal state, not a fault:
               the roster allows one to be added later. Say so rather than
               reporting a failure the admin can do nothing about. */
            return ['queued' => false, 'sent' => false, 'status' => 'no-address'];
        }

        $name        = trim((string) ($member['name'] ?? ''));
        $stepName    = mb_substr(trim($stepName), 0, self::MAX_STEP_NAME);
        $programName = Catalogue::name($module);
        $label       = $stepName !== '' ? ('Step ' . $step . ' · ' . $stepName) : ('Step ' . $step);

        $subject = 'You have been assigned ' . ($stepName !== '' ? $stepName : ('Step ' . $step))
                 . ' — ' . $programName;

        $html = self::html($name, $org, $module, $programName, $step, $stepName, $label, $assignedBy);
        $text = self::text($name, $org, $module, $programName, $step, $stepName, $label, $assignedBy);

        $outbox = new MailOutbox();
        try {
            $mailId = $outbox->queue([
                'kind'            => 'step-assignment',
                'to_email'        => $email,
                'to_name'         => $name,
                'subject'         => $subject,
                'body_html'       => $html,
                'body_text'       => $text,
                'organization_id' => $org['id'] ?? null,
                'user_public_id'  => $member['public_id'] ?? null,
            ]);
        } catch (\Throwable $e) {
            error_log('assignment notice could not be queued: ' . $e->getMessage());
            return ['queued' => false, 'sent' => false, 'status' => 'queue-failed', 'error' => $e->getMessage()];
        }

        if (!Mailer::configured()) {
            return ['queued' => true, 'mail_id' => $mailId, 'sent' => false, 'status' => 'no-transport'];
        }

        $result = (new Mailer())->send($email, $name, $subject, $html, $text);
        if (!empty($result['ok'])) {
            $outbox->markSent($mailId);
            return ['queued' => true, 'mail_id' => $mailId, 'sent' => true, 'status' => 'sent'];
        }

        $outbox->markFailed($mailId, (string) ($result['error'] ?? 'unknown'), (bool) ($result['retryable'] ?? true));
        return [
            'queued'  => true,
            'mail_id' => $mailId,
            'sent'    => false,
            'status'  => 'send-failed',
            'error'   => (string) ($result['error'] ?? 'unknown'),
        ];
    }

    /**
     * The deep link to the step itself.
     *
     * js/router.js reads /{role}/{program}/step/{id}, so this opens the work
     * rather than the program's front door — one click from the mail to the
     * thing it is about.
     */
    private static function stepUrl(string $module, string $step): string
    {
        return rtrim(Catalogue::moduleUrl($module), '/') . '/step/' . rawurlencode($step);
    }

    /* ── Rendering ──────────────────────────────────────────────── */

    private static function html(
        string $name,
        array $org,
        string $module,
        string $programName,
        string $step,
        string $stepName,
        string $label,
        string $assignedBy
    ): string {
        $e   = static fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
        $url = self::stepUrl($module, $step);

        $who = $assignedBy !== ''
            ? $e($assignedBy) . ' has assigned you a section of'
            : 'You have been assigned a section of';

        $greeting = $name !== '' ? 'Hello ' . $e(explode(' ', $name)[0]) . ',' : 'Hello,';

        return
        '<div style="font-family:Helvetica,Arial,sans-serif;background:#f6f4f0;padding:28px 16px">' .
          '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9d5cd;border-radius:6px;padding:32px">' .

            '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a6414">' .
              $e($programName) .
            '</div>' .
            '<h1 style="font-size:24px;line-height:1.3;margin:10px 0 6px;color:#1c1a17">' .
              ($stepName !== '' ? $e($stepName) : 'Step ' . $e($step)) .
            '</h1>' .
            '<p style="font-size:15px;line-height:1.6;color:#413d36;margin:0 0 24px">' .
              $greeting . ' ' . $who . ' <strong>' . $e($programName) . '</strong> to you' .
              (($org['name'] ?? '') !== '' ? ' at ' . $e($org['name']) : '') . '.' .
            '</p>' .

            '<div style="background:#faf9f6;border:1px solid #e6e2da;border-radius:4px;padding:16px;margin:0 0 20px">' .
              self::field('Program', $e($programName)) .
              self::field('Section', $e($label)) .
              ($assignedBy !== '' ? self::field('Assigned by', $e($assignedBy)) : '') .
            '</div>' .

            /* What being assigned actually MEANS here, because it is not
               decoration: an assigned section can only be marked complete by
               the people named on it, or an administrator. */
            '<p style="font-size:14px;line-height:1.6;color:#413d36;margin:0 0 24px">' .
              'Being assigned means this section is yours to complete — once a section has ' .
              'names on it, only those members or an administrator can mark it done.' .
            '</p>' .

            '<a href="' . $e($url) . '" style="display:inline-block;background:#B8892A;color:#fff;' .
               'text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:4px">' .
               'Open this section &rarr;</a>' .

            '<p style="font-size:12.5px;line-height:1.6;color:#8b8579;margin:26px 0 0;' .
               'border-top:1px solid #e6e2da;padding-top:16px">' .
              'You will need to sign in if you are not already. If you think this was sent ' .
              'in error, reply to whoever assigned it rather than to this address.' .
            '</p>' .

          '</div>' .
        '</div>';
    }

    private static function field(string $label, string $value): string
    {
        return '<div style="margin:0 0 10px">' .
            '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b8579;margin-bottom:2px">' .
                htmlspecialchars($label, ENT_QUOTES, 'UTF-8') .
            '</div>' .
            '<div style="font-size:14px;color:#1c1a17">' . $value . '</div>' .
        '</div>';
    }

    /**
     * The plain-text alternative, written rather than stripped from the HTML —
     * strip_tags() would drop the one URL this message exists to deliver.
     */
    private static function text(
        string $name,
        array $org,
        string $module,
        string $programName,
        string $step,
        string $stepName,
        string $label,
        string $assignedBy
    ): string {
        $lines   = [];
        $lines[] = $programName;
        $lines[] = str_repeat('=', mb_strlen($programName));
        $lines[] = '';
        $lines[] = ($name !== '' ? 'Hello ' . explode(' ', $name)[0] . ',' : 'Hello,');
        $lines[] = '';
        $lines[] = ($assignedBy !== ''
                    ? $assignedBy . ' has assigned you a section of ' . $programName
                    : 'You have been assigned a section of ' . $programName)
                 . (($org['name'] ?? '') !== '' ? ' at ' . $org['name'] : '') . '.';
        $lines[] = '';
        $lines[] = '  Program:  ' . $programName;
        $lines[] = '  Section:  ' . $label;
        if ($assignedBy !== '') {
            $lines[] = '  Assigned by: ' . $assignedBy;
        }
        $lines[] = '';
        $lines[] = 'Being assigned means this section is yours to complete — once a section';
        $lines[] = 'has names on it, only those members or an administrator can mark it done.';
        $lines[] = '';
        $lines[] = 'Open this section:';
        $lines[] = '  ' . self::stepUrl($module, $step);
        $lines[] = '';
        $lines[] = 'You will need to sign in if you are not already. If you think this was';
        $lines[] = 'sent in error, reply to whoever assigned it rather than to this address.';

        return implode("\n", $lines);
    }
}
