<?php
namespace Core;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;

/**
 * ReportDocument — the Module Management analytics report, read out of the
 * markup the app sent and held as a structure two renderers can draw.
 *
 * ── Why this exists ────────────────────────────────────────────
 * js/features/email.js posts the report as the HTML the app draws on SCREEN:
 * class names against assets/css/styles.css, CSS custom properties, a dark
 * ground, and two charts as inline <svg>. An inbox has none of that. Mail
 * clients drop <link> and most <style>, so every class-driven rule is gone;
 * Gmail and Outlook strip <svg> outright, so both charts vanish and leave
 * their captions stranded under empty headings — which is exactly what the
 * report looked like when it arrived.
 *
 * Rewriting the app's renderer to emit mail-safe markup was the other option
 * and is the wrong one: the screen is not the constraint, and the same body
 * has to become a PDF as well. So the markup is read ONCE into blocks —
 * headings, paragraphs, stat bands, charts, bar rows, row lists — and each
 * output draws those blocks its own way:
 *
 *   Core\ReportMail   blocks -> tables and inline styles, no CSS, no SVG
 *   Core\ReportPdf    blocks -> a paginated PDF, charts redrawn as vectors
 *
 * ── Why parsing, and not a richer request ──────────────────────
 * Part 6 of the 3 Sep 2026 directive fixes the request at eight fields, so the
 * service cannot ask the app for the numbers behind the report; `html` is what
 * it is given. That is a smaller problem than it sounds: this is not a general
 * HTML parser, it is a reader for markup THIS codebase generates, in
 * js/pages/navigate.js, one function away from here in the same repository.
 *
 * It is still written to bend rather than break. Every recognizer is a
 * best-effort match on a marker (a class, a grid template, an SVG tag), and
 * anything unrecognized falls through to `walk()`, which descends into
 * children and emits their text as paragraphs. A card this file has never seen
 * comes out plain rather than missing, and Core\ReportMail's caller keeps the
 * original HTML for the case where nothing parses at all.
 */
class ReportDocument
{
    /**
     * CSS custom properties the report's inline styles reference. Resolved to
     * the LIGHT theme's values (assets/css/styles.css, the :root block), which
     * is the right choice for both outputs: mail is read on a white ground and
     * paper is white.
     */
    private const VARS = [
        'var(--ph1-t)'    => '#1B6B5A',
        'var(--ph2-t)'    => '#2D5A8E',
        'var(--warn-text)' => '#8F6A00',
        'var(--paper)'    => '#1c1a17',
        'var(--ink)'      => '#1c1a17',
    ];

    /** The four cards that make the analytics tab, used to sanity-check input. */
    private const MARKERS = ['90-Day Burn-up', 'Module Velocity', 'Workload by Member', 'Signals'];

    /** @var array<int,array<string,mixed>> */
    private array $blocks = [];

    private string $subject    = '';
    private string $title      = '';
    private string $lead       = '';
    private string $standfirst = '';
    private string $badge      = '';
    private ?string $badgeColor = null;

    private function __construct()
    {
    }

    /**
     * Read a notification body.
     *
     * Returns null when the markup cannot be loaded at all — the caller then
     * falls back to sending what it was given, which is what happened before
     * this class existed and is never worse than it.
     */
    public static function parse(string $html): ?self
    {
        $html = trim($html);
        if ($html === '') {
            return null;
        }

        $doc  = new DOMDocument();
        $prev = libxml_use_internal_errors(true);
        /* Wrapped in a whole document rather than loaded as a fragment: the
           meta tag is how libxml is told these bytes are UTF-8 (without it it
           assumes Latin-1, and every en dash in the report arrives as two
           mojibake characters), and a document with a <head> is the only place
           a meta tag can sit. Fragment mode would keep the meta and throw the
           report away — it takes the first root element and drops the rest. */
        $ok = $doc->loadHTML(
            '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>'
            . '<body>' . $html . '</body></html>',
            LIBXML_NOERROR | LIBXML_NOWARNING
        );
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        $body = $doc->getElementsByTagName('body')->item(0);
        if (!$ok || $body === null) {
            return null;
        }

        $self = new self();
        foreach (iterator_to_array($body->childNodes) as $node) {
            $self->walk($node, $self->blocks);
        }
        $self->blocks = $self->coalesce($self->blocks);
        $self->hoist();

        return $self;
    }

