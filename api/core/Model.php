<?php
namespace Core;

use PDO;

/**
 * Base model.
 *
 * Gives every model the shared PDO handle and small query conveniences so
 * concrete models stay focused on their table's intent. Every query here uses
 * prepared statements — models never interpolate user input into SQL.
 */
abstract class Model
{
    protected PDO $db;

    public function __construct()
    {
        $this->db = Database::connection();
    }

    /** Run a prepared statement and return all rows. */
    protected function select(string $sql, array $params = []): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Run a prepared statement and return the first row (or null). */
    protected function selectOne(string $sql, array $params = []): ?array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** Run a prepared INSERT/UPDATE/DELETE and return the new insert id. */
    protected function execute(string $sql, array $params = []): int
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return (int) $this->db->lastInsertId();
    }
}
