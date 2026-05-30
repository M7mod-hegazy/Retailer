const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { recomputeWACCForItem } = require("../services/waccService");
const { hasTable, recordMovement } = require("../services/costLedger");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function withWacc(item) {
  if (!item) return item;
  const db = getDb();
  const sl = db.prepare("SELECT wacc, last_purchase_cost, quantity FROM stock_levels WHERE item_id = ? LIMIT 1").get(item.id);
  const totalQty = db.prepare("SELECT COALESCE(SUM(quantity),0) AS qty FROM stock_levels WHERE item_id = ?").get(item.id)?.qty || 0;
  return {
    ...item,
    current_cost: sl?.wacc ?? item.purchase_price ?? 0,
    last_purchase_cost: sl?.last_purchase_cost ?? item.purchase_price ?? 0,
    has_stock: totalQty > 0,
  };
}

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

function buildItemsWhere({ search = "", categoryId = null, includeDeleted = false } = {}) {
  let where = " WHERE 1 = 1";
  const params = [];

  if (!includeDeleted) {
    where += " AND i.deleted_at IS NULL";
  }
  if (search) {
    where += " AND (i.name LIKE ? OR i.name_en LIKE ? OR i.barcode LIKE ? OR i.code LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (categoryId) {
    where += " AND i.category_id = ?";
    params.push(Number(categoryId));
  }

  return { where, params };
}

function getItemsTotal(search = "", categoryId = null, includeDeleted = false) {
  const { where, params } = buildItemsWhere({ search, categoryId, includeDeleted });
  const row = getDb().prepare(`SELECT COUNT(*) AS total FROM items i ${where}`).get(...params);
  return Number(row?.total || 0);
}

function getItemsList(search = "", categoryId = null, includeDeleted = false, { limit = null, offset = 0 } = {}) {
  const { where, params } = buildItemsWhere({ search, categoryId, includeDeleted });
  let sql = `
    SELECT i.*, c.name AS category_name, c.sku_prefix, u.name AS unit_name,
           COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.item_id = i.id), 0) AS stock_quantity,
           COALESCE((SELECT wacc FROM stock_levels sl WHERE sl.item_id = i.id LIMIT 1), i.purchase_price, 0) AS current_cost,
           COALESCE((SELECT last_purchase_cost FROM stock_levels sl WHERE sl.item_id = i.id LIMIT 1), i.purchase_price, 0) AS last_purchase_cost
    FROM items i
    LEFT JOIN item_categories c ON c.id = i.category_id
    LEFT JOIN units u ON u.id = i.unit_id
    ${where}
  `;
  if (search) {
    // Exact code → code prefix → code contains → name prefix → name contains → everything else
    sql += `
      ORDER BY
        (i.deleted_at IS NOT NULL) ASC,
        CASE WHEN LOWER(COALESCE(i.code,'')) = LOWER(?) THEN 0
             WHEN LOWER(COALESCE(i.code,'')) LIKE LOWER(?) || '%' THEN 1
             WHEN LOWER(COALESCE(i.code,'')) LIKE '%' || LOWER(?) || '%' THEN 2
             WHEN LOWER(COALESCE(i.name,'')) LIKE LOWER(?) || '%' THEN 3
             WHEN LOWER(COALESCE(i.name,'')) LIKE '%' || LOWER(?) || '%' THEN 4
             ELSE 5 END ASC,
        i.id DESC
    `;
    params.push(search, search, search, search, search);
  } else {
    sql += categoryId
      ? " ORDER BY (i.deleted_at IS NOT NULL) ASC, COALESCE(i.sku_sequence, 999999) ASC, i.id ASC"
      : " ORDER BY (i.deleted_at IS NOT NULL) ASC, i.id DESC";
  }
  if (limit) {
    sql += " LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));
  }

  const rows = getDb().prepare(sql).all(...params);
  return withImages(rows);
}

