const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
router.use(authRequired);

router.get("/", requirePagePermission("analytics", "view"), (_req, res) => {
  const db = getDb();
  const todaySales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date(created_at)=date('now')").get().total;
  const weekSales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date(created_at) >= date('now', '-7 day')").get().total;
  const itemsCount = db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
  const customersCount = db.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
  const openShift = db.prepare("SELECT * FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1").get() || null;
  const upcomingInstallments = db
    .prepare("SELECT COUNT(*) AS c FROM installments WHERE remaining > 0 AND next_due_date IS NOT NULL")
    .get().c;
  res.json({ success: true, data: { todaySales, weekSales, itemsCount, customersCount, openShift, upcomingInstallments } });
});

module.exports = router;
