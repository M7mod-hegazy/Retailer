const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
router.use(authRequired);

router.get("/", requirePagePermission("analytics", "view"), (_req, res) => {
  const db = getDb();
  const todaySales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date(created_at)=date('now', 'localtime')").get().total;
  const weekSales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date(created_at) >= date('now', 'localtime', '-7 day')").get().total;
  const itemsCount = db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
  const customersCount = db.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
  const openShift = db.prepare("SELECT * FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1").get() || null;
  const today = require("../utils/datetime").today();
  const schedBase = `FROM ajal_schedules sch
    JOIN ajal_debts d ON d.id = sch.debt_id
    JOIN invoices inv ON inv.id = d.invoice_id AND inv.payment_type = 'installments'
    WHERE sch.status != 'paid' AND d.status NOT IN ('paid','voided') AND COALESCE(d.party_type,'customer') = 'customer'`;
  const overdueInstallments = db.prepare(`SELECT COUNT(*) AS c ${schedBase} AND date(sch.due_date) < date(?)`).get(today).c;
  const dueTodayInstallments = db.prepare(`SELECT COUNT(*) AS c ${schedBase} AND date(sch.due_date) = date(?)`).get(today).c;
  const upcomingInstallments = db.prepare(`SELECT COUNT(*) AS c ${schedBase} AND date(sch.due_date) >= date(?)`).get(today).c;
  res.json({ success: true, data: { todaySales, weekSales, itemsCount, customersCount, openShift, upcomingInstallments, overdueInstallments, dueTodayInstallments } });
});

module.exports = router;
