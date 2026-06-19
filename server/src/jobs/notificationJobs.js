const cron = require("node-cron");
const { getDb } = require("../config/database");
const NotificationModel = require("../models/notification.model");
const logger = require("../config/logger");
const { today: cairoToday } = require("../utils/datetime");

// node-cron does NOT catch errors thrown inside a task callback. These jobs run
// synchronous better-sqlite3 queries that throw on a locked/corrupt DB, and an
// uncaught throw here would otherwise crash the embedded server (→ disconnect overlay).
// Wrap every scheduled callback so a failed tick is logged and swallowed.
function runSafely(name, fn) {
  try {
    fn();
  } catch (err) {
    logger.error({ message: `Scheduled job failed: ${name}`, error: err.message, stack: err.stack });
  }
}

function scanAndCreateNotifications() {
  const db = getDb();
  const lowStockItems = db
    .prepare(
      `SELECT name, min_stock_qty, COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.item_id = items.id), 0) AS quantity
       FROM items
       WHERE COALESCE(min_stock_qty, 0) > 0`,
    )
    .all()
    .filter((item) => Number(item.quantity) <= Number(item.min_stock_qty));

  if (lowStockItems.length === 0) return;

  // Roll up into a single notification so the every-30-min scan never spams the
  // user with one notification per item. Dedupe per day like scanOverdueDebts.
  const today = cairoToday();
  const alreadyNotified = db
    .prepare(
      `SELECT id FROM notifications
       WHERE title LIKE '%مخزون منخفض%' AND date(created_at) = date(?)`,
    )
    .get(today);
  if (alreadyNotified) return;

  const count = lowStockItems.length;
  const sample = lowStockItems.slice(0, 3).map((i) => i.name).join("، ");
  const more = count > 3 ? ` و${count - 3} أصناف أخرى` : "";
  NotificationModel.create({
    title: "⚠️ مخزون منخفض",
    body: `📦 ${count} ${count === 1 ? "صنف" : "أصناف"} تحت الحد الأدنى: ${sample}${more}`,
    type: "warning",
    link: "/stock",
  });
}

function startNotificationJobs() {
  return cron.schedule("*/30 * * * *", () => runSafely("notifications", scanAndCreateNotifications), { scheduled: true });
}

function cleanupAuditLogs() {
  const db = getDb();
  const settings = db.prepare("SELECT audit_log_retention_days FROM settings WHERE id = 1").get();
  const retentionDays = settings?.audit_log_retention_days || 30;
  const days = Number(retentionDays);
  if (!days || days < 1) return 0;
  const result = db
    .prepare("DELETE FROM audit_logs WHERE created_at < datetime('now', ? || ' days')")
    .run(`-${days}`);
  return result.changes;
}

function startAuditLogCleanupJob() {
  return cron.schedule("0 2 * * *", () => runSafely("auditLogCleanup", cleanupAuditLogs), { scheduled: true });
}

