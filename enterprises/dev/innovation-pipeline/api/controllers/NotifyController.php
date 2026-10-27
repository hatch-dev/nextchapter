<?php
namespace Controllers;

use Core\Catalogue;
use Core\Controller;
use Core\Mailer;
use Core\ReportDocument;
use Core\ReportMail;
use Core\ReportPdf;
use Core\Response;
use Models\MailOutbox;
use Models\Organization;
use Models\User;

/**
 * NotifyController — the notification service the email component posts to.
 *
 * js/features/email.js has been client-side complete since July and inert until
 * something existed to POST to. The directive of 3 Sep 2026 assumes that
 * something is an AWS service on another host; this is the same contract served
 * from our own API instead, which removes the two things that make an external
 * host hard:
 *
 *   · SAME ORIGIN. The app can address this relatively ('api/notify'), so it
 *     resolves under /apps/ locally and /app/enterprise/ live with no
 *     per-environment edit, and the HTTPS-only rule in Part 3 is met by the
 *     page's own scheme rather than by a hostname anyone has to remember.
 *   · CORS IS ALREADY DONE. api/index.php answers the pre-flight and sets the
 *     headers for every endpoint (see its section 4), so the failure Part 3
 *     calls "the most common reason for this kind of integration to fail
 *     silently" cannot happen here.
 *
 * ── What the app sends ─────────────────────────────────────────
 * Exactly the eight fields of Part 3, and no authentication header:
 *
 *   {kind, subject, to[], stepId, orgName, sentAt, pdf, html}
 *
 * Part 6 forbids changing that, so this endpoint cannot ask for the actor_id
 * every other controller authenticates with. See the note on abuse below — the
 * recipient list is not trusted, which is what stands in for that.
 *
 * ── Abuse ──────────────────────────────────────────────────────
 * An unauthenticated endpoint that sends mail to whatever addresses it is
 * handed is an open relay, and this one cannot ask who is calling. So it does
 * not believe `to`. The organization is resolved from `orgName`, its roster is
 * read from the database, and the request's addresses are INTERSECTED with it.
 * Anything else is dropped. The worst a forged request can do is mail people
 * who are already on that organization's roster, with this program's own
 * wording — not reach a stranger.
 *
 * ── The PDF ────────────────────────────────────────────────────
 * Part 3 says a 'step-complete' message carries the analytics report as an
 * attached PDF, and it now does. Three pieces make that work, all of them here
 * in api/core/ and none of them a new dependency:
 *
 *   Core\ReportDocument  reads the app's on-screen markup into blocks
 *   Core\ReportPdf       draws those blocks onto A4, charts and all
 *   Core\ReportMail      draws them again as mail a client can actually show
 *
 * That last one matters as much as the attachment. The body used to be the
 * app's own HTML passed straight through, which is written against
 * assets/css/styles.css and draws its charts as inline <svg> — so it arrived
 * with both charts stripped, every class-driven rule gone with the stylesheet,
 * and the stat tiles in a single column. The report is now rebuilt as inline-
 * styled tables, and the charts it cannot show inline it shows as bars.
 *
 * IF THE PDF CANNOT BE MADE — unparseable markup, or a renderer that throws —
 * the message still goes, with the report inline and a line saying the
 * attachment could not be produced. The rule the previous revision set stands:
 * an email with the report in it is worth more than no email, and an email
 * claiming an attachment that is not there is worth less than either.
 */
class NotifyController extends Controller
{
    /** The two kinds Part 3 point 4 defines. Anything else is a client bug. */
    private const KINDS = ['step-complete', 'deadline-reminder'];

    /** Generous, but an email is not a file transfer. */
    private const MAX_HTML       = 2000000;
    private const MAX_RECIPIENTS = 200;

