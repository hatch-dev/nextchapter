<?php
namespace Core;

/**
 * Passwords (Directive 2 Oct 2026, Parts 5.1 and 6.1; live 6 Oct 2026).
 *
 * The rule is the browser's, applied again here whatever the browser checked (6.1.5):
 * at least 8 characters and at most 128, at least one number, at least one special
 * character (anything that is not a letter, a number or a space), and not one of the
 * most common or leaked passwords — the server's list is the NCSC 100k (with the
 * directive's own), far longer than the browser's 41, so 'common' can come back for a
 * password the browser allowed.
 *
 * Hashing: Argon2id at the OWASP Password Storage Cheat Sheet's setting (19 MiB, 2
 * iterations, 1 degree of parallelism), each hash with its own random salt (6.1.1).
 * A bcrypt hash written before this still verifies — password_verify reads the
 * algorithm from the hash — so an old PIN signs in once and is then replaced.
 */
final class Password
{
    public const MIN = 8;
    public const MAX = 128;

    /** '' when the password meets the rule; otherwise 'weak' or 'common'. */
    public static function problem(?string $pw): string
    {
        $pw = (string) $pw;
        $n = mb_strlen($pw, 'UTF-8');
        if ($n < self::MIN || $n > self::MAX) return 'weak';
        if (!preg_match('/[0-9]/', $pw)) return 'weak';
        if (!preg_match('/[^\p{L}\p{N}\s]/u', $pw)) return 'weak';
        if (self::isCommon($pw)) return 'common';
        return '';
    }

    public static function isCommon(string $pw): bool
    {
        static $set = null;
        if ($set === null) {
            $set = [];
            $file = dirname(__DIR__) . '/config/common-passwords.txt';
            $lines = is_file($file) ? file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
            foreach ($lines as $line) {
                if ($line !== '' && $line[0] !== '#') $set[$line] = true;
            }
        }
        return isset($set[mb_strtolower($pw, 'UTF-8')]);
    }

    public static function hash(string $pw): string
    {
        /* Argon2id at the OWASP setting (6.1.1). A PHP built without Argon2 support has no PASSWORD_ARGON2ID:
           there, bcrypt with a work factor of 12 — which 6.1.1 also allows ("bcrypt with a work factor of 10
           or more"). verify() reads either. */
        if (defined('PASSWORD_ARGON2ID')) {
            return password_hash($pw, PASSWORD_ARGON2ID, ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1]);
        }
        return password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function verify(string $pw, ?string $hash): bool
    {
        return $hash !== null && $hash !== '' && password_verify($pw, $hash);
    }
}
