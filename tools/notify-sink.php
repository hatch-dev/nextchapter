<?php
/* ─────────────────────────────────────────────────────────────
   notify-sink.php — stand in for the AWS notification service
   ─────────────────────────────────────────────────────────────
   The PHP twin of tools/notify-sink.js, for a machine with no Node on it.
   Same job, same checks, served by the XAMPP Apache that is already running
   the app, so there is nothing to install and nothing to start.

   The email component (js/features/email.js) POSTs to NOTIFY_ENDPOINT and is
   inert until that is set. This is somewhere to point it while the real
   service does not exist yet, so the whole path can be exercised by hand:
   the request, the CORS pre-flight, the per-program URL path, the eight-field
   body, and the HTML the service would turn into a PDF.

   It answers the way the directive of 3 Sep 2026 says the service must
   (Part 3, point 2): CORS headers on both OPTIONS and POST, and a 2xx.

     base URL : http://localhost/apps/tools/notify-sink.php
       → the Pipeline posts to  …/notify-sink.php/pipeline
       → Governance posts to    …/notify-sink.php/ai-governance

     inbox    : open the base URL in a browser (GET) for everything captured,
                each body one click away exactly as the email would render it.

   Every request is recorded in tools/_notify-out/: the body's `html` as its
   own file — that HTML is what the real service converts to the PDF — and a
   line in log.jsonl.

   Nothing here is part of the app. It is a test double; deleting it changes
   nothing that ships. It writes only inside tools/_notify-out/.
   ───────────────────────────────────────────────────────────── */

$OUT = __DIR__ . DIRECTORY_SEPARATOR . '_notify-out';
if (!is_dir($OUT)) { @mkdir($OUT, 0777, true); }
$LOG = $OUT . DIRECTORY_SEPARATOR . 'log.jsonl';

/* Access-Control-Allow-Origin is '*' here deliberately: this is a throwaway on
   localhost and pinning it to an origin is the commonest way to spend an hour
   debugging the test rig instead of the app. The real service should name the
   domains each app is served from. */
function cors() {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Max-Age: 600');
}

/* The program is named in the PATH (Part 3, point 3). PATH_INFO is the normal
   route; the REQUEST_URI split is the fallback for an Apache built without
   AcceptPathInfo, so a missing server option shows up as "(none)" rather than
   as a 404 the app would silently record as failed. */
function program() {
  $p = isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '';
  if ($p === '' && isset($_SERVER['REQUEST_URI'])) {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $at = strpos($uri, '.php');
    if ($at !== false) $p = substr($uri, $at + 4);
  }
  $p = trim((string)$p, '/');
  return $p === '' ? '(none)' : $p;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

/* ── The browser asks first ───────────────────────────────────
   Answering this wrongly is the failure the directive calls "the most common
   reason for this kind of integration to fail silently" — every notification
   records as failed (network) and no email is sent, with nothing in the app to
   say why. */
if ($method === 'OPTIONS') {
  cors();
  http_response_code(204);
  exit;
}

/* ── The inbox ────────────────────────────────────────────────
   A GET is a person looking, not the app posting. This is the view that
   answers "what would the team actually have received?". */
if ($method === 'GET') {
  header('Content-Type: text/html; charset=utf-8');
  $rows = [];
  if (is_file($LOG)) {
    foreach (file($LOG, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
      $r = json_decode($line, true);
      if (is_array($r)) $rows[] = $r;
    }
  }
  $rows = array_reverse($rows);
  $e = function ($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); };
  echo '<!doctype html><meta charset="utf-8"><title>Notification sink</title>';
  echo '<style>body{font:14px/1.5 system-ui,Segoe UI,Arial;margin:28px;max-width:1000px;color:#1E2530}'
     . 'h1{font-size:20px;margin:0 0 4px}p.sub{color:#667;margin:0 0 22px}'
     . 'table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #e3e7ee;vertical-align:top}'
     . 'th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#667}'
     . 'code{background:#f2f4f8;padding:1px 5px;border-radius:3px;font-size:12px}'
     . '.ok{color:#1B7F5A;font-weight:600}.bad{color:#B3261E;font-weight:600}'
     . '.empty{background:#f7f9fc;border:1px solid #e3e7ee;border-radius:8px;padding:22px;color:#667}</style>';
  echo '<h1>Notification sink</h1><p class="sub">Standing in for the AWS notification service. '
     . count($rows) . ' request' . (count($rows) === 1 ? '' : 's') . ' captured. '
     . 'Point <code>NOTIFY_ENDPOINT</code> at <code>' . $e(strtok($_SERVER['REQUEST_URI'], '?')) . '</code></p>';
  if (!$rows) {
    echo '<div class="empty">Nothing captured yet. In the app, set the endpoint and mark a step complete &mdash; '
       . 'a completion report should land here within a second.</div>';
  } else {
    echo '<table><tr><th>#</th><th>Received</th><th>Program</th><th>Kind</th><th>Subject</th>'
       . '<th>To</th><th>Fields</th><th>Analytics</th><th>Body</th></tr>';
    foreach ($rows as $r) {
      $fieldsOk = !empty($r['fieldsOk']);
      $an = isset($r['analytics']) ? $r['analytics'] : '';
      echo '<tr><td>' . $e($r['n']) . '</td><td>' . $e($r['at']) . '</td><td><code>' . $e($r['program']) . '</code></td>'
         . '<td>' . $e($r['kind']) . ($r['pdf'] ? ' <code>pdf</code>' : '') . '</td>'
         . '<td>' . $e($r['subject']) . '</td>'
         . '<td>' . $e(is_array($r['to']) ? implode(', ', $r['to']) : $r['to']) . '</td>'
         . '<td class="' . ($fieldsOk ? 'ok">&#10003; 8' : 'bad">&#10007;') . '</td>'
         . '<td class="' . ($an === 'ok' ? 'ok">&#10003;' : ($an === '' ? '">&mdash;' : 'bad">&#10007;')) . '</td>'
         . '<td><a href="_notify-out/' . rawurlencode($r['file']) . '" target="_blank">open</a></td></tr>';
    }
    echo '</table>';
  }
  exit;
}

if ($method !== 'POST') {
  cors();
  http_response_code(405);
  exit('POST only');
}

/* ── A notification ───────────────────────────────────────────── */
cors();
header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
  http_response_code(400);
  exit('{"ok":false,"error":"not JSON"}');
}

