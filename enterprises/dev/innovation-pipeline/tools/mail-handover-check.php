<?php
/*
 * mail-handover-check.php — a waiting reminder or assignment notice is checked again before it is retried (P-23 and P-24,
 * 24 Nov 2026).
 *
 *   php tools/mail-handover-check.php
 *
 * Makes an organization inside a transaction that is always rolled back, and sends nothing: it calls the two questions
 * MailRetry asks of each waiting reminder, DeadlineReminders::stillFor and ::handOver, and the one it asks of a notice,
 * AssignmentNotice::review.
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
    $o = (new Models\Organization())->create('Handover check ' . $tag, 'enterprise');
    $org = (int) $o['id'];
    $db->prepare('INSERT INTO org_modules (organization_id, module) VALUES (?, ?)')->execute([$org, 'pipeline']);
    $users = new Models\User();
    $make = static function (string $n, bool $admin = false) use ($users, $org, $tag, $db): array {
        $u = $users->create(['organization_id' => $org, 'name' => $n, 'email' => $n . $tag . '@Example.test', 'username' => $n . $tag, 'pin_hash' => null, 'role' => 'x', 'initials' => 'X', 'scope' => 'All', 'department' => 'x', 'is_admin' => $admin]);
        $db->prepare('INSERT INTO user_modules (user_public_id, module) VALUES (?, ?)')->execute([$u['public_id'], 'pipeline']);
        return $u;
    };
    $a = $make('a'); $b = $make('b'); $boss = $make('boss', true);
    $mail = static fn(string $n): string => $n . $tag . '@example.test';
    $assign = static function (array $who) use ($db, $org): void {
        $db->prepare('DELETE FROM step_assignments WHERE organization_id = ?')->execute([$org]);
        foreach ($who as $u) $db->prepare('INSERT INTO step_assignments (organization_id, module, step_id, user_public_id) VALUES (?, ?, ?, ?)')->execute([$org, 'pipeline', '1.1', $u['public_id']]);
    };
    $ws = new Models\Workspace();
    $save = static fn(array $s) => $ws->patch($org, (object) json_decode((string) json_encode($s)), [], null, 1, 'pipeline');
    $marked = static function () use ($ws, $org) { $d = json_decode((string) $ws->findByOrg($org, 'pipeline')['doc'], true); return $d['remind7']['1.1'] ?? null; };
    $due = '2099-03-04';
    $subject = 'Step 1.1 – Assessment Battery due ' . $due;
    $row = static function (string $to, string $kind = 'notify-deadline-reminder:pipeline') use ($box, $org, $subject): array {
        return $box->findByPublicId($box->queue(['kind' => $kind, 'to_email' => $to, 'subject' => $subject, 'body_html' => 'x', 'organization_id' => $org]));
    };
    $still = static fn(array $r): bool => Core\DeadlineReminders::stillFor($r);
    $to = static fn(array $rows): array => array_column($rows, 'to_email');

    $save(['stepDue' => ['1.1' => $due], 'remind7' => ['1.1' => $due]]);
    $assign([$a]);
    $ra = $row(strtoupper($mail('a')));
    $rb = $row($mail('boss'));
    $check('its subject names the step and the date', Core\DeadlineReminders::about($subject) === ['step' => '1.1', 'date' => $due]);
    $check('the longest program fits the column whole', strlen(Core\DeadlineReminders::kind('ai-architecture')) === 40);
    $check('it goes to the assignee, whatever the case of the address', $still($ra));
    $check('and to an administrator', $still($rb));
    $check('nobody is added while nobody is cancelled', Core\DeadlineReminders::handOver($ra) === []);
    $check('mail that is not a reminder is left alone', $still(['kind' => 'step-assignment', 'subject' => $subject, 'organization_id' => $org, 'to_email' => $mail('b')]));

    $assign([$b]);
    $check('reassigned: no longer for the one it was taken from', !$still($ra));
    $check('still for the administrator', $still($rb));
    $box->markCancelled($ra['public_id'], 'x');
    $check('handed over to the new assignee only', $to(Core\DeadlineReminders::handOver($ra)) === [$mail('b')]);
    $check('once', Core\DeadlineReminders::handOver($rb) === []);
    $check('the mark stays', $marked() === $due);
    $check('a cancelled copy does not stand in the way of a new one', !$box->queuedRecently($org, 'notify-deadline-reminder', $mail('a'), $subject, 900));
    $check('queued before its kind named the program: the same answers', !$still($row($mail('a'), 'notify-deadline-reminder')) && $still($row($mail('b'), 'notify-deadline-reminder')));

    $assign([]);
    $check('nobody assigned: for nobody, the administrator included', !$still($rb));
    $box->markCancelled($rb['public_id'], 'x');
    $check('nobody is added', Core\DeadlineReminders::handOver($rb) === []);
    $check('and the mark comes off, so it is raised again if it comes to apply', $marked() === null);

    $assign([$b]);
    $save(['remind7' => ['1.1' => $due, '1.2' => '2099-01-01'], 'completedSteps' => ['1.1' => true]]);
    $check('complete: for nobody', !$still($rb));
    $save(['completedSteps' => new stdClass(), 'stepDue' => ['1.1' => '2099-04-01'], 'remind7' => ['1.1' => '2099-04-01', '1.2' => '2099-01-01']]);
    $check('another date: for nobody', !$still($rb));
    Core\DeadlineReminders::handOver($rb);
    $check('and the mark for the new date stays', $marked() === '2099-04-01');
    $save(['stepDue' => ['1.1' => $due]]);
    $db->prepare('DELETE FROM user_modules WHERE user_public_id = ?')->execute([$b['public_id']]);
    $check('without the program: not for them', !$still($row($mail('b'))));

    /* Assignment notices (P-24) */
    $note = static function (array $u, ?string $kind = null, string $to = '') use ($box, $org): array {
        return $box->findByPublicId($box->queue(['kind' => $kind ?? Core\AssignmentNotice::kind('pipeline', '1.1'), 'to_email' => $to !== '' ? $to : (new Models\User())->findByPublicId($u['public_id'])['email'], 'to_name' => 'x', 'subject' => 'You have been assigned X',
            'body_html' => '<a href="http://x/pipeline/step/1.1">x</a>', 'body_text' => 'x', 'organization_id' => $org, 'user_public_id' => $u['public_id']]));
    };
    $review = static fn(array $r): array => Core\AssignmentNotice::review($r);
    $check('the longest program and step fit the column whole', strlen(Core\AssignmentNotice::kind('ai-architecture', '10.10')) <= 40 && substr(Core\AssignmentNotice::kind('ai-architecture', '10.10'), -5) === '10.10');
    $assign([$a]);
    $n1 = $note($a);
    $check('assigned: it goes', $review($n1) === ['send' => true, 'instead' => []]);
    $check('mail that is not a notice is left alone', $review(['kind' => 'member-invite', 'user_public_id' => $b['public_id'], 'organization_id' => $org] + $n1)['send']);
    $assign([]);
    $check('taken off the step: it does not', !$review($n1)['send']);
    $assign([$a]);
    $n2 = $note($a);
    $check('given back, which queued another: the first does not', !$review($n1)['send']);
    $check('and the second does', $review($n2)['send']);
    $save(['completedSteps' => ['1.1' => true]]);
    $check('complete: it does not', !$review($n2)['send']);
    $save(['completedSteps' => new stdClass()]);
    $old = $note($a, 'step-assignment');
    $check('queued before its kind named the step: the same answers', $review($old)['send']);
    $assign([]);
    $check('  taken off', !$review($old)['send']);
    $assign([$a]);
    $db->prepare('UPDATE users SET email = ? WHERE public_id = ?')->execute(['new' . $tag . '@example.test', $a['public_id']]);
    $moved = $review($n2);
    $check('their address changed: to the new one instead', !$moved['send'] && array_column($moved['instead'], 'to_email') === ['new' . $tag . '@example.test']);
    $check('  which goes', $review($box->findByPublicId($moved['instead'][0]['public_id']))['send']);
    $db->prepare('DELETE FROM user_modules WHERE user_public_id = ?')->execute([$a['public_id']]);
    $check('without the program: it does not', !$review($box->findByPublicId($moved['instead'][0]['public_id']))['send']);
    $users->deleteByPublicId($a['public_id']);
    $check('removed: it does not', !$review($n2)['send']);
} finally {
    $db->rollBack();
}
echo $failed === 0 ? "all passed\n" : "$failed failed\n";
exit($failed === 0 ? 0 : 1);