function scanOverdueDebts() {
  const db = getDb();
  const today = cairoToday();

  // Find overdue debts (due_date < today, status open, not voided)
  const overdueDebts = db.prepare(`
    SELECT ad.id, ad.invoice_id, ad.supplier_id, ad.customer_id,
           ad.original_amount, ad.paid_amount, ad.due_date, ad.party_type, ad.source_type,
           COALESCE(c.name, s.name) AS party_name
    FROM ajal_debts ad
    LEFT JOIN customers c ON c.id = ad.customer_id AND ad.party_type = 'customer'
    LEFT JOIN suppliers s ON s.id = ad.supplier_id AND ad.party_type = 'supplier'
    WHERE ad.status = 'open'
      AND ad.due_date IS NOT NULL
      AND date(ad.due_date) < date(?)
      AND NOT EXISTS (SELECT 1 FROM invoices i2 WHERE i2.id = ad.invoice_id AND i2.payment_type = 'installments')
  `).all(today);

  for (const debt of overdueDebts) {
    // Deduplicate: skip if a notification for this debt was already created today
    const alreadyNotified = db.prepare(`
      SELECT id FROM notifications
      WHERE title LIKE '%متأخر%'
        AND body LIKE ?
        AND date(created_at) = date(?)
    `).get(`%#${debt.id}%`, today);

    if (alreadyNotified) continue;

    const remaining = Math.max(0, Number(debt.original_amount) - Number(debt.paid_amount || 0));
    const remainingFormatted = remaining.toLocaleString('en-US');
    const partyName = debt.party_name || (debt.party_type === "supplier" ? `مورد #${debt.supplier_id}` : `عميل #${debt.customer_id}`);
    const dueDateFormatted = debt.due_date
      ? new Date(debt.due_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'غير محدد';

    NotificationModel.create({
      title: "⏰ دين متأخر السداد",
      body: `دين #${debt.id} (${partyName}) — متبقي ${remainingFormatted} ج — استحق في ${dueDateFormatted}`,
      type: "warning",
      link: `/ajal`,
    });
  }
}

// Per-installment alerting. Debt-level scanOverdueDebts skips debts that have a schedule
// (see NOT EXISTS above); those are covered here at the individual-installment granularity.
function scanInstallmentSchedules() {
  const db = getDb();
  const today = cairoToday();

  const rows = db.prepare(`
    SELECT sch.id, sch.debt_id, sch.installment_no, sch.due_date, sch.amount, sch.status,
           d.customer_id, c.name AS customer_name
    FROM ajal_schedules sch
    JOIN ajal_debts d ON d.id = sch.debt_id
    JOIN invoices inv ON inv.id = d.invoice_id AND inv.payment_type = 'installments'
    LEFT JOIN customers c ON c.id = d.customer_id
    WHERE sch.status != 'paid'
      AND COALESCE(d.party_type, 'customer') = 'customer'
      AND d.status NOT IN ('paid', 'voided')
      AND date(sch.due_date) <= date(?)
  `).all(today);

  for (const r of rows) {
    const overdue = r.due_date < today;
    // Dedupe per schedule per day (body carries #<schedule_id>)
    const tag = `قسط#${r.id}`;
    const already = db.prepare(`
      SELECT id FROM notifications WHERE body LIKE ? AND date(created_at) = date(?)
    `).get(`%${tag}%`, today);
    if (already) continue;

    const amount = Number(r.amount || 0).toLocaleString('en-US');
    const name = r.customer_name || `عميل #${r.customer_id}`;
    const dueFmt = new Date(r.due_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    NotificationModel.create({
      title: overdue ? "⏰ قسط متأخر" : "📅 قسط مستحق اليوم",
      body: overdue
        ? `${tag} — ${name} — قسط ${r.installment_no} بمبلغ ${amount} ج — استحق في ${dueFmt}`
        : `${tag} — ${name} — قسط ${r.installment_no} بمبلغ ${amount} ج — مستحق اليوم`,
      type: "warning",
      link: "/accounts/customers?filter=installments",
    });
  }
}

function startOverdueDebtsJob() {
  return cron.schedule("0 8 * * *", () => {
    runSafely("overdueDebts", scanOverdueDebts);
    runSafely("installmentSchedules", scanInstallmentSchedules);
  }, { scheduled: true });
}

function scanBirthdays() {
  const db = getDb();
  const today = cairoToday();
  const monthDay = today.slice(5); // MM-DD

  const customers = db.prepare(`
    SELECT id, name, phone FROM customers
    WHERE birthday IS NOT NULL
      AND strftime('%m-%d', birthday) = ?
      AND marketing_opt_in = 1
      AND (whatsapp_opt_out IS NULL OR whatsapp_opt_out = 0)
      AND phone IS NOT NULL AND phone != ''
  `).all(monthDay);

  if (customers.length === 0) return;

  const template = db.prepare("SELECT body FROM message_templates WHERE kind='birthday'").get();
  const body = template?.body || "كل عام وأنت بخير {name} 🎂";
  const shopName = (() => { try { return db.prepare("SELECT company_name FROM settings WHERE id=1").get()?.company_name || ""; } catch { return ""; } })();

  const ins = db.prepare("INSERT INTO wa_outbox (recipient_phone, customer_id, kind, payload) VALUES (?,?,?,?)");
  for (const c of customers) {
    const already = db.prepare(
      "SELECT id FROM wa_outbox WHERE customer_id=? AND kind='birthday' AND date(created_at)=date(?)"
    ).get(c.id, today);
    if (already) continue;

    const text = body.replace(/\{name\}/g, c.name || "").replace(/\{shop\}/g, shopName);
    ins.run(c.phone, c.id, "birthday", JSON.stringify({ text }));
  }
}

function startBirthdayJob() {
  return cron.schedule("0 9 * * *", () => runSafely("birthdays", scanBirthdays), { scheduled: true });
}

module.exports = {
  scanAndCreateNotifications,
  startNotificationJobs,
  cleanupAuditLogs,
  startAuditLogCleanupJob,
  scanOverdueDebts,
  scanInstallmentSchedules,
  startOverdueDebtsJob,
  scanBirthdays,
  startBirthdayJob,
};
