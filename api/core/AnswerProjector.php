<?php
namespace Core;

/**
 * Projects the queryable Q&A trail out of a workspace document.
 *
 * The workspace is stored as one JSON document (see Models\Workspace). That is
 * ideal for the app, which reads the whole program state at once, but useless
 * for "show me what this team answered in Phase 1" without parsing JSON. This
 * class walks a declarative question map (api/config/questions.php) over the
 * document and returns one flat row per answered question, which
 * Models\StepAnswer writes to the `step_answers` table on every save.
 *
 * It is a pure transform: no database, no side effects, fully unit-testable.
 *
 * ── Adding a question ───────────────────────────────────────────────────
 * Add an entry to api/config/questions.php. Nothing here changes. A question
 * whose path is absent or blank in the document is simply skipped — the table
 * holds answered questions, not a row of nulls for every unanswered one.
 */
class AnswerProjector
{
    /** Longest answer we store, so one runaway textarea can't bloat the table. */
    private const MAX_ANSWER_LENGTH = 5000;

    private array $map;

    /**
     * @param array|null $map The question map. Defaults to config/questions.php.
     *                        Injectable so tests can pass a small fixture.
     */
    public function __construct(?array $map = null)
    {
        $this->map = $map ?? (array) config('questions');
    }

    /**
     * Flatten a workspace document into step_answers rows.
     *
     * @param  array $doc The decoded workspace document.
     * @return array<int, array{phase:int,step_id:string,section:string,question_key:string,question_text:string,answer:string}>
     */
    public function project(array $doc): array
    {
        $rows = [];

        foreach ($this->map as $question) {
            $value = $this->valueAtPath($doc, (string) $question['path']);
            $answer = $this->stringify($value);

            if ($answer === null) {
                continue; // unanswered — no row
            }

            $rows[] = [
                'phase'         => (int) $question['phase'],
                'step_id'       => (string) $question['step'],
                'section'       => (string) ($question['section'] ?? ''),
                'question_key'  => (string) $question['path'],
                'question_text' => (string) $question['text'],
                'answer'        => $answer,
            ];
        }

        return $rows;
    }

    /**
     * Read a dot-path such as "purpose.mission" out of the document.
     * Returns null when any segment is missing.
     */
    private function valueAtPath(array $doc, string $path)
    {
        $value = $doc;
        foreach (explode('.', $path) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return null;
            }
            $value = $value[$segment];
        }
        return $value;
    }

    /**
     * Render an answer as text, or null when there is nothing to record.
     *
     * The app's fields are mostly strings, but a few are numbers (sliders),
     * booleans (checkboxes), or lists of strings (e.g. the metrics a team
     * picked). Everything becomes readable text so one `answer` column can hold
     * the lot and a human can read the table.
     */
    private function stringify($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        if (is_array($value)) {
            // A list of scalars (checkbox group, chosen metrics) reads well as a
            // comma-separated line. Anything richer is a collection, not an
            // answer, and does not belong in the map.
            $flat = array_filter($value, static fn($v) => is_scalar($v) && $v !== '');
            if ($flat === []) {
                return null;
            }
            $value = implode(', ', array_map('strval', $flat));
        }

        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        return mb_substr($value, 0, self::MAX_ANSWER_LENGTH);
    }
}
