const cron = require("node-cron");
const { getDb } = require("../config/database");
const NotificationModel = require("../models/notification.model");

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

  lowStockItems.slice(0, 5).forEach((item) => {
    NotificationModel.create({
      title: "تنبيه مخزون منخفض",
      body: `${item.name} وصل إلى ${item.quantity}`,
      type: "warning",
    });
  });
}

function startNotificationJobs() {
  return cron.schedule("*/30 * * * *", scanAndCreateNotifications, { scheduled: true });
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
  return cron.schedule("0 2 * * *", cleanupAuditLogs, { scheduled: true });
}

function scanOverdueDebts() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

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
    const partyName = debt.party_name || (debt.party_type === "supplier" ? `مورد #${debt.supplier_id}` : `عميل #${debt.customer_id}`);

    NotificationModel.create({
      title: "⏰ دين متأخر السداد",
      body: `دين #${debt.id} (${partyName}) — متبقي ${remaining} ج — استحق في ${debt.due_date}`,
      type: "warning",
      link: `/ajal`,
    });
  }
}

function startOverdueDebtsJob() {
  return cron.schedule("0 8 * * *", scanOverdueDebts, { scheduled: true });
}

module.exports = {
  scanAndCreateNotifications,
  startNotificationJobs,
  cleanupAuditLogs,
  startAuditLogCleanupJob,
  scanOverdueDebts,
  startOverdueDebtsJob,
};
