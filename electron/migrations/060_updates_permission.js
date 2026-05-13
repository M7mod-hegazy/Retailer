exports.up = (db) => {
  db.exec(`ALTER TABLE users ADD COLUMN can_view_updates INTEGER NOT NULL DEFAULT 0`)
  db.exec(`UPDATE users SET can_view_updates = 1 WHERE role IN ('admin', 'owner', 'dev')`)
}