    /** True when all four analytics cards are present — the report, not a tab of it. */
    public function isAnalytics(): bool
    {
        $headings = [];
        $collect = function (array $blocks) use (&$collect, &$headings): void {
            foreach ($blocks as $b) {
                if (($b['kind'] ?? '') === 'card') {
                    $headings[] = (string) ($b['heading'] ?? '');
                    $collect($b['blocks'] ?? []);
                }
            }
        };
        $collect($this->blocks);

        foreach (self::MARKERS as $marker) {
            if (!in_array($marker, $headings, true)) {
                return false;
            }
        }
        return true;
    }

    /** @return array<int,array<string,mixed>> */
    public function blocks(): array
    {
        return $this->blocks;
    }

    /** The completion notice's own heading — the subject line, repeated in the body. */
    public function subject(): string
    {
        return $this->subject;
    }

    /** The report's title, e.g. "Module Management". */
    public function title(): string
    {
        return $this->title !== '' ? $this->title : 'Module Management';
    }

    /** The sentence under the subject: what happened, and when. */
    public function lead(): string
    {
        return $this->lead;
    }

    /** The line under the title, saying what the report covers. */
    public function standfirst(): string
    {
        return $this->standfirst;
    }

    /** The status chip beside the title — "Ongoing" — and its colour. */
    public function badge(): string
    {
        return $this->badge;
    }

    public function badgeColor(): string
    {
        return $this->badgeColor ?? '#6B4C8A';
    }

    /**
     * The report's headline figures, for a cover page or a summary line.
     *
     * @return array<int,array{value:string,label:string,color:?string}>
     */
    public function headline(): array
    {
        foreach ($this->blocks as $b) {
            if (($b['kind'] ?? '') === 'card') {
                foreach ($b['blocks'] ?? [] as $inner) {
                    if (($inner['kind'] ?? '') === 'stats' && ($inner['size'] ?? '') === 'lg') {
                        return $inner['items'];
                    }
                }
            }
        }
        return [];
    }

    /* ── Walking the markup ─────────────────────────────────────── */

    /** @param array<int,array<string,mixed>> $sink */
    private function walk(DOMNode $node, array &$sink): void
    {
        if ($node->nodeType === XML_TEXT_NODE) {
            $text = $this->clean($node->textContent);
            if ($text !== '') {
                $sink[] = ['kind' => 'para', 'text' => $text];
            }
            return;
        }
        if (!$node instanceof DOMElement) {
            return;
        }

        $block = $this->recognize($node);
        if ($block !== null) {
            $sink[] = $block;
            return;
        }
        foreach (iterator_to_array($node->childNodes) as $child) {
            $this->walk($child, $sink);
        }
    }

