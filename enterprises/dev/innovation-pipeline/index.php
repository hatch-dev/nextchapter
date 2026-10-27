<?php
/**
 * ─────────────────────────────────────────────────────────────
 * index.php — the application front controller
 * ─────────────────────────────────────────────────────────────
 * One HTML shell, many URLs. This file turns a path into a decision
 * about WHICH module's code the page should load, and hands that
 * decision to the browser as `window.APP_BOOT` before a single line
 * of application JavaScript runs.
 *
 *   /apps/                              launchpad — pick a role
 *   /apps/signup                        the one sign-up, for every program
 *   /apps/admin                         the app-administrator console
 *   /apps/enterprises                   role hub — that role's 6 modules
 *   /apps/enterprises/{module-slug}     a module
 *   /apps/leaders/{module-slug}/login   that program's own sign-in
 *   /apps/leaders/{module-slug}/{page}[/{step}]   deep link into one
 *
 * Why a PHP shell rather than a static index.html:
 *   · the module has to be known before boot.js writes its <script>
 *     tags, and a query string (?module=) is not the URL the product
 *     wants;
 *   · an unknown role or module must answer 404, not render an app;
 *   · <base href> has to name the real install directory so every
 *     relative asset, template and api/ call keeps working at any URL
 *     depth — /apps/leaders/x/step/1.2 is four segments deep and every
 *     relative path in the app was written for the root;
 *   · asset versions come from filemtime, which retires the hand-edited
 *     ?v=<date> cache tags that used to be bumped by hand.
 *
 * It holds NO session and makes NO access decision: sign-in lives in the
 * browser (see js/auth.js) and entitlement is enforced by the API. A
 * signed-out visitor to a module URL gets the module shell and the login
 * screen inside it; a signed-in visitor whose account is not entitled to
 * that role is bounced client-side by Router.enforceRole().
 * ─────────────────────────────────────────────────────────────
 */

declare(strict_types=1);

const SHELL   = __DIR__ . '/shell.html';
const CATALOG = __DIR__ . '/config/catalogue.json';

/* ── The catalogue ─────────────────────────────────────────── */
$catalogue = json_decode((string) @file_get_contents(CATALOG), true);
if (!is_array($catalogue) || empty($catalogue['roles'])) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit("config/catalogue.json is missing or unreadable.\n");
}
$roles    = $catalogue['roles'];
$defaults = $catalogue['defaults'] ?? [];

/** Role by URL slug, or null. */
function role_by_slug(array $roles, string $slug): ?array
{
    foreach ($roles as $r) {
        if ($r['slug'] === $slug) return $r;
    }
    return null;
}

/** Role by stable key, or null. */
function role_by_key(array $roles, string $key): ?array
{
    foreach ($roles as $r) {
        if ($r['key'] === $key) return $r;
    }
    return null;
}

/** Module by URL slug within a role, or null. */
function module_by_slug(array $role, string $slug): ?array
{
    foreach ($role['modules'] as $m) {
        if ($m['slug'] === $slug) return $m;
    }
    return null;
}

/** Module by storage id anywhere in the catalogue → [role, module] or null. */
function find_by_id(array $roles, string $id): ?array
{
    foreach ($roles as $r) {
        foreach ($r['modules'] as $m) {
            if ($m['id'] === $id) return [$r, $m];
        }
    }
    return null;
}

/* ── Where we are installed ────────────────────────────────── */
// "/apps/index.php" -> "/apps"; at the document root -> "".
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');
/* DEV COPY, SECOND DOOR (16 Oct 2026): /apps/enterprises/dev/executive-readiness is Executive Readiness, served by
   THIS install — that folder holds only an index.php that defines DEV_DOOR_PIN and requires this file. $door is the
   address the page answers under (paths are read against it); $base stays this install's folder, so <base href>,
   every script, the api/ and its sign-in cookie are the same ones the Pipeline's door uses. */
