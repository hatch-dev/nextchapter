<?php
namespace Core;

/**
 * Catalogue — the server's rich view of config/catalogue.json.
 *
 * api/config/modules.php already reads that file, but it deliberately reduces
 * it to the two things the authorization path needs: the module→role map and
 * the default. That is the right shape for a check that runs on every request.
 *
 * The invite email needs more — a program's display name, its discipline tag,
 * and the URL a member should click — and none of that belongs in a hot
 * authorization lookup. So this class is the second reader, and it is still
 * reading the SAME file: there remains exactly one definition of the twelve
 * programs (see docs/roles-and-modules.md §2).
 */
class Catalogue
{
    /** @var array<string,array>|null module id → entry, with role fields folded in */
    private static ?array $modules = null;

    /** @var array<string,array>|null role key → role entry */
    private static ?array $roles = null;

    private static ?array $suite = null;

    private static function load(): void
    {
        if (self::$modules !== null) {
            return;
        }
        self::$modules = [];
        self::$roles   = [];

        $file = dirname(__DIR__, 2) . '/config/catalogue.json';
        $data = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        if (!is_array($data)) {
            self::$suite = [];
            return;
        }

        self::$suite = (array) ($data['suite'] ?? []);

        foreach ((array) ($data['roles'] ?? []) as $role) {
            $key = (string) ($role['key'] ?? '');
            if ($key === '') {
                continue;
            }
            self::$roles[$key] = $role;

            foreach ((array) ($role['modules'] ?? []) as $module) {
                $id = (string) ($module['id'] ?? '');
                if ($id === '') {
                    continue;
                }
                /* The role's key and slug are folded onto the module because
                   every consumer that has a module id wants the URL, and the
                   URL is /{role.slug}/{module.slug} — two lookups for one
                   answer, in a structure nobody should have to walk twice. */
                $module['role_key']  = $key;
                $module['role_slug'] = (string) ($role['slug'] ?? $key);
                $module['role_name'] = (string) ($role['name'] ?? $key);
                self::$modules[$id]  = $module;
            }
        }
    }

    /** One module's catalogue entry, or null. */
    public static function module(string $id): ?array
    {
        self::load();
        return self::$modules[$id] ?? null;
    }

    /** Several modules' entries, in the order given, skipping unknown ids. */
    public static function modules(array $ids): array
    {
        self::load();
        $out = [];
        foreach ($ids as $id) {
            $entry = self::$modules[(string) $id] ?? null;
            if ($entry !== null) {
                $out[] = $entry;
            }
        }
        return $out;
    }

    /** Every module id belonging to a role space, in catalogue order. */
    public static function modulesForRole(string $roleKey): array
    {
        self::load();
        $out = [];
        foreach (self::$modules as $id => $m) {
            if ($m['role_key'] === $roleKey) {
                $out[] = $id;
            }
        }
        return $out;
    }

    /** A module's display name, falling back to its id. */
    public static function name(string $id): string
    {
        $m = self::module($id);
        return (string) ($m['name'] ?? $id);
    }

    public static function suiteName(): string
    {
        self::load();
        return (string) (self::$suite['name'] ?? 'Next Chapter Programs');
    }

    /**
     * The absolute URL of a program's home screen.
     *
     * APP_URL in .env wins when set — behind a proxy or a CNAME the request's
     * own host header is the proxy's idea of the site, not the one in the link
     * a member is about to receive. Without it the URL is derived from the
     * request, which is right for XAMPP and for any single-host deployment.
     */
    public static function moduleUrl(string $id): string
    {
        $m = self::module($id);
        if ($m === null) {
            return self::baseUrl();
        }
        return self::baseUrl() . $m['role_slug'] . '/' . $m['slug'];
    }

    /** The install root, always with a trailing slash. */
    public static function baseUrl(): string
    {
        $configured = trim((string) env('APP_URL', ''));
        if ($configured !== '') {
            return rtrim($configured, '/') . '/';
        }

        $https  = (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off');
        $scheme = $https ? 'https' : 'http';
        $host   = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');

        /* api/index.php is the API's front controller, so SCRIPT_NAME is
           /<install>/api/index.php — two levels up is the install root. */
        $dir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'), 2));
        $dir = $dir === '/' || $dir === '.' ? '' : $dir;

        return $scheme . '://' . $host . $dir . '/';
    }

    /**
     * The sign-in URL to send an invited member to.
     *
     * There is no shared /login any more: every program has its own door
     * (/{role}/{program}/login), so an invitation has to name one. It names the
     * first program the member was actually granted, preferring one that is
     * LIVE — arriving at a placeholder's sign-in and then finding "in
     * development" behind it is a poor first minute, and any of their programs'
     * doors admits them to all of them.
     *
     * The default program's door is the fallback for a member granted nothing
     * yet, which the email says plainly in its own words. It is still a working
     * sign-in: which door you come through decides only where you land.
     *
     * @param list<string> $modules the member's granted module ids
     */
    public static function loginUrl(array $modules = []): string
    {
        $entries = self::modules($modules);

        foreach ([true, false] as $liveOnly) {
            foreach ($entries as $m) {
                if (!$liveOnly || ($m['status'] ?? '') === 'live') {
                    return self::baseUrl() . $m['role_slug'] . '/' . $m['slug'] . '/login';
                }
            }
        }

        $fallback = self::module((string) (config('modules.default') ?? ''));
        return $fallback !== null
            ? self::baseUrl() . $fallback['role_slug'] . '/' . $fallback['slug'] . '/login'
            : self::baseUrl();
    }
}
