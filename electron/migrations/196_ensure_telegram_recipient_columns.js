// Safety-net migration: ensure all Telegram recipient event columns exist.
// Fixes cases where an older/partial version of migration 194 ran and left
// some columns missing, causing PUT/INSERT on telegram_recipients to 500.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

const RECIPIENT_COLUMNS = [
  "notify_stock_transfer",
  "notify_inventory_adjustment",
  "notify_new_product",
  "notify_price_change",
  "notify_batch_expiry",
  "notify_physical_count",
  "notify_supplier_payment",
  "notify_debt_payment",
  "notify_installment_paid",
  "notify_purchase_voided",
  "notify_purchase_return",
  "notify_branch_transfer",
  "notify_password_changed",
  "notify_permission_changed",
  "notify_supervisor_override",
  "notify_repair_created",
  "notify_repair_ready",
  "notify_repair_delivered",
  "notify_revenue_created",
  "notify_withdrawal_created",
  "notify_employee_created",
  "notify_salary_settled",
  "notify_advance_created",
  "notify_deduction_created",
  "notify_bonus_created",
];

const SETTINGS_COLUMNS = RECIPIENT_COLUMNS.map((c) => `telegram_${c}`);

module.exports = {
  name: "196_ensure_telegram_recipient_columns",
  up(db) {
    for (const col of RECIPIENT_COLUMNS) {
      addColumnIfMissing(db, "telegram_recipients", col, "INTEGER NOT NULL DEFAULT 1");
    }
    for (const col of SETTINGS_COLUMNS) {
      addColumnIfMissing(db, "settings", col, "INTEGER NOT NULL DEFAULT 1");
    }
  },
};
