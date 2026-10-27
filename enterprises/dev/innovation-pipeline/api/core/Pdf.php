<?php
namespace Core;

/**
 * Pdf — a small, dependency-free PDF writer.
 *
 * WHY HAND-ROLLED, for the same reason Core\Mailer is: everything in api/ is,
 * except the Anthropic SDK. A PDF library (Dompdf, TCPDF, mPDF) is three to
 * fifteen megabytes of dependency tree, and it is all there to solve the hard
 * problem — arbitrary HTML, arbitrary CSS, arbitrary fonts. We do not have that
 * problem. We have ONE document, the Module Management analytics report, whose
 * every element this codebase draws itself. Laying that out directly is a few
 * hundred lines against a file format whose text and vector operators have not
 * changed since 1993.
 *
 * ── What it does ───────────────────────────────────────────────
 *   · pages, in any size (A4 portrait by default)
 *   · text in the three Helvetica faces, measured from the real AFM widths so
 *     centring, right-alignment and wrapping land where they should
 *   · lines, rectangles (square or rounded), circles, polylines
 *   · fill and stroke colour, constant alpha, dash patterns
 *
 * ── What it deliberately does not do ───────────────────────────
 * No embedded fonts (the standard 14 are in every reader, and embedding means
 * parsing TrueType), no images (this deployment has no GD — see the charts,
 * which are vector anyway), no encryption, no links, no forms. Anything the
 * report does not need is a thing that cannot break.
 *
 * ── Coordinates ────────────────────────────────────────────────
 * PDF measures y UPWARD from the bottom-left corner. Every public method here
 * takes y DOWNWARD from the top-left instead, because that is how the layout
 * above it thinks — a report flows down the page. The flip happens in one
 * place, Pdf::y(). Units are points throughout: 1pt = 1/72in, so A4 is
 * 595.28 × 841.89 and a 48pt margin is two thirds of an inch.
 *
 * @see Core\ReportPdf for the report this exists to draw.
 */
class Pdf
{
    /** Page sizes, in points. */
    public const A4     = [595.28, 841.89];
    public const LETTER = [612.0, 792.0];

    /** The three faces, as the content stream names them. */
    public const REGULAR = 'F1';
    public const BOLD    = 'F2';
    public const ITALIC  = 'F3';

    /**
     * Helvetica advance widths, characters 32–126, in 1/1000 of the font size.
     * Straight from the Adobe AFM; these are what make textWidth() exact rather
     * than a guess, and a guess is visible the moment anything is centred.
     */
    private const WIDTHS_REGULAR =
        '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 ' .    // ! " # $ % & ' ( ) * + , - . /
        '556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 ' .    // 0-9 : ; < = > ?
        '1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 ' .   // @ A-O
        '667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 ' .    // P-Z [ \ ] ^ _
        '333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 ' .    // ` a-o
        '556 556 333 500 278 556 500 722 500 500 500 334 260 334 584';          // p-z { | } ~

    /** The same table for Helvetica-Bold. */
    private const WIDTHS_BOLD =
        '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 ' .
        '556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 ' .
        '975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 ' .
        '667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 ' .
        '333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 ' .
        '611 611 389 556 333 611 556 778 556 556 500 389 280 389 584';

    /**
     * The handful of WinAnsi characters above 127 this report actually uses —
     * the en dash in every heading, the middle dot in every "3 open · 4 done".
     * Everything else above 127 falls back to the default width, which is off
     * by a few thousandths of an em and never by enough to see.
     */
    private const WIDTHS_HIGH = [
        0x85 => [1000, 1000],  // ellipsis
        0x91 => [222, 278],    // ' left
        0x92 => [222, 278],    // ' right
        0x93 => [333, 500],    // " left
        0x94 => [333, 500],    // " right
        0x95 => [350, 350],    // bullet
        0x96 => [556, 556],    // en dash
        0x97 => [1000, 1000],  // em dash
        0xA0 => [278, 278],    // no-break space
        0xB0 => [400, 400],    // degree
        0xB7 => [278, 278],    // middle dot
    ];

