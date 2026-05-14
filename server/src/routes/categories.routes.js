const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/", requirePagePermission("categories", "view"), (req, res) => {
  const showArchived = req.query.archived === "true";
  const query = showArchived
    ? "SELECT * FROM item_categories WHERE is_active = 0 ORDER BY CAST(COALESCE(sku_prefix, '0') AS INTEGER) ASC, id ASC"
    : "SELECT * FROM item_categories WHERE is_active = 1 OR is_active IS NULL ORDER BY CAST(COALESCE(sku_prefix, '0') AS INTEGER) ASC, id ASC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("categories", "add"), (req, res) => {
  const payload = req.body || {};
  const requestedPrefix = String(payload.sku_prefix || "").trim();
  const nextPrefix = requestedPrefix || String(((getDb()
    .prepare("SELECT MAX(CAST(sku_prefix AS INTEGER)) AS m FROM item_categories WHERE sku_prefix GLOB '[0-9]*'")
    .get())?.m || 0) + 1);

  if (requestedPrefix) {
    const existingPrefix = getDb().prepare("SELECT * FROM item_categories WHERE sku_prefix = ?").get(requestedPrefix);
    if (existingPrefix) {
      if (Number(existingPrefix.is_active) === 0) {
        getDb()
          .prepare("UPDATE item_categories SET name = ?, image_url = ?, is_active = 1 WHERE id = ?")
          .run(payload.name || existingPrefix.name, payload.image_url !== undefined ? payload.image_url : existingPrefix.image_url, existingPrefix.id);
        req.audit("create", "categories", { id: existingPrefix.id }, `📦 تم استعادة فئة: ${payload.name || existingPrefix.name || ''}`);
        return res.json({
          success: true,
          restored: true,
          data: getDb().prepare("SELECT * FROM item_categories WHERE id = ?").get(existingPrefix.id),
        });
      }
      return res.status(409).json({ success: false, message: "كود الفئة مستخدم بالفعل.", data: existingPrefix });
    }
  }

  const info = getDb()
    .prepare("INSERT INTO item_categories (name, parent_id, sku_prefix, image_url) VALUES (?, ?, ?, ?)")
    .run(payload.name, payload.parent_id || null, nextPrefix, payload.image_url || null);

  req.audit("create", "categories", { id: info.lastInsertRowid }, `📦 تم إضافة فئة: ${payload.name || ''}`);
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM item_categories WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("categories", "edit"), (req, res) => {
  const payload = req.body || {};
  const existing = getDb().prepare("SELECT * FROM item_categories WHERE id = ?").get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "الفئة غير موجودة." });
  }
  getDb()
    .prepare("UPDATE item_categories SET name = ?, image_url = ? WHERE id = ?")
    .run(payload.name ?? existing.name, payload.image_url !== undefined ? payload.image_url : existing.image_url, req.params.id);
  req.audit("update", "categories", { id: req.params.id }, `📦 تم تعديل فئة: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM item_categories WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requirePagePermission("categories", "delete"), (req, res) => {
  const db = getDb();
  const countRow = db.prepare("SELECT COUNT(*) AS c FROM items WHERE category_id = ?").get(req.params.id);

  if (Number(countRow?.c || 0) > 0) {
    return res.status(400).json({
      success: false,
      blocked: true,
      items_count: Number(countRow.c || 0),
      message: "لا يمكن حذف الفئة قبل نقل أو حذف كل الأصناف المرتبطة بها.",
    });
  }

  db.prepare("DELETE FROM item_categories WHERE id = ?").run(req.params.id);
  req.audit("delete", "categories", { id: req.params.id }, `📦 تم حذف فئة`);
  res.json({ success: true });
});

module.exports = router;
