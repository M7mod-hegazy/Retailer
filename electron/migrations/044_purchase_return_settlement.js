function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

module.exports = {
  up(db) {
    addColumnIfMissing(db, "purchase_returns", "settlement_type", "TEXT NOT NULL DEFAULT 'account'");
    addColumnIfMissing(db, "purchase_returns", "treasury_id", "INTEGER REFERENCES treasuries(id)");

    db.exec(`
      UPDATE purchase_returns
      SET settlement_type = 'account'
      WHERE settlement_type IS NULL OR settlement_type = '';
    `);
  },
};
