<?php
/* ─────────────────────────────────────────────────────────────
   notify-report-check.php — does the completion email survive an inbox,
   and does the PDF actually attach?
   ─────────────────────────────────────────────────────────────
   The notification service sends the Module Management analytics report two
   ways at once: rebuilt as mail-safe HTML in the body (Core\ReportMail), and
   drawn onto A4 as an attachment (Core\ReportPdf). Both are built by reading
   the app's own on-screen markup (Core\ReportDocument), which is markup the
   app is free to change — so this is the check that says whether the reading
   still works.

   It runs the whole path short of SMTP and the database: parse, render, build
   the MIME message, then take the message apart again and confirm the file
   that comes out is the file that went in.

     php tools/notify-report-check.php           run the checks
     php tools/notify-report-check.php --write   also save what it rendered,
                                                 into tools/_notify-out/, so
                                                 the mail and the PDF can be
                                                 opened and looked at

   Bodies come from tools/_notify-out/ when the sink has captured any — those
   are real ones, posted by the app — and from a small built-in sample when it
   has not, so this runs on a fresh checkout.

   Nothing here ships to a browser. It is a test, and deleting it changes
   nothing that runs.
   ───────────────────────────────────────────────────────────── */

$root = dirname(__DIR__);
require $root . '/api/helpers/functions.php';
foreach (['Pdf', 'Catalogue', 'ReportDocument', 'ReportMail', 'ReportPdf', 'Mailer'] as $class) {
    require $root . '/api/core/' . $class . '.php';
}
/* The endpoint itself, for the composition check at the end. Its base class is
   all it needs to load — the models and Core\Response it imports are only
   touched on the paths that talk to the database, and compose() is not one. */
require $root . '/api/core/Controller.php';
require $root . '/api/controllers/NotifyController.php';

use Core\Mailer;
use Core\ReportDocument;
use Core\ReportMail;
use Core\ReportPdf;

$write = in_array('--write', $argv, true);
$out   = $root . '/tools/_notify-out';
$pass  = 0;
$fail  = 0;

function ok(bool $cond, string $what): void
{
    global $pass, $fail;
    if ($cond) {
        $pass++;
        echo "  \u{2713} $what\n";
        return;
    }
    $fail++;
    echo "  \u{2717} $what\n";
}

function section(string $title): void
{
    echo "\n" . $title . "\n" . str_repeat('─', mb_strlen($title)) . "\n";
}

/** The body out of a capture the sink wrote, which wraps the fragment in a page. */
function fragment(string $file): string
{
    $page = (string) file_get_contents($file);
    $at   = strpos($page, '<div class="content-inner"');
    if ($at === false) {
        return $page;
    }
    $frag = substr($page, (int) strpos($page, '>', $at) + 1);
    return substr($frag, 0, (int) strrpos($frag, '</div>'));
}

/**
 * A completion body in miniature, for a checkout with no captures: one of each
 * thing the report is made of, written the way js/pages/navigate.js writes it.
 */
