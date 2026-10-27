<?php
/**
 * DEV COPY, FOURTH DOOR (21 Oct 2026) — /apps/enterprises/dev/architecture IS AI-Ready Architecture.
 *
 * Nothing else lives in this folder. The page is rendered by the dev install next door
 * (../innovation-pipeline/index.php) with Architecture pinned instead of the Pipeline, so every dev address runs ONE
 * copy of the code on ONE database (pipeline_dev) and shares one sign-in. <base href> points at that install, which
 * is where every script, stylesheet and api/ request goes. Same arrangement as ../responsible-ai-governance/.
 *
 * The door's folder is `architecture`, the program's catalogue slug is `ai-ready-architecture` and its id is
 * `ai-architecture`; $DEV_DOORS in the install's index.php maps the slug to this folder.
 *
 * The browser-only review build that was delivered here is now ../architecture-prototype/.
 */
declare(strict_types=1);

const DEV_DOOR_PIN = ['role' => 'enterprises', 'module' => 'ai-ready-architecture'];

require dirname(__DIR__) . '/innovation-pipeline/index.php';
