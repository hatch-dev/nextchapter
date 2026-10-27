<?php
namespace Core;

/**
 * One member's view of the shared workspace document, and one member's right to
 * write to it.
 *
 * The document is the whole organization's program state and every member reads
 * it whole. Two things inside it belong to ONE person — Executive Readiness's
 * individual "Leadership Development" track, and roster PINs — and this class
 * is the seam that keeps them that way. What counts as private is declared in
 * api/config/privacy.php; the mechanics are here.
 *
 *   forRead()     what goes out: your own entries, nobody else's.
 *   forWrite()    what gets stored after a whole-document POST: your own entries
 *                 as you sent them, everyone else's exactly as they were.
 *   forPatch()    the same, for a sections patch.
 *
 * ── IDENTITY COMES FROM THE STORED DOCUMENT, NEVER THE REQUEST ───────────
 * "Which leader am I?" is answered by reading the STORED document: the roster
 * row whose serverId is this authenticated actor, then the leader profile
 * linked to that row. It is never read from the body of the write, because the
 * body is the thing being checked — a client that could re-point its own link
 * inside the same request it uses to write would simply hand itself somebody
 * else's section. The one exception is a workspace that does not exist yet,
 * where there is nothing to protect and nothing stored to read.
 *
 * ── WHY THE WRITE PATH MATTERS AS MUCH AS THE READ PATH ──────────────────
 * Redacting the read alone would DESTROY data. The client saves what it holds,
 * so a browser handed a document with the other leaders' sections removed would
 * post that back and wipe them. Every private section is therefore re-grafted
 * from what is stored before anything is written, and only the caller's own
 * entry is taken from the request.
 */
class DocPrivacy
{
    /** Top-level sections keyed by leader id that only their owner may see. */
    private array $byLeader;

    /** The authenticated caller's user public id (never a client-supplied name). */
    private string $actorPublicId;

    /** Sweep 4R item 3 (addendum 5 Oct 2026, Paul's decision): sections only an administrator of the organization (or the app
        administrator) may change. From anyone else a write keeps what is stored, so the organization's details cannot be
        edited from the browser console by a member whose screen shows them read-only. */
    private const ADMIN_ONLY = ['enterprise', 'settings'];   /* Sweep 4R item 10: 'settings' holds only the AI Guide and Voice switches, which only administrators set */
    private bool $mayEditAdminSections;

    public function __construct(string $module, string $actorPublicId, bool $mayEditAdminSections = true)
    {
        $this->mayEditAdminSections = $mayEditAdminSections;
        $rules          = config('privacy.' . $module);
        $this->byLeader = is_array($rules) && isset($rules['byLeader']) && is_array($rules['byLeader'])
            ? array_values(array_filter($rules['byLeader'], 'is_string'))
            : [];
        $this->actorPublicId = $actorPublicId;
    }

    /**
     * The document as this member is allowed to receive it.
     *
     * Private sections are reduced to the caller's own entry (an empty object if
     * they have none, or if their account is not linked to a leader yet — the
     * app renders the "connect your account" gate for exactly that state, so an
     * empty section is a shape it already handles). Roster PINs are removed
     * outright: the server verifies sign-in, so no browser needs them.
     */
    public function forRead($doc)
    {
        if (!is_object($doc)) {
            return $doc;
        }

        $out  = self::copy($doc);
        $mine = $this->leaderIdIn($out);

        foreach ($this->byLeader as $key) {
            if (!isset($out->$key) || !is_object($out->$key)) {
                continue;
            }
            $kept = new \stdClass();
            if ($mine !== null && isset($out->$key->$mine)) {
                $kept->$mine = $out->$key->$mine;
            }
            $out->$key = $kept;
        }

        self::stripRosterCredentials($out);
        return $out;
    }

    /**
     * The document to store, given what the client posted and what is already
     * there. Whole-document POST path (WorkspaceController::save).
     *
     * @param object      $incoming What the client sent.
     * @param object|null $stored   The document as it stands, or null on a first
     *                              write — where there is nothing to protect, so
     *                              the post is taken as it came.
     */
    public function forWrite(object $incoming, ?object $stored): object
    {
        if ($stored === null) {
            // Nothing stored means nothing to protect, so the per-leader work is
            // taken as it came. PINs are the exception and have no exception:
            // they are stripped on every write, first one included.
            $first = self::copy($incoming);
            self::stripRosterCredentials($first);
            return $first;
        }

        $out  = self::copy($incoming);
        $mine = $this->leaderIdIn($stored);

        foreach ($this->byLeader as $key) {
            $present   = property_exists($out, $key);
            $out->$key = $this->mergeSection(
                $present && is_object($out->$key) ? $out->$key : null,
                isset($stored->$key) && is_object($stored->$key) ? $stored->$key : null,
                $mine,
                $present
            );
        }

        if (!$this->mayEditAdminSections) {   /* Sweep 4R item 3: the stored sections stand */
            foreach (self::ADMIN_ONLY as $key) {
                if (isset($stored->$key)) { $out->$key = json_decode((string) json_encode($stored->$key)); }
                else { unset($out->$key); }
            }
        }

        self::stripRosterCredentials($out);
        return $out;
    }

