function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id),
      method_id INTEGER REFERENCES payment_methods(id),
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id ON purchase_payments(purchase_id)"); } catch (_) {}
  try { db.exec("ALTER TABLE purchases ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE purchases ADD COLUMN bank_id INTEGER REFERENCES banks(id)"); } catch (_) {}
}

module.exports = { up };
