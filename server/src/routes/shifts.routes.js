const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { nowSql } = require("../utils/datetime");
const { requirePagePermission } = require("../middleware/permission");
const NotificationModel = require("../models/notification.model");
const { auditMutation } = require("../middleware/audit");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
router.use(authRequired);
router.use(auditMutation);

router.get("/current", requirePagePermission("pos", "view"), (_req, res) => {
  const current = getDb().prepare("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() || null;
  res.json({ success: true, data: current });
});

router.post("/open", requirePagePermission("pos", "add"), (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM shifts WHERE status = 'open'").get();
    if (existing) {
      const error = new Error("هناك وردية مفتوحة بالفعل");
      error.status = 400;
      throw error;
    }
    const info = db
      .prepare("INSERT INTO shifts (user_id, opening_cash, status) VALUES (?, ?, 'open')")
      .run(req.user.id, Number(req.body?.opening_cash || 0));
    const shiftOpenAuditId = req.audit("create", "shifts", { id: info.lastInsertRowid }, `📋 تم فتح وردية`);
    try {
      const username = req.user?.username || req.user?.name || 'غير محدد';
      NotificationModel.create({
        title: "📋 تم فتح وردية",
        body: `وردية جديدة بواسطة ${username}`,
        type: "info",
        link: shiftOpenAuditId ? `/history?log_id=${shiftOpenAuditId}` : `/shifts`,
      });
    } catch (_) {}
    res.status(201).json({ success: true, data: db.prepare("SELECT * FROM shifts WHERE id = ?").get(info.lastInsertRowid) });
  } catch (error) {
    next(error);
  }
});

