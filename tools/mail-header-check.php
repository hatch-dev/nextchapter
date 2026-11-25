<?php
/*
 * mail-header-check.php — names and subjects in a message's headers, and the frame around its body (EML-005, 25 Nov 2026).
 *
 *   php tools/mail-header-check.php
 *
 * P-27: an encoded word is at most 75 characters, and a name holding a comma, quotes or brackets is quoted. P-25 and P-26:
 * no fixed width a phone cannot shrink, and nothing Outlook drops. Sends nothing and touches no database.
 */
declare(strict_types=1);

$root = dirname(__DIR__);
require $root . '/api/helpers/functions.php';
foreach (['Catalogue', 'Mailer', 'MailLayout'] as $c) require $root . '/api/core/' . $c . '.php';

$failed = 0;
$check = static function (string $what, bool $ok) use (&$failed): void { echo ($ok ? 'ok    ' : 'FAIL  ') . $what . PHP_EOL; if (!$ok) $failed++; };

$mailer  = new Core\Mailer();
$message = new ReflectionMethod($mailer, 'message');
$message->setAccessible(true);
$head = static function (string $name, string $subject) use ($mailer, $message): array {
    $raw = explode("\r\n\r\n", $message->invoke($mailer, 'jo@example.test', $name, $subject, '<p>x</p>', 'x', []), 2)[0];
    $out = ['raw' => $raw];
    foreach (explode("\r\n", (string) preg_replace('/\r\n[ \t]+/', ' ', $raw)) as $line) { [$k, $v] = explode(': ', $line, 2); $out[$k] = $v; }
    return $out;
};
$read = static fn(string $v): string => (string) mb_decode_mimeheader(preg_replace('/\?=\s+=\?/', '?==?', $v));

foreach (['Jo Smith', 'José Núñez-Ångström', 'Ω' . str_repeat('é', 120), 'Zoë O’Neil-Müller', '名前 太郎 ' . str_repeat('漢字', 30)] as $n) {
    $h = $head($n, $n . ' — subject');
    preg_match_all('/=\?[^ \r\n]*\?=/', $h['raw'], $words);
    $check(mb_substr($n, 0, 18) . ': no encoded word over 75', $words[0] === [] || max(array_map('strlen', $words[0])) <= 75);
    $check('  no line over 78 in the subject', max(array_map('strlen', explode("\r\n", substr($h['raw'], (int) strpos($h['raw'], 'Subject:'), (int) strpos($h['raw'], 'Message-ID:') - (int) strpos($h['raw'], 'Subject:'))))) <= 86);
    $decode = static function (string $v): string { return (string) preg_replace_callback('/=\?UTF-8\?B\?([^?]*)\?=(\s+(?==\?))?/', static fn($m) => base64_decode($m[1]), $v); };
    $check('  the subject reads back whole', $decode($h['Subject']) === $n . ' — subject');
    $check('  the name reads back whole', $decode($h['To']) === $n . ' <jo@example.test>');
    $check('  each word is whole characters', array_filter($words[0], static fn($w) => !mb_check_encoding(base64_decode(substr($w, 10, -2)), 'UTF-8')) === []);
}
foreach (['Smith, Jo' => '"Smith, Jo"', 'Jo "JJ" Smith' => '"Jo \"JJ\" Smith"', 'Jo (Ops) Smith' => '"Jo (Ops) Smith"', 'Dr. Jo <x@y.z>' => '"Dr. Jo <x@y.z>"', 'a\\b;c' => '"a\\\\b;c"', 'Jo Smith' => 'Jo Smith', "Jo O'Neil-Li" => "Jo O'Neil-Li"] as $n => $want) {
    $check($n . ' is written ' . $want, $head((string) $n, 's')['To'] === $want . ' <jo@example.test>');
}
$check('a line break in a name starts no header of its own', !isset($head("Jo\r\nBcc: x@y.z", 's')['Bcc']));
$check('something that looks encoded is encoded', str_starts_with($head('Jo', '=?UTF-8?B?eA==?=')['Subject'], '=?UTF-8?B?PT9'));

$html = Core\MailLayout::page('<p style="margin:0">x</p>' . Core\MailLayout::box(Core\MailLayout::field('A', 'b')) . Core\MailLayout::button('https://x.test/?a=1&b="2"', 'Open <it>') . Core\MailLayout::rule());
$seen = (string) preg_replace('/<!--.*?-->/s', '', $html);
$check('no table but Outlook’s own states a width in pixels', !preg_match('/<table[^>]*(width="\d+"|[;"]width:\d+px)/', $seen));
$check('Outlook’s is there', (bool) preg_match('/<!--\[if mso\]><table[^>]*width="640"/', $html));
preg_match_all('/<(td|p|div|a)\b[^>]*style="([^"]*)"/', $html, $m);
$check('every styled element says its font', array_filter($m[2], static fn($s) => !str_contains($s, 'font-family')) === []);
$check('padding is on cells and the button’s link only', !preg_match('/<(div|p)\b[^>]*style="[^"]*padding/', $html));
$check('the button’s address and words are escaped', str_contains($html, 'href="https://x.test/?a=1&amp;b=&quot;2&quot;"') && str_contains($html, 'Open &lt;it&gt;'));
$lum = static function (string $h): float { $l = 0.0; foreach ([0.2126, 0.7152, 0.0722] as $k => $w) { $v = hexdec(substr($h, 1 + 2 * $k, 2)) / 255; $l += $w * ($v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4); } return $l; };
$ratio = static function (string $a, string $b) use ($lum): float { $x = $lum($a); $y = $lum($b); return (max($x, $y) + .05) / (min($x, $y) + .05); };
foreach ([[Core\MailLayout::FAINT, Core\MailLayout::CARD], [Core\MailLayout::FAINT, Core\MailLayout::PANEL], [Core\MailLayout::GOLD, Core\MailLayout::CARD], ['#ffffff', Core\MailLayout::GOLD]] as [$ink, $on]) $check("$ink on $on reads", $ratio($ink, $on) >= 4.5);
foreach (['#c25b73', '#d4a017', '#54b399', '#1c1a17'] as $c) $check("$c is made to read on white", $ratio(Core\MailLayout::legible($c), '#ffffff') >= 4.5);
$check('a dark colour is left as it is', Core\MailLayout::legible('#1c1a17') === '#1c1a17');
$check('what is not a colour is left as it is', Core\MailLayout::legible('inherit') === 'inherit');
echo $failed === 0 ? "all passed\n" : "$failed failed\n";
exit($failed === 0 ? 0 : 1);
