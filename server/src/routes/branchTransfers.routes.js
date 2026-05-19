const express = require("express");
const { getDb } = require("../config/database");
const { adjustStock } = require("../services/stockService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function buildRefNo(type, id, dateStr) {
  const tag = type === "receive" ? "R" : "S";
  return `BT-${tag}-${dateStr}-${String(id).padStart(3, "0")}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
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
    const { date_from, date_to, type, search, item_search } = req.query;
    const params = [];

    let sql = `
      SELECT bt.*,
             COUNT(DISTINCT btl.id) AS line_count,
             SUM(btl.quantity) AS total_qty
      FROM branch_transfers bt
      LEFT JOIN branch_transfer_lines btl ON btl.transfer_id = bt.id
      WHERE 1=1
    `;

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
        WHERE i.name LIKE ? OR i.item_code LIKE ? OR i.barcode LIKE ?
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

// GET /api/branch-transfers/:id
router.get("/:id", requirePagePermission("branch_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const transfer = db.prepare(`
      SELECT bt.*
      FROM branch_transfers bt
      WHERE bt.id = ?
    `).get(id);

    if (!transfer) return res.status(404).json({ success: false, message: "Transfer not found" });

    const lines = db.prepare(`
      SELECT btl.*, i.name AS item_name, i.barcode, i.item_code,
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
        INSERT INTO branch_transfers (reference_no, type, warehouse_id, partner_branch, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`${prefix}PENDING`, type, headerWhId, partner_branch || null, notes || null, userId);

      const transferId = ins.lastInsertRowid;

      const row = db.prepare(
        "SELECT COUNT(*) AS cnt FROM branch_transfers WHERE reference_no LIKE ? AND id != ?"
      ).get(`${prefix}%`, transferId);
      const seq = (row?.cnt || 0) + 1;
      const refNo = buildRefNo(type, seq, dateStr);

      db.prepare("UPDATE branch_transfers SET reference_no = ? WHERE id = ?").run(refNo, transferId);

      const insertLine = db.prepare(
        "INSERT INTO branch_transfer_lines (transfer_id, item_id, quantity, warehouse_id, unit_cost, selling_price, unit_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );

      for (const item of items) {
        const itemId = Number(item.item_id);
        const qty = Number(item.quantity);
        const lineWhId = Number(item.warehouse_id) || headerWhId;
        const unitCost = Math.max(0, Number(item.unit_cost) || 0);
        const sellingPrice = Math.max(0, Number(item.selling_price) || 0);
        const unitId = item.unit_id ? Number(item.unit_id) : null;
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

        insertLine.run(transferId, itemId, qty, lineWhId, unitCost, sellingPrice, unitId);
      }

      return db.prepare("SELECT * FROM branch_transfers WHERE id = ?").get(transferId);
    })();

    req.audit("create", "branchTransfers", { id: result.id }, `📦 تم تسجيل حركة فرع: ${result.reference_no || ''}`);
    res.status(201).json({ success: true, data: result });
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

    const result = db.transaction(() => {
      // Reverse original stock movements
      for (const line of existingLines) {
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
        "UPDATE branch_transfers SET partner_branch = ?, notes = ?, warehouse_id = ? WHERE id = ?"
      ).run(
        partner_branch || null,
        notes || null,
        Number(items[0]?.warehouse_id) || existing.warehouse_id,
        id
      );

      const insertLine = db.prepare(
        "INSERT INTO branch_transfer_lines (transfer_id, item_id, quantity, warehouse_id, unit_cost, selling_price, unit_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );

      for (const item of items) {
        const itemId = Number(item.item_id);
        const qty = Number(item.quantity);
        const lineWhId = Number(item.warehouse_id) || existing.warehouse_id;
        const unitCost = Math.max(0, Number(item.unit_cost) || 0);
        const sellingPrice = Math.max(0, Number(item.selling_price) || 0);
        const unitId = item.unit_id ? Number(item.unit_id) : null;
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

        insertLine.run(id, itemId, qty, lineWhId, unitCost, sellingPrice, unitId);
      }

      return db.prepare("SELECT * FROM branch_transfers WHERE id = ?").get(id);
    })();

    req.audit("update", "branchTransfers", { id }, `✏️ تم تعديل حركة فرع: ${existing.reference_no}`);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
