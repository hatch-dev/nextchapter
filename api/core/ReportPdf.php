<?php
namespace Core;

/**
 * ReportPdf — the Module Management analytics report, laid out for paper.
 *
 * This is the attachment the 3 Sep 2026 directive asks a 'step-complete'
 * message to carry, and the reason Core\Pdf exists. It draws the blocks
 * Core\ReportDocument read out of the app's markup: a masthead, the stat band,
 * and a card per section, flowing onto as many A4 pages as they need.
 *
 * ── The charts are the point ───────────────────────────────────
 * Mail cannot show them at all, so the PDF is where they survive, and they
 * survive as VECTORS: every <line>, <rect>, <circle>, <path> and <text> the
 * app drew is re-emitted as a PDF operator at the same viewBox coordinates,
 * scaled to the column. The burn-up on paper is the burn-up on screen, to the
 * point — not a photograph of it, and not an approximation of it.
 *
 * ── Dark chart, white paper ────────────────────────────────────
 * The app draws on a dark ground, so its gridlines are near-white at 8%
 * opacity and its bar labels are #F5F2EC. Printed unchanged, every one of
 * those is white ink on white paper. So colours pass through paper(), which
 * leaves the meaningful ones alone — gold, teal, the phase colours, the stone
 * grey of the axis — and turns the light-on-dark scaffolding into its
 * dark-on-light equivalent. Nothing is recoloured that carries meaning.
 */
class ReportPdf
{
    /* The light palette, the same literals Core\ReportMail draws with. */
    private const INK    = '#1c1a17';
    private const BODY   = '#413d36';
    private const FAINT  = '#8b8579';
    private const BORDER = '#e6e2da';
    private const RULE   = '#d9d5cd';
    private const GOLD   = '#B8892A';
    private const TRACK  = '#efece5';

    private const MARGIN  = 46.0;   // two thirds of an inch
    private const GAP     = 13.0;   // between top-level blocks
    private const PAD     = 14.0;   // inside a card
    private const CHART_INSET = 8.0; // a chart is held in from the text column

    private Pdf $pdf;
    private float $y     = 0.0;
    private float $top   = 0.0;
    private float $bottom = 0.0;
    private float $width  = 0.0;

    /** @var array{eyebrow:string,generated:string,footer:string} */
    private array $meta;

    private function __construct(array $meta)
    {
        $this->pdf    = new Pdf(Pdf::A4);
        $this->meta   = $meta;
        $this->width  = Pdf::A4[0] - self::MARGIN * 2;
        $this->top    = self::MARGIN;
        $this->bottom = Pdf::A4[1] - self::MARGIN - 18;      // 18pt reserved for the footer
    }

    /**
     * Draw the report and return the PDF file.
     *
     * @param array{eyebrow?:string,generated?:string,footer?:string} $meta
     *        `eyebrow` is the organization and program above the title;
     *        `generated` the date the figures were taken; `footer` the line
     *        printed at the foot of every page beside the page number.
     */
    public static function render(ReportDocument $doc, array $meta = []): string
    {
        $self = new self([
            'eyebrow'   => trim((string) ($meta['eyebrow'] ?? '')),
            'generated' => trim((string) ($meta['generated'] ?? '')),
            'footer'    => trim((string) ($meta['footer'] ?? $doc->title())),
        ]);

        $self->pdf->page();
        $self->y = $self->masthead($doc);
        $self->flow($doc->blocks());
        $self->footers();

        return $self->pdf->render();
    }

    /**
     * What the attachment is called.
     *
     * The report's title, the program, and the date it was taken — so a folder
     * of these sorts by program and then by day, and so two reports from the
     * same module a week apart are not the same file twice.
     */
    public static function fileName(ReportDocument $doc, string $program = '', string $date = ''): string
    {
        $date = $date !== '' ? $date : date('Y-m-d');
        $bits = array_filter([$program, $doc->title(), 'analytics', $date]);
        $name = implode('-', $bits);
        $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', $name) ?? 'analytics-report';
        return trim(preg_replace('/-+/', '-', $name) ?? $name, '-') . '.pdf';
    }

