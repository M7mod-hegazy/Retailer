/**
 * Bug fix: editing or voiding (deleting) an OLD purchase failed with
 * "FOREIGN KEY constraint failed" when one of its lines referenced an item that
 * had been hard-deleted (e.g. via an older item-import-undo). The void/edit stock
 * reversal calls adjustStock, which inserts into stock_movements/stock_levels —
 * both have item_id -> items(id) foreign keys, so the insert throws.
 *
 * This restores a soft-deleted (hidden) stub item for every item_id still
 * referenced by a purchase_line but missing from items, using the name/barcode
 * snapshot already stored on the purchase_line. After this, foreign keys resolve
 * and the existing (old) purchases become editable/voidable again. The stubs are
 * deleted_at + is_active=0 so they never appear in normal item lists or search.
 */
module.exports = {
  up(db) {
    const orphanIds = db
      .prepare(
        `SELECT DISTINCT pl.item_id AS id
         FROM purchase_lines pl
         WHERE pl.item_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM items i WHERE i.id = pl.item_id)`
      )
      .all()
      .map((r) => r.id);

    if (!orphanIds.length) {
      console.log("[150] No orphan purchase-line items to restore");
      return;
    }

    const snapStmt = db.prepare(
      `SELECT item_name_ar, item_name_en, barcode
       FROM purchase_lines
       WHERE item_id = ?
       ORDER BY (item_name_ar IS NULL), id DESC
       LIMIT 1`
    );
    const insertStmt = db.prepare(
      `INSERT INTO items (id, name, name_en, barcode, code, is_active, deleted_at, item_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now','localtime'), 'product', datetime('now','localtime'), datetime('now','localtime'))`
    );

    let restored = 0;
    const tx = db.transaction(() => {
      for (const id of orphanIds) {
        const snap = snapStmt.get(id) || {};
        const name = snap.item_name_ar || snap.item_name_en || `صنف محذوف #${id}`;
        insertStmt.run(
          id,
          name,
          snap.item_name_en || null,
          snap.barcode || null,
          `DEL-${id}`
        );
        restored += 1;
      }
    });
    tx();
    console.log(`[150] Restored ${restored} soft-deleted stub items for orphan purchase lines`);
  },
};
