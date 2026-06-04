module.exports = {
  up(db) {
    for (const table of ["sales_returns", "purchase_returns"]) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (!cols.includes("discount"))
        db.exec(`ALTER TABLE ${table} ADD COLUMN discount REAL NOT NULL DEFAULT 0`);
      if (!cols.includes("increase"))
        db.exec(`ALTER TABLE ${table} ADD COLUMN increase REAL NOT NULL DEFAULT 0`);
    }
  },
};
