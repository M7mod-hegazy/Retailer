const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/", requirePagePermission("units", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const query = showArchived
    ? "SELECT * FROM units WHERE is_active = 0 ORDER BY name ASC"
    : "SELECT * FROM units WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("units", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb().prepare("INSERT INTO units (name, symbol, is_active) VALUES (?, ?, ?)").run(
    payload.name,
    payload.symbol || null,
    payload.is_active === false ? 0 : 1,
  );
  req.audit("create", "units", { id: info.lastInsertRowid }, `⚙️ تم إضافة وحدة: ${payload.name || ''}`);
  res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/:id", requirePagePermission("units", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE units SET name = ?, symbol = ?, is_active = ? WHERE id = ?")
    .run(payload.name, payload.symbol || null, payload.is_active === false ? 0 : 1, req.params.id);
  req.audit("update", "units", { id: req.params.id }, `⚙️ تم تعديل وحدة: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requirePagePermission("units", "delete"), (req, res) => {
  try {
    const db = getDb();
    
    // Check for related items
    const itemCount = db.prepare("SELECT COUNT(*) AS c FROM items WHERE unit_id = ?").get(req.params.id);
    
    if (Number(itemCount?.c || 0) > 0) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE units SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "units", { id: req.params.id }, `⚙️ تم أرشفة وحدة`);
      return res.json({ success: true, archived: true, message: "تم أرشفة الوحدة لأنها مرتبطة بأصناف" });
    }

    // Hard delete if no items
    db.prepare("DELETE FROM units WHERE id = ?").run(req.params.id);
    req.audit("delete", "units", { id: req.params.id }, `⚙️ تم حذف وحدة`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الوحدة لأنها مرتبطة ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

module.exports = router;