    /**
     * Characters the app draws that WinAnsi has no glyph for. Dropped or
     * spelled out here rather than left to mb_convert_encoding, which would
     * turn each one into a '?' — and a page of '?' is how a reader learns not
     * to trust the rest of it. The pace verdict loses its ▲ and keeps its
     * colour, which carries the same meaning without the missing glyph.
     */
    private const TRANSLITERATE = [
        "\u{25B2}" => '',      // ▲ ahead of pace
        "\u{25BC}" => '',      // ▼ behind pace
        "\u{2713}" => '',      // ✓ done
        "\u{2715}" => 'x',     // ✕ close
        "\u{26A0}" => '!',     // ⚠ warning
        "\u{2192}" => '->',    // →
        "\u{2190}" => '<-',    // ←
        "\u{2212}" => '-',     // − true minus
        "\u{25A6}" => '',      // ▦ track program
        "\u{2726}" => '*',     // ✦
    ];

    /** @var array<int,array{w:float,h:float,ops:string}> */
    private array $pages = [];

    /** Which page ops are being appended to. */
    private int $cur = -1;

    /** Default page size for page(). */
    private float $pw;
    private float $ph;

    /**
     * Constant-alpha graphics states, keyed "fill:stroke" so a document that
     * uses .85 forty times carries one ExtGState, not forty.
     * @var array<string,string>
     */
    private array $alphas = [];

    public function __construct(array $size = self::A4)
    {
        $this->pw = (float) $size[0];
        $this->ph = (float) $size[1];
    }

    /* ── Pages ──────────────────────────────────────────────────── */

    /** Start a new page and make it the drawing target. */
    public function page(?array $size = null): void
    {
        $this->pages[] = [
            'w'   => $size ? (float) $size[0] : $this->pw,
            'h'   => $size ? (float) $size[1] : $this->ph,
            'ops' => '',
        ];
        $this->cur = count($this->pages) - 1;
    }

    public function pageCount(): int
    {
        return count($this->pages);
    }

    /**
     * Point subsequent drawing at an earlier page. The footer is the reason
     * this exists: "Page 2 of 4" cannot be written until the fourth page has
     * been laid out, by which time the second one is long closed.
     */
    public function target(int $index): void
    {
        if (isset($this->pages[$index])) {
            $this->cur = $index;
        }
    }

    public function width(): float
    {
        return $this->pages[$this->cur]['w'] ?? $this->pw;
    }

    public function height(): float
    {
        return $this->pages[$this->cur]['h'] ?? $this->ph;
    }

    /* ── Drawing ────────────────────────────────────────────────── */

    /**
     * One line of text.
     *
     * @param array{size?:float,font?:string,color?:string,align?:string,alpha?:float} $o
     *        `align` is left|center|right and positions the line against $x.
     *        $y is the BASELINE, measured down from the top of the page.
     */
    public function text(float $x, float $y, string $s, array $o = []): void
    {
        $s = $this->encode($s);
        if ($s === '') {
            return;
        }
        $size = (float) ($o['size'] ?? 10);
        $font = (string) ($o['font'] ?? self::REGULAR);
        $align = (string) ($o['align'] ?? 'left');

        if ($align !== 'left') {
            $w = $this->encodedWidth($s, $size, $font);
            $x -= $align === 'center' ? $w / 2 : $w;
        }

        $q = $this->alphaOps($o, null);
        $this->put($q);
        $this->put($this->fillColor($o['color'] ?? '#000000'));
        $this->put('BT /' . $font . ' ' . $this->n($size) . ' Tf '
            . '1 0 0 1 ' . $this->n($x) . ' ' . $this->n($this->y($y)) . ' Tm '
            . '(' . $this->escape($s) . ') Tj ET');
        $this->put($q === '' ? '' : 'Q');
    }

    /**
     * @param array{color?:string,width?:float,dash?:array,alpha?:float,cap?:int} $o
     */
    public function line(float $x1, float $y1, float $x2, float $y2, array $o = []): void
    {
        $q = $this->alphaOps($o, 'stroke');
        $this->put($q);
        $this->put($this->strokeSetup($o));
        $this->put($this->n($x1) . ' ' . $this->n($this->y($y1)) . ' m '
            . $this->n($x2) . ' ' . $this->n($this->y($y2)) . ' l S');
        $this->put($q === '' ? $this->dashReset($o) : 'Q');
    }

