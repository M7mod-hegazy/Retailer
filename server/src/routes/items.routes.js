const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

function normalizeImageUrls(payload = {}) {
  if (Array.isArray(payload.image_urls)) {
    return [...new Set(payload.image_urls.map((entry) => String(entry || "").trim()).filter(Boolean))];
  }

  if (typeof payload.image_urls === "string") {
    return [...new Set(payload.image_urls.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean))];
  }

  if (typeof payload.image_urls_text === "string") {
    return [...new Set(payload.image_urls_text.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean))];
  }

  return [];
}

function loadImagesByItemIds(itemIds) {
  if (!itemIds.length) return new Map();
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT id, item_id, image_url, is_primary, sort_order
       FROM item_images
       WHERE item_id IN (${placeholders})
       ORDER BY item_id ASC, is_primary DESC, sort_order ASC, id ASC`,
    )
    .all(...itemIds);

  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.item_id)) {
      map.set(row.item_id, []);
    }
    map.get(row.item_id).push(row);
  });
  return map;
}

function withImages(rows) {
  const ids = rows.map((row) => row.id);
  const imagesByItem = loadImagesByItemIds(ids);

  return rows.map((row) => {
    const imageRows = imagesByItem.get(row.id) || [];
    const imageUrls = imageRows.map((entry) => entry.image_url);
    const primary = imageRows.find((entry) => Number(entry.is_primary) === 1)?.image_url || imageUrls[0] || null;

    return {
      ...row,
      image_urls: imageUrls,
      primary_image_url: primary,
      image_count: imageUrls.length,
    };
  });
}

function storeItemImages(itemId, imageUrls) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM item_images WHERE item_id = ?").run(itemId);
    if (!imageUrls.length) return;
    const stmt = db.prepare(
      "INSERT INTO item_images (item_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)",
    );
    imageUrls.forEach((url, index) => {
      stmt.run(itemId, url, index === 0 ? 1 : 0, index);
    });
  });
  tx();
}

function storeItemImagesInline(db, itemId, imageUrls) {
  db.prepare("DELETE FROM item_images WHERE item_id = ?").run(itemId);
  if (!imageUrls.length) return;
  const stmt = db.prepare(
    "INSERT INTO item_images (item_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)",
  );
  imageUrls.forEach((url, index) => {
    stmt.run(itemId, url, index === 0 ? 1 : 0, index);
  });
}

function getCategoryPrefix(categoryId) {
  if (!categoryId) return null;
  const category = getDb()
    .prepare("SELECT sku_prefix FROM item_categories WHERE id = ?")
    .get(categoryId);
  return String(category?.sku_prefix || "").trim() || null;
}

function parseCodeSuffixForPrefix(code, prefix) {
  const source = String(code || "").trim();
  if (!source || !prefix) return null;
  const [left, right] = source.split(".");
  if (left !== String(prefix)) return null;
  const numeric = Number(right);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function nextCategorySequence(prefix) {
  if (!prefix) return null;
  const rows = getDb()
    .prepare("SELECT code FROM items WHERE code LIKE ?")
    .all(`${prefix}.%`);
  let max = 0;
  rows.forEach((row) => {
    const suffix = parseCodeSuffixForPrefix(row.code, prefix);
    if (suffix && suffix > max) max = suffix;
  });
  return max + 1;
}

function computeCodeAndSequence({ categoryId, incomingCode, currentCode }) {
  const prefix = getCategoryPrefix(categoryId);
  const normalizedIncoming = incomingCode === undefined ? undefined : String(incomingCode || "").trim();

  if (normalizedIncoming !== undefined && normalizedIncoming !== "") {
    return {
      code: normalizedIncoming,
      skuSequence: parseCodeSuffixForPrefix(normalizedIncoming, prefix),
    };
  }

  if (normalizedIncoming === "") {
    if (!prefix) return { code: null, skuSequence: null };
    const next = nextCategorySequence(prefix);
    return { code: `${prefix}.${next}`, skuSequence: next };
  }

  if (currentCode) {
    return {
      code: currentCode,
      skuSequence: parseCodeSuffixForPrefix(currentCode, prefix),
    };
  }

  if (!prefix) {
    return { code: null, skuSequence: null };
  }

  const next = nextCategorySequence(prefix);
  return { code: `${prefix}.${next}`, skuSequence: next };
}

function getItemsList(search = "", categoryId = null, includeDeleted = false) {
  let sql = `
    SELECT i.*, c.name AS category_name, c.sku_prefix, u.name AS unit_name,
           COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.item_id = i.id), 0) AS stock_quantity
    FROM items i
    LEFT JOIN item_categories c ON c.id = i.category_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE 1 = 1
  `;
  const params = [];
  if (!includeDeleted) {
    sql += " AND i.deleted_at IS NULL";
  }
  if (search) {
    sql += " AND (i.name LIKE ? OR i.barcode LIKE ? OR i.code LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    sql += " AND i.category_id = ?";
    params.push(Number(categoryId));
  }
  sql += categoryId
    ? " ORDER BY (i.deleted_at IS NOT NULL) ASC, COALESCE(i.sku_sequence, 999999) ASC, i.id ASC"
    : " ORDER BY (i.deleted_at IS NOT NULL) ASC, i.id DESC";

  const rows = getDb().prepare(sql).all(...params);
  return withImages(rows);
}

router.get("/", requirePagePermission("items", "view"), (req, res) => {
  const search = String(req.query.search || "").trim();
  const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
  const includeDeleted = req.query.include_deleted === "1" || req.query.include_deleted === "true";
  const rows = getItemsList(search, categoryId, includeDeleted);
  res.json({ success: true, data: rows });
});

router.get("/search/detailed", requirePagePermission("items", "view"), (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 200);
  const allItems = getItemsList("");

  const filtered = query
    ? allItems.filter((item) => {
        const name = String(item.name || "").toLowerCase();
        const code = String(item.code || "").toLowerCase();
        const barcode = String(item.barcode || "").toLowerCase();
        const category = String(item.category_name || "").toLowerCase();
        return name.includes(query) || code.includes(query) || barcode.includes(query) || category.includes(query);
      })
    : allItems;

  res.json({ success: true, data: filtered.slice(0, limit) });
});

router.get("/barcode/:barcode", requirePagePermission("items", "view"), (req, res) => {
  const row = getDb().prepare("SELECT * FROM items WHERE barcode = ?").get(req.params.barcode);
  if (!row) return res.status(404).json({ success: false, message: "Item not found" });
  const item = withImages([row])[0];
  return res.json({ success: true, data: item });
});

router.post("/", requirePagePermission("items", "add"), (req, res) => {
  const payload = req.body || {};
  const categoryId = payload.category_id ? Number(payload.category_id) : null;
  const sku = computeCodeAndSequence({
    categoryId,
    incomingCode: payload.code,
    currentCode: null,
  });

  const info = getDb()
    .prepare(
      `INSERT INTO items
       (code, sku_sequence, name, name_en, barcode, category_id, unit_id, sale_price, wholesale_price, purchase_price, tax_rate, item_type, description, is_active, min_stock_qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sku.code,
      sku.skuSequence,
      payload.name,
      payload.name_en || null,
      payload.barcode || null,
      categoryId,
      payload.unit_id ? Number(payload.unit_id) : null,
      Number(payload.sale_price || 0),
      Number(payload.wholesale_price || 0),
      Number(payload.purchase_price || payload.cost_price || 0),
      Number(payload.tax_rate || 0),
      payload.item_type || "product",
      payload.description || null,
      payload.is_active === false ? 0 : 1,
      0,
    );

  const imageUrls = normalizeImageUrls(payload);
  storeItemImages(info.lastInsertRowid, imageUrls);

  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ success: true, data: withImages([row])[0] });
});

