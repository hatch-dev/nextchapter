<?php
declare(strict_types=1);

/**
 * Streaming proxy: browser -> this PHP endpoint -> Flowise prediction API.
 *
 * The browser never sees the Flowise URL or API key. We forward the Flowise
 * SSE stream straight through so tokens reach the browser as Claude produces them.
 */

$config = require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$raw   = file_get_contents('php://input');
$input = json_decode($raw ?: '', true);
if (!is_array($input)) {
    $input = [];
}

$question  = trim((string)($input['question'] ?? ''));
$sessionId = trim((string)($input['sessionId'] ?? ''));

if ($question === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Empty question']);
    exit;
}

if (($config['flowise_chatflow_id'] ?? '') === '' || $config['flowise_chatflow_id'] === 'YOUR_CHATFLOW_ID') {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Flowise chatflow ID is not configured. See config.local.example.php.']);
    exit;
}

$url = rtrim((string)$config['flowise_base_url'], '/')
     . '/api/v1/prediction/'
     . rawurlencode((string)$config['flowise_chatflow_id']);

// --- Prepare the browser for a live SSE stream ---
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // stop nginx/proxies from buffering the stream

// Turn off every layer of PHP output buffering so bytes flush immediately.
while (ob_get_level() > 0) {
    @ob_end_flush();
}
@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', '0');
@ini_set('implicit_flush', '1');
ob_implicit_flush(true);

$payload = [
    'question'  => $question,
    'streaming' => true,
];
if ($sessionId !== '') {
    // Lets Flowise keep per-conversation memory if the chatflow has a memory node.
    $payload['overrideConfig'] = ['sessionId' => $sessionId];
}

$headers = [
    'Content-Type: application/json',
    'Accept: text/event-stream',
];
if (!empty($config['flowise_api_key'])) {
    $headers[] = 'Authorization: Bearer ' . $config['flowise_api_key'];
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_RETURNTRANSFER => false,
    // Push each chunk from Flowise straight to the browser as it arrives.
    CURLOPT_WRITEFUNCTION  => static function ($ch, string $chunk): int {
        echo $chunk;
        flush();
        return strlen($chunk);
    },
    CURLOPT_TIMEOUT        => 300,
    CURLOPT_CONNECTTIMEOUT => 15,
]);

$ok = curl_exec($ch);

if ($ok === false) {
    // Surface connection problems to the browser in the same SSE channel.
    echo "\n";
    echo 'data: ' . json_encode(['event' => 'error', 'data' => 'Could not reach Flowise: ' . curl_error($ch)]) . "\n\n";
    flush();
} else {
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($status >= 400) {
        echo "\n";
        echo 'data: ' . json_encode(['event' => 'error', 'data' => 'Flowise returned HTTP ' . $status]) . "\n\n";
        flush();
    }
}

curl_close($ch);
