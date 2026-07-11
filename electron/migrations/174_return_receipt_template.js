function up(db) {
  // Ensure the message_templates table exists for un-migrated databases
  db.prepare(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      kind  TEXT UNIQUE NOT NULL,
      body  TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Add a dedicated template for sales-return receipts. Falls back to the
  // generic receipt template if the user customizes only that one.
  const exists = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get("return_receipt");
  if (!exists) {
    db.prepare("INSERT INTO message_templates (kind, body) VALUES (?, ?)").run(
      "return_receipt",
      "مرحباً {name}،\nتم استلام مرتجعك بنجاح ✅\nفاتورة المرتجع رقم: {invoice_no}\nإجمالي المسترد: {total} جنيه\n{shop}"
    );
  }
}

module.exports = { up };
