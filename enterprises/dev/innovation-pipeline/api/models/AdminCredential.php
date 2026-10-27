<?php
namespace Models;

use Core\Model;
use Core\Password;

/**
 * The app administrator's account (Directive 2 Oct 2026, Part 5.12; live 6 Oct 2026).
 *
 * One row. It exists from installation: when there is none, the first request that needs it
 * creates username 'admin' with the published password NextChapter2026!, marked must_change, so
 * that password works exactly once (6.1.10). A row that existed before keeps its passcode as the
 * current password under the username 'admin' — it is accepted at sign-in only with must_change
 * when it breaks the password rule (6.1.15), so the administrator is never locked out by the change.
 */
class AdminCredential extends Model
{
    public const DEFAULT_USERNAME = 'admin';
    public const DEFAULT_PASSWORD = 'NextChapter2026!';

    /** The account, created at first need. */
    public function get(): ?array
    {
        $row = $this->selectOne('SELECT id, username, passcode_hash, must_change FROM app_admin ORDER BY id LIMIT 1');
        if ($row === null) {
            $this->execute('INSERT INTO app_admin (username, passcode_hash, must_change) VALUES (:u, :h, 1)', [':u' => self::DEFAULT_USERNAME, ':h' => Password::hash(self::DEFAULT_PASSWORD)]);
            $row = $this->selectOne('SELECT id, username, passcode_hash, must_change FROM app_admin ORDER BY id LIMIT 1');
        }
        return $row;
    }

    /** The account always exists now (kept for callers that ask). */
    public function exists(): bool { return $this->get() !== null; }

    /** True when the password matches (constant-time). */
    public function verify(string $password): bool
    {
        $row = $this->get();
        return $row !== null && Password::verify($password, (string) $row['passcode_hash']);
    }

    public function setPassword(string $password): void
    {
        $row = $this->get();
        $this->execute('UPDATE app_admin SET passcode_hash = :h, must_change = 0 WHERE id = :id', [':h' => Password::hash($password), ':id' => $row['id']]);
    }

    public function setUsername(string $username): void
    {
        $row = $this->get();
        $this->execute('UPDATE app_admin SET username = :u WHERE id = :id', [':u' => $username, ':id' => $row['id']]);
    }
}
