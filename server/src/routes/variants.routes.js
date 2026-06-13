const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { featureGate } = require("../utils/features");

const router = express.Router();
router.use(authRequired);
router.use(auditMutation);
router.use(featureGate("feature_variants"));

// ── Attribute dictionaries ────────────────────────────────────────────────────

router.get("/attributes", requirePagePermission("items", "view"), (req, res) => {
  const db = getDb();
  const attrs = db.prepare("SELECT * FROM variant_attributes ORDER BY name").all();
  const values = db.prepare("SELECT * FROM variant_attribute_values ORDER BY attribute_id, sort_order, value").all();
  res.json({ success: true, data: attrs.map(a => ({ ...a, values: values.filter(v => v.attribute_id === a.id) })) });
});

router.post("/attributes", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name مطلوب" });
  try {
    const r = db.prepare("INSERT INTO variant_attributes (name) VALUES (?)").run(name.trim());
    res.status(201).json({ success: true, data: { id: r.lastInsertRowid } });
  } catch {
    res.status(400).json({ error: "الاسم مستخدم بالفعل" });
  }
});

router.post("/attributes/:attrId/values", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  const { value, sort_order } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: "value مطلوب" });
  try {
    const r = db.prepare("INSERT INTO variant_attribute_values (attribute_id, value, sort_order) VALUES (?, ?, ?)").run(Number(req.params.attrId), value.trim(), sort_order ?? 0);
    res.status(201).json({ success: true, data: { id: r.lastInsertRowid } });
  } catch {
    res.status(400).json({ error: "القيمة موجودة بالفعل" });
  }
});

// ── Generate variants for an item ────────────────────────────────────────────

router.post("/items/:itemId/generate-variants", requirePagePermission("items", "edit"), (req, res) => {
  const db = getDb();
  const itemId = Number(req.params.itemId);
  const parent = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId);
  if (!parent) return res.status(404).json({ error: "الصنف الأصل غير موجود" });

  const { attributes } = req.body; // { size: ["S","M","L"], color: ["أحمر","أزرق"] }
  if (!attributes || typeof attributes !== "object") return res.status(400).json({ error: "attributes مطلوب" });

  const keys = Object.keys(attributes);
  if (!keys.length) return res.status(400).json({ error: "يجب تحديد خاصية واحدة على الأقل" });

  // Build cartesian product of attribute values
  function cartesian(arrays) {
    return arrays.reduce((acc, arr) => acc.flatMap(a => arr.map(v => [...a, v])), [[]]);
  }
  const combos = cartesian(keys.map(k => (attributes[k] || []).map(v => ({ key: k, value: v }))));

  const tx = db.transaction(() => {
    // Mark parent
    db.prepare("UPDATE items SET is_variant_parent = 1 WHERE id = ?").run(itemId);

    let created = 0;
    for (const combo of combos) {
      const attrJson = JSON.stringify(Object.fromEntries(combo.map(c => [c.key, c.value])));
      // Skip if a child with this exact attribute combo already exists
      const existing = db.prepare("SELECT id FROM items WHERE parent_item_id = ? AND variant_attributes = ?").get(itemId, attrJson);
      if (existing) continue;

      const suffix = combo.map(c => c.value).join("-");
      const childName = `${parent.name} - ${suffix}`;
      const childCode = `${parent.code || parent.item_code || ""}-${suffix}`.slice(0, 50);

      db.prepare(`
        INSERT INTO items (name, name_en, code, sale_price, purchase_price, wholesale_price,
          category_id, unit_id, is_active, is_variant_parent, parent_item_id, variant_attributes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
      `).run(
        childName, parent.name_en ? `${parent.name_en} - ${suffix}` : null,
        childCode, parent.sale_price, parent.purchase_price, parent.wholesale_price,
        parent.category_id, parent.unit_id, itemId, attrJson
      );
      created++;
    }
    return created;
  });

  const count = tx();
  res.json({ success: true, data: { created } });
});

// ── Sellability guard: reject lines for parent items ─────────────────────────
// This function is exported for use in invoiceService
function assertNotVariantParent(db, itemId) {
  const cols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
  if (!cols.includes("is_variant_parent")) return;
  const settings = db.prepare("SELECT feature_variants FROM settings WHERE id = 1").get();
  if (!settings?.feature_variants) return;
  const item = db.prepare("SELECT is_variant_parent FROM items WHERE id = ?").get(itemId);
  if (item?.is_variant_parent) {
    const err = new Error("لا يمكن بيع صنف أصل — اختر متغيراً محدداً (مقاس/لون)");
    err.status = 400;
    throw err;
  }
}

module.exports = router;
module.exports.assertNotVariantParent = assertNotVariantParent;
