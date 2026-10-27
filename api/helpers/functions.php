<?php
/**
 * Global utility/helper functions.
 *
 * Small, dependency-free helpers shared across the whole API. Keep this file
 * lean — anything with real behaviour belongs in a class.
 */

if (!function_exists('load_env')) {
    /**
     * Read apps/.env into the process environment, once.
     *
     * Everything here has always come from the real environment, which is the
     * right place for a secret and the wrong place for a developer on XAMPP:
     * setting one means editing httpd.conf and restarting Apache. So a plain
     * KEY=value file one directory above the API is read first, and anything
     * already set in the environment wins over it — a deployment that does
     * configure real environment variables is never overridden by a stray file.
     *
     * The file lives OUTSIDE api/ deliberately. api/.htaccess rewrites every
     * request to index.php, so a dotfile there would be unreachable by
     * accident rather than by design; apps/.env is above the API entirely and
     * is git-ignored. Values are read verbatim — no interpolation, no escapes —
     * except for one optional layer of wrapping quotes.
     */
    function load_env(): void
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }
        $loaded = true;

        $file = dirname(__DIR__, 2) . '/.env';
        if (!is_readable($file)) {
            return;
        }
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (strlen($value) > 1 && ($value[0] === '"' || $value[0] === "'")
                && $value[-1] === $value[0]) {
                $value = substr($value, 1, -1);
            }
            // The real environment is authoritative; the file only fills gaps.
            if ($key !== '' && getenv($key) === false) {
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
            }
        }
    }
}

if (!function_exists('env')) {
    /**
     * Read an environment variable with a fallback default.
     * Casts the strings "true"/"false" to real booleans.
     */
    function env(string $key, $default = null)
    {
        load_env();
        $value = getenv($key);
        if ($value === false) {
            return $default;
        }
        switch (strtolower($value)) {
            case 'true':  return true;
            case 'false': return false;
            case 'null':  return null;
        }
        return $value;
    }
}

if (!function_exists('config')) {
    /**
     * Load a config file from /config once and cache it.
     * Usage: config('database')['host'] or config('app.debug') via dot-path.
     */
    function config(string $path)
    {
        static $cache = [];

        $segments = explode('.', $path);
        $file     = array_shift($segments);

        if (!array_key_exists($file, $cache)) {
            $full = __DIR__ . '/../config/' . $file . '.php';
            $cache[$file] = is_file($full) ? require $full : [];
        }

        $value = $cache[$file];
        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return null;
            }
            $value = $value[$segment];
        }
        return $value;
    }
}

if (!function_exists('public_id')) {
    /**
     * Generate a short, URL-safe public identifier, e.g. "org_a1b2c3d".
     * Uses random_bytes for unpredictability (not a sequential guess).
     */
    function public_id(string $prefix): string
    {
        $random = substr(bin2hex(random_bytes(8)), 0, 12);
        return $prefix . '_' . $random;
    }
}

if (!function_exists('initials_from')) {
    /**
     * Derive up to two uppercase initials from a person's name.
     * "Maria Torres" -> "MT", "cher" -> "CH".
     */
    function initials_from(string $name): string
    {
        $name  = trim($name);
        if ($name === '') {
            return '';
        }
        $parts = preg_split('/\s+/', $name);
        if (count($parts) === 1) {
            return strtoupper(substr($parts[0], 0, 2));
        }
        $first = substr($parts[0], 0, 1);
        $last  = substr($parts[count($parts) - 1], 0, 1);
        return strtoupper($first . $last);
    }
}
