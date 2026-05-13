module.exports = {
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank', 'other'
        target_id INTEGER, -- treasury_id or bank_id
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default methods
    const settings = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get();
    const treasuryId = settings?.default_treasury_id || 1;

    db.prepare("INSERT INTO payment_methods (name, type, target_id) VALUES (?, ?, ?)")
      .run("نقدي - الخزينة الرئيسية", "cash", treasuryId);
  }
};
