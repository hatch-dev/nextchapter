<?php
declare(strict_types=1);

namespace Core;

/**
 * The frame every message shares (EML-005, 25 Nov 2026).
 *
 * Three clients decide how it is built. Outlook for Windows draws mail with Word: no padding on a <div> or a link, no
 * max-width, and no font inherited into a table. Safari's engine (iPhone, Mac) will not shrink a table that states its
 * width in pixels, whatever its max-width says. Gmail keeps inline styles only. So: tables for anything with padding,
 * full width with a stated maximum (and a fixed-width table around it that only Outlook reads), and the font on every
 * element.
 *
 * The colours are the light palette, and each piece of text reads at 4.5:1 or better on the ground it is put on.
 */
final class MailLayout
{
    public const FONT   = 'Arial,Helvetica,sans-serif';
    public const GROUND = '#f6f4f0';
    public const CARD   = '#ffffff';
    public const PANEL  = '#faf9f6';
    public const RULE   = '#d9d5cd';
    public const BORDER = '#e6e2da';
    public const FAINT  = '#6b6559';
    public const GOLD   = '#8a6414';

    private const TABLE = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"';

    /** The whole message: a card on the ground. $inner is finished HTML. */
    public static function page(string $inner, int $width = 640, string $padding = '32px 28px'): string
    {
        return self::withFont(
            self::TABLE . ' width="100%" bgcolor="' . self::GROUND . '" style="width:100%;background:' . self::GROUND . '"><tr>'
            . '<td align="center" style="padding:28px 12px">'
            . '<!--[if mso]>' . self::TABLE . ' width="' . $width . '" align="center"><tr><td><![endif]-->'
            . self::TABLE . ' width="100%" align="center" bgcolor="' . self::CARD . '" style="width:100%;max-width:' . $width . 'px;margin:0 auto;'
            . 'background:' . self::CARD . ';border:1px solid ' . self::RULE . ';border-radius:8px;border-collapse:separate"><tr>'
            . '<td align="left" style="padding:' . $padding . ';text-align:left">' . $inner . '</td></tr></table>'
            . '<!--[if mso]></td></tr></table><![endif]-->'
            . '</td></tr></table>'
        );
    }

    /** A bordered panel. */
    public static function box(string $inner, string $background = self::PANEL, string $border = self::BORDER, int $after = 20): string
    {
        return self::TABLE . ' width="100%" bgcolor="' . $background . '" style="width:100%;background:' . $background . ';border:1px solid ' . $border
            . ';border-radius:4px;border-collapse:separate"><tr><td align="left" style="padding:16px">' . $inner . '</td></tr></table>' . self::gap($after);
    }

    /** Space below something: Word drops a table's margin. */
    public static function gap(int $px): string
    {
        return '<div style="height:' . $px . 'px;line-height:' . $px . 'px;font-size:' . min(16, $px) . 'px">&nbsp;</div>';
    }

    public static function rule(int $after = 22, string $color = self::RULE): string
    {
        return self::TABLE . ' width="100%" style="width:100%"><tr><td height="1" style="height:1px;line-height:1px;font-size:1px;border-top:1px solid ' . $color . '">&nbsp;</td></tr></table>'
            . ($after > 0 ? self::gap($after) : '');
    }

    /** A label and its value, inside a panel. $value is finished HTML. */
    public static function field(string $label, string $value): string
    {
        return '<div style="margin:0 0 2px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' . self::FAINT . '">'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</div>'
            . '<div style="margin:0 0 10px;font-size:14px;color:#1c1a17">' . $value . '</div>';
    }

    /** A button: Word pads the cell, everything else pads the link, so all of it can be pressed. */
    public static function button(string $url, string $label, int $after = 0): string
    {
        $e = static fn(string $v): string => htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
        return self::TABLE . '><tr><td align="center" bgcolor="' . self::GOLD . '" style="background:' . self::GOLD . ';border-radius:4px;mso-padding-alt:13px 26px">'
            . '<a href="' . $e($url) . '" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-size:15px;line-height:1.3;font-weight:600">'
            . $e($label) . ' &rarr;</a></td></tr></table>' . ($after > 0 ? self::gap($after) : '');
    }

    /** The same colour, darkened until text in it reads on white (4.5:1). Anything that is not a colour is left alone. */
    public static function legible(string $hex): string
    {
        if (!preg_match('/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i', trim($hex), $m)) return $hex;
        $rgb = [hexdec($m[1]), hexdec($m[2]), hexdec($m[3])];
        for ($i = 0; $i < 40; $i++) {
            $l = 0.0;
            foreach ([0.2126, 0.7152, 0.0722] as $k => $weight) {
                $v  = $rgb[$k] / 255;
                $l += $weight * ($v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4);
            }
            if (1.05 / ($l + 0.05) >= 4.5) break;
            $rgb = array_map(static fn($c) => $c * 0.95, $rgb);
        }
        return sprintf('#%02x%02x%02x', (int) floor($rgb[0]), (int) floor($rgb[1]), (int) floor($rgb[2]));
    }

    /** Word inherits no font into a table, nor from one element to the next: every styled element says it. */
    private static function withFont(string $html): string
    {
        $out = preg_replace_callback(
            '~<(td|p|div|h1|h2|h3|a|span|strong)\b([^>]*?)(\sstyle=")([^"]*)"~i',
            static fn(array $m): string => str_contains($m[4], 'font-family') ? $m[0] : '<' . $m[1] . $m[2] . $m[3] . 'font-family:' . self::FONT . ';' . $m[4] . '"',
            $html
        );
        return is_string($out) ? $out : $html;
    }
}
