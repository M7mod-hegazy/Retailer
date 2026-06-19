/**
 * Ensure branch_transfers has from_warehouse_id and to_warehouse_id columns.
 * Handles two cases:
 *  1. Columns don't exist at all (very old DBs) → addColumnIfMissing
 *  2. Columns exist but are NOT NULL without a default → recreate table
 */
function up(db) {
  const cols = db.prepare("PRAGMA table_info(branch_transfers)").all();
  const colMap = Object.fromEntries(cols.map(c => [c.name, c]));

  const fromCol = colMap["from_warehouse_id"];
  const toCol   = colMap["to_warehouse_id"];

  // Case 1: columns are completely missing — just add them
  if (!fromCol) {
    db.exec("ALTER TABLE branch_transfers ADD COLUMN from_warehouse_id INTEGER NOT NULL DEFAULT 1");
  }
  if (!toCol) {
    db.exec("ALTER TABLE branch_transfers ADD COLUMN to_warehouse_id INTEGER NOT NULL DEFAULT 1");
  }

  // Re-read after potential ALTER
  const cols2 = db.prepare("PRAGMA table_info(branch_transfers)").all();
  const colMap2 = Object.fromEntries(cols2.map(c => [c.name, c]));
  const fromCol2 = colMap2["from_warehouse_id"];
  const toCol2   = colMap2["to_warehouse_id"];

  // Case 2: columns exist but NOT NULL without a default → recreate
  const needsRecreate =
    (fromCol2 && fromCol2.notnull && fromCol2.dflt_value == null) ||
    (toCol2   && toCol2.notnull   && toCol2.dflt_value   == null);

  if (!needsRecreate) return;

  db.exec("PRAGMA foreign_keys = OFF");

  db.exec(`
    CREATE TABLE IF NOT EXISTS branch_transfers_v3 (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_no      TEXT NOT NULL UNIQUE,
      type              TEXT NOT NULL DEFAULT 'receive',
      warehouse_id      INTEGER NOT NULL DEFAULT 1,
      from_warehouse_id INTEGER NOT NULL DEFAULT 1,
      to_warehouse_id   INTEGER NOT NULL DEFAULT 1,
      partner_branch    TEXT,
      notes             TEXT,
      created_by        INTEGER,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME,
      status            TEXT NOT NULL DEFAULT 'active',
      cancelled_at      DATETIME,
      cancelled_by      INTEGER,
      cancel_reason     TEXT,
      from_branch_id    INTEGER,
      to_branch_id      INTEGER
    )
  `);

  const srcCols = cols2.map(c => c.name);
  const destCols = [
    "id", "reference_no", "type", "warehouse_id",
    "from_warehouse_id", "to_warehouse_id",
    "partner_branch", "notes", "created_by", "created_at", "updated_at",
    "status", "cancelled_at", "cancelled_by", "cancel_reason",
    "from_branch_id", "to_branch_id",
  ];

  const selectExprs = destCols.map(col => {
    if (srcCols.includes(col)) return col;
    if (col === "type")              return "'receive'";
    if (col === "warehouse_id")      return "1";
    if (col === "from_warehouse_id") return "COALESCE(warehouse_id, 1)";
    if (col === "to_warehouse_id")   return "COALESCE(warehouse_id, 1)";
    if (col === "status")            return "'active'";
    return "NULL";
  });

  db.exec(`
    INSERT INTO branch_transfers_v3 (${destCols.join(", ")})
    SELECT ${selectExprs.join(", ")}
    FROM branch_transfers
  `);

  db.exec("DROP TABLE branch_transfers");
  db.exec("ALTER TABLE branch_transfers_v3 RENAME TO branch_transfers");
  db.exec("PRAGMA foreign_keys = ON");
}

module.exports = { up };
