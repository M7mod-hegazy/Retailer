/**
 * Pricing system schema — adds lock columns, override tracking columns,
 * integrity check tables, and enriches price_history with source column.
 */

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // ── Lock state per purchase line (1 = update master, 0 = this invoice only) ──
  addColumnIfMissing(db, 'purchase_lines', 'update_master_purchase_price',  'BOOLEAN NOT NULL DEFAULT 1');
  addColumnIfMissing(db, 'purchase_lines', 'update_master_sale_price',       'BOOLEAN NOT NULL DEFAULT 1');
  addColumnIfMissing(db, 'purchase_lines', 'update_master_wholesale_price',  'BOOLEAN NOT NULL DEFAULT 1');

  // ── Opening balance flag on purchases / purchase_lines ──
  addColumnIfMissing(db, 'purchase_lines', 'is_opening_balance', 'BOOLEAN NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'purchases',      'is_opening_balance', 'BOOLEAN NOT NULL DEFAULT 0');

  // ── Override capture: snapshot of master price at the time the line was saved ──
  addColumnIfMissing(db, 'invoice_lines',          'master_price_at_time',  'REAL');
  addColumnIfMissing(db, 'invoice_lines',          'master_price_backfilled','BOOLEAN NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'sales_return_lines',     'master_price_at_time',  'REAL');
  addColumnIfMissing(db, 'sales_return_lines',     'master_price_backfilled','BOOLEAN NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'purchase_return_lines',  'master_price_at_time',  'REAL');
  addColumnIfMissing(db, 'purchase_return_lines',  'master_price_backfilled','BOOLEAN NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'branch_transfer_lines',  'master_price_at_time',  'REAL');
  addColumnIfMissing(db, 'branch_transfer_lines',  'master_price_backfilled','BOOLEAN NOT NULL DEFAULT 0');

  // ── FIFO/LIFO lot linkage (nullable — legacy rows stay NULL) ──
  addColumnIfMissing(db, 'invoice_lines', 'origin_purchase_line_id',  'INTEGER');
  addColumnIfMissing(db, 'invoice_lines', 'origin_purchase_line_qty', 'REAL');

  // ── Settings: costing method + target margin ──
  addColumnIfMissing(db, 'settings', 'margin_alert_cost_method', "TEXT NOT NULL DEFAULT 'wacc'");
  addColumnIfMissing(db, 'settings', 'target_margin_percent',    'REAL DEFAULT 25');

  // ── Enrich price_history ──
  addColumnIfMissing(db, 'price_history', 'source', 'TEXT');
  // source values: 'item_create' | 'bulk_update' | 'purchase_locked' | 'manual_correction'

  // ── Integrity check tables ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS integrity_check_runs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      ran_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      ran_by            INTEGER,
      status            TEXT    NOT NULL,
      total_issues      INTEGER NOT NULL DEFAULT 0,
      unresolved_issues INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS integrity_check_issues (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id      INTEGER NOT NULL REFERENCES integrity_check_runs(id),
      item_id     INTEGER,
      issue_type  TEXT    NOT NULL,
      details     TEXT,
      resolved_at TEXT,
      resolved_by INTEGER,
      resolution  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_integrity_runs_at   ON integrity_check_runs(ran_at);
    CREATE INDEX IF NOT EXISTS idx_integrity_issues_run ON integrity_check_issues(run_id);
    CREATE INDEX IF NOT EXISTS idx_integrity_issues_item ON integrity_check_issues(item_id);
  `);

  // ── Backfill price_history.source from operation_id prefix ──
  db.exec(`
    UPDATE price_history SET source = 'bulk_update'      WHERE source IS NULL AND operation_id LIKE 'BPU-%';
    UPDATE price_history SET source = 'purchase_locked'  WHERE source IS NULL AND operation_id LIKE 'PUR-%';
    UPDATE price_history SET source = 'manual_correction' WHERE source IS NULL AND operation_id IS NOT NULL;
    UPDATE price_history SET source = 'item_create'       WHERE source IS NULL AND operation_id IS NULL;
  `);
}

module.exports = { up };
