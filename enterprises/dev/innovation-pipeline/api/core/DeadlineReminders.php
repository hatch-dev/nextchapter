<?php
declare(strict_types=1);

namespace Core;

use Models\MailOutbox;
use Models\Workspace;

/**
 * Due-date reminders raised by the server (P-21, 24 Nov 2026).
 *
 * Until now a reminder was only ever raised by a member's browser (notifySweepDeadlines in js/features/email.js): in a
 * week when nobody opened the program, nobody was reminded. This asks the same question of the stored workspaces and
 * is run on a schedule by tools/reminders.php. The browsers still ask too; both mark data.remind7 with the date they
 * reminded for, so whoever is first is the only one.
 *
 * The rule is the browser's: an assigned step that is not complete and is due today or within seven days, once for
 * each date it is given, to its assignees and the organization's administrators who have the program. "Today" is the
 * UTC date, the changeover the whole team shares (P-18).
 *
 * Names come from api/config/step-names.json (tools/build-step-names.js): the server has no other way to know them.
 */
final class DeadlineReminders
{
    public const DAYS = 7;
    /** A browser may be sending the same reminder this minute: NotifyController's window, under the same lock. */
    private const DEDUPE_SECONDS = 900;

    /**
     * @param string|null $onlyOrg one organization's public id (null: all of them)
     * @return array{raised:int, queued:int, sent:int, skipped:int, list:string[]}
     */
    public static function run(?string $onlyOrg = null, bool $dryRun = false, ?string $today = null): array
    {
        $out   = ['raised' => 0, 'queued' => 0, 'sent' => 0, 'skipped' => 0, 'list' => []];
        $today = $today ?? gmdate('Y-m-d');
        $names = json_decode((string) @file_get_contents(dirname(__DIR__) . '/config/step-names.json'), true);
        $names = is_array($names) ? $names : [];
        $db    = Database::connection();

        $sql = 'SELECT w.organization_id, w.module, w.schema_version, w.doc, o.name AS org_name
                  FROM workspaces w JOIN organizations o ON o.id = w.organization_id
                 WHERE EXISTS (SELECT 1 FROM org_modules m WHERE m.organization_id = w.organization_id AND m.module = w.module)'
             . ($onlyOrg !== null ? ' AND o.public_id = ?' : '') . ' ORDER BY w.id';
        $rows = $db->prepare($sql);
        $rows->execute($onlyOrg !== null ? [$onlyOrg] : []);

        foreach ($rows->fetchAll(\PDO::FETCH_ASSOC) as $w) {
            $doc = json_decode((string) $w['doc']);
            $due = is_object($doc) && isset($doc->stepDue) && is_object($doc->stepDue) ? get_object_vars($doc->stepDue) : [];
            if ($due === []) continue;
            $done     = isset($doc->completedSteps) && is_object($doc->completedSteps) ? get_object_vars($doc->completedSteps) : [];
            $reminded = isset($doc->remind7) && is_object($doc->remind7) ? get_object_vars($doc->remind7) : [];
            $people = null;

            foreach ($due as $id => $date) {
                $id = (string) $id;
                if (!preg_match('/^[0-9]+\.[0-9]+$/', $id) || !is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) continue;
                if (!empty($done[$id]) || ($reminded[$id] ?? null) === $date || ($reminded[$id] ?? null) === true) continue;
                $days = (int) round((strtotime($date . ' UTC') - strtotime($today . ' UTC')) / 86400);
                if ($days < 0 || $days > self::DAYS) continue;

                $people = $people ?? self::people((int) $w['organization_id'], (string) $w['module']);
                $assigned = self::assignees((int) $w['organization_id'], (string) $w['module'], $id);
                if ($assigned === []) continue;                        // reminders are for assigned steps
                $to = array_filter($people, static fn(array $p): bool => $p['admin'] || in_array($p['id'], $assigned, true));
                if ($to === []) { $out['skipped']++; continue; }

                $name    = trim('Step ' . $id . (isset($names[$w['module']][$id]) ? ' – ' . $names[$w['module']][$id] : ''));
                $subject = mb_substr($name . ' due ' . $date, 0, 255);
                $out['raised']++;
                $out['list'][] = $w['org_name'] . ' | ' . $subject . ' -> ' . implode(', ', array_column($to, 'name'));
                if ($dryRun) continue;

                [$queued, $sent] = self::send($w, $subject, $name, $date, $to);
                $out['queued'] += $queued;
                $out['sent']   += $sent;
                self::mark((int) $w['organization_id'], (string) $w['module'], (int) $w['schema_version'], $id, $date);
            }
        }
        return $out;
    }

