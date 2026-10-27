<?php
/**
 * Front controller — the single entry point for the whole API.
 *
 * Every request is routed through here:
 *   1. bootstrap (autoloader, helpers, error handling, CORS)
 *   2. load the route table
 *   3. dispatch to the matching controller
 *
 * Adding features means adding controllers/models/routes — never editing this file.
 */

declare(strict_types=1);

use Core\Response;
use Core\Router;

/* ---------- 1. Helpers (plain functions, loaded first) ---------- */
require __DIR__ . '/helpers/functions.php';

/* ---------- 2a. Composer's autoloader (third-party packages) ----------
   This API is otherwise dependency-free and the hand-rolled autoloader below
   still owns everything under Core\, Controllers\, Models\ and Validation\.
   Composer is here for exactly one thing: the official Anthropic PHP SDK,
   which ClaudeController uses to reach the Messages API on the server's
   behalf (the browser cannot — see api/controllers/ClaudeController.php).

   Required, not optional: a deployment that ships api/ without api/vendor/
   would serve every other endpoint perfectly and fail only on the AI ones, at
   the moment someone opened the AI Guide. Better to say so at the front door.
   Run `composer install` in api/ after deploying. */
$autoload = __DIR__ . '/vendor/autoload.php';
if (!is_file($autoload)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Server not fully installed: api/vendor is missing. Run "composer install" in the api directory.',
    ]);
    exit;
}
require $autoload;

/* ---------- 2b. PSR-4-ish autoloader for our namespaces ---------- */
spl_autoload_register(static function (string $class): void {
    // Map top-level namespace -> directory.
    static $map = [
        'Core\\'       => __DIR__ . '/core/',
        'Controllers\\'=> __DIR__ . '/controllers/',
        'Models\\'     => __DIR__ . '/models/',
        'Validation\\' => __DIR__ . '/validation/',
    ];
    foreach ($map as $prefix => $dir) {
        if (strncmp($class, $prefix, strlen($prefix)) === 0) {
            $file = $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) {
                require $file;
            }
            return;
        }
    }
});

/* ---------- 3. Error handling ---------- */
$debug = (bool) config('config.debug');
error_reporting(E_ALL);
ini_set('display_errors', '0'); // never dump raw errors into a JSON response

set_exception_handler(static function (Throwable $e) use ($debug): void {
    $payload = $debug
        ? ['detail' => $e->getMessage(), 'where' => $e->getFile() . ':' . $e->getLine()]
        : [];
    Response::error($e->getMessage(), 500, $payload);
});

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

/* ---------- 3b. HTTPS only (Directive 2 Oct 2026, Part 6.1.9) ----------
   Behind HTTPS, tell the browser to use nothing else for a year. Redirecting http:// to https:// is the web
   server's job (Apache: a RewriteRule to https), not this script's: plain http://localhost is the dev server. */
if ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

/* ---------- 4. CORS + preflight ---------- */
$allowed = (string) config('config.cors_allowed_origins');
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($allowed === '*') {
    header('Access-Control-Allow-Origin: *');
} elseif ($origin !== '' && in_array($origin, array_map('trim', explode(',', $allowed)), true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ---------- 5. Route + dispatch ---------- */
$router = new Router((string) config('config.base_path'));
require __DIR__ . '/routes/api.php';

$router->dispatch(
    $_SERVER['REQUEST_METHOD'] ?? 'GET',
    $_SERVER['REQUEST_URI'] ?? '/'
);
