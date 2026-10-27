<?php
/**
 * claude.php — the AI Guide's model and credentials.
 *
 * Every AI feature in the suite goes through ONE endpoint (POST /claude,
 * Controllers\ClaudeController) so the API key lives on the server and nowhere
 * near a browser. Before that endpoint existed the app called
 * https://api.anthropic.com/v1/messages straight from the page, which no
 * browser can do — Anthropic sends no CORS headers, so every AI feature failed
 * with "blocked by CORS policy" and a dead card on screen.
 *
 * THE MODEL IS DECIDED HERE, NOT BY THE CLIENT. Each caller in the browser
 * still sends a `model` in its body — the reference builds all did — and the
 * controller ignores it. Two reasons: a page can't be trusted to name the model
 * an account is billed for, and the ones already hard-coded in that markup are
 * stale (`claude-sonnet-4-20250514` is deprecated). One value here changes
 * every AI feature in every program.
 */

return [
    /* The key. Set it in apps/.env (git-ignored) or as a real environment
       variable — see .env.example. Absent, /claude answers 503 with a readable
       message rather than failing at the network layer. */
    'api_key' => (string) env('ANTHROPIC_API_KEY', ''),

    'model' => (string) env('ANTHROPIC_MODEL', 'claude-opus-5'),

    /* Effort controls how hard the model thinks before answering. These are
       short coaching replies and one-paragraph challenges, not analysis runs,
       so `low` is the honest setting: it is the cheapest and fastest, and the
       prompts already carry their own length limits ("Maximum 150 words",
       "2-3 short paragraphs"). Raise it here if the guide starts feeling shallow.
       One of: low | medium | high | xhigh | max. */
    'effort' => (string) env('ANTHROPIC_EFFORT', 'low'),

    /* max_tokens is a ceiling on THINKING PLUS the reply, and thinking is on by
       default on this model. The browser callers ask for 300–3000, sized for
       reply text alone on a model that did not think — at 300 the answer would
       be cut off mid-sentence with nothing to say why. So the controller
       clamps whatever it is sent into this range. The floor is headroom for
       thinking, not a target length; the prompts decide how long the reply is. */
    'min_tokens' => (int) env('ANTHROPIC_MIN_TOKENS', 4096),
    'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS', 16000),

    /* A single request's ceiling on how much prompt a page may send, in
       characters. The Decision Lab's profile generator assembles every decision
       in the workspace into one prompt, so this is not a small number — it is
       here to stop a runaway loop billing an account, not to police normal use. */
    'max_prompt_chars' => (int) env('ANTHROPIC_MAX_PROMPT_CHARS', 200000),
];
