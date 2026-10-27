<?php
/**
 * What one member of an organization is NOT allowed to receive from another's
 * work, even though the whole program lives in a single shared document.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * The workspace is one JSON document per organization per module, and every
 * member reads it whole (WorkspaceController::show). That is right for the
 * program itself — it is shared team work — but two things inside it are not
 * shared, and were being handed to everybody anyway:
 *
 *   1. Executive Readiness's individual track. Steps 1.4, 2.4, 3.5 and 4.4 are
 *      the "Leadership Development" strand: one leader's own reflections,
 *      written to data.<section>[leaderId]. The app only ever SHOWS you your
 *      own (myIndivRead in js/modules/exec-readiness/steps.js), so the screens
 *      looked private — but every other leader's answers were sitting in the
 *      same payload, one console line away.
 *
 *   2. Roster PINs. data.roster[].passcode is a member's sign-in credential in
 *      the clear. The database has only a bcrypt hash (Models\User), so the
 *      document was the one place the actual PIN existed — and it went to every
 *      member of the team.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────
 * `mindsetDepth` (step 2.4's philosophical reflections) is NOT private. Step
 * 3.4, Values Architecture, reads it across ALL leaders on purpose: the team
 * reads each other's views and synthesizes them into shared principles. It is
 * shown in the app, so it is not a leak.
 *
 * `indivDone` and `practiceLog` are not private either. They are completion
 * flags and timestamps, and the L&D Hub's Study Completion and Monthly Reviews
 * grids are built from them for the whole team — again, on screen by design.
 *
 * ── THE SHAPE ────────────────────────────────────────────────────────────
 *   byLeader   Top-level document sections that are objects keyed by LEADER id
 *              (data.leaders[].id). A member receives only the entry belonging
 *              to the leader their account is linked to, and may write only
 *              that entry; everyone else's is preserved from what is stored.
 *
 * A module with no entry here is unfiltered, which is the honest default: the
 * Pipeline has no individual track and nothing in its document is one person's
 * private work.
 *
 * Roster credentials are stripped for EVERY module, not per-module, so a
 * program added later cannot forget to ask. See Core\DocPrivacy.
 */
return [
    'exec-readiness' => [
        'byLeader' => [
            'mindsetStudy',   // 1.4 Mindset Foundations — reading notes, self-audit
            'mindsetApp',     // 3.5 Mindset Application — fears, hopes, commitments
            'composure',      // 4.4 Composure & Resilience — constants, slow-thinking log
        ],
    ],
];
