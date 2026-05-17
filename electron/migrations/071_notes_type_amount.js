module.exports = {
  up: (db) => {
    try { db.exec("ALTER TABLE customer_notes ADD COLUMN type TEXT NOT NULL DEFAULT 'note'"); } catch (_) {}
    try { db.exec("ALTER TABLE customer_notes ADD COLUMN amount REAL"); } catch (_) {}
    try { db.exec("ALTER TABLE supplier_notes ADD COLUMN type TEXT NOT NULL DEFAULT 'note'"); } catch (_) {}
    try { db.exec("ALTER TABLE supplier_notes ADD COLUMN amount REAL"); } catch (_) {}

    // Backfill existing adjustment notes
    db.prepare(`
      UPDATE customer_notes SET type = 'adjustment'
      WHERE note LIKE 'تسوية رصيد بقيمة%'
    `).run();
    db.prepare(`
      UPDATE supplier_notes SET type = 'adjustment'
      WHERE note LIKE 'تسوية رصيد بقيمة%'
    `).run();
  },
};
