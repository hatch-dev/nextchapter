<?php
/**
 * AI Guide, stage 1 — this dev build's Guide route (brief "AI Guide – Stage 1", Paul Scade, 12 Oct 2026).
 *
 * POST { question, history, context }  ->  200 { answer }
 *
 * The brief's guide-route.js ported to PHP, because this server runs PHP. It behaves the same: the same
 * limits, model, headers and API version, citation markers stripped, and only { answer } returned.
 * Pinecone's `citations` (each one carries a signed_url to the whole uploaded file) never leave this script.
 *
 * Self-contained: it lives in the dev build and uses nothing from the live app or its api/.
 *
 * Who may call it: the brief asks for the app's session check, but this build has no server sessions —
 * its sign-in is dev-auth-server.js, which runs in the browser and which no server can verify. So the
 * route answers callers whose address is in GUIDE_ALLOWED_IPS (default: this machine; `*` = any address,
 * the setting chosen for testing on 13 Oct 2026) and refuses everyone else with 401. Every caller is held
 * to GUIDE_RATE_LIMIT_PER_HOUR questions an hour (429 over it). The live port uses the live app's real
 * sessions instead.
 *
 * Settings: api/.env beside this file (a real environment variable wins; never served — dotfiles 403).
 */

declare(strict_types=1);

/* ---------- settings ---------- */

function guide_env_file(): array
{
    static $vars = null;
    if ($vars !== null) return $vars;
    $vars = [];
    $file = __DIR__ . '/.env';
    if (!is_readable($file)) return $vars;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
        [$k, $v] = explode('=', $line, 2);
        $v = trim($v);
        if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && substr($v, -1) === $v[0]) $v = substr($v, 1, -1);
        $vars[trim($k)] = $v;
    }
    return $vars;
}

/* A setting from the environment, else api/.env; the brief's value only when it is missing or unusable. */
function guide_env_string(string $key, string $default): string
{
    $v = getenv($key);
    if ($v === false) $v = guide_env_file()[$key] ?? null;
    return is_string($v) && trim($v) !== '' ? trim($v) : $default;
}
function guide_env_int(string $key, int $default): int
{
    $v = guide_env_string($key, '');
    return ctype_digit($v) && (int) $v > 0 ? (int) $v : $default;
}

define('GUIDE_ASSISTANT_HOST',            rtrim(guide_env_string('PINECONE_ASSISTANT_HOST', 'https://prod-1-data.ke.pinecone.io'), '/'));
define('GUIDE_ASSISTANT_NAME',            guide_env_string('PINECONE_ASSISTANT_NAME', 'testassistant1'));
define('GUIDE_MODEL',                     guide_env_string('PINECONE_MODEL', 'claude-sonnet-4-5'));
define('GUIDE_API_VERSION',               guide_env_string('PINECONE_API_VERSION', '2026-07'));
define('GUIDE_MAX_QUESTION_CHARS',        guide_env_int('GUIDE_MAX_QUESTION_CHARS', 2000));
define('GUIDE_MAX_CONTEXT_CHARS',         guide_env_int('GUIDE_MAX_CONTEXT_CHARS', 300));
define('GUIDE_MAX_HISTORY_MESSAGES',      guide_env_int('GUIDE_MAX_HISTORY_MESSAGES', 10));
define('GUIDE_MAX_HISTORY_MESSAGE_CHARS', guide_env_int('GUIDE_MAX_HISTORY_MESSAGE_CHARS', 8000));
define('GUIDE_TIMEOUT_MS',                guide_env_int('GUIDE_TIMEOUT_MS', 60000));
const GUIDE_MAX_BODY_BYTES = 102400;

/* ---------- the handler ---------- */

function guide_json(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** True when the caller's address is in GUIDE_ALLOWED_IPS (comma-separated; `*` = any address;
    default this machine only). */
function guide_caller_allowed(string $addr): bool
{
    $allowed = array_filter(array_map('trim', explode(',', guide_env_string('GUIDE_ALLOWED_IPS', '127.0.0.1,::1'))));
    if (in_array('*', $allowed, true)) return true;
    return $addr !== '' && in_array($addr, $allowed, true);
}

/** Questions per address per clock hour (GUIDE_RATE_LIMIT_PER_HOUR; 0 = no cap). Each answer costs Pinecone
    tokens, so with the route open to any address this keeps one caller from running up the bill.
    True when this question may go ahead (and counts it). */
function guide_rate_ok(string $addr): bool
{
    $raw = guide_env_string('GUIDE_RATE_LIMIT_PER_HOUR', '60');
    if ($raw === '0') return true;
    $limit = ctype_digit($raw) && (int) $raw > 0 ? (int) $raw : 60;
    $file = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'nc-guide-rate-' . sha1($addr) . '.json';
    $h = @fopen($file, 'c+');
    if ($h === false) return true;   // cannot count: never block the Guide over a temp-file problem
    try {
        flock($h, LOCK_EX);
        $hour = (int) floor(time() / 3600);
        $rec = json_decode((string) stream_get_contents($h), true);
        $count = (is_array($rec) && ($rec['hour'] ?? null) === $hour) ? (int) $rec['count'] : 0;
        if ($count >= $limit) return false;
        ftruncate($h, 0); rewind($h);
        fwrite($h, json_encode(['hour' => $hour, 'count' => $count + 1]));
        return true;
    } finally {
        flock($h, LOCK_UN); fclose($h);
    }
}

