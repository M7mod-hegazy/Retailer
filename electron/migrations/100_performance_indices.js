module.exports = {
  up(db) {
    const tableExists = (t) =>
      !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    const indexExists = (i) =>
      !!db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(i);
    const hasColumn = (t, c) =>
      db.prepare(`PRAGMA table_info(${t})`).all().some((r) => r.name === c);

    const ensureIndex = (name, table, column) => {
      if (!tableExists(table) || !hasColumn(table, column) || indexExists(name)) return;
      try {
        db.exec(`CREATE INDEX ${name} ON ${table}(${column})`);
      } catch (e) {
        // Index creation must never block startup — log and continue.
        console.warn(`[migration 100] skipped index ${name}: ${e.message}`);
      }
    };

    ensureIndex("idx_invoice_lines_invoice_id", "invoice_lines", "invoice_id");
    ensureIndex("idx_purchase_lines_purchase_id", "purchase_lines", "purchase_id");
    ensureIndex("idx_stock_movements_item_id", "stock_movements", "item_id");
    ensureIndex("idx_stock_levels_item_id", "stock_levels", "item_id");
  },
};