    public function store(): void
    {
        $this->requireSignedIn();   /* Directive 2 Oct 2026, Part 6.1.4 */
        $input = $this->input();

        $kind = trim((string) ($input['kind'] ?? ''));
        if (!in_array($kind, self::KINDS, true)) {
            Response::validationError(['kind' => ['Unknown notification kind.']]);
        }

        $subject = trim((string) ($input['subject'] ?? ''));
        if ($subject === '') {
            Response::validationError(['subject' => ['Subject is required.']]);
        }
        /* The column is VARCHAR(255) and a subject line longer than that is
           unreadable in any client anyway. */
        $subject = mb_substr($subject, 0, 255);

        $html = (string) ($input['html'] ?? '');
        if (strlen($html) > self::MAX_HTML) {
            Response::validationError(['html' => ['Message body is too large.']]);
        }

        $stepId  = mb_substr(trim((string) ($input['stepId'] ?? '')), 0, 40);
        $orgName = trim((string) ($input['orgName'] ?? ''));
        $wantsPdf = !empty($input['pdf']);

        /* ── Who this is really for ──────────────────────────────
           The request's own list is a claim, not an instruction. */
        $requested = $this->requestedEmails($input['to'] ?? []);
        if ($requested === []) {
            Response::validationError(['to' => ['No valid recipient addresses.']]);
        }

        $org = $this->resolveOrg($orgName);
        $roster = (new User())->byOrganization((int) $org['id']);

        $recipients = [];
        foreach ($roster as $member) {
            $email = strtolower(trim((string) ($member['email'] ?? '')));
            if ($email !== '' && isset($requested[$email])) {
                $recipients[$email] = (string) ($member['name'] ?? '');
            }
        }
        if ($recipients === []) {
            /* Every address the app named is a stranger to this organization.
               Refused rather than silently dropped: a 2xx here would tell the
               app the notification was accepted when nothing was sent. */
            Response::error(
                'No requested recipient belongs to this organization.',
                422,
                ['reason' => 'no-roster-match']
            );
        }

        /* ── The message, and the attachment ─────────────────────
           Composed once for everyone: the report is identical for every
           recipient, and rendering a PDF per address would be the same few
           kilobytes drawn twenty times. */
        $composed    = $this->compose($kind, $html, $wantsPdf, $org, $subject);
        $body        = $composed['html'];
        $attachments = $composed['attachments'];

        $outbox   = new MailOutbox();
        $mailer   = new Mailer();
        $mailKind = mb_substr('notify-' . $kind . ($wantsPdf ? ($attachments === [] ? '-pdf_failed' : '-pdf') : ''), 0, 40);

        /* Asked once, not per recipient: with no transport every row is left
           `queued` and readable in the outbox rather than marked failed —
           mail being unconfigured is a pending deployment step, not a delivery
           failure. Same order as Core\MemberInvite, which is the only other
           thing here that posts mail. */
        $configured = Mailer::configured();

        $sent = 0;
        $failed = 0;
        $queued = 0;
        foreach (array_slice($recipients, 0, self::MAX_RECIPIENTS, true) as $email => $name) {
            /* Queued BEFORE the attempt, like every other message this app
               sends — see Models\MailOutbox for why. */
            try {
                $id = $outbox->queue([
                    'kind'            => $mailKind,
                    'to_email'        => $email,
                    'to_name'         => $name,
                    'subject'         => $subject,
                    'body_html'       => $body,
                    'body_text'       => $composed['text'],
                    'organization_id' => (int) $org['id'],
                ]);
            } catch (\Throwable $e) {
                error_log('notification could not be queued: ' . $e->getMessage());
                $failed++;
                continue;
            }
            $queued++;

            if (!$configured) {
                continue;
            }

            $result = $mailer->send($email, $name, $subject, $body, $composed['text'], $attachments);
            if (!empty($result['ok'])) {
                $outbox->markSent($id);
                $sent++;
                continue;
            }
            $outbox->markFailed($id, (string) ($result['error'] ?? 'Unknown error'), !empty($result['retryable']));
            $failed++;
        }

        /* 2xx means ACCEPTED, which is what the app records as 'sent' (Part 3
           point 2). With no MAIL_HOST configured every message stays queued and
           readable in the outbox — a pending deployment step, not a failure, so
           it must not come back as one. */
        Response::success([
            'accepted'   => true,
            'kind'       => $kind,
            'stepId'     => $stepId,
            'queued'     => $queued,
            'sent'       => $sent,
            'failed'     => $failed,
            'configured' => $configured,
            /* Kept for the app, which has read it since the endpoint existed —
               now answering the question it always asked: is the report still
               waiting on a converter? It is not, unless this one failed. */
            'pdfPending' => $wantsPdf && $attachments === [],
            'attached'   => $composed['attachment'],
        ]);
    }

