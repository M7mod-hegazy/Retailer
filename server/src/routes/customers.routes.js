const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

router.get("/", requirePagePermission("customers", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const query = showArchived
    ? "SELECT * FROM customers WHERE is_active = 0 ORDER BY id DESC"
    : "SELECT * FROM customers WHERE is_active = 1 OR is_active IS NULL ORDER BY id DESC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("customers", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare(
      `INSERT INTO customers
       (name, phone, additional_phones, addresses, notes, code, opening_balance, credit_limit, is_blacklisted, blacklist_reason, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.additional_phones || null,
      payload.addresses || null,
      payload.notes || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      Number(payload.credit_limit || 0),
      payload.is_blacklisted ? 1 : 0,
      payload.blacklist_reason || null,
      payload.is_active === false ? 0 : 1,
    );
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM customers WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("customers", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare(
      `UPDATE customers
       SET name = ?, phone = ?, additional_phones = ?, addresses = ?, notes = ?, code = ?, opening_balance = ?, credit_limit = ?, is_blacklisted = ?, blacklist_reason = ?, is_active = ?
       WHERE id = ?`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.additional_phones || null,
      payload.addresses || null,
      payload.notes || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      Number(payload.credit_limit || 0),
      payload.is_blacklisted ? 1 : 0,
      payload.blacklist_reason || null,
      payload.is_active === false ? 0 : 1,
      req.params.id,
    );
  res.json({ success: true, data: getDb().prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requirePagePermission("customers", "delete"), (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare("SELECT walk_in_customer_id FROM settings WHERE id = 1").get();
    if (settings?.walk_in_customer_id && String(settings.walk_in_customer_id) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "لا يمكن حذف العميل الافتراضي للمبيعات النقدية" });
    }
    
    // Check for related records
    const invoiceCount = db.prepare("SELECT COUNT(*) AS c FROM invoices WHERE customer_id = ?").get(req.params.id);
    const quotationCount = db.prepare("SELECT COUNT(*) AS c FROM quotations WHERE customer_id = ?").get(req.params.id);
    const paymentCount = db.prepare("SELECT COUNT(*) AS c FROM payments WHERE customer_id = ?").get(req.params.id);
    const salesReturnCount = db.prepare("SELECT COUNT(*) AS c FROM sales_returns WHERE customer_id = ?").get(req.params.id);
    
    const hasTransactions = 
      Number(invoiceCount?.c || 0) > 0 ||
      Number(quotationCount?.c || 0) > 0 ||
      Number(paymentCount?.c || 0) > 0 ||
      Number(salesReturnCount?.c || 0) > 0;
    
    if (hasTransactions) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE customers SET is_active = 0 WHERE id = ?").run(req.params.id);
      return res.json({ success: true, archived: true, message: "تم أرشفة العميل لأنه مرتبط بفواتير أو مدفوعات" });
    }
    
    // Hard delete if no transactions
    db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) {
      return res.status(409).json({ success: false, message: "لا يمكن حذف العميل لأنه مرتبط ببيانات أخرى" });
    }
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

router.get("/:id/loyalty", requirePagePermission("customers", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const customer = db.prepare("SELECT loyalty_points, loyalty_tier, total_spent FROM customers WHERE id = ?").get(req.params.id);
    if (!customer) {
      const err = new Error("العميل غير موجود");
      err.status = 404;
      throw err;
    }
    const history = db.prepare("SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 50").all(req.params.id);
    res.json({ success: true, data: { ...customer, history } });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requirePagePermission("customers", "view"), (req, res) => {
  const customer = getDb().prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: "العميل غير موجود" });
  res.json({ success: true, data: customer });
});

router.post("/:id/adjust", requirePagePermission("customers", "add"), (req, res) => {
  const { amount, reason, direction } = req.body || {};
  const delta = direction === 'subtract' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
  try {
    getDb().transaction(() => {
      getDb().prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(delta, req.params.id);
      getDb().prepare("INSERT INTO customer_notes (customer_id, note, created_by) VALUES (?, ?, ?)")
        .run(req.params.id, `تسوية رصيد بقيمة ${delta > 0 ? '+' : ''}${delta}: ${reason || 'بدون سبب'}`, req.user?.id || null);
    })();
    res.json({ success: true, data: getDb().prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id) });
  } catch (e) {
    res.status(500).json({ success: false, message: "خطأ أثناء التسوية" });
  }
});

router.get("/:id/notes", requirePagePermission("customers", "view"), (req, res) => {
  const notes = getDb().prepare("SELECT n.*, u.name as user_name FROM customer_notes n LEFT JOIN users u ON u.id = n.created_by WHERE customer_id = ? ORDER BY n.created_at DESC").all(req.params.id);
  res.json({ success: true, data: notes });
});

router.post("/:id/notes", requirePagePermission("customers", "add"), (req, res) => {
  const { note } = req.body || {};
  if (!note) return res.status(400).json({ success: false, message: "الملاحظة مطلوبة" });
  const result = getDb().prepare("INSERT INTO customer_notes (customer_id, note, created_by) VALUES (?, ?, ?)")
    .run(req.params.id, note, req.user?.id || null);
  const newNote = getDb().prepare("SELECT n.*, u.name as user_name FROM customer_notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: newNote });
});

module.exports = router;