    /* ── The page furniture ─────────────────────────────────────── */

    /** The title block, drawn once. Returns the y the body starts at. */
    private function masthead(ReportDocument $doc): float
    {
        $x = self::MARGIN;
        $y = self::MARGIN + 10;

        if ($this->meta['eyebrow'] !== '') {
            $this->pdf->text($x, $y, mb_strtoupper($this->meta['eyebrow']), [
                'size' => 8, 'font' => Pdf::BOLD, 'color' => self::GOLD,
            ]);
            $y += 16;
        }

        if ($doc->badge() !== '') {
            $label = mb_strtoupper($doc->badge());
            $w     = $this->pdf->textWidth($label, 7.5, Pdf::BOLD) + 14;
            $this->pdf->rect($x, $y - 8, $w, 14, [
                'stroke' => $doc->badgeColor(), 'width' => 0.7, 'radius' => 3,
            ]);
            $this->pdf->text($x + 7, $y + 2, $label, ['size' => 7.5, 'font' => Pdf::BOLD, 'color' => $doc->badgeColor()]);
            $y += 22;
        }

        $this->pdf->text($x, $y + 18, $doc->title(), ['size' => 26, 'font' => Pdf::BOLD, 'color' => self::INK]);
        $y += 30;

        if ($doc->standfirst() !== '') {
            $y = $this->paragraph($doc->standfirst(), $x, $y + 14, $this->width, 9.5, self::BODY, Pdf::REGULAR, 'left');
        }

        $y += 12;
        $this->pdf->line($x, $y, $x + $this->width, $y, ['color' => self::RULE, 'width' => 0.8]);
        return $y + 20;
    }

    /**
     * The foot of every page, written last because "of 4" is not knowable
     * until the fourth page has been laid out.
     */
    private function footers(): void
    {
        $count = $this->pdf->pageCount();
        $x     = self::MARGIN;
        $right = self::MARGIN + $this->width;
        $y     = Pdf::A4[1] - self::MARGIN + 8;

        for ($i = 0; $i < $count; $i++) {
            $this->pdf->target($i);
            $this->pdf->line($x, $y - 12, $right, $y - 12, ['color' => self::BORDER, 'width' => 0.6]);
            $left = $this->meta['footer'];
            if ($this->meta['generated'] !== '') {
                $left .= '  ·  ' . $this->meta['generated'];
            }
            $this->pdf->text($x, $y, $left, ['size' => 7.5, 'color' => self::FAINT]);
            $this->pdf->text($right, $y, 'Page ' . ($i + 1) . ' of ' . $count, [
                'size' => 7.5, 'color' => self::FAINT, 'align' => 'right',
            ]);
        }
        $this->pdf->target($count - 1);
    }

    private function newPage(): void
    {
        $this->pdf->page();
        $this->y = $this->top;
    }

    /* ── Flow ───────────────────────────────────────────────────── */

    /**
     * Lay the blocks down the page, breaking where they will not fit.
     *
     * Every block is measured before it is drawn — the same code path with
     * `$draw` false — because a card has to know how tall its contents are
     * before it can draw the box around them, and the page has to know the
     * same thing before it can decide whether they belong on this one.
     *
     * @param array<int,array<string,mixed>> $blocks
     */
    private function flow(array $blocks): void
    {
        foreach ($blocks as $b) {
            $h = $this->block($b, self::MARGIN, $this->y, $this->width, false);

            if ($this->y + $h > $this->bottom) {
                if (($b['kind'] ?? '') === 'card' && $h > $this->bottom - $this->top) {
                    $this->splitCard($b);           // taller than any page: break it up
                    continue;
                }
                $this->newPage();
            }

            $this->block($b, self::MARGIN, $this->y, $this->width, true);
            $this->y += $h + self::GAP;
        }
    }

