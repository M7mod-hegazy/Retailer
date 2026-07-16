const express = require("express");
const router = express.Router();
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

// ─── List all tags ───────────────────────────────────────────────────────────
router.get("/", authRequired, (_req, res) => {
  try {
    const db = getDb();
    const tags = db.prepare(`
      SELECT t.*, COUNT(ctm.customer_id) AS customer_count
      FROM customer_tags t
      LEFT JOIN customer_tag_map ctm ON ctm.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name
    `).all();
    res.json({ success: true, data: tags });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Create tag ──────────────────────────────────────────────────────────────
router.post("/", authRequired, requirePagePermission("customers", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "اسم التاق مطلوب" });
    const result = db.prepare(`INSERT INTO customer_tags (name, color) VALUES (?, ?)`).run(name.trim(), color || "#6366f1");
    res.json({ success: true, data: { id: result.lastInsertRowid, name: name.trim(), color: color || "#6366f1" } });
  } catch (e) {
    if (e.message?.includes("UNIQUE")) return res.status(409).json({ success: false, message: "التاق موجود مسبقاً" });
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Update tag ──────────────────────────────────────────────────────────────
router.put("/:id", authRequired, requirePagePermission("customers", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { name, color } = req.body;
    db.prepare(`UPDATE customer_tags SET name = ?, color = ? WHERE id = ?`).run(name?.trim(), color, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Delete tag ──────────────────────────────────────────────────────────────
router.delete("/:id", authRequired, requirePagePermission("customers", "edit"), (req, res) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM customer_tags WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Assign tags to customer ─────────────────────────────────────────────────
router.post("/assign", authRequired, requirePagePermission("customers", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { customer_id, tag_ids } = req.body;
    if (!customer_id || !Array.isArray(tag_ids)) return res.status(400).json({ success: false, message: "بيانات غير صحيحة" });
    db.prepare(`DELETE FROM customer_tag_map WHERE customer_id = ?`).run(customer_id);
    const ins = db.prepare(`INSERT OR IGNORE INTO customer_tag_map (customer_id, tag_id) VALUES (?, ?)`);
    for (const tid of tag_ids) ins.run(customer_id, tid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Get tags for a customer ─────────────────────────────────────────────────
router.get("/customer/:id", authRequired, (req, res) => {
  try {
    const db = getDb();
    const tags = db.prepare(`
      SELECT t.* FROM customer_tags t
      JOIN customer_tag_map ctm ON ctm.tag_id = t.id
      WHERE ctm.customer_id = ?
      ORDER BY t.name
    `).all(req.params.id);
    res.json({ success: true, data: tags });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Bulk assign tags ────────────────────────────────────────────────────────
router.post("/bulk-assign", authRequired, requirePagePermission("customers", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { customer_ids, tag_id, action } = req.body; // action: "add" | "remove"
    if (!Array.isArray(customer_ids) || !tag_id) return res.status(400).json({ success: false, message: "بيانات غير صحيحة" });
    if (action === "remove") {
      const del = db.prepare(`DELETE FROM customer_tag_map WHERE customer_id = ? AND tag_id = ?`);
      for (const cid of customer_ids) del.run(cid, tag_id);
    } else {
      const ins = db.prepare(`INSERT OR IGNORE INTO customer_tag_map (customer_id, tag_id) VALUES (?, ?)`);
      for (const cid of customer_ids) ins.run(cid, tag_id);
    }
    res.json({ success: true, affected: customer_ids.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