    /**
     * A rectangle, square-cornered or rounded.
     *
     * @param array{fill?:string,stroke?:string,width?:float,radius?:float,alpha?:float} $o
     */
    public function rect(float $x, float $y, float $w, float $h, array $o = []): void
    {
        if ($w <= 0 || $h <= 0) {
            return;
        }
        $fill   = isset($o['fill']) && $o['fill'] !== '';
        $stroke = isset($o['stroke']) && $o['stroke'] !== '';
        if (!$fill && !$stroke) {
            return;
        }

        $q = $this->alphaOps($o, $fill ? null : 'stroke');
        $this->put($q);
        if ($fill) {
            $this->put($this->fillColor($o['fill']));
        }
        if ($stroke) {
            $this->put($this->strokeSetup($o));
        }

        $r = min((float) ($o['radius'] ?? 0), $w / 2, $h / 2);
        $this->put($r > 0 ? $this->roundPath($x, $y, $w, $h, $r)
                          : $this->n($x) . ' ' . $this->n($this->y($y + $h)) . ' ' . $this->n($w) . ' ' . $this->n($h) . ' re');
        $this->put($fill && $stroke ? 'B' : ($fill ? 'f' : 'S'));
        $this->put($q === '' ? $this->dashReset($o) : 'Q');
    }

    /** @param array{fill?:string,stroke?:string,width?:float,alpha?:float} $o */
    public function circle(float $cx, float $cy, float $r, array $o = []): void
    {
        if ($r <= 0) {
            return;
        }
        $k  = 0.5523 * $r;               // the classic four-bezier circle
        $y  = $this->y($cy);
        $q  = $this->alphaOps($o, isset($o['fill']) ? null : 'stroke');
        $this->put($q);
        if (isset($o['fill'])) {
            $this->put($this->fillColor($o['fill']));
        }
        if (isset($o['stroke'])) {
            $this->put($this->strokeSetup($o));
        }
        $this->put($this->n($cx - $r) . ' ' . $this->n($y) . ' m');
        $this->curve($cx - $r, $y + $k, $cx - $k, $y + $r, $cx, $y + $r);
        $this->curve($cx + $k, $y + $r, $cx + $r, $y + $k, $cx + $r, $y);
        $this->curve($cx + $r, $y - $k, $cx + $k, $y - $r, $cx, $y - $r);
        $this->curve($cx - $k, $y - $r, $cx - $r, $y - $k, $cx - $r, $y);
        $this->put(isset($o['fill']) ? (isset($o['stroke']) ? 'B' : 'f') : 'S');
        $this->put($q === '' ? '' : 'Q');
    }

    /**
     * An open polyline through [[x,y],…] — the burn-up curve, and nothing else
     * so far. Closed shapes are rect() and circle().
     *
     * @param array<int,array{0:float,1:float}> $points
     * @param array{color?:string,width?:float,dash?:array,alpha?:float} $o
     */
    public function polyline(array $points, array $o = []): void
    {
        if (count($points) < 2) {
            return;
        }
        $q = $this->alphaOps($o, 'stroke');
        $this->put($q);
        $this->put($this->strokeSetup($o));
        $first = array_shift($points);
        $ops   = $this->n($first[0]) . ' ' . $this->n($this->y($first[1])) . ' m';
        foreach ($points as $p) {
            $ops .= ' ' . $this->n($p[0]) . ' ' . $this->n($this->y($p[1])) . ' l';
        }
        $this->put($ops . ' S');
        $this->put($q === '' ? $this->dashReset($o) : 'Q');
    }

    /* ── Measuring ──────────────────────────────────────────────── */

    /** How wide $s renders, in points. */
    public function textWidth(string $s, float $size, string $font = self::REGULAR): float
    {
        return $this->encodedWidth($this->encode($s), $size, $font);
    }

