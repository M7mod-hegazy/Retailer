function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      config TEXT NOT NULL,
      cron TEXT NOT NULL,
      format TEXT DEFAULT 'excel',
      recipients TEXT,
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
}

module.exports = { up };
