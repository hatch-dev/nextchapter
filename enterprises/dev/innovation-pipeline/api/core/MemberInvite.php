<?php
namespace Core;

use Models\MailOutbox;

/**
 * MemberInvite — the message a newly created team member receives.
 *
 * Composes, records and attempts one email carrying the three things the spec
 * asks for: the programs this person has been given, the credentials they sign
 * in with, and enough context to know what any of it is.
 *
 * ── Two decisions worth knowing ─────────────────────────────────────────────
 *
 * 1. THE TEMPORARY PASSWORD IS IN THE SENT MESSAGE, IN THE CLEAR, AND NOWHERE ELSE
 *    (ruled 7 Oct 2026). It is a temporary password marked must_change: it opens
 *    "Choose a new password" once and nothing else, so what reaches the mailbox
 *    stops working at the first sign-in. Mail is not a confidential channel and
 *    the message says so. The STORED copy (mail_outbox) has the password
 *    withheld, because a readable password may never be stored (Directive
 *    2 Oct 2026, 6.1.1). If that trade stops being acceptable, the change is
 *    local: send a one-time link here instead.
 *
 * 2. QUEUE FIRST, SEND SECOND. The row exists in mail_outbox before any socket
 *    is opened, so a send that fails — or a deployment with no SMTP at all —
 *    leaves a readable record rather than nothing. Adding a member never fails
 *    because of mail. See Models\MailOutbox.
 *
 * The HTML is inline-styled and table-free by choice: it is short enough that
 * a single column of block elements survives every client, and the project's
 * stylesheet is off-limits to this file — it is never loaded in an inbox.
 */