    /**
     * One element to one block, or null to mean "look inside this".
     *
     * Order matters: the specific markers (an SVG, a card, a stat grid) are
     * tried before the generic tags, because a card IS a div and a stat band is
     * a div of divs.
     */
    private function recognize(DOMElement $el): ?array
    {
        $tag = strtolower($el->tagName);

        if ($tag === 'svg') {
            return $this->chart($el);
        }
        if ($tag === 'hr') {
            return ['kind' => 'rule'];
        }
        if ($tag === 'script' || $tag === 'style' || $tag === 'button' || $tag === 'input' || $tag === 'meta') {
            /* Dead UI in a document: the tab switcher, the date pickers and the
               assign buttons all exist to be clicked, and nothing in an inbox
               or on paper can be. */
            return ['kind' => 'skip'];
        }
        if ($this->hasClass($el, 'cd')) {
            return $this->card($el);
        }
        if ($this->hasClass($el, 'row-line')) {
            return $this->row($el);
        }
        if ($this->hasClass($el, 'bg')) {
            return [
                'kind'  => 'badge',
                'text'  => $this->clean($el->textContent),
                'color' => $this->color($this->styleOf($el, '--c') ?: '#6B4C8A'),
            ];
        }

        $stats = $this->stats($el);
        if ($stats !== null) {
            return $stats;
        }
        $bar = $this->barRow($el);
        if ($bar !== null) {
            return $bar;
        }

        if ($tag === 'h1') {
            return ['kind' => 'title', 'text' => $this->clean($el->textContent)];
        }
        if ($tag === 'h2') {
            return ['kind' => 'subject', 'text' => $this->clean($el->textContent)];
        }
        if ($tag === 'h3' || $tag === 'h4') {
            return [
                'kind'  => 'heading',
                'text'  => $this->clean($el->textContent),
                'color' => $this->color($this->styleOf($el, 'color')),
            ];
        }
        if ($tag === 'p') {
            $text = $this->clean($el->textContent);
            return $text === '' ? ['kind' => 'skip'] : [
                'kind'  => 'para',
                'text'  => $text,
                'faint' => $this->hasClass($el, 't-faint-sm') || $this->hasClass($el, 't-stone-md'),
                'align' => $this->styleOf($el, 'text-align') ?: 'left',
                'color' => $this->color($this->styleOf($el, 'color')),
            ];
        }

        /* A leaf with text and no element children of its own: a caption, a
           value, a stray label. Anything with children is descended into. */
        if (!$this->hasElementChild($el)) {
            $text = $this->clean($el->textContent);
            return $text === '' ? ['kind' => 'skip'] : [
                'kind'  => 'para',
                'text'  => $text,
                'faint' => $this->hasClass($el, 't-faint-sm'),
                'align' => $this->styleOf($el, 'text-align') ?: 'left',
                'color' => $this->color($this->styleOf($el, 'color')),
            ];
        }

        return null;
    }

    /** A bordered card: its <h3> becomes the heading, the rest its body. */
    private function card(DOMElement $el): array
    {
        $heading = '';
        $color   = null;
        $blocks  = [];

        foreach (iterator_to_array($el->childNodes) as $child) {
            if ($heading === '' && $child instanceof DOMElement
                && in_array(strtolower($child->tagName), ['h1', 'h2', 'h3', 'h4'], true)) {
                $heading = $this->clean($child->textContent);
                $color   = $this->color($this->styleOf($child, 'color'));
                continue;
            }
            $this->walk($child, $blocks);
        }

        return [
            'kind'    => 'card',
            'heading' => $heading,
            'color'   => $color,
            'blocks'  => $this->coalesce($blocks),
        ];
    }

    /**
     * A band of value-over-label figures — the four-up stat tiles at the top of
     * the report and the three-up Signals counts are the same shape at two
     * sizes, so they are the same block.
     */
    private function stats(DOMElement $el): ?array
    {
        $style = $this->styleOf($el, 'grid-template-columns');
        if ($style === '' || !preg_match('/repeat\((\d+)\s*,/', $style, $m)) {
            return null;
        }

        $items = [];
        $big   = false;
        foreach (iterator_to_array($el->childNodes) as $cell) {
            if (!$cell instanceof DOMElement) {
                continue;
            }
            $kids = [];
            foreach ($cell->childNodes as $k) {
                if ($k instanceof DOMElement) {
                    $kids[] = $k;
                }
            }
            if (count($kids) < 2) {
                return null;                       // not a value/label pair
            }
            $big = $big || $this->hasClass($kids[0], 'score-num-md');
            $items[] = [
                'value' => $this->clean($kids[0]->textContent),
                'label' => $this->clean($kids[1]->textContent),
                'color' => $this->color($this->styleOf($kids[0], 'color')),
            ];
        }

        return $items === [] ? null : [
            'kind'  => 'stats',
            'cols'  => (int) $m[1],
            'size'  => $big ? 'lg' : 'sm',
            'items' => $items,
        ];
    }

