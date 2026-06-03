const express = require("express");
const { getDb } = require("../config/database");
const { transferStock } = require("../services/stockTransferService");
const { adjustStock } = require("../services/stockService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const NotificationModel = require("../models/notification.model");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function getSessionWithLines(db, sessionId) {
  const session = db
    .prepare(
      `SELECT pcs.*, w.name AS warehouse_name, ic.name AS category_name
       FROM physical_count_sessions pcs
       LEFT JOIN warehouses w ON w.id = pcs.warehouse_id
       LEFT JOIN item_categories ic ON ic.id = pcs.category_id
       WHERE pcs.id = ?`,
    )
    .get(sessionId);
  if (!session) return null;
  const lines = db
    .prepare(
      `SELECT pcl.*,
              i.name AS item_name, i.barcode, i.code AS item_code,
              u.name AS unit_name,
              ic.name AS category_name,
              w.name AS warehouse_name
       FROM physical_count_lines pcl
       LEFT JOIN items i ON i.id = pcl.item_id
       LEFT JOIN units u ON u.id = i.unit_id
       LEFT JOIN item_categories ic ON ic.id = i.category_id
       LEFT JOIN warehouses w ON w.id = pcl.warehouse_id
       WHERE pcl.session_id = ?
       ORDER BY i.name ASC`,
    )
    .all(sessionId);
  return { ...session, lines };
}

router.get("/levels", requirePagePermission("stock_transfer", "view"), (req, res) => {
  const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
  const search = String(req.query.search || "").trim();
  const itemIds = String(req.query.item_ids || "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const limit = req.query.limit ? Math.min(Math.max(Number(req.query.limit), 1), 500) : null;
  const offset = req.query.offset ? Math.max(Number(req.query.offset), 0) : 0;
  const params = [];

  let sql;
  const db = getDb();
  const globalMinMargin = db.prepare("SELECT min_margin_percent FROM settings LIMIT 1").get()?.min_margin_percent ?? 15;

  if (warehouseId) {
    sql = `
      SELECT i.id AS item_id, i.name AS item_name, i.barcode, i.code, i.min_stock_qty, i.sale_price,
             i.purchase_price, i.min_margin_percent AS item_min_margin,
             u.name AS unit_name, c.name AS category_name,
             COALESCE(sl.quantity, 0) AS quantity,
             COALESCE(sl.wacc, i.purchase_price) AS wacc,
             ? AS warehouse_id, w.name AS warehouse_name
      FROM items i
      LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = ?
      LEFT JOIN warehouses w ON w.id = ?
      LEFT JOIN units u ON u.id = i.unit_id
      LEFT JOIN item_categories c ON c.id = i.category_id
      WHERE i.is_active = 1
    `;
    params.push(warehouseId, warehouseId, warehouseId);
    if (search) {
      sql += " AND (i.name LIKE ? OR i.barcode LIKE ? OR i.code LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (itemIds.length) {
      sql += ` AND i.id IN (${itemIds.map(() => "?").join(",")})`;
      params.push(...itemIds);
    }
    sql += " ORDER BY i.name ASC";
  } else {
    sql = `
      SELECT i.id AS item_id, i.name AS item_name, i.barcode, i.code, i.min_stock_qty, i.sale_price,
             i.purchase_price, i.min_margin_percent AS item_min_margin,
             u.name AS unit_name, c.name AS category_name,
             COALESCE(sl.quantity, 0) AS quantity,
             COALESCE(sl.wacc, i.purchase_price) AS wacc,
             sl.warehouse_id, w.name AS warehouse_name
      FROM items i
      LEFT JOIN stock_levels sl ON sl.item_id = i.id
      LEFT JOIN warehouses w ON w.id = sl.warehouse_id
      LEFT JOIN units u ON u.id = i.unit_id
      LEFT JOIN item_categories c ON c.id = i.category_id
      WHERE i.is_active = 1
    `;
    if (search) {
      sql += " AND (i.name LIKE ? OR i.barcode LIKE ? OR i.code LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (itemIds.length) {
      sql += ` AND i.id IN (${itemIds.map(() => "?").join(",")})`;
      params.push(...itemIds);
    }
    sql += " ORDER BY i.name ASC, w.name ASC";
  }

  if (limit) {
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);
  }

  const raw = db.prepare(sql).all(...params);
  const data = raw.map(r => {
    const cost = r.wacc || r.purchase_price || 0;
    const price = r.sale_price || 0;
    const margin_pct = price > 0 ? ((price - cost) / price) * 100 : null;
    const threshold = r.item_min_margin != null ? r.item_min_margin : globalMinMargin;
    return { ...r, margin_pct: margin_pct != null ? Math.round(margin_pct * 10) / 10 : null, margin_threshold: threshold, below_margin: margin_pct != null && margin_pct < threshold };
  });
  res.json({
    success: true,
    data,
    meta: {
      offset,
      limit,
      count: data.length,
      has_more: limit ? data.length === limit : false,
    },
  });
});