class MemberInvite
{
    /**
     * Compose, record and try to deliver one invitation.
     *
     * @param array  $member   name, email, username, passcode, role
     * @param array  $org      id (int), public_id, name, account_type
     * @param array  $modules  granted module ids
     * @param string $invitedBy The administrator's display name, if known.
     *
     * @return array{queued:bool, mail_id?:string, sent:bool, status:string, error?:string}
     *         Reported back to the admin who added the member, so the UI can
     *         say what actually happened rather than assuming it worked.
     */
    public static function send(array $member, array $org, array $modules, string $invitedBy = ''): array
    {
        $email = trim((string) ($member['email'] ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['queued' => false, 'sent' => false, 'status' => 'no-address'];
        }

        $name    = trim((string) ($member['name'] ?? ''));
        $subject = 'Your access to ' . Catalogue::suiteName();

        /* The temporary password (7 Oct 2026): in the copy that is SENT, and withheld from the copy that is
           STORED. mail_outbox is a database table, and a readable password may never be stored (Directive
           2 Oct 2026, 6.1.1), so the outbox row says the password was withheld; only the SMTP transmission
           carries it. A queued row that is retried later therefore carries no password either. */
        $stored = $member;
        if ((string) ($member['temporary'] ?? '') !== '') { $stored['temporary'] = ''; $stored['temporary_withheld'] = true; }

        $html = self::html($member, $org, $modules, $invitedBy);
        $text = self::text($member, $org, $modules, $invitedBy);
        $storedHtml = self::html($stored, $org, $modules, $invitedBy);
        $storedText = self::text($stored, $org, $modules, $invitedBy);

        $outbox = new MailOutbox();
        try {
            $mailId = $outbox->queue([
                'kind'            => 'member-invite',
                'to_email'        => $email,
                'to_name'         => $name,
                'subject'         => $subject,
                'body_html'       => $storedHtml,
                'body_text'       => $storedText,
                'organization_id' => $org['id'] ?? null,
                'user_public_id'  => $member['public_id'] ?? null,
            ]);
        } catch (\Throwable $e) {
            /* The member is already created and committed. A failure to even
               record the invite must not turn that into an error the admin
               sees as "adding failed", so it is logged and reported. */
            error_log('member invite could not be queued: ' . $e->getMessage());
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
     * Every granted program's OWN sign-in URL.
     *
     * Each program is its own door — /{role}/{program}/login — and one account
     * opens all of them. The message used to name a single door (the first
     * live program) and list the others as bare names, which left a recipient
     * granted three programs holding one link and no way to reach the other
     * two except by guessing. Each program now carries its own address.
     */
    private static function moduleLoginUrl(string $id): string
    {
        return rtrim(Catalogue::moduleUrl($id), '/') . '/login';
    }

    /* ── Rendering ──────────────────────────────────────────────── */

    private static function html(array $member, array $org, array $modules, string $invitedBy): string
    {
        $e       = static fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
        $entries = Catalogue::modules($modules);

        $rows = '';
        foreach ($entries as $m) {
            $planned = ($m['status'] ?? '') !== 'live';
            $url     = self::moduleLoginUrl((string) $m['id']);
            $rows .=
                '<div style="border:1px solid #d9d5cd;border-radius:4px;padding:14px 16px;margin:0 0 10px">' .
                  '<a href="' . $e($url) . '" ' .
                     'style="color:#8a6414;font-size:16px;font-weight:600;text-decoration:none">' .
                     $e($m['name']) .
                  '</a>' .
                  '<div style="color:#6b6559;font-size:13px;margin-top:4px">' . $e($m['tag'] ?? '') . '</div>' .
                  ($planned
                    ? '<div style="color:#8a6414;font-size:12px;margin-top:6px">Content still in development — the workspace is ready.</div>'
                    : '') .
                  /* The address in full, not only behind the name. A link whose
                     text is the program's title tells you nothing about where
                     it goes, and half of these will be read in a client that
                     shows no status bar and blocks the anchor entirely. */
                  '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #efece5">' .
                    '<a href="' . $e($url) . '" style="color:#8a6414;font-size:13px;' .
                       'text-decoration:none;word-break:break-all">' . $e($url) . '</a>' .
                  '</div>' .
                '</div>';
        }
        if ($rows === '') {
            /* Nothing granted yet. This is the one case that still needs a
               single door, because there is no program row to carry one. */
            $fallback = Catalogue::loginUrl($modules);
            $rows = '<div style="color:#6b6559;font-size:14px">No programs have been assigned yet. ' .
                    'Your administrator can add them at any time.</div>' .
                    '<div style="margin-top:10px"><a href="' . $e($fallback) . '" ' .
                       'style="color:#8a6414;font-size:13px;text-decoration:none;word-break:break-all">' .
                       $e($fallback) . '</a></div>';
        }

        $intro = $invitedBy !== ''
            ? $e($invitedBy) . ' has added you to <strong>' . $e($org['name'] ?? '') . '</strong> on ' . $e(Catalogue::suiteName()) . '.'
            : 'You have been added to <strong>' . $e($org['name'] ?? '') . '</strong> on ' . $e(Catalogue::suiteName()) . '.';

        $plural = count($entries) > 1;
        $none   = $entries === [];

        return
        '<div style="font-family:Helvetica,Arial,sans-serif;background:#f6f4f0;padding:28px 16px">' .
          '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9d5cd;border-radius:6px;padding:32px">' .

            '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a6414">' .
              $e(Catalogue::suiteName()) .
            '</div>' .
            '<h1 style="font-size:24px;line-height:1.3;margin:10px 0 6px;color:#1c1a17">Your workspace is ready</h1>' .
            '<p style="font-size:15px;line-height:1.6;color:#413d36;margin:0 0 24px">' . $intro . '</p>' .

            '<h2 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6559;' .
                'border-bottom:1px solid #e6e2da;padding-bottom:8px;margin:0 0 14px">' .
              ($none ? 'Your programs' : ($plural ? 'Your programs and their addresses' : 'Your program')) .
            '</h2>' .
            $rows .

            '<h2 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6559;' .
                'border-bottom:1px solid #e6e2da;padding-bottom:8px;margin:26px 0 14px">Signing in</h2>' .
            '<p style="font-size:14px;line-height:1.6;color:#413d36;margin:0 0 14px">' .
              ($none
                ? 'Sign in at the address above with the details below. The same username and ' .
                  'password will open every program your administrator adds to your account.'
                : ($plural
                  ? 'Open any program at its own address above. <strong>The same username and password ' .
                    'work for every one of them</strong> — there is one account, not one per program, and ' .
                    'you can move between them once you are in.'
                  : 'Open the program at its address above and sign in with the details below.')) .
            '</p>' .
            /* Exactly the two things the sign-in screen asks for, and nothing
               else. It used to carry the organization's name and its code as
               well, because the organization was the first field on that
               screen; it no longer is (AuthController), and a credential block
               listing values with nowhere to type them is how a recipient
               concludes they are on the wrong page. The organization is still
               named — in the sentence above, as the team they have joined,
               which is what it now is.
               The sign-in ADDRESS has left this block for the same reason in
               reverse: there is no longer one of them, so a single field
               labelled "Sign-in page" would have been the wrong answer for two
               programs out of three. */
            '<div style="background:#faf9f6;border:1px solid #e6e2da;border-radius:4px;padding:16px;margin:0 0 16px">' .
              self::field('Username', '<code style="font-size:15px;color:#1c1a17">' . $e($member['username'] ?? '') . '</code>') .
              (self::temporaryShown($member)
                ? self::field('Temporary password', '<code style="font-size:15px;color:#1c1a17">' . $e($member['temporary']) . '</code>')
                : (!empty($member['temporary_withheld'])
                  ? self::field('Temporary password', '<span style="color:#6b6559">' . $e(self::WITHHELD) . '</span>')
                  : '')) .
            '</div>' .
            '<p style="font-size:13px;line-height:1.6;color:#6b6559;margin:0 0 24px">' .
              ((self::temporaryShown($member) || !empty($member['temporary_withheld']))
                ? 'This password works only once: you choose your own the first time you sign in. ' .
                  'Email is not a private channel, so sign in soon and keep this message to yourself.'
                : 'Your administrator will give you a temporary password. You choose your own the first time you sign in.') .
            '</p>' .

            '<p style="font-size:12.5px;line-height:1.6;color:#8b8579;margin:26px 0 0;' .
               'border-top:1px solid #e6e2da;padding-top:16px">' .
              'You can only open the programs listed above. Each keeps its own separate workspace — ' .
              'work you do in one is never visible from another. If something here looks wrong, ' .
              'reply to whoever invited you rather than to this address.' .
            '</p>' .

          '</div>' .
        '</div>';
    }

    /** What the stored copy says in place of the password (it never holds the password itself). */
    private const WITHHELD = 'Sent in the email only; not kept on the server.';

    private static function temporaryShown(array $member): bool
    {
        return (string) ($member['temporary'] ?? '') !== '';
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
     * The plain-text alternative.
     *
     * Written rather than stripped from the HTML: strip_tags() on the markup
     * above would run every link's text into the next line and drop the URLs
     * entirely, which is the one thing this message exists to deliver.
     */
    private static function text(array $member, array $org, array $modules, string $invitedBy): string
    {
        $entries = Catalogue::modules($modules);
        $plural  = count($entries) > 1;
        $none    = $entries === [];

        $lines = [];
        $lines[] = Catalogue::suiteName();
        $lines[] = str_repeat('=', strlen(Catalogue::suiteName()));
        $lines[] = '';
        $lines[] = ($invitedBy !== '' ? $invitedBy . ' has added you' : 'You have been added')
                 . ' to ' . (string) ($org['name'] ?? '') . '.';
        $lines[] = '';
        $lines[] = $none ? 'YOUR PROGRAMS' : ($plural ? 'YOUR PROGRAMS AND THEIR ADDRESSES' : 'YOUR PROGRAM');

        if ($entries === []) {
            $lines[] = '  (none assigned yet — your administrator can add them at any time)';
            $lines[] = '  ' . Catalogue::loginUrl($modules);
        }
        foreach ($entries as $m) {
            $lines[] = '';
            $lines[] = '  * ' . $m['name'] . (($m['status'] ?? '') !== 'live' ? '  (in development)' : '');
            if (($m['tag'] ?? '') !== '') {
                $lines[] = '    ' . $m['tag'];
            }
            $lines[] = '    ' . self::moduleLoginUrl((string) $m['id']);
        }

        $lines[] = '';
        $lines[] = 'SIGNING IN';
        if ($none) {
            $lines[] = '  Sign in at the address above with these details. The same username and';
            $lines[] = '  password will open every program your administrator adds to your account.';
        } elseif ($plural) {
            $lines[] = '  Open any program at its own address above. THE SAME USERNAME AND';
            $lines[] = '  PASSWORD WORK FOR EVERY ONE OF THEM — there is one account, not one';
            $lines[] = '  per program, and you can move between them once you are in.';
        } else {
            $lines[] = '  Open the program at its address above and sign in with these details.';
        }
        $lines[] = '';
        $lines[] = '  Username:  ' . (string) ($member['username'] ?? '');
        if (self::temporaryShown($member) || !empty($member['temporary_withheld'])) {
            $lines[] = '  Temporary password:  ' . (self::temporaryShown($member) ? (string) $member['temporary'] : self::WITHHELD);
            $lines[] = '';
            $lines[] = '  This password works only once: you choose your own the first time you';
            $lines[] = '  sign in. Email is not a private channel, so sign in soon and keep this';
            $lines[] = '  message to yourself.';
        } else {
            $lines[] = '';
            $lines[] = '  Your administrator will give you a temporary password. You choose your';
            $lines[] = '  own the first time you sign in.';
        }
        $lines[] = '';
        $lines[] = 'You can only open the programs listed above. Each keeps its own separate';
        $lines[] = 'workspace — work you do in one is never visible from another.';

        return implode("\n", $lines);
    }
}