$door = $base;
if (defined('DEV_DOOR_PIN')) {
    $base = rtrim(str_replace('\\', '/', dirname($door)), '/') . '/' . basename(__DIR__);
}
$uri  = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if ($door !== '' && strpos($uri, $door) === 0) {
    $uri = substr($uri, strlen($door));
}
$path     = trim(rawurldecode($uri), '/');
$segments = $path === '' ? [] : explode('/', $path);
// Reaching the controller by its own filename is the same as reaching the root.
if (($segments[0] ?? '') === 'index.php') array_shift($segments);

/* ── Resolve ───────────────────────────────────────────────── */
$boot = [
    'base'      => $base . '/',
    'suite'     => $catalogue['suite'] ?? ['name' => 'Programs', 'title' => 'Programs', 'logo' => []],
    'kind'      => 'launchpad',   // launchpad | auth | role | module | notfound
    'role'      => null,          // stable role key
    'roleSlug'  => null,
    'moduleId'  => null,
    'moduleSlug' => null,
    'entryStep' => null,          // auth screens: login | setup | admin-login
    'page'      => null,          // deep link into a module
    'step'      => null,
    'module'    => null,          // the resolved module record (scripts stamped)
];

/* ── Where sign-in and sign-up live ────────────────────────────
   SIGN-IN BELONGS TO A PROGRAM. /apps/leaders/judgment-critical-thinking/login
   is Judgment's own, and each of the twelve has one — so the screen wears the
   program's name and colours, and already knows which role space it is the
   entrance to (auth.js hides the Organization field on a Leaders door;
   AuthController resolves the username inside that space).

   SIGN-UP IS ONE SCREEN FOR ALL TWELVE, at /apps/signup. Creating an account is
   not entering a program: it decides which of the two audiences you belong to,
   and that answer then governs every program in that space. So the form asks it
   — an Enterprise/Leaders choice — rather than reading it off whichever door
   the visitor happened to arrive at, and the account starts with its whole role
   space either way (see SetupController).

   The per-program /signup addresses are kept alive as 301s to it, below. They
   were linked from twelve sign-in screens and from anything anyone bookmarked;
   404ing them would strand those links, and serving a second sign-up form at
   them would put the question back on the address, where it no longer belongs.

   /apps/admin is the third root address: the app-administrator's console
   across every organization, which belongs to no program either. */
$ROOT_AUTH   = ['admin' => 'admin-login', 'signup' => 'setup'];
$MODULE_AUTH = ['login' => 'login'];

/* ── Addresses a program used to answer at ────────────────────
   A module's `slug` is its URL and may be renamed; its `id` is storage and
   may not. When a program that has already been live is given a new address,
   its old one is listed here — role key → old slug → module id — so every link,
   bookmark and mail already carrying it heals itself with one 301 instead of
   404ing. Consulted only AFTER the current slugs miss, so an entry here can
   never shadow a live address. Keep entries forever; they cost one array
   lookup on a URL that would otherwise be a dead end.

   Both entries are the 2026-08-31 Leaders renames, where the name on the
   screen moved and the storage id deliberately did not:
     'decision-lab'  → 'judgment-critical-thinking'  (The Decision Lab → Judgment)
     'ethics-engine' → 'conscience-ethical-reasoning' (The Ethics Engine → Conscience)
   `decision-lab` and `ethics-engine` are still the ids, and still the only
   name for these two programs anywhere below the URL. */
$LEGACY_MODULE_SLUGS = [
    'leader' => [
        'decision-lab'  => 'decision-lab',
        'ethics-engine' => 'ethics-engine',
    ],
];

/* ── DEV COPY, SINGLE-PROGRAM MOUNT (13 Oct 2026) ─────────────────────────────
   This copy is installed at /apps/enterprises/dev/innovation-pipeline/, and that
   address IS the AI Innovation Pipeline: /…/innovation-pipeline opens it,
   /…/innovation-pipeline/step/1.1 is a step, /…/innovation-pipeline/login its
   sign-in. So every path is read as if it began with the pinned role and
   program, unless it already names a role (the other programs stay reachable,
   one level deeper) or is one of the root screens (admin, signup). The browser
   side builds its links the same way (js/router.js, BOOT.pinned). */
