<?php
/**
 * tools/make-social-test-banners.php — placeholder share-card banners
 *
 *   php tools/make-social-test-banners.php          writes only missing files
 *   php tools/make-social-test-banners.php --force  overwrites every banner
 *
 * Draws one 1200×630 JPG per program and a default into
 * assets/social/, named exactly as index.php looks them up (see the README
 * there). Each wears its program's accent from assets/css/themes.css and is
 * stamped TEST BANNER, so a real design is never mistaken for one of these.
 * Without --force an existing file is left alone — a supplied banner is safe.
 */

declare(strict_types=1);

$root  = dirname(__DIR__);
$out   = $root . '/assets/social';
$force = in_array('--force', $argv, true);
$cat   = json_decode((string) file_get_contents($root . '/config/catalogue.json'), true);
$css   = (string) file_get_contents($root . '/assets/css/themes.css');

$serif = 'C:/Windows/Fonts/georgia.ttf';
$sans  = 'C:/Windows/Fonts/arial.ttf';
$bold  = 'C:/Windows/Fonts/arialbd.ttf';

/** The program's --accent from themes.css, or the suite gold. */
function accent_for(string $css, string $id): string
{
    $re = '/\[data-app="' . preg_quote($id, '/') . '"\]\s*\{[^}]*?--accent:\s*(#[0-9A-Fa-f]{6})/';
    return preg_match($re, $css, $m) ? $m[1] : '#C9A24B';
}

function rgb($img, string $hex, int $alpha = 0): int
{
    [$r, $g, $b] = sscanf($hex, '#%02x%02x%02x');
    return imagecolorallocatealpha($img, $r, $g, $b, $alpha);
}

/** Word-wrap $text to $width px; returns the lines. */
function wrap(string $text, string $font, float $size, int $width): array
{
    $lines = [];
    $line  = '';
    foreach (preg_split('/\s+/', trim($text)) as $word) {
        $try = $line === '' ? $word : $line . ' ' . $word;
        $box = imagettfbbox($size, 0, $font, $try);
        if ($box[2] - $box[0] > $width && $line !== '') {
            $lines[] = $line;
            $line = $word;
        } else {
            $line = $try;
        }
    }
    if ($line !== '') $lines[] = $line;
    return $lines;
}

function banner(string $file, string $accent, string $kicker, string $title, string $sub, string $foot): void
{
    global $serif, $sans, $bold;
    $W = 1200; $H = 630; $pad = 80;
    $img = imagecreatetruecolor($W, $H);
    imagealphablending($img, true);

    // Dark ground with a soft wash of the accent from the right.
    imagefilledrectangle($img, 0, 0, $W, $H, rgb($img, '#12141A'));
    for ($i = 0; $i < 60; $i++) {
        $r = 900 - $i * 12;
        imagefilledellipse($img, 1180, 120, $r * 2, $r * 2, rgb($img, $accent, 126 - (int) ($i * 0.35)));
    }
    imagefilledrectangle($img, 0, 0, 14, $H, rgb($img, $accent));

    $white = rgb($img, '#FFFFFF');
    $mute  = rgb($img, '#B9BDC8');

    imagettftext($img, 17, 0, $pad, 112, rgb($img, $accent), $bold, strtoupper($kicker));

    $y = 200;
    foreach (array_slice(wrap($title, $serif, 54, $W - 2 * $pad), 0, 3) as $l) {
        imagettftext($img, 54, 0, $pad, $y, $white, $serif, $l);
        $y += 74;
    }
    $y += 14;
    foreach (array_slice(wrap($sub, $sans, 24, $W - 2 * $pad - 80), 0, 2) as $l) {
        imagettftext($img, 24, 0, $pad, $y, $mute, $sans, $l);
        $y += 38;
    }

    imagefilledrectangle($img, $pad, 540, $W - $pad, 541, rgb($img, '#FFFFFF', 100));
    imagettftext($img, 17, 0, $pad, 582, $white, $bold, $foot);

    // The "this is a placeholder" stamp.
    $tag = 'TEST BANNER';
    $box = imagettfbbox(14, 0, $bold, $tag);
    $tw  = $box[2] - $box[0];
    imagefilledrectangle($img, $W - $pad - $tw - 28, 556, $W - $pad, 592, rgb($img, $accent));
    imagettftext($img, 14, 0, $W - $pad - $tw - 14, 581, $white, $bold, $tag);

    imagejpeg($img, $file, 88);
    imagedestroy($img);
}

$suite = $cat['suite']['name'] ?? 'Programs';
$jobs  = [['default', '#C9A24B', $suite, $cat['suite']['title'] ?? $suite,
           '90-day programs for organizations and the people who lead them.']];
foreach ($cat['roles'] as $role) {
    foreach ($role['modules'] as $m) {
        $jobs[] = [$m['slug'], accent_for($css, $m['id']), $role['name'] . ' · ' . ($m['tag'] ?? ''),
                   $m['name'], $m['sub'] ?? ''];
    }
}

foreach ($jobs as [$name, $accent, $kicker, $title, $sub]) {
    $file = $out . '/' . $name . '.jpg';
    $has  = glob($out . '/' . $name . '.{jpg,jpeg,png,webp}', GLOB_BRACE);
    if ($has && !$force) { echo "skip   $name (already has a banner)\n"; continue; }
    banner($file, $accent, $kicker, $title, $sub, $suite);
    echo "wrote  $name.jpg\n";
}
