function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((col) => col.name === column);
}

function up(db) {
  const purchaseCols = {
    docNo: hasColumn(db, "purchases", "doc_no"),
    purchaseNo: hasColumn(db, "purchases", "purchase_no"),
    warehouseId: hasColumn(db, "purchases", "warehouse_id"),
    isOpeningBalance: hasColumn(db, "purchases", "is_opening_balance"),
    status: hasColumn(db, "purchases", "status"),
  };
  const purchaseLineHasWarehouse = hasColumn(db, "purchase_lines", "warehouse_id");

  const purchaseDocExpr = purchaseCols.docNo
    ? "COALESCE(p.doc_no, '')"
    : purchaseCols.purchaseNo
      ? "COALESCE(p.purchase_no, '')"
      : "''";
  const purchaseWhExpr = purchaseLineHasWarehouse
    ? `pl.warehouse_id`
    : purchaseCols.warehouseId
      ? `p.warehouse_id`
      : `NULL`;
  const openingExpr = purchaseCols.isOpeningBalance
    ? `COALESCE(p.is_opening_balance, 0) = 1 OR ${purchaseDocExpr} LIKE 'OB-%'`
    : `${purchaseDocExpr} LIKE 'OB-%'`;
  const purchaseStatusClause = purchaseCols.status
    ? "AND COALESCE(p.status, 'active') NOT IN ('cancelled', 'voided')"
    : "";

  db.exec(`
    INSERT OR IGNORE INTO cost_movements
      (item_id, warehouse_id, occurred_at, movement_type, quantity, unit_cost,
       source_table, source_id, source_line_id)
    SELECT
      pl.item_id,
      COALESCE(${purchaseWhExpr}, 1),
      COALESCE(p.created_at, datetime('now')),
      CASE WHEN ${openingExpr} THEN 'opening_balance' ELSE 'purchase' END,
      pl.quantity,
      pl.unit_cost,
      'purchase_lines',
      pl.purchase_id,
      pl.id
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    WHERE pl.item_id IS NOT NULL
      AND COALESCE(pl.quantity, 0) != 0
      ${purchaseStatusClause};
  `);

  const branchCols = db.prepare("PRAGMA table_info(branch_transfers)").all().map((col) => col.name);
  const branchLineCols = db.prepare("PRAGMA table_info(branch_transfer_lines)").all().map((col) => col.name);
  if (branchCols.length && branchLineCols.length) {
    const typeClause = branchCols.includes("type") ? "AND COALESCE(bt.type, 'receive') = 'receive'" : "";
    const statusClause = branchCols.includes("status")
      ? "AND COALESCE(bt.status, 'active') NOT IN ('cancelled', 'voided')"
      : "";
    const whExpr = branchLineCols.includes("warehouse_id") ? "btl.warehouse_id" : "bt.warehouse_id";

    db.exec(`
      INSERT OR IGNORE INTO cost_movements
        (item_id, warehouse_id, occurred_at, movement_type, quantity, unit_cost,
         source_table, source_id, source_line_id)
      SELECT
        btl.item_id,
        COALESCE(${whExpr}, 1),
        COALESCE(bt.created_at, datetime('now')),
        'branch_receive',
        btl.quantity,
        COALESCE(btl.unit_cost, 0),
        'branch_transfer_lines',
        btl.transfer_id,
        btl.id
      FROM branch_transfer_lines btl
      JOIN branch_transfers bt ON bt.id = btl.transfer_id
      WHERE btl.item_id IS NOT NULL
        AND COALESCE(btl.quantity, 0) != 0
        ${typeClause}
        ${statusClause};
    `);
  }
}

module.exports = { up };
