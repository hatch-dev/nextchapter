<?php
namespace Core;

/**
 * ReportMail — the analytics report as something an inbox can actually show.
 *
 * ── What was wrong ─────────────────────────────────────────────
 * The report was posted straight into the message body as the app draws it on
 * screen, and arrived as a wireframe of itself: both charts gone (Gmail,
 * Outlook and Yahoo all strip <svg>), every class-driven rule gone with the
 * stylesheet, the dark-ground colours either invisible on white or left as
 * unresolved var(--…), and the four stat tiles stacked in a column because no
 * mail client lays out CSS grid. Headings and captions survived, which is why
 * it read as a list of chart titles with nothing under them.
 *
 * ── The rules this follows ─────────────────────────────────────
 * Same three as Core\MemberInvite and Core\AssignmentNotice, which is the
 * house style for everything this application sends:
 *
 *   1. EVERY STYLE INLINE. No <style> block, no classes, no custom properties.
 *      Gmail drops <style> in the mobile clients and Outlook.com rewrites it.
 *   2. TABLES FOR LAYOUT. Not nostalgia — Outlook renders through Word, which
 *      has no flexbox and no grid. A four-up stat band is a table row.
 *   3. A LIGHT GROUND, STATED. Mail clients paint their own background behind
 *      the message, so every colour is written out rather than inherited, and
 *      the palette is the light one from assets/css/styles.css.
 *
 * The charts are redrawn as proportional bars built from table cells with a
 * bgcolor, which every client from Outlook 2007 onwards paints. They carry the
 * same numbers as the SVG — recovered by Core\ReportDocument from the tooltips
 * the app already writes on every bar — and the attached PDF carries the
 * charts themselves, drawn as real vectors.
 */
class ReportMail
{
    /* The light palette, as literals. Named here so the two renderers and the
       plain-text alternative cannot drift apart. */
    private const GROUND = '#f6f4f0';
    private const CARD   = '#ffffff';
    private const BORDER = '#e6e2da';
    private const RULE   = '#d9d5cd';
    private const INK    = '#1c1a17';
    private const BODY   = '#413d36';
    private const FAINT  = '#8b8579';
    private const GOLD   = '#B8892A';
    private const TRACK  = '#efece5';

    private const WIDTH = 640;

    /** What the message says about itself, when the caller says nothing else. */
    private const CLOSING = 'Sent automatically when a step is marked complete. The figures are calculated '
        . 'from the module itself — its completion dates, assignments and deadlines — as it stood when this was sent.';

    /**
     * The whole message.
     *
     * @param array{eyebrow?:string,attachment?:string,note?:string,closing?:string} $opts
     *        `eyebrow` is the organization and program above the subject;
     *        `attachment` the PDF's file name, when one is going with it;
     *        `note` replaces the line about the attachment when it could not
     *        be made, so the message never promises a file that is not there;
     *        `closing` the last line, for a message that is not a completion.
     */
    public static function html(ReportDocument $doc, array $opts = []): string
    {
        $eyebrow    = trim((string) ($opts['eyebrow'] ?? ''));
        $attachment = trim((string) ($opts['attachment'] ?? ''));
        $note       = trim((string) ($opts['note'] ?? ''));

        $h = '<div style="margin:0;padding:28px 12px;background:' . self::GROUND . ';font-family:Helvetica,Arial,sans-serif">'
           . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="' . self::WIDTH . '"'
           . ' style="width:' . self::WIDTH . 'px;max-width:100%;margin:0 auto;background:' . self::CARD . ';'
           . 'border:1px solid ' . self::RULE . ';border-radius:8px"><tr><td style="padding:32px 28px">';

        if ($eyebrow !== '') {
            $h .= '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:' . self::GOLD . ';'
                . 'margin:0 0 10px">' . self::e($eyebrow) . '</div>';
        }
        if ($doc->subject() !== '') {
            $h .= '<h1 style="margin:0 0 8px;font-size:21px;line-height:1.32;color:' . self::INK . '">'
                . self::e($doc->subject()) . '</h1>';
        }
        if ($doc->lead() !== '') {
            $h .= '<p style="margin:0 0 20px;font-size:14.5px;line-height:1.6;color:' . self::BODY . '">'
                . self::e($doc->lead()) . '</p>';
        }

        $h .= self::attachmentNote($attachment, $note);
        $h .= self::report($doc);

        return $h . '<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid ' . self::BORDER . ';'
            . 'font-size:12px;line-height:1.6;color:' . self::FAINT . '">'
            . self::e((string) ($opts['closing'] ?? self::CLOSING))
            . '</p></td></tr></table></div>';
    }

