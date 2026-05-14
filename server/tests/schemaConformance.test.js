const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");

function getColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
}

describe("schema conformance", () => {
  beforeAll(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-schema-"));
    initDb(path.join(dir, "schema.db"));
  });

  test("creates all core spec tables", () => {
    const db = getDb();
    const requiredTables = [
      "settings",
      "users",
      "employees",
      "item_categories",
      "units",
      "items",
      "price_groups",
      "customers",
      "suppliers",
      "warehouses",
      "treasuries",
      "banks",
      "invoices",
      "invoice_lines",
      "purchases",
      "purchase_orders",
      "payments",
      "stock_levels",
      "stock_movements",
      "expenses",
      "revenues",
      "cheques",
      "installments",
      "shifts",
      "audit_logs",
      "notifications",
      "customer_groups",
      "expense_categories",
      "revenue_categories",
    ];

    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name);

    requiredTables.forEach((table) => {
      expect(rows).toContain(table);
    });
  });

  test("contains key columns required by auth/help flows", () => {
    const db = getDb();

    expect(getColumns(db, "settings")).toEqual(
      expect.arrayContaining([
        "branch_code",
        "company_name_en",
        "wizard_completed",
        "license_key",
        "license_status",
        "default_warehouse_id",
        "default_treasury_id",
      ]),
    );

    expect(getColumns(db, "users")).toEqual(
      expect.arrayContaining(["full_name", "role", "pin_code", "is_active", "last_login_at"]),
    );

    expect(getColumns(db, "invoices")).toEqual(expect.arrayContaining(["invoice_no", "status", "shift_id"]));
    expect(getColumns(db, "user_help_state")).toEqual(expect.arrayContaining(["user_id", "page_key", "completed"]));
  });

  test("contains important operational indexes", () => {
    const db = getDb();
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name);

    expect(indexes).toEqual(
      expect.arrayContaining([
        "idx_items_barcode",
        "idx_customers_phone",
        "idx_invoices_created_at",
        "idx_payments_created_at",
        "idx_stock_movements_created_at",
      ]),
    );
  });
});