function sampleBody(): string
{
    $svg = '<svg viewBox="0 0 560 170" style="width:100%;display:block">'
        . '<rect x="29" y="20" width="34" height="122" rx="4" fill="rgba(245,242,236,.03)"/>'
        . '<text x="46" y="158" text-anchor="middle" font-size="8.5" fill="#8A8278">W1</text>'
        . '<rect x="69" y="20" width="34" height="122" rx="4" fill="rgba(245,242,236,.03)"/>'
        . '<rect x="69" y="81" width="34" height="61" rx="4" fill="#4FB39A" fill-opacity=".85">'
        . '<title>Week 2: 1 step</title></rect>'
        . '<text x="86" y="77" text-anchor="middle" font-size="10" font-weight="700" fill="#F5F2EC">1</text>'
        . '<text x="86" y="158" text-anchor="middle" font-size="8.5" fill="#8A8278">W2</text></svg>';

    $burnup = '<svg viewBox="0 0 560 190" style="width:100%;display:block">'
        . '<line x1="40" y1="156" x2="544" y2="156" stroke="rgba(245,242,236,.08)"/>'
        . '<line x1="40" y1="156" x2="544" y2="12" stroke="#8A8278" stroke-dasharray="4 4" stroke-opacity=".6">'
        . '<title>Ideal pace: all 4 steps by day 90</title></line>'
        . '<path d="M40.0 156.0 L120.0 156.0 L120.0 120.0" fill="none" stroke="#D4A017" stroke-width="2"/>'
        . '<circle cx="120" cy="120" r="4" fill="#D4A017"/>'
        . '<text x="120" y="112" text-anchor="middle" font-size="9" fill="#D4A017">TODAY · 1/4</text></svg>';

    $tile = fn(string $v, string $l): string => '<div style="text-align:center">'
        . '<div class="score-num-md" style="font-size:26px;line-height:1.2">' . $v . '</div>'
        . '<div class="t-faint-sm" style="margin-top:3px">' . $l . '</div></div>';

    return '<h2 style="font-family:Helvetica,Arial,sans-serif">Step 1.1 – Sample complete – analytics report</h2>'
        . '<p>Step 1.1 – Sample was marked complete on Sep 12, 2026. The current Module Management '
        . 'analytics report is attached.</p><hr/>'
        . '<div class="flx-between-top-mb"><div class="pdf-hd"><span class="bg bg-tinted" style="--c:#6B4C8A">Ongoing</span>'
        . '<h1 class="section-title">Module <em>Management</em></h1>'
        . '<p>Every step of the module in one place – who owns it, when it is due, and how completion is '
        . 'pacing against the 90 days.</p></div></div>'
        . '<div class="cd" style="margin-bottom:16px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'
        . $tile('1 / 4', 'steps complete') . $tile('Day 9', 'of the 90')
        . $tile('+0.6', 'steps vs ideal pace') . $tile('0', 'overdue') . '</div></div>'
        . '<div class="cd" style="margin-bottom:16px"><h3 class="h-sub-md">90-Day Burn-up</h3>'
        . '<p class="t-faint-sm">Cumulative step completion against the ideal pace.</p>' . $burnup
        . '<div class="t-faint-sm" style="text-align:center">▲ 0.6 steps ahead of the ideal pace</div></div>'
        . '<div class="cd" style="margin-bottom:16px"><h3 class="h-sub-md">Module Velocity</h3>'
        . '<p class="t-faint-sm">Steps completed per program week, from completion dates.</p>' . $svg . '</div>'
        . '<div class="cd" style="margin-bottom:16px"><h3 class="h-sub-md">Workload by Member</h3>'
        . '<p class="t-faint-sm">Open and completed step assignments.</p>'
        . '<div style="display:flex;align-items:center;gap:10px;padding:5px 0"><div style="width:26px">'
        . '<div class="user-av" style="width:24px;height:24px;background:#1B6B5A;color:#fff;font-size:8px">AR</div></div>'
        . '<div class="fs-13" style="width:140px">Arun Rao</div>'
        . '<div style="flex:1;height:12px;background:rgba(var(--fg-rgb),.05);border-radius:6px;overflow:hidden;display:flex">'
        . '<div style="width:50.0%;background:#D4A017"></div>'
        . '<div style="width:25.0%;background:#4FB39A;opacity:.45"></div></div>'
        . '<div class="t-faint-sm" style="width:130px;text-align:right">2 open · 1 complete</div></div></div>'
        . '<div class="cd" style="margin-bottom:16px"><h3 class="h-sub-md">Signals</h3>'
        . '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:center">'
        . '<div><div class="fs-14"><strong>4 of 4</strong></div><div class="t-faint-sm">steps with an owner</div></div>'
        . '<div><div class="fs-14"><strong>1 of 4</strong></div><div class="t-faint-sm">steps with a deadline</div></div>'
        . '<div><div class="fs-14"><strong>1 met · 0 missed</strong></div><div class="t-faint-sm">deadlines on completed steps</div></div>'
        . '</div><div style="margin-top:10px"><div class="row-line">'
        . '<span class="fs-13" style="flex:1;color:#1B6B5A">Phase 1 – Diagnose</span>'
        . '<span class="t-faint-sm">1 / 2 complete · median completion day 9</span></div></div></div>';
}

/* ── Pick a body ────────────────────────────────────────────── */

$captures = glob($out . '/*step-complete*.html') ?: [];
$body     = $captures !== [] ? fragment((string) end($captures)) : sampleBody();
$source   = $captures !== [] ? basename((string) end($captures)) : 'the built-in sample';

echo "Notification report check\nreading: $source\n";

/* ── 1. Reading the app's markup ────────────────────────────── */

