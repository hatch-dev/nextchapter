<?php
/**
 * DEV COPY, FIFTH DOOR (6 Nov 2026) — /apps/enterprises/dev/culture IS AI-Ready Culture.
 *
 * Nothing else lives in this folder. The page is rendered by the dev install next door
 * (../innovation-pipeline/index.php) with Culture pinned instead of the Pipeline, so every dev address runs ONE
 * copy of the code on ONE database (the install's .env) and shares one sign-in. <base href> points at that
 * install, which is where every script, stylesheet and api/ request goes. Same arrangement as ../architecture/.
 *
 * The door's folder is `culture`, the program's catalogue slug is `ai-ready-culture` and its id is
 * `ai-culture`; $DEV_DOORS in the install's index.php maps the slug to this folder.
 *
 * The browser-only review build the client delivered is ../culture-prototype/; the program was ported from it
 * by ../innovation-pipeline/tools/port-ai-culture.js.
 */
declare(strict_types=1);

const DEV_DOOR_PIN = ['role' => 'enterprises', 'module' => 'ai-ready-culture'];

require dirname(__DIR__) . '/innovation-pipeline/index.php';
