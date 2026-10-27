<?php
/**
 * The question map — the guided questions each pipeline step asks.
 *
 * WHAT THIS IS FOR
 * The workspace is stored as one JSON document (Models\Workspace). This map is
 * what lets the server also write a readable, queryable Q&A trail: on every save
 * Core\AnswerProjector walks this map over the document and upserts one row per
 * answered question into `step_answers`, tagged with its phase and step. That is
 * what makes "show me Phase 1's answers" a SQL query instead of a JSON parse.
 *
 * SHAPE
 *   phase   int     1-5, matching the PH array in js/app.js
 *   step    string  step id as the app knows it ('1.1', '4.2', ...)
 *   section string  the sub-section within the step, as titled in the UI
 *   path    string  dot-path into the workspace document ('purpose.mission')
 *   text    string  the question as the user is asked it, for reading back
 *
 * SCOPE — scalar answers only
 * Only fixed, single-answer fields belong here: one path, one answer. Repeating
 * collections (ideas[], projects{}, budgetPlans{}, portfolio{}, raci{}, ...) are
 * NOT questions — they are records with their own shape, they live in the
 * document, and flattening them into one `answer` column would lose that shape.
 * Lists of plain strings (rhythm.attendees, incentives.metrics) ARE included:
 * they are one answer that happens to have several parts, and the projector
 * renders them as a comma-separated line.
 *
 * ADDING A QUESTION
 * Add a row here. Nothing else changes — no schema change, no projector change.
 * The path must match the app's write path exactly (see fldSave() in js/app.js
 * and its prefix map: p→purpose, k→knowledge, ow→ownership, inc→incentives,
 * rh→rhythm, cap→capital, gov→governance, str→stress). A typo silently yields
 * no row, so check the field's id in the step's renderer.
 *
 * DELIBERATELY ABSENT
 *   capital.reallocation, capital.gapPlan, capital.budgeted, rhythm.agenda
 *     Written by legacy flush helpers but no input renders them any more
 *     (funding moved to capital.fundLines[], agenda to rhythm.agendaList[]).
 *     They can only ever be empty; recording them would imply a question the
 *     app no longer asks.
 *   capital.killNotes, capital.killCosts
 *     Legacy-only: render only when an old value is already present.
 */

