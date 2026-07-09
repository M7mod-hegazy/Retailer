const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/", requirePagePermission("purchase_orders", "view"), (req, res) => {
  const db = getDb();
  const { search = "", status, date_from, date_to } = req.query;
  const conditions = ["1=1"];
  const params = [];
  if (search) {
    const like = `%${search}%`;
    // Match order number, supplier, or any line's item name / code / barcode.
    conditions.push(`(
      s.name LIKE ?
      OR CAST(po.id AS TEXT) LIKE ?
      OR po.doc_no LIKE ?
      OR EXISTS (
        SELECT 1 FROM purchase_order_lines pol
        LEFT JOIN items i ON i.id = pol.item_id
        WHERE pol.purchase_order_id = po.id
          AND (i.name LIKE ? OR i.code LIKE ? OR i.barcode LIKE ?)
      )
    )`);
    params.push(like, like, like, like, like, like);
  }
  if (status === "open") {
    conditions.push("po.status IN ('pending','approved','partially_received')");
  } else if (status) {
    conditions.push("po.status = ?");
    params.push(status);
  }
  if (date_from) { conditions.push("date(po.created_at) >= date(?)"); params.push(date_from); }
  if (date_to)   { conditions.push("date(po.created_at) <= date(?)"); params.push(date_to); }
  const orders = db.prepare(`
    SELECT po.*, s.name AS supplier_name, u.full_name AS created_by_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN users u ON u.id = po.created_by
    WHERE ${conditions.join(" AND ")}
    ORDER BY po.id DESC
  `).all(...params);

  // When searching, attach the matching line(s) (name + code + qty) for the UI to surface.
  if (search && orders.length) {
    const like = `%${search}%`;
    const ids = orders.map((o) => o.id);
    const placeholders = ids.map(() => "?").join(",");
    const matched = db.prepare(`
      SELECT pol.purchase_order_id AS po_id, i.name AS item_name,
             i.code AS item_code, i.barcode AS barcode, pol.quantity AS quantity
      FROM purchase_order_lines pol
      LEFT JOIN items i ON i.id = pol.item_id
      WHERE pol.purchase_order_id IN (${placeholders})
        AND (i.name LIKE ? OR i.code LIKE ? OR i.barcode LIKE ?)
      ORDER BY pol.id ASC
    `).all(...ids, like, like, like);
    const byOrder = {};
    for (const m of matched) {
      (byOrder[m.po_id] = byOrder[m.po_id] || []).push({
        name: m.item_name,
        code: m.item_code || m.barcode || "",
        quantity: m.quantity,
      });
    }
    for (const o of orders) o.matched_lines = byOrder[o.id] || [];
  }
  res.json({ success: true, data: orders });
});

router.get("/:id", requirePagePermission("purchase_orders", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const order = db.prepare(`
      SELECT po.*, s.name AS supplier_name, u.full_name AS created_by_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = po.created_by
      WHERE po.id = ?
    `).get(req.params.id);
    if (!order) {
      const error = new Error("Purchase order not found");
      error.status = 404;
      throw error;
    }
    const lines = db
      .prepare(
        `SELECT pol.*, i.name AS item_name, i.code AS item_code, u.name AS unit_name, w.name AS warehouse_name
         FROM purchase_order_lines pol
         LEFT JOIN items i ON i.id = pol.item_id
         LEFT JOIN units u ON u.id = pol.unit_id
         LEFT JOIN warehouses w ON w.id = pol.warehouse_id
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
  const clientDocNo = typeof payload.doc_no === "string" ? payload.doc_no.trim() : "";
  const docNo = clientDocNo || generateDocNumber('purchase_order');
  const result = db
    .prepare("INSERT INTO purchase_orders (doc_no, supplier_id, warehouse_id, status, notes, discount, increase, created_by) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)")
    .run(docNo, payload.supplier_id || null, payload.warehouse_id || null, payload.notes || null, Math.max(0, Number(payload.discount || 0)), Math.max(0, Number(payload.increase || 0)), req.user?.id || null);

  for (const line of payload.lines || []) {
    db.prepare(
      "INSERT INTO purchase_order_lines (purchase_order_id, item_id, quantity, unit_cost, selling_price, wholesale_price, unit_id, warehouse_id, received_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
    ).run(
      result.lastInsertRowid, line.item_id, Number(line.quantity), Number(line.unit_cost || 0),
      Number(line.selling_price || 0), Number(line.wholesale_price || 0),
      line.unit_id || null, line.warehouse_id || null,
    );
  }

  try {
    const orderId = result.lastInsertRowid;
    const supplier = payload.supplier_id
      ? db.prepare("SELECT name FROM suppliers WHERE id = ?").get(payload.supplier_id)
      : null;
    const total = (payload.lines || []).reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0)
      - Math.max(0, Number(payload.discount || 0))
      + Math.max(0, Number(payload.increase || 0));
    notifyOwner(TG.PURCHASE_CREATED, {
      id: orderId,
      reference: docNo,
      kind: "order",
      supplierName: supplier?.name,
      total: Math.max(0, total),
    });
  } catch (_) {}
  req.audit("create", "purchaseOrders", { id: result.lastInsertRowid }, `📦 تم إنشاء أمر شراء`);
  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(result.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("purchase_orders", "edit"), (req, res, next) => {
  const db = getDb();
  try {
    const updated = db.transaction(() => {
      const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
      if (!order) { const e = new Error("أمر التوريد غير موجود"); e.status = 404; throw e; }
      // Editing is only safe before any receiving has happened.
      if (order.status === "received" || order.status === "partially_received") {
        const e = new Error("لا يمكن تعديل أمر توريد تم استلامه (كلياً أو جزئياً)"); e.status = 400; throw e;
      }
      if (order.status === "cancelled") {
        const e = new Error("لا يمكن تعديل أمر توريد ملغى"); e.status = 400; throw e;
      }
      const payload = req.body || {};
      db.prepare("UPDATE purchase_orders SET supplier_id = ?, warehouse_id = ?, notes = ?, discount = ?, increase = ? WHERE id = ?")
        .run(payload.supplier_id || null, payload.warehouse_id || null, payload.notes || null, Math.max(0, Number(payload.discount || 0)), Math.max(0, Number(payload.increase || 0)), req.params.id);
      // No received quantities exist → safe to fully replace lines.
      db.prepare("DELETE FROM purchase_order_lines WHERE purchase_order_id = ?").run(req.params.id);
      for (const line of payload.lines || []) {
        db.prepare(
          "INSERT INTO purchase_order_lines (purchase_order_id, item_id, quantity, unit_cost, selling_price, wholesale_price, unit_id, warehouse_id, received_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
        ).run(
          req.params.id, line.item_id, Number(line.quantity), Number(line.unit_cost || 0),
          Number(line.selling_price || 0), Number(line.wholesale_price || 0),
          line.unit_id || null, line.warehouse_id || null,
        );
      }
      return db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
    })();
    req.audit("update", "purchaseOrders", { id: req.params.id }, `📦 تم تعديل أمر شراء`);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
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

// NOTE: Receiving a purchase order no longer happens here. The PO list "convert
// to invoice" action routes to the Purchases invoice page, and POST /api/purchases
// (when carrying source_purchase_order_id + per-line purchase_order_line_id)
// advances the PO's received quantities/status inside that single transaction.

module.exports = router;