router.get("/", requirePagePermission("items", "view"), (req, res) => {
  const search = String(req.query.search || "").trim();
  const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
  const includeDeleted = req.query.include_deleted === "1" || req.query.include_deleted === "true";
  const limit = req.query.limit ? Math.min(Math.max(Number(req.query.limit), 1), 200) : null;
  const offset = req.query.offset ? Math.max(Number(req.query.offset), 0) : 0;
  const rows = getItemsList(search, categoryId, includeDeleted, { limit, offset });
  const total = limit ? getItemsTotal(search, categoryId, includeDeleted) : rows.length;
  res.json({
    success: true,
    data: rows,
    meta: {
      offset,
      limit,
      count: rows.length,
      total,
      has_more: limit ? offset + rows.length < total : false,
    },
  });
});

router.get("/search/detailed", requirePagePermission("items", "view"), (req, res) => {
  const query = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 200);
  const rows = getItemsList(query, null, false, { limit, offset: 0 });
  res.json({ success: true, data: rows });
});

router.get("/barcode/:barcode", requirePagePermission("items", "view"), (req, res) => {
  const row = getDb().prepare("SELECT * FROM items WHERE barcode = ?").get(req.params.barcode);
  if (!row) return res.status(404).json({ success: false, message: "Item not found" });
  const item = withImages([row])[0];
  return res.json({ success: true, data: item });
});