$PINNED = defined('DEV_DOOR_PIN') ? DEV_DOOR_PIN : ['role' => 'enterprises', 'module' => 'innovation-pipeline'];
/* Every program that has a door of its own (16 Oct 2026), as "<role>/<module>" => the door's folder beside this one.
   A door is listed only while its folder is there, so an install without it keeps the nested address. */
$DEV_DOORS = [
    'enterprises/innovation-pipeline'       => basename(__DIR__),
    'enterprises/executive-readiness'       => 'executive-readiness',
    'enterprises/responsible-ai-governance' => 'responsible-ai-governance',
    'enterprises/ai-ready-architecture'     => 'architecture',   /* 21 Oct 2026: this door's folder is not the slug */
];
$doorUrls  = [];
foreach ($DEV_DOORS as $key => $folder) {
    $own = $folder === basename(__DIR__);
    if ($own || is_file(dirname(__DIR__) . '/' . $folder . '/index.php')) {
        $doorUrls[$key] = rtrim(str_replace('\\', '/', dirname($base)), '/') . '/' . $folder;
    }
}
$boot['doors'] = $doorUrls;
if ($PINNED) {
    $first = $segments[0] ?? '';
    $isRootAuth = isset($ROOT_AUTH[$first]) && count($segments) === 1;
    if (!$isRootAuth && !($first !== '' && role_by_slug($roles, $first))) {
        array_unshift($segments, $PINNED['role'], $PINNED['module']);
    } elseif (count($segments) >= 2 && isset($doorUrls[$segments[0] . '/' . $segments[1]])) {
        /* A program that has its own door, reached by its nested address (…/innovation-pipeline/enterprises/
           executive-readiness/step/1.1): sent once, permanently, to the same screen at its door. */
        $rest = array_slice($segments, 2);
        $to   = $doorUrls[$segments[0] . '/' . $segments[1]] . ($rest ? '/' . implode('/', array_map('rawurlencode', $rest)) : '');
        $qs   = (string) ($_SERVER['QUERY_STRING'] ?? '');
        header('Location: ' . $to . ($qs !== '' ? '?' . $qs : ''), true, 301);
        exit;
    }
    $boot['pinned'] = $PINNED;
}

$head = $segments[0] ?? '';

if ($head === '' && isset($_GET['module'])) {
    /* Legacy: every pre-routing link was index.html?module=<id>. Send it to
       the module's real URL once, permanently, so bookmarks heal themselves. */
    $hit = find_by_id($roles, (string) $_GET['module']);
    if ($hit) {
        header('Location: ' . $base . '/' . $hit[0]['slug'] . '/' . $hit[1]['slug'], true, 301);
        exit;
    }
}

