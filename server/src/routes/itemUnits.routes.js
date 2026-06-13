const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { featureGate } = require("../utils/features");

const router = express.Router({ mergeParams: true });
router.use(authRequired);
router.use(auditMutation);
router.use(featureGate("feature_multi_unit"));

// GET /api/items/:itemId/units
router.get("/", requirePagePermission("items", "view"), (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM item_units WHERE item_id = ? ORDER BY id").all(Number(req.params.itemId));
  res.json({ success: true, data: rows });
});

// POST /api/items/:itemId/units
router.post("/", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  const itemId = Number(req.params.itemId);
  const { unit_name, factor, sale_price, wholesale_price, barcode, is_default_sale } = req.body;

  if (!unit_name) return res.status(400).json({ error: "unit_name مطلوب" });
  const f = Number(factor);
  if (!Number.isInteger(f) || f < 1) return res.status(400).json({ error: "factor يجب أن يكون عدد صحيح >= 1" });

  if (barcode) {
    const dupItem = db.prepare("SELECT id FROM items WHERE barcode = ? AND id != ?").get(barcode, itemId);
    const dupUnit = db.prepare("SELECT id FROM item_units WHERE barcode = ?").get(barcode);
    if (dupItem || dupUnit) return res.status(400).json({ error: "الباركود مستخدم بالفعل" });
  }

  // Ensure the item exists
  const item = db.prepare("SELECT id, track_serials FROM items WHERE id = ?").get(itemId);
  if (!item) return res.status(404).json({ error: "الصنف غير موجود" });

  // Serial-tracked items cannot have multi-unit factor > 1
  const trackSerialsCol = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
  if (trackSerialsCol.includes("track_serials") && item.track_serials && f > 1) {
    return res.status(400).json({ error: "الأصناف المتتبعة بالسيريال لا يمكن بيعها بوحدات بعامل > 1" });
  }

  if (is_default_sale) {
    db.prepare("UPDATE item_units SET is_default_sale = 0 WHERE item_id = ?").run(itemId);
  }

  const r = db.prepare(
    "INSERT INTO item_units (item_id, unit_name, factor, sale_price, wholesale_price, barcode, is_default_sale) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(itemId, unit_name, f, sale_price ?? null, wholesale_price ?? null, barcode || null, is_default_sale ? 1 : 0);

  res.status(201).json({ success: true, data: { id: r.lastInsertRowid } });
});

// PUT /api/items/:itemId/units/:id
router.put("/:id", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  const itemId = Number(req.params.itemId);
  const unitId = Number(req.params.id);
  const { unit_name, factor, sale_price, wholesale_price, barcode, is_default_sale } = req.body;

  const existing = db.prepare("SELECT * FROM item_units WHERE id = ? AND item_id = ?").get(unitId, itemId);
  if (!existing) return res.status(404).json({ error: "الوحدة غير موجودة" });

  const f = Number(factor);
  if (!Number.isInteger(f) || f < 1) return res.status(400).json({ error: "factor يجب أن يكون عدد صحيح >= 1" });

  if (barcode) {
    const dupItem = db.prepare("SELECT id FROM items WHERE barcode = ? AND id != ?").get(barcode, itemId);
    const dupUnit = db.prepare("SELECT id FROM item_units WHERE barcode = ? AND id != ?").get(barcode, unitId);
    if (dupItem || dupUnit) return res.status(400).json({ error: "الباركود مستخدم بالفعل" });
  }

  if (is_default_sale) {
    db.prepare("UPDATE item_units SET is_default_sale = 0 WHERE item_id = ?").run(itemId);
  }

  db.prepare(
    "UPDATE item_units SET unit_name = ?, factor = ?, sale_price = ?, wholesale_price = ?, barcode = ?, is_default_sale = ? WHERE id = ?"
  ).run(unit_name ?? existing.unit_name, f, sale_price ?? null, wholesale_price ?? null, barcode || null, is_default_sale ? 1 : 0, unitId);

  res.json({ success: true });
});

// DELETE /api/items/:itemId/units/:id
router.delete("/:id", requirePagePermission("items", "delete"), (req, res) => {
  const db = getDb();
  const r = db.prepare("DELETE FROM item_units WHERE id = ? AND item_id = ?").run(Number(req.params.id), Number(req.params.itemId));
  if (!r.changes) return res.status(404).json({ error: "الوحدة غير موجودة" });
  res.json({ success: true });
});

module.exports = router;
