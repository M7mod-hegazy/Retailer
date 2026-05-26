/**
 * Add price-lock columns to branch_transfer_lines so that receive documents
 * can update master item prices (purchase_price, sale_price, wholesale_price)
 * exactly like purchase receipts do — with per-line opt-in/opt-out locks.
 *
 * Also adds wholesale_price to branch_transfer_lines for parity.
 */
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, 'branch_transfer_lines', 'wholesale_price',                'NUMERIC DEFAULT 0');
  addColumnIfMissing(db, 'branch_transfer_lines', 'update_master_purchase_price',   'INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'branch_transfer_lines', 'update_master_sale_price',       'INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'branch_transfer_lines', 'update_master_wholesale_price',  'INTEGER DEFAULT 1');
}

module.exports = { up };
