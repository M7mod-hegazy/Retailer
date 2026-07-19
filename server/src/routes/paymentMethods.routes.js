const express = require("express");
const { requirePagePermission } = require("../middleware/permission");
const router = express.Router();
const { getDb } = require("../config/database");
const { authRequired } = require('../middleware/auth');
const { paymentFlowPayload } = require("../services/paymentFlowService");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");
router.use(authRequired);

// Payment methods decide where money lands and whether it counts toward the
// treasury, so changing them re-routes cash without touching any transaction.
function notifyPaymentMethod(req, db, actionLabel, methodName, details) {
  try {
    notifyOwner(TG.PAYMENT_METHOD_CHANGED, {
      actionLabel,
      methodName: methodName || "غير محدد",
      details: details || "—",
      userName: req.user?.full_name || req.user?.username,
      createdAt: new Date().toISOString(),
    }, db);
  } catch (_) { /* non-critical */ }
}

let _cashSeeded = false;
function ensureCashMethod() {
  if (_cashSeeded) return;
  _cashSeeded = true;
  try {
    const db = getDb();
    const cash = db.prepare("SELECT id FROM payment_methods WHERE id = 1").get();
    if (!cash) {
      db.prepare("INSERT OR IGNORE INTO payment_methods (id, name, is_system, category, icon, type) VALUES (1, 'نقدي', 1, 'cash', '💵', 'cash')").run();
    }
  } catch (_) {}
}

router.get("/", requirePagePermission("payment_methods", "view"), (_req, res) => {
  try {
    const db = getDb();
    ensureCashMethod();
    let rows = db.prepare("SELECT * FROM payment_methods ORDER BY id ASC").all();
    const monthStart = new Date();
    monthStart.setDate(1);
    const from = require("../utils/datetime").today(monthStart);
    const stats = {};

    try {
      db.prepare(`
        SELECT payment_method_id, COUNT(*) AS monthly_count, COALESCE(SUM(amount), 0) AS monthly_total
        FROM ajal_payments
        WHERE payment_method_id IS NOT NULL AND date(payment_date) >= ?
        GROUP BY payment_method_id
      `).all(from).forEach((row) => {
        stats[row.payment_method_id] = {
          monthly_count: Number(row.monthly_count || 0),
          monthly_total: Number(row.monthly_total || 0),
        };
      });
    } catch (_) {}

    try {
      db.prepare(`
        SELECT pm.id AS payment_method_id, COUNT(p.id) AS monthly_count, COALESCE(SUM(p.amount), 0) AS monthly_total
        FROM payments p
        JOIN payment_methods pm ON pm.type = p.method OR pm.category = p.method OR pm.name = p.method
        WHERE date(p.created_at) >= ?
        GROUP BY pm.id
      `).all(from).forEach((row) => {
        const current = stats[row.payment_method_id] || { monthly_count: 0, monthly_total: 0 };
        stats[row.payment_method_id] = {
          monthly_count: current.monthly_count + Number(row.monthly_count || 0),
          monthly_total: current.monthly_total + Number(row.monthly_total || 0),
        };
      });
    } catch (_) {}

    rows = rows.map((method) => ({
      ...method,
      monthly_count: stats[method.id]?.monthly_count || 0,
      monthly_total: stats[method.id]?.monthly_total || 0,
    }));
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/transactions", requirePagePermission("payment_methods", "view"), (req, res) => {
  try {
    const { from, to, method_id, type, search, doc_type, party_type, amount_min, amount_max, page = 1, pageSize = 500 } = req.query;
    const payload = paymentFlowPayload(from, to, {
      method_id,
      direction: type,
      search,
      doc_type,
      party_type,
      amount_min,
      amount_max,
    });
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(2000, Math.max(1, parseInt(pageSize, 10) || 500));
    const start = (p - 1) * ps;
    const visibleRows = payload.rows.slice(start, start + ps);
    res.json({
      success: true,
      data: visibleRows,
      rows: visibleRows,
      total: payload.rows.length,
      page: p,
      pageSize: ps,
      totals: payload.totals,
      by_method: payload.by_method,
      by_doc_type: payload.by_doc_type,
      by_direction: payload.by_direction,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
router.post("/", requirePagePermission("payment_methods", "add"), (req, res) => {
  try {
    const db = getDb();
    const { name, category = "digital_wallet", icon = "💳", description = "", excludes_from_treasury = 1 } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: "الاسم مطلوب" });
    const result = db.prepare(
      "INSERT INTO payment_methods (name, category, icon, description, is_system, excludes_from_treasury, type) VALUES (?, ?, ?, ?, 0, ?, ?)"
    ).run(name, category, icon, description, excludes_from_treasury ? 1 : 0, category);
    const created = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(result.lastInsertRowid);
    notifyPaymentMethod(req, db, "إضافة وسيلة دفع", created?.name || name,
      excludes_from_treasury
        ? "⚠️ لا تدخل الخزينة (تُسجَّل فقط)"
        : "تدخل الخزينة");
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/:id", requirePagePermission("payment_methods", "edit"), (req, res) => {
  try {
    const db = getDb();
    const method = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(req.params.id);
    if (!method) return res.status(404).json({ success: false, message: "وسيلة الدفع غير موجودة" });
    const { name, category, icon, description, excludes_from_treasury } = req.body || {};
    db.prepare(
      "UPDATE payment_methods SET name = COALESCE(?, name), category = COALESCE(?, category), icon = COALESCE(?, icon), description = COALESCE(?, description), excludes_from_treasury = COALESCE(?, excludes_from_treasury) WHERE id = ?"
    ).run(method.is_system ? undefined : name, category, icon, description, excludes_from_treasury != null ? (excludes_from_treasury ? 1 : 0) : undefined, req.params.id);
    const updated = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(req.params.id);

    // Flipping excludes_from_treasury decides whether money taken on this
    // method ever shows up in the drawer reconciliation — call it out.
    const details = [];
    if (updated?.name !== method.name) details.push(`الاسم: "${method.name}" ← "${updated?.name}"`);
    if ((updated?.excludes_from_treasury ? 1 : 0) !== (method.excludes_from_treasury ? 1 : 0)) {
      details.push(updated?.excludes_from_treasury
        ? "⚠️ أصبحت لا تدخل الخزينة"
        : "أصبحت تدخل الخزينة");
    }
    if (updated?.category !== method.category) details.push(`التصنيف: ${method.category} ← ${updated?.category}`);
    if (details.length) {
      notifyPaymentMethod(req, db, "تعديل وسيلة دفع", updated?.name || method.name, details.join(" | "));
    }
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", requirePagePermission("payment_methods", "delete"), (req, res) => {
  try {
    const db = getDb();
    const method = db.prepare("SELECT is_system, name FROM payment_methods WHERE id = ?").get(req.params.id);
    if (!method) return res.status(404).json({ success: false, message: "وسيلة الدفع غير موجودة" });
    if (method.is_system) return res.status(403).json({ success: false, message: `لا يمكن حذف "${method.name}" — وسيلة دفع محمية من النظام` });
    db.prepare("DELETE FROM payment_methods WHERE id = ?").run(req.params.id);
    notifyPaymentMethod(req, db, "حذف وسيلة دفع", method.name, "حذف نهائي");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
