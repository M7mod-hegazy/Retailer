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

  // Queue a POS→store stock push for store-linked items (best-effort; never throws).
  try {
    const linked = db.prepare("SELECT ecom_id FROM items WHERE id = ?").get(item_id);
    if (linked && linked.ecom_id) {
      const total = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS q FROM stock_levels WHERE item_id = ?").get(item_id);
      const { recordSyncChange } = require("./syncChangeService");
      recordSyncChange(db, { entity_type: "item", entity_id: item_id, field_name: "stock", old_value: null, new_value: total.q });
    }
  } catch { /* stock sync bookkeeping must never break a stock movement */ }
}

function deductBatches(db, item_id, warehouse_id, quantity) {
  const item = db.prepare("SELECT track_expiry FROM items WHERE id = ?").get(item_id);
  if (!item?.track_expiry) return;
  let remaining = Number(quantity);
  const batches = db.prepare(
    `SELECT id, quantity FROM item_batches
     WHERE item_id = ? AND warehouse_id = ? AND quantity > 0 AND expiry_date IS NOT NULL
     ORDER BY expiry_date ASC`
  ).all(item_id, warehouse_id);
  for (const batch of batches) {
    if (remaining <= 0) break;
    const consume = Math.min(remaining, batch.quantity);
    db.prepare("UPDATE item_batches SET quantity = quantity - ? WHERE id = ?").run(consume, batch.id);
    remaining -= consume;
  }
}

function createTransferBatch(db, item_id, warehouse_id, quantity, source_warehouse_id) {
  const item = db.prepare("SELECT track_expiry FROM items WHERE id = ?").get(item_id);
  if (!item?.track_expiry) return;
  let expiryDate = null, batchNo = null, costPrice = 0;
  if (source_warehouse_id) {
    const sourceBatch = db.prepare(
      `SELECT expiry_date, batch_no, cost_price FROM item_batches
       WHERE item_id = ? AND warehouse_id = ? AND quantity > 0 AND expiry_date IS NOT NULL
       ORDER BY expiry_date ASC LIMIT 1`
    ).get(item_id, source_warehouse_id);
    if (sourceBatch) {
      expiryDate = sourceBatch.expiry_date;
      batchNo = sourceBatch.batch_no;
      costPrice = sourceBatch.cost_price;
    }
  }
  db.prepare(
    `INSERT INTO item_batches (item_id, warehouse_id, batch_no, expiry_date, quantity, cost_price, source)
     VALUES (?, ?, ?, ?, ?, ?, 'transfer')`
  ).run(item_id, warehouse_id, batchNo, expiryDate, Number(quantity), costPrice);
}

module.exports = { adjustStock, deductBatches, createTransferBatch };
