<?php
namespace Controllers;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\RateLimitException;
use Anthropic\Messages\TextBlock;
use Core\Controller;
use Core\Response;

/**
 * The AI Guide's one door to Anthropic.
 *
 * ── Why this exists ───────────────────────────────────────────────
 * The browser used to POST straight to https://api.anthropic.com/v1/messages.
 * That cannot work and never did: Anthropic serves no CORS headers, so every
 * AI feature in every program died with "blocked by CORS policy" — the AI
 * Guide, The Decision Lab's Challenge card and decision profile, The Ethics
 * Engine's profile. It would also have required shipping an API key to the
 * page, which is not something to fix by shipping the key better.
 *
 * So the request is made here instead, with the key from apps/.env, and the
 * page talks to same-origin `api/claude`.
 *
 * ── The response shape is Anthropic's, not this API's ─────────────
 * Every other endpoint answers in the house envelope ({success, data}). This
 * one deliberately does not on the happy path: it returns the Messages API
 * response verbatim, because four call sites across three files already read
 * `j.content[i].text`, and two of them are in GENERATED code (the program.js
 * under each js/modules directory, written by tools/port-leader-module.js).
 * Wrapping the body would mean a graft in the porter for nothing.
 * A proxy that returns what it proxied is also just the honest shape.
 *
 * Errors DO use the house envelope. The callers all read `j.content` and fall
 * back to their own "could not generate" copy when it is absent, so an error
 * body degrades into their existing message instead of a blank card.
 */
class ClaudeController extends Controller
{
    public function messages(): void
    {
        $this->requireSignedIn();   /* Directive 2 Oct 2026, Part 6.1.4: the API key is not for anyone who can reach this address */
        $config = config('claude');

        if (($config['api_key'] ?? '') === '') {
            /* Deliberately explicit. The alternative — letting the SDK fail on
               a blank key — surfaces as a 401 from Anthropic, which reads like
               a bad key rather than a missing one. */
            Response::error(
                'The AI features are not configured on this server. Set ANTHROPIC_API_KEY in apps/.env (see apps/.env.example).',
                503,
                ['reason' => 'no-api-key']
            );
        }

        $input = $this->input();
        $messages = $this->readMessages($input, (int) $config['max_prompt_chars']);

        /* The page's own max_tokens is a hint about the reply, sized on builds
           whose model did not think. Clamped, not trusted — see config/claude.php. */
        $maxTokens = (int) ($input['max_tokens'] ?? 0);
        $maxTokens = max((int) $config['min_tokens'], min((int) $config['max_tokens'], $maxTokens));

        try {
            $client = new Client(apiKey: (string) $config['api_key']);
            $message = $client->messages->create(
                maxTokens: $maxTokens,
                messages: $messages,
                model: (string) $config['model'],
                outputConfig: ['effort' => (string) $config['effort']],
            );
        } catch (AuthenticationException $e) {
            Response::error('The AI service rejected this server\'s API key.', 502, ['reason' => 'bad-api-key']);
        } catch (RateLimitException $e) {
            Response::error('The AI service is rate limiting this account. Try again in a moment.', 429, ['reason' => 'rate-limited']);
        } catch (APIConnectionException $e) {
            Response::error('Could not reach the AI service.', 504, ['reason' => 'upstream-unreachable']);
        } catch (APIStatusException $e) {
            /* Anything else the API said. The upstream status is not forwarded
               as-is: a 400 from Anthropic is not a 400 from this endpoint, and
               reporting it that way sends whoever debugs it looking at the
               browser's request instead of at this file. */
            Response::error('The AI service returned an error.', 502, [
                'reason' => 'upstream-error',
                'upstream_status' => $e->status,
            ]);
        }

        /* Safety classifiers can decline a request: a normal success with
           stop_reason "refusal" and no text. Passed through as a readable
           sentence, because the callers render whatever text comes back and an
           empty content array would show their generic failure copy for what
           is not a failure. */
        if ($message->stopReason === 'refusal') {
            Response::send([
                'id' => $message->id,
                'type' => 'message',
                'role' => 'assistant',
                'model' => $message->model,
                'stop_reason' => 'refusal',
                'content' => [[
                    'type' => 'text',
                    'text' => 'I can’t help with that particular request. Try rephrasing it, or ask about a different part of your work.',
                ]],
            ]);
        }

        /* Verbatim, in the Messages API's own shape. Only text blocks: thinking
           blocks carry no text on this model and the callers concatenate
           `.text` off every element, so anything else is noise on the wire. */
        $blocks = [];
        foreach ($message->content as $block) {
            if ($block instanceof TextBlock && $block->text !== '') {
                $blocks[] = ['type' => 'text', 'text' => $block->text];
            }
        }

        Response::send([
            'id' => $message->id,
            'type' => 'message',
            'role' => 'assistant',
            'model' => $message->model,
            'stop_reason' => $message->stopReason,
            'content' => $blocks,
            'usage' => [
                'input_tokens' => $message->usage->inputTokens,
                'output_tokens' => $message->usage->outputTokens,
            ],
        ]);
    }

    /**
     * The conversation, validated.
     *
     * Every caller sends the same shape — one user turn whose content is a
     * string holding the system prompt, the context and the question. That is
     * what the reference builds built and what the generated code still
     * builds, so it is what this accepts: text only, no tool blocks, no
     * images, nothing that could turn this endpoint into a general-purpose
     * relay for anything that can reach it.
     *
     * @return list<array{role: string, content: string}>
     */
    private function readMessages(array $input, int $maxChars): array
    {
        $raw = $input['messages'] ?? null;
        if (!is_array($raw) || $raw === []) {
            Response::validationError(['messages' => ['A conversation is required.']]);
        }
        if (count($raw) > 40) {
            Response::validationError(['messages' => ['Too many messages in one request.']]);
        }

        $out = [];
        $chars = 0;
        foreach ($raw as $m) {
            $role = is_array($m) ? (string) ($m['role'] ?? '') : '';
            $content = is_array($m) ? ($m['content'] ?? '') : '';
            if ($role !== 'user' && $role !== 'assistant') {
                Response::validationError(['messages' => ['Each message needs a role of "user" or "assistant".']]);
            }
            if (!is_string($content) || trim($content) === '') {
                Response::validationError(['messages' => ['Each message needs text content.']]);
            }
            $chars += strlen($content);
            $out[] = ['role' => $role, 'content' => $content];
        }
        if ($chars > $maxChars) {
            Response::validationError(['messages' => ['That request is too long for the AI service.']]);
        }
        return $out;
    }
}
