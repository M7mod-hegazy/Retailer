function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "138_feature_expiry_flag",
  up(db) {
    // FEFO / expiry tracking is now a toggleable feature module — OFF by default
    // for every database (fresh and existing). Existing track_expiry items and
    // item_batches rows are preserved untouched; they go dormant until the owner
    // enables the feature from Settings → Features.
    addColumnIfMissing(db, "settings", "feature_expiry", "INTEGER NOT NULL DEFAULT 0");
  },
};