router.get("/movements", requirePagePermission("stock_transfer", "view"), (req, res) => {
  const db = getDb();
  const {
    warehouse_id,
    item_id,
    movement_type,
    search,
    date_from,
    date_to,
    sort_by = "created_at",
    sort_dir = "desc",
    limit = 100,
    offset = 0,
  } = req.query;
  const params = [];
  const sortMap = {
    created_at: "sm.created_at",
    item_name: "i.name",
    warehouse_name: "w.name",
    movement_type: "sm.movement_type",
    quantity: "sm.quantity",
    notes: "sm.notes",
    before_qty: "sm.before_qty",
    after_qty: "sm.after_qty",
    id: "sm.id",
  };
  const sortCol = sortMap[sort_by] || sortMap.created_at;
  const sortDir = String(sort_dir).toLowerCase() === "asc" ? "ASC" : "DESC";
  let sql = `
    SELECT sm.*, i.name AS item_name, i.barcode, i.code AS item_code, w.name AS warehouse_name,
           u.username AS created_by_name
    FROM stock_movements sm
    LEFT JOIN items i ON i.id = sm.item_id
    LEFT JOIN warehouses w ON w.id = sm.warehouse_id
    LEFT JOIN users u ON u.id = sm.created_by
    WHERE sm.deleted_at IS NULL
  `;
  if (warehouse_id) { sql += " AND sm.warehouse_id = ?"; params.push(Number(warehouse_id)); }
  if (item_id) { sql += " AND sm.item_id = ?"; params.push(Number(item_id)); }
  if (movement_type) { sql += " AND sm.movement_type = ?"; params.push(movement_type); }
  if (search) { sql += " AND (i.name LIKE ? OR i.barcode LIKE ? OR i.code LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (date_from) { sql += " AND date(sm.created_at) >= date(?)"; params.push(String(date_from)); }
  if (date_to) { sql += " AND date(sm.created_at) <= date(?)"; params.push(String(date_to)); }
  sql += ` ORDER BY ${sortCol} ${sortDir}, sm.id DESC`;

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM (${sql})`).get(...params).cnt;
  sql += " LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows, total, limit: Number(limit), offset: Number(offset) });
});

router.get("/movements/:id", requirePagePermission("stock_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const movement = db
      .prepare(
        `SELECT sm.*, i.name AS item_name, i.code AS item_code, i.barcode, w.name AS warehouse_name
         FROM stock_movements sm
         LEFT JOIN items i ON i.id = sm.item_id
         LEFT JOIN warehouses w ON w.id = sm.warehouse_id
         WHERE sm.id = ? AND sm.deleted_at IS NULL`,
      )
      .get(Number(req.params.id));
    if (!movement) return res.status(404).json({ success: false, message: "Movement not found" });
    res.json({ success: true, data: movement });
  } catch (error) {
    next(error);
  }
});

router.put("/movements/:id", requirePagePermission("stock_transfer", "edit"), (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const notes = req.body?.notes == null ? null : String(req.body.notes).trim();
    const existing = db
      .prepare("SELECT id FROM stock_movements WHERE id = ? AND deleted_at IS NULL")
      .get(id);
    if (!existing) return res.status(404).json({ success: false, message: "Movement not found" });
    db.prepare("UPDATE stock_movements SET notes = ? WHERE id = ?").run(notes || null, id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/movements/:id", requirePagePermission("stock_transfer", "delete"), (req, res, next) => {
  const db = getDb();
  try {
    const id = Number(req.params.id);
    const movement = db
      .prepare("SELECT * FROM stock_movements WHERE id = ? AND deleted_at IS NULL")
      .get(id);
    if (!movement) return res.status(404).json({ success: false, message: "Movement not found" });
    if (movement.movement_type !== "manual_adjustment") {
      return res.status(400).json({ success: false, message: "Only manual adjustments can be deleted" });
    }

    db.transaction(() => {
      db.prepare("UPDATE stock_levels SET quantity = quantity - ? WHERE item_id = ? AND warehouse_id = ?")
        .run(movement.quantity, movement.item_id, movement.warehouse_id);
      db.prepare("UPDATE stock_movements SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(id);
    })();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/transfer", requirePagePermission("stock_transfer", "add"), (req, res, next) => {
  try {
    const { item_id, from_warehouse_id, to_warehouse_id, quantity, notes } = req.body || {};
    const result = transferStock({ item_id, from_warehouse_id, to_warehouse_id, quantity, notes });
    req.audit("transfer", "stock", { item_id, from_warehouse_id, to_warehouse_id, quantity }, `🔄 تم نقل مخزون: صنف #${item_id} (${quantity} وحدة) من مستودع #${from_warehouse_id} إلى #${to_warehouse_id}`);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post("/transfer/bulk", requirePagePermission("stock_transfer", "add"), (req, res, next) => {
  try {
    const { from_warehouse_id, to_warehouse_id, items, notes } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: "يجب اختيار صنف واحد على الأقل" });
    }
    const userId = req.user?.id || null;
    const results = [];
    const errors = [];
    for (const it of items) {
      try {
        const r = transferStock({ item_id: it.item_id, from_warehouse_id, to_warehouse_id, quantity: it.quantity, notes, user_id: userId });
        results.push(r);
      } catch (e) {
        errors.push({ item_id: it.item_id, message: e.message });
      }
    }
    req.audit("bulk_transfer", "stock", { from_warehouse_id, to_warehouse_id, count: results.length }, `🔄 تم نقل مخزون مجمّع (${results.length} صنف) من مستودع #${from_warehouse_id} إلى #${to_warehouse_id}`);
    res.json({ success: true, transferred: results.length, errors });
  } catch (error) {
    next(error);
  }
});

