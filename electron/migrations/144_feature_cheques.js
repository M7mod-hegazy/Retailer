function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "144_feature_cheques",
  up(db) {
    // Cheque management (إدارة الشيكات) is now a toggleable feature module — OFF by
    // default for every database (fresh and existing). Retail shops rarely use
    // post-dated cheques, so the page, its API and its profile tabs stay hidden
    // until the owner enables the feature from Settings → Features. Existing cheque
    // rows are preserved untouched and reappear when the feature is enabled.
    addColumnIfMissing(db, "settings", "feature_cheques", "INTEGER NOT NULL DEFAULT 0");
  },
};
