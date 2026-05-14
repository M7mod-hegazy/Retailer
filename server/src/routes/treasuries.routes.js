const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/", requirePagePermission("daily_treasury", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const query = showArchived
    ? "SELECT * FROM treasuries WHERE is_active = 0 ORDER BY name ASC"
    : "SELECT * FROM treasuries WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("daily_treasury", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare("INSERT INTO treasuries (name, code, balance) VALUES (?, ?, ?)")
    .run(payload.name, payload.code || null, Number(payload.balance || 0));
  req.audit("create", "treasuries", { id: info.lastInsertRowid }, `💰 تم إضافة خزينة: ${payload.name || ''}`);
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM treasuries WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("daily_treasury", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE treasuries SET name = ?, code = ?, balance = ? WHERE id = ?")
    .run(payload.name, payload.code || null, Number(payload.balance || 0), req.params.id);
  req.audit("update", "treasuries", { id: req.params.id }, `💰 تم تعديل خزينة: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM treasuries WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requirePagePermission("daily_treasury", "delete"), (req, res) => {
  try {
    const db = getDb();
    
    // Check for related records
    const paymentCount = db.prepare("SELECT COUNT(*) AS c FROM payments WHERE treasury_id = ?").get(req.params.id);
    const paymentMethodCount = db.prepare("SELECT COUNT(*) AS c FROM payment_methods WHERE target_id = ? AND type = 'cash'").get(req.params.id);
    const shiftCount = db.prepare("SELECT COUNT(*) AS c FROM shifts WHERE treasury_id = ?").get(req.params.id);
    
    const hasRecords = 
      Number(paymentCount?.c || 0) > 0 ||
      Number(paymentMethodCount?.c || 0) > 0 ||
      Number(shiftCount?.c || 0) > 0;
    
    if (hasRecords) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE treasuries SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "treasuries", { id: req.params.id }, `💰 تم أرشفة خزينة`);
      return res.json({ success: true, archived: true, message: "تم أرشفة الخزينة لأنها مرتبطة بعمليات مالية" });
    }

    // Hard delete if no records
    db.prepare("DELETE FROM treasuries WHERE id = ?").run(req.params.id);
    req.audit("delete", "treasuries", { id: req.params.id }, `💰 تم حذف خزينة`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الخزينة لأنها مرتبطة ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

module.exports = router;
