<?php
namespace Core;

/**
 * Failed attempts and the sign-in record (Directive 2 Oct 2026, Parts 6.1.7 and 6.1.8).
 *
 *  - Five wrong passwords for one username within 15 minutes: the username is refused for
 *    15 minutes (the fifth refusal already says so — 5.8.4).
 *  - Repeated failures from one internet address are slowed down, a little more each time.
 *  - Every sign-in, failed sign-in, password change and temporary password set is recorded
 *    with its time and username. A request body is never recorded.
 */
final class SignInGuard
{
    public const LIMIT = 5;
    public const MINUTES = 15;

    private static function db(): \PDO { return Database::connection(); }
    private static function ip(): string { return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45); }
    private static function norm(string $u): string { return mb_strtolower((string) preg_replace('/\s+/u', '', $u), 'UTF-8'); }   /* Sweep 4R item 1: the lock counts one username however its spaces are typed */

    /** Minutes still to wait, or 0 when the username may try. */
    public static function lockedFor(string $username): int
    {
        $stmt = self::db()->prepare('SELECT at FROM login_attempts WHERE username = ? AND at > (NOW() - INTERVAL ' . self::MINUTES . ' MINUTE) ORDER BY at ASC');
        $stmt->execute([self::norm($username)]);
        $times = array_column($stmt->fetchAll(), 'at');
        if (count($times) < self::LIMIT) return 0;
        $until = strtotime((string) $times[count($times) - self::LIMIT]) + self::MINUTES * 60;
        return max(1, (int) ceil(($until - time()) / 60));
    }

    /** Record a failure; true when this one locks the username. Slows the address down. */
    public static function failed(string $username): bool
    {
        self::db()->prepare('INSERT INTO login_attempts (username, ip) VALUES (?, ?)')->execute([self::norm($username), self::ip()]);
        $byIp = self::db()->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND at > (NOW() - INTERVAL ' . self::MINUTES . ' MINUTE)');
        $byIp->execute([self::ip()]);
        $n = (int) $byIp->fetchColumn();
        if ($n > self::LIMIT) usleep(min(2000000, ($n - self::LIMIT) * 150000));   /* up to 2 s */
        return self::lockedFor($username) > 0;
    }

    public static function succeeded(string $username): void
    {
        self::db()->prepare('DELETE FROM login_attempts WHERE username = ?')->execute([self::norm($username)]);
    }

    public static function log(string $event, string $username): void
    {
        try {
            self::db()->prepare('INSERT INTO auth_events (event, username, ip) VALUES (?, ?, ?)')->execute([$event, self::norm($username), self::ip()]);
        } catch (\Throwable $e) { /* the record is a convenience; it never fails a sign-in */ }
    }
}
