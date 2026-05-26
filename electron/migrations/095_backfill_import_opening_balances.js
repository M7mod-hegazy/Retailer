function columns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function pick(cols, name) {
  return cols.includes(name);
}

function up(db) {
  const purchaseCols = columns(db, "purchases");
  const lineCols = columns(db, "purchase_lines");

  const rows = db.prepare(`
    SELECT
      i.id AS item_id,
      i.name,
      i.name_en,
      i.barcode,
      COALESCE(i.purchase_price, 0) AS purchase_price,
      COALESCE(SUM(sl.quantity), 0) AS total_qty,
      COALESCE(MIN(sl.warehouse_id), 1) AS warehouse_id,
      COALESCE(MAX(sl.wacc), 0) AS max_wacc
    FROM items i
    JOIN stock_levels sl ON sl.item_id = i.id
    WHERE i.deleted_at IS NULL
      AND COALESCE(i.purchase_price, 0) > 0
    GROUP BY i.id
    HAVING total_qty > 0
      AND max_wacc = 0
      AND NOT EXISTS (
        SELECT 1
        FROM purchase_lines pl
        JOIN purchases p ON p.id = pl.purchase_id
        WHERE pl.item_id = i.id
          AND COALESCE(p.status, 'active') NOT IN ('cancelled', 'voided')
      )
      AND NOT EXISTS (
        SELECT 1 FROM cost_movements cm WHERE cm.item_id = i.id
      )
  `).all();

  for (const row of rows) {
    const docNo = `OB-IMPORT-${row.item_id}`;
    const existing = pick(purchaseCols, "doc_no")
      ? db.prepare("SELECT id FROM purchases WHERE doc_no = ?").get(docNo)
      : null;
    if (existing) continue;

    const purchaseInsertCols = [];
    const purchaseValues = [];
    const pushPurchase = (column, value) => {
      if (!pick(purchaseCols, column)) return;
      purchaseInsertCols.push(column);
      purchaseValues.push(value);
    };

    const total = Number(row.total_qty) * Number(row.purchase_price);
    pushPurchase("doc_no", docNo);
    pushPurchase("supplier_id", null);
    pushPurchase("total", total);
    pushPurchase("payment_method", "cash");
    pushPurchase("warehouse_id", row.warehouse_id);
    pushPurchase("created_at", "2020-01-01 00:00:00");
    pushPurchase("updated_at", "2020-01-01 00:00:00");
    pushPurchase("status", "active");
    pushPurchase("is_opening_balance", 1);

    const placeholders = purchaseInsertCols.map(() => "?").join(", ");
    const purchaseResult = db.prepare(`
      INSERT INTO purchases (${purchaseInsertCols.join(", ")})
      VALUES (${placeholders})
    `).run(...purchaseValues);

    const purchaseId = purchaseResult.lastInsertRowid;
    const lineInsertCols = [];
    const lineValues = [];
    const pushLine = (column, value) => {
      if (!pick(lineCols, column)) return;
      lineInsertCols.push(column);
      lineValues.push(value);
    };

    pushLine("purchase_id", purchaseId);
    pushLine("item_id", row.item_id);
    pushLine("quantity", row.total_qty);
    pushLine("unit_cost", row.purchase_price);
    pushLine("line_total", total);
    pushLine("is_opening_balance", 1);
    pushLine("item_name_ar", row.name || null);
    pushLine("item_name_en", row.name_en || null);
    pushLine("barcode", row.barcode || null);
    pushLine("supplier_name", null);
    pushLine("update_master_purchase_price", 0);
    pushLine("update_master_sale_price", 0);
    pushLine("update_master_wholesale_price", 0);

    const linePlaceholders = lineInsertCols.map(() => "?").join(", ");
    const lineResult = db.prepare(`
      INSERT INTO purchase_lines (${lineInsertCols.join(", ")})
      VALUES (${linePlaceholders})
    `).run(...lineValues);

    db.prepare(`
      INSERT OR IGNORE INTO cost_movements
        (item_id, warehouse_id, occurred_at, movement_type, quantity, unit_cost,
         source_table, source_id, source_line_id)
      VALUES (?, ?, '2020-01-01 00:00:00', 'opening_balance', ?, ?, 'purchase_lines', ?, ?)
    `).run(row.item_id, row.warehouse_id, row.total_qty, row.purchase_price, purchaseId, lineResult.lastInsertRowid);

    db.prepare(`
      UPDATE stock_levels
      SET wacc = ?, last_purchase_cost = ?
      WHERE item_id = ?
    `).run(row.purchase_price, row.purchase_price, row.item_id);
  }
}

module.exports = { up };
