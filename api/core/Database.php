<?php
namespace Core;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Thin PDO wrapper exposing a single shared connection.
 *
 * PDO with emulated prepares OFF gives us real server-side prepared statements,
 * which is the backbone of the app's SQL-injection defence.
 */
class Database
{
    private static ?PDO $connection = null;

    /** Return the shared PDO connection, creating it on first use. */
    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $cfg = config('database');
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $cfg['host'],
            $cfg['port'],
            $cfg['name'],
            $cfg['charset']
        );

        try {
            self::$connection = new PDO($dsn, $cfg['user'], $cfg['pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            // Never leak DSN/credentials to the client; surface a generic error.
            throw new RuntimeException('Database connection failed.', 0, $e);
        }

        return self::$connection;
    }
}
