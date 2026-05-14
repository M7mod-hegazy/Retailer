module.exports = {
  up(db) {
    try { db.exec("ALTER TABLE settings ADD COLUMN default_pos_view TEXT NOT NULL DEFAULT 'detailed'"); } catch (_) {}
  },
};