    /**
     * The report, when there is one.
     *
     * A deadline reminder carries no analytics body — it is a notice and
     * nothing else — so everything below the notice is skipped rather than
     * printed empty under a title the message does not have.
     */
    private static function report(ReportDocument $doc): string
    {
        if ($doc->blocks() === []) {
            return '';
        }

        $h = '<div style="border-top:1px solid ' . self::RULE . ';margin:0 0 22px"></div>';

        if ($doc->badge() !== '') {
            $h .= '<div style="margin:0 0 10px"><span style="display:inline-block;font-size:10.5px;'
                . 'letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:' . self::e($doc->badgeColor()) . ';'
                . 'border:1px solid ' . self::e($doc->badgeColor()) . ';border-radius:3px;padding:3px 8px">'
                . self::e($doc->badge()) . '</span></div>';
        }
        $h .= '<h2 style="margin:0 0 6px;font-size:25px;line-height:1.25;color:' . self::INK . ';font-weight:700">'
            . self::e($doc->title()) . '</h2>';
        if ($doc->standfirst() !== '') {
            $h .= '<p style="margin:0 0 22px;font-size:13.5px;line-height:1.6;color:' . self::BODY . '">'
                . self::e($doc->standfirst()) . '</p>';
        }

        return $h . self::blocks($doc->blocks());
    }

    /**
     * The plain-text alternative.
     *
     * Written out rather than stripped from the HTML: strip_tags() on a
     * table-based layout runs every cell of every bar together into one
     * unreadable line, and the text part is what a watch, a screen reader and
     * a mail client in text mode actually show.
     */
    public static function text(ReportDocument $doc, array $opts = []): string
    {
        $attachment = trim((string) ($opts['attachment'] ?? ''));
        $out = [];

        if ($doc->subject() !== '') {
            $out[] = $doc->subject();
            $out[] = str_repeat('=', min(72, mb_strlen($doc->subject())));
            $out[] = '';
        }
        if ($doc->lead() !== '') {
            $out[] = $doc->lead();
            $out[] = '';
        }
        if ($attachment !== '') {
            $out[] = 'Attached: ' . $attachment . ' — the full report, with the charts.';
            $out[] = '';
        }

        if ($doc->blocks() !== []) {
            $out[] = mb_strtoupper($doc->title());
            if ($doc->standfirst() !== '') {
                $out[] = $doc->standfirst();
            }
            $out[] = '';
            self::textBlocks($doc->blocks(), $out, '');
        }

        $out[] = '';
        $out[] = wordwrap((string) ($opts['closing'] ?? self::CLOSING), 76);

        return implode("\n", $out);
    }

    /* ── Blocks ─────────────────────────────────────────────────── */

    /** @param array<int,array<string,mixed>> $blocks */
    private static function blocks(array $blocks): string
    {
        $h = '';
        foreach ($blocks as $b) {
            switch ($b['kind']) {
                case 'card':    $h .= self::card($b); break;
                case 'stats':   $h .= self::stats($b); break;
                case 'chart':   $h .= self::chart($b); break;
                case 'bars':    $h .= self::bars($b); break;
                case 'rows':    $h .= self::rows($b); break;
                case 'heading': $h .= self::heading($b); break;
                case 'para':    $h .= self::para($b); break;
                case 'rule':    $h .= '<div style="border-top:1px solid ' . self::BORDER . ';margin:18px 0"></div>'; break;
            }
        }
        return $h;
    }

    private static function card(array $b): string
    {
        $h = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
           . ' style="width:100%;margin:0 0 16px;background:' . self::CARD . ';border:1px solid ' . self::BORDER . ';'
           . 'border-radius:6px"><tr><td style="padding:18px 18px 16px">';

        if (($b['heading'] ?? '') !== '') {
            $h .= '<h3 style="margin:0 0 8px;font-size:15px;line-height:1.35;font-weight:700;color:'
                . self::e($b['color'] ?? self::INK) . '">' . self::e($b['heading']) . '</h3>';
        }
        return $h . self::blocks($b['blocks'] ?? []) . '</td></tr></table>';
    }