section('the report is read');
$doc = ReportDocument::parse($body);
ok($doc !== null, 'the completion body parses');
if ($doc === null) {
    exit(1);
}
ok($doc->isAnalytics(), 'all four analytics cards are there — the Analytics tab, not Assignments');
ok($doc->subject() !== '' && $doc->lead() !== '', 'the completion notice is read off the top');
ok($doc->headline() !== [], 'the headline figures are found');

$charts = 0;
$walk = function (array $blocks) use (&$walk, &$charts): void {
    foreach ($blocks as $b) {
        if ($b['kind'] === 'chart') {
            $charts++;
        }
        if ($b['kind'] === 'card') {
            $walk($b['blocks']);
        }
    }
};
$walk($doc->blocks());
ok($charts >= 2, 'both charts are read as charts (' . $charts . ')');

/* ── 2. The mail body ───────────────────────────────────────── */

section('the body an inbox can show');
$name = ReportPdf::fileName($doc, 'ai-governance', date('Y-m-d'));
$html = ReportMail::html($doc, ['eyebrow' => 'Example Foundation · Responsible AI Governance', 'attachment' => $name]);
$text = ReportMail::text($doc, ['attachment' => $name]);

ok(strpos($html, '<svg') === false, 'carries no <svg> — every major client strips it');
ok(strpos($html, 'var(--') === false, 'carries no custom properties — nothing resolves them');
ok(strpos($html, 'class=') === false, 'carries no class names — the stylesheet is never loaded');
ok(strpos($html, 'display:grid') === false && strpos($html, 'display:flex') === false, 'no grid or flex — Outlook has neither');
ok(substr_count($html, '<table') >= 6, 'laid out as tables');
ok(strpos($html, $name) !== false, 'the attachment is named in the body');
foreach (['90-Day Burn-up', 'Module Velocity', 'Workload by Member', 'Signals'] as $card) {
    ok(strpos($html, $card) !== false, 'the ' . $card . ' card survives');
}
ok(preg_match('/bgcolor="#[0-9a-f]{6}"/i', $html) === 1, 'the charts are redrawn as coloured cells');
ok($text !== '' && strpos($text, $name) !== false, 'there is a plain-text alternative, naming the file');

/* ── 3. The PDF ─────────────────────────────────────────────── */

section('the attachment');
$pdf = ReportPdf::render($doc, [
    'eyebrow'   => 'Example Foundation · Responsible AI Governance',
    'generated' => 'Generated ' . date('j F Y'),
]);
ok(strncmp($pdf, '%PDF-1.', 7) === 0, 'is a PDF');
ok(strpos($pdf, '%%EOF') !== false, 'is terminated');
ok(preg_match('/\/Count (\d+)/', $pdf, $pages) === 1 && (int) $pages[1] >= 1, 'has pages (' . ($pages[1] ?? '?') . ')');
ok(str_ends_with($name, '.pdf') && preg_match('/[^A-Za-z0-9._-]/', $name) === 0, 'is named safely: ' . $name);
ok(strlen($pdf) < 400000, 'is small enough to mail (' . round(strlen($pdf) / 1024, 1) . ' KB)');

/* The cross-reference table is what a reader seeks with; an offset that is
   wrong by one byte is a file that will not open. */
$xrefOk = false;
if (preg_match('/startxref\s+(\d+)\s*%%EOF\s*$/s', $pdf, $m)) {
    $xrefOk = substr($pdf, (int) $m[1], 4) === 'xref';
    if ($xrefOk && preg_match('/^xref\s+\d+\s+(\d+)\s+/', substr($pdf, (int) $m[1], 64), $h)) {
        $table = substr($pdf, (int) $m[1] + strlen($h[0]), ((int) $h[1]) * 20);
        for ($i = 1; $i < (int) $h[1]; $i++) {
            $at = (int) substr($table, $i * 20, 10);
            if (!preg_match('/^' . $i . ' 0 obj/', substr($pdf, $at, 24))) {
                $xrefOk = false;
                break;
            }
        }
    }
}
ok($xrefOk, 'every object is where the cross-reference table says it is');

/* ── 4. The message ─────────────────────────────────────────── */

section('the message that carries it');
$build = new ReflectionMethod(Mailer::class, 'message');
$build->setAccessible(true);
$mime = $build->invoke(new Mailer(), 'lee@example.org', 'Lee', 'Subject line', $html, $text, [
    ['name' => $name, 'type' => 'application/pdf', 'data' => $pdf],
]);

