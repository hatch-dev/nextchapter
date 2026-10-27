<?php
/**
 * DEV COPY, SECOND DOOR (16 Oct 2026) — /apps/enterprises/dev/executive-readiness IS Executive Readiness.
 *
 * Nothing else lives in this folder. The page is rendered by the dev install next door
 * (../innovation-pipeline/index.php) with Executive Readiness pinned instead of the Pipeline, so both dev
 * addresses run ONE copy of the code on ONE database (pipeline_dev) and share one sign-in. <base href> points
 * at that install, which is where every script, stylesheet and api/ request goes.
 *
 * The browser-only review build that used to sit here is now ../executive-readiness-prototype/.
 */
declare(strict_types=1);

const DEV_DOOR_PIN = ['role' => 'enterprises', 'module' => 'executive-readiness'];

require dirname(__DIR__) . '/innovation-pipeline/index.php';