router.get("/:id/operations", requirePagePermission("items", "view"), (req, res, next) => {
  const db = getDb();
  try {
    const itemId = Number(req.params.id);
    const item = db.prepare(`
      SELECT i.id, i.name, i.code, i.sale_price, i.purchase_price, i.wholesale_price,
             c.name AS category_name,
             COALESCE(SUM(sl.quantity), 0) AS current_stock
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN stock_levels sl ON sl.item_id = i.id
      WHERE i.id = ? AND i.deleted_at IS NULL
      GROUP BY i.id
    `).get(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const types = new Set(String(req.query.types || "sales,purchases,sales_returns,purchase_returns,branch_transfers,opening_balance")
      .split(",").map((type) => type.trim()).filter(Boolean));
    const from = req.query.from || null;
    const to = req.query.to || null;
    const dir = req.query.dir === "asc" ? "asc" : "desc";
    const search = String(req.query.search || "").trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const rows = [];

    const keep = (row) => {
      const date = String(row.date || "").slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (!search) return true;
      return [row.doc_no, row.party_name, row.type_label, row.context_key, row.context_source].some((value) => String(value || "").toLowerCase().includes(search));
    };
    const pushRows = (items) => rows.push(...items.filter(keep));

    if (types.has("sales")) {
      pushRows(db.prepare(`
        SELECT 'sales' AS type, 'مبيعات' AS type_label, i.id AS source_id, il.id AS source_line_id,
          i.invoice_no AS doc_no, i.created_at AS date, COALESCE(c.name, 'نقدي') AS party_name,
          il.quantity, il.unit_price, il.line_total, il.cost_wacc AS unit_cost,
          il.line_total - (il.quantity * COALESCE(il.cost_wacc, 0)) AS profit
        FROM invoice_lines il
        JOIN invoices i ON i.id = il.invoice_id
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE il.item_id = ? AND i.status != 'cancelled'
      `).all(itemId));
    }

    if (types.has("purchases") || types.has("opening_balance")) {
      pushRows(db.prepare(`
        SELECT CASE WHEN COALESCE(pl.is_opening_balance, 0) = 1 OR COALESCE(p.doc_no, '') LIKE 'OB-%' THEN 'opening_balance' ELSE 'purchases' END AS type,
          CASE WHEN COALESCE(pl.is_opening_balance, 0) = 1 OR COALESCE(p.doc_no, '') LIKE 'OB-%' THEN 'رصيد افتتاحي' ELSE 'مشتريات' END AS type_label,
          p.id AS source_id, pl.id AS source_line_id, p.doc_no, p.created_at AS date,
          COALESCE(s.name, pl.supplier_name, '') AS party_name,
          pl.quantity, pl.unit_cost AS unit_price, pl.line_total, pl.unit_cost, NULL AS profit
        FROM purchase_lines pl
        JOIN purchases p ON p.id = pl.purchase_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        WHERE pl.item_id = ? AND COALESCE(p.status, 'active') NOT IN ('cancelled', 'voided')
      `).all(itemId).filter((row) => types.has(row.type)));
    }

    if (types.has("sales_returns")) {
      pushRows(db.prepare(`
        SELECT 'sales_returns' AS type, 'مرتجع مبيعات' AS type_label, sr.id AS source_id, srl.id AS source_line_id,
          sr.doc_no, sr.created_at AS date, COALESCE(c.name, 'نقدي') AS party_name,
          srl.quantity, srl.unit_price, srl.line_total, srl.cost_wacc AS unit_cost, NULL AS profit
        FROM sales_return_lines srl
        JOIN sales_returns sr ON sr.id = srl.sales_return_id
        LEFT JOIN customers c ON c.id = sr.customer_id
        WHERE srl.item_id = ? AND sr.status = 'active'
      `).all(itemId));
    }

    if (types.has("purchase_returns")) {
      pushRows(db.prepare(`
        SELECT 'purchase_returns' AS type, 'مرتجع مشتريات' AS type_label, pr.id AS source_id, prl.id AS source_line_id,
          pr.doc_no, pr.created_at AS date, COALESCE(s.name, '') AS party_name,
          prl.quantity, prl.unit_cost AS unit_price, prl.line_total, prl.unit_cost, NULL AS profit
        FROM purchase_return_lines prl
        JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
        LEFT JOIN suppliers s ON s.id = pr.supplier_id
        WHERE prl.item_id = ? AND COALESCE(pr.status, 'active') = 'active'
      `).all(itemId));
    }

    if (types.has("branch_transfers")) {
      pushRows(db.prepare(`
        SELECT 'branch_transfers' AS type,
          CASE WHEN bt.type = 'receive' THEN 'استلام فرع' ELSE 'إرسال فرع' END AS type_label,
          bt.id AS source_id, btl.id AS source_line_id, bt.reference_no AS doc_no,
          bt.created_at AS date, COALESCE(bt.partner_branch, '') AS party_name,
          btl.quantity, btl.unit_cost AS unit_price, btl.quantity * COALESCE(btl.unit_cost, 0) AS line_total,
          btl.unit_cost, NULL AS profit
        FROM branch_transfer_lines btl
        JOIN branch_transfers bt ON bt.id = btl.transfer_id
        WHERE btl.item_id = ? AND COALESCE(bt.status, 'active') NOT IN ('cancelled', 'voided')
      `).all(itemId));
    }

    const MOVEMENT_LABELS_AR = {
      purchase: "شراء",
      purchase_reversal: "إلغاء شراء",
      purchase_cancel: "إلغاء فاتورة شراء",
      purchase_void: "إبطال فاتورة شراء",
      purchase_return: "مرتجع مشتريات",
      branch_receive: "استلام تحويل",
      branch_receive_reversal: "إلغاء استلام تحويل",
      branch_receive_cancel: "إلغاء استلام تحويل",
      branch_send: "إرسال تحويل",
      opening_balance: "رصيد افتتاحي",
      sale: "بيع",
      sale_return: "مرتجع مبيعات",
      sale_cancel: "إلغاء فاتورة بيع",
      cancel_sales_return: "إلغاء مرتجع مبيعات",
      adjustment: "تعديل يدوي",
      manual_adjustment: "تعديل يدوي",
      import: "استيراد",
      item_import: "استيراد صنف",
      stock_adjustment: "تعديل مخزني",
      physical_count: "جرد فعلي",
      transfer: "تحويل",
    };
    const REFERENCE_LABELS_AR = {
      invoice: "فاتورة بيع",
      purchase: "فاتورة شراء",
      sales_return: "مرتجع مبيعات",
      purchase_return: "مرتجع مشتريات",
      branch_transfer: "تحويل فرع",
      stock_adjustment: "تعديل مخزني",
      physical_count: "جرد فعلي",
      item_import: "استيراد صنف",
      stock: "حركة مخزون",
    };
    const SOURCE_TABLE_LABELS_AR = {
      purchase_lines: "فاتورة شراء",
      branch_transfer_lines: "تحويل فرع",
      item_import: "استيراد صنف",
    };
    const PRICE_FIELD_LABELS_AR = {
      sale_price: "سعر البيع",
      purchase_price: "سعر الشراء",
      wholesale_price: "سعر الجملة",
    };
    const PRICE_SOURCE_LABELS_AR = {
      item_create: "إنشاء صنف",
      bulk_update: "تحديث جماعي",
      purchase_locked: "تحديث من فاتورة شراء",
      branch_receive_locked: "تحديث من استلام تحويل",
      manual_correction: "تصحيح يدوي",
      revert: "استرجاع",
    };

    if (types.has("cost_movements") && hasTable(db, "cost_movements")) {
      const rawRows = db.prepare(`
        SELECT 'cost_movements' AS type, movement_type AS raw_movement_type,
          source_id, source_line_id,
          source_table AS raw_source_table, occurred_at AS date,
          quantity, unit_cost AS unit_price, quantity * unit_cost AS line_total, unit_cost
        FROM cost_movements
        WHERE item_id = ?
      `).all(itemId);
      const mapped = rawRows.map((row) => {
        const movementLabel = MOVEMENT_LABELS_AR[row.raw_movement_type] || row.raw_movement_type;
        const sourceLabel = SOURCE_TABLE_LABELS_AR[row.raw_source_table] || row.raw_source_table;
        return {
          ...row,
          type_label: movementLabel,
          doc_no: `${sourceLabel} #${row.source_id}`,
          party_name: sourceLabel,
          profit: null,
          context_key: "حركة تكلفة",
          context_source: movementLabel,
        };
      });
      pushRows(mapped);
    }

    if (types.has("price_changes")) {
      const rawRows = db.prepare(`
        SELECT 'price_changes' AS type, ph.id AS source_id, ph.id AS source_line_id,
          ph.operation_id, ph.source AS raw_source, ph.field AS raw_field,
          ph.changed_at AS date,
          COALESCE(u.username, u.full_name, ph.changed_by, '') AS party_name,
          ph.new_value AS unit_price, ph.new_value - ph.old_value AS line_total,
          ph.old_value AS context_before, ph.new_value AS context_after
        FROM price_history ph
        LEFT JOIN users u ON u.id = CAST(ph.changed_by AS INTEGER)
        WHERE ph.item_id = ?
      `).all(itemId);
      const mapped = rawRows.map((row) => {
        const fieldLabel = PRICE_FIELD_LABELS_AR[row.raw_field] || row.raw_field;
        const sourceLabel = PRICE_SOURCE_LABELS_AR[row.raw_source] || row.raw_source;
        return {
          ...row,
          type_label: `تغيير ${fieldLabel}`,
          doc_no: `${fieldLabel} - ${sourceLabel}`,
          quantity: null,
          unit_cost: null,
          profit: null,
          context_key: fieldLabel,
          context_source: sourceLabel,
        };
      });
      pushRows(mapped);
    }

    if (types.has("stock_movements")) {
      const rawRows = db.prepare(`
        SELECT 'stock_movements' AS type, sm.movement_type AS raw_movement_type,
          sm.reference_type AS raw_reference_type, sm.reference_id,
          sm.id AS source_id, sm.id AS source_line_id,
          sm.created_at AS date, COALESCE(w.name, '') AS party_name,
          sm.quantity, sm.before_qty AS context_before, sm.after_qty AS context_after, sm.notes
        FROM stock_movements sm
        LEFT JOIN warehouses w ON w.id = sm.warehouse_id
        WHERE sm.item_id = ? AND sm.deleted_at IS NULL
      `).all(itemId);
      const mapped = rawRows.map((row) => {
        const movementLabel = MOVEMENT_LABELS_AR[row.raw_movement_type] || row.raw_movement_type;
        const referenceLabel = REFERENCE_LABELS_AR[row.raw_reference_type] || row.raw_reference_type || "حركة مخزون";
        const docNo = row.reference_id
          ? `${referenceLabel} #${row.reference_id}`
          : referenceLabel;
        return {
          ...row,
          type_label: movementLabel,
          doc_no: docNo,
          unit_price: null,
          line_total: null,
          unit_cost: null,
          profit: null,
          context_key: "الرصيد",
          context_source: row.notes || referenceLabel,
        };
      });
      pushRows(mapped);
    }

    rows.sort((a, b) => {
      const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
      const lineCompare = Number(a.source_line_id || 0) - Number(b.source_line_id || 0);
      return dir === "asc" ? (dateCompare || lineCompare) : -(dateCompare || lineCompare);
    });
    res.json({ success: true, item, data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit });
  } catch (error) {
    next(error);
  }
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

  // Write item-create baseline price_history rows
  const newItemId = info.lastInsertRowid;
  const insertBaseline = getDb().prepare(
    `INSERT INTO price_history (item_id, field, old_value, new_value, adjustment_type, adjustment_value, source, operation_id, changed_by)
     VALUES (?, ?, 0, ?, 'set', ?, 'item_create', ?, ?)`
  );
  const createdBy = req.user?.name || req.user?.username || "غير محدد";
  const opId = `CREATE-${newItemId}`;
  const salePrice  = Number(payload.sale_price || 0);
  const purchPrice = Number(payload.purchase_price || payload.cost_price || 0);
  const wholePrice = Number(payload.wholesale_price || 0);
  if (salePrice  > 0) insertBaseline.run(newItemId, "sale_price",      salePrice,  salePrice,  opId, createdBy);
  if (purchPrice > 0) insertBaseline.run(newItemId, "purchase_price",  purchPrice, purchPrice, opId, createdBy);
  if (wholePrice > 0) insertBaseline.run(newItemId, "wholesale_price", wholePrice, wholePrice, opId, createdBy);

  req.audit("create", "items", { id: newItemId }, `📦 تم إضافة صنف: ${payload.name || ''}`);
  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ success: true, data: withWacc(withImages([row])[0]) });
});

