const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function branchTransfers(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT bt.id, bt.reference_no, bt.type,
      w.name AS warehouse_name,
      bt.notes,
      u.full_name AS created_by,
      DATE(bt.created_at) AS date,
      COUNT(btl.id) AS item_count
    FROM branch_transfers bt
    LEFT JOIN warehouses w ON w.id = bt.warehouse_id
    LEFT JOIN users u ON u.id = bt.created_by
    LEFT JOIN branch_transfer_lines btl ON btl.transfer_id = bt.id
    WHERE 1=1 ${addDateFilter("bt.created_at", startDate, endDate, params)}
    GROUP BY bt.id
    ORDER BY bt.created_at DESC
  `).all(...params);
}

function warehouseLevels(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT w.name AS warehouse_name,
      COUNT(DISTINCT sl.item_id) AS item_count,
      COALESCE(SUM(sl.quantity), 0) AS total_quantity,
      COALESCE(SUM(sl.quantity * COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price)), 0) AS total_value,
      COUNT(DISTINCT CASE WHEN sl.quantity <= COALESCE(it.min_stock_qty, 0) THEN sl.item_id END) AS low_stock_items,
      ROUND(COALESCE(SUM(sl.quantity * COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price)), 0) * 100.0
        / NULLIF(SUM(SUM(sl.quantity * COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price))) OVER (), 0), 1) AS value_share_pct
    FROM warehouses w
    LEFT JOIN stock_levels sl ON sl.warehouse_id = w.id
    LEFT JOIN items it ON it.id = sl.item_id
    WHERE w.is_active = 1 AND it.deleted_at IS NULL
    GROUP BY w.id
    ORDER BY w.name ASC
  `).all();
}

function warehouseLevelsSummary(startDate, endDate, opts = {}) {
  return warehouseLevels(startDate, endDate, opts);
}

module.exports = {
  branchTransfers,
  warehouseLevels,
  warehouseLevelsSummary,
};
