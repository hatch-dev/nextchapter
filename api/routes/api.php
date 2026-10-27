<?php
/**
 * API route definitions.
 *
 * This is the ONE place you touch to add an endpoint. Map an HTTP method + path
 * to a [Controller::class, 'method'] pair. New modules slot in here without any
 * change to the router, front controller, or existing endpoints.
 *
 * @var \Core\Router $router  (provided by index.php)
 */

use Controllers\AccessController;
use Controllers\AdminController;
use Controllers\AssignmentController;
use Controllers\AuthController;
use Controllers\ClaudeController;
use Controllers\MessageController;
use Controllers\NoteController;
use Controllers\NotifyController;
use Controllers\OrganizationController;
use Controllers\SeedController;
use Controllers\SetupController;
use Controllers\UserController;
use Controllers\WorkspaceController;

// Organization + first-user setup form.
$router->post('/setup', [SetupController::class, 'create']);

// Sign-in with a username and a password; the browser's session (Directive 2 Oct 2026, Part 6.2).
$router->post('/session',  [AuthController::class, 'login']);
$router->get('/session',   [AuthController::class, 'current']);
$router->post('/sign-out', [AuthController::class, 'signOut']);
$router->post('/password', [AuthController::class, 'changePassword']);

// The app administrator: sign-in, password, username; and a member's temporary password (6.2).
$router->get('/admin-session',               [AdminController::class, 'status']);
$router->post('/admin-session',              [AdminController::class, 'login']);
$router->post('/admin/password',             [AdminController::class, 'changePassword']);
$router->post('/admin/username',             [AdminController::class, 'changeUsername']);
$router->post('/admin/temporary-password',   [AdminController::class, 'temporaryPassword']);

// Application access: which programs an organization holds, and which of those
// each of its members may open. The two are set by different authorities — the
// Super Admin owns the organization's plan, the Org Admin owns who inside it
// gets what — so they are two endpoints rather than one. See AccessController.
$router->get('/access',       [AccessController::class, 'show']);
$router->post('/access/org',  [AccessController::class, 'setOrg']);
$router->post('/access/user', [AccessController::class, 'setUser']);

// The invite outbox — every access email the app has tried to send, and whether
// it went. Super Admin only: these messages carry credentials.
$router->get('/access/mail', [AccessController::class, 'mail']);

// Team members within an organization (add / edit / remove).
$router->post('/users',        [UserController::class, 'create']);
$router->post('/users/update', [UserController::class, 'update']);
$router->post('/users/delete', [UserController::class, 'delete']);

// Organizations: full list (admin console), members, details, delete.
$router->get('/organizations',         [OrganizationController::class, 'index']);
$router->get('/organizations/members', [OrganizationController::class, 'members']);
$router->post('/organizations/update', [OrganizationController::class, 'update']);
$router->post('/organizations/delete', [OrganizationController::class, 'delete']);
// Reset an organization's data — the Pipeline's work, every member but the administrators (Directive 2 Oct 2026, Part 4). Admin console only.
$router->post('/organizations/reset', [OrganizationController::class, 'reset']);

// The organization's workspace: the 90-day program's whole working state
// (every phase's answers, ideas, portfolio, capital, progress) as one document,
// plus the readable per-phase Q&A projected out of it.
$router->get('/workspace',         [WorkspaceController::class, 'show']);
$router->post('/workspace',        [WorkspaceController::class, 'save']);
$router->get('/workspace/rev',     [WorkspaceController::class, 'rev']);
$router->get('/workspace/answers', [WorkspaceController::class, 'answers']);
// Who changed what, and when. See api/sql/workspace-history.sql.
$router->get('/workspace/history', [WorkspaceController::class, 'history']);

// Write only the sections that changed. The whole-document POST above stays —
// it is the fallback, and what a first save uses — but the app's ordinary write
// path is this one: a member who edits the capital plan sends the capital plan,
// and cannot put an older copy of anybody else's section back on the way past.
$router->post('/workspace/patch', [WorkspaceController::class, 'patch']);

// Section locks: who is editing what, right now. The client has had the lock
// behaviour since July (Collab, js/app.js) but kept the locks in localStorage,
// so they were never shared between people. See api/sql/workspace-locks.sql.
$router->get('/workspace/locks',          [WorkspaceController::class, 'locks']);
$router->post('/workspace/locks/claim',   [WorkspaceController::class, 'claimLocks']);
$router->post('/workspace/locks/release', [WorkspaceController::class, 'releaseLocks']);

// Team chat messages.
$router->get('/messages',  [MessageController::class, 'index']);
$router->post('/messages', [MessageController::class, 'store']);
$router->get('/chat/ticket', [MessageController::class, 'ticket']);   // admission to the live relay (6.1.4)

// Private per-user notes.
$router->get('/notes',         [NoteController::class, 'index']);
$router->post('/notes',        [NoteController::class, 'store']);
$router->post('/notes/delete', [NoteController::class, 'delete']);

// Pipeline step assignments (assign / unassign members to steps).
$router->get('/assignments',  [AssignmentController::class, 'index']);
$router->post('/assignments', [AssignmentController::class, 'set']);

// Sample-data seed: mirror the demo team + assignments into the normalized
// tables (the workspace document itself already persists through /workspace).
$router->post('/seed', [SeedController::class, 'sync']);

// The AI Guide, and every other AI feature in every program. The browser
// cannot call Anthropic directly — no CORS, and the key would have to ship
// with the page — so it calls this instead and the server holds the key.
// Unlike every other endpoint here, the success body is the Messages API's
// own shape rather than the house envelope; ClaudeController explains why.
$router->post('/claude', [ClaudeController::class, 'messages']);

// Email notifications. js/features/email.js POSTs the eight fields of the
// 3 Sep 2026 directive here when a step is completed or a deadline is a week
// out. See Controllers\NotifyController for the contract and for why the
// recipient list is checked against the roster rather than trusted.
//
// One route per module, because the program is named in the PATH (Part 3,
// point 3) and this router matches paths exactly — it has no wildcards. Read
// from the catalogue rather than listed, so a module that goes live gets its
// route without anyone remembering this file.
foreach (array_keys((array) config('modules.modules')) as $moduleId) {
    $router->post('/notify/' . $moduleId, [NotifyController::class, 'store']);
}
// The bare path, for a caller that names no module.
$router->post('/notify', [NotifyController::class, 'store']);

// --- add future endpoints below ---------------------------------------
