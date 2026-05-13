module.exports = {
  name: '055_margin_settings',
  up(db) {
    // Global minimum margin % in settings
    const sCols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
    if (!sCols.includes('min_margin_percent'))
      db.prepare("ALTER TABLE settings ADD COLUMN min_margin_percent REAL DEFAULT 15").run();

    // Per-item optional override (NULL = use global)
    const iCols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
    if (!iCols.includes('min_margin_percent'))
      db.prepare("ALTER TABLE items ADD COLUMN min_margin_percent REAL").run();
  },
};
