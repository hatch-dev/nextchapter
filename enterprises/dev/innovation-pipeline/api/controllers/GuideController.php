<?php
namespace Controllers;

use Core\Controller;
use Core\Response;
use Models\Organization;

/**
 * AI Guide, stage 1 — the AI Innovation Pipeline's Guide talks to the Pinecone Assistant
 * (brief "AI Guide – Stage 1", Paul Scade, 12 Oct 2026). DEV COPY only (/apps/dev/), 13 Oct 2026.
 *
 * POST /guide   { question, history, context }  ->  200 { answer }
 *
 * The brief's guide-route.js, ported to this API. It behaves the same way: the same limits, model, headers
 * and API version; citation markers removed; and ONLY { answer } returned — Pinecone's `citations` each
 * carry a signed_url to the whole uploaded file (TRANSCEND), so they never leave the server. Like
 * ClaudeController, the success body is not the house envelope: it is the brief's own shape, which the
 * acceptance test checks in the Network tab.
 *
 * Sign-in: the app's own session check (requireSignedIn) — 401 signed out, 403 while a temporary
 * password still has to be replaced — exactly as the brief's requirement 2 asks.
 *
 * Settings (.env; a real environment variable wins): PINECONE_API_KEY (required), PINECONE_ASSISTANT_HOST,
 * PINECONE_ASSISTANT_NAME, PINECONE_ASSISTANT_NAME_EXEC_READINESS, PINECONE_ASSISTANT_NAME_AI_GOVERNANCE,
 * PINECONE_ASSISTANT_NAME_ARCHITECTURE, PINECONE_MODEL,
 * PINECONE_API_VERSION,
 * GUIDE_MAX_QUESTION_CHARS, GUIDE_MAX_CONTEXT_CHARS, GUIDE_MAX_HISTORY_MESSAGES, GUIDE_MAX_HISTORY_MESSAGE_CHARS,
 * GUIDE_TIMEOUT_MS. The second argument of each lookup below is the brief's value, used only when a line is missing.
 *
 * One assistant per program (16 Oct 2026: Executive Readiness got the Pipeline's Guide). The body names its
 * `module`; the server picks that program's assistant from ASSISTANTS — the browser never names an assistant —
 * and the module goes through moduleFrom(), the gate every per-program endpoint uses, so a member can only ask
 * the Guide of a program they may open. No module = the Pipeline, as before. Any other program has no Guide
 * here (it still uses POST /claude) and is refused with 400 no_guide.
 */
class GuideController extends Controller
{
    private const MAX_BODY_BYTES = 102400;

    /** module => [.env key naming its Pinecone assistant, the assistant used when the line is missing] */
    private const ASSISTANTS = [
        'pipeline'       => ['PINECONE_ASSISTANT_NAME', 'testassistant1'],
        'exec-readiness' => ['PINECONE_ASSISTANT_NAME_EXEC_READINESS', 'nextchapter-executive-readiness'],
        'ai-governance'  => ['PINECONE_ASSISTANT_NAME_AI_GOVERNANCE', 'nextchapter-responsible-ai-governance'],   /* 16 Oct 2026 */
        'ai-architecture' => ['PINECONE_ASSISTANT_NAME_ARCHITECTURE', 'architecture'],   /* 21 Oct 2026: AI-Ready Architecture (assistant created 21 Oct 07:07 UTC, 6 files) */
    ];

    public function ask(): void
    {
        $this->requireSignedIn();

        $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        $raw = (string) file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if ($len > self::MAX_BODY_BYTES || strlen($raw) > self::MAX_BODY_BYTES) {
            Response::send(['error' => 'too_large'], 413);
        }
        $body = json_decode($raw, true);
        $body = is_array($body) ? $body : [];
        $module = $this->guideModule($body);   /* refuses (and exits) before any Pinecone call */

        try {
            [$status, $json] = self::answer($body, $module);
            Response::send($json, $status);
        } catch (\Throwable $e) {
            error_log('[guide] request failed: ' . $e->getMessage());
            Response::send(['error' => 'guide_unavailable'], 502);
        }
    }

    /**
     * Which program this question is for. A member: the module they name, through moduleFrom() — catalogue,
     * role space, the organization's plan and their own grant. The app administrator (no member row) may ask
     * any program's Guide. Either way the answer must be a program that HAS a Guide.
     */
    private function guideModule(array $body): string
    {
        $actor = $this->sessionUser();
        if ($actor !== null) {
            $org = (new Organization())->findById((int) $actor['organization_id']);
            if ($org === null) Response::error('Organization not found.', 404, ['reason' => 'no-org']);
            $module = $this->moduleFrom($body, $org, $actor);
        } else {
            $module = trim((string) ($body['module'] ?? ''));
            if ($module === '') $module = 'pipeline';
        }
        if (!isset(self::ASSISTANTS[$module])) Response::send(['error' => 'no_guide'], 400);
        return $module;
    }

