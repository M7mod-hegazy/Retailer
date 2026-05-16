module.exports = {
  up(db) {
    const addIfMissing = (table, col, def) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      }
    };

    addIfMissing("users", "can_view_updates", "INTEGER DEFAULT 0");
    addIfMissing("users", "branch_id", "INTEGER REFERENCES branches(id)");
    addIfMissing("branch_transfers", "from_branch_id", "INTEGER");
    addIfMissing("branch_transfers", "to_branch_id", "INTEGER");
    addIfMissing("notifications", "user_id", "INTEGER REFERENCES users(id)");
    addIfMissing("notifications", "message", "TEXT");
    addIfMissing("purchases", "payment_method", "TEXT DEFAULT 'cash'");
    addIfMissing("purchases", "warehouse_id", "INTEGER REFERENCES warehouses(id)");
    addIfMissing("purchases", "notes", "TEXT");
  },
};
