<?php
/**
 * One-time (6 Oct 2026): the AI Guide and Voice stay ON for every AI Innovation Pipeline organization
 * that existed before Part 2 of the 2 Oct 2026 directive went live.
 *
 * Part 2 made both switches "off by default". That is right for a NEW organization (emptyData() still
 * starts them off), but on live it also switched them off for every existing organization, which had
 * both until that day. The user ruled (6 Oct 2026) that existing organizations keep what they had.
 *
 * Writes through Models\Workspace::save — a new revision, so open browsers merge it on their next poll
 * and the change appears in the workspace history. Touches only `settings` in the Pipeline document.
 *
 *   php tools/keep-ai-features-on.php            dry run: lists what would change
 *   php tools/keep-ai-features-on.php --apply    writes it
 *   DB_NAME=pipeline_test php tools/...          against another database (the env var beats api/.env)
 *   ... --module=exec-readiness                  Executive Readiness (7 Oct 2026: its own directive of the same date;
 *                                                the user ruled its existing organizations keep both on too)
 *   ... --module=ai-governance                   Responsible AI Governance (7 Oct 2026: the same ruling, for its two existing organizations)
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$api = dirname(__DIR__) . '/api';
require $api . '/helpers/functions.php';
spl_autoload_register(static function (string $class) use ($api): void {
    foreach (['Core\\' => '/core/', 'Models\\' => '/models/'] as $prefix => $dir) {
        if (strncmp($class, $prefix, strlen($prefix)) === 0) {
            $file = $api . $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) require $file;
            return;
        }
    }
});

$apply = in_array('--apply', $argv, true);
$module = 'pipeline';
foreach ($argv as $a) if (strncmp($a, '--module=', 9) === 0) $module = substr($a, 9);
if (!in_array($module, ['pipeline', 'exec-readiness', 'ai-governance'], true)) { fwrite(STDERR, "unknown module: {$module}\n"); exit(1); }
echo "module: {$module}\n";
$db = Core\Database::connection();
$rows = $db->prepare("SELECT w.organization_id, w.rev, w.schema_version, w.doc, o.name
                      FROM workspaces w JOIN organizations o ON o.id = w.organization_id
                     WHERE w.module = ? ORDER BY o.name");
$rows->execute([$module]);
$rows = $rows->fetchAll(PDO::FETCH_ASSOC);

$model = new Models\Workspace();
$changed = 0;
foreach ($rows as $r) {
    $doc = json_decode((string) $r['doc']);
    if (!is_object($doc)) { echo "  skip  {$r['name']}: the document does not decode\n"; continue; }
    $was = isset($doc->settings) ? json_encode($doc->settings) : 'none';
    $on = isset($doc->settings) && is_object($doc->settings) && !empty($doc->settings->aiGuide) && !empty($doc->settings->voice);
    if ($on) { echo "  keep  {$r['name']}: already on\n"; continue; }
    if (!isset($doc->settings) || !is_object($doc->settings)) $doc->settings = new stdClass();
    $doc->settings->aiGuide = true;
    $doc->settings->voice = true;
    echo ($apply ? '  set   ' : '  would set ') . "{$r['name']}: {$was} -> " . json_encode($doc->settings) . "\n";
    if ($apply) {
        $rev = $model->save((int) $r['organization_id'], (string) json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (int) $r['rev'], null, (int) $r['schema_version'], $module);
        if ($rev === null) { echo "        someone saved at the same moment: run it again\n"; continue; }
        echo "        rev {$r['rev']} -> {$rev}\n";
    }
    $changed++;
}
echo ($apply ? "Done: {$changed} changed.\n" : "Dry run: {$changed} would change. Add --apply to write.\n");
