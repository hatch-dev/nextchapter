<?php
namespace Validation;

/**
 * Rule-based input validator.
 *
 * Declarative rules keep controllers clean and make new endpoints trivial:
 *   $v = new Validator($data, [
 *       'username' => ['required', 'min:3', 'max:60', 'regex:/^[a-zA-Z0-9_.-]+$/'],
 *   ]);
 *   if ($v->fails()) { ...$v->errors()... }
 *
 * Supported rules:
 *   required | min:N | max:N | alpha | alpha_num | numeric | regex:/.../ | in:a,b,c
 * Optional field labels give human-readable messages.
 */
class Validator
{
    private array $data;
    private array $rules;
    private array $labels;
    private array $errors = [];

    public function __construct(array $data, array $rules, array $labels = [])
    {
        $this->data   = $data;
        $this->rules  = $rules;
        $this->labels = $labels;
        $this->run();
    }

    public function fails(): bool   { return !empty($this->errors); }
    public function passes(): bool  { return empty($this->errors); }
    public function errors(): array { return $this->errors; }

    /** Trimmed value for a validated field (empty string if absent). */
    public function value(string $field): string
    {
        return isset($this->data[$field]) ? trim((string) $this->data[$field]) : '';
    }

    private function run(): void
    {
        foreach ($this->rules as $field => $ruleset) {
            $rules = is_array($ruleset) ? $ruleset : explode('|', $ruleset);
            $value = $this->value($field);

            foreach ($rules as $rule) {
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
                $error = $this->check($name, $value, $param, $field);
                if ($error !== null) {
                    $this->errors[$field][] = $error;
                    break; // one error per field is enough for the UI
                }
            }
        }
    }

    /** Returns an error message, or null if the rule passes. */
    private function check(string $rule, string $value, ?string $param, string $field): ?string
    {
        $label = $this->labels[$field] ?? ucfirst(str_replace('_', ' ', $field));

        switch ($rule) {
            case 'required':
                return $value === '' ? "$label is required." : null;

            case 'min':
                return mb_strlen($value) < (int) $param
                    ? "$label must be at least {$param} characters." : null;

            case 'max':
                return mb_strlen($value) > (int) $param
                    ? "$label must be no more than {$param} characters." : null;

            case 'alpha':
                return preg_match('/^[\p{L}\s]+$/u', $value) !== 1
                    ? "$label may only contain letters." : null;

            case 'alpha_num':
                return preg_match('/^[\p{L}\p{N}]+$/u', $value) !== 1
                    ? "$label may only contain letters and numbers." : null;

            case 'numeric':
                return preg_match('/^[0-9]+$/', $value) !== 1
                    ? "$label must contain only digits." : null;

            case 'regex':
                return preg_match($param, $value) !== 1
                    ? "$label is not in a valid format." : null;

            case 'in':
                $allowed = explode(',', (string) $param);
                return in_array($value, $allowed, true)
                    ? null : "$label is invalid.";
        }

        return null; // unknown rule -> ignore
    }
}