    /** The Pinecone assistant that answers for a program. */
    public static function assistantFor(string $module): string
    {
        [$key, $default] = self::ASSISTANTS[$module] ?? self::ASSISTANTS['pipeline'];
        return self::str($key, $default);
    }

    /* ── settings ─────────────────────────────────────────────── */

    private static function str(string $key, string $default): string
    {
        $v = env($key, null);
        return is_string($v) && trim($v) !== '' ? trim($v) : $default;
    }

    private static function int(string $key, int $default): int
    {
        $v = self::str($key, '');
        return ctype_digit($v) && (int) $v > 0 ? (int) $v : $default;
    }

    /* ── the brief's handler ──────────────────────────────────── */

    /** Keeps only well-formed user/assistant turns, the most recent ones, starting with a user turn. */
    public static function cleanHistory($raw): array
    {
        $max = self::int('GUIDE_MAX_HISTORY_MESSAGES', 10);
        $maxChars = self::int('GUIDE_MAX_HISTORY_MESSAGE_CHARS', 8000);
        $out = [];
        foreach (is_array($raw) ? $raw : [] as $m) {
            if (!is_array($m)) continue;
            $role = $m['role'] ?? null;
            $content = $m['content'] ?? null;
            if (($role === 'user' || $role === 'assistant') && is_string($content) && trim($content) !== '') {
                $out[] = ['role' => $role, 'content' => $content];
            }
        }
        $out = array_slice($out, -$max);
        foreach ($out as &$m) $m['content'] = mb_substr($m['content'], 0, $maxChars);
        unset($m);
        while ($out && $out[0]['role'] === 'assistant') array_shift($out);
        return $out;
    }

    /** Removes citation markers such as [1] or [1, pp. 12]. The source list itself never reaches the browser. */
    public static function stripCitationMarkers(string $text): string
    {
        return trim((string) preg_replace('/\s?\[\d+(?:,\s*pp?\.[^\]]*)?\]/u', '', $text));
    }

    /** @return array{0:int,1:array} HTTP status and JSON body */
    public static function answer(array $body, string $module = 'pipeline'): array
    {
        $question = mb_substr(trim((string) ($body['question'] ?? '')), 0, self::int('GUIDE_MAX_QUESTION_CHARS', 2000));
        if ($question === '') return [400, ['error' => 'empty_question']];

        $context = mb_substr(trim((string) ($body['context'] ?? '')), 0, self::int('GUIDE_MAX_CONTEXT_CHARS', 300));
        $history = self::cleanHistory($body['history'] ?? null);
        $newest  = ($context !== '' ? '[' . $context . "]\n\n" : '') . $question;

        $key = self::str('PINECONE_API_KEY', '');   // server secret — never sent to the browser
        if ($key === '') {
            error_log('[guide] PINECONE_API_KEY is not set');
            return [502, ['error' => 'guide_unavailable']];
        }
        $host = rtrim(self::str('PINECONE_ASSISTANT_HOST', 'https://prod-1-data.ke.pinecone.io'), '/');
        $name = self::assistantFor($module);

        $ch = curl_init($host . '/assistant/chat/' . rawurlencode($name));
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS     => self::int('GUIDE_TIMEOUT_MS', 60000),
            CURLOPT_HTTPHEADER     => [
                'Api-Key: ' . $key,
                'Content-Type: application/json',
                'X-Pinecone-Api-Version: ' . self::str('PINECONE_API_VERSION', '2026-07'),
            ],
            CURLOPT_POSTFIELDS     => json_encode([
                'messages' => array_merge($history, [['role' => 'user', 'content' => $newest]]),
                'model'    => self::str('PINECONE_MODEL', 'claude-sonnet-4-5'),
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
        $answer = self::stripCitationMarkers((string) (is_array($data) ? ($data['message']['content'] ?? '') : ''));
        if ($answer === '') return [502, ['error' => 'guide_unavailable']];

        // Usage logging for cost tracking. No question or answer text is logged.
        error_log(json_encode([
            'event'    => 'guide_answer',
            'module'   => $module,
            'model'    => $data['model'] ?? null,
            'usage'    => $data['usage'] ?? null,
            'snippets' => $data['context_snippet_count'] ?? null,
        ]));

        // Only the answer text leaves the server. $data['citations'], which carries
        // download links to the uploaded files, is deliberately dropped.
        return [200, ['answer' => $answer]];
    }
}
