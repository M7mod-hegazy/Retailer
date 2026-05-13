const { getDb } = require("../config/database");
const { adjustStock } = require("./stockService");

function transferStock({ item_id, from_warehouse_id, to_warehouse_id, quantity, notes = null, user_id = null }) {
  const db = getDb();
  const normalizedQuantity = Number(quantity || 0);

  return db.transaction(() => {
    if (!item_id || !from_warehouse_id || !to_warehouse_id || normalizedQuantity <= 0) {
      const err = new Error("Invalid stock transfer payload");
      err.status = 400;
      throw err;
    }
    if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
      const err = new Error("Source and destination warehouses must differ");
      err.status = 400;
      throw err;
    }

    const current = db
      .prepare("SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?")
      .get(item_id, from_warehouse_id);

    if (!current || current.quantity < normalizedQuantity) {
      const err = new Error("Insufficient stock for transfer");
      err.status = 400;
      throw err;
    }

    adjustStock({
      item_id,
      warehouse_id: from_warehouse_id,
      quantityDelta: -normalizedQuantity,
      movement_type: "transfer_out",
      reference_type: "stock_transfer",
      reference_id: null,
      notes,
      user_id,
    });

    adjustStock({
      item_id,
      warehouse_id: to_warehouse_id,
      quantityDelta: normalizedQuantity,
      movement_type: "transfer_in",
      reference_type: "stock_transfer",
      reference_id: null,
      notes,
      user_id,
    });

    return { item_id, from_warehouse_id, to_warehouse_id, quantity: normalizedQuantity };
  })();
}

module.exports = { transferStock };
