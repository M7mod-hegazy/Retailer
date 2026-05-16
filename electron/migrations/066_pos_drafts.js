module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pos_drafts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        type          TEXT NOT NULL DEFAULT 'held',
        lines_json    TEXT NOT NULL DEFAULT '[]',
        customer_json TEXT,
        discount      INTEGER NOT NULL DEFAULT 0,
        increase      INTEGER NOT NULL DEFAULT 0,
        payment_type  TEXT NOT NULL DEFAULT 'cash',
        held_at       TEXT NOT NULL DEFAULT (datetime('now')),
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
  down(db) {
    db.exec(`DROP TABLE IF EXISTS pos_drafts;`);
  },
};
