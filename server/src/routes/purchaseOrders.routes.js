const express = require("express");
const { getDb } = require("../config/database");
const { adjustStock } = require("../services/stockService");
const { generateDocNumber } = require("../utils/docNumber");
const { recomputeWACCForItem } = require("../services/waccService");
const { hasTable, recordMovement } = require("../services/costLedger");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function recordReceiptCost(db, purchaseId, lineId, line, warehouseId) {
  if (!hasTable(db, "cost_movements")) return;
  recordMovement(db, {
    item_id: line.item_id,
    warehouse_id: warehouseId,
    occurred_at: new Date().toISOString().replace("T", " ").slice(0, 19),
    movement_type: "purchase",
    quantity: line.receiveQty,
    unit_cost: line.unit_cost,
    source_table: "purchase_lines",
    source_id: purchaseId,
    source_line_id: lineId,
  });
}

router.get("/", requirePagePermission("purchase_orders", "view"), (req, res) => {
  const db = getDb();
  const { search = "", status } = req.query;
  const conditions = ["1=1"];
  const params = [];
  if (search) {
    conditions.push("(s.name LIKE ? OR CAST(po.id AS TEXT) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) { conditions.push("po.status = ?"); params.push(status); }
  const orders = db.prepare(`
    SELECT po.*, s.name AS supplier_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY po.id DESC
  `).all(...params);
  res.json({ success: true, data: orders });
});

router.get("/:id", requirePagePermission("purchase_orders", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const order = db.prepare(`
      SELECT po.*, s.name AS supplier_name
      FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?
    `).get(req.params.id);
    if (!order) {
      const error = new Error("Purchase order not found");
      error.status = 404;
      throw error;
    }
    const lines = db
      .prepare(
        `SELECT pol.*, i.name AS item_name, i.code AS item_code
         FROM purchase_order_lines pol
         LEFT JOIN items i ON i.id = pol.item_id
         WHERE pol.purchase_order_id = ?
         ORDER BY pol.id ASC`,
      )
      .all(req.params.id)
      .map((line) => ({ ...line, remaining_quantity: Number(line.quantity) - Number(line.received_quantity || 0) }));
    res.json({ success: true, data: { ...order, lines } });
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePagePermission("purchase_orders", "add"), (req, res) => {
  const db = getDb();
  const payload = req.body || {};
  const docNo = generateDocNumber('purchase_order');
  const result = db
    .prepare("INSERT INTO purchase_orders (doc_no, supplier_id, status, notes) VALUES (?, ?, 'pending', ?)")
    .run(docNo, payload.supplier_id || null, payload.notes || null);

  for (const line of payload.lines || []) {
    db.prepare(
      "INSERT INTO purchase_order_lines (purchase_order_id, item_id, quantity, unit_cost, received_quantity) VALUES (?, ?, ?, ?, 0)",
    ).run(result.lastInsertRowid, line.item_id, Number(line.quantity), Number(line.unit_cost || 0));
  }

  req.audit("create", "purchaseOrders", { id: result.lastInsertRowid }, `📦 تم إنشاء أمر شراء`);
  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(result.lastInsertRowid),
  });
});

router.patch("/:id/approve", requirePagePermission("purchase_orders", "edit"), (req, res, next) => {
  try {
    getDb().prepare("UPDATE purchase_orders SET status = 'approved' WHERE id = ?").run(req.params.id);
    req.audit("update", "purchaseOrders", { id: req.params.id }, `📦 تم اعتماد أمر شراء`);
    res.json({ success: true, data: getDb().prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/cancel", requirePagePermission("purchase_orders", "edit"), (req, res, next) => {
  try {
    const db = getDb();
    const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
    if (!order) { const e = new Error("Purchase order not found"); e.status = 404; throw e; }
    if (order.status === "received") { const e = new Error("Cannot cancel a received order"); e.status = 400; throw e; }
    db.prepare("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    req.audit("update", "purchaseOrders", { id: req.params.id }, `📦 تم إلغاء أمر شراء`);
    res.json({ success: true, data: db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/receive", requirePagePermission("purchase_orders", "edit"), (req, res, next) => {
  const db = getDb();

  try {
    const received = db.transaction(() => {
      const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
      if (!order) {
        const err = new Error("Purchase order not found");
        err.status = 404;
        throw err;
      }
      if (order.status === "received") {
        const err = new Error("Purchase order already received");
        err.status = 400;
        throw err;
      }

      const lines = db
        .prepare("SELECT * FROM purchase_order_lines WHERE purchase_order_id = ? ORDER BY id ASC")
        .all(req.params.id);

      const requestedLines = Array.isArray(req.body?.lines) ? req.body.lines : [];
      const receiptLines = lines
        .map((line) => {
          const requested = requestedLines.find((entry) => Number(entry.purchase_order_line_id) === line.id);
          const remaining = line.quantity - (line.received_quantity || 0);
          const receiveQty = requested ? Number(requested.quantity || 0) : remaining;
          if (receiveQty <= 0) return null;
          if (receiveQty > remaining) {
            const err = new Error("Invalid received quantity for purchase order line");
            err.status = 400;
            throw err;
          }
          return { ...line, receiveQty, remaining };
        })
        .filter(Boolean);

      if (receiptLines.length === 0) {
        const err = new Error("No receivable lines were provided");
        err.status = 400;
        throw err;
      }

      let total = 0;
      for (const line of receiptLines) total += line.receiveQty * line.unit_cost;

      const receiptDocNo = generateDocNumber('purchase_receipt');
      const purchase = db
        .prepare("INSERT INTO purchases (doc_no, supplier_id, total) VALUES (?, ?, ?)")
        .run(receiptDocNo, order.supplier_id || null, total);

      const receivedItemIds = new Set();
      for (const line of receiptLines) {
        const purchaseLine = db.prepare(
          "INSERT INTO purchase_lines (purchase_id, item_id, quantity, unit_cost, line_total) VALUES (?, ?, ?, ?, ?)",
        ).run(
          purchase.lastInsertRowid,
          line.item_id,
          line.receiveQty,
          line.unit_cost,
          line.receiveQty * line.unit_cost,
        );
        const warehouseId = req.body?.warehouse_id || 1;
        recordReceiptCost(db, purchase.lastInsertRowid, purchaseLine.lastInsertRowid, line, warehouseId);
        receivedItemIds.add(Number(line.item_id));

        db.prepare(
          "UPDATE purchase_order_lines SET received_quantity = received_quantity + ? WHERE id = ?",
        ).run(line.receiveQty, line.id);

        adjustStock({
          item_id: line.item_id,
          warehouse_id: warehouseId,
          quantityDelta: line.receiveQty,
          movement_type: "purchase_order_receive",
          reference_type: "purchase_order",
          reference_id: Number(req.params.id),
        });
      }
      for (const itemId of receivedItemIds) recomputeWACCForItem(itemId, db);

      const updatedLines = db
        .prepare("SELECT quantity, received_quantity FROM purchase_order_lines WHERE purchase_order_id = ?")
        .all(req.params.id);
      const allReceived = updatedLines.every((line) => Number(line.received_quantity || 0) >= Number(line.quantity || 0));
      const hasAnyReceived = updatedLines.some((line) => Number(line.received_quantity || 0) > 0);
      const nextStatus = allReceived ? "received" : hasAnyReceived ? "partially_received" : "pending";
      db.prepare("UPDATE purchase_orders SET status = ? WHERE id = ?").run(nextStatus, req.params.id);

      if (order.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(
          total,
          order.supplier_id,
        );
      }
      return db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
    })();

    req.audit("update", "purchaseOrders", { id: req.params.id }, `📦 تم استلام أمر شراء`);
    res.json({ success: true, data: received });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
