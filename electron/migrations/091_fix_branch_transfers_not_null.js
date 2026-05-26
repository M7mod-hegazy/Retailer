/**
 * Recreate branch_transfers with DEFAULT values on legacy NOT NULL columns
 * (from_warehouse_id, to_warehouse_id) so INSERT statements that omit them
 * no longer fail on old databases created before migration 065.
 *
 * Also adds `type` and `status` as NOT NULL with defaults if they are missing,
 * because some old DBs may have them as nullable TEXT.
 */
function up(db) {
  const cols = db.prepare("PRAGMA table_info(branch_transfers)").all();
  const colMap = Object.fromEntries(cols.map(c => [c.name, c]));

  const fromCol = colMap["from_warehouse_id"];
  const toCol   = colMap["to_warehouse_id"];

  // Only recreate if either legacy column is NOT NULL without a default
  const needsFix = (fromCol && fromCol.notnull && fromCol.dflt_value == null)
                || (toCol   && toCol.notnull   && toCol.dflt_value   == null);

  if (!needsFix) return;

  db.exec("PRAGMA foreign_keys = OFF");

  db.exec(`
    CREATE TABLE IF NOT EXISTS branch_transfers_v2 (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_no    TEXT NOT NULL UNIQUE,
      type            TEXT NOT NULL DEFAULT 'receive',
      warehouse_id    INTEGER NOT NULL DEFAULT 1,
      from_warehouse_id INTEGER NOT NULL DEFAULT 1,
      to_warehouse_id   INTEGER NOT NULL DEFAULT 1,
      partner_branch  TEXT,
      notes           TEXT,
      created_by      INTEGER,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME,
      status          TEXT NOT NULL DEFAULT 'active',
      cancelled_at    DATETIME,
      cancelled_by    INTEGER,
      cancel_reason   TEXT,
      from_branch_id  INTEGER,
      to_branch_id    INTEGER
    )
  `);

  // Collect actual column names from old table to build a safe SELECT
  const srcCols = cols.map(c => c.name);
  const destCols = [
    "id", "reference_no", "type", "warehouse_id",
    "from_warehouse_id", "to_warehouse_id",
    "partner_branch", "notes", "created_by", "created_at", "updated_at",
    "status", "cancelled_at", "cancelled_by", "cancel_reason",
    "from_branch_id", "to_branch_id",
  ];

  const selectExprs = destCols.map(col => {
    if (srcCols.includes(col)) return col;
    // Provide safe defaults for columns that don't exist in source
    if (col === "type")              return "'receive'";
    if (col === "warehouse_id")      return "1";
    if (col === "from_warehouse_id") return "COALESCE(warehouse_id, 1)";
    if (col === "to_warehouse_id")   return "COALESCE(warehouse_id, 1)";
    if (col === "status")            return "'active'";
    return "NULL";
  });

  db.exec(`
    INSERT INTO branch_transfers_v2 (${destCols.join(", ")})
    SELECT ${selectExprs.join(", ")}
    FROM branch_transfers
  `);

  db.exec("DROP TABLE branch_transfers");
  db.exec("ALTER TABLE branch_transfers_v2 RENAME TO branch_transfers");

  db.exec("PRAGMA foreign_keys = ON");
}

module.exports = { up };
