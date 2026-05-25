/**
 * Backfill phase for the pricing system:
 * 1. Insert price_history baseline rows for existing items (source='item_create')
 * 2. Backfill master_price_at_time on existing invoice/return/transfer lines
 * 3. Create synthetic opening-balance purchases for items with stock but no purchase history
 *
 * All operations are idempotent — safe to run multiple times.
 */

function up(db) {
  // ── 1. Backfill price_history with item creation baselines ──────────────────
  // Only insert if no 'item_create' row already exists for that item+field
  const items = db.prepare(`
    SELECT id, sale_price, purchase_price, wholesale_price FROM items WHERE deleted_at IS NULL
  `).all();

  const insertHistory = db.prepare(`
    INSERT INTO price_history (item_id, field, old_value, new_value, adjustment_type, adjustment_value, source, operation_id, changed_at)
    SELECT ?, ?, 0, ?, 'set', ?, 'item_create', 'BASELINE', '2020-01-01 00:00:00'
    WHERE NOT EXISTS (
      SELECT 1 FROM price_history WHERE item_id = ? AND field = ? AND source = 'item_create'
    )
  `);

  for (const item of items) {
    if (item.sale_price > 0) {
      insertHistory.run(item.id, 'sale_price', item.sale_price, item.sale_price, item.id, 'sale_price');
    }
    if (item.purchase_price > 0) {
      insertHistory.run(item.id, 'purchase_price', item.purchase_price, item.purchase_price, item.id, 'purchase_price');
    }
    if (item.wholesale_price > 0) {
      insertHistory.run(item.id, 'wholesale_price', item.wholesale_price, item.wholesale_price, item.id, 'wholesale_price');
    }
  }

  // ── 2. Backfill master_price_at_time on invoice_lines ──────────────────────
  // Use current items.sale_price as best-effort approximation; mark as backfilled
  db.exec(`
    UPDATE invoice_lines
    SET master_price_at_time = (
      SELECT i.sale_price FROM items i WHERE i.id = invoice_lines.item_id
    ),
    master_price_backfilled = 1
    WHERE master_price_at_time IS NULL
      AND item_id IS NOT NULL
  `);

  // ── 3. Backfill master_price_at_time on sales_return_lines ─────────────────
  db.exec(`
    UPDATE sales_return_lines
    SET master_price_at_time = (
      SELECT i.sale_price FROM items i WHERE i.id = sales_return_lines.item_id
    ),
    master_price_backfilled = 1
    WHERE master_price_at_time IS NULL
      AND item_id IS NOT NULL
  `);

  // ── 4. Backfill master_price_at_time on purchase_return_lines ──────────────
  db.exec(`
    UPDATE purchase_return_lines
    SET master_price_at_time = (
      SELECT i.purchase_price FROM items i WHERE i.id = purchase_return_lines.item_id
    ),
    master_price_backfilled = 1
    WHERE master_price_at_time IS NULL
      AND item_id IS NOT NULL
  `);

  // ── 5. Backfill master_price_at_time on branch_transfer_lines ──────────────
  db.exec(`
    UPDATE branch_transfer_lines
    SET master_price_at_time = (
      SELECT i.purchase_price FROM items i WHERE i.id = branch_transfer_lines.item_id
    ),
    master_price_backfilled = 1
    WHERE master_price_at_time IS NULL
      AND item_id IS NOT NULL
  `);

  // ── 6. Create synthetic opening-balance purchases for items with stock but no purchase history ──
  // These allow WACC replay to start from a known cost basis
  const itemsWithStockNoPurchase = db.prepare(`
    SELECT i.id as item_id, i.purchase_price, i.name,
           COALESCE(SUM(sl.quantity), 0) as total_qty
    FROM items i
    LEFT JOIN stock_levels sl ON sl.item_id = i.id
    WHERE i.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM purchase_lines pl
        JOIN purchases p ON p.id = pl.purchase_id
        WHERE pl.item_id = i.id
          AND p.status NOT IN ('cancelled', 'voided')
      )
    GROUP BY i.id
    HAVING total_qty > 0
  `).all();

  for (const row of itemsWithStockNoPurchase) {
    if (row.total_qty <= 0 || row.purchase_price <= 0) continue;

    // Check no opening balance purchase already exists
    const existing = db.prepare(`
      SELECT id FROM purchases WHERE is_opening_balance = 1
        AND id IN (SELECT purchase_id FROM purchase_lines WHERE item_id = ?)
    `).get(row.item_id);
    if (existing) continue;

    // Create a synthetic purchase (no supplier, no doc_no)
    const insertPurchase = db.prepare(`
      INSERT INTO purchases (doc_no, created_at, updated_at, status, total, is_opening_balance)
      VALUES (?, '2020-01-01 00:00:00', '2020-01-01 00:00:00', 'active', ?, 1)
    `);
    const purchaseResult = insertPurchase.run(
      `OB-${row.item_id}`,
      row.purchase_price * row.total_qty
    );

    db.prepare(`
      INSERT INTO purchase_lines (purchase_id, item_id, quantity, unit_cost, line_total, is_opening_balance,
        update_master_purchase_price, update_master_sale_price, update_master_wholesale_price)
      VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0)
    `).run(purchaseResult.lastInsertRowid, row.item_id, row.total_qty, row.purchase_price,
           row.purchase_price * row.total_qty);
  }
}

module.exports = { up };
