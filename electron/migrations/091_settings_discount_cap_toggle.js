module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
    // 1 = enforce the max-discount cap, 0 = no cap (unlimited discount allowed).
    if (!cols.includes("discount_cap_enabled"))
      db.exec("ALTER TABLE settings ADD COLUMN discount_cap_enabled INTEGER NOT NULL DEFAULT 1");
  },
};
