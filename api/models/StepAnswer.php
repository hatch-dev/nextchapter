<?php
namespace Models;

use Core\Model;

/**
 * The per-phase question/answer trail.
 *
 * A DERIVED table: every row is projected out of the organization's workspace
 * document by Core\AnswerProjector each time the workspace is saved. The
 * document is the source of truth — these rows exist so the Q&A can be read,
 * exported, and reported on with plain SQL instead of parsing JSON:
 *
 *   SELECT step_id, question_text, answer
 *     FROM step_answers
 *    WHERE organization_id = 1 AND phase = 1;
 *
 * Nothing reads these rows back into the app, so they can be rebuilt at any
 * time without data loss.
 */
class StepAnswer extends Model
{
    /** Every answer for one of an organization's program modules, ordered for display. */
    public function forOrg(int $orgId, string $module = 'pipeline'): array
    {
        return $this->select(
            'SELECT module, phase, step_id, section, question_key, question_text, answer, updated_at
               FROM step_answers
              WHERE organization_id = ? AND module = ?
              ORDER BY phase, step_id, id',
            [$orgId, $module]
        );
    }

    /** Every answer for one phase of an organization's module. */
    public function forPhase(int $orgId, int $phase, string $module = 'pipeline'): array
    {
        return $this->select(
            'SELECT module, phase, step_id, section, question_key, question_text, answer, updated_at
               FROM step_answers
              WHERE organization_id = ? AND module = ? AND phase = ?
              ORDER BY step_id, id',
            [$orgId, $module, $phase]
        );
    }

    /**
     * Replace an organization's answers with a freshly projected set.
     *
     * Runs as one transaction so a reader never catches the table half-written.
     * Answers that no longer appear in the document are deleted, so clearing a
     * field in the app clears it here too.
     *
     * @param array $answers Rows of
     *                       {phase, step_id, section, question_key, question_text, answer}
     */
    public function replaceForOrg(int $orgId, array $answers, string $module = 'pipeline'): void
    {
        $this->db->beginTransaction();
        try {
            $keys = array_column($answers, 'question_key');

            // Drop answers whose question is no longer present (field cleared).
            // Scoped to this module: re-projecting one program must never
            // delete another program's answers for the same organization.
            if ($keys === []) {
                $this->execute(
                    'DELETE FROM step_answers WHERE organization_id = ? AND module = ?',
                    [$orgId, $module]
                );
            } else {
                $placeholders = implode(',', array_fill(0, count($keys), '?'));
                $this->execute(
                    "DELETE FROM step_answers
                      WHERE organization_id = ?
                        AND module = ?
                        AND question_key NOT IN ($placeholders)",
                    array_merge([$orgId, $module], $keys)
                );
            }

            // Upsert the current set. The unique key (organization_id, module,
            // question_key) turns a re-projection into an in-place update, so
            // `updated_at` only moves when the answer actually changes.
            $stmt = $this->db->prepare(
                'INSERT INTO step_answers
                     (organization_id, module, phase, step_id, section, question_key, question_text, answer)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                     phase         = VALUES(phase),
                     step_id       = VALUES(step_id),
                     section       = VALUES(section),
                     question_text = VALUES(question_text),
                     answer        = VALUES(answer)'
            );

            foreach ($answers as $a) {
                $stmt->execute([
                    $orgId,
                    $module,
                    (int) $a['phase'],
                    (string) $a['step_id'],
                    $a['section'] !== '' ? $a['section'] : null,
                    (string) $a['question_key'],
                    (string) $a['question_text'],
                    $a['answer'],
                ]);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