    /**
     * A band of figures, as one table row of equal cells — the layout the app
     * gets from `grid-template-columns:repeat(4,1fr)`, which no mail client
     * implements.
     */
    private static function stats(array $b): string
    {
        $big   = ($b['size'] ?? 'lg') === 'lg';
        $cells = '';
        foreach ($b['items'] as $item) {
            $cells .= '<td align="center" valign="top" style="padding:6px 4px">'
                . '<div style="font-size:' . ($big ? '23px' : '15px') . ';line-height:1.2;font-weight:700;color:'
                . self::e($item['color'] ?? self::INK) . '">' . self::e($item['value']) . '</div>'
                . '<div style="margin-top:4px;font-size:11.5px;line-height:1.4;color:' . self::FAINT . '">'
                . self::e($item['label']) . '</div></td>';
        }
        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
            . ' style="width:100%;margin:' . ($big ? '0 0 18px' : '2px 0 12px') . '"><tr>' . $cells . '</tr></table>';
    }

    /**
     * A chart, as bars.
     *
     * The SVG cannot come along — it is stripped before the reader sees it —
     * so the series Core\ReportDocument recovered is drawn with the one thing
     * every mail client can be relied on for: a table cell with a background
     * colour and a percentage width.
     */
    private static function chart(array $b): string
    {
        if (!empty($b['bars'])) {
            $max = 0.0;
            foreach ($b['bars'] as $bar) {
                $max = max($max, (float) $bar['value']);
            }
            $max = $max ?: 1.0;

            $rows = '';
            foreach ($b['bars'] as $bar) {
                $rows .= '<tr>'
                    . '<td width="64" style="width:64px;padding:3px 8px 3px 0;font-size:11.5px;color:' . self::FAINT
                    . ';white-space:nowrap">' . self::e($bar['label']) . '</td>'
                    . '<td style="padding:3px 0">' . self::bar([
                        ['pct' => (float) $bar['value'] / $max * 100, 'color' => self::e($bar['color']), 'alpha' => 1.0],
                    ]) . '</td>'
                    . '<td width="34" align="right" style="width:34px;padding:3px 0 3px 8px;font-size:12px;'
                    . 'font-weight:700;color:' . self::INK . '">' . self::e(self::num($bar['value'])) . '</td>'
                    . '</tr>';
            }
            return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
                . ' style="width:100%;margin:0 0 4px">' . $rows . '</table>';
        }

        if (!empty($b['progress'])) {
            $done  = (float) $b['progress']['done'];
            $total = max(1.0, (float) $b['progress']['total']);
            return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
                . ' style="width:100%;margin:0 0 6px"><tr>'
                . '<td style="padding:2px 0">' . self::bar([
                    ['pct' => $done / $total * 100, 'color' => self::GOLD, 'alpha' => 1.0],
                ], 14) . '</td>'
                . '<td width="118" align="right" style="width:118px;padding:2px 0 2px 10px;font-size:12px;'
                . 'color:' . self::INK . '"><strong>' . self::num($done) . ' of ' . self::num($total)
                . '</strong> complete</td></tr></table>';
        }

        /* Neither form recovered: say where the chart is rather than leaving a
           caption under nothing, which is the bug this class exists to fix. */
        return '<p style="margin:2px 0 6px;font-size:12px;line-height:1.55;color:' . self::FAINT . '">'
            . 'This chart is in the attached PDF.</p>';
    }

    /** Workload rows: avatar, name, a two-tone bar, and the counts. */
    private static function bars(array $b): string
    {
        $rows = '';
        foreach ($b['rows'] as $r) {
            $rows .= '<tr>'
                . '<td width="26" valign="middle" style="width:26px;padding:4px 8px 4px 0">'
                . self::avatar((string) $r['initials'], (string) ($r['avatar'] ?? self::FAINT)) . '</td>'
                . '<td width="128" valign="middle" style="width:128px;padding:4px 8px 4px 0;font-size:12.5px;'
                . 'color:' . self::INK . '">' . self::e($r['label']) . '</td>'
                . '<td valign="middle" style="padding:4px 0">' . self::bar($r['segments']) . '</td>'
                . '<td width="126" align="right" valign="middle" style="width:126px;padding:4px 0 4px 10px;'
                . 'font-size:11.5px;color:' . self::FAINT . ';white-space:nowrap">' . self::e($r['value']) . '</td>'
                . '</tr>';
        }
        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
            . ' style="width:100%;margin:0 0 4px">' . $rows . '</table>';
    }

