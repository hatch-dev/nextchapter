<?php
namespace Models;

use Core\Model;

/**
 * User model — members belonging to an organization.
 *
 * PINs are never stored in the clear: they are hashed with password_hash()
 * and only ever verified with password_verify().
 */
class User extends Model
{
    /**
     * True if a username is already taken, anywhere in the installation.
     *
     * THE uniqueness check. Sign-in asks for a username and a PIN and nothing
     * else (AuthController::login), so a username has to identify exactly one
     * person across every organization — the moment two accounts share one,
     * "who is `maria`?" has no answer and somebody is either refused or, far
     * worse, signed into a workspace that is not theirs.
     *
     * This used to be scoped to one organization, back when the sign-in screen
     * asked for the organization first and a name only had to be unique inside
     * its own tenant. That field is gone, so the scope has to widen with it:
     * every entry point that can create or rename a login goes through here.
     */
    public function usernameExists(string $username): bool
    {
        return $this->selectOne(
            'SELECT id FROM users WHERE username = :username LIMIT 1',
            [':username' => $username]
        ) !== null;
    }

    /**
     * True if a username is taken by someone OTHER than $exceptPublicId. Used
     * on edit, so a member keeping their own username isn't a conflict.
     */
    public function usernameTakenByOther(string $username, ?string $exceptPublicId = null): bool
    {
        /* Sweep 4R item 6 (5 Oct 2026): ignoring capitals and every space, the same key sign-in uses (findAllByUsername) */
        $key    = mb_strtolower((string) preg_replace('/\s+/u', '', $username), 'UTF-8');
        $sql    = "SELECT id FROM users WHERE LOWER(REPLACE(username, ' ', '')) = :u";
        $params = [':u' => $key];
        if ($exceptPublicId !== null) {
            $sql .= ' AND public_id <> :pid';
            $params[':pid'] = $exceptPublicId;
        }
        if ($this->selectOne($sql . ' LIMIT 1', $params) !== null) {
            return true;
        }
        /* The app administrator's username counts too (Directive 2 Oct 2026, 5.11 / 6.1.14: no two accounts
           share a username). AdminController::changeUsername checks the other direction. */
        /* Sweep 4R item 6: the stored one, or the default 'admin' while no account row exists yet (get() makes it) */
        $admin = (new AdminCredential())->get();
        return $admin !== null && mb_strtolower((string) preg_replace('/\s+/u', '', (string) $admin['username']), 'UTF-8') === $key;
    }

    /**
     * True if an email address is taken by someone OTHER than $exceptPublicId.
     *
     * An address is not a credential, but it is where a credential is SENT: the
     * invitation carries a passcode, and the notification machinery mails the
     * roster. Two accounts on one address means one person receiving both, and
     * neither the sender nor the recipient can tell which account a given mail
     * is about. It was never checked anywhere before; now it is checked in the
     * same places as the username, and by the same index (uq_user_email).
     *
     * An empty address is never "taken" — `email` is NULL for old rows and the
     * unique index permits any number of NULLs, so a blank must not collide
     * with every other blank.
     */
    public function emailTakenByOther(string $email, ?string $exceptPublicId = null): bool
    {
        $email = trim($email);
        if ($email === '') {
            return false;
        }
        $sql    = 'SELECT id FROM users WHERE email = :e';
        $params = [':e' => $email];
        if ($exceptPublicId !== null) {
            $sql .= ' AND public_id <> :pid';
            $params[':pid'] = $exceptPublicId;
        }
        return $this->selectOne($sql . ' LIMIT 1', $params) !== null;
    }