router.put("/:id", requirePagePermission("items", "edit"), (req, res) => {
  const payload = req.body || {};
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Item not found" });
  }

  // Lock purchase_price once the item has stock — WACC is the source of truth after first receipt
  if (payload.purchase_price !== undefined && payload.purchase_price !== null) {
    const stockRow = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS qty FROM stock_levels WHERE item_id = ?").get(id);
    const hasStock = Number(stockRow?.qty || 0) > 0;
    if (hasStock) {
      // Silently ignore purchase_price changes when stock exists; WACC governs cost
      delete payload.purchase_price;
    }
  }

  // Lock sale_price and wholesale_price — these must change via /purchases/new (with lock)
  // or /operations/bulk-price-update only. If a change is attempted here, allow it but
  // record it in price_history with source='manual_correction' for auditability.
  const priceChanges = [];
  for (const f of ["sale_price", "wholesale_price"]) {
    if (payload[f] !== undefined && payload[f] !== null) {
      const newVal = Number(payload[f]);
      const oldVal = Number(existing[f] || 0);
      if (Math.abs(newVal - oldVal) > 0.0001) {
        priceChanges.push({ field: f, oldVal, newVal });
      }
    }
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

  db.prepare(
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

  // Log direct price changes from the items edit page as manual_correction
  if (priceChanges.length) {
    const insertHist = db.prepare(
      `INSERT INTO price_history (item_id, field, old_value, new_value, adjustment_type, adjustment_value, source, operation_id, changed_by)
       VALUES (?, ?, ?, ?, 'set', ?, 'manual_correction', ?, ?)`
    );
    const changedBy = req.user?.name || req.user?.username || "غير محدد";
    const opId = `ITEM-EDIT-${id}-${Date.now()}`;
    for (const c of priceChanges) {
      insertHist.run(id, c.field, c.oldVal, c.newVal, c.newVal, opId, changedBy);
    }
  }

  req.audit("update", "items", { id }, `📦 تم تعديل صنف: ${payload.name || ''}`);
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  return res.json({ success: true, data: withWacc(withImages([row])[0]) });
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
    req.audit("delete", "items", { id: req.params.id }, `📦 تم حذف صنف`);
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

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function insertWithAvailableColumns(db, table, valuesByColumn) {
  const cols = tableColumns(db, table).filter((col) => Object.prototype.hasOwnProperty.call(valuesByColumn, col));
  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((col) => valuesByColumn[col]);
  return db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`).run(...values);
}

function ensureImportOpeningBalance(db, itemId, payload, warehouseId, quantity) {
  const unitCost = Number(payload.purchase_price || 0);
  const qty = Number(quantity || 0);
  if (qty <= 0 || unitCost <= 0) return;

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const item = db.prepare("SELECT name, name_en, barcode FROM items WHERE id = ?").get(itemId);
  const docNo = `OB-IMPORT-${itemId}`;
  let purchase = db.prepare("SELECT id FROM purchases WHERE doc_no = ?").get(docNo);
  if (!purchase) {
    const result = insertWithAvailableColumns(db, "purchases", {
      doc_no: docNo,
      supplier_id: null,
      total: 0,
      payment_method: "cash",
      warehouse_id: warehouseId,
      created_at: now,
      updated_at: now,
      created_by: null,
      status: "active",
      is_opening_balance: 1,
    });
    purchase = { id: result.lastInsertRowid };
  }

  const lineTotal = qty * unitCost;
  const line = insertWithAvailableColumns(db, "purchase_lines", {
    purchase_id: purchase.id,
    item_id: itemId,
    quantity: qty,
    unit_cost: unitCost,
    line_total: lineTotal,
    is_opening_balance: 1,
    item_name_ar: item?.name || null,
    item_name_en: item?.name_en || null,
    barcode: item?.barcode || null,
    supplier_name: null,
    update_master_purchase_price: 0,
    update_master_sale_price: 0,
    update_master_wholesale_price: 0,
  });

  db.prepare("UPDATE purchases SET total = COALESCE(total, 0) + ? WHERE id = ?").run(lineTotal, purchase.id);

  if (hasTable(db, "cost_movements")) {
    recordMovement(db, {
      item_id: itemId,
      warehouse_id: warehouseId,
      occurred_at: now,
      movement_type: "opening_balance",
      quantity: qty,
      unit_cost: unitCost,
      source_table: "purchase_lines",
      source_id: purchase.id,
      source_line_id: line.lastInsertRowid,
    });
  }
}

function setImportedStockLevel(db, itemId, payload, options = {}) {
  if (payload.stock_quantity === undefined || !Number.isFinite(payload.stock_quantity)) return;
  const warehouseId = resolveWarehouseId(db, payload, options);
  if (!warehouseId) return;
  const existing = db.prepare("SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(itemId, warehouseId);
  const beforeQty = Number(existing?.quantity || 0);
  const afterQty = Number(payload.stock_quantity || 0);
  const delta = afterQty - beforeQty;
  const unitCost = Number(payload.purchase_price || 0);
  if (existing) {
    db.prepare(`
      UPDATE stock_levels
      SET quantity = ?,
          wacc = CASE WHEN COALESCE(wacc, 0) = 0 AND ? > 0 THEN ? ELSE wacc END,
          last_purchase_cost = CASE WHEN COALESCE(last_purchase_cost, 0) = 0 AND ? > 0 THEN ? ELSE last_purchase_cost END
      WHERE item_id = ? AND warehouse_id = ?
    `).run(afterQty, unitCost, unitCost, unitCost, unitCost, itemId, warehouseId);
  } else {
    db.prepare(`
      INSERT INTO stock_levels (item_id, warehouse_id, quantity, wacc, last_purchase_cost)
      VALUES (?, ?, ?, ?, ?)
    `).run(itemId, warehouseId, afterQty, unitCost, unitCost);
  }
  if (delta !== 0) {
    db.prepare(
      "INSERT INTO stock_movements (item_id, warehouse_id, movement_type, quantity, before_qty, after_qty, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(itemId, warehouseId, "branch_receive", delta, beforeQty, afterQty, "item_import", itemId, "استيراد أصناف - استلام مخزون بدون خزنة", null);
  }
  if (delta > 0 && unitCost > 0) {
    ensureImportOpeningBalance(db, itemId, payload, warehouseId, delta);
    recomputeWACCForItem(itemId, db);
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
      `INSERT INTO price_history (item_id, field, old_value, new_value, adjustment_type, adjustment_value, reason, operation_id, changed_by, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'bulk_update')`
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
