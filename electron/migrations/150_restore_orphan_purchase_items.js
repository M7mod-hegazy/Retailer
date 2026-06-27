/**
 * Bug fix: editing or voiding (deleting) a purchase failed with
 * "FOREIGN KEY constraint failed" when a row referenced an item that had been
 * hard-deleted (e.g. via an older item-import-undo). The void/edit reversal
 * re-inserts stock_movements / stock_levels / price_history rows, all of which
 * have item_id -> items(id) foreign keys, so the insert throws.
 *
 * This heals EVERY dangling item reference in the database (not only
 * purchase_lines) by asking SQLite itself, via PRAGMA foreign_key_check, which
 * rows point at a missing items row. For each missing item id it restores a
 * hidden (soft-deleted, is_active=0) stub item, preferring the name/barcode
 * snapshot already stored on a purchase_line. After this, foreign keys resolve
 * and the affected (old AND new) purchases become editable/voidable again. The
 * stubs never appear in normal item lists/search because deleted_at is set.
 */
module.exports = {
  up(db) {
    // 1. Collect every item id referenced by a child row but missing from items.
    const missing = new Set();
    const violations = db.prepare("PRAGMA foreign_key_check").all();
    for (const v of violations) {
      if (!v.table) continue;
      const fks = db.prepare(`PRAGMA foreign_key_list("${v.table}")`).all();
      const fk = fks.find((f) => f.id === v.fkid);
      if (!fk || fk.table !== "items") continue;
      try {
        const row = db.prepare(`SELECT "${fk.from}" AS v FROM "${v.table}" WHERE rowid = ?`).get(v.rowid);
        if (row && row.v != null) missing.add(Number(row.v));
      } catch (_) {
        /* WITHOUT ROWID table or odd shape — skip */
      }
    }

    // Safety net: also sweep purchase_lines directly (covers any edge case).
    for (const r of db
      .prepare(
        `SELECT DISTINCT pl.item_id AS id FROM purchase_lines pl
         WHERE pl.item_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM items i WHERE i.id = pl.item_id)`
      )
      .all()) {
      if (r.id != null) missing.add(Number(r.id));
    }

    if (!missing.size) {
      console.log("[150] No orphan item references to restore");
      return;
    }

    const snapStmt = db.prepare(
      `SELECT item_name_ar, item_name_en, barcode
       FROM purchase_lines
       WHERE item_id = ?
       ORDER BY (item_name_ar IS NULL), id DESC
       LIMIT 1`
    );
    const existsStmt = db.prepare("SELECT 1 FROM items WHERE id = ?");
    const insertStmt = db.prepare(
      `INSERT INTO items (id, name, name_en, barcode, code, is_active, deleted_at, item_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now','localtime'), 'product', datetime('now','localtime'), datetime('now','localtime'))`
    );

    let restored = 0;
    const tx = db.transaction(() => {
      for (const id of missing) {
        if (existsStmt.get(id)) continue; // already present
        const snap = snapStmt.get(id) || {};
        const name = snap.item_name_ar || snap.item_name_en || `صنف محذوف #${id}`;
        insertStmt.run(id, name, snap.item_name_en || null, snap.barcode || null, `DEL-${id}`);
        restored += 1;
      }
    });
    tx();
    console.log(`[150] Restored ${restored} soft-deleted stub items for ${missing.size} dangling item references`);
  },
};
