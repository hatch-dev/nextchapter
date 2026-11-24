<?php
/*
 * mail-removed-check.php — nothing waiting is sent to somebody who has left (P-16, 24 Nov 2026).
 *
 *   php tools/mail-removed-check.php
 *
 * Works in a transaction that is always rolled back, sends nothing, and leaves the database as it was. It runs the two
 * places that decide: cancelForFormerMembers (a removal) and the question MailRetry asks before each send.
 */
declare(strict_types=1);

$api = dirname(__DIR__) . '/api';
require $api . '/helpers/functions.php';
spl_autoload_register(static function (string $class) use ($api): void {
    foreach (['Core\\' => '/core/', 'Models\\' => '/models/'] as $prefix => $dir) {
        if (strncmp($class, $prefix, strlen($prefix)) === 0) {
            $file = $api . $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) require $file;
            return;
        }
    }
});
set_error_handler(static function (int $s, string $m, string $f, int $l): bool { throw new ErrorException($m, 0, $s, $f, $l); });

$db = Core\Database::connection();
$box = new Models\MailOutbox();
$failed = 0;
$check = static function (string $what, bool $ok) use (&$failed): void { echo ($ok ? 'ok    ' : 'FAIL  ') . $what . PHP_EOL; if (!$ok) $failed++; };
$tag = bin2hex(random_bytes(4));

$db->beginTransaction();
try {
    $org = (new Models\Organization())->create('Mail check ' . $tag, 'enterprise');
    $other = (new Models\Organization())->create('Mail check other ' . $tag, 'enterprise');
    $users = new Models\User();
    $make = static fn(string $n, int $o): array => $users->create(['organization_id' => $o, 'name' => $n, 'email' => $n . $tag . '@Example.test', 'username' => $n . $tag, 'pin_hash' => null, 'role' => 'x', 'initials' => 'X', 'scope' => 'All', 'department' => 'x', 'is_admin' => false]);
    $stay = $make('stay', (int) $org['id']);
    $gone = $make('gone', (int) $org['id']);
    $far  = $make('far', (int) $other['id']);
    $queue = static fn(string $to, int $o, ?string $uid, string $kind): string => $box->queue(['kind' => $kind, 'to_email' => $to, 'subject' => $kind, 'body_html' => 'x', 'organization_id' => $o, 'user_public_id' => $uid]);
    $g = 'gone' . $tag . '@example.test';
    $ids = [
        'reminder to the one removed'   => $queue($g, (int) $org['id'], null, 'notify-deadline-reminder'),
        'assignment to the one removed' => $queue($g, (int) $org['id'], $gone['public_id'], 'step-assignment'),
        'invitation to the one removed' => $queue(strtoupper($g), (int) $org['id'], $gone['public_id'], 'member-invite'),
        'reminder to the one who stays' => $queue('stay' . $tag . '@example.test', (int) $org['id'], null, 'notify-deadline-reminder'),
        'mail in another organization'  => $queue('far' . $tag . '@example.test', (int) $other['id'], null, 'notify-deadline-reminder'),
        'one already sent'              => $queue($g, (int) $org['id'], null, 'notify-step-complete'),
    ];
    $box->markSent($ids['one already sent']);
    $status = static fn(string $id): string => (string) ($box->findByPublicId($id)['status'] ?? '');

    $check('a member may be sent it, whatever the case of the address', $box->isForMember((int) $org['id'], strtoupper($g)));
    $users->deleteByPublicId($gone['public_id']);
    $check('somebody removed may not', !$box->isForMember((int) $org['id'], $g));
    $check('nor may a member of another organization', !$box->isForMember((int) $org['id'], 'far' . $tag . '@example.test'));
    $box->cancelForFormerMembers((int) $org['id']);
    foreach (['reminder to the one removed', 'assignment to the one removed', 'invitation to the one removed'] as $k) $check($k . ': cancelled', $status($ids[$k]) === 'cancelled');
    $check('reminder to the one who stays: still waiting', $status($ids['reminder to the one who stays']) === 'queued');
    $check('mail in another organization: still waiting', $status($ids['mail in another organization']) === 'queued');
    $check('one already sent: untouched', $status($ids['one already sent']) === 'sent');
    $retry = array_column($box->retryable(200, 5, 7, (int) $org['id'], 0), 'public_id');
    $check('a retry finds only the one who stays', $retry === [$ids['reminder to the one who stays']]);

    $late = $queue($g, (int) $org['id'], null, 'notify-deadline-reminder');
    $box->markCancelled($late);
    $check('a message queued after the removal can be cancelled at sending', $status($late) === 'cancelled');
    $again = $make('gone', (int) $org['id']);
    $check('added back, they may be sent mail again', $box->isForMember((int) $org['id'], $g));
    $box->cancelForFormerMembers((int) $org['id']);
    $check('and what was cancelled stays cancelled', $status($ids['reminder to the one removed']) === 'cancelled');
} finally {
    $db->rollBack();
}
echo $failed === 0 ? "all passed\n" : "$failed failed\n";
exit($failed === 0 ? 0 : 1);
