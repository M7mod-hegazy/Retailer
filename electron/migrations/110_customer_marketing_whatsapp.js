function up(db) {
  // Customer marketing fields
  const cols = db.prepare("PRAGMA table_info(customers)").all().map(c => c.name);
  if (!cols.includes("birthday"))           db.prepare("ALTER TABLE customers ADD COLUMN birthday TEXT").run();
  if (!cols.includes("marketing_opt_in"))   db.prepare("ALTER TABLE customers ADD COLUMN marketing_opt_in INTEGER DEFAULT 0").run();
  if (!cols.includes("whatsapp_opt_out"))   db.prepare("ALTER TABLE customers ADD COLUMN whatsapp_opt_out INTEGER DEFAULT 0").run();
  if (!cols.includes("capture_source"))     db.prepare("ALTER TABLE customers ADD COLUMN capture_source TEXT").run();

  // WhatsApp outbox queue
  db.prepare(`
    CREATE TABLE IF NOT EXISTS wa_outbox (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_phone TEXT NOT NULL,
      customer_id INTEGER,
      kind        TEXT NOT NULL DEFAULT 'receipt',
      payload     TEXT NOT NULL DEFAULT '{}',
      status      TEXT NOT NULL DEFAULT 'pending',
      attempts    INTEGER NOT NULL DEFAULT 0,
      scheduled_at TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at     TEXT,
      error       TEXT
    )
  `).run();

  // Message templates table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      kind  TEXT UNIQUE NOT NULL,
      body  TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Seed default templates
  const tpls = [
    { kind: "receipt",  body: "مرحباً {name}،\nشكراً لتسوقك معنا 🛍️\nفاتورة رقم: {invoice_no}\nالإجمالي: {total} جنيه\n{shop}" },
    { kind: "birthday", body: "كل عام وأنت بخير {name} 🎂\nبمناسبة عيد ميلادك، نتمنى لك يوماً سعيداً!\n{shop}" },
    { kind: "debt",     body: "عزيزي {name}،\nتذكير ودي: لديك رصيد مستحق {amount} جنيه.\nيسعدنا تسوية الحساب في أقرب وقت.\n{shop}" },
  ];
  const ins = db.prepare("INSERT OR IGNORE INTO message_templates (kind, body) VALUES (?, ?)");
  tpls.forEach(t => ins.run(t.kind, t.body));
}

module.exports = { up };
