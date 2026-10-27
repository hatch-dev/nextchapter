<?php
namespace Core;

/**
 * JSON response helper.
 *
 * One consistent envelope for every endpoint so the front end can rely on a
 * stable shape:
 *   success -> { "success": true,  "data": {...} }
 *   failure -> { "success": false, "message": "...", "errors": {...} }
 */
class Response
{
    /** Send a success payload and stop. */
    public static function success(array $data = [], int $status = 200): void
    {
        self::send(['success' => true, 'data' => $data], $status);
    }

    /** Send a validation-failure payload (HTTP 422 by default). */
    public static function validationError(array $errors, int $status = 422): void
    {
        self::send([
            'success' => false,
            'message' => 'The submitted data was invalid.',
            'errors'  => $errors,
        ], $status);
    }

    /** Send a generic error payload. */
    public static function error(string $message, int $status = 400, array $extra = []): void
    {
        self::send(array_merge([
            'success' => false,
            'message' => $message,
        ], $extra), $status);
    }

    /** Encode + emit + terminate. */
    public static function send(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
}
