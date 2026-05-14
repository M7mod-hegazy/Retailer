const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const {
  getSalesSummary,
  getInventoryValuation,
  getLowStock,
  getProfitLoss,
} = require("../src/services/reportService");
const accounts = require("../src/reports/queries/accounts");

function seedReportsDb() {
  const db = getDb();
  db.pragma("foreign_keys = OFF");

  db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pcs");
  db.prepare("INSERT INTO warehouses (name, is_default) VALUES (?, ?)").run("مستودع رئيسي", 1);

  const catId = Number(db.prepare("INSERT INTO item_categories (name) VALUES (?)").run("مشروبات").lastInsertRowid);
  const expCatId = Number(db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run("تشغيل").lastInsertRowid);
  const unitId = db.prepare("SELECT id FROM units LIMIT 1").get().id;

  const itemId = Number(db
    .prepare("INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run("عصير", "RPT-001", 200, 80, catId, unitId).lastInsertRowid);
  const customerId = Number(db.prepare("INSERT INTO customers (name) VALUES (?)").run("عميل تقارير").lastInsertRowid);

  const invoiceId = Number(db.prepare(
    "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("INV-RPT-1", customerId, 400, 20, 380, "cash", "paid", "2026-04-01").lastInsertRowid);

  db.prepare("INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, line_total, cost_wacc) VALUES (?, ?, ?, ?, ?, ?)").run(
    invoiceId, itemId, 2, 200, 400, 160,
  );
  db.prepare("INSERT INTO expenses (category_id, amount, notes, created_at) VALUES (?, ?, ?, ?)").run(expCatId, 50, "كهرباء", "2026-04-01");

  return { itemId, customerId, invoiceId };
}

describe("reports analytics", () => {
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-reports-"));
    initDb(path.join(dir, "reports.db"));
    seedReportsDb();
  });

  test("profit and loss returns structured array with correct values", () => {
    const result = accounts.profitLoss("2026-04-01", "2026-04-30", {});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(6);
    const revenueRow = result.find(r => r.section === "revenue" && r.label === "الإيرادات");
    expect(revenueRow.amount).toBe(380);
    const cogsRow = result.find(r => r.section === "cogs");
    expect(cogsRow.amount).toBe(160);
    const grossProfitRow = result.find(r => r.section === "gross_profit");
    expect(grossProfitRow.amount).toBe(200);
    const expensesRow = result.find(r => r.section === "expenses");
    expect(expensesRow.amount).toBe(50);
    const netProfitRow = result.find(r => r.section === "net_profit");
    expect(netProfitRow.amount).toBe(150);
  });

  test("legacy getProfitLoss still works for backward compat", () => {
    const result = getProfitLoss("2026-04-01", "2026-04-30");
    expect(result.revenue).toBe(380);
    expect(result.discounts).toBe(20);
    expect(result.cost_of_goods_sold).toBe(160);
    expect(result.gross_profit).toBe(200);
    expect(result.expenses).toBe(50);
    expect(result.net_profit).toBe(150);
  });

  test("getSalesSummary returns grouped daily sales", () => {
    const rows = getSalesSummary("2026-04-01", "2026-04-30");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].invoice_count).toBe(1);
    expect(rows[0].revenue).toBe(380);
    expect(rows[0].total_discount).toBe(20);
  });

  test("getSalesSummary returns empty array when no sales in range", () => {
    const rows = getSalesSummary("2025-01-01", "2025-01-31");
    expect(rows).toEqual([]);
  });

  test("getSalesSummary without date range returns all sales", () => {
    const rows = getSalesSummary(null, null);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test("getInventoryValuation returns per-item valuation", () => {
    const rows = getInventoryValuation();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty("item_code");
    expect(rows[0]).toHaveProperty("name");
    expect(rows[0]).toHaveProperty("category_name");
    expect(rows[0]).toHaveProperty("total_quantity");
    expect(rows[0]).toHaveProperty("cost_price");
    expect(rows[0]).toHaveProperty("total_value");
  });

  test("getLowStock returns items below minimum stock", () => {
    const db = getDb();
    const unitId = db.prepare("SELECT id FROM units LIMIT 1").get().id;
    const catId = db.prepare("SELECT id FROM item_categories LIMIT 1").get().id;
    const whId = db.prepare("SELECT id FROM warehouses LIMIT 1").get().id;
    const itemId = Number(db.prepare(
      "INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id, min_stock_qty) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("منخفض", "LOW-001", 50, 25, catId, unitId, 10).lastInsertRowid);
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(itemId, whId, 3);
    const rows = getLowStock();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(Number(rows[0].quantity)).toBeLessThanOrEqual(Number(rows[0].min_stock));
  });

  test("getLowStock returns empty when all items have stock above minimum", () => {
    const db = getDb();
    const unitId = db.prepare("SELECT id FROM units LIMIT 1").get().id;
    const catId = db.prepare("SELECT id FROM item_categories LIMIT 1").get().id;
    const whId = db.prepare("SELECT id FROM warehouses LIMIT 1").get().id;
    const itemId = Number(db.prepare(
      "INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id, min_stock_qty) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("مخزن جيد", "OK-001", 50, 25, catId, unitId, 5).lastInsertRowid);
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(itemId, whId, 100);
    const rows = getLowStock();
    expect(rows.length).toBe(0);
  });
});
