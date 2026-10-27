<?php

// The URL prefix the API is mounted at, derived from the front controller's own
// location so the app runs from any directory without per-server edits.
// /foo/api/index.php -> "/foo/api"; at the document root -> "".
$basePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');

return [
    'debug' => env('APP_DEBUG', false),
    'cors_allowed_origins' => env('CORS_ORIGINS', '*'),
    'base_path' => env('API_BASE_PATH', $basePath),
    'pin_hash_cost' => (int) env('PIN_HASH_COST', 11),
    // Directive 2 Oct 2026, 5.9 / 6.1.12: the code that lets someone create an organization. A placeholder until
    // the voucher and registration system replaces it; set SETUP_CODE in .env to change it.
    'setup_code' => (string) env('SETUP_CODE', 'ABCXYZ'),
];