if ($head === '') {
    $boot['kind'] = 'launchpad';
} elseif (isset($ROOT_AUTH[$head]) && count($segments) === 1) {
    $boot['kind']      = 'auth';
    $boot['entryStep'] = $ROOT_AUTH[$head];
} elseif ($role = role_by_slug($roles, $head)) {
    $boot['role']     = $role['key'];
    $boot['roleSlug'] = $role['slug'];
    if (count($segments) === 1) {
        $boot['kind'] = 'role';
    } elseif ($module = module_by_slug($role, $segments[1])) {
        $boot['moduleId']   = $module['id'];
        $boot['moduleSlug'] = $module['slug'];
        $boot['module']     = $module;
        /* This program's own sign-up used to live here. There is one for all
           twelve now, so the old address is honoured once, permanently, and
           every link to it heals itself. Answered BEFORE anything else about
           the page is decided: a redirect that renders first is a page nobody
           sees. */
        if (($segments[2] ?? '') === 'signup' && count($segments) === 3) {
            header('Location: ' . $base . '/signup', true, 301);
            exit;
        }
        /* The program's own sign-in. Checked BEFORE the deep link, because it
           occupies the same segment a page id would: a program may never name
           a page `login` — nor `signup`, which the redirect above claims.
           Everything else about the page is unchanged — same role, same
           module, so the screen loads this program's code, wordmark and
           palette. */
        if (isset($MODULE_AUTH[$segments[2] ?? ''])) {
            /* `login` is never a page id, so anything hanging off it is not a
               deeper screen — it is a wrong address, and saying so beats
               rendering sign-in at a URL that will not survive a refresh. */
            $boot['kind']      = count($segments) === 3 ? 'auth' : 'notfound';
            $boot['entryStep'] = $MODULE_AUTH[$segments[2]];
        } else {
            $boot['kind'] = 'module';
            $boot['page'] = $segments[2] ?? null;
            $boot['step'] = $segments[3] ?? null;
        }
    } elseif ($was = $LEGACY_MODULE_SLUGS[$role['key']][$segments[1]] ?? null) {
        /* An address this program has retired. Send the whole path on to the
           name it answers to now — the segments after the slug are the page and
           step, which the rename did not touch — and keep the query string, so
           a deep link survives the move intact. */
        $hit = find_by_id($roles, $was);
        if ($hit) {
            $rest = array_slice($segments, 2);
            $to   = $base . '/' . $hit[0]['slug'] . '/' . $hit[1]['slug']
                  . ($rest ? '/' . implode('/', array_map('rawurlencode', $rest)) : '');
            $qs   = (string) ($_SERVER['QUERY_STRING'] ?? '');
            header('Location: ' . $to . ($qs !== '' ? '?' . $qs : ''), true, 301);
            exit;
        }
        $boot['kind'] = 'notfound';
    } else {
        $boot['kind'] = 'notfound';
    }
} else {
    $boot['kind'] = 'notfound';
}

/* A launchpad/role URL — and the two root screens, /apps/signup and /apps/admin
   — still need SOME module's chrome on the page, because the shell's header,
   sidebar and coach read the active module. The default module supplies it;
   nothing of it is shown on those screens, and auth.js asks boot.moduleId (null
   here) rather than the resolved module when it needs to know which program a
   door belongs to. A program's own /login already resolved its module above and
   keeps it: that screen is that program's. */
if ($boot['module'] === null) {
    $fallbackRole = role_by_key($roles, (string) ($defaults['role'] ?? '')) ?? $roles[0];
    $fallback     = null;
    foreach ($fallbackRole['modules'] as $m) {
        if ($m['id'] === ($defaults['module'] ?? '')) { $fallback = $m; break; }
    }
    $boot['module'] = $fallback ?? $fallbackRole['modules'][0];
}

if ($boot['kind'] === 'notfound') {
    http_response_code(404);
}

/* ── Asset versions ────────────────────────────────────────── */
/** Append the file's mtime so a changed file is always refetched, and an
 *  unchanged one is always served from cache. Replaces the manual ?v= tags. */
function stamp(string $rel): string
{
    $file = __DIR__ . '/' . ltrim($rel, '/');
    return is_file($file) ? $rel . '?v=' . filemtime($file) : $rel;
}

$boot['module']['scripts'] = array_map('stamp', $boot['module']['scripts'] ?? []);
$boot['module']['styles']  = array_map('stamp', $boot['module']['styles'] ?? []);

/* ── Render ────────────────────────────────────────────────── */
$html = (string) @file_get_contents(SHELL);
if ($html === '') {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit("shell.html is missing or unreadable.\n");
}

$flags   = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP;
$injected = '<base href="' . htmlspecialchars($base . '/', ENT_QUOTES) . '">' . "\n  "
    . '<script>window.APP_BOOT=' . json_encode($boot, $flags) . ';'
    . 'window.APP_CATALOGUE=' . json_encode($roles, $flags) . ';</script>';

/* ── Social sharing card ───────────────────────────────────────
   Link previews (Facebook, LinkedIn, X, Slack, WhatsApp, Teams) are built by
   crawlers that never run JavaScript, so boot.js setting document.title is
   invisible to them — the card has to be in the HTML as served.

   The banner is a file in assets/social/, named after the address it serves:
     {module-slug}.{jpg|jpeg|png|webp}   one program   e.g. innovation-pipeline.jpg
     default.…                           everything else (launchpad, role hubs,
                                         sign-up, admin) and any program with
                                         no banner of its own
   A program is also found by its storage id (decision-lab.jpg), so a banner
   survives a slug rename. A missing file just falls through to the next. */