router.post("/adjust", requirePagePermission("stock_transfer", "add"), (req, res, next) => {
  const db = getDb();
  try {
    // Guard: ensure before_qty/after_qty columns exist
    const smCols = db.prepare("PRAGMA table_info(stock_movements)").all().map(c => c.name);
    if (!smCols.includes("before_qty")) db.exec("ALTER TABLE stock_movements ADD COLUMN before_qty INTEGER");
    if (!smCols.includes("after_qty"))  db.exec("ALTER TABLE stock_movements ADD COLUMN after_qty INTEGER");

    const payload = req.body || {};
    const itemId = Number(payload.item_id);
    const warehouseId = Number(payload.warehouse_id);
    const userId = req.user?.id || null;
    const current = db
      .prepare("SELECT quantity FROM stock_levels WHERE warehouse_id = ? AND item_id = ?")
      .get(warehouseId, itemId);
    const currentQty = current?.quantity ?? 0;
    const nextQty =
      payload.new_quantity !== undefined
        ? Number(payload.new_quantity)
        : currentQty + Number(payload.adjustment || 0);
    const variance = nextQty - currentQty;
    if (variance !== 0) {
      // Log the movement only — do NOT touch stock_levels here, adjustStock handles it
      db.prepare(
        "INSERT INTO stock_movements (item_id, warehouse_id, movement_type, quantity, before_qty, after_qty, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(itemId, warehouseId, "manual_adjustment", variance, currentQty, nextQty, "stock_adjustment", null, payload.notes || null, userId);

      // Now sync stock_levels to the desired absolute value
      if (current) {
        db.prepare("UPDATE stock_levels SET quantity = ? WHERE warehouse_id = ? AND item_id = ?")
          .run(nextQty, warehouseId, itemId);
      } else {
        db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)")
          .run(itemId, warehouseId, nextQty);
      }
    }
    const stockAuditId = req.audit("adjust", "stock", { item_id: itemId, warehouse_id: warehouseId, from: currentQty, to: nextQty }, `🔄 تم تعديل مخزون صنف #${itemId} في مستودع #${warehouseId}: ${currentQty} ← ${nextQty}`);
    try {
      const itemRow = db.prepare("SELECT name FROM items WHERE id = ?").get(itemId);
      const itemName = itemRow?.name || `صنف #${itemId}`;
      NotificationModel.create({
        title: "📦 تم تسوية مخزون",
        body: `تسوية مخزون للصنف: ${itemName} — الكمية: ${nextQty}`,
        type: "info",
        link: stockAuditId ? `/history?log_id=${stockAuditId}` : `/stock`,
      });
    } catch (_) {}
    res.json({ success: true, data: { item_id: itemId, warehouse_id: warehouseId, quantity: nextQty } });
  } catch (error) {
    next(error);
  }
});

// ─── Physical Count ───────────────────────────────────────────────────────────