    /**
     * A card with more rows than a page can hold, drawn as one boxed run per
     * page. The heading is printed on the first segment only — a repeated
     * heading reads as a second card rather than the rest of the first.
     */
    private function splitCard(array $card): void
    {
        $inner  = $this->width - self::PAD * 2;
        $x      = self::MARGIN;
        $first  = true;
        $queue  = $card['blocks'] ?? [];

        while ($queue !== []) {
            if ($this->y + 60 > $this->bottom) {
                $this->newPage();
            }
            $headH = $first && ($card['heading'] ?? '') !== '' ? 20.0 : 0.0;
            $room  = $this->bottom - $this->y - self::PAD * 2 - $headH;

            $run = [];
            $used = 0.0;
            while ($queue !== []) {
                $h = $this->block($queue[0], $x + self::PAD, 0, $inner, false);
                if ($run !== [] && $used + $h > $room) {
                    break;
                }
                $used += $h + 6;
                $run[] = array_shift($queue);
            }

            $this->box($x, $this->y, $this->width, self::PAD * 2 + $headH + max(0.0, $used - 6));
            $y = $this->y + self::PAD;
            if ($headH > 0.0) {
                $this->pdf->text($x + self::PAD, $y + 10, (string) $card['heading'], [
                    'size' => 11.5, 'font' => Pdf::BOLD, 'color' => $card['color'] ?? self::INK,
                ]);
                $y += $headH;
            }
            foreach ($run as $child) {
                $y += $this->block($child, $x + self::PAD, $y, $inner, true) + 6;
            }

            $this->y += self::PAD * 2 + $headH + max(0.0, $used - 6) + self::GAP;
            $first = false;
        }
    }

    /** Measure or draw one block. Returns its height. */
    private function block(array $b, float $x, float $y, float $w, bool $draw): float
    {
        switch ($b['kind'] ?? '') {
            case 'card':    return $this->card($b, $x, $y, $w, $draw);
            case 'stats':   return $this->stats($b, $x, $y, $w, $draw);
            case 'chart':   return $this->chart($b, $x, $y, $w, $draw);
            case 'bars':    return $this->bars($b, $x, $y, $w, $draw);
            case 'rows':    return $this->rows($b, $x, $y, $w, $draw);
            case 'heading':
                if ($draw) {
                    $this->pdf->text($x, $y + 11, (string) $b['text'], [
                        'size' => 11.5, 'font' => Pdf::BOLD, 'color' => $b['color'] ?? self::INK,
                    ]);
                }
                return 18.0;
            case 'para':
                $faint = (bool) ($b['faint'] ?? false);
                $size  = $faint ? 8.6 : 9.6;
                $color = $b['color'] ?? ($faint ? self::FAINT : self::BODY);
                $align = ($b['align'] ?? 'left') === 'center' ? 'center' : 'left';
                $end   = $this->paragraph((string) $b['text'], $x, $y, $w, $size, $color, Pdf::REGULAR, $align, $draw);
                return $end - $y + 4;
            case 'rule':
                if ($draw) {
                    $this->pdf->line($x, $y + 6, $x + $w, $y + 6, ['color' => self::BORDER, 'width' => 0.6]);
                }
                return 13.0;
        }
        return 0.0;
    }

    /* ── Blocks ─────────────────────────────────────────────────── */