/** Keeps only well-formed user/assistant turns, the most recent ones, starting with a user turn. */
function guide_clean_history($raw): array
{
    $out = [];
    foreach (is_array($raw) ? $raw : [] as $m) {
        if (!is_array($m)) continue;
        $role = $m['role'] ?? null;
        $content = $m['content'] ?? null;
        if (($role === 'user' || $role === 'assistant') && is_string($content) && trim($content) !== '') {
            $out[] = ['role' => $role, 'content' => $content];
        }
    }
    $out = array_slice($out, -GUIDE_MAX_HISTORY_MESSAGES);
    foreach ($out as &$m) $m['content'] = mb_substr($m['content'], 0, GUIDE_MAX_HISTORY_MESSAGE_CHARS);
    unset($m);
    while ($out && $out[0]['role'] === 'assistant') array_shift($out);
    return $out;
}

/** Removes citation markers such as [1] or [1, pp. 12]. The source list itself never reaches the browser. */
function guide_strip_citation_markers(string $text): string
{
    return trim((string) preg_replace('/\s?\[\d+(?:,\s*pp?\.[^\]]*)?\]/u', '', $text));
}

/** @return array{0:int,1:array} status and JSON body */
function guide_answer(array $body): array
{
    $question = mb_substr(trim((string) ($body['question'] ?? '')), 0, GUIDE_MAX_QUESTION_CHARS);
    if ($question === '') return [400, ['error' => 'empty_question']];

    $context = mb_substr(trim((string) ($body['context'] ?? '')), 0, GUIDE_MAX_CONTEXT_CHARS);
    $history = guide_clean_history($body['history'] ?? null);
    $newest  = ($context !== '' ? '[' . $context . "]\n\n" : '') . $question;

    $key = guide_env_string('PINECONE_API_KEY', '');   // server secret, never sent to the browser
    if ($key === '') {
        error_log('[guide] PINECONE_API_KEY is not set');
        return [502, ['error' => 'guide_unavailable']];
    }

    $ch = curl_init(GUIDE_ASSISTANT_HOST . '/assistant/chat/' . rawurlencode(GUIDE_ASSISTANT_NAME));
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT_MS     => GUIDE_TIMEOUT_MS,
        CURLOPT_HTTPHEADER     => [
            'Api-Key: ' . $key,
            'Content-Type: application/json',
            'X-Pinecone-Api-Version: ' . GUIDE_API_VERSION,
        ],
        CURLOPT_POSTFIELDS     => json_encode([
            'messages' => array_merge($history, [['role' => 'user', 'content' => $newest]]),
            'model'    => GUIDE_MODEL,
            'stream'   => false,
        ], JSON_UNESCAPED_UNICODE),
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        error_log('[guide] Pinecone request failed: ' . $curlError);
        return [502, ['error' => 'guide_unavailable']];
    }
    if ($status < 200 || $status >= 300) {
        error_log('[guide] Pinecone returned HTTP ' . $status);
        return [502, ['error' => 'guide_unavailable']];
    }

    $data = json_decode((string) $raw, true);
    $answer = guide_strip_citation_markers((string) (is_array($data) ? ($data['message']['content'] ?? '') : ''));
    if ($answer === '') return [502, ['error' => 'guide_unavailable']];

    // Usage logging for cost tracking. No question or answer text is logged.
    error_log(json_encode([
        'event'    => 'guide_answer',
        'model'    => $data['model'] ?? null,
        'usage'    => $data['usage'] ?? null,
        'snippets' => $data['context_snippet_count'] ?? null,
    ]));

    // Only the answer text leaves the server. $data['citations'], which carries
    // download links to the uploaded files, is deliberately dropped.
    return [200, ['answer' => $answer]];
}

/* Included rather than served (e.g. by a check script), only the functions above load. */
if (PHP_SAPI === 'cli' || basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) !== basename(__FILE__)) return;

ini_set('display_errors', '0');
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        header('Allow: POST');
        guide_json(405, ['error' => 'method_not_allowed']);
    }
    $caller = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if (!guide_caller_allowed($caller)) {
        /* Says which address was refused, so a tester knows exactly what to add to GUIDE_ALLOWED_IPS.
           It is the caller's own address, so it tells them nothing they could not already see. */
        guide_json(401, ['error' => 'not_allowed', 'your_address' => $caller]);
    }

    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    $raw = (string) file_get_contents('php://input', false, null, 0, GUIDE_MAX_BODY_BYTES + 1);
    if ($len > GUIDE_MAX_BODY_BYTES || strlen($raw) > GUIDE_MAX_BODY_BYTES) guide_json(413, ['error' => 'too_large']);
    $body = json_decode($raw, true);

    $body = is_array($body) ? $body : [];
    if (trim((string) ($body['question'] ?? '')) !== '' && !guide_rate_ok($caller)) {
        guide_json(429, ['error' => 'rate_limited']);
    }

    [$status, $json] = guide_answer($body);
    guide_json($status, $json);
} catch (Throwable $e) {
    error_log('[guide] request failed: ' . $e->getMessage());
    guide_json(502, ['error' => 'guide_unavailable']);
}