router.put("/:id", requirePagePermission("items", "edit"), (req, res) => {
  const payload = req.body || {};
  const id = Number(req.params.id);
  const existing = getDb().prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Item not found" });
  }

  const categoryId =
    payload.category_id === undefined
      ? existing.category_id
      : payload.category_id
      ? Number(payload.category_id)
      : null;

  const sku = computeCodeAndSequence({
    categoryId,
    incomingCode: payload.code,
    currentCode: existing.code,
  });

  getDb()
    .prepare(
      `UPDATE items
       SET code = ?, sku_sequence = ?, name = ?, name_en = ?, barcode = ?, category_id = ?, unit_id = ?, sale_price = ?, wholesale_price = ?, purchase_price = ?, tax_rate = ?, item_type = ?, description = ?, is_active = ?, min_stock_qty = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(
      sku.code,
      sku.skuSequence,
      payload.name ?? existing.name,
      payload.name_en ?? existing.name_en,
      payload.barcode ?? existing.barcode,
      categoryId,
      payload.unit_id === undefined ? existing.unit_id : payload.unit_id ? Number(payload.unit_id) : null,
      Number(payload.sale_price ?? existing.sale_price ?? 0),
      Number(payload.wholesale_price ?? existing.wholesale_price ?? 0),
      Number(payload.purchase_price ?? payload.cost_price ?? existing.purchase_price ?? 0),
      Number(payload.tax_rate ?? existing.tax_rate ?? 0),
      payload.item_type ?? existing.item_type ?? "product",
      payload.description ?? existing.description,
      payload.is_active === undefined ? existing.is_active : payload.is_active === false ? 0 : 1,
      Number(payload.min_stock_qty ?? existing.min_stock_qty ?? 0),
      id,
    );

  if (payload.image_urls !== undefined || payload.image_urls_text !== undefined) {
    storeItemImages(id, normalizeImageUrls(payload));
  }

  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(id);
  return res.json({ success: true, data: withImages([row])[0] });
});

// Swap the code and sku_sequence of two items (same category, adjacent positions)
router.post("/:id/swap/:otherId", requirePagePermission("items", "add"), (req, res) => {
  const db = getDb();
  const a = db.prepare("SELECT id, code, sku_sequence FROM items WHERE id = ?").get(req.params.id);
  const b = db.prepare("SELECT id, code, sku_sequence FROM items WHERE id = ?").get(req.params.otherId);
  if (!a || !b) return res.status(404).json({ success: false, message: "Item not found" });

  db.transaction(() => {
    db.prepare("UPDATE items SET code = ?, sku_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(b.code, b.sku_sequence, a.id);
    db.prepare("UPDATE items SET code = ?, sku_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(a.code, a.sku_sequence, b.id);
  })();

  return res.json({ success: true });
});

// Reorder all items in a category — reassigns codes and sku_sequence in the given order
router.post("/reorder", requirePagePermission("items", "add"), (req, res) => {
  const { category_id, ordered_ids } = req.body || {};
  if (!category_id || !Array.isArray(ordered_ids) || !ordered_ids.length) {
    return res.status(400).json({ success: false, message: "category_id and ordered_ids are required" });
  }
  const prefix = getCategoryPrefix(Number(category_id));
  if (!prefix) return res.status(400).json({ success: false, message: "Category not found or has no prefix" });

  const db = getDb();
  db.transaction(() => {
    ordered_ids.forEach((id, index) => {
      const seq = index + 1;
      db.prepare("UPDATE items SET code = ?, sku_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(`${prefix}.${seq}`, seq, Number(id));
    });
  })();

  return res.json({ success: true });
});

router.delete("/:id", requirePagePermission("items", "delete"), (req, res) => {
  try {
    const existing = getDb().prepare("SELECT id FROM items WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "الصنف غير موجود" });
    getDb().prepare("UPDATE items SET deleted_at = datetime('now'), is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "تعذر حذف الصنف" });
  }
});

router.post("/:id/restore", requirePagePermission("items", "add"), (req, res) => {
  try {
    const existing = getDb().prepare("SELECT id FROM items WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "الصنف غير موجود" });
    getDb().prepare("UPDATE items SET deleted_at = NULL, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "تعذر استعادة الصنف" });
  }
});

function normalizeLookup(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nextCategoryPrefix() {
  const maxRow = getDb()
    .prepare("SELECT MAX(CAST(sku_prefix AS INTEGER)) AS m FROM item_categories WHERE sku_prefix GLOB '[0-9]*'")
    .get();
  return String((maxRow?.m || 0) + 1);
}

function resolveCategoryId(db, payload, createCategories) {
  if (payload.category_id) return Number(payload.category_id);
  const name = String(payload.category_name || "").trim();
  if (!name) return null;

  const categories = db.prepare("SELECT id, name FROM item_categories").all();
  const existing = categories.find((category) => normalizeLookup(category.name) === normalizeLookup(name));
  if (existing) return existing.id;

  if (!createCategories) return null;
  const info = db
    .prepare("INSERT INTO item_categories (name, sku_prefix) VALUES (?, ?)")
    .run(name, nextCategoryPrefix());
  return info.lastInsertRowid;
}

function resolveUnitId(db, payload) {
  if (payload.unit_id) return Number(payload.unit_id);
  const name = String(payload.unit_name || "").trim();
  if (!name) return db.prepare("SELECT id FROM units ORDER BY id ASC LIMIT 1").get()?.id || null;

  const units = db.prepare("SELECT id, name, symbol FROM units").all();
  const existing = units.find((unit) => normalizeLookup(unit.name) === normalizeLookup(name) || normalizeLookup(unit.symbol) === normalizeLookup(name));
  return existing?.id || db.prepare("SELECT id FROM units ORDER BY id ASC LIMIT 1").get()?.id || null;
}

function smartPayload(rawPayload, categoryId, unitId) {
  const payload = rawPayload || {};
  return {
    code: String(payload.code || "").trim(),
    name: String(payload.name || "").trim(),
    name_en: payload.name_en || null,
    barcode: String(payload.barcode || "").trim() || null,
    category_id: categoryId || null,
    unit_id: unitId || null,
    sale_price: Number(payload.sale_price ?? payload.price ?? 0),
    wholesale_price: Number(payload.wholesale_price ?? 0),
    purchase_price: Number(payload.purchase_price ?? payload.cost_price ?? 0),
    tax_rate: Number(payload.tax_rate ?? 0),
    item_type: payload.item_type || "product",
    description: payload.description || null,
    is_active: payload.is_active === false ? 0 : 1,
    min_stock_qty: Number(payload.min_stock_qty ?? 0),
    stock_quantity: payload.stock_quantity === undefined || payload.stock_quantity === "" ? undefined : Number(payload.stock_quantity || 0),
    store_name: payload.store_name || "",
    warehouse_name: payload.warehouse_name || payload.store_name || "",
    warehouse_id: payload.warehouse_id ? Number(payload.warehouse_id) : null,
    image_urls: normalizeImageUrls(payload),
  };
}

function resolveWarehouseId(db, payload, options = {}) {
  const allowDefault = options.allowDefault !== false;
  if (payload.warehouse_id) {
    const existingById = db.prepare("SELECT id FROM warehouses WHERE id = ?").get(payload.warehouse_id);
    if (existingById) return existingById.id;
    if (!allowDefault) throw new Error("Invalid warehouse selected");
  }
  const name = String(payload.warehouse_name || payload.store_name || "").trim();
  if (name) {
    const warehouses = db.prepare("SELECT id, name FROM warehouses").all();
    const existing = warehouses.find((warehouse) => normalizeLookup(warehouse.name) === normalizeLookup(name));
    if (existing) return existing.id;
  }
  if (!allowDefault) throw new Error("Warehouse is required for warehouse stock import");
  return db.prepare("SELECT id FROM warehouses ORDER BY id ASC LIMIT 1").get()?.id || null;
}

function setImportedStockLevel(db, itemId, payload, options = {}) {
  if (payload.stock_quantity === undefined || !Number.isFinite(payload.stock_quantity)) return;
  const warehouseId = resolveWarehouseId(db, payload, options);
  if (!warehouseId) return;
  const existing = db.prepare("SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(itemId, warehouseId);
  const beforeQty = Number(existing?.quantity || 0);
  const afterQty = Number(payload.stock_quantity || 0);
  const delta = afterQty - beforeQty;
  if (existing) {
    db.prepare("UPDATE stock_levels SET quantity = ? WHERE item_id = ? AND warehouse_id = ?").run(afterQty, itemId, warehouseId);
  } else {
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(itemId, warehouseId, afterQty);
  }
  if (delta !== 0) {
    db.prepare(
      "INSERT INTO stock_movements (item_id, warehouse_id, movement_type, quantity, before_qty, after_qty, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(itemId, warehouseId, "branch_receive", delta, beforeQty, afterQty, "item_import", itemId, "استيراد أصناف - استلام مخزون بدون خزنة", null);
  }
}

function findExistingItem(db, payload, preferredId, matchField) {
  if (preferredId) return db.prepare("SELECT * FROM items WHERE id = ?").get(Number(preferredId));
  const allowedFields = new Set(["barcode", "code", "name"]);
  const fields = matchField && allowedFields.has(matchField) ? [matchField] : ["barcode", "code", "name"];
  for (const field of fields) {
    const value = String(payload[field] || "").trim();
    if (!value) continue;
    const row = db.prepare(`SELECT * FROM items WHERE ${field} = ? AND deleted_at IS NULL`).get(value);
    if (row) return row;
  }
  return null;
}

function insertSmartItem(db, rawPayload, createCategories) {
  const categoryId = resolveCategoryId(db, rawPayload, createCategories);
  const unitId = resolveUnitId(db, rawPayload);
  const payload = smartPayload(rawPayload, categoryId, unitId);
  if (!payload.name) throw new Error("Name is required");

  const sku = computeCodeAndSequence({
    categoryId: payload.category_id,
    incomingCode: payload.code,
    currentCode: null,
  });
  if (sku.code) {
    const duplicate = db.prepare("SELECT id FROM items WHERE code = ? AND deleted_at IS NULL").get(sku.code);
    if (duplicate) throw new Error("SKU already exists");
  }

  const info = db
    .prepare(
      `INSERT INTO items
       (code, sku_sequence, name, name_en, barcode, category_id, unit_id, sale_price, wholesale_price, purchase_price, tax_rate, item_type, description, is_active, min_stock_qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sku.code,
      sku.skuSequence,
      payload.name,
      payload.name_en,
      payload.barcode,
      payload.category_id,
      payload.unit_id,
      payload.sale_price,
      payload.wholesale_price,
      payload.purchase_price,
      payload.tax_rate,
      payload.item_type,
      payload.description,
      payload.is_active,
      payload.min_stock_qty,
    );

  storeItemImagesInline(db, info.lastInsertRowid, payload.image_urls);
  setImportedStockLevel(db, info.lastInsertRowid, payload);
  return info.lastInsertRowid;
}

function updateSmartItem(db, id, rawPayload, createCategories) {
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(Number(id));
  if (!existing) throw new Error("Item not found");

  const categoryId =
    rawPayload.category_id !== undefined || rawPayload.category_name
      ? resolveCategoryId(db, rawPayload, createCategories)
      : existing.category_id;
  const unitId =
    rawPayload.unit_id !== undefined || rawPayload.unit_name
      ? resolveUnitId(db, rawPayload)
      : existing.unit_id;
  const payload = smartPayload({ ...existing, ...rawPayload }, categoryId, unitId);

  const sku = computeCodeAndSequence({
    categoryId: payload.category_id,
    incomingCode: rawPayload.code === undefined ? undefined : payload.code,
    currentCode: existing.code,
  });
  if (sku.code) {
    const duplicate = db.prepare("SELECT id FROM items WHERE code = ? AND id <> ? AND deleted_at IS NULL").get(sku.code, Number(id));
    if (duplicate) throw new Error("SKU already exists");
  }

  db.prepare(
    `UPDATE items
     SET code = ?, sku_sequence = ?, name = ?, name_en = ?, barcode = ?, category_id = ?, unit_id = ?, sale_price = ?, wholesale_price = ?, purchase_price = ?, tax_rate = ?, item_type = ?, description = ?, is_active = ?, min_stock_qty = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(
    sku.code,
    sku.skuSequence,
    payload.name || existing.name,
    payload.name_en,
    payload.barcode,
    payload.category_id,
    payload.unit_id,
    payload.sale_price,
    payload.wholesale_price,
    payload.purchase_price,
    payload.tax_rate,
    payload.item_type,
    payload.description,
    payload.is_active,
    payload.min_stock_qty,
    Number(id),
  );

  if (rawPayload.image_urls !== undefined || rawPayload.image_urls_text !== undefined) {
    storeItemImagesInline(db, Number(id), payload.image_urls);
  }
  setImportedStockLevel(db, Number(id), payload);
}

router.post("/import", requirePagePermission("items", "add"), (req, res, next) => {
  const db = getDb();
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const overwriteExisting = req.body?.overwrite_existing === true;
  const createCategories = req.body?.create_categories !== false;
  const smartMode = req.body?.mode === "smart" || rows.some((row) => row && row.payload);

  if (!rows.length) {
    return res.status(400).json({ success: false, message: "No rows provided" });
  }

  try {
    if (smartMode) {
      const data = { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
      const warehouseImportItems = new Map();
      const tx = db.transaction(() => {
        rows.forEach((entry, index) => {
          const action = entry.action || "insert";
          const payload = entry.payload || entry;
          const sourceRow = entry.source_row || index + 1;
          try {
            if (action === "skip") {
              data.skipped += 1;
              return;
            }
            if (action === "warehouse_stock") {
              const itemKey = normalizeLookup(payload.code) || normalizeLookup(payload.barcode) || normalizeLookup(payload.name);
              let itemId = warehouseImportItems.get(itemKey);
              if (!itemId) {
                const existing = findExistingItem(db, payload, entry.existing_id, entry.match_field);
                itemId = existing?.id || insertSmartItem(db, { ...payload, stock_quantity: undefined }, createCategories);
                warehouseImportItems.set(itemKey, itemId);
                if (existing?.id) data.updated += 1;
                else data.inserted += 1;
              }
              setImportedStockLevel(db, itemId, smartPayload(payload, payload.category_id || null, payload.unit_id || null), { allowDefault: false });
              return;
            }
            if (action === "update") {
              const existing = findExistingItem(db, payload, entry.existing_id, entry.match_field);
              if (!existing) throw new Error("Matching item not found");
              updateSmartItem(db, existing.id, payload, createCategories);
              data.updated += 1;
              return;
            }
            insertSmartItem(db, payload, createCategories);
            data.inserted += 1;
          } catch (error) {
            data.failed += 1;
            data.errors.push({ row: sourceRow, message: error.message });
          }
        });
      });
      tx();
      return res.json({ success: true, data });
    }

    let success = 0;
    let failed = 0;
    const errors = [];

    const tx = db.transaction(() => {
      const insertStmt = db.prepare(
        `INSERT INTO items
         (code, sku_sequence, name, name_en, barcode, category_id, unit_id, sale_price, purchase_price, tax_rate, item_type, description, is_active, min_stock_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const updateStmt = db.prepare(
        `UPDATE items
         SET name = ?, sale_price = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      );

      const defaultUnit = db.prepare("SELECT id FROM units ORDER BY id ASC LIMIT 1").get();

      rows.forEach((rawRow, index) => {
        const row = rawRow || {};
        const name = String(row.name || "").trim();
        const barcode = String(row.barcode || "").trim();
        const salePrice = Number(row.price ?? row.sale_price ?? 0);
        const purchasePrice = Number(row.purchase_price ?? salePrice);

        if (!name) {
          failed += 1;
          errors.push({ row: index + 1, message: "Name is required" });
          return;
        }

        if (Number.isNaN(salePrice) || Number.isNaN(purchasePrice)) {
          failed += 1;
          errors.push({ row: index + 1, message: "Invalid price value" });
          return;
        }

        if (barcode) {
          const existing = db.prepare("SELECT id FROM items WHERE barcode = ?").get(barcode);
          if (existing) {
            if (!overwriteExisting) {
              failed += 1;
              errors.push({ row: index + 1, message: "Duplicate barcode" });
              return;
            }
            updateStmt.run(name, salePrice, purchasePrice, existing.id);
            success += 1;
            return;
          }
        }

        const categoryId = row.category_id ? Number(row.category_id) : null;
        const sku = computeCodeAndSequence({
          categoryId,
          incomingCode: row.code,
          currentCode: null,
        });

        insertStmt.run(
          sku.code,
          sku.skuSequence,
          name,
          null,
          barcode || null,
          categoryId,
          defaultUnit?.id || null,
          salePrice,
          purchasePrice,
          0,
          "product",
          null,
          1,
          0,
        );
        success += 1;
      });
    });

    tx();
    return res.json({ success: true, data: { success, failed, errors } });
  } catch (error) {
    return next(error);
  }
});

router.post("/bulk-update", requirePagePermission("items", "add"), (req, res, next) => {
  const db = getDb();
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const createCategories = req.body?.create_categories !== false;

  if (!rows.length) {
    return res.status(400).json({ success: false, message: "No rows provided" });
  }

  try {
    const data = { updated: 0, skipped: 0, failed: 0, errors: [] };
    const tx = db.transaction(() => {
      rows.forEach((entry, index) => {
        const payload = entry.payload || {};
        const sourceRow = entry.source_row || index + 1;
        try {
          const existing = findExistingItem(db, payload, entry.existing_id, entry.match_field);
          if (!existing) {
            data.skipped += 1;
            return;
          }
          updateSmartItem(db, existing.id, payload, createCategories);
          data.updated += 1;
        } catch (error) {
          data.failed += 1;
          data.errors.push({ row: sourceRow, message: error.message });
        }
      });
    });
    tx();
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

function resolvePriceField(price_field) {
  const map = { retail_price: "sale_price", wholesale_price: "wholesale_price", cost_price: "purchase_price" };
  return map[price_field] || "sale_price";
}

function calcNewPrice(oldPrice, direction, adjustment_type, value) {
  const signed = direction === "down" ? -Math.abs(value) : Math.abs(value);
  return adjustment_type === "percentage"
    ? Math.max(0, Math.round(oldPrice * (1 + signed / 100) * 100) / 100)
    : Math.max(0, Math.round((oldPrice + signed) * 100) / 100);
}

router.post("/bulk-price-update", requirePagePermission("items", "add"), (req, res, next) => {
  const db = getDb();
  try {
    const { item_ids, adjustment_type, adjustment_value, direction = "up", price_field = "retail_price", reason = "" } = req.body;
    const value = Math.abs(Number(adjustment_value || 0));
    if (value === 0) return res.status(400).json({ success: false, message: "قيمة التعديل لا يمكن أن تكون صفراً" });
    if (!Array.isArray(item_ids) || !item_ids.length) return res.status(400).json({ success: false, message: "يجب اختيار صنف واحد على الأقل" });

    const field = resolvePriceField(price_field);
    const operationId = `BPU-${Date.now()}`;
    let totalChanges = 0;

    const placeholders = item_ids.map(() => "?").join(",");
    const items = db.prepare(`SELECT id, ${field} as old_price FROM items WHERE id IN (${placeholders})`).all(...item_ids);

    const changedBy = req.user?.name || req.user?.username || "غير محدد";
    const insertHistory = db.prepare(
      `INSERT INTO price_history (item_id, field, old_value, new_value, adjustment_type, adjustment_value, reason, operation_id, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateItem = db.prepare(`UPDATE items SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`);

    const run = db.transaction(() => {
      for (const item of items) {
        const newPrice = calcNewPrice(item.old_price, direction, adjustment_type, value);
        if (newPrice === item.old_price) continue;
        insertHistory.run(item.id, field, item.old_price, newPrice, adjustment_type, value, reason, operationId, changedBy);
        updateItem.run(newPrice, item.id);
        totalChanges++;
      }
    });
    run();

    res.json({ success: true, changes: totalChanges, operation_id: operationId });
  } catch (err) {
    next(err);
  }
});

router.post("/bulk-price-rollback", requirePagePermission("items", "add"), (req, res, next) => {
  const db = getDb();
  try {
    const { operation_id } = req.body;
    if (!operation_id) return res.status(400).json({ success: false, message: "operation_id مطلوب" });
    const history = db.prepare("SELECT * FROM price_history WHERE operation_id = ?").all(operation_id);
    if (!history.length) return res.status(404).json({ success: false, message: "العملية غير موجودة" });
    let restored = 0;
    const run = db.transaction(() => {
      for (const h of history) {
        db.prepare(`UPDATE items SET ${h.field} = ?, updated_at = datetime('now') WHERE id = ?`).run(h.old_value, h.item_id);
        restored++;
      }
      db.prepare("DELETE FROM price_history WHERE operation_id = ?").run(operation_id);
    });
    run();
    res.json({ success: true, restored });
  } catch (err) {
    next(err);
  }
});

router.get("/bulk-price-history", requirePagePermission("items", "view"), (req, res, next) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT operation_id, field, adjustment_type, adjustment_value, reason, changed_by,
             COUNT(*) as items_count, MIN(changed_at) as changed_at
      FROM price_history
      GROUP BY operation_id
      ORDER BY changed_at DESC
      LIMIT 50
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/bulk-price-history/:operationId/items", requirePagePermission("items", "view"), (req, res, next) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT ph.item_id, ph.field, ph.old_value, ph.new_value, ph.adjustment_type, ph.adjustment_value,
             i.name AS item_name, i.barcode, c.name AS category_name
      FROM price_history ph
      LEFT JOIN items i ON i.id = ph.item_id
      LEFT JOIN item_categories c ON c.id = i.category_id
      WHERE ph.operation_id = ?
      ORDER BY i.name ASC
    `).all(req.params.operationId);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
