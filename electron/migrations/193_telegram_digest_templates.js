// Adds customizable Telegram periodic digest templates (weekly/monthly/yearly)
// so owners can choose and edit the message style, just like other Telegram alerts.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

const DIGEST_BODIES = {
  telegram_weekly_digest: `📊 الملخص الأسبوعي — {period_label}

💰 المبيعات: *{sales_total}*  {sales_delta}
🧾 عدد الفواتير: *{sales_count}*  (متوسط {avg_invoice})
📊 صافي الربح: *{profit}*

🏆 *أكثر المنتجات مبيعاً:*
{products_table}

⭐ *أفضل العملاء:*
{customers_table}

🏦 السيولة الحالية: *{liquidity}* (خزنة {treasury_balance} + بنك {bank_balance})
📌 مديونيات العملاء: *{debts}*
⚠️ أصناف تحت الحد الأدنى: *{low_stock_count}*`,

  telegram_monthly_digest: `🗓️ الملخص الشهري — {period_label}

💰 المبيعات: *{sales_total}*  {sales_delta}
🧾 عدد الفواتير: *{sales_count}*  (متوسط {avg_invoice})
📊 صافي الربح: *{profit}*

🏆 *أكثر المنتجات مبيعاً:*
{products_table}

⭐ *أفضل العملاء:*
{customers_table}

🏦 السيولة الحالية: *{liquidity}* (خزنة {treasury_balance} + بنك {bank_balance})
📌 مديونيات العملاء: *{debts}*
⚠️ أصناف تحت الحد الأدنى: *{low_stock_count}*`,

  telegram_yearly_digest: `📆 الملخص السنوي — {period_label}

💰 المبيعات: *{sales_total}*  {sales_delta}
🧾 عدد الفواتير: *{sales_count}*  (متوسط {avg_invoice})
📊 صافي الربح: *{profit}*

🏆 *أكثر المنتجات مبيعاً:*
{products_table}

⭐ *أفضل العملاء:*
{customers_table}

🏦 السيولة الحالية: *{liquidity}* (خزنة {treasury_balance} + بنك {bank_balance})
📌 مديونيات العملاء: *{debts}*
⚠️ أصناف تحت الحد الأدنى: *{low_stock_count}*`,
};

const SHORT_BODIES = {
  telegram_weekly_digest: `📊 الملخص الأسبوعي | {period_label}
💰 {sales_total} ({sales_delta}) | 🧾 {sales_count} | 📊 ربح {profit}`,
  telegram_monthly_digest: `🗓️ الملخص الشهري | {period_label}
💰 {sales_total} ({sales_delta}) | 🧾 {sales_count} | 📊 ربح {profit}`,
  telegram_yearly_digest: `📆 الملخص السنوي | {period_label}
💰 {sales_total} ({sales_delta}) | 🧾 {sales_count} | 📊 ربح {profit}`,
};

const LABELS = {
  telegram_weekly_digest: "ملخص أسبوعي",
  telegram_monthly_digest: "ملخص شهري",
  telegram_yearly_digest: "ملخص سنوي",
};

module.exports = {
  name: "193_telegram_digest_templates",
  up(db) {
    addColumnIfMissing(db, "message_templates", "label", "TEXT");
    addColumnIfMissing(db, "message_templates", "channel", "TEXT NOT NULL DEFAULT 'both'");

    const insertTemplate = db.prepare("INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')");
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?, ?, ?, 'telegram', ?, datetime('now'))
    `);
    const hasVariant = db.prepare("SELECT 1 FROM message_template_variants WHERE category=? AND label=?");

    for (const [category, body] of Object.entries(DIGEST_BODIES)) {
      insertTemplate.run(category, LABELS[category], body);

      if (!hasVariant.get(category, "قياسي — مفصل")) {
        insertVariant.run(category, "قياسي — مفصل", body, 1);
      }
      if (!hasVariant.get(category, "مختصر — سريع")) {
        insertVariant.run(category, "مختصر — سريع", SHORT_BODIES[category], 0);
      }
    }
  },
};
