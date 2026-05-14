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
  const result = db
    .prepare(`DELETE FROM audit_logs WHERE created_at < datetime('now', '-' || ? || ' days')`)
    .run(retentionDays);
  return result.changes;
}

function startAuditLogCleanupJob() {
  return cron.schedule("0 2 * * *", cleanupAuditLogs, { scheduled: true });
}

module.exports = { scanAndCreateNotifications, startNotificationJobs, cleanupAuditLogs, startAuditLogCleanupJob };