    /**
     * Break $s into lines no wider than $max, on word boundaries.
     *
     * A single word longer than the line (a URL, a pasted id) is cut rather
     * than allowed to run off the page — losing the end of one token is
     * recoverable, losing the margin is not.
     *
     * @return string[]
     */
    public function wrap(string $s, float $max, float $size, string $font = self::REGULAR): array
    {
        $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
        if ($s === '') {
            return [];
        }

        $lines = [];
        $line  = '';
        foreach (explode(' ', $s) as $word) {
            $try = $line === '' ? $word : $line . ' ' . $word;
            if ($this->textWidth($try, $size, $font) <= $max) {
                $line = $try;
                continue;
            }
            if ($line !== '') {
                $lines[] = $line;
                $line = '';
            }
            while ($this->textWidth($word, $size, $font) > $max && mb_strlen($word) > 1) {
                $cut = mb_strlen($word);
                while ($cut > 1 && $this->textWidth(mb_substr($word, 0, $cut), $size, $font) > $max) {
                    $cut--;
                }
                $lines[] = mb_substr($word, 0, $cut);
                $word = mb_substr($word, $cut);
            }
            $line = $word;
        }
        if ($line !== '') {
            $lines[] = $line;
        }
        return $lines;
    }

    /* ── Output ─────────────────────────────────────────────────── */

    /**
     * The finished file.
     *
     * Objects are numbered in the order they are written and their byte offsets
     * recorded as they go, because that is exactly what the cross-reference
     * table at the end has to contain — a reader seeks to an offset from it
     * rather than scanning, and an offset that is wrong by one byte is a file
     * that will not open.
     */
    public function render(): string
    {
        if ($this->pages === []) {
            $this->page();
        }

        $n         = count($this->pages);
        $fontBase  = 3 + $n * 2;                         // catalog, pages, then page/content pairs
        $alphaBase = $fontBase + 3;
        $objects   = [];

        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';

        $kids = [];
        for ($i = 0; $i < $n; $i++) {
            $kids[] = (3 + $i * 2) . ' 0 R';
        }
        $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $n . ' >>';

        $extg = [];
        foreach ($this->alphas as $name) {
            $extg[] = '/' . $name . ' ' . ($alphaBase + count($extg)) . ' 0 R';
        }
        $resources = '<< /ProcSet [/PDF /Text] /Font << '
            . '/F1 ' . $fontBase . ' 0 R /F2 ' . ($fontBase + 1) . ' 0 R /F3 ' . ($fontBase + 2) . ' 0 R'
            . ' >>' . ($extg ? ' /ExtGState << ' . implode(' ', $extg) . ' >>' : '') . ' >>';

        foreach ($this->pages as $i => $page) {
            $id      = 3 + $i * 2;
            $content = trim($page['ops']);
            $objects[$id] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '
                . $this->n($page['w']) . ' ' . $this->n($page['h']) . '] '
                . '/Resources ' . $resources . ' /Contents ' . ($id + 1) . ' 0 R >>';
            $objects[$id + 1] = $this->stream($content);
        }

        $objects[$fontBase]     = $this->font('Helvetica');
        $objects[$fontBase + 1] = $this->font('Helvetica-Bold');
        $objects[$fontBase + 2] = $this->font('Helvetica-Oblique');

        $i = 0;
        foreach (array_keys($this->alphas) as $key) {
            [$ca, $CA] = explode(':', $key);
            $objects[$alphaBase + $i] = '<< /Type /ExtGState /ca ' . $ca . ' /CA ' . $CA . ' >>';
            $i++;
        }

        ksort($objects);
        $out     = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($out);
            $out .= $id . " 0 obj\n" . $body . "\nendobj\n";
        }

        $count = count($objects) + 1;
        $start = strlen($out);
        $out  .= "xref\n0 " . $count . "\n0000000000 65535 f \n";
        for ($id = 1; $id < $count; $id++) {
            $out .= sprintf("%010d 00000 n \n", $offsets[$id] ?? 0);
        }
        $out .= "trailer\n<< /Size " . $count . ' /Root 1 0 R /Info << /Producer (Next Chapter Programs) '
            . '/CreationDate (D:' . date('YmdHis') . ") >> >>\nstartxref\n" . $start . "\n%%EOF\n";

