<?php
/**
 * modules.php — the server's view of the role/module catalogue.
 *
 * It does not define anything. It reads ../../config/catalogue.json — the same
 * file index.php routes with and the browser gets injected — so the API can
 * never disagree with the app about which modules exist or which role owns
 * one. Adding a module is a catalogue edit and nothing else; the old
 * WorkspaceController::MODULES constant, which had to be remembered
 * separately, is gone.
 *
 * Returns:
 *   [
 *     'default'  => 'pipeline',
 *     'roles'    => ['enterprise' => ['pipeline', ...], 'leader' => [...]],
 *     'modules'  => ['pipeline' => 'enterprise', ...],   // module id → role key
 *   ]
 */

$file = dirname(__DIR__, 2) . '/config/catalogue.json';
$raw  = is_file($file) ? (string) file_get_contents($file) : '';
$data = json_decode($raw, true);

$roles   = [];
$modules = [];

foreach (($data['roles'] ?? []) as $role) {
    $key = (string) ($role['key'] ?? '');
    if ($key === '') {
        continue;
    }
    $roles[$key] = [];
    foreach (($role['modules'] ?? []) as $module) {
        $id = (string) ($module['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $roles[$key][]  = $id;
        $modules[$id]   = $key;
    }
}

return [
    /* What a request means when it names no module. Every caller written before
       modules existed omits it, and every one of them meant the Pipeline. */
    'default' => (string) ($data['defaults']['module'] ?? 'pipeline'),
    'roles'   => $roles,
    'modules' => $modules,
];