ok(preg_match('/\r\nContent-Type: multipart\/mixed; boundary="([^"]+)"\r\n/', $mime, $mix) === 1, 'is multipart/mixed');
ok(preg_match('/Content-Type: multipart\/alternative; boundary="([^"]+)"/', $mime, $alt) === 1, 'with the two bodies nested inside it');
ok(isset($mix[1]) && substr_count($mime, '--' . $mix[1]) === 3, 'two mixed parts and a closing boundary');
ok(strpos($mime, 'Content-Disposition: attachment; filename="' . $name . '"') !== false, 'the PDF is dispositioned as an attachment');

$alternative = explode('--' . ($alt[1] ?? '@'), $mime);
ok(
    isset($alternative[2]) && strpos($alternative[1], 'text/plain') !== false && strpos($alternative[2], 'text/html') !== false,
    'text first and HTML second, so a client that can render HTML does'
);

$recovered = '';
foreach (explode('--' . ($mix[1] ?? '@'), $mime) as $part) {
    if (strpos($part, 'application/pdf') !== false) {
        $recovered = (string) base64_decode((string) preg_replace('/\s+/', '', substr($part, (int) strpos($part, "\r\n\r\n") + 4)));
    }
}
ok($recovered === $pdf, 'the attachment a client would decode is the PDF, byte for byte');

$none = $build->invoke(new Mailer(), 'lee@example.org', 'Lee', 'Subject', '<p>hi</p>', 'hi', []);
ok(strpos($none, 'multipart/mixed') === false, 'a message with nothing attached stays multipart/alternative');

/* ── 5. What must not break ─────────────────────────────────── */

section('the paths that must not break');
$reminders = glob($out . '/*deadline-reminder*.html') ?: [];
$reminder  = ReportDocument::parse(
    $reminders !== []
        ? fragment((string) end($reminders))
        : '<h2>Step 1.1 – Sample due 2026-09-18</h2><p>The assigned step is due within one week.</p>'
);
ok($reminder !== null, 'a deadline reminder parses');
ok(!$reminder->isAnalytics() && $reminder->blocks() === [], 'and carries no report');
$reminderHtml = ReportMail::html($reminder, ['closing' => 'Sent a week before an assigned step falls due.']);
ok(strpos($reminderHtml, 'Module Management') === false, 'and is not given a report title it does not have');
ok(strpos($reminderHtml, 'due within one week') !== false, 'while the notice itself is kept');

ok(ReportDocument::parse('') === null, 'an empty body refuses to parse, so the caller can fall back');
$broken = ReportDocument::parse('<div><p>Half a body</p><svg viewBox="nonsense"><rect x="1"/></svg><table><tr><td>x');
ok($broken !== null && !$broken->isAnalytics(), 'broken markup parses without claiming to be the report');
ok(is_string(ReportMail::html($broken)) && strpos(ReportMail::html($broken), 'Half a body') !== false, 'and keeps what text it had');

/* The service's own composition, wired as the endpoint wires it — reflection
   because compose() is private, and it is private because nothing but the
   endpoint should be calling it. */
$_SERVER['REQUEST_URI'] = '/apps/api/notify/ai-governance';
$compose = new ReflectionMethod(\Controllers\NotifyController::class, 'compose');
$compose->setAccessible(true);
$composed = $compose->invoke(
    new \Controllers\NotifyController(),
    'step-complete',
    $body,
    true,
    ['id' => 1, 'name' => 'Example Foundation'],
    'Step 1.1 complete – analytics report'
);
ok($composed['attachment'] !== '', 'the endpoint composes an attachment: ' . $composed['attachment']);
ok(count($composed['attachments']) === 1, 'exactly one file goes with the message');
ok(strpos($composed['html'], 'Responsible AI Governance') !== false, 'the program named in the path reaches the message');
ok(strpos($composed['html'], 'Example Foundation') !== false, 'so does the organization');

/* ── Finished ───────────────────────────────────────────────── */

if ($write) {
    @file_put_contents($out . '/check-mail.html', "<!doctype html><meta charset=\"utf-8\">\n<title>Completion email</title>\n" . $html);
    @file_put_contents($out . '/check-report.pdf', $pdf);
    @file_put_contents($out . '/check-mail.txt', $text);
    echo "\nwrote tools/_notify-out/check-mail.html, check-mail.txt and check-report.pdf\n";
}

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
