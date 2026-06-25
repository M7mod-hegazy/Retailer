const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
router.use(authRequired);

function allSafe(db, sql, ...params) {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

function getSafe(db, sql, ...params) {
  try {
    return db.prepare(sql).get(...params) || null;
  } catch {
    return null;
  }
}

function loadPaymentMethods(db) {
  try {
    return db.prepare("SELECT * FROM payment_methods ORDER BY is_system DESC, sort_order ASC, id ASC").all();
  } catch {
    return allSafe(db, "SELECT * FROM payment_methods ORDER BY id ASC");
  }
}

function loadCategories(db) {
  try {
    return db.prepare("SELECT id, name, sku_prefix FROM item_categories ORDER BY CAST(COALESCE(sku_prefix, '0') AS INTEGER) ASC, id ASC").all();
  } catch {
    return allSafe(db, "SELECT id, name, sku_prefix FROM item_categories ORDER BY name ASC");
  }
}

function loadBootstrapItems(db, limit) {
  const rows = allSafe(
    db,
    `
      SELECT i.*, c.name AS category_name, c.sku_prefix, u.name AS unit_name,
             COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.item_id = i.id), 0) AS stock_quantity,
             COALESCE((SELECT wacc FROM stock_levels sl WHERE sl.item_id = i.id LIMIT 1), i.purchase_price, 0) AS current_cost,
             COALESCE((SELECT last_purchase_cost FROM stock_levels sl WHERE sl.item_id = i.id LIMIT 1), i.purchase_price, 0) AS last_purchase_cost,
             (
               SELECT image_url
               FROM item_images img
               WHERE img.item_id = i.id
               ORDER BY img.is_primary DESC, img.sort_order ASC, img.id ASC
               LIMIT 1
             ) AS primary_image_url
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE i.deleted_at IS NULL AND i.is_active = 1
      ORDER BY i.id DESC
      LIMIT ?
    `,
    limit,
  );

  const itemIds = rows.map((row) => row.id).filter(Boolean);
  if (!itemIds.length) return { rows, stockRows: [] };

  const placeholders = itemIds.map(() => "?").join(",");
  const stockRows = allSafe(
    db,
    `SELECT item_id, warehouse_id, quantity FROM stock_levels WHERE item_id IN (${placeholders})`,
    ...itemIds,
  );

  return { rows, stockRows };
}

router.get("/bootstrap", requirePagePermission("pos", "view"), (_req, res) => {
  const db = getDb();
  const settings = getSafe(db, "SELECT * FROM settings LIMIT 1") || {};
  const { rows: items, stockRows } = loadBootstrapItems(db, 80);

  res.json({
    success: true,
    data: {
      settings,
      items,
      stock_levels: stockRows,
      customers: allSafe(
        db,
        "SELECT * FROM customers WHERE is_active = 1 OR is_active IS NULL ORDER BY id DESC LIMIT 30",
      ),
      categories: loadCategories(db),
      warehouses: allSafe(db, "SELECT * FROM warehouses WHERE is_active = 1 OR is_active IS NULL ORDER BY id ASC"),
      banks: allSafe(db, "SELECT * FROM banks WHERE is_active = 1 OR is_active IS NULL ORDER BY id ASC"),
      treasuries: allSafe(db, "SELECT * FROM treasuries WHERE is_active = 1 OR is_active IS NULL ORDER BY id ASC"),
      units: allSafe(db, "SELECT * FROM units ORDER BY id ASC"),
      employees: allSafe(db, "SELECT * FROM employees WHERE is_active = 1 OR is_active IS NULL ORDER BY id ASC"),
      payment_methods: loadPaymentMethods(db),
    },
  });
});

module.exports = router;
