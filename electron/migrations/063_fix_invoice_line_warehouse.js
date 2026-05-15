module.exports = {
  up(db) {
    const ilCols = db.prepare("PRAGMA table_info(invoice_lines)").all().map(c => c.name);
    if (!ilCols.includes("warehouse_id"))
      db.exec("ALTER TABLE invoice_lines ADD COLUMN warehouse_id INTEGER DEFAULT 1");
  },
};
