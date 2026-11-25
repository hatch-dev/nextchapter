<?php
/**
 * Which step a part of the workspace belongs to: program => section => the steps it may be edited from (P-17 part 2, 25 Nov 2026).
 *
 * A step is edited by the people assigned to it and by administrators; with nobody assigned, by administrators (ruled
 * 11 Sep 2026). The screens have always said so. For the sections named here the server says it too (Core\DocPrivacy).
 *
 * ONLY sections that belong to their steps alone are named. What several steps share, or a hub, a portfolio page or a
 * report edits as well (ideas, projects, capital, budgets, reviews...), is left to the screens: refusing here what a
 * screen allows would lose somebody's work. A program not listed is not judged. tests/e2e/member-limits.spec.js has a
 * member edit each of these from its step; add to both together.
 */
return [
    'pipeline' => [
        'purpose'           => ['1.1'],
        'knowledge'         => ['1.1'],
        'culture'           => ['1.1'],
        'decisions'         => ['1.1'],
        'audit'             => ['1.1', '3.2'],
        'completedSections' => ['1.1'],
        'assessments'       => ['1.2', '1.3', '2.4'],
        'ownership'         => ['2.1'],
        'raci'              => ['2.1'],
        'incentives'        => ['2.2'],
        'rhythm'            => ['2.3'],
        'governance'        => ['4.2'],
        'stress'            => ['4.3'],
    ],
];
