<?php
/*
 * mail-retry.php — send again every email still waiting in mail_outbox.
 *
 *   php tools/mail-retry.php            up to 50 messages, all organizations
 *   php tools/mail-retry.php 200        up to 200
 *
 * Schedule it (Windows Task Scheduler, or cron) every few minutes. A message is
 * tried at most Core\MailRetry::MAX_ATTEMPTS times and only while it is less
 * than MAX_AGE_DAYS old. See api/core/MailRetry.php.
 */
declare(strict_types=1);

$api = dirname(__DIR__) . '/api';
require $api . '/helpers/functions.php';
spl_autoload_register(static function (string $class) use ($api): void {
    foreach (['Core\\' => '/core/', 'Models\\' => '/models/'] as $prefix => $dir) {
        if (strncmp($class, $prefix, strlen($prefix)) === 0) {
            $file = $api . $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) {
                require $file;
            }
            return;
        }
    }
});
/* The API runs with every warning turned into an exception; so does this, so the Mailer behaves as it does there. */
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$limit = isset($argv[1]) ? max(1, (int) $argv[1]) : 50;
$result = Core\MailRetry::run($limit, null, 60);
fwrite(STDOUT, sprintf("mail-retry: tried %d, sent %d, still failing %d\n", $result['tried'], $result['sent'], $result['failed']));
exit($result['failed'] > 0 ? 1 : 0);
