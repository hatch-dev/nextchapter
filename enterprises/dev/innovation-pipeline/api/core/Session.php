<?php
namespace Core;

/**
 * Server sessions (Directive 2 Oct 2026, Part 6.1.3; live 6 Oct 2026).
 *
 * Identity used to be whatever id the browser sent (actor_id / actor). A correct sign-in
 * now sets a cookie holding a random token; the `sessions` table stores only its SHA-256.
 * The cookie is HttpOnly and SameSite=Strict, and Secure whenever the request came over
 * HTTPS (it has to be left off on plain http://localhost or the browser would never send
 * it back — production is HTTPS only, with HSTS, 6.1.9).
 *
 *   without Remember me   a browser-session cookie; ends when the browser closes, and on
 *                         the server after 8 hours unused
 *   with Remember me      30 days
 *   sign-out              ends it at once
 *   a password change     ends the person's other sessions
 *
 * A session made with a temporary password (must_change) can do nothing but replace it
 * (6.1.6): Controller refuses it everywhere else.
 */
final class Session
{
    public const COOKIE = 'nc_session';
    private const IDLE_HOURS = 8;
    private const REMEMBER_DAYS = 30;

    private static ?array $current = null;
    private static bool $loaded = false;

    private static function db(): \PDO { return Database::connection(); }

    private static function https(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    }

    private static function cookiePath(): string
    {
        $base = rtrim((string) config('config.base_path'), '/');
        return $base === '' ? '/' : $base . '/';
    }

    private static function setCookie(string $value, int $expires): void
    {
        if (headers_sent()) return;
        setcookie(self::COOKIE, $value, [
            'expires'  => $expires,
            'path'     => self::cookiePath(),
            'secure'   => self::https(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    /** Start a session for a member (user public id) or the app administrator. */
    public static function start(string $kind, ?string $userPublicId, bool $remember, bool $mustChange): void
    {
        $token = bin2hex(random_bytes(32));
        $expires = $remember ? date('Y-m-d H:i:s', time() + self::REMEMBER_DAYS * 86400) : null;
        $stmt = self::db()->prepare('INSERT INTO sessions (token_hash, kind, user_public_id, remember, must_change, expires_at) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([hash('sha256', $token), $kind, $userPublicId, $remember ? 1 : 0, $mustChange ? 1 : 0, $expires]);
        self::setCookie($token, $remember ? time() + self::REMEMBER_DAYS * 86400 : 0);
        self::$loaded = true;
        self::$current = self::byHash(hash('sha256', $token));
    }

    private static function byHash(string $hash): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM sessions WHERE token_hash = ?');
        $stmt->execute([$hash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** The session this request carries, or null. Ended sessions are deleted as they are found. */
    public static function current(): ?array
    {
        if (self::$loaded) return self::$current;
        self::$loaded = true;
        $token = (string) ($_COOKIE[self::COOKIE] ?? '');
        if ($token === '' || !ctype_xdigit($token)) return self::$current = null;
        $hash = hash('sha256', $token);
        $row = self::byHash($hash);
        if ($row === null) return self::$current = null;
        $now = time();
        $dead = (int) $row['remember'] === 1
            ? ($row['expires_at'] !== null && strtotime((string) $row['expires_at']) < $now)
            : (strtotime((string) $row['last_seen']) < $now - self::IDLE_HOURS * 3600);
        if ($dead) {
            self::db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([$hash]);
            return self::$current = null;
        }
        self::db()->prepare('UPDATE sessions SET last_seen = NOW() WHERE token_hash = ?')->execute([$hash]);
        return self::$current = $row;
    }

    public static function end(): void
    {
        $token = (string) ($_COOKIE[self::COOKIE] ?? '');
        if ($token !== '' && ctype_xdigit($token)) {
            self::db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
        }
        self::setCookie('', time() - 3600);
        self::$current = null; self::$loaded = true;
    }

    /** End every other session of this member (or of the app administrator: $userPublicId null). */
    public static function endOthers(?string $userPublicId): void
    {
        $keep = self::$current['token_hash'] ?? '';
        if ($userPublicId === null) {
            self::db()->prepare("DELETE FROM sessions WHERE kind = 'admin' AND token_hash <> ?")->execute([$keep]);
        } else {
            self::db()->prepare('DELETE FROM sessions WHERE user_public_id = ? AND token_hash <> ?')->execute([$userPublicId, $keep]);
        }
    }

    /** Every session of a member (a temporary password set for them, or their removal). */
    public static function endAllFor(string $userPublicId): void
    {
        self::db()->prepare('DELETE FROM sessions WHERE user_public_id = ?')->execute([$userPublicId]);
    }

    /** The password was replaced: this session may do everything again. */
    public static function clearMustChange(): void
    {
        if (!self::$current) return;
        self::db()->prepare('UPDATE sessions SET must_change = 0 WHERE token_hash = ?')->execute([self::$current['token_hash']]);
        self::$current['must_change'] = 0;
    }
}
