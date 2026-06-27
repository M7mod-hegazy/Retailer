module.exports = {
  up(db) {
    const fixed = db.prepare(`
      UPDATE purchase_lines
      SET item_name_ar = COALESCE(
        purchase_lines.item_name_ar,
        (SELECT name FROM items WHERE items.id = purchase_lines.item_id)
      ),
      item_name_en = COALESCE(
        purchase_lines.item_name_en,
        (SELECT name_en FROM items WHERE items.id = purchase_lines.item_id)
      ),
      barcode = COALESCE(
        purchase_lines.barcode,
        (SELECT barcode FROM items WHERE items.id = purchase_lines.item_id)
      ),
      supplier_name = COALESCE(
        purchase_lines.supplier_name,
        (SELECT s.name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = purchase_lines.purchase_id)
      )
      WHERE item_name_ar IS NULL
         OR item_name_en IS NULL
         OR barcode IS NULL
         OR supplier_name IS NULL
    `).run();
    console.log(`[148] Backfilled snapshots for ${fixed.changes} purchase_lines`);
  }
};
