const express = require("express");
const { getDb } = require("../config/database");
const { adjustStock } = require("../services/stockService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const NotificationModel = require("../models/notification.model");
const { captureBranchTransferLineOverrides } = require("../services/overrideTrackingService");
const { applyLinePriceUpdates, revertLinePriceUpdates } = require("../services/priceLockService");
const { recomputeWACCForItem } = require("../services/waccService");
const { hasTable, recordMovement } = require("../services/costLedger");
const { nowSql, dayStamp } = require("../utils/datetime");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function recordBranchReceiveCost(db, transferId, line, options = {}) {
  if (!hasTable(db, "cost_movements") || !line?.id || options.type === "send") return;
  const quantity = Number(line.quantity || 0) * (options.reversal ? -1 : 1);
  if (!quantity) return;
  recordMovement(db, {
    item_id: line.item_id,
    warehouse_id: line.warehouse_id || null,
    occurred_at: options.occurred_at || nowSql(),
    movement_type: options.movement_type || "branch_receive",
    quantity,
    unit_cost: line.unit_cost || 0,
    source_table: "branch_transfer_lines",
    source_id: transferId,
    source_line_id: options.reversal ? -Number(line.id) : Number(line.id),
  });
}

function buildRefNo(type, id, dateStr) {
  const tag = type === "receive" ? "R" : "S";
  return `BT-${tag}-${dateStr}-${String(id).padStart(3, "0")}`;
}

function todayStr() {
  return dayStamp();
}

// GET /api/branch-transfers/next-ref?type=receive|send
router.get("/next-ref", requirePagePermission("branch_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const type = req.query.type === "send" ? "send" : "receive";
    const tag = type === "receive" ? "R" : "S";
    const dateStr = todayStr();
    const prefix = `BT-${tag}-${dateStr}-`;

    const row = db.prepare(
      "SELECT COUNT(*) AS cnt FROM branch_transfers WHERE reference_no LIKE ?"
    ).get(`${prefix}%`);

    const next = (row?.cnt || 0) + 1;
    res.json({ success: true, data: { reference_no: `${prefix}${String(next).padStart(3, "0")}` } });
  } catch (err) {
    next(err);
  }
});