    /**
     * The same rule applied to a sections patch: only the sections the client
     * actually named are touched, and a private one among them is rebuilt from
     * the stored document with just the caller's own entry taken from the
     * request.
     *
     * Called from inside Models\Workspace::patch's read-modify-write attempt, so
     * the stored document handed in is the one being written to at that instant
     * rather than one read earlier in the request — otherwise a concurrent save
     * could be grafted back out of existence.
     *
     * @param object      $sections Top-level key to value, as sent.
     * @param object|null $stored   The document being patched, or null if none.
     */
    public function forPatch(object $sections, ?object $stored): object
    {
        if ($stored === null) {
            $first = self::copy($sections);
            self::stripRosterCredentials($first);
            return $first;
        }

        $out  = self::copy($sections);
        $mine = $this->leaderIdIn($stored);

        foreach ($this->byLeader as $key) {
            if (!property_exists($out, $key)) {
                continue;   // not part of this patch — leave the stored one alone
            }
            $out->$key = $this->mergeSection(
                is_object($out->$key) ? $out->$key : null,
                isset($stored->$key) && is_object($stored->$key) ? $stored->$key : null,
                $mine,
                true
            );
        }

        if (!$this->mayEditAdminSections) {   /* Sweep 4R item 3: an administrator-only section in the patch is left as stored */
            foreach (self::ADMIN_ONLY as $key) { unset($out->$key); }
        }

        self::stripRosterCredentials($out);
        return $out;
    }

    /** Sweep 4R item 3: may this caller name these sections for deletion? (A patch's `removed` list.) */
    public function removable(array $keys): array
    {
        return $this->mayEditAdminSections ? $keys : array_values(array_diff($keys, self::ADMIN_ONLY));
    }

    /* ── internals ──────────────────────────────────────────────────────── */

    /**
     * One private section rebuilt: everyone else's entries as stored, the
     * caller's own as they sent it.
     *
     * @param object|null $sent    The section from the request, if it carried one.
     * @param object|null $held    The section as stored.
     * @param string|null $mine    The caller's leader id, or null when their
     *                             account is linked to no leader — in which case
     *                             they own nothing here and change nothing.
     * @param bool        $present Whether the request named this section at all.
     *                             A section the client did not send is not a
     *                             deletion; only a section it sent WITHOUT the
     *                             caller's own key is.
     */
    private function mergeSection(?object $sent, ?object $held, ?string $mine, bool $present): object
    {
        $out = $held !== null ? self::copy($held) : new \stdClass();

        if ($mine === null || !$present) {
            return $out;
        }

        if ($sent !== null && isset($sent->$mine)) {
            $out->$mine = $sent->$mine;
        } else {
            unset($out->$mine);   // the member cleared their own work
        }

        return $out;
    }

    /**
     * The leader profile this member's account is linked to, or null.
     *
     * Two hops, both inside the document: the roster row carrying this actor's
     * server public id gives the LOCAL user id the app uses (u1, u9, …), and the
     * leader whose userId is that local id is the answer. It mirrors
     * getMyLeader() in js/modules/exec-readiness/steps.js exactly, which is what
     * makes the server's idea of "yours" the same as the screen's.
     */
    private function leaderIdIn(?object $doc): ?string
    {
        if (!is_object($doc) || $this->actorPublicId === '') {
            return null;
        }

        $localId = null;
        $roster  = $doc->roster ?? null;
        if (is_array($roster)) {
            foreach ($roster as $row) {
                if (is_object($row) && (string) ($row->serverId ?? '') === $this->actorPublicId) {
                    $localId = (string) ($row->id ?? '');
                    break;
                }
            }
            // A workspace written before members carried serverIds: the local id
            // may BE the public id. Still an exact match, never a name search.
            if ($localId === null) {
                foreach ($roster as $row) {
                    if (is_object($row) && (string) ($row->id ?? '') === $this->actorPublicId) {
                        $localId = $this->actorPublicId;
                        break;
                    }
                }
            }
        }

        if ($localId === null || $localId === '') {
            return null;
        }

        $leaders = $doc->leaders ?? null;
        if (!is_array($leaders)) {
            return null;
        }
        foreach ($leaders as $leader) {
            if (is_object($leader) && (string) ($leader->userId ?? '') === $localId) {
                $id = (string) ($leader->id ?? '');
                return $id === '' ? null : $id;
            }
        }
        return null;
    }

    /**
     * Remove every roster PIN — on the way out AND on the way in.
     *
     * The workspace document is not a credential store and never was a good one:
     * it held members' sign-in PINs in the clear and went to the whole team. The
     * database holds a bcrypt hash and nothing else (Models\User), sign-in is
     * verified there (/session), and PINs are set through /users and
     * /users/update, which hash them. So there is no direction in which a PIN
     * belongs in this document, and it is stripped both ways rather than
     * round-tripped — a value that is never stored cannot leak later.
     *
     * The cost is the device-local sign-in fallback for a server-synced
     * organization (findUserByLogin in js/app.js): with no PIN on the roster it
     * finds nobody, so a member cannot sign in to a synced workspace while the
     * API is unreachable. That fallback was only ever working because every
     * member's browser held every other member's credential, which is the bug.
     * Purely device-local organizations never reach this code and are unchanged.
     */
    private static function stripRosterCredentials(object $doc): void
    {
        if (!isset($doc->roster) || !is_array($doc->roster)) {
            return;
        }
        foreach ($doc->roster as $row) {
            if (is_object($row)) {
                unset($row->passcode, $row->password, $row->passwordHash, $row->pin_hash, $row->mustChange, $row->must_change, $row->temporary);
            }
        }
    }

    /**
     * A deep copy that keeps {} an object and [] an array.
     *
     * json_decode WITHOUT assoc, for the reason spelled out in
     * Controllers\WorkspaceController's class note: assoc mode rewrites every
     * empty object as an empty array, and the app then loses the section on its
     * next save. Nothing here may re-shape the document.
     */
    private static function copy(object $value): object
    {
        $copy = json_decode((string) json_encode($value));
        return is_object($copy) ? $copy : new \stdClass();
    }
}
