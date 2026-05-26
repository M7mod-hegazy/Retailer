const { getDb } = require("../config/database");

function adjustStock({ item_id, warehouse_id, quantityDelta, movement_type, reference_type = null, reference_id = null, notes = null, user_id = null }) {
  const db = getDb();
  const tx = db.transaction(() => {
    const current = db.prepare("SELECT * FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(item_id, warehouse_id);
    const beforeQty = current?.quantity ?? 0;
    const afterQty = beforeQty + Number(quantityDelta || 0);
    if (!current) {
      const costRow = db.prepare(`
        SELECT wacc, last_purchase_cost
        FROM stock_levels
        WHERE item_id = ? AND (COALESCE(wacc, 0) > 0 OR COALESCE(last_purchase_cost, 0) > 0)
        LIMIT 1
      `).get(item_id);
      const itemCost = db.prepare("SELECT purchase_price FROM items WHERE id = ?").get(item_id);
      db.prepare(`
        INSERT INTO stock_levels (item_id, warehouse_id, quantity, wacc, last_purchase_cost)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        item_id,
        warehouse_id,
        quantityDelta,
        Number(costRow?.wacc ?? itemCost?.purchase_price ?? 0),
        Number(costRow?.last_purchase_cost ?? itemCost?.purchase_price ?? 0),
      );
    } else {
      db.prepare("UPDATE stock_levels SET quantity = quantity + ? WHERE item_id = ? AND warehouse_id = ?").run(quantityDelta, item_id, warehouse_id);
    }
    db.prepare(
      "INSERT INTO stock_movements (item_id, warehouse_id, movement_type, quantity, before_qty, after_qty, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(item_id, warehouse_id, movement_type, quantityDelta, beforeQty, afterQty, reference_type, reference_id, notes, user_id);
  });
  tx();
}

module.exports = { adjustStock };