    /**
     * One member's workload: avatar, name, a proportional bar of open and
     * completed work, and the count. Recognized by the bar track — a flex row
     * with a clipped, rounded strip inside it.
     */
    private function barRow(DOMElement $el): ?array
    {
        if (strpos($this->styleOf($el, 'display'), 'flex') === false) {
            return null;
        }

        $track = null;
        foreach ($el->getElementsByTagName('div') as $div) {
            if (strpos($this->styleOf($div, 'overflow'), 'hidden') !== false
                && $this->styleOf($div, 'height') !== '') {
                $track = $div;
                break;
            }
        }
        if ($track === null) {
            return null;
        }

        $segments = [];
        foreach ($track->childNodes as $seg) {
            if (!$seg instanceof DOMElement) {
                continue;
            }
            $pct = (float) rtrim($this->styleOf($seg, 'width'), '%');
            if ($pct <= 0) {
                continue;
            }
            $segments[] = [
                'pct'   => $pct,
                'color' => $this->color($this->styleOf($seg, 'background')) ?: '#8b8579',
                'alpha' => (float) ($this->styleOf($seg, 'opacity') ?: 1),
            ];
        }

        $xp     = new DOMXPath($el->ownerDocument);
        $avatar = $xp->query(".//*[contains(concat(' ', normalize-space(@class), ' '), ' user-av ')]", $el)->item(0);
        $label  = $xp->query(".//*[contains(concat(' ', normalize-space(@class), ' '), ' fs-13 ')]", $el)->item(0);
        $value  = $xp->query(".//*[contains(concat(' ', normalize-space(@class), ' '), ' t-faint-sm ')]", $el)->item(0);

        return [
            'kind'     => 'barrow',
            'label'    => $label ? $this->clean($label->textContent) : '',
            'value'    => $value ? $this->clean($value->textContent) : '',
            'initials' => $avatar ? $this->clean($avatar->textContent) : '',
            'avatar'   => $avatar instanceof DOMElement ? $this->color($this->styleOf($avatar, 'background')) : null,
            'segments' => $segments,
        ];
    }

    /** A label/value line — the phase completion list under Signals. */
    private function row(DOMElement $el): array
    {
        $parts = [];
        foreach ($el->childNodes as $child) {
            if ($child instanceof DOMElement) {
                $parts[] = [
                    'text'  => $this->clean($child->textContent),
                    'color' => $this->color($this->styleOf($child, 'color')),
                ];
            }
        }
        return [
            'kind'  => 'rowline',
            'label' => $parts[0]['text'] ?? $this->clean($el->textContent),
            'color' => $parts[0]['color'] ?? null,
            'value' => $parts[1]['text'] ?? '',
        ];
    }

    /* ── Charts ─────────────────────────────────────────────────── */

