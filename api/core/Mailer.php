<?php
namespace Core;

/**
 * Mailer — a small, dependency-free SMTP client.
 *
 * WHY HAND-ROLLED. Everything in api/ is hand-rolled except the Anthropic SDK,
 * which is here because talking to that API is not a thing you should write
 * yourself. SMTP is: it is a line protocol with about eight verbs, and a
 * mail library would drag a second dependency tree into a project that has
 * deliberately kept one. ~150 lines against a spec that has not moved since
 * 1982 is the cheaper trade.
 *
 * CONFIGURATION lives in apps/.env (see .env.example):
 *
 *   MAIL_HOST      smtp.example.com          no host = nothing is sent
 *   MAIL_PORT      587 (STARTTLS) | 465 (implicit TLS) | 25
 *   MAIL_USERNAME  / MAIL_PASSWORD           omit both for an open relay
 *   MAIL_ENCRYPTION tls | ssl | none         defaults from the port
 *   MAIL_FROM      no-reply@example.com
 *   MAIL_FROM_NAME Next Chapter Programs
 *
 * NOT CONFIGURED IS NOT AN ERROR. With no MAIL_HOST, send() returns a
 * 'not-configured' result and the caller leaves the message queued in
 * mail_outbox. Adding a team member must not fail because the deployment has
 * not been given a mail server yet — see Models\MailOutbox.
 *
 * The transport never throws. Every failure path comes back as
 * ['ok' => false, 'error' => …, 'retryable' => bool] because the only caller
 * is a user-facing write that has already committed its real work.
 */
class Mailer
{
    private const TIMEOUT = 15;
    private const CRLF    = "\r\n";

    /**
     * The largest single attachment, before base64 inflates it by a third.
     * Generous for a vector report (the analytics PDF is a few kilobytes) and
     * well under what any relay will take in one message.
     */
    private const MAX_ATTACHMENT = 8000000;

    /** @var resource|null */
    private $socket = null;

    /** True when a mail server has been configured at all. */
    public static function configured(): bool
    {
        return trim((string) env('MAIL_HOST', '')) !== '';
    }

    /** Who messages come from — also used as the SMTP envelope sender. */
    public static function fromAddress(): string
    {
        $from = trim((string) env('MAIL_FROM', ''));
        return $from !== '' ? $from : 'no-reply@localhost';
    }

    public static function fromName(): string
    {
        return trim((string) env('MAIL_FROM_NAME', '')) ?: 'Next Chapter Programs';
    }

    /**
     * Deliver one message.
     *
     * @param array<int,array{name:string,type?:string,data:string}> $attachments
     *        Files to send with it. Each is a name, a media type (defaulting to
     *        application/octet-stream) and the raw bytes — see message() for
     *        how they are carried, and MAX_ATTACHMENT for the ceiling.
     *
     * @return array{ok:bool, error?:string, retryable?:bool}
     */
    public function send(
        string $toEmail,
        string $toName,
        string $subject,
        string $html,
        string $text = '',
        array $attachments = []
    ): array {
        if (!self::configured()) {
            /* Retryable: the message is fine, the deployment is incomplete. It
               will go out unchanged as soon as MAIL_HOST is filled in. */
            return ['ok' => false, 'error' => 'No mail server configured (MAIL_HOST is empty).', 'retryable' => true];
        }

        $host = trim((string) env('MAIL_HOST', ''));
        $port = (int) (env('MAIL_PORT', 587) ?: 587);
        $enc  = strtolower(trim((string) env('MAIL_ENCRYPTION', '')));
        if ($enc === '') {
            // Port 465 is implicit TLS; 587 and 25 negotiate with STARTTLS.
            $enc = $port === 465 ? 'ssl' : 'tls';
        }

        try {
            $this->connect($host, $port, $enc);
            $this->handshake($host, $enc);
            $this->authenticate();
            $this->envelope($toEmail);
            $this->data($this->message($toEmail, $toName, $subject, $html, $text, $attachments));
            $this->command('QUIT', [221]);
            return ['ok' => true];
        } catch (\RuntimeException $e) {
            return ['ok' => false, 'error' => $e->getMessage(), 'retryable' => $this->retryable($e->getMessage())];
        } finally {
            $this->disconnect();
        }
    }

    /* ── Connection ─────────────────────────────────────────────── */