    private function card(array $b, float $x, float $y, float $w, bool $draw): float
    {
        $inner   = $w - self::PAD * 2;
        $cursor  = self::PAD;
        $heading = (string) ($b['heading'] ?? '');

        if ($heading !== '') {
            $cursor += 20;
        }
        $parts = [];
        foreach ($b['blocks'] ?? [] as $child) {
            $h = $this->block($child, $x + self::PAD, $y + $cursor, $inner, false);
            $parts[] = [$child, $cursor, $h];
            $cursor += $h + 6;
        }
        $height = $cursor - ($parts === [] ? 0 : 6) + self::PAD;

        if ($draw) {
            $this->box($x, $y, $w, $height);
            if ($heading !== '') {
                $this->pdf->text($x + self::PAD, $y + self::PAD + 11, $heading, [
                    'size' => 11.5, 'font' => Pdf::BOLD, 'color' => $b['color'] ?? self::INK,
                ]);
            }
            foreach ($parts as [$child, $at, $h]) {
                $this->block($child, $x + self::PAD, $y + $at, $inner, true);
            }
        }
        return $height;
    }

    /** The value-over-label band: four figures across, or three. */
    private function stats(array $b, float $x, float $y, float $w, bool $draw): float
    {
        $items = $b['items'];
        $big   = ($b['size'] ?? 'lg') === 'lg';
        $cols  = max(1, (int) ($b['cols'] ?? count($items)));
        $cell  = $w / $cols;
        $vSize = $big ? 20.0 : 11.5;

        if ($draw) {
            foreach ($items as $i => $item) {
                $cx = $x + $cell * ($i % $cols) + $cell / 2;
                $row = (int) floor($i / $cols);
                $top = $y + $row * ($big ? 46 : 34);
                $this->pdf->text($cx, $top + $vSize, (string) $item['value'], [
                    'size' => $vSize, 'font' => Pdf::BOLD, 'align' => 'center',
                    'color' => $item['color'] ?? self::INK,
                ]);
                $this->pdf->text($cx, $top + $vSize + 12, (string) $item['label'], [
                    'size' => 8, 'align' => 'center', 'color' => self::FAINT,
                ]);
            }
        }
        $rows = (int) ceil(count($items) / $cols);
        return $rows * ($big ? 46 : 34);
    }

    /**
     * A chart, redrawn from the app's own SVG primitives.
     *
     * The viewBox is mapped onto the column: one scale factor for both axes,
     * for font sizes and for dash patterns, so nothing is distorted relative
     * to anything else.
     */
    private function chart(array $b, float $x, float $y, float $w, bool $draw): float
    {
        /* Inset from the card's text column. A chart that runs to the same
           edge as the paragraph above it reads as part of the paragraph;
           held in slightly, it reads as a figure. */
        $x    += self::CHART_INSET;
        $w     = max(60.0, $w - self::CHART_INSET * 2);
        $scale = $w / max(1.0, (float) $b['w']);
        $h     = (float) $b['h'] * $scale;
        if (!$draw) {
            return $h + 4;
        }

        $X = fn(float $v): float => $x + $v * $scale;
        $Y = fn(float $v): float => $y + $v * $scale;

        foreach ($b['ops'] as $op) {
            switch ($op['op']) {
                case 'line':
                    [$color, $alpha] = $this->paper((string) $op['stroke'], (float) $op['alpha'], false);
                    $this->pdf->line($X($op['x1']), $Y($op['y1']), $X($op['x2']), $Y($op['y2']), [
                        'color' => $color,
                        'alpha' => $alpha,
                        'width' => max(0.4, (float) $op['width'] * $scale),
                        'dash'  => array_map(fn($d) => $d * $scale, $op['dash']),
                    ]);
                    break;
                case 'rect':
                    [$color, $alpha] = $this->paper((string) $op['fill'], (float) $op['alpha'], false);
                    $this->pdf->rect($X($op['x']), $Y($op['y']), (float) $op['w'] * $scale, (float) $op['h'] * $scale, [
                        'fill'   => $color,
                        'alpha'  => $alpha,
                        'radius' => (float) $op['rx'] * $scale,
                    ]);
                    break;
                case 'circle':
                    [$color, $alpha] = $this->paper((string) $op['fill'], 1.0, false);
                    $this->pdf->circle($X($op['cx']), $Y($op['cy']), (float) $op['r'] * $scale, [
                        'fill' => $color, 'alpha' => $alpha,
                    ]);
                    break;
                case 'path':
                    [$color, $alpha] = $this->paper((string) $op['stroke'], 1.0, false);
                    $points = [];
                    foreach ($op['points'] as $p) {
                        $points[] = [$X($p[0]), $Y($p[1])];
                    }
                    $this->pdf->polyline($points, [
                        'color' => $color,
                        'alpha' => $alpha,
                        'width' => max(0.5, (float) $op['width'] * $scale),
                        'cap'   => 1,
                    ]);
                    break;
                case 'text':
                    [$color, $alpha] = $this->paper((string) $op['fill'], 1.0, true);
                    $this->pdf->text($X($op['x']), $Y($op['y']), (string) $op['text'], [
                        'size'  => max(5.5, (float) $op['size'] * $scale),
                        'font'  => $op['bold'] ? Pdf::BOLD : Pdf::REGULAR,
                        'color' => $color,
                        'alpha' => $alpha,
                        'align' => $op['anchor'] === 'middle' ? 'center' : ($op['anchor'] === 'end' ? 'right' : 'left'),
                    ]);
                    break;
            }
        }
        return $h + 4;
    }