    /**
     * An <svg> chart, kept twice over.
     *
     * `ops` is every primitive in viewBox coordinates, which Core\ReportPdf
     * redraws as real vectors — the chart on paper is the chart on screen, to
     * the point.
     *
     * `bars` and `progress` are what mail gets instead, because no mail client
     * will render the SVG: the series is recovered from the <title> tooltips
     * the app already writes on every bar ("Week 2: 2 steps"), and the burn-up
     * from its own TODAY marker. A chart whose data cannot be recovered still
     * has its caption and the attached PDF.
     */
    private function chart(DOMElement $svg): array
    {
        /* libxml's HTML parser lower-cases attribute names, and DOMElement's
           lookup is case-sensitive — so the camel-cased `viewBox` is only ever
           found as `viewbox`. Asking for the spelling in the markup returns
           nothing, and the chart silently takes the fallback box instead of
           its own, which is 20pt of dead space under the velocity chart and a
           page break that did not need to happen. */
        $box = preg_split(
            '/[\s,]+/',
            trim($svg->getAttribute('viewBox') ?: ($svg->getAttribute('viewbox') ?: '0 0 560 190'))
        );
        $ops = [];
        $this->svgOps($svg, $ops);

        $bars = $this->series($svg, $ops, (float) ($box[3] ?? 190));

        $progress = null;
        foreach ($svg->getElementsByTagName('text') as $text) {
            if (preg_match('/(\d+)\s*\/\s*(\d+)/', $text->textContent, $m)) {
                $progress = ['done' => (float) $m[1], 'total' => (float) $m[2]];
                break;
            }
        }

        return [
            'kind'     => 'chart',
            'w'        => (float) ($box[2] ?? 560),
            'h'        => (float) ($box[3] ?? 190),
            'ops'      => $ops,
            'bars'     => $bars,
            'progress' => $progress,
        ];
    }

    /**
     * The series behind a bar chart, in axis order.
     *
     * Each bar carries its own tooltip ("Week 2: 2 steps") and every column
     * carries an axis label, but a week with NO completions has only the
     * label — the app draws no bar at all. Reading the tooltips alone
     * therefore gives a velocity chart with its empty weeks silently removed,
     * which is the one thing a velocity chart is for: the gaps are the shape.
     *
     * So the two are matched geometrically, on the one relationship the markup
     * does state — a bar and its label share a column. A label with no bar
     * over it is a zero, which is the truth the chart was drawing.
     *
     * @param array<int,array<string,mixed>> $ops
     * @return array<int,array{label:string,value:float,text:string,color:string}>
     */
    private function series(DOMElement $svg, array $ops, float $height): array
    {
        $bars = [];
        foreach ($svg->getElementsByTagName('rect') as $rect) {
            $title = $this->firstChildTitle($rect);
            /* "Week 2: 2 steps" — the label is what is being counted, the
               number is the count. */
            if ($title === '' || !preg_match('/^(.*?):\s*([\d.]+)/', $title, $m)) {
                continue;
            }
            $x = (float) $rect->getAttribute('x');
            $bars[] = [
                'x'     => $x,
                'x2'    => $x + (float) $rect->getAttribute('width'),
                'label' => trim($m[1]),
                'value' => (float) $m[2],
                'text'  => $title,
                'color' => $this->color($rect->getAttribute('fill')) ?: '#8b8579',
            ];
        }
        if ($bars === []) {
            return [];
        }

        /* The axis: centred labels along the foot of the plot. */
        $axis = [];
        foreach ($ops as $op) {
            if ($op['op'] === 'text' && $op['anchor'] === 'middle' && $op['y'] > $height * 0.8 && $op['text'] !== '') {
                $axis[] = $op;
            }
        }
        if (count($axis) < count($bars)) {
            return array_map(fn(array $b): array => array_diff_key($b, ['x' => 1, 'x2' => 1]), $bars);
        }

        $series = [];
        foreach ($axis as $label) {
            $found = null;
            foreach ($bars as $bar) {
                if ($label['x'] >= $bar['x'] - 0.5 && $label['x'] <= $bar['x2'] + 0.5) {
                    $found = $bar;
                    break;
                }
            }
            $series[] = [
                'label' => $label['text'],
                'value' => $found ? $found['value'] : 0.0,
                'text'  => $found ? $found['text'] : $label['text'] . ': 0',
                'color' => $found ? $found['color'] : '#8b8579',
            ];
        }
        return $series;
    }

