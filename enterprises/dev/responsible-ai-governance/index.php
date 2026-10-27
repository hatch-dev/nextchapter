<?php
/**
 * DEV COPY, THIRD DOOR (16 Oct 2026) — /apps/enterprises/dev/responsible-ai-governance IS Responsible AI Governance.
 *
 * Nothing else lives in this folder. The page is rendered by the dev install next door
 * (../innovation-pipeline/index.php) with Governance pinned instead of the Pipeline, so every dev address runs ONE
 * copy of the code on ONE database (pipeline_dev) and shares one sign-in. <base href> points at that install, which
 * is where every script, stylesheet and api/ request goes. Same arrangement as ../executive-readiness/.
 *
 * The browser-only review build that used to sit here is now ../responsible-ai-governance-prototype/.
 */
declare(strict_types=1);

const DEV_DOOR_PIN = ['role' => 'enterprises', 'module' => 'responsible-ai-governance'];

require dirname(__DIR__) . '/innovation-pipeline/index.php';
