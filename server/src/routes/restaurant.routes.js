const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { featureGate } = require("../utils/features");

const router = express.Router();
router.use(authRequired);
router.use(featureGate("feature_restaurant"));
router.use(auditMutation);

// ─── Dining Tables ──────────────────────────────────────────────────────────

router.get("/tables", requirePagePermission("pos", "view"), (req, res) => {
  const rows = getDb().prepare("SELECT dt.*, c.name as customer_name FROM dining_tables dt LEFT JOIN invoices i ON i.id = dt.current_order_id LEFT JOIN customers c ON c.id = i.customer_id ORDER BY dt.sort_order ASC, dt.id ASC").all();
  res.json({ success: true, data: rows });
});

router.post("/tables", requirePagePermission("settings", "edit"), (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const id = db.prepare("INSERT INTO dining_tables (name, section, capacity, branch_id, sort_order) VALUES (?,?,?,?,?)").run(
    b.name, b.section || null, Number(b.capacity || 4), b.branch_id || null, Number(b.sort_order || 0),
  ).lastInsertRowid;
  res.status(201).json({ success: true, data: db.prepare("SELECT * FROM dining_tables WHERE id = ?").get(id) });
});

router.put("/tables/:id", requirePagePermission("settings", "edit"), (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const id = Number(req.params.id);
  db.prepare("UPDATE dining_tables SET name=?, section=?, capacity=?, sort_order=? WHERE id=?").run(
    b.name, b.section || null, Number(b.capacity || 4), Number(b.sort_order || 0), id,
  );
  res.json({ success: true, data: db.prepare("SELECT * FROM dining_tables WHERE id = ?").get(id) });
});

router.patch("/tables/:id/status", requirePagePermission("pos", "add"), (req, res) => {
  const db = getDb();
  const { status, order_id } = req.body || {};
  db.prepare("UPDATE dining_tables SET status=?, current_order_id=? WHERE id=?").run(
    status, order_id ?? null, Number(req.params.id),
  );
  res.json({ success: true });
});

router.delete("/tables/:id", requirePagePermission("settings", "edit"), (req, res) => {
  getDb().prepare("DELETE FROM dining_tables WHERE id=?").run(Number(req.params.id));
  res.json({ success: true });
});

// ─── Modifiers ───────────────────────────────────────────────────────────────

router.get("/modifiers", requirePagePermission("settings", "view"), (req, res) => {
  res.json({ success: true, data: getDb().prepare("SELECT * FROM modifiers WHERE is_active = 1 ORDER BY name").all() });
});

router.post("/modifiers", requirePagePermission("settings", "add"), (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const id = db.prepare("INSERT INTO modifiers (name, name_en, price_adjustment) VALUES (?,?,?)").run(b.name, b.name_en || null, Number(b.price_adjustment || 0)).lastInsertRowid;
  res.status(201).json({ success: true, data: db.prepare("SELECT * FROM modifiers WHERE id = ?").get(id) });
});

router.put("/modifiers/:id", requirePagePermission("settings", "edit"), (req, res) => {
  const b = req.body || {};
  getDb().prepare("UPDATE modifiers SET name=?, name_en=?, price_adjustment=?, is_active=? WHERE id=?").run(
    b.name, b.name_en || null, Number(b.price_adjustment || 0), b.is_active !== false ? 1 : 0, Number(req.params.id),
  );
  res.json({ success: true });
});

// ─── Modifier Groups ─────────────────────────────────────────────────────────

router.get("/modifier-groups", requirePagePermission("settings", "view"), (req, res) => {
  const db = getDb();
  const groups = db.prepare("SELECT * FROM modifier_groups ORDER BY sort_order, id").all();
  groups.forEach(g => {
    g.modifiers = db.prepare(`
      SELECT m.* FROM modifiers m
      JOIN modifier_group_items mgi ON mgi.modifier_id = m.id
      WHERE mgi.group_id = ? ORDER BY mgi.sort_order
    `).all(g.id);
  });
  res.json({ success: true, data: groups });
});

router.post("/modifier-groups", requirePagePermission("settings", "add"), (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const id = db.prepare("INSERT INTO modifier_groups (name, selection_type, required, sort_order) VALUES (?,?,?,?)").run(
    b.name, b.selection_type || "single", b.required ? 1 : 0, Number(b.sort_order || 0),
  ).lastInsertRowid;

  if (Array.isArray(b.modifier_ids)) {
    b.modifier_ids.forEach((mid, i) => {
      db.prepare("INSERT OR IGNORE INTO modifier_group_items (group_id, modifier_id, sort_order) VALUES (?,?,?)").run(id, mid, i);
    });
  }
  res.status(201).json({ success: true, data: { id } });
});

// ─── Item Recipes ─────────────────────────────────────────────────────────────

router.get("/recipes/:itemId", requirePagePermission("items", "view"), (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ir.*, i.name as ingredient_name, i.item_code
    FROM item_recipes ir JOIN items i ON i.id = ir.ingredient_item_id
    WHERE ir.menu_item_id = ?
  `).all(Number(req.params.itemId));
  res.json({ success: true, data: rows });
});

router.post("/recipes/:itemId", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const menuItemId = Number(req.params.itemId);
  if (!b.ingredient_item_id || !b.quantity) return res.status(400).json({ success: false, message: "ingredient_item_id and quantity required" });

  db.prepare("INSERT OR REPLACE INTO item_recipes (menu_item_id, ingredient_item_id, quantity, unit_name) VALUES (?,?,?,?)").run(
    menuItemId, Number(b.ingredient_item_id), Number(b.quantity), b.unit_name || null,
  );
  // Mark item as having a recipe
  db.prepare("UPDATE items SET has_recipe = 1 WHERE id = ?").run(menuItemId);
  res.status(201).json({ success: true });
});

router.delete("/recipes/:itemId/:ingredientId", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM item_recipes WHERE menu_item_id = ? AND ingredient_item_id = ?").run(Number(req.params.itemId), Number(req.params.ingredientId));
  // Clear has_recipe flag if no more ingredients
  const count = db.prepare("SELECT COUNT(*) as cnt FROM item_recipes WHERE menu_item_id = ?").get(Number(req.params.itemId)).cnt;
  if (count === 0) db.prepare("UPDATE items SET has_recipe = 0 WHERE id = ?").run(Number(req.params.itemId));
  res.json({ success: true });
});

module.exports = router;