    /** Who may be written to about this program: real people with an address, in the organization, holding it. */
    private static function people(int $orgId, string $module): array
    {
        $q = Database::connection()->prepare(
            "SELECT u.public_id, u.name, u.email, u.role, u.is_admin
               FROM users u JOIN user_modules g ON g.user_public_id = u.public_id AND g.module = :mod
              WHERE u.organization_id = :org AND u.is_seed = 0 AND TRIM(COALESCE(u.email, '')) <> ''"
        );
        $q->execute([':org' => $orgId, ':mod' => $module]);
        $out = [];
        foreach ($q->fetchAll(\PDO::FETCH_ASSOC) as $u) {
            if (!filter_var(trim((string) $u['email']), FILTER_VALIDATE_EMAIL)) continue;
            $out[] = ['id' => (string) $u['public_id'], 'name' => (string) $u['name'], 'email' => strtolower(trim((string) $u['email'])),
                /* the browser's test (notifyAdmins): the flag, or "admin" in the role */
                'admin' => (int) $u['is_admin'] === 1 || stripos((string) $u['role'], 'admin') !== false];
        }
        return $out;
    }

    private static function assignees(int $orgId, string $module, string $step): array
    {
        $q = Database::connection()->prepare('SELECT user_public_id FROM step_assignments WHERE organization_id = ? AND module = ? AND step_id = ?');
        $q->execute([$orgId, $module, $step]);
        return array_column($q->fetchAll(\PDO::FETCH_ASSOC), 'user_public_id');
    }

    /** @return array{0:int,1:int} queued, sent */
    private static function send(array $w, string $subject, string $name, string $date, array $to): array
    {
        $e    = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
        $when = date('M j, Y', strtotime($date . ' 12:00'));
        $doc  = ReportDocument::parse('<h2>' . $e($subject) . '</h2><p>' . $e($name) . ' is assigned and due on ' . $e($when) . '.</p>');
        $opts = [
            'eyebrow'    => implode(' · ', array_filter([trim((string) $w['org_name']), Catalogue::name((string) $w['module'])])),
            'attachment' => '', 'note' => '',
            'closing'    => 'Sent automatically one week before an assigned step falls due, to the step’s assignees and the organization’s administrators.',
        ];
        $html = $doc !== null ? ReportMail::html($doc, $opts) : '<p>' . $e($name) . ' is assigned and due on ' . $e($when) . '.</p>';
        $text = $doc !== null ? ReportMail::text($doc, $opts) : $name . ' is assigned and due on ' . $when . '.';

        $outbox = new MailOutbox();
        $lock   = 'notify:' . md5($w['organization_id'] . '|deadline-reminder|' . $subject);
        $held   = false;
        $queue  = [];
        try { $held = $outbox->lock($lock); } catch (\Throwable $x) { $held = false; }
        try {
            foreach ($to as $p) {
                if ($outbox->queuedRecently((int) $w['organization_id'], 'notify-deadline-reminder', $p['email'], $subject, self::DEDUPE_SECONDS)) continue;
                $queue[] = [$outbox->queue(['kind' => 'notify-deadline-reminder', 'to_email' => $p['email'], 'to_name' => $p['name'], 'subject' => $subject,
                    'body_html' => $html, 'body_text' => $text, 'organization_id' => (int) $w['organization_id'], 'user_public_id' => $p['id']]), $p];
            }
        } finally {
            if ($held) { try { $outbox->unlock($lock); } catch (\Throwable $x) { } }
        }
        $sent = 0;
        if (Mailer::configured()) {
            $mailer = new Mailer();
            foreach ($queue as [$id, $p]) {
                $r = $mailer->send($p['email'], $p['name'], $subject, $html, $text);
                if (!empty($r['ok'])) { $outbox->markSent($id); $sent++; }
                else { $outbox->markFailed($id, (string) ($r['error'] ?? 'Unknown error'), !empty($r['retryable'])); }
            }
        }
        return [count($queue), $sent];
    }

    /** Reminded for this date: read again at the moment of writing, so another step's mark is never put back. */
    private static function mark(int $orgId, string $module, int $schema, string $id, string $date): void
    {
        try {
            $set = static function (object $sections, ?object $doc) use ($id, $date): object {
                $r = ($doc !== null && isset($doc->remind7) && is_object($doc->remind7)) ? clone $doc->remind7 : new \stdClass();
                $r->{$id} = $date;
                return (object) ['remind7' => $r];
            };
            if ((new Workspace())->patch($orgId, new \stdClass(), [], null, $schema, $module, $set) === null) {
                error_log("reminder for $module $id could not be marked; it may be sent once more");
            }
        } catch (\Throwable $e) {
            error_log('reminder could not be marked: ' . $e->getMessage());
        }
    }
}
