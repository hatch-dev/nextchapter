<?php
namespace Models;

use Core\Model;

/**
 * Organization model — one row per workspace.
 */
class Organization extends Model
{
    /**
     * Insert an organization and return its full record.
     *
     * `account_type` is the role space this workspace lives in — 'enterprise'
     * or 'leader'. It decides which of the twelve program modules the account
     * may open (WorkspaceController::moduleFrom) and which URL space the app
     * lands it in. Defaulting to 'enterprise' matches every organization that
     * existed before roles did. See api/sql/roles.sql.
     *
     * @return array{id:int, public_id:string, name:string, account_type:string}
     */
    public function create(string $name, string $accountType = 'enterprise'): array
    {
        $publicId = public_id('org');

        $id = $this->execute(
            'INSERT INTO organizations (public_id, name, account_type)
                  VALUES (:public_id, :name, :account_type)',
            [':public_id' => $publicId, ':name' => $name, ':account_type' => $accountType]
        );

        return ['id' => $id, 'public_id' => $publicId, 'name' => $name, 'account_type' => $accountType];
    }

    /**
     * Resolve a name or a code to one organization.
     *
     * Accepts the organization's NAME (what a member knows, and what the
     * invitation email leads with) or its CODE — the public_id, which the admin
     * console shows and which is unambiguous by construction.
     *
     * NOT the sign-in path any more. This backed the sign-in screen's
     * Organization field, which no longer exists (see AuthController): a
     * username identifies one account on its own, so nobody types an
     * organization to be resolved. It stays because it is the only correct way
     * to turn a human-typed organization into a row — support lookups, and
     * whatever names one next — and because nameTakenByOther's rule is its
     * precondition.
     *
     * Deliberately three-valued. "No organization is called that" and "more
     * than one is" need different words in front of the person typing: the
     * first is a typo to correct, the second is a request for the code. A
     * single null would collapse them into one unhelpful message, and picking
     * one of the matches instead would be a guess at an identity.
     *
     * @return array{status:'ok'|'none'|'ambiguous', organization?:array}
     */
    public function resolve(string $value): array
    {
        $value = trim($value);
        if ($value === '') {
            return ['status' => 'none'];
        }

        $byCode = $this->findByPublicId($value);
        if ($byCode !== null) {
            return ['status' => 'ok', 'organization' => $byCode];
        }

        $matches = $this->select(
            'SELECT id, public_id, name, account_type, created_at
               FROM organizations WHERE LOWER(TRIM(name)) = :n',
            [':n' => mb_strtolower($value)]
        );

        /* Nothing matched the name as typed, so compare on a normalized form:
           inner runs of whitespace collapsed, case folded. "Acme  Manufacturing"
           and "acme manufacturing" are the same organization to everyone except
           a string comparison, and a member re-typing their employer's name is
           not proofreading it. Only reached when the exact match found nothing,
           so the common case is still one indexed lookup. */
        if ($matches === []) {
            $needle = $this->normalizeName($value);
            foreach ($this->all() as $org) {
                if ($this->normalizeName((string) $org['name']) === $needle) {
                    $matches[] = $org;
                }
            }
        }

        if ($matches === []) {
            return ['status' => 'none'];
        }
        if (count($matches) > 1) {
            return ['status' => 'ambiguous'];
        }

        return ['status' => 'ok', 'organization' => $matches[0]];
    }

    /**
     * True if another organization already goes by this name.
     *
     * The name is what members type to sign in, so two organizations sharing
     * one leaves both their teams unable to sign in by name — resolve() refuses
     * to guess, and every member of both has to be told the organization code
     * instead. Cheaper to say so once, here, to the person naming the second.
     *
     * Compared on the normalized form, because "Acme  Ltd" and "acme ltd" are
     * the same name to everyone who has to type it.
     */
    public function nameTakenByOther(string $name, ?string $exceptPublicId = null): bool
    {
        $needle = $this->normalizeName($name);
        if ($needle === '') {
            return false;
        }
        foreach ($this->all() as $org) {
            if ($exceptPublicId !== null && $org['public_id'] === $exceptPublicId) {
                continue;
            }
            if ($this->normalizeName((string) $org['name']) === $needle) {
                return true;
            }
        }
        return false;
    }

    /** Case-folded, whitespace-collapsed form of a name, for comparison only. */
    private function normalizeName(string $name): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $name)));
    }

    /** Look up an organization by its app-facing public id. */
    public function findByPublicId(string $publicId): ?array
    {
        return $this->selectOne(
            'SELECT id, public_id, name, account_type, created_at FROM organizations WHERE public_id = :pid',
            [':pid' => $publicId]
        );
    }

    /** Look up an organization by its numeric primary key. */
    public function findById(int $id): ?array
    {
        return $this->selectOne(
            'SELECT id, public_id, name, account_type, created_at FROM organizations WHERE id = :id',
            [':id' => $id]
        );
    }

    /** Every organization (with detail fields), oldest first. */
    public function all(): array
    {
        return $this->select(
            'SELECT id, public_id, name, account_type, industry, company_size, region, website,
                    ai_maturity, executive_sponsor, objective, created_at
               FROM organizations ORDER BY id ASC'
        );
    }

    /** Delete an organization (its users cascade via the FK). */
    public function deleteByPublicId(string $publicId): void
    {
        $this->execute('DELETE FROM organizations WHERE public_id = :pid', [':pid' => $publicId]);
    }

    /** Update the detail fields of an organization (by public id). */
    public function updateDetails(string $publicId, array $a): void
    {
        $this->execute(
            'UPDATE organizations SET
                name              = :name,
                industry          = :industry,
                company_size      = :company_size,
                region            = :region,
                website           = :website,
                ai_maturity       = :ai_maturity,
                executive_sponsor = :executive_sponsor,
                objective         = :objective
             WHERE public_id = :pid',
            [
                ':name'              => $a['name'],
                ':industry'          => $a['industry'],
                ':company_size'      => $a['company_size'],
                ':region'            => $a['region'],
                ':website'           => $a['website'],
                ':ai_maturity'       => $a['ai_maturity'],
                ':executive_sponsor' => $a['executive_sponsor'],
                ':objective'         => $a['objective'],
                ':pid'               => $publicId,
            ]
        );
    }
}