    /**
     * Flatten the SVG into primitives. Only the shapes the app's two charts
     * draw are understood — line, rect, circle, polyline paths and text — and
     * `d` is read as M/L only, which is all mgBurnup() ever emits.
     *
     * @param array<int,array<string,mixed>> $ops
     */
    private function svgOps(DOMNode $node, array &$ops): void
    {
        foreach ($node->childNodes as $child) {
            if (!$child instanceof DOMElement) {
                continue;
            }
            $tag = strtolower($child->tagName);
            $num = fn(string $a, float $d = 0): float => $child->hasAttribute($a) ? (float) $child->getAttribute($a) : $d;

            switch ($tag) {
                case 'line':
                    $ops[] = [
                        'op'     => 'line',
                        'x1'     => $num('x1'), 'y1' => $num('y1'),
                        'x2'     => $num('x2'), 'y2' => $num('y2'),
                        'stroke' => $child->getAttribute('stroke') ?: '#000',
                        'width'  => $num('stroke-width', 1),
                        'dash'   => $this->dash($child->getAttribute('stroke-dasharray')),
                        'alpha'  => $child->hasAttribute('stroke-opacity') ? (float) $child->getAttribute('stroke-opacity') : 1.0,
                    ];
                    break;
                case 'rect':
                    $ops[] = [
                        'op'    => 'rect',
                        'x'     => $num('x'), 'y' => $num('y'),
                        'w'     => $num('width'), 'h' => $num('height'),
                        'rx'    => $num('rx'),
                        'fill'  => $child->getAttribute('fill') ?: '#000',
                        'alpha' => $child->hasAttribute('fill-opacity') ? (float) $child->getAttribute('fill-opacity') : 1.0,
                    ];
                    break;
                case 'circle':
                    $ops[] = [
                        'op'   => 'circle',
                        'cx'   => $num('cx'), 'cy' => $num('cy'), 'r' => $num('r'),
                        'fill' => $child->getAttribute('fill') ?: '#000',
                    ];
                    break;
                case 'path':
                    $points = [];
                    preg_match_all('/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/i', $child->getAttribute('d'), $m, PREG_SET_ORDER);
                    foreach ($m as $p) {
                        $points[] = [(float) $p[1], (float) $p[2]];
                    }
                    if (count($points) > 1) {
                        $ops[] = [
                            'op'     => 'path',
                            'points' => $points,
                            'stroke' => $child->getAttribute('stroke') ?: '#000',
                            'width'  => $num('stroke-width', 1),
                        ];
                    }
                    break;
                case 'text':
                    $ops[] = [
                        'op'     => 'text',
                        'x'      => $num('x'), 'y' => $num('y'),
                        'text'   => $this->clean($child->textContent),
                        'size'   => $num('font-size', 10),
                        'anchor' => $child->getAttribute('text-anchor') ?: 'start',
                        'fill'   => $child->getAttribute('fill') ?: '#000',
                        'bold'   => (int) $child->getAttribute('font-weight') >= 600,
                    ];
                    break;
                case 'g':
                    $this->svgOps($child, $ops);
                    break;
            }
        }
    }

    private function dash(string $spec): array
    {
        $spec = trim($spec);
        if ($spec === '') {
            return [];
        }
        return array_map('floatval', preg_split('/[\s,]+/', $spec) ?: []);
    }

    private function firstChildTitle(DOMElement $el): string
    {
        foreach ($el->childNodes as $child) {
            if ($child instanceof DOMElement && strtolower($child->tagName) === 'title') {
                return $this->clean($child->textContent);
            }
        }
        return '';
    }

    /* ── Tidying ────────────────────────────────────────────────── */

