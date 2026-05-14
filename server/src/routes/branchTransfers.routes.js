const express = require("express");
const { getDb } = require("../config/database");
const { adjustStock } = require("../services/stockService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

// GET /api/branch-transfers
router.get("/", requirePagePermission("branch_transfer", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { date_from, date_to, type, search } = req.query;
    const params = [];

    let sql = `
      SELECT bt.*,
             w.name AS warehouse_name,
             COUNT(btl.id) AS line_count,
             SUM(btl.quantity) AS total_qty
      FROM branch_transfers bt
      LEFT JOIN warehouses w ON w.id = bt.warehouse_id
      LEFT JOIN branch_transfer_lines btl ON btl.transfer_id = bt.id
      WHERE 1=1
    `;

    if (date_from) { sql += " AND date(bt.created_at) >= date(?)"; params.push(String(date_from)); }
    if (date_to)   { sql += " AND date(bt.created_at) <= date(?)"; params.push(String(date_to)); }
    if (type)      { sql += " AND bt.type = ?"; params.push(String(type)); }
    if (search) {
      sql += " AND (bt.reference_no LIKE ? OR w.name LIKE ? OR bt.notes LIKE ?)";
      const like = `%${search}%`;
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
      SELECT bt.*, w.name AS warehouse_name
      FROM branch_transfers bt
      LEFT JOIN warehouses w ON w.id = bt.warehouse_id
      WHERE bt.id = ?
    `).get(id);

    if (!transfer) return res.status(404).json({ success: false, message: "Transfer not found" });

    const lines = db.prepare(`
      SELECT btl.*, i.name AS item_name, i.barcode, u.name AS unit_name
      FROM branch_transfer_lines btl
      LEFT JOIN items i ON i.id = btl.item_id
      LEFT JOIN units u ON u.id = i.unit_id
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
    const { type, warehouse_id, partner_branch, notes, items } = req.body || {};
    const userId = req.user?.id || null;

    if (!type || !["receive", "send"].includes(type)) {
      return res.status(400).json({ success: false, message: "نوع الحركة غير صحيح" });
    }
    if (!warehouse_id) {
      return res.status(400).json({ success: false, message: "يجب تحديد المخزن الافتراضي" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "يجب إضافة صنف واحد على الأقل" });
    }

    const result = db.transaction(() => {
      const last = db.prepare("SELECT id FROM branch_transfers ORDER BY id DESC LIMIT 1").get();
      const nextId = (last?.id || 0) + 1;
      const prefix = type === "receive" ? "BR" : "BS";
      const refNo = `${prefix}-${String(nextId).padStart(5, "0")}`;

      const ins = db.prepare(`
        INSERT INTO branch_transfers (reference_no, type, warehouse_id, partner_branch, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(refNo, type, Number(warehouse_id), partner_branch || null, notes || null, userId);

      const transferId = ins.lastInsertRowid;

      const insertLine = db.prepare(
        "INSERT INTO branch_transfer_lines (transfer_id, item_id, quantity, warehouse_id) VALUES (?, ?, ?, ?)"
      );

      for (const item of items) {
        const itemId = Number(item.item_id);
        const qty = Number(item.quantity);
        const whId = Number(item.warehouse_id) || Number(warehouse_id); // line level warehouse
        if (!itemId || qty <= 0) continue;

        if (type === "send") {
          const stock = db.prepare(
            "SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?"
          ).get(itemId, whId);

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
          warehouse_id: whId,
          quantityDelta: type === "receive" ? qty : -qty,
          movement_type: type === "receive" ? "branch_receive" : "branch_send",
          reference_type: "branch_transfer",
          reference_id: transferId,
          notes: notes || null,
        });

        insertLine.run(transferId, itemId, qty, whId);
      }

      return db.prepare(`
        SELECT bt.*, w.name AS warehouse_name
        FROM branch_transfers bt
        LEFT JOIN warehouses w ON w.id = bt.warehouse_id
        WHERE bt.id = ?
      `).get(transferId);
    })();

    req.audit("create", "branchTransfers", { id: result.id }, `📦 تم تسجيل حركة فرع: ${result.reference_no || ''}`);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
