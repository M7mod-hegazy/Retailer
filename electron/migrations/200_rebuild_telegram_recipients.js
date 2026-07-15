// Repair the telegram_recipients table schema.
//
// Migration 197's dropColumnIfExists used `CREATE TABLE ... AS SELECT`, which
// silently drops the PRIMARY KEY, NOT NULL constraints and DEFAULT values.
// Every row inserted since then has id = NULL, so the client could never
// UPDATE or DELETE a recipient — each save created a duplicate row instead.
//
// This migration:
//   1. Dedupes rows by chat_id (keeping the most recently written row —
//      MAX(rowid) — so the user's latest toggle/preset edits win).
//   2. Rebuilds the table with the canonical schema (proper AUTOINCREMENT id,
//      NOT NULL defaults, created_at default) when the PK is missing.
//   3. Adds a UNIQUE index on chat_id so duplicates can never come back.

const NOTIFY_COLUMNS = [
  // [name, default]
  ["notify_new_invoice", 1],
  ["notify_daily_close", 1],
  ["notify_large_amounts", 1],
  ["notify_returns_voids", 1],
  ["notify_purchases_payments", 1],
  ["notify_customer_created", 1],
  ["notify_supplier_created", 1],
  ["notify_expense_created", 1],
  ["notify_return_payment", 1],
  ["notify_low_stock", 1],
  ["notify_system", 1],
  ["notify_weekly", 0],
  ["notify_monthly", 0],
  ["notify_yearly", 0],
  ["notify_stock_transfer", 1],
  ["notify_inventory_adjustment", 1],
  ["notify_new_product", 1],
  ["notify_price_change", 1],
  ["notify_batch_expiry", 1],
  ["notify_physical_count", 1],
  ["notify_supplier_payment", 1],
  ["notify_debt_payment", 1],
  ["notify_installment_paid", 1],
  ["notify_purchase_voided", 1],
  ["notify_purchase_return", 1],
  ["notify_branch_transfer", 1],
  ["notify_password_changed", 1],
  ["notify_permission_changed", 1],
  ["notify_supervisor_override", 1],
  ["notify_repair_created", 1],
  ["notify_repair_ready", 1],
  ["notify_repair_delivered", 1],
  ["notify_revenue_created", 1],
  ["notify_withdrawal_created", 1],
  ["notify_employee_created", 1],
  ["notify_salary_settled", 1],
  ["notify_advance_created", 1],
  ["notify_deduction_created", 1],
  ["notify_bonus_created", 1],
  ["notify_shift_open", 1],
];

module.exports = {
  name: "200_rebuild_telegram_recipients",
  up(db) {
    const info = db.prepare("PRAGMA table_info(telegram_recipients)").all();
    if (info.length === 0) return; // table doesn't exist yet — nothing to repair

    // 1. Dedupe by chat_id, keeping the newest physical row (latest edits win).
    db.prepare(`
      DELETE FROM telegram_recipients
      WHERE rowid NOT IN (
        SELECT MAX(rowid) FROM telegram_recipients GROUP BY chat_id
      )
    `).run();

    // 2. Rebuild if the id column lost its PRIMARY KEY (197 fallout).
    const hasPk = info.some((c) => c.pk > 0);
    if (!hasPk) {
      const oldCols = new Set(info.map((c) => c.name));
      const notifyDefs = NOTIFY_COLUMNS
        .map(([name, dflt]) => `${name} INTEGER NOT NULL DEFAULT ${dflt}`)
        .join(",\n          ");
      db.exec(`
        CREATE TABLE telegram_recipients_rebuild (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT NOT NULL DEFAULT '',
          chat_id       TEXT NOT NULL,
          enabled       INTEGER NOT NULL DEFAULT 1,
          ${notifyDefs},
          event_presets TEXT NOT NULL DEFAULT '{}',
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Copy only columns that exist in the broken table; COALESCE fills the
      // NULLs that CREATE-AS-SELECT rows accumulated (constraints were gone).
      const copyTargets = ["name", "chat_id", "enabled", "event_presets", "created_at"]
        .filter((c) => oldCols.has(c))
        .concat(NOTIFY_COLUMNS.map(([name]) => name).filter((c) => oldCols.has(c)));
      const copySelects = copyTargets.map((c) => {
        if (c === "name") return "COALESCE(name, '')";
        if (c === "chat_id") return "chat_id";
        if (c === "enabled") return "COALESCE(enabled, 1)";
        if (c === "event_presets") return "COALESCE(event_presets, '{}')";
        if (c === "created_at") return "COALESCE(created_at, datetime('now'))";
        const def = NOTIFY_COLUMNS.find(([name]) => name === c)?.[1] ?? 1;
        return `COALESCE(${c}, ${def})`;
      });
      db.prepare(`
        INSERT INTO telegram_recipients_rebuild (${copyTargets.join(", ")})
        SELECT ${copySelects.join(", ")}
        FROM telegram_recipients
        WHERE chat_id IS NOT NULL AND TRIM(chat_id) != ''
        ORDER BY rowid ASC
      `).run();

      db.exec("DROP TABLE telegram_recipients");
      db.exec("ALTER TABLE telegram_recipients_rebuild RENAME TO telegram_recipients");
    }

    // 3. Never allow duplicate chat_ids again.
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_recipients_chat_id ON telegram_recipients(chat_id)");
  },
};