return [

    /* ── Phase 1 · Diagnose ─────────────────────────────────────────── */

    // Step 1.1 §Purpose — data.purpose, written via fldSave prefix 'p'.
    ['phase' => 1, 'step' => '1.1', 'section' => 'Purpose', 'path' => 'purpose.mission',     'text' => 'Mission'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Purpose', 'path' => 'purpose.values',      'text' => 'Values'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Purpose', 'path' => 'purpose.shortTerm',   'text' => 'Short-term targets'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Purpose', 'path' => 'purpose.mediumTerm',  'text' => 'Medium-term targets'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Purpose', 'path' => 'purpose.longTerm',    'text' => 'Long-term targets'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Purpose', 'path' => 'purpose.goals',       'text' => 'Key goals'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Purpose', 'path' => 'purpose.frictions',   'text' => 'Friction points'],

    // Step 1.1 §AI Knowledge — data.knowledge. `awareness` is a 1-5 likert.
    ['phase' => 1, 'step' => '1.1', 'section' => 'AI Knowledge', 'path' => 'knowledge.usage',     'text' => 'Current usage of AI'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'AI Knowledge', 'path' => 'knowledge.awareness', 'text' => 'Leadership awareness (1 unaware – 5 very aware)'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'AI Knowledge', 'path' => 'knowledge.resources', 'text' => 'Technical resources'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'AI Knowledge', 'path' => 'knowledge.learning',  'text' => 'Learning processes'],

    // Step 1.1 §Risk & Culture — data.culture, all 1-5 likerts via likSet().
    ['phase' => 1, 'step' => '1.1', 'section' => 'Risk & Culture', 'path' => 'culture.uncertainty',  'text' => 'Uncertainty (1 uncomfortable – 5 comfortable)'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Risk & Culture', 'path' => 'culture.aiLegitimacy', 'text' => 'AI legitimacy (1 stigma – 5 accepted)'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Risk & Culture', 'path' => 'culture.newProposals', 'text' => 'New proposals (1 shut down – 5 supported)'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Risk & Culture', 'path' => 'culture.incentives',   'text' => 'Incentives (1 punish – 5 reward)'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Risk & Culture', 'path' => 'culture.frontline',    'text' => 'Frontline involvement (1 none – 5 strong)'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Risk & Culture', 'path' => 'culture.overall',      'text' => 'Overall (1 stagnant – 5 innovative)'],

    // Step 1.1 §Decision Rights — data.decisions, fixed keys q1-q5, each {who, gap}.
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q1.who', 'text' => 'Who approves experiments?'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q1.gap', 'text' => 'Who approves experiments? — gaps'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q2.who', 'text' => 'Who advances projects?'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q2.gap', 'text' => 'Who advances projects? — gaps'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q3.who', 'text' => 'Who reallocates budget?'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q3.gap', 'text' => 'Who reallocates budget? — gaps'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q4.who', 'text' => 'Who kills projects?'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q4.gap', 'text' => 'Who kills projects? — gaps'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q5.who', 'text' => 'Who allocates cross-functional resources?'],
    ['phase' => 1, 'step' => '1.1', 'section' => 'Decision Rights', 'path' => 'decisions.q5.gap', 'text' => 'Who allocates cross-functional resources? — gaps'],

    /* ── Phase 2 · Organize ─────────────────────────────────────────── */

    // Step 2.1 — data.ownership. leads[]/seniors[] are collections, not here.
    ['phase' => 2, 'step' => '2.1', 'section' => 'Pipeline Owner', 'path' => 'ownership.ownerName', 'text' => 'Pipeline owner — name'],
    ['phase' => 2, 'step' => '2.1', 'section' => 'Pipeline Owner', 'path' => 'ownership.ownerRole', 'text' => 'Pipeline owner — role'],
    ['phase' => 2, 'step' => '2.1', 'section' => 'Pipeline Owner', 'path' => 'ownership.authority', 'text' => 'Pipeline owner — authority'],

    // Step 2.2 — data.incentives. `metrics` is a list of chosen metric names.
    ['phase' => 2, 'step' => '2.2', 'section' => '', 'path' => 'incentives.current', 'text' => 'Current incentive structure'],
    ['phase' => 2, 'step' => '2.2', 'section' => '', 'path' => 'incentives.changes', 'text' => 'Proposed incentive changes'],
    ['phase' => 2, 'step' => '2.2', 'section' => '', 'path' => 'incentives.metrics', 'text' => 'Metrics to track'],

    // Step 2.3 — data.rhythm. attendees/agendaList are string lists.
    ['phase' => 2, 'step' => '2.3', 'section' => '', 'path' => 'rhythm.day',        'text' => 'Weekly session — day'],
    ['phase' => 2, 'step' => '2.3', 'section' => '', 'path' => 'rhythm.time',       'text' => 'Weekly session — time'],
    ['phase' => 2, 'step' => '2.3', 'section' => '', 'path' => 'rhythm.attendees',  'text' => 'Weekly session — attendees'],
    ['phase' => 2, 'step' => '2.3', 'section' => '', 'path' => 'rhythm.agendaList', 'text' => 'Weekly session — agenda'],

    /* ── Phase 3 · Prepare ──────────────────────────────────────────── */

    // Step 3.2 — data.capital. Year 2-5 budgets render only up to envYears.
    ['phase' => 3, 'step' => '3.2', 'section' => 'Planning',        'path' => 'capital.periodStart', 'text' => 'Planning period begins'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Planning',        'path' => 'capital.envYears',    'text' => 'Planning period length (years)'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Capacity Plan',   'path' => 'capital.aiBudget',    'text' => 'Year 1 budget'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Capacity Plan',   'path' => 'capital.budgetY2',    'text' => 'Year 2 budget'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Capacity Plan',   'path' => 'capital.budgetY3',    'text' => 'Year 3 budget'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Capacity Plan',   'path' => 'capital.budgetY4',    'text' => 'Year 4 budget'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Capacity Plan',   'path' => 'capital.budgetY5',    'text' => 'Year 5 budget'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Intake Reserve',  'path' => 'capital.reserveY1',   'text' => 'Year 1 intake reserve'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Intake Reserve',  'path' => 'capital.reserveY2',   'text' => 'Year 2 intake reserve'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Intake Reserve',  'path' => 'capital.reserveY3',   'text' => 'Year 3 intake reserve'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Intake Reserve',  'path' => 'capital.reserveY4',   'text' => 'Year 4 intake reserve'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Intake Reserve',  'path' => 'capital.reserveY5',   'text' => 'Year 5 intake reserve'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Sustainment Cap', 'path' => 'capital.susCap',      'text' => 'Max % of a year\'s budget spendable on running costs'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Sustainment Cap', 'path' => 'capital.susCapY1',    'text' => 'Sustainment cap override — Year 1'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Sustainment Cap', 'path' => 'capital.susCapY2',    'text' => 'Sustainment cap override — Year 2'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Sustainment Cap', 'path' => 'capital.susCapY3',    'text' => 'Sustainment cap override — Year 3'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Sustainment Cap', 'path' => 'capital.susCapY4',    'text' => 'Sustainment cap override — Year 4'],
    ['phase' => 3, 'step' => '3.2', 'section' => 'Sustainment Cap', 'path' => 'capital.susCapY5',    'text' => 'Sustainment cap override — Year 5'],

    /* ── Phase 4 · Ignite ───────────────────────────────────────────── */

    // Step 4.2 — data.governance.
    ['phase' => 4, 'step' => '4.2', 'section' => 'Standing Leadership Agenda', 'path' => 'governance.meeting',         'text' => 'Meeting to embed the pipeline in'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Standing Leadership Agenda', 'path' => 'governance.metrics',         'text' => 'Metrics to review'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Standing Leadership Agenda', 'path' => 'governance.format',          'text' => 'Format'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Pipeline Intake Rule',       'path' => 'governance.threshold',       'text' => 'Investment threshold'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Pipeline Intake Rule',       'path' => 'governance.gateProcess',     'text' => 'Gate review process'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Pipeline Intake Rule',       'path' => 'governance.outsideAudit',    'text' => 'Outside-pipeline audit'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Quarterly Portfolio Review', 'path' => 'governance.reviewAttendees', 'text' => 'Review attendees'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Quarterly Portfolio Review', 'path' => 'governance.reviewAgenda',    'text' => 'Review agenda'],
    ['phase' => 4, 'step' => '4.2', 'section' => 'Quarterly Portfolio Review', 'path' => 'governance.firstReview',     'text' => 'First review date'],

    // Step 4.3 — data.stress. Each question is a 1-5 score PLUS a details
    // textarea; the UI labels the textarea only "Details", so the question text
    // is repeated here to keep each row readable on its own.
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.decisionsScore',  'text' => 'Are decision rights working in practice? (1 not at all – 5 fully)'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.decisions',       'text' => 'Are decision rights working in practice? — details'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.ownershipScore',  'text' => 'Is the ownership model delivering? (1 not at all – 5 fully)'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.ownership',       'text' => 'Is the ownership model delivering? — details'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.incentivesScore', 'text' => 'Are incentive changes shifting behavior? (1 not at all – 5 fully)'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.incentives',      'text' => 'Are incentive changes shifting behavior? — details'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.cultureScore',    'text' => 'Is culture shifting, or are old defaults reasserting? (1 not at all – 5 fully)'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.culture',         'text' => 'Is culture shifting, or are old defaults reasserting? — details'],
    ['phase' => 4, 'step' => '4.3', 'section' => '', 'path' => 'stress.tuningList',      'text' => 'What needs tuning? Top priorities for adjustment'],

    // Step 4.4 — data.review. review.items{} (per-project buy/hold/sell) is a
    // collection and stays in the document.
    ['phase' => 4, 'step' => '4.4', 'section' => 'Portfolio Learnings', 'path' => 'review.newOpportunities', 'text' => 'New opportunities'],
    ['phase' => 4, 'step' => '4.4', 'section' => 'Portfolio Learnings', 'path' => 'review.balance',          'text' => 'Balance assessment'],
    ['phase' => 4, 'step' => '4.4', 'section' => 'Portfolio Learnings', 'path' => 'review.worked',           'text' => 'What worked?'],
    ['phase' => 4, 'step' => '4.4', 'section' => 'Portfolio Learnings', 'path' => 'review.didnt',            'text' => 'What didn\'t?'],
    ['phase' => 4, 'step' => '4.4', 'section' => 'Portfolio Learnings', 'path' => 'review.nextCycle',        'text' => 'Changes for next cycle?'],
    ['phase' => 4, 'step' => '4.4', 'section' => 'Review Cadence',      'path' => 'capital.fyStartMonth',    'text' => 'Fiscal year begins (month) — aligns future reviews'],
];