    /**
     * The addresses the request asked for, lower-cased and de-duplicated into a
     * lookup. Shape is checked here so the intersection below cannot be fed a
     * string, a nested array, or four thousand entries.
     *
     * @param mixed $to
     * @return array<string,true>
     */
    private function requestedEmails($to): array
    {
        if (!is_array($to)) {
            return [];
        }
        $out = [];
        foreach ($to as $entry) {
            if (!is_string($entry)) {
                continue;
            }
            $email = strtolower(trim($entry));
            if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $out[$email] = true;
            }
            if (count($out) >= self::MAX_RECIPIENTS) {
                break;
            }
        }
        return $out;
    }

    /**
     * The organization named in the request body.
     *
     * `orgName` is what the reader typed into the app, so Organization::resolve
     * does the matching — it already handles a public id, an exact name, and a
     * name whose spacing or case has drifted. An empty or unmatched name is a
     * refusal: without an organization there is no roster, and without a roster
     * there is nothing to check the recipients against.
     */
    private function resolveOrg(string $orgName): array
    {
        $found = (new Organization())->resolve($orgName);
        if (($found['status'] ?? '') !== 'ok' || !isset($found['organization'])) {
            Response::error(
                'Organization not recognized.',
                422,
                ['reason' => 'no-org', 'status' => $found['status'] ?? 'none']
            );
        }
        return $found['organization'];
    }

    /**
     * The message: its HTML body, its plain-text alternative, and the PDF that
     * travels with it.
     *
     * The app's `html` is a FRAGMENT written for the SCREEN — class names
     * against assets/css/styles.css, custom properties, a dark ground, and
     * both charts as inline <svg>. None of that survives an inbox, so it is
     * read into blocks and drawn again: once as mail-safe tables, once as A4.
     *
     * Every step of that is allowed to fail without taking the notification
     * with it. Unreadable markup falls back to the app's own HTML, the way
     * this endpoint behaved before; a renderer that throws sends the report
     * inline and says why the attachment is missing. The message always goes.
     *
     * @return array{html:string,text:string,attachments:array,attachment:string}
     */
    private function compose(string $kind, string $html, bool $wantsPdf, array $org, string $subject): array
    {
        $doc = ReportDocument::parse($html);
        if ($doc === null) {
            error_log('notification body could not be parsed; sending the app markup unchanged');
            return [
                'html'        => $this->fallbackBody($html),
                'text'        => '',
                'attachments' => [],
                'attachment'  => '',
            ];
        }

        $program = $this->program();
        $eyebrow = implode(' · ', array_filter([
            trim((string) ($org['name'] ?? '')),
            $program !== '' ? Catalogue::name($program) : '',
        ]));

        $file = '';
        $note = '';
        $attachments = [];

        if ($kind === 'step-complete' && $wantsPdf && $doc->isAnalytics()) {
            try {
                $file = ReportPdf::fileName($doc, $program, date('Y-m-d'));
                $attachments[] = [
                    'name' => $file,
                    'type' => 'application/pdf',
                    'data' => ReportPdf::render($doc, [
                        'eyebrow'   => $eyebrow,
                        'generated' => 'Generated ' . date('j F Y'),
                        'footer'    => $subject !== '' ? $subject : $doc->title(),
                    ]),
                ];
            } catch (\Throwable $e) {
                /* Logged rather than raised: the recipients want the report,
                   and they are about to get it inline. */
                error_log('analytics PDF could not be rendered: ' . $e->getMessage());
                $file = '';
                $attachments = [];
                $note = 'The report is below. The printable PDF could not be produced for this message.';
            }
        }

        $opts = ['eyebrow' => $eyebrow, 'attachment' => $file, 'note' => $note];
        if ($kind !== 'step-complete') {
            $opts['closing'] = 'Sent automatically one week before an assigned step falls due, '
                             . 'to the step’s assignees and the organization’s administrators.';
        }

        return [
            'html'        => ReportMail::html($doc, $opts),
            'text'        => ReportMail::text($doc, $opts),
            'attachments' => $attachments,
            'attachment'  => $file,
        ];
    }

    /**
     * Which program the request came in on.
     *
     * The path names it (Part 3, point 3) and routes/api.php registers one
     * route per module, but Core\Router matches paths exactly and hands the
     * controller nothing about which one matched — so it is read back off the
     * request here and checked against the catalogue. An unknown or absent
     * segment is simply no program: the eyebrow loses a line and the file name
     * a prefix, and nothing else depends on it.
     */
    private function program(): string
    {
        $path    = (string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?? '');
        $segment = basename(rtrim($path, '/'));
        $known   = (array) (config('modules.modules') ?? []);

        return isset($known[$segment]) ? $segment : '';
    }

    /**
     * The body for markup this service could not read: the app's own HTML,
     * wrapped exactly as it was before the report was rebuilt for mail. It
     * will not look like the screen — nothing sent to an inbox can, without
     * the stylesheet — but it is everything the app sent, and nothing here
     * will have dropped a figure from it.
     */
    private function fallbackBody(string $html): string
    {
        return '<div style="font-family:Helvetica,Arial,sans-serif;line-height:1.55;color:#1E2530">'
             . $html . '</div>';
    }
}