    /** Workload: a chip of initials, a name, a two-tone bar, and the counts. */
    private function bars(array $b, float $x, float $y, float $w, bool $draw): float
    {
        $rowH   = 19.0;
        $nameW  = 112.0;
        $valueW = 104.0;
        $barX   = $x + 24 + $nameW;
        $barW   = max(40.0, $w - 24 - $nameW - $valueW - 14);

        if ($draw) {
            foreach ($b['rows'] as $i => $r) {
                $mid = $y + $i * $rowH + $rowH / 2;

                $avatar = (string) ($r['avatar'] ?? self::FAINT);
                $this->pdf->circle($x + 8, $mid, 8, ['fill' => $avatar]);
                $this->pdf->text($x + 8, $mid + 2.4, mb_substr((string) $r['initials'], 0, 2), [
                    'size' => 6.5, 'font' => Pdf::BOLD, 'align' => 'center',
                    'color' => $this->readable($avatar),
                ]);

                $this->pdf->text($x + 24, $mid + 3, (string) $r['label'], ['size' => 9.2, 'color' => self::INK]);
                $this->segments($r['segments'], $barX, $mid - 4.5, $barW, 9);
                $this->pdf->text($x + $w, $mid + 2.6, (string) $r['value'], [
                    'size' => 8.4, 'color' => self::FAINT, 'align' => 'right',
                ]);
            }
        }
        return count($b['rows']) * $rowH + 2;
    }

    /** Label on the left, value on the right, a hairline between each. */
    private function rows(array $b, float $x, float $y, float $w, bool $draw): float
    {
        $rowH = 17.0;
        if ($draw) {
            foreach ($b['items'] as $i => $r) {
                $top = $y + $i * $rowH;
                $this->pdf->line($x, $top, $x + $w, $top, ['color' => self::BORDER, 'width' => 0.5]);
                $this->pdf->text($x, $top + 12, (string) $r['label'], [
                    'size' => 9.2, 'color' => $r['color'] ?? self::INK,
                ]);
                $this->pdf->text($x + $w, $top + 12, (string) $r['value'], [
                    'size' => 8.4, 'color' => self::FAINT, 'align' => 'right',
                ]);
            }
        }
        return count($b['items']) * $rowH + 4;
    }

    /* ── Pieces ─────────────────────────────────────────────────── */