    /**
     * Every account holding this username — the sign-in lookup.
     *
     * Returns a LIST, not a row, although uq_user_username guarantees at most
     * one. The caller can then REFUSE an ambiguous answer rather than take the
     * first row, which matters for a database written before that index existed
     * (a sign-up ran while usernames were only unique per organization, and two
     * rows survive the migration). Picking one of two identities is exactly the
     * bug this whole change is meant to end; there is no safe version of it.
     *
     * @return list<array<string,mixed>>
     */
    public function findAllByUsername(string $username): array
    {
        /* Sweep 4R item 1 (5 Oct 2026, Paul's decision): the USERNAME only, never a person's name, compared ignoring
           capitals and every space (section 6's rule). Stored usernames carry no spaces (their format allows none), so
           stripping them from both sides only widens what the typed side may contain. */
        $key = mb_strtolower((string) preg_replace('/\s+/u', '', $username), 'UTF-8');
        return $this->select(
            'SELECT id, public_id, organization_id, name, username, pin_hash, must_change, role, is_admin
               FROM users WHERE LOWER(REPLACE(username, \' \', \'\')) = :username',
            [':username' => $key]
        );
    }

    /**
     * Insert a user (owner or team member). The caller passes a pre-hashed PIN.
     * An empty/absent username is stored as NULL (a member with no login yet).
     *
     * @param array{
     *   organization_id:int, name:string, pin_hash:string, username?:string,
     *   role?:string, initials?:string, color?:string, scope?:string,
     *   email?:string, department?:string, is_admin?:bool
     * } $attrs
     * @return array{id:int, public_id:string}
     */
    public function create(array $attrs): array
    {
        $publicId = public_id('usr');
        $username = isset($attrs['username']) ? trim((string) $attrs['username']) : '';

        $id = $this->execute(
            'INSERT INTO users
                (public_id, organization_id, name, username, pin_hash,
                 role, initials, color, scope, email, department, is_admin, is_seed)
             VALUES
                (:public_id, :organization_id, :name, :username, :pin_hash,
                 :role, :initials, :color, :scope, :email, :department, :is_admin, :is_seed)',
            [
                ':public_id'       => $publicId,
                ':organization_id' => $attrs['organization_id'],
                ':name'            => $attrs['name'],
                ':username'        => $username === '' ? null : $username,
                ':pin_hash'        => $attrs['pin_hash'],
                ':role'            => $attrs['role']       ?? 'Administrator',
                ':initials'        => $attrs['initials']   ?? '',
                ':color'           => $attrs['color']      ?? '#B8892A',
                ':scope'           => $attrs['scope']      ?? 'All',
                ':email'           => ($attrs['email']      ?? '') === '' ? null : $attrs['email'],
                ':department'      => ($attrs['department'] ?? '') === '' ? null : $attrs['department'],
                ':is_admin'        => !empty($attrs['is_admin']) ? 1 : 0,
                ':is_seed'         => !empty($attrs['is_seed']) ? 1 : 0,
            ]
        );

        return ['id' => $id, 'public_id' => $publicId];
    }

    /**
     * Delete every sample-data member of an organization (is_seed = 1) and
     * return how many rows went. Real members are never touched. The FK from
     * step_assignments cascades, so a seeded member's assignments go with them.
     */
    public function deleteSeedForOrg(int $organizationId): int
    {
        $stmt = $this->db->prepare(
            'DELETE FROM users WHERE organization_id = :oid AND is_seed = 1'
        );
        $stmt->execute([':oid' => $organizationId]);
        return $stmt->rowCount();
    }

    /**
     * Update an existing member by its public id. The passcode is only changed
     * when a `pin_hash` is supplied; otherwise the current one is kept.
     */
    public function updateByPublicId(string $publicId, array $attrs): void
    {
        $username = isset($attrs['username']) ? trim((string) $attrs['username']) : '';

        $sets = [
            'name       = :name',
            'username   = :username',
            'role       = :role',
            'scope      = :scope',
            'email      = :email',
            'department = :department',
            'initials   = :initials',
        ];
        $params = [
            ':name'       => $attrs['name'],
            ':username'   => $username === '' ? null : $username,
            ':role'       => $attrs['role']  ?? '',
            ':scope'      => $attrs['scope'] ?? 'All',
            ':email'      => ($attrs['email']      ?? '') === '' ? null : $attrs['email'],
            ':department' => ($attrs['department'] ?? '') === '' ? null : $attrs['department'],
            ':initials'   => $attrs['initials'] ?? '',
            ':pid'        => $publicId,
        ];
        if (isset($attrs['pin_hash'])) {
            $sets[] = 'pin_hash = :pin_hash';
            $params[':pin_hash'] = $attrs['pin_hash'];
        }

        $this->execute(
            'UPDATE users SET ' . implode(', ', $sets) . ' WHERE public_id = :pid',
            $params
        );
    }

    /** Delete a member by its public id. */
    public function deleteByPublicId(string $publicId): void
    {
        $this->execute('DELETE FROM users WHERE public_id = :pid', [':pid' => $publicId]);
    }

    /** Fetch a user by its public id. */
    /**
     * A member's sign-in, kept apart from every other read of the row (Directive 2 Oct 2026, Part 6.1.2):
     * pin_hash holds the PASSWORD hash (Argon2id; older rows bcrypt) and must_change marks a temporary one.
     */
    public function credentials(string $publicId): ?array
    {
        return $this->selectOne('SELECT pin_hash, must_change FROM users WHERE public_id = :pid', [':pid' => $publicId]);
    }

    /** Sweep 4R item 2: how many administrators an organization has (it must never reach none). */
    public function countAdmins(int $orgId): int
    {
        $row = $this->selectOne('SELECT COUNT(*) AS n FROM users WHERE organization_id = :o AND is_admin = 1', [':o' => $orgId]);
        return (int) ($row['n'] ?? 0);
    }

    /** Sweep 4R item 2: make someone an administrator, or not. The caller checks the last-administrator rule first. */
    public function setAdmin(string $publicId, bool $on): void
    {
        $this->execute('UPDATE users SET is_admin = :a WHERE public_id = :pid', [':a' => $on ? 1 : 0, ':pid' => $publicId]);
    }

    /** Store a new password hash; $temporary marks it must_change (6.1.6). */
    public function setPassword(string $publicId, string $hash, bool $temporary): void
    {
        $this->execute('UPDATE users SET pin_hash = :h, must_change = :m WHERE public_id = :pid', [':h' => $hash, ':m' => $temporary ? 1 : 0, ':pid' => $publicId]);
    }

    public function findByPublicId(string $publicId): ?array
    {
        return $this->selectOne(
            'SELECT id, public_id, organization_id, name, username, role, scope,
                    email, department, initials, color, is_admin
               FROM users WHERE public_id = :pid',
            [':pid' => $publicId]
        );
    }

    /** All members of an organization, newest first for admins after the owner. */
    public function byOrganization(int $organizationId): array
    {
        return $this->select(
            'SELECT public_id, name, username, role, scope, email, department, is_admin
               FROM users WHERE organization_id = :oid ORDER BY is_admin DESC, id ASC',
            [':oid' => $organizationId]
        );
    }
}
