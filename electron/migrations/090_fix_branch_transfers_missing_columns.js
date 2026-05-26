/**
 * Idempotent fix: add any columns missing from branch_transfers and
 * branch_transfer_lines that older databases may not have.
 *
 * Covers databases where the table was created before migration 035
 * added `type`, or where later ALTER TABLE migrations were skipped.
 */
function addCol(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // branch_transfers — ensure every column the routes depend on exists
  addCol(db, 'branch_transfers', 'type',           "TEXT NOT NULL DEFAULT 'receive'");
  addCol(db, 'branch_transfers', 'warehouse_id',   'INTEGER NOT NULL DEFAULT 1');
  addCol(db, 'branch_transfers', 'partner_branch', 'TEXT');
  addCol(db, 'branch_transfers', 'notes',          'TEXT');
  addCol(db, 'branch_transfers', 'created_by',     'INTEGER');
  addCol(db, 'branch_transfers', 'updated_at',     'DATETIME');
  addCol(db, 'branch_transfers', 'status',         "TEXT DEFAULT 'active'");
  addCol(db, 'branch_transfers', 'cancelled_at',   'DATETIME');
  addCol(db, 'branch_transfers', 'cancelled_by',   'INTEGER');
  addCol(db, 'branch_transfers', 'cancel_reason',  'TEXT');

  // branch_transfer_lines — ensure every column the routes depend on exists
  addCol(db, 'branch_transfer_lines', 'warehouse_id',                'INTEGER NOT NULL DEFAULT 1');
  addCol(db, 'branch_transfer_lines', 'unit_cost',                   'NUMERIC DEFAULT 0');
  addCol(db, 'branch_transfer_lines', 'selling_price',               'NUMERIC DEFAULT 0');
  addCol(db, 'branch_transfer_lines', 'unit_id',                     'INTEGER');
  addCol(db, 'branch_transfer_lines', 'wholesale_price',             'NUMERIC DEFAULT 0');
  addCol(db, 'branch_transfer_lines', 'update_master_purchase_price','INTEGER DEFAULT 1');
  addCol(db, 'branch_transfer_lines', 'update_master_sale_price',    'INTEGER DEFAULT 1');
  addCol(db, 'branch_transfer_lines', 'update_master_wholesale_price','INTEGER DEFAULT 1');
}

module.exports = { up };