/* A sequence number that survives concurrent posts — the count of what is
   already on disk would race two requests onto the same file name. */
$seqFile = $OUT . DIRECTORY_SEPARATOR . '.seq';
$n = 1;
$fh = @fopen($seqFile, 'c+');
if ($fh) {
  @flock($fh, LOCK_EX);
  $n = ((int)stream_get_contents($fh)) + 1;
  @ftruncate($fh, 0); @rewind($fh); @fwrite($fh, (string)$n);
  @flock($fh, LOCK_UN); @fclose($fh);
}

$keys = array_keys($body); sort($keys);
$EXPECT = ['html', 'kind', 'orgName', 'pdf', 'sentAt', 'stepId', 'subject', 'to'];
$fieldsOk = ($keys === $EXPECT);

$kind = isset($body['kind']) ? (string)$body['kind'] : '';
$stepId = isset($body['stepId']) ? (string)$body['stepId'] : '';
$html = isset($body['html']) ? (string)$body['html'] : '';

/* The one thing worth checking automatically: correction A says the completion
   body is always the ANALYTICS tab, whatever tab the user left open. These
   four markers appear only on that tab. */
$analytics = '';
if ($kind === 'step-complete') {
  $missing = [];
  foreach (['90-Day Burn-up', 'Module Velocity', 'Workload by Member', 'Signals'] as $m) {
    if (strpos($html, $m) === false) $missing[] = $m;
  }
  if ($missing) $analytics = 'MISSING ' . implode(', ', $missing);
  elseif (strpos($html, 'This Week') !== false) $analytics = 'the ASSIGNMENTS tab body is in the email';
  else $analytics = 'ok';
}

$file = sprintf('%03d-%s-%s.html', $n, ($kind !== '' ? $kind : 'unknown'),
                preg_replace('/[^\w.-]/', '_', $stepId));
/* Saved with the app's stylesheet linked, because that is what the directive
   requires of the real converter (Part 5, test 2: "unstyled" is a failure) and
   an unstyled capture here would look like the same bug. */
$page = "<!doctype html><meta charset=\"utf-8\">\n"
      . "<title>" . htmlspecialchars(isset($body['subject']) ? $body['subject'] : '', ENT_QUOTES, 'UTF-8') . "</title>\n"
      . "<link rel=\"stylesheet\" href=\"../../assets/css/styles.css\">\n"
      . "<link rel=\"stylesheet\" href=\"../../assets/css/themes.css\">\n"
      . "<div class=\"content-inner\" style=\"padding:24px\">\n" . $html . "\n</div>\n";
@file_put_contents($OUT . DIRECTORY_SEPARATOR . $file, $page);

/* Auth headers must be absent — the app sends none (Part 3, point 1). */
$auth = (!empty($_SERVER['HTTP_AUTHORIZATION']) || !empty($_SERVER['HTTP_X_API_KEY'])) ? 'PRESENT' : 'none';

$rec = [
  'n' => $n,
  'at' => gmdate('Y-m-d\TH:i:s\Z'),
  'program' => program(),
  'kind' => $kind,
  'subject' => isset($body['subject']) ? $body['subject'] : '',
  'to' => isset($body['to']) ? $body['to'] : [],
  'stepId' => $stepId,
  'orgName' => isset($body['orgName']) ? $body['orgName'] : '',
  'sentAt' => isset($body['sentAt']) ? $body['sentAt'] : '',
  'pdf' => !empty($body['pdf']),
  'fieldsOk' => $fieldsOk,
  'fields' => implode(',', $keys),
  'analytics' => $analytics,
  'auth' => $auth,
  'htmlLen' => strlen($html),
  'file' => $file,
];
@file_put_contents($LOG, json_encode($rec) . "\n", FILE_APPEND | LOCK_EX);

http_response_code(200);
echo json_encode(['ok' => true, 'received' => $n]);
