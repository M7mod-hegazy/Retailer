const { getDb } = require("../config/database");

function adjustStock({ item_id, warehouse_id, quantityDelta, movement_type, reference_type = null, reference_id = null, notes = null, user_id = null }) {
  const db = getDb();
  const tx = db.transaction(() => {
    const current = db.prepare("SELECT * FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(item_id, warehouse_id);
    const beforeQty = current?.quantity ?? 0;
    const afterQty = beforeQty + Number(quantityDelta || 0);
    if (!current) {
      db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(item_id, warehouse_id, quantityDelta);
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
