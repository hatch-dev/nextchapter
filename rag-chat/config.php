<?php
/**
 * Base configuration for the RAG chat app.
 *
 * Do NOT put real secrets here. Override them in config.local.php
 * (gitignored) or via environment variables. See config.local.example.php.
 */

$config = [
    // Where your Flowise instance is reachable from the PHP server.
    'flowise_base_url'    => getenv('FLOWISE_BASE_URL')    ?: 'http://localhost:3000',

    // The chatflow that wires up Voyage embeddings -> Pinecone -> Claude.
    // Copy it from the Flowise UI (top-right of the chatflow -> "API Endpoint").
    'flowise_chatflow_id' => getenv('FLOWISE_CHATFLOW_ID') ?: 'YOUR_CHATFLOW_ID',

    // Optional. Only needed if you protected the chatflow with an API key in Flowise.
    'flowise_api_key'     => getenv('FLOWISE_API_KEY')     ?: '',
];

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    $config = array_merge($config, require $local);
}

return $config;
