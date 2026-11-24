<?php
/*
 * mail-retry-check.php — a message sent again does not promise a PDF it does not carry (P-20, 24 Nov 2026).
 *
 *   php tools/mail-retry-check.php
 *
 * A retry sends the stored copy, without the PDF. Builds a step-complete message the way the service does, then takes
 * the attachment out of it the way the retry does. Sends nothing and touches no database.
 */
declare(strict_types=1);

$root = dirname(__DIR__);
require $root . '/api/helpers/functions.php';
foreach (['Pdf', 'Catalogue', 'ReportDocument', 'ReportMail', 'ReportPdf'] as $c) require $root . '/api/core/' . $c . '.php';

$failed = 0;
$check = static function (string $what, bool $ok) use (&$failed): void { echo ($ok ? 'ok    ' : 'FAIL  ') . $what . PHP_EOL; if (!$ok) $failed++; };

$app = '<h2>Step 1.2 – Brainstorm Use Cases complete – analytics report</h2><p>Step 1.2 – Brainstorm Use Cases was marked complete on Nov 24, 2026. The current Module Management analytics report is attached.</p><hr/>'
     . '<div><h1>Module <em>Management</em></h1><p>Every step of the module in one place.</p><div class="card"><h3>90-Day Burn-up</h3><p>Cumulative step completion.</p></div></div>';
$doc  = Core\ReportDocument::parse($app);
$check('the message can be read', $doc !== null);
$opts = ['eyebrow' => 'Org · AI Innovation Pipeline', 'attachment' => 'pipeline-Module-Management-analytics-2026-11-24.pdf', 'note' => ''];
foreach (['html' => Core\ReportMail::html($doc, $opts), 'text' => Core\ReportMail::text($doc, $opts)] as $form => $sent) {
    $check($form . ': the first copy says it is attached', (bool) preg_match('/attached/i', $sent));
    $again = Core\ReportMail::withoutAttachment($sent);
    $check($form . ': the retried copy promises none', !preg_match('/attached|\\.pdf/i', $again));
    $check($form . ': and says where to find it', str_contains($again, 'Track Program'));
    $check($form . ': the report itself is still there', str_contains($again, 'was marked complete on Nov 24, 2026') && mb_strlen($again) > mb_strlen($sent) * 0.8);
    $check($form . ': a second retry changes nothing more', Core\ReportMail::withoutAttachment($again) === $again);
}
$plain = Core\ReportMail::html($doc, ['eyebrow' => 'x', 'attachment' => '', 'note' => '']);
$check('a message that never had one keeps its words, apart from the app\'s own sentence', !str_contains(Core\ReportMail::withoutAttachment($plain), 'is attached.'));
echo $failed === 0 ? "all passed\n" : "$failed failed\n";
exit($failed === 0 ? 0 : 1);
