module.exports = {
  up(db) {
    try { db.exec(`ALTER TABLE daily_sessions ADD COLUMN reopened_at TEXT`); } catch (_) {}
    try { db.exec(`ALTER TABLE daily_sessions ADD COLUMN reopened_by INTEGER REFERENCES users(id)`); } catch (_) {}
    try { db.exec(`ALTER TABLE daily_sessions ADD COLUMN reopen_reason TEXT`); } catch (_) {}
    try { db.exec(`ALTER TABLE daily_sessions ADD COLUMN opening_adjusted_at TEXT`); } catch (_) {}
    try { db.exec(`ALTER TABLE daily_sessions ADD COLUMN opening_adjusted_by INTEGER REFERENCES users(id)`); } catch (_) {}
    try { db.exec(`ALTER TABLE daily_sessions ADD COLUMN opening_adjust_reason TEXT`); } catch (_) {}
  },
  down(db) {
    // SQLite deployments may not support DROP COLUMN; keep this migration reversible by no-op.
  },
};
