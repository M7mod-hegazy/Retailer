function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

module.exports = {
  up(db) {
    addColumnIfMissing(db, "ajal_debts", "party_type", "TEXT NOT NULL DEFAULT 'customer'");
    addColumnIfMissing(db, "ajal_debts", "supplier_id", "INTEGER REFERENCES suppliers(id)");
    addColumnIfMissing(db, "ajal_debts", "source_type", "TEXT NOT NULL DEFAULT 'invoice'");

    db.exec(`
      UPDATE ajal_debts
      SET party_type = 'customer', source_type = 'invoice'
      WHERE party_type IS NULL OR party_type = '';
    `);
  },
};