function social_image(array $names): ?string
{
    foreach ($names as $name) {
        if ($name === null || $name === '') continue;
        foreach (['jpg', 'jpeg', 'png', 'webp'] as $ext) {
            $rel = 'assets/social/' . $name . '.' . $ext;
            if (is_file(__DIR__ . '/' . $rel)) return $rel;
        }
    }
    return null;
}

$scheme = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off')
       || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
    ? 'https' : 'http';
$origin = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$suite  = $boot['suite'];
$isProgram = $boot['moduleId'] !== null && $boot['kind'] !== 'notfound';
$hubRole   = $boot['kind'] === 'role' ? role_by_key($roles, (string) $boot['role']) : null;

if ($isProgram) {
    $m         = $boot['module'];
    $ogTitle   = $m['title'] ?? $m['name'];
    $ogDesc    = $m['sub'] ?? ($suite['title'] ?? '');
    $ogImage   = social_image([$boot['moduleSlug'], $boot['moduleId'], 'default']);
    $ogPath    = $boot['roleSlug'] . '/' . $boot['moduleSlug'];
    $ogDoor    = $doorUrls[$ogPath] ?? null;   /* DEV COPY: a program with a door of its own is shared at that address */
} elseif ($hubRole) {
    $ogTitle   = $hubRole['name'] . ' Programs — ' . ($suite['name'] ?? '');
    $ogDesc    = $hubRole['sub'] ?? '';
    $ogImage   = social_image(['default']);
    $ogPath    = $hubRole['slug'] . '/';   // a real folder too: Apache 301s the bare name to this
} else {
    $ogTitle   = $suite['title'] ?? 'Programs';
    $ogDesc    = '90-day programs for organizations and the people who lead them.';
    $ogImage   = social_image(['default']);
    $ogPath    = '';
}

$e = static fn($s): string => htmlspecialchars((string) $s, ENT_QUOTES);
$social = [
    '<meta name="description" content="' . $e($ogDesc) . '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="' . $e($suite['name'] ?? '') . '">',
    '<meta property="og:title" content="' . $e($ogTitle) . '">',
    '<meta property="og:description" content="' . $e($ogDesc) . '">',
    '<meta property="og:url" content="' . $e($origin . (($ogDoor ?? null) ?: $base . '/' . $ogPath)) . '">',
    '<meta name="twitter:title" content="' . $e($ogTitle) . '">',
    '<meta name="twitter:description" content="' . $e($ogDesc) . '">',
];
if ($ogImage !== null) {
    // The mtime query makes a replaced banner a new URL, so platforms that
    // cache the card by image URL pick up the new picture.
    $ogImageUrl = $origin . $base . '/' . stamp($ogImage);
    $social[] = '<meta property="og:image" content="' . $e($ogImageUrl) . '">';
    $social[] = '<meta property="og:image:alt" content="' . $e($ogTitle) . '">';
    $size = @getimagesize(__DIR__ . '/' . $ogImage);
    if ($size) {
        $social[] = '<meta property="og:image:width" content="' . (int) $size[0] . '">';
        $social[] = '<meta property="og:image:height" content="' . (int) $size[1] . '">';
    }
    $social[] = '<meta name="twitter:card" content="summary_large_image">';
    $social[] = '<meta name="twitter:image" content="' . $e($ogImageUrl) . '">';
} else {
    $social[] = '<meta name="twitter:card" content="summary">';
}
$injected .= "\n  " . implode("\n  ", $social);

$html = str_replace('<!--{{BOOT}}-->', $injected, $html);

