function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "146_daily_cash_counts",
  up(db) {
    // Cash-count check-ins: the owner can count the drawer at any time during the day
    // and save each count with the discrepancy (counted - expected) at that moment plus
    // an optional note. Multiple check-ins per day form a log visible at end of day.
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_cash_counts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        date          TEXT NOT NULL,
        amount        REAL NOT NULL,
        expected_cash REAL NOT NULL,
        discrepancy   REAL NOT NULL,
        note          TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT,
        created_by    INTEGER REFERENCES users(id)
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_daily_cash_counts_date ON daily_cash_counts(date)");

    // Free-form note for the whole day (separate from the unwired close-flow notes column).
    addColumnIfMissing(db, "daily_sessions", "day_notes", "TEXT");
  },
};
