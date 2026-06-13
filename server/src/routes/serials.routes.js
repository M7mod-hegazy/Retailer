const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { featureGate } = require("../utils/features");

const router = express.Router();
router.use(authRequired);
router.use(auditMutation);
router.use(featureGate("feature_serials"));

// Search a serial number globally
router.get("/search", requirePagePermission("items", "view"), (req, res) => {
  const db = getDb();
  const serial = String(req.query.q || "").trim();
  if (!serial) return res.status(400).json({ error: "q مطلوب" });
  const row = db.prepare(`
    SELECT s.*, i.name AS item_name, i.barcode AS item_barcode
    FROM item_serials s
    JOIN items i ON i.id = s.item_id
    WHERE s.serial = ?
  `).get(serial);
  if (!row) return res.status(404).json({ error: "السيريال غير موجود" });
  const warrantyDate = row.warranty_months && row.sold_at
    ? new Date(new Date(row.sold_at).getTime() + row.warranty_months * 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    : null;
  res.json({ success: true, data: { ...row, warranty_expires: warrantyDate } });
});

// List serials for an item
router.get("/items/:itemId", requirePagePermission("items", "view"), (req, res) => {
  const db = getDb();
  const { status } = req.query;
  let query = "SELECT * FROM item_serials WHERE item_id = ?";
  const params = [Number(req.params.itemId)];
  if (status) { query += " AND status = ?"; params.push(status); }
  query += " ORDER BY id DESC LIMIT 500";
  res.json({ success: true, data: db.prepare(query).all(...params) });
});

// Mark a serial as defective
router.patch("/:id/defective", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  const r = db.prepare("UPDATE item_serials SET status = 'defective', notes = ? WHERE id = ?").run(req.body.notes || null, Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: "السيريال غير موجود" });
  res.json({ success: true });
});

module.exports = router;