    /**
     * Drop the skips, and gather the runs: consecutive workload rows become one
     * bar chart, consecutive row-lines become one list. Both are drawn as a
     * unit — a bar chart needs every row's proportions to size itself, and a
     * list needs its rows' labels to line up.
     *
     * @param array<int,array<string,mixed>> $blocks
     * @return array<int,array<string,mixed>>
     */
    private function coalesce(array $blocks): array
    {
        $out = [];
        foreach ($blocks as $b) {
            $kind = $b['kind'] ?? '';
            if ($kind === 'skip') {
                continue;
            }
            $last = $out === [] ? null : count($out) - 1;

            if ($kind === 'barrow') {
                if ($last !== null && $out[$last]['kind'] === 'bars') {
                    $out[$last]['rows'][] = $b;
                    continue;
                }
                $out[] = ['kind' => 'bars', 'rows' => [$b]];
                continue;
            }
            if ($kind === 'rowline') {
                if ($last !== null && $out[$last]['kind'] === 'rows') {
                    $out[$last]['items'][] = $b;
                    continue;
                }
                $out[] = ['kind' => 'rows', 'items' => [$b]];
                continue;
            }
            $out[] = $b;
        }
        return $out;
    }

    /**
     * Lift the cover out of the block flow — the subject line, the completion
     * notice, the report's badge, its title and its standfirst — so a renderer
     * can lay out a masthead instead of finding five stray blocks above the
     * first card, and so nothing is printed twice.
     *
     * The order below is the order js/features/email.js writes them in:
     * subject, notice, rule, badge, title, standfirst, then the cards.
     */
    private function hoist(): void
    {
        $kept = [];
        foreach ($this->blocks as $b) {
            $kind  = $b['kind'] ?? '';
            $faint = (bool) ($b['faint'] ?? false);

            if ($kind === 'rule') {
                continue;                                   // the cover's own divider
            }
            if ($kind === 'subject' && $this->subject === '') {
                $this->subject = $b['text'];
                continue;
            }
            if ($kind === 'title' && $this->title === '') {
                $this->title = $b['text'];
                continue;
            }
            if ($kind === 'badge' && $this->badge === '' && $kept === []) {
                $this->badge      = $b['text'];
                $this->badgeColor = $b['color'] ?? null;
                continue;
            }
            if ($kind === 'para' && !$faint && $kept === []) {
                /* Before the title this is the completion notice; after it, the
                   line that says what the report is. */
                if ($this->title === '' && $this->lead === '') {
                    $this->lead = $b['text'];
                    continue;
                }
                if ($this->title !== '' && $this->standfirst === '') {
                    $this->standfirst = $b['text'];
                    continue;
                }
            }
            $kept[] = $b;
        }

        $this->blocks = $kept;
    }

    /* ── Small helpers ──────────────────────────────────────────── */

    private function hasClass(DOMElement $el, string $class): bool
    {
        return in_array($class, preg_split('/\s+/', trim($el->getAttribute('class'))) ?: [], true);
    }

    private function hasElementChild(DOMElement $el): bool
    {
        foreach ($el->childNodes as $child) {
            if ($child instanceof DOMElement) {
                return true;
            }
        }
        return false;
    }

    /** One declaration out of an inline style attribute. */
    private function styleOf(DOMElement $el, string $prop): string
    {
        $style = $el->getAttribute('style');
        if ($style === '') {
            return '';
        }
        foreach (explode(';', $style) as $decl) {
            $at = strpos($decl, ':');
            if ($at === false) {
                continue;
            }
            if (strcasecmp(trim(substr($decl, 0, $at)), $prop) === 0) {
                return trim(substr($decl, $at + 1));
            }
        }
        return '';
    }

    /**
     * A colour the outputs can use: hex through unchanged, custom properties
     * resolved, anything else (a gradient, an unknown function) refused rather
     * than half-understood.
     */
    private function color(string $spec): ?string
    {
        $spec = trim($spec);
        if ($spec === '') {
            return null;
        }
        if (isset(self::VARS[$spec])) {
            return self::VARS[$spec];
        }
        if (preg_match('/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i', $spec)) {
            return $spec;
        }
        if (preg_match('/^rgba?\([\d\s.,]+\)$/i', $spec)) {
            return $spec;
        }
        return null;
    }

    /** Collapse the whitespace the app's generated markup is full of. */
    private function clean(string $s): string
    {
        return trim(preg_replace('/\s+/u', ' ', $s) ?? $s);
    }
}