/* ── Which program's colours ───────────────────────────────────
   assets/css/themes.css holds one palette per program, in light and
   dark, selected on [data-app] at the root. Stamping it HERE rather
   than from script is what makes the page paint in the right colour
   the first time: a class added after load would show one program's
   accent for a frame before flipping to another's — the same reason
   the theme (light/dark) is applied before first paint in shell.html.

   Only when a program is actually behind the address — which includes its own
   sign-in, since each program has one and the door should look like the room.
   The launchpad, a role hub, the admin console and the shared sign-up belong to
   no single program: they resolve a module anyway (its chrome has to come from
   somewhere) but must not wear its colours, so they are left with no attribute
   and take the suite palette from :root. The moduleId test below is what tells
   those two kinds of 'auth' page apart. */
$wearsProgramColours = ($boot['kind'] ?? '') === 'module'
    || (($boot['kind'] ?? '') === 'auth' && ($boot['moduleId'] ?? null) !== null);
if ($wearsProgramColours && ($boot['module']['id'] ?? '') !== '') {
    $html = preg_replace(
        '/<html\b/',
        '<html data-app="' . htmlspecialchars((string) $boot['module']['id'], ENT_QUOTES) . '"',
        $html,
        1
    );
}


/* ── Fonts from our own server (Directive 2 Oct 2026, Part 1; live for the AI Innovation Pipeline, 6 Oct 2026, and
   Executive Readiness, 7 Oct 2026 — its own directive of the same date; its print window uses fonts/print.css — and
   Responsible AI Governance, 7 Oct 2026, whose own print window uses fonts/print-governance.css)
   A request to Google's font servers sends the reader's internet address to Google, which European data
   protection authorities treat as a transfer of personal data. On the Pipeline's own pages — the program and
   its sign-in and sign-up doors, the same test as the colours above — the Google Fonts link becomes the
   self-hosted copy in fonts/ (Cormorant Garamond, DM Mono, DM Sans; SIL Open Font License). Its rules mirror
   Google's own one for one, so the page looks exactly as it did. Every other page keeps the Google link until
   its own directive is applied.
   Every page that belongs to NO single program is included too (6 Oct 2026): the launchpad, the role hubs,
   the admin console (/apps/admin, where the Pipeline's Reset data lives), the shared sign-up (every
   program's /signup 301s there) and "not found". Pipeline users pass through all of them, and they wear the
   suite's fonts, which are the same files. Only another program's own pages keep Google until its directive. */
/* Every program now (12 Oct 2026, page speed). Judgment and Conscience were the
   last pages still on Google: a cross-site, render-blocking stylesheet that put
   their first paint at 1.8 s on desktop and 4.2 s on mobile against 0.5 s for
   the programs already self-hosted. fonts/fonts.css carries exactly the
   families and weights the Google link asks for, so nothing looks different. */
$html = (string) preg_replace(
    '#<link\s+href="https://fonts\.googleapis\.com/css2\?[^"]*"\s+rel="stylesheet">#',
    '<link rel="stylesheet" href="fonts/fonts.css">',
    $html,
    1
);

/* ── The open program's own screens ────────────────────────────
   templates-local.js holds only the shared screens; a program that ships its
   own Home/Learn has them in js/templates-local/<module>.js (written by
   tools/build-templates.js), and only that program's file goes on the page.
   They used to share one bundle, which made every program download every
   other program's screens — ~525 KB of other programs' pictures in front of
   the Innovation Pipeline's sign-in (12 Oct 2026). */
$tplId = (string) ($boot['module']['id'] ?? '');
if (preg_match('/^[a-z0-9-]+$/', $tplId) && is_file(__DIR__ . '/js/templates-local/' . $tplId . '.js')) {
    $html = str_replace(
        '<script src="js/templates-local.js" defer></script>',
        '<script src="js/templates-local.js" defer></script>' . "\n  "
            . '<script src="js/templates-local/' . $tplId . '.js" defer></script>',
        $html
    );
}

/* Version every local script/stylesheet the shell itself references. */
$html = (string) preg_replace_callback(
    '/(\s(?:src|href)=")((?:js|assets|fonts)\/[^"?]+\.(?:js|css))(")/',
    static fn(array $m): string => $m[1] . stamp($m[2]) . $m[3],
    $html
);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $html;
