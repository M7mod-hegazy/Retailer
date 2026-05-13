const express = require('express');
const { getDb } = require('../config/database');
const { authRequired, requireRole } = require('../middleware/auth');
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

router.use(authRequired);

function ensureLoyaltySchema(db) {
  const customerColumns = db.prepare("PRAGMA table_info(customers)").all().map((column) => column.name);
  if (!customerColumns.includes("loyalty_points")) {
    db.exec("ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0");
  }

  const transactionColumns = db.prepare("PRAGMA table_info(loyalty_transactions)").all().map((column) => column.name);
  if (!transactionColumns.includes("source")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN source TEXT DEFAULT 'manual'");
  if (!transactionColumns.includes("transaction_type")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN transaction_type TEXT");
  if (!transactionColumns.includes("balance_after")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN balance_after INTEGER DEFAULT 0");
  if (!transactionColumns.includes("note")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN note TEXT");
  if (!transactionColumns.includes("user_id")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN user_id INTEGER");
  if (!transactionColumns.includes("invoice_id")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN invoice_id INTEGER");
}

router.post("/redeem", requirePagePermission("customers", "add"), (req, res, next) => {
  try {
    const db = getDb();
    ensureLoyaltySchema(db);
    const { customer_id, points, invoice_id, note } = req.body;
    
    db.transaction(() => {
      const customer = db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customer_id);
      if (!customer || customer.loyalty_points < points) {
        throw new Error("رصيد النقاط غير كافٍ");
      }
      
      const newBalance = customer.loyalty_points - points;
      db.prepare("UPDATE customers SET loyalty_points = ? WHERE id = ?").run(newBalance, customer_id);
      
      db.prepare("INSERT INTO loyalty_transactions (customer_id, invoice_id, transaction_type, points, balance_after, note, user_id, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        customer_id,
        invoice_id || null,
        'redeem',
        -points,
        newBalance,
        note || 'Redemption',
        req.user?.id || 1,
        'redeem'
      );
    })();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/adjust", requirePagePermission("customers", "add"), requireRole('admin'), (req, res, next) => {
  try {
    const db = getDb();
    ensureLoyaltySchema(db);
    const { customer_id, points, type, note } = req.body; // type can be earn, expire, adjustment
    
    // Determine the actual integer value to add (points could be positive or negative depending on type/input)
    let delta = Number(points);
    if (!['earn', 'redeem', 'adjustment', 'expire'].includes(type)) {
       throw new Error("Invalid transaction type");
    }
    
    db.transaction(() => {
      const customer = db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customer_id);
      if (!customer) throw new Error("العميل غير موجود");
      
      const newBalance = Math.max(0, customer.loyalty_points + delta);
      db.prepare("UPDATE customers SET loyalty_points = ? WHERE id = ?").run(newBalance, customer_id);
      
      db.prepare("INSERT INTO loyalty_transactions (customer_id, transaction_type, points, balance_after, note, user_id, source) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        customer_id,
        type,
        delta,
        newBalance,
        note || 'Admin adjustment',
        req.user?.id || 1,
        type
      );
    })();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get("/report", requirePagePermission("customers", "view"), requireRole('admin'), (req, res, next) => {
  try {
    const db = getDb();
    ensureLoyaltySchema(db);
    const totalCirculating = db.prepare("SELECT SUM(loyalty_points) as val FROM customers").get().val || 0;
    const totalRedeemed = db.prepare("SELECT SUM(points) as val FROM loyalty_transactions WHERE transaction_type = 'redeem'").get().val || 0;
    const totalEarned = db.prepare("SELECT SUM(points) as val FROM loyalty_transactions WHERE transaction_type IN ('earn', 'adjustment') AND points > 0").get().val || 0;

    res.json({
      success: true,
      data: {
        totalCirculating,
        totalRedeemed: Math.abs(totalRedeemed),
        totalEarned
      }
    });
  } catch(e) {
    next(e);
  }
});

module.exports = router;