    private function connect(string $host, int $port, string $enc): void
    {
        $target = ($enc === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
        $socket = @stream_socket_client($target, $errno, $errstr, self::TIMEOUT);
        if ($socket === false) {
            throw new \RuntimeException('Could not reach ' . $host . ':' . $port . ' — ' . ($errstr ?: 'connection refused'));
        }
        stream_set_timeout($socket, self::TIMEOUT);
        $this->socket = $socket;
        $this->expect([220]);
    }

    private function handshake(string $host, string $enc): void
    {
        // The EHLO argument identifies US, not the server. A bare hostname is
        // what most relays want; the served host is the closest true answer.
        $me = (string) ($_SERVER['SERVER_NAME'] ?? 'localhost');
        $this->command('EHLO ' . $me, [250]);

        if ($enc !== 'tls') {
            return;
        }
        $this->command('STARTTLS', [220]);
        $ok = @stream_socket_enable_crypto(
            $this->socket,
            true,
            STREAM_CRYPTO_METHOD_TLS_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT
        );
        if ($ok !== true) {
            throw new \RuntimeException('STARTTLS negotiation failed with ' . $host . '.');
        }
        // The session restarts after STARTTLS: everything the server told us
        // before the upgrade is discarded, including its AUTH advertisement.
        $this->command('EHLO ' . $me, [250]);
    }

    private function authenticate(): void
    {
        $user = (string) env('MAIL_USERNAME', '');
        $pass = (string) env('MAIL_PASSWORD', '');
        if ($user === '') {
            return;                       // an open relay, or an IP allowlist
        }
        $this->command('AUTH LOGIN', [334]);
        $this->command(base64_encode($user), [334]);
        $this->command(base64_encode($pass), [235]);
    }

    private function envelope(string $toEmail): void
    {
        $this->command('MAIL FROM:<' . self::fromAddress() . '>', [250]);
        $this->command('RCPT TO:<' . $toEmail . '>', [250, 251]);
    }

    private function data(string $message): void
    {
        $this->command('DATA', [354]);
        $this->write($message . self::CRLF . '.' . self::CRLF);
        $this->expect([250]);
    }

    private function disconnect(): void
    {
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
        $this->socket = null;
    }

    /* ── Protocol plumbing ──────────────────────────────────────── */

    private function command(string $line, array $expected): string
    {
        $this->write($line . self::CRLF);
        return $this->expect($expected);
    }

    private function write(string $raw): void
    {
        if (!is_resource($this->socket) || @fwrite($this->socket, $raw) === false) {
            throw new \RuntimeException('The connection to the mail server dropped.');
        }
    }

    /**
     * Read one reply and check its code.
     *
     * A reply may span several lines; every line but the last has a '-' in the
     * fourth column ("250-STARTTLS" … "250 HELP"). Reading only the first line
     * leaves the rest in the buffer and desynchronises every command after it.
     */
    private function expect(array $codes): string
    {
        $reply = '';
        while (is_resource($this->socket)) {
            $line = @fgets($this->socket, 1024);
            if ($line === false) {
                throw new \RuntimeException('The mail server closed the connection unexpectedly.');
            }
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }

        $code = (int) substr(ltrim($reply), 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new \RuntimeException('Mail server refused: ' . trim($reply));
        }
        return $reply;
    }

    /**
     * 4xx is a temporary refusal (greylisting, rate limit, mailbox busy) and is
     * worth another attempt; 5xx is permanent — a bad address or a rejected
     * login — and retrying it just re-fails on a schedule. Anything that never
     * reached a reply code (a dropped socket) is treated as temporary.
     */
    private function retryable(string $error): bool
    {
        return preg_match('/refused: 5\d\d/', $error) !== 1;
    }

    /* ── The message itself ─────────────────────────────────────── */

    /**
     * A multipart/alternative message: plain text first, HTML second.
     *
     * Order is part of the spec, not a style choice — a client picks the LAST
     * part it can render, so text-then-HTML shows HTML to those who can take it
     * and text to everyone else. Reversed, every client shows the plain text.
     *
     * With attachments the whole of that becomes ONE part of a multipart/mixed
     * message, with a part per file beside it. Nesting rather than flattening
     * is what keeps the two bodies alternatives to each other: listed flat
     * beside the attachments they are four things to choose between, and a
     * client that picks the last one it can render shows the PDF's base64.
     *
     * @param array<int,array{name:string,type?:string,data:string}> $attachments
     */
    private function message(
        string $toEmail,
        string $toName,
        string $subject,
        string $html,
        string $text,
        array $attachments = []
    ): string {
        $boundary = 'ncp-alt-' . bin2hex(random_bytes(9));
        $text     = $text !== '' ? $text : trim(html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8'));

        $alternative =
            '--' . $boundary . self::CRLF .
            'Content-Type: text/plain; charset=UTF-8' . self::CRLF .
            'Content-Transfer-Encoding: base64' . self::CRLF . self::CRLF .
            chunk_split(base64_encode($text), 76, self::CRLF) .
            '--' . $boundary . self::CRLF .
            'Content-Type: text/html; charset=UTF-8' . self::CRLF .
            'Content-Transfer-Encoding: base64' . self::CRLF . self::CRLF .
            chunk_split(base64_encode($html), 76, self::CRLF) .
            '--' . $boundary . '--';

        $headers = [
            'Date: ' . date('r'),
            'From: ' . $this->header(self::fromName()) . ' <' . self::fromAddress() . '>',
            'To: ' . ($toName !== '' ? $this->header($toName) . ' ' : '') . '<' . $toEmail . '>',
            'Subject: ' . $this->header($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $this->domain() . '>',
            'MIME-Version: 1.0',
        ];

        $files = $this->attachmentParts($attachments);
        if ($files === []) {
            $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
            return implode(self::CRLF, $headers) . self::CRLF . self::CRLF . $alternative;
        }

        $mixed = 'ncp-mix-' . bin2hex(random_bytes(9));
        $headers[] = 'Content-Type: multipart/mixed; boundary="' . $mixed . '"';

        $body = '--' . $mixed . self::CRLF
              . 'Content-Type: multipart/alternative; boundary="' . $boundary . '"' . self::CRLF . self::CRLF
              . $alternative . self::CRLF;
        foreach ($files as $part) {
            $body .= '--' . $mixed . self::CRLF . $part;
        }
        $body .= '--' . $mixed . '--';

        return implode(self::CRLF, $headers) . self::CRLF . self::CRLF . $body;
    }

    /**
     * One MIME part per attachment.
     *
     * Base64 in 76-character lines, which is the transfer encoding every
     * relay accepts for binary; the file name is sanitised rather than
     * quoted-printable encoded, because a name that needs RFC 2231 to survive
     * is a name this application never generates.
     *
     * An oversized or empty file is DROPPED, not sent and not thrown: the
     * message is a notification that happens to carry a report, and a report
     * that cannot travel must not stop it. The caller decides what the body
     * then says about it.
     *
     * @param array<int,array{name:string,type?:string,data:string}> $attachments
     * @return array<int,string>
     */
    private function attachmentParts(array $attachments): array
    {
        $parts = [];
        foreach ($attachments as $file) {
            $data = (string) ($file['data'] ?? '');
            $name = preg_replace('/[^A-Za-z0-9._ -]+/', '-', trim((string) ($file['name'] ?? ''))) ?: 'attachment';
            if ($data === '' || strlen($data) > self::MAX_ATTACHMENT) {
                error_log('attachment "' . $name . '" skipped: ' . ($data === '' ? 'empty' : strlen($data) . ' bytes'));
                continue;
            }
            $type = trim((string) ($file['type'] ?? '')) ?: 'application/octet-stream';

            $parts[] = 'Content-Type: ' . $type . '; name="' . $name . '"' . self::CRLF
                . 'Content-Transfer-Encoding: base64' . self::CRLF
                . 'Content-Disposition: attachment; filename="' . $name . '"' . self::CRLF . self::CRLF
                . chunk_split(base64_encode($data), 76, self::CRLF);
        }
        return $parts;
    }

    /** RFC 2047-encode a header value when it is not plain ASCII. */
    private function header(string $value): string
    {
        $value = str_replace(["\r", "\n"], '', $value);
        return preg_match('/[^\x20-\x7E]/', $value) === 1
            ? '=?UTF-8?B?' . base64_encode($value) . '?='
            : $value;
    }

    private function domain(): string
    {
        $from = self::fromAddress();
        $at   = strrpos($from, '@');
        return $at === false ? 'localhost' : substr($from, $at + 1);
    }
}