router.post("/close", requirePagePermission("pos", "add"), (req, res, next) => {
  try {
    const db = getDb();
    const shiftId = req.body?.id || db.prepare("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get()?.id;
    if (!shiftId) {
      const error = new Error("لا توجد وردية مفتوحة");
      error.status = 404;
      throw error;
    }
    const closingCash = Number(req.body?.closing_cash || 0);
    db.prepare("UPDATE shifts SET status='closed', closed_at=?, closing_cash=? WHERE id=?").run(
      nowSql(),
      closingCash,
      shiftId,
    );
    const closedShift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(shiftId);
    // Detect cash discrepancy
    try {
      const openingCash = Number(closedShift.opening_cash || 0);
      const cashSales = db.prepare("SELECT COALESCE(SUM(total), 0) AS val FROM invoices WHERE shift_id = ? AND payment_type IN ('cash', 'multi')").get(shiftId)?.val || 0;
      const payIns = db.prepare("SELECT COALESCE(SUM(amount), 0) AS val FROM shift_transactions WHERE shift_id = ? AND transaction_type = 'pay_in'").get(shiftId)?.val || 0;
      const payOuts = db.prepare("SELECT COALESCE(SUM(amount), 0) AS val FROM shift_transactions WHERE shift_id = ? AND transaction_type = 'pay_out'").get(shiftId)?.val || 0;
      const expectedCash = openingCash + cashSales + payIns - payOuts;
      const diff = Math.round((closingCash - expectedCash) * 100) / 100;
      const invoicesCount = db.prepare("SELECT COUNT(*) AS val FROM invoices WHERE shift_id = ?").get(shiftId)?.val || 0;
      if (diff !== 0) {
        NotificationModel.create({
          title: "🔁 فرق في إغلاق الوردية",
          body: `فرق نقدي: ${diff} ج`,
          type: "warning",
          link: `/shifts`,
        });
      }
      notifyOwner(TG.SHIFT_CLOSE, {
        shiftId,
        openingCash,
        closingCash,
        expectedCash,
        discrepancy: diff,
        invoicesCount,
      });
    } catch (_) {}
    req.audit("update", "shifts", { id: shiftId }, `📋 تم إغلاق وردية`);
    res.json({ success: true, data: closedShift });
  } catch (error) {
    next(error);
  }
});

router.post("/pay-in", requirePagePermission("pos", "add"), (req, res, next) => {
  try {
    const db = getDb();
    const shift = db.prepare("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    if (!shift) {
      const error = new Error("لا توجد وردية مفتوحة");
      error.status = 404;
      throw error;
    }
    
    const amount = Number(req.body?.amount || 0);
    if (amount <= 0 || !req.body?.reason) {
      const error = new Error("المبلغ والسبب مطلوبان");
      error.status = 400;
      throw error;
    }

    const info = db.prepare("INSERT INTO shift_transactions (shift_id, transaction_type, amount, reason, user_id) VALUES (?, 'pay_in', ?, ?, ?)").run(
      shift.id,
      amount,
      req.body.reason,
      req.user?.id || 1
    );

    res.json({ success: true, data: db.prepare("SELECT * FROM shift_transactions WHERE id = ?").get(info.lastInsertRowid) });
  } catch (error) {
    next(error);
  }
});

router.post("/pay-out", requirePagePermission("pos", "add"), (req, res, next) => {
  try {
    const db = getDb();
    const shift = db.prepare("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    if (!shift) {
      const error = new Error("لا توجد وردية مفتوحة");
      error.status = 404;
      throw error;
    }
    
    const amount = Number(req.body?.amount || 0);
    if (amount <= 0 || !req.body?.reason) {
      const error = new Error("المبلغ والسبب مطلوبان");
      error.status = 400;
      throw error;
    }

    const info = db.prepare("INSERT INTO shift_transactions (shift_id, transaction_type, amount, reason, user_id) VALUES (?, 'pay_out', ?, ?, ?)").run(
      shift.id,
      amount,
      req.body.reason,
      req.user?.id || 1
    );

    res.json({ success: true, data: db.prepare("SELECT * FROM shift_transactions WHERE id = ?").get(info.lastInsertRowid) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/report", requirePagePermission("pos", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(req.params.id);
    if (!shift) {
      const err = new Error("وردية غير موجودة");
      err.status = 404;
      throw err;
    }

    // Get total cash sales
    const salesCashQuery = db.prepare(`
      SELECT SUM(total) as val FROM invoices 
      WHERE shift_id = ? AND payment_type IN ('cash', 'multi')
    `).get(shift.id);
    
    // Get total credit sales
    const salesCreditQuery = db.prepare(`
      SELECT SUM(total) as val FROM invoices 
      WHERE shift_id = ? AND payment_type = 'credit'
    `).get(shift.id);

    // Get pay-ins
    const payInQuery = db.prepare("SELECT SUM(amount) as val FROM shift_transactions WHERE shift_id = ? AND transaction_type = 'pay_in'").get(shift.id);

    // Get pay-outs
    const payOutQuery = db.prepare("SELECT SUM(amount) as val FROM shift_transactions WHERE shift_id = ? AND transaction_type = 'pay_out'").get(shift.id);

    // Get total invoices count
    const invoicesCount = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE shift_id = ?").get(shift.id);
    
    const opening_cash = shift.opening_cash || 0;
    const cash_sales = salesCashQuery?.val || 0;
    const credit_sales = salesCreditQuery?.val || 0;
    const pay_ins = payInQuery?.val || 0;
    const pay_outs = payOutQuery?.val || 0;
    
    // Expected cash in drawer
    const expected_cash = opening_cash + cash_sales + pay_ins - pay_outs;
    
    // declared
    const declared_cash = shift.closing_cash || 0;
    const discrepancy = shift.status === 'closed' ? (declared_cash - expected_cash) : null;

    res.json({
      success: true,
      data: {
        ...shift,
        metrics: {
          cash_sales,
          credit_sales,
          pay_ins,
          pay_outs,
          expected_cash,
          declared_cash,
          discrepancy,
          invoicesCount: invoicesCount.c,
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
