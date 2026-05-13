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

module.exports = { scanAndCreateNotifications, startNotificationJobs };