// GET /api/branch-transfers
router.get("/", requirePagePermission("branch_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { date_from, date_to, type, search, item_search, user_id = "" } = req.query;
    const params = [];

    let sql = `
      SELECT bt.*, u.username AS created_by_username,
             COUNT(DISTINCT btl.id) AS line_count,
             SUM(btl.quantity) AS total_qty
      FROM branch_transfers bt
      LEFT JOIN branch_transfer_lines btl ON btl.transfer_id = bt.id
      LEFT JOIN users u ON u.id = bt.created_by
      WHERE COALESCE(bt.status, 'active') != 'cancelled'
    `;

    if (user_id) { sql += " AND bt.created_by = ?"; params.push(String(user_id)); }
    if (date_from) { sql += " AND date(bt.created_at) >= date(?)"; params.push(String(date_from)); }
    if (date_to)   { sql += " AND date(bt.created_at) <= date(?)"; params.push(String(date_to)); }
    if (type)      { sql += " AND bt.type = ?"; params.push(String(type)); }
    if (search) {
      sql += " AND (bt.reference_no LIKE ? OR bt.partner_branch LIKE ? OR bt.notes LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (item_search) {
      sql += ` AND bt.id IN (
        SELECT DISTINCT btl2.transfer_id FROM branch_transfer_lines btl2
        LEFT JOIN items i ON i.id = btl2.item_id
        WHERE i.name LIKE ? OR i.code LIKE ? OR i.barcode LIKE ?
      )`;
      const like = `%${item_search}%`;
      params.push(like, like, like);
    }

    sql += " GROUP BY bt.id ORDER BY bt.created_at DESC, bt.id DESC";

    const data = db.prepare(sql).all(...params);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/branch-transfers/items-search?q=...&date_from=...&date_to=...&type=...
router.get("/items-search", requirePagePermission("branch_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { q = "", date_from, date_to, type } = req.query;
    if (!q.trim()) return res.json({ success: true, data: [] });

    const conditions = ["COALESCE(bt.status, 'active') != 'cancelled'"];
    const params = [];

    conditions.push("(i.name LIKE ? OR i.code LIKE ? OR i.barcode LIKE ?)");
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);

    if (type) { conditions.push("bt.type = ?"); params.push(type); }
    if (date_from && date_to) {
      conditions.push("date(bt.created_at) BETWEEN date(?) AND date(?)");
      params.push(date_from, date_to);
    } else if (date_from || date_to) {
      conditions.push("date(bt.created_at) = date(?)");
      params.push(date_from || date_to);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = db.prepare(`
      SELECT btl.id AS line_id, btl.transfer_id, bt.reference_no, bt.created_at, bt.type,
             bt.partner_branch,
             btl.item_id, i.name AS item_name, i.code AS item_code, i.barcode,
             COALESCE(u2.name, u.name) AS unit_name,
             w.name AS warehouse_name,
             btl.quantity, btl.unit_cost, btl.selling_price
      FROM branch_transfer_lines btl
      JOIN branch_transfers bt ON bt.id = btl.transfer_id
      JOIN items i ON i.id = btl.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      LEFT JOIN units u2 ON u2.id = btl.unit_id
      LEFT JOIN warehouses w ON w.id = btl.warehouse_id
      ${where}
      ORDER BY bt.created_at DESC
      LIMIT 100
    `).all(...params);

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/branch-transfers/:id
router.get("/:id", requirePagePermission("branch_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const transfer = db.prepare(`
      SELECT bt.*,
             u.username AS created_by_username,
             u.full_name AS created_by_name,
             w_main.name AS warehouse_name,
             w_from.name AS from_warehouse_name,
             w_to.name AS to_warehouse_name
      FROM branch_transfers bt
      LEFT JOIN users u ON u.id = bt.created_by
      LEFT JOIN warehouses w_main ON w_main.id = bt.warehouse_id
      LEFT JOIN warehouses w_from ON w_from.id = bt.from_warehouse_id
      LEFT JOIN warehouses w_to ON w_to.id = bt.to_warehouse_id
      WHERE bt.id = ?
    `).get(id);

    if (!transfer) return res.status(404).json({ success: false, message: "Transfer not found" });

    const lines = db.prepare(`
      SELECT btl.*,
             i.name AS item_name, i.barcode, i.code AS item_code,
             i.purchase_price AS original_purchase_price,
             i.sale_price     AS original_sale_price,
             i.wholesale_price AS original_wholesale_price,
             COALESCE(u2.name, u.name) AS unit_name,
             w.name AS warehouse_name
      FROM branch_transfer_lines btl
      LEFT JOIN items i ON i.id = btl.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      LEFT JOIN units u2 ON u2.id = btl.unit_id
      LEFT JOIN warehouses w ON w.id = btl.warehouse_id
      WHERE btl.transfer_id = ?
      ORDER BY btl.id ASC
    `).all(id);

    res.json({ success: true, data: { ...transfer, lines } });
  } catch (err) {
    next(err);
  }
});

// POST /api/branch-transfers
router.post("/", requirePagePermission("branch_transfer", "add"), (req, res, next) => {
  const db = getDb();
  try {
    const { type, partner_branch, notes, items } = req.body || {};
    const userId = req.user?.id || null;

    if (!type || !["receive", "send"].includes(type)) {
      return res.status(400).json({ success: false, message: "نوع الحركة غير صحيح" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "يجب إضافة صنف واحد على الأقل" });
    }

    const result = db.transaction(() => {
      const dateStr = todayStr();
      const tag = type === "receive" ? "R" : "S";
      const prefix = `BT-${tag}-${dateStr}-`;

      const headerWhId = Number(items[0]?.warehouse_id) || 1;

      const ins = db.prepare(`
        INSERT INTO branch_transfers
          (reference_no, type, warehouse_id, from_warehouse_id, to_warehouse_id, partner_branch, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`${prefix}PENDING`, type, headerWhId, headerWhId, headerWhId, partner_branch || null, notes || null, userId);

      const transferId = ins.lastInsertRowid;

      const row = db.prepare(
        "SELECT COUNT(*) AS cnt FROM branch_transfers WHERE reference_no LIKE ? AND id != ?"
      ).get(`${prefix}%`, transferId);
      const seq = (row?.cnt || 0) + 1;
      const refNo = buildRefNo(type, seq, dateStr);

      db.prepare("UPDATE branch_transfers SET reference_no = ? WHERE id = ?").run(refNo, transferId);

      const insertLine = db.prepare(
        `INSERT INTO branch_transfer_lines
           (transfer_id, item_id, quantity, warehouse_id, unit_cost, selling_price, wholesale_price,
            update_master_purchase_price, update_master_sale_price, update_master_wholesale_price, unit_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const transferSavedLines = [];
      const priceLines = [];

      for (const item of items) {
        const itemId = Number(item.item_id);
        const qty = Number(item.quantity);
        const lineWhId = Number(item.warehouse_id) || headerWhId;
        const unitCost = Math.max(0, Number(item.unit_cost) || 0);
        const sellingPrice = Math.max(0, Number(item.selling_price) || 0);
        const wholesalePrice = Math.max(0, Number(item.wholesale_price) || 0);
        const unitId = item.unit_id ? Number(item.unit_id) : null;
        const lockBuy   = type === "receive" ? (item.update_master_purchase_price  !== false ? 1 : 0) : 0;
        const lockSell  = type === "receive" ? (item.update_master_sale_price       !== false ? 1 : 0) : 0;
        const lockWhole = type === "receive" ? (item.update_master_wholesale_price  !== false ? 1 : 0) : 0;
        if (!itemId || qty <= 0) continue;

        if (type === "send") {
          const stock = db.prepare(
            "SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?"
          ).get(itemId, lineWhId);

          if (!stock || stock.quantity < qty) {
            const itemRow = db.prepare("SELECT name FROM items WHERE id = ?").get(itemId);
            throw Object.assign(
              new Error(`الكمية غير كافية للصنف: ${itemRow?.name || itemId}`),
              { status: 400 }
            );
          }
        }

        adjustStock({
          item_id: itemId,
          warehouse_id: lineWhId,
          quantityDelta: type === "receive" ? qty : -qty,
          movement_type: type === "receive" ? "branch_receive" : "branch_send",
          reference_type: "branch_transfer",
          reference_id: transferId,
          notes: notes || null,
        });

        const tlr = insertLine.run(
          transferId, itemId, qty, lineWhId, unitCost, sellingPrice, wholesalePrice,
          lockBuy, lockSell, lockWhole, unitId
        );
        transferSavedLines.push({ id: tlr.lastInsertRowid });
        if (type === "receive") {
          recordBranchReceiveCost(db, transferId, {
            id: tlr.lastInsertRowid,
            item_id: itemId,
            warehouse_id: lineWhId,
            quantity: qty,
            unit_cost: unitCost,
          });
        }

        if (type === "receive") {
          priceLines.push({
            item_id: itemId,
            unit_cost: unitCost,
            unit_price: sellingPrice,
            wholesale_price: wholesalePrice,
            update_master_purchase_price:  lockBuy,
            update_master_sale_price:      lockSell,
            update_master_wholesale_price: lockWhole,
          });
        }
      }

      // Capture master_price_at_time for override tracking (backend-only)
      captureBranchTransferLineOverrides(transferSavedLines, db);

      // Apply master price updates for receive documents
      let priceUpdateCount = 0;
      if (type === "receive" && priceLines.length > 0) {
        const results = applyLinePriceUpdates(priceLines, {
          source: "branch_receive_locked",
          operationId: `BTR-${transferId}`,
          changedBy: userId,
          db,
        });
        priceUpdateCount = results.filter(r => r.applied).length;

        // Recompute WACC for each unique item
        const uniqueItemIds = [...new Set(priceLines.map(l => l.item_id))];
        for (const itemId of uniqueItemIds) {
          recomputeWACCForItem(itemId, db);
        }
      }

      const saved = db.prepare("SELECT * FROM branch_transfers WHERE id = ?").get(transferId);
      return { ...saved, priceUpdateCount };
    })();

    const { priceUpdateCount, ...savedDoc } = result;
    const priceNote = priceUpdateCount > 0 ? ` — تحديث ${priceUpdateCount} سعر` : "";
    req.audit("create", "branchTransfers", { id: savedDoc.id }, `📦 تم تسجيل حركة فرع: ${savedDoc.reference_no || ''}${priceNote}`);
    res.status(201).json({ success: true, data: savedDoc });
  } catch (err) {
    next(err);
  }
});

// PUT /api/branch-transfers/:id
router.put("/:id", requirePagePermission("branch_transfer", "edit"), (req, res, next) => {
  const db = getDb();
  try {
    const id = Number(req.params.id);
    const { partner_branch, notes, items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "يجب إضافة صنف واحد على الأقل" });
    }

    const existing = db.prepare("SELECT * FROM branch_transfers WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ success: false, message: "المستند غير موجود" });

    const existingLines = db.prepare(
      "SELECT * FROM branch_transfer_lines WHERE transfer_id = ?"
    ).all(id);

    const userId = req.user?.id || null;

    const result = db.transaction(() => {
      // Revert master price changes for receive docs before re-inserting lines
      if (existing.type === "receive") {
        revertLinePriceUpdates({
          source: "branch_receive_locked",
          operationId: `BTR-${id}`,
          changedBy: userId,
          db,
        });
      }

      // Reverse original stock movements
      for (const line of existingLines) {
        if (existing.type === "receive") {
          recordBranchReceiveCost(db, id, line, { reversal: true, movement_type: "branch_receive_reversal" });
        }
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id,
          quantityDelta: existing.type === "receive" ? -line.quantity : line.quantity,
          movement_type: existing.type === "receive" ? "branch_receive_reversal" : "branch_send_reversal",
          reference_type: "branch_transfer",
          reference_id: id,
          notes: "تعديل مستند",
        });
      }

      // Delete old lines
      db.prepare("DELETE FROM branch_transfer_lines WHERE transfer_id = ?").run(id);

      // Update header metadata (keep reference_no, type, created_at)
      db.prepare(
        "UPDATE branch_transfers SET partner_branch = ?, notes = ?, warehouse_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
      ).run(
        partner_branch || null,
        notes || null,
        Number(items[0]?.warehouse_id) || existing.warehouse_id,
        id
      );

      const insertLine = db.prepare(
        `INSERT INTO branch_transfer_lines
           (transfer_id, item_id, quantity, warehouse_id, unit_cost, selling_price, wholesale_price,
            update_master_purchase_price, update_master_sale_price, update_master_wholesale_price, unit_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const priceLines = [];

      for (const item of items) {
        const itemId = Number(item.item_id);
        const qty = Number(item.quantity);
        const lineWhId = Number(item.warehouse_id) || existing.warehouse_id;
        const unitCost = Math.max(0, Number(item.unit_cost) || 0);
        const sellingPrice = Math.max(0, Number(item.selling_price) || 0);
        const wholesalePrice = Math.max(0, Number(item.wholesale_price) || 0);
        const unitId = item.unit_id ? Number(item.unit_id) : null;
        const lockBuy   = existing.type === "receive" ? (item.update_master_purchase_price  !== false ? 1 : 0) : 0;
        const lockSell  = existing.type === "receive" ? (item.update_master_sale_price       !== false ? 1 : 0) : 0;
        const lockWhole = existing.type === "receive" ? (item.update_master_wholesale_price  !== false ? 1 : 0) : 0;
        if (!itemId || qty <= 0) continue;

        if (existing.type === "send") {
          const stock = db.prepare(
            "SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?"
          ).get(itemId, lineWhId);

          if (!stock || stock.quantity < qty) {
            const itemRow = db.prepare("SELECT name FROM items WHERE id = ?").get(itemId);
            throw Object.assign(
              new Error(`الكمية غير كافية للصنف: ${itemRow?.name || itemId}`),
              { status: 400 }
            );
          }
        }

        adjustStock({
          item_id: itemId,
          warehouse_id: lineWhId,
          quantityDelta: existing.type === "receive" ? qty : -qty,
          movement_type: existing.type === "receive" ? "branch_receive" : "branch_send",
          reference_type: "branch_transfer",
          reference_id: id,
          notes: notes || null,
        });

        const tlr = insertLine.run(id, itemId, qty, lineWhId, unitCost, sellingPrice, wholesalePrice,
          lockBuy, lockSell, lockWhole, unitId);
        if (existing.type === "receive") {
          recordBranchReceiveCost(db, id, {
            id: tlr.lastInsertRowid,
            item_id: itemId,
            warehouse_id: lineWhId,
            quantity: qty,
            unit_cost: unitCost,
          });
        }

        if (existing.type === "receive") {
          priceLines.push({
            item_id: itemId,
            unit_cost: unitCost,
            unit_price: sellingPrice,
            wholesale_price: wholesalePrice,
            update_master_purchase_price:  lockBuy,
            update_master_sale_price:      lockSell,
            update_master_wholesale_price: lockWhole,
          });
        }
      }

      // Apply new master price updates and recompute WACC for receive docs
      let priceUpdateCount = 0;
      if (existing.type === "receive" && priceLines.length > 0) {
        const results = applyLinePriceUpdates(priceLines, {
          source: "branch_receive_locked",
          operationId: `BTR-${id}`,
          changedBy: userId,
          db,
        });
        priceUpdateCount = results.filter(r => r.applied).length;

        const uniqueItemIds = [...new Set(priceLines.map(l => l.item_id))];
        for (const itemId of uniqueItemIds) {
          recomputeWACCForItem(itemId, db);
        }
      }

      const saved = db.prepare("SELECT * FROM branch_transfers WHERE id = ?").get(id);
      return { ...saved, priceUpdateCount };
    })();

    const { priceUpdateCount, ...updatedDoc } = result;
    const priceNote = priceUpdateCount > 0 ? ` — تحديث ${priceUpdateCount} سعر` : "";
    req.audit("update", "branchTransfers", { id }, `✏️ تم تعديل حركة فرع: ${existing.reference_no}${priceNote}`);
    res.json({ success: true, data: updatedDoc });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/branch-transfers/:id  — cancel and reverse stock movements
router.delete("/:id", requirePagePermission("branch_transfer", "delete"), (req, res, next) => {
  const db = getDb();
  try {
    const id = Number(req.params.id);
    const { reason = "" } = req.body || {};
    const transfer = db.prepare("SELECT * FROM branch_transfers WHERE id = ?").get(id);
    if (!transfer) return res.status(404).json({ success: false, message: "المستند غير موجود" });
    if ((transfer.status || "active") === "cancelled") {
      return res.status(400).json({ success: false, message: "المستند ملغى بالفعل" });
    }

    const lines = db.prepare("SELECT * FROM branch_transfer_lines WHERE transfer_id = ?").all(id);
    const cancelUserId = req.user?.id || null;

    db.transaction(() => {
      // Revert master prices before marking cancelled
      if (transfer.type === "receive") {
        revertLinePriceUpdates({
          source: "branch_receive_locked",
          operationId: `BTR-${id}`,
          changedBy: cancelUserId,
          db,
        });
      }

      for (const line of lines) {
        if (transfer.type === "receive") {
          recordBranchReceiveCost(db, id, line, { reversal: true, movement_type: "branch_receive_cancel" });
        }
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id,
          quantityDelta: transfer.type === "receive" ? -line.quantity : line.quantity,
          movement_type: transfer.type === "receive" ? "branch_receive_reversal" : "branch_send_reversal",
          reference_type: "branch_transfer",
          reference_id: id,
          notes: `إلغاء: ${reason || transfer.reference_no}`,
        });
      }

      // Recompute WACC after price revert + stock reversal
      if (transfer.type === "receive") {
        const uniqueItemIds = [...new Set(lines.map(l => l.item_id))];
        for (const itemId of uniqueItemIds) {
          recomputeWACCForItem(itemId, db);
        }
      }

      const now = nowSql();
      db.prepare(
        "UPDATE branch_transfers SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?"
      ).run(now, cancelUserId, reason.trim() || null, id);
    })();

    try {
      NotificationModel.create({
        type: "warning",
        title: "إلغاء حركة فرع",
        body: `تم إلغاء مستند ${transfer.reference_no}${reason ? ": " + reason : ""}`,
        link: `/branch-transfers`,
      });
    } catch (_) {}

    req.audit("delete", "branchTransfers", { id }, `🗑️ تم إلغاء حركة فرع: ${transfer.reference_no}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