    /**
     * A proportional bar.
     *
     * Drawn back to front — the full run in the LAST colour, then each earlier
     * segment over it — so every boundary keeps the rounded cap the track has,
     * without the PDF clipping path the app gets free from `overflow:hidden`.
     *
     * @param array<int,array{pct:float,color:string,alpha:float}> $segments
     */
    private function segments(array $segments, float $x, float $y, float $w, float $h): void
    {
        $this->pdf->rect($x, $y, $w, $h, ['fill' => self::TRACK, 'radius' => $h / 2]);

        $running = 0.0;
        $stops   = [];
        foreach ($segments as $s) {
            $running += max(0.0, (float) $s['pct']);
            $stops[] = ['end' => min(100.0, $running), 'color' => (string) $s['color'], 'alpha' => (float) ($s['alpha'] ?? 1)];
        }
        foreach (array_reverse($stops) as $stop) {
            $width = $w * $stop['end'] / 100;
            if ($width <= 0.2) {
                continue;
            }
            $this->pdf->rect($x, $y, max($width, $h / 2), $h, [
                'fill'   => $stop['color'],
                'alpha'  => $stop['alpha'],
                'radius' => $h / 2,
            ]);
        }
    }

    /** A bordered card box. */
    private function box(float $x, float $y, float $w, float $h): void
    {
        $this->pdf->rect($x, $y, $w, $h, [
            'fill' => '#ffffff', 'stroke' => self::BORDER, 'width' => 0.7, 'radius' => 5,
        ]);
    }

    /** Wrapped text. Returns the y below the last line. */
    private function paragraph(
        string $text,
        float $x,
        float $y,
        float $w,
        float $size,
        string $color,
        string $font = Pdf::REGULAR,
        string $align = 'left',
        bool $draw = true
    ): float {
        $lines  = $this->pdf->wrap($text, $w, $size, $font);
        $lead   = $size * 1.45;
        $anchor = $align === 'center' ? $x + $w / 2 : $x;

        foreach ($lines as $i => $line) {
            if ($draw) {
                $this->pdf->text($anchor, $y + $lead * ($i + 1) - $size * 0.28, $line, [
                    'size' => $size, 'font' => $font, 'color' => $color, 'align' => $align,
                ]);
            }
        }
        return $y + $lead * count($lines);
    }

    /* ── Colour ─────────────────────────────────────────────────── */

    /**
     * A screen colour as it should appear on paper.
     *
     * The app's charts are drawn for a dark ground, so their scaffolding —
     * gridlines, bar tracks, the labels sitting over the bars — is nearly
     * white, sometimes at 3% opacity. Printed as given, all of it is invisible.
     * Anything that light is therefore replaced by its paper equivalent: text
     * becomes ink, and a faint shape becomes a faint warm grey chosen by how
     * faint it was. Everything else — gold, teal, the phase colours, the stone
     * grey of the axis labels — is already legible on white and passes through
     * untouched, because those colours carry meaning and changing them would
     * change what the chart says.
     *
     * @return array{0:string,1:float} the colour, and the alpha to draw it at
     */
    private function paper(string $spec, float $alpha, bool $isText): array
    {
        $rgba = $this->pdf->color($spec);
        $a    = max(0.0, min(1.0, $alpha * ($rgba[3] ?? 1.0)));
        $lum  = 0.299 * $rgba[0] + 0.587 * $rgba[1] + 0.114 * $rgba[2];

        if ($lum <= 0.82) {
            return [$spec, $a];
        }
        if ($isText) {
            return [self::INK, 1.0];
        }
        /* A faint light shape becomes a faint dark one, in three steps rather
           than by arithmetic: composited honestly, a 3% white would come out
           at 3% black and stay invisible. */
        if ($a <= 0.06) {
            return ['#f1eee7', 1.0];
        }
        return [$a <= 0.15 ? '#e8e4dc' : '#dcd7ce', 1.0];
    }

    /** Ink or white lettering, whichever stays legible on $background. */
    private function readable(string $background): string
    {
        $rgb = $this->pdf->color($background);
        return (0.299 * $rgb[0] + 0.587 * $rgb[1] + 0.114 * $rgb[2]) > 0.62 ? self::INK : '#ffffff';
    }
}