    private static function rows(array $b): string
    {
        $rows = '';
        foreach ($b['items'] as $r) {
            $rows .= '<tr style="border-top:1px solid ' . self::BORDER . '">'
                . '<td valign="top" style="padding:7px 10px 7px 0;font-size:12.5px;color:'
                . self::e($r['color'] ?? self::INK) . '">' . self::e($r['label']) . '</td>'
                . '<td align="right" valign="top" style="padding:7px 0;font-size:11.5px;color:' . self::FAINT . '">'
                . self::e($r['value']) . '</td></tr>';
        }
        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
            . ' style="width:100%;margin:8px 0 0;border-collapse:collapse">' . $rows . '</table>';
    }

    private static function heading(array $b): string
    {
        return '<h3 style="margin:14px 0 6px;font-size:14.5px;font-weight:700;color:'
            . self::e($b['color'] ?? self::INK) . '">' . self::e($b['text']) . '</h3>';
    }

    private static function para(array $b): string
    {
        $faint = (bool) ($b['faint'] ?? false);
        return '<p style="margin:0 0 10px;font-size:' . ($faint ? '12px' : '13.5px') . ';line-height:1.55;'
            . 'text-align:' . ((($b['align'] ?? 'left') === 'center') ? 'center' : 'left') . ';color:'
            . self::e($b['color'] ?? ($faint ? self::FAINT : self::BODY)) . '">' . self::e($b['text']) . '</p>';
    }

    /* ── Pieces ─────────────────────────────────────────────────── */

    /**
     * One proportional bar.
     *
     * A row of cells whose widths are percentages, with the remainder as an
     * empty cell so the track shows through. `font-size:0;line-height:0` is
     * what stops Outlook giving an empty cell a line box and turning a 10px
     * bar into a 20px one.
     *
     * @param array<int,array{pct:float,color:string,alpha:float}> $segments
     */
    private static function bar(array $segments, int $height = 11): string
    {
        $cells = '';
        $used  = 0.0;
        foreach ($segments as $s) {
            $pct = max(0.0, min(100.0 - $used, (float) $s['pct']));
            if ($pct <= 0) {
                continue;
            }
            $used += $pct;
            $cells .= '<td width="' . self::pct($pct) . '%" bgcolor="' . self::e(self::flatten($s['color'], (float) ($s['alpha'] ?? 1)))
                . '" style="width:' . self::pct($pct) . '%;height:' . $height . 'px;line-height:0;font-size:0">&nbsp;</td>';
        }
        if ($used < 100) {
            $cells .= '<td style="height:' . $height . 'px;line-height:0;font-size:0">&nbsp;</td>';
        }
        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
            . ' style="width:100%;height:' . $height . 'px;background:' . self::TRACK . ';border-radius:'
            . round($height / 2) . 'px;border-collapse:separate"><tr>' . $cells . '</tr></table>';
    }

    /** The member's initials chip. Round where the client allows it, square where it does not. */
    private static function avatar(string $initials, string $background): string
    {
        $bg = self::flatten($background, 1.0);
        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="24"'
            . ' style="width:24px;height:24px"><tr><td align="center" valign="middle" bgcolor="' . self::e($bg) . '"'
            . ' style="width:24px;height:24px;border-radius:12px;font-size:9px;font-weight:700;color:'
            . self::e(self::readable($bg)) . '">' . self::e(mb_substr($initials, 0, 2)) . '</td></tr></table>';
    }

    private static function attachmentNote(string $attachment, string $note): string
    {
        if ($attachment === '' && $note === '') {
            return '';
        }
        $text = $attachment !== ''
            ? '<strong style="color:' . self::INK . '">' . self::e($attachment) . '</strong> is attached — '
              . 'the full report, laid out for print, with both charts drawn in full.'
            : self::e($note);

        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"'
            . ' style="width:100%;margin:0 0 22px"><tr>'
            . '<td style="padding:12px 14px;background:#faf7f0;border:1px solid #ecdfc4;border-left:3px solid '
            . self::GOLD . ';border-radius:4px;font-size:12.5px;line-height:1.55;color:' . self::BODY . '">'
            . $text . '</td></tr></table>';
    }