        return $out;
    }

    /* ── Internals ──────────────────────────────────────────────── */

    /** Flip a top-down y into the PDF's bottom-up space. */
    private function y(float $y): float
    {
        return $this->height() - $y;
    }

    private function put(string $ops): void
    {
        if ($ops === '') {
            return;
        }
        if ($this->cur < 0) {
            $this->page();
        }
        $this->pages[$this->cur]['ops'] .= $ops . "\n";
    }

    private function curve(float $x1, float $y1, float $x2, float $y2, float $x3, float $y3): void
    {
        $this->put($this->n($x1) . ' ' . $this->n($y1) . ' ' . $this->n($x2) . ' ' . $this->n($y2)
            . ' ' . $this->n($x3) . ' ' . $this->n($y3) . ' c');
    }

    /** A rounded rectangle as four lines and four quarter-circle beziers. */
    private function roundPath(float $x, float $y, float $w, float $h, float $r): string
    {
        $b  = $this->y($y + $h);          // bottom edge in PDF space
        $t  = $b + $h;
        $k  = 0.5523 * $r;
        $l  = $x;
        $rt = $x + $w;

        $c = fn(float $x1, float $y1, float $x2, float $y2, float $x3, float $y3): string =>
            $this->n($x1) . ' ' . $this->n($y1) . ' ' . $this->n($x2) . ' ' . $this->n($y2)
            . ' ' . $this->n($x3) . ' ' . $this->n($y3) . ' c';

        return $this->n($l + $r) . ' ' . $this->n($b) . " m\n"
            . $this->n($rt - $r) . ' ' . $this->n($b) . " l\n"
            . $c($rt - $r + $k, $b, $rt, $b + $r - $k, $rt, $b + $r) . "\n"
            . $this->n($rt) . ' ' . $this->n($t - $r) . " l\n"
            . $c($rt, $t - $r + $k, $rt - $r + $k, $t, $rt - $r, $t) . "\n"
            . $this->n($l + $r) . ' ' . $this->n($t) . " l\n"
            . $c($l + $r - $k, $t, $l, $t - $r + $k, $l, $t - $r) . "\n"
            . $this->n($l) . ' ' . $this->n($b + $r) . " l\n"
            . $c($l, $b + $r - $k, $l + $r - $k, $b, $l + $r, $b) . "\nh";
    }

    private function strokeSetup(array $o): string
    {
        $ops = $this->strokeColor($o['color'] ?? $o['stroke'] ?? '#000000')
             . ' ' . $this->n((float) ($o['width'] ?? 1)) . ' w';
        if (!empty($o['dash']) && is_array($o['dash'])) {
            $ops .= ' [' . implode(' ', array_map([$this, 'n'], $o['dash'])) . '] 0 d';
        }
        if (isset($o['cap'])) {
            $ops .= ' ' . (int) $o['cap'] . ' J';
        }
        return $ops;
    }

    private function dashReset(array $o): string
    {
        return !empty($o['dash']) ? '[] 0 d' : '';
    }

    /**
     * Constant alpha. Colours may carry their own — rgba(245,242,236,.08) is
     * how the app draws every gridline — so an explicit `alpha` option and an
     * alpha inside the colour both end up here, the explicit one winning.
     */
    private function alphaOps(array $o, ?string $which): string
    {
        $a = $o['alpha'] ?? null;
        if ($a === null) {
            $spec = $which === 'stroke' ? ($o['color'] ?? $o['stroke'] ?? null) : ($o['fill'] ?? $o['color'] ?? null);
            $a = is_string($spec) ? ($this->color($spec)[3] ?? 1.0) : 1.0;
        }
        $a = max(0.0, min(1.0, (float) $a));
        if ($a >= 1.0) {
            return '';
        }
        $key = $this->n($a) . ':' . $this->n($a);
        if (!isset($this->alphas[$key])) {
            $this->alphas[$key] = 'GS' . count($this->alphas);
        }
        return 'q /' . $this->alphas[$key] . ' gs';
    }

    private function fillColor(string $spec): string
    {
        [$r, $g, $b] = $this->color($spec);
        return $this->n($r) . ' ' . $this->n($g) . ' ' . $this->n($b) . ' rg';
    }

    private function strokeColor(string $spec): string
    {
        [$r, $g, $b] = $this->color($spec);
        return $this->n($r) . ' ' . $this->n($g) . ' ' . $this->n($b) . ' RG';
    }

    /**
     * '#rgb', '#rrggbb', 'rgb(r,g,b)' and 'rgba(r,g,b,a)' — the four forms the
     * app's own markup uses — as [r, g, b, a] in 0…1.
     *
     * @return array{0:float,1:float,2:float,3:float}
     */
    public function color(string $spec): array
    {
        $spec = trim($spec);
        if (preg_match('/^rgba?\(([^)]*)\)$/i', $spec, $m)) {
            $parts = array_map('trim', explode(',', $m[1]));
            return [
                (float) ($parts[0] ?? 0) / 255,
                (float) ($parts[1] ?? 0) / 255,
                (float) ($parts[2] ?? 0) / 255,
                isset($parts[3]) ? (float) $parts[3] : 1.0,
            ];
        }
        $hex = ltrim($spec, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
            return [0.0, 0.0, 0.0, 1.0];
        }
        return [
            hexdec(substr($hex, 0, 2)) / 255,
            hexdec(substr($hex, 2, 2)) / 255,
            hexdec(substr($hex, 4, 2)) / 255,
            1.0,
        ];
    }

    /** UTF-8 in, WinAnsi out — see TRANSLITERATE for what has no glyph. */
    private function encode(string $s): string
    {
        $s = strtr($s, self::TRANSLITERATE);
        $s = preg_replace('/\s+/u', ' ', $s) ?? $s;
        $s = trim($s);
        if ($s === '') {
            return '';
        }
        $was = mb_substitute_character();
        mb_substitute_character(0x3F);                 // '?' for anything left
        $out = mb_convert_encoding($s, 'Windows-1252', 'UTF-8');
        mb_substitute_character($was);
        return (string) $out;
    }

    private function encodedWidth(string $s, float $size, string $font): float
    {
        static $tables = null;
        if ($tables === null) {
            $tables = [
                self::REGULAR => array_map('floatval', explode(' ', preg_replace('/\s+/', ' ', self::WIDTHS_REGULAR))),
                self::BOLD    => array_map('floatval', explode(' ', preg_replace('/\s+/', ' ', self::WIDTHS_BOLD))),
            ];
            $tables[self::ITALIC] = $tables[self::REGULAR];   // Oblique is Helvetica, slanted
        }
        $table = $tables[$font] ?? $tables[self::REGULAR];
        $bold  = $font === self::BOLD;
        $total = 0.0;
        $len   = strlen($s);
        for ($i = 0; $i < $len; $i++) {
            $c = ord($s[$i]);
            if ($c >= 32 && $c <= 126) {
                $total += $table[$c - 32];
            } elseif (isset(self::WIDTHS_HIGH[$c])) {
                $total += self::WIDTHS_HIGH[$c][$bold ? 1 : 0];
            } else {
                $total += $bold ? 611 : 556;
            }
        }
        return $total * $size / 1000;
    }

    /** Literal strings are delimited by parentheses, so those must be escaped. */
    private function escape(string $s): string
    {
        return str_replace(['\\', '(', ')', "\r"], ['\\\\', '\\(', '\\)', ''], $s);
    }

    private function font(string $base): string
    {
        return '<< /Type /Font /Subtype /Type1 /BaseFont /' . $base . ' /Encoding /WinAnsiEncoding >>';
    }

    /**
     * A content stream, deflated when zlib is there — the report's charts are
     * thousands of short numeric operators and compress to about a fifth,
     * which matters for a file that travels as a mail attachment.
     */
    private function stream(string $content): string
    {
        if (function_exists('gzcompress')) {
            $packed = gzcompress($content, 6);
            if ($packed !== false) {
                return '<< /Length ' . strlen($packed) . " /Filter /FlateDecode >>\nstream\n" . $packed . "\nendstream";
            }
        }
        return '<< /Length ' . strlen($content) . " >>\nstream\n" . $content . "\nendstream";
    }

    /** Numbers, short: PDF has no use for the float noise of 156.00000000001. */
    private function n(float $v): string
    {
        $s = number_format($v, 3, '.', '');
        $s = rtrim(rtrim($s, '0'), '.');
        return $s === '' || $s === '-' ? '0' : $s;
    }
}
