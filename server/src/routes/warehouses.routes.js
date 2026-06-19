const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, hasAnyRelated, buildImpact } = require("../utils/relatedRecords");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/", requirePagePermission("warehouses", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const query = showArchived
    ? "SELECT * FROM warehouses WHERE is_active = 0 ORDER BY name ASC"
    : "SELECT * FROM warehouses WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("warehouses", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare("INSERT INTO warehouses (name, code, is_default) VALUES (?, ?, ?)")
    .run(payload.name, payload.code || null, payload.is_default ? 1 : 0);

  if (payload.is_default) {
    getDb().prepare("UPDATE warehouses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END").run(info.lastInsertRowid);
  }

  req.audit("create", "warehouses", { id: info.lastInsertRowid }, `📦 تم إضافة مستودع: ${payload.name || ''}`);
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM warehouses WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("warehouses", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE warehouses SET name = ?, code = ?, is_default = ? WHERE id = ?")
    .run(payload.name, payload.code || null, payload.is_default ? 1 : 0, req.params.id);
  if (payload.is_default) {
    getDb().prepare("UPDATE warehouses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END").run(req.params.id);
  }
  req.audit("update", "warehouses", { id: req.params.id }, `📦 تم تعديل مستودع: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM warehouses WHERE id = ?").get(req.params.id) });
});

// Linked records used by both the delete-impact preview and the delete decision.
function warehouseRelated(db, id) {
  return [
    { label: "أرصدة مخزون", count: countSafe(db, "SELECT COUNT(*) AS c FROM stock_levels WHERE warehouse_id = ? AND quantity != 0", id) },
    { label: "حركات مخزنية", count: countSafe(db, "SELECT COUNT(*) AS c FROM stock_movements WHERE warehouse_id = ?", id) },
  ];
}

router.get("/:id/delete-impact", requirePagePermission("warehouses", "delete"), (req, res) => {
  res.json({ success: true, data: buildImpact(warehouseRelated(getDb(), req.params.id)) });
});

router.delete("/:id", requirePagePermission("warehouses", "delete"), (req, res) => {
  try {
    const db = getDb();

    if (hasAnyRelated(warehouseRelated(db, req.params.id))) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE warehouses SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "warehouses", { id: req.params.id }, `📦 تم أرشفة مستودع`);
      return res.json({ success: true, archived: true, message: "تم أرشفة المستودع لأنه مرتبط بحركات مخزنية" });
    }

    // Hard delete if no records
    db.prepare("DELETE FROM warehouses WHERE id = ?").run(req.params.id);
    req.audit("delete", "warehouses", { id: req.params.id }, `📦 تم حذف مستودع`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف المستودع لأنه مرتبط ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

module.exports = router;