router.get("/physical-count/sessions", requirePagePermission("stock_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const sessions = db
      .prepare(
        `SELECT pcs.*, w.name AS warehouse_name, ic.name AS category_name,
                COUNT(pcl.id) AS total_lines,
                SUM(CASE WHEN pcl.touched = 1 THEN 1 ELSE 0 END) AS counted_lines,
                SUM(CASE WHEN pcl.variance != 0 THEN 1 ELSE 0 END) AS variance_count
         FROM physical_count_sessions pcs
         LEFT JOIN warehouses w ON w.id = pcs.warehouse_id
         LEFT JOIN item_categories ic ON ic.id = pcs.category_id
         LEFT JOIN physical_count_lines pcl ON pcl.session_id = pcs.id
         GROUP BY pcs.id
         ORDER BY pcs.updated_at DESC, pcs.created_at DESC`,
      )
      .all();
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

router.post("/physical-count/sessions", requirePagePermission("stock_transfer", "add"), (req, res, next) => {
  const db = getDb();

  try {
    const session = db.transaction(() => {
      const payload = req.body || {};
      const scope = payload.scope || "warehouse";
      const sessionName = payload.name || null;
      const warehouseId = payload.warehouse_id ? Number(payload.warehouse_id) : null;
      const categoryId = payload.category_id ? Number(payload.category_id) : null;
      const itemIds = Array.isArray(payload.item_ids) ? payload.item_ids.map(Number) : null;

      // Check for existing in-progress session for same warehouse (warehouse scope only)
      if (scope === "warehouse" && warehouseId) {
        const existing = db
          .prepare("SELECT id FROM physical_count_sessions WHERE warehouse_id = ? AND status = 'in_progress'")
          .get(warehouseId);
        if (existing) {
          const error = new Error("يوجد جرد جارٍ بالفعل لهذا المستودع");
          error.status = 400;
          throw error;
        }
      }

      const created = db
        .prepare(
          `INSERT INTO physical_count_sessions (warehouse_id, category_id, scope, name, status, notes)
           VALUES (?, ?, ?, ?, 'in_progress', ?)`,
        )
        .run(warehouseId, categoryId, scope, sessionName, payload.notes || null);
      const sessionId = created.lastInsertRowid;

      let itemRows = [];

      if (scope === "warehouse" && warehouseId) {
        // All active items with their stock in this warehouse
        itemRows = db
          .prepare(
            `SELECT i.id AS item_id, COALESCE(sl.quantity, 0) AS qty, ? AS wh_id
             FROM items i
             LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = ?
             WHERE i.is_active = 1
             ORDER BY i.name ASC`,
          )
          .all(warehouseId, warehouseId);
      } else if (scope === "category" && categoryId) {
        // All active items in category × all warehouses they have stock in (or once with null if no stock)
        itemRows = db
          .prepare(
            `SELECT i.id AS item_id, COALESCE(sl.quantity, 0) AS qty, sl.warehouse_id AS wh_id
             FROM items i
             LEFT JOIN stock_levels sl ON sl.item_id = i.id
             WHERE i.is_active = 1 AND i.category_id = ?
             ORDER BY i.name ASC, sl.warehouse_id ASC`,
          )
          .all(categoryId);
      } else if (scope === "custom" && itemIds && itemIds.length) {
        // Selected items × all warehouses they have stock in (or once with null if no stock)
        const placeholders = itemIds.map(() => "?").join(",");
        itemRows = db
          .prepare(
            `SELECT i.id AS item_id, COALESCE(sl.quantity, 0) AS qty, sl.warehouse_id AS wh_id
             FROM items i
             LEFT JOIN stock_levels sl ON sl.item_id = i.id
             WHERE i.is_active = 1 AND i.id IN (${placeholders})
             ORDER BY i.name ASC, sl.warehouse_id ASC`,
          )
          .all(...itemIds);
      }

      const insertLine = db.prepare(
        `INSERT OR IGNORE INTO physical_count_lines
           (session_id, item_id, warehouse_id, system_quantity, counted_quantity, variance, touched)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
      );

      for (const row of itemRows) {
        insertLine.run(sessionId, row.item_id, row.wh_id || null, row.qty, row.qty);
      }

      return getSessionWithLines(db, sessionId);
    })();

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.get("/physical-count/sessions/:id", requirePagePermission("stock_transfer", "view"), (req, res, next) => {
  try {
    const session = getSessionWithLines(getDb(), Number(req.params.id));
    if (!session) {
      const error = new Error("Physical count session not found");
      error.status = 404;
      throw error;
    }
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.delete("/physical-count/sessions/:id", requirePagePermission("stock_transfer", "delete"), (req, res, next) => {
  const db = getDb();
  try {
    const sessionId = Number(req.params.id);
    const session = db.prepare("SELECT * FROM physical_count_sessions WHERE id = ?").get(sessionId);
    if (!session) {
      const error = new Error("Session not found");
      error.status = 404;
      throw error;
    }
    if (session.status !== "in_progress") {
      const error = new Error("يمكن إلغاء الجلسات الجارية فقط");
      error.status = 400;
      throw error;
    }
    db.prepare(
      "UPDATE physical_count_sessions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(sessionId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/physical-count/sessions/:id/lines", requirePagePermission("stock_transfer", "add"), (req, res, next) => {
  const db = getDb();

  try {
    const session = db.prepare("SELECT * FROM physical_count_sessions WHERE id = ?").get(Number(req.params.id));
    if (!session || session.status !== "in_progress") {
      const error = new Error("Active physical count session not found");
      error.status = 404;
      throw error;
    }

    const payload = req.body || {};
    const itemId = Number(payload.item_id || 0);
    const warehouseId = payload.warehouse_id ? Number(payload.warehouse_id) : null;
    const countedQty = Number(payload.counted_quantity ?? 0);

    const line = db
      .prepare("SELECT * FROM physical_count_lines WHERE session_id = ? AND item_id = ? AND COALESCE(warehouse_id, 0) = COALESCE(?, 0)")
      .get(session.id, itemId, warehouseId);

    if (!line) {
      const current = db
        .prepare("SELECT quantity FROM stock_levels WHERE warehouse_id = ? AND item_id = ?")
        .get(warehouseId || session.warehouse_id, itemId);
      const systemQty = current?.quantity || 0;
      db.prepare(
        `INSERT INTO physical_count_lines
           (session_id, item_id, warehouse_id, system_quantity, counted_quantity, variance, touched, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      ).run(session.id, itemId, warehouseId, systemQty, countedQty, countedQty - systemQty);
    } else {
      db.prepare(
        `UPDATE physical_count_lines
         SET counted_quantity = ?, variance = ?, touched = 1, updated_at = CURRENT_TIMESTAMP
         WHERE session_id = ? AND item_id = ? AND COALESCE(warehouse_id, 0) = COALESCE(?, 0)`,
      ).run(countedQty, countedQty - line.system_quantity, session.id, itemId, warehouseId);
    }

    // Update session updated_at so "last saved" is fresh
    db.prepare("UPDATE physical_count_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(session.id);

    // Return lightweight response (just line stats) to avoid re-sending all lines
    const stats = db
      .prepare(
        `SELECT COUNT(*) AS total_lines,
                SUM(CASE WHEN touched = 1 THEN 1 ELSE 0 END) AS counted_lines,
                SUM(CASE WHEN variance != 0 THEN 1 ELSE 0 END) AS variance_count
         FROM physical_count_lines WHERE session_id = ?`,
      )
      .get(session.id);
    res.json({ success: true, data: { item_id: itemId, warehouse_id: warehouseId, counted_quantity: countedQty, ...stats } });
  } catch (error) {
    next(error);
  }
});

router.post("/physical-count/sessions/:id/confirm", requirePagePermission("stock_transfer", "add"), (req, res, next) => {
  const db = getDb();

  try {
    const result = db.transaction(() => {
      const sessionId = Number(req.params.id);
      const currentSession = db.prepare("SELECT * FROM physical_count_sessions WHERE id = ?").get(sessionId);
      if (!currentSession || currentSession.status !== "in_progress") {
        const error = new Error("Active physical count session not found");
        error.status = 404;
        throw error;
      }

      const lines = db
        .prepare("SELECT * FROM physical_count_lines WHERE session_id = ? ORDER BY id ASC")
        .all(sessionId);

      for (const line of lines) {
        if (line.variance !== 0) {
          const whId = line.warehouse_id || currentSession.warehouse_id;
          // Apply variance once via adjustStock (updates stock_levels + logs stock_movements).
          adjustStock({
            item_id: line.item_id,
            warehouse_id: whId,
            quantityDelta: line.variance,
            movement_type: "physical_count",
            reference_type: "physical_count_session",
            reference_id: sessionId,
          });
        }
      }

      db.prepare(
        "UPDATE physical_count_sessions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(sessionId);

      return getSessionWithLines(db, sessionId);
    })();

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
