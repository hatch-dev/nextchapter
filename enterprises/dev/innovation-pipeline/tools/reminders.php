<?php
/*
 * reminders.php — send the due-date reminders that are due (P-21, 24 Nov 2026).
 *
 *   php tools/reminders.php                     every organization
 *   php tools/reminders.php --dry-run           say what would be sent; write and send nothing
 *   php tools/reminders.php --org=org_1234      one organization
 *
 * Schedule it once or twice a day (cron, or Windows Task Scheduler). Running it more often is harmless: a step is
 * reminded once for each due date. See api/core/DeadlineReminders.php.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }   /* it sends mail: from the command line only */

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
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$dry = in_array('--dry-run', $argv, true);
$org = null;
$day = null;
foreach ($argv as $a) {
    if (strncmp($a, '--org=', 6) === 0) $org = substr($a, 6);
    if (preg_match('/^--today=(\d{4}-\d{2}-\d{2})$/', $a, $m)) $day = $m[1];   /* for checking */
}
$r = Core\DeadlineReminders::run($org, $dry, $day);
foreach ($r['list'] as $line) fwrite(STDOUT, ($dry ? 'would send: ' : 'raised: ') . $line . PHP_EOL);
fwrite(STDOUT, sprintf("reminders: raised %d, queued %d, sent %d%s\n", $r['raised'], $r['queued'], $r['sent'], $dry ? ' (dry run)' : ''));
