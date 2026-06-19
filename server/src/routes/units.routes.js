const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, hasAnyRelated, buildImpact } = require("../utils/relatedRecords");

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
  const info = getDb().prepare(
    "INSERT INTO units (name, symbol, is_active, allow_decimal) VALUES (?, ?, ?, ?)"
  ).run(
    payload.name,
    payload.symbol || null,
    payload.is_active === false ? 0 : 1,
    payload.allow_decimal === false || payload.allow_decimal === 0 ? 0 : 1,
  );
  req.audit("create", "units", { id: info.lastInsertRowid }, `⚙️ تم إضافة وحدة: ${payload.name || ''}`);
  res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/:id", requirePagePermission("units", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE units SET name = ?, symbol = ?, is_active = ?, allow_decimal = ? WHERE id = ?")
    .run(
      payload.name,
      payload.symbol || null,
      payload.is_active === false ? 0 : 1,
      payload.allow_decimal === false || payload.allow_decimal === 0 ? 0 : 1,
      req.params.id,
    );
  req.audit("update", "units", { id: req.params.id }, `⚙️ تم تعديل وحدة: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(req.params.id) });
});

// Linked records used by both the delete-impact preview and the delete decision.
function unitRelated(db, id) {
  return [
    { label: "أصناف", count: countSafe(db, "SELECT COUNT(*) AS c FROM items WHERE unit_id = ?", id) },
  ];
}

router.get("/:id/delete-impact", requirePagePermission("units", "delete"), (req, res) => {
  res.json({ success: true, data: buildImpact(unitRelated(getDb(), req.params.id)) });
});

router.delete("/:id", requirePagePermission("units", "delete"), (req, res) => {
  try {
    const db = getDb();

    if (hasAnyRelated(unitRelated(db, req.params.id))) {
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