    /* ── Small helpers ──────────────────────────────────────────── */

    /**
     * A colour a mail client can be given.
     *
     * bgcolor takes no alpha, and the app's bars carry it (`opacity:.45` is how
     * completed work is shown), so translucency is composited against the card
     * here rather than dropped — otherwise faded teal and solid teal arrive as
     * the same colour and the bar stops meaning anything.
     */
    private static function flatten(string $spec, float $alpha): string
    {
        $rgb = self::rgb($spec);
        if ($rgb === null) {
            return self::FAINT;
        }
        $a = max(0.0, min(1.0, $alpha));
        $on = self::rgb(self::CARD) ?? [255, 255, 255];
        return sprintf(
            '#%02x%02x%02x',
            (int) round($rgb[0] * $a + $on[0] * (1 - $a)),
            (int) round($rgb[1] * $a + $on[1] * (1 - $a)),
            (int) round($rgb[2] * $a + $on[2] * (1 - $a))
        );
    }

    /** Black or white lettering, whichever stays legible on $background. */
    private static function readable(string $background): string
    {
        $rgb = self::rgb($background) ?? [0, 0, 0];
        $l = (0.299 * $rgb[0] + 0.587 * $rgb[1] + 0.114 * $rgb[2]) / 255;
        return $l > 0.62 ? self::INK : '#ffffff';
    }

    /** @return array{0:int,1:int,2:int}|null */
    private static function rgb(string $spec): ?array
    {
        $spec = trim($spec);
        if (preg_match('/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i', $spec, $m)) {
            return [(int) $m[1], (int) $m[2], (int) $m[3]];
        }
        $hex = ltrim($spec, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
            return null;
        }
        return [(int) hexdec(substr($hex, 0, 2)), (int) hexdec(substr($hex, 2, 2)), (int) hexdec(substr($hex, 4, 2))];
    }

    private static function pct(float $v): string
    {
        return rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.') ?: '0';
    }

    private static function num(float $v): string
    {
        return rtrim(rtrim(number_format($v, 1, '.', ''), '0'), '.') ?: '0';
    }

    private static function e(string $v): string
    {
        return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
    }

    /* ── The text alternative ───────────────────────────────────── */

    /**
     * @param array<int,array<string,mixed>> $blocks
     * @param array<int,string>              $out
     */
    private static function textBlocks(array $blocks, array &$out, string $pad): void
    {
        foreach ($blocks as $b) {
            switch ($b['kind']) {
                case 'card':
                    if (($b['heading'] ?? '') !== '') {
                        $out[] = $pad . $b['heading'];
                        $out[] = $pad . str_repeat('-', min(64, mb_strlen($b['heading'])));
                    }
                    self::textBlocks($b['blocks'] ?? [], $out, $pad);
                    $out[] = '';
                    break;
                case 'stats':
                    foreach ($b['items'] as $item) {
                        $out[] = $pad . '  ' . str_pad($item['value'], 16) . $item['label'];
                    }
                    $out[] = '';
                    break;
                case 'chart':
                    foreach ($b['bars'] ?? [] as $bar) {
                        $out[] = $pad . '  ' . str_pad($bar['label'], 10) . self::num((float) $bar['value']);
                    }
                    if (empty($b['bars']) && !empty($b['progress'])) {
                        $out[] = $pad . '  ' . self::num((float) $b['progress']['done']) . ' of '
                               . self::num((float) $b['progress']['total']) . ' complete';
                    }
                    break;
                case 'bars':
                    foreach ($b['rows'] as $r) {
                        $out[] = $pad . '  ' . str_pad($r['label'], 22) . $r['value'];
                    }
                    break;
                case 'rows':
                    foreach ($b['items'] as $r) {
                        $out[] = $pad . '  ' . str_pad($r['label'], 26) . $r['value'];
                    }
                    break;
                case 'heading':
                    $out[] = $pad . $b['text'];
                    break;
                case 'para':
                    $out[] = $pad . wordwrap($b['text'], 76, "\n" . $pad);
                    break;
            }
        }
    }
}
