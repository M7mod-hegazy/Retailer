function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      config TEXT NOT NULL,
      columns TEXT,
      rows TEXT NOT NULL,
      totals TEXT,
      label TEXT,
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
}

module.exports = { up };
