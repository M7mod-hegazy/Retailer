const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { featureGate } = require("../utils/features");

const router = express.Router();
router.use(authRequired);
router.use(featureGate("feature_repair_orders"));
router.use(auditMutation);

function nextOrderNumber(db) {
  const prefix = db.prepare("SELECT work_order_prefix FROM settings WHERE id = 1").get()?.work_order_prefix || "WO-";
  const last = db.prepare("SELECT order_number FROM repair_orders ORDER BY id DESC LIMIT 1").get();
  const lastNum = last ? parseInt(last.order_number.replace(prefix, ""), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(5, "0")}`;
}

function getOrder(db, id) {
  const order = db.prepare("SELECT * FROM repair_orders WHERE id = ?").get(id);
  if (!order) return null;
  order.parts = db.prepare("SELECT * FROM repair_order_parts WHERE repair_order_id = ? ORDER BY id").all(id);
  order.labor = db.prepare("SELECT * FROM repair_order_labor WHERE repair_order_id = ? ORDER BY id").all(id);
  order.status_log = db.prepare("SELECT rsl.*, u.full_name as changed_by_name FROM repair_order_status_log rsl LEFT JOIN users u ON u.id = rsl.changed_by WHERE rsl.repair_order_id = ? ORDER BY rsl.id").all(id);
  return order;
}

// List
router.get("/", requirePagePermission("repair_orders", "view"), (req, res) => {
  const db = getDb();
  const search = String(req.query.search || "").trim();
  const status = req.query.status || null;
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  let where = "WHERE 1=1";
  const params = [];
  if (search) {
    where += " AND (ro.order_number LIKE ? OR ro.device_model LIKE ? OR ro.serial_number LIKE ? OR c.name LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (status) { where += " AND ro.status = ?"; params.push(status); }

  const rows = db.prepare(`
    SELECT ro.*, c.name as customer_name, c.phone as customer_phone
    FROM repair_orders ro
    LEFT JOIN customers c ON c.id = ro.customer_id
    ${where}
    ORDER BY ro.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM repair_orders ro LEFT JOIN customers c ON c.id = ro.customer_id ${where}`).get(...params).cnt;
  res.json({ success: true, data: rows, meta: { total, limit, offset } });
});

// Get one
router.get("/:id", requirePagePermission("repair_orders", "view"), (req, res) => {
  const order = getOrder(getDb(), Number(req.params.id));
  if (!order) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: order });
});

// Create
router.post("/", requirePagePermission("repair_orders", "add"), (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.reported_issue) return res.status(400).json({ success: false, message: "reported_issue is required" });

  const id = db.prepare(`
    INSERT INTO repair_orders (order_number, customer_id, device_type, device_brand, device_model, serial_number,
      reported_issue, priority, estimated_cost, deposit_amount, notes, estimated_delivery, branch_id, created_by,
      warranty_days, received_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    nextOrderNumber(db),
    b.customer_id || null, b.device_type || null, b.device_brand || null,
    b.device_model || null, b.serial_number || null, b.reported_issue,
    b.priority || "normal",
    Number(b.estimated_cost || 0), Number(b.deposit_amount || 0),
    b.notes || null, b.estimated_delivery || null,
    b.branch_id || null, req.user?.id || null,
    Number(b.warranty_days || 0),
    b.received_at || new Date().toISOString(),
  ).lastInsertRowid;

  // Log initial status
  db.prepare("INSERT INTO repair_order_status_log (repair_order_id, to_status, changed_by) VALUES (?,?,?)").run(id, "received", req.user?.id || null);

  // Record deposit payment if provided
  if (Number(b.deposit_amount || 0) > 0 && b.treasury_id) {
    const payId = db.prepare(`
      INSERT INTO payments (party_type, party_id, amount, method, treasury_id, notes, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,datetime('now'))
    `).run("repair_order", id, Number(b.deposit_amount), b.payment_method || "cash", Number(b.treasury_id), `دفعة أولى — طلب صيانة #${id}`, req.user?.id || null).lastInsertRowid;
    // Update repair_order_id link
    try { db.prepare("UPDATE payments SET repair_order_id = ? WHERE id = ?").run(id, payId); } catch {}
  }

  req.audit("add", "repair_orders", { id }, `تم استلام جهاز للصيانة — رقم الطلب: ${id}`);
  res.status(201).json({ success: true, data: getOrder(db, id) });
});

// Update (general fields)
router.put("/:id", requirePagePermission("repair_orders", "edit"), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM repair_orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ success: false, message: "Not found" });

  const b = req.body || {};
  db.prepare(`
    UPDATE repair_orders SET
      customer_id=?, device_type=?, device_brand=?, device_model=?, serial_number=?,
      reported_issue=?, diagnosis=?, priority=?, assigned_to=?,
      estimated_cost=?, final_cost=?, notes=?, estimated_delivery=?, warranty_days=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    b.customer_id ?? order.customer_id, b.device_type ?? order.device_type,
    b.device_brand ?? order.device_brand, b.device_model ?? order.device_model,
    b.serial_number ?? order.serial_number, b.reported_issue ?? order.reported_issue,
    b.diagnosis ?? order.diagnosis, b.priority ?? order.priority,
    b.assigned_to ?? order.assigned_to,
    Number(b.estimated_cost ?? order.estimated_cost), Number(b.final_cost ?? order.final_cost),
    b.notes ?? order.notes, b.estimated_delivery ?? order.estimated_delivery,
    Number(b.warranty_days ?? order.warranty_days), id,
  );

  req.audit("edit", "repair_orders", { id }, `تعديل طلب صيانة #${id}`);
  res.json({ success: true, data: getOrder(db, id) });
});

// Update status
router.patch("/:id/status", requirePagePermission("repair_orders", "edit"), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM repair_orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ success: false, message: "Not found" });

  const { status, note } = req.body || {};
  const validStatuses = ["received", "diagnosing", "waiting_parts", "in_repair", "waiting_customer", "ready", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

  db.prepare("UPDATE repair_orders SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id);
  if (status === "delivered") {
    db.prepare("UPDATE repair_orders SET delivered_at=datetime('now') WHERE id=?").run(id);
  }
  db.prepare("INSERT INTO repair_order_status_log (repair_order_id, from_status, to_status, changed_by, note) VALUES (?,?,?,?,?)").run(id, order.status, status, req.user?.id || null, note || null);

  req.audit("edit", "repair_orders", { id, status }, `تغيير حالة طلب صيانة #${id} إلى ${status}`);
  res.json({ success: true, data: getOrder(db, id) });
});

// Add part
router.post("/:id/parts", requirePagePermission("repair_orders", "edit"), (req, res) => {
  const db = getDb();
  const orderId = Number(req.params.id);
  const b = req.body || {};
  if (!b.part_name) return res.status(400).json({ success: false, message: "part_name is required" });

  const partId = db.prepare("INSERT INTO repair_order_parts (repair_order_id, item_id, part_name, quantity, unit_cost) VALUES (?,?,?,?,?)").run(
    orderId, b.item_id || null, b.part_name, Number(b.quantity || 1), Number(b.unit_cost || 0),
  ).lastInsertRowid;

  // Deduct from stock if item_id and warehouse_id provided
  if (b.item_id && b.warehouse_id) {
    try {
      db.prepare("UPDATE stock SET quantity = quantity - ? WHERE item_id = ? AND warehouse_id = ?").run(
        Number(b.quantity || 1), Number(b.item_id), Number(b.warehouse_id),
      );
    } catch {}
  }

  res.status(201).json({ success: true, data: db.prepare("SELECT * FROM repair_order_parts WHERE id = ?").get(partId) });
});

// Delete part
router.delete("/:id/parts/:partId", requirePagePermission("repair_orders", "edit"), (req, res) => {
  getDb().prepare("DELETE FROM repair_order_parts WHERE id = ? AND repair_order_id = ?").run(Number(req.params.partId), Number(req.params.id));
  res.json({ success: true });
});

// Add labor
router.post("/:id/labor", requirePagePermission("repair_orders", "edit"), (req, res) => {
  const db = getDb();
  const orderId = Number(req.params.id);
  const b = req.body || {};
  if (!b.description) return res.status(400).json({ success: false, message: "description is required" });

  const laborId = db.prepare("INSERT INTO repair_order_labor (repair_order_id, description, amount) VALUES (?,?,?)").run(
    orderId, b.description, Number(b.amount || 0),
  ).lastInsertRowid;

  res.status(201).json({ success: true, data: db.prepare("SELECT * FROM repair_order_labor WHERE id = ?").get(laborId) });
});

// Delete labor
router.delete("/:id/labor/:laborId", requirePagePermission("repair_orders", "edit"), (req, res) => {
  getDb().prepare("DELETE FROM repair_order_labor WHERE id = ? AND repair_order_id = ?").run(Number(req.params.laborId), Number(req.params.id));
  res.json({ success: true });
});

// Convert to invoice (deliver)
router.post("/:id/deliver", requirePagePermission("repair_orders", "edit"), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const order = getOrder(db, id);
  if (!order) return res.status(404).json({ success: false, message: "Not found" });
  if (order.invoice_id) return res.status(400).json({ success: false, message: "Already invoiced" });

  const b = req.body || {};
  const customerId = order.customer_id;
  const partsTotal = order.parts.reduce((s, p) => s + p.quantity * p.unit_cost, 0);
  const laborTotal = order.labor.reduce((s, l) => s + l.amount, 0);
  const finalCost = Number(b.final_cost ?? order.final_cost ?? (partsTotal + laborTotal));
  const depositPaid = Number(order.deposit_amount || 0);
  const remaining = Math.max(0, finalCost - depositPaid);

  const tx = db.transaction(() => {
    // Create invoice header
    const invoiceNum = db.prepare("SELECT COALESCE(MAX(CAST(REPLACE(invoice_number, 'INV-', '') AS INTEGER)), 0) + 1 AS n FROM invoices").get().n;
    const invId = db.prepare(`
      INSERT INTO invoices (invoice_number, customer_id, invoice_type, status, subtotal, discount, tax, total, notes, created_by, branch_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
    `).run(
      `INV-${String(invoiceNum).padStart(5, "0")}`,
      customerId || null, "sale", "paid",
      finalCost, 0, 0, finalCost,
      `طلب صيانة #${order.order_number}`,
      req.user?.id || null,
      order.branch_id || null,
    ).lastInsertRowid;

    // Invoice line: repair service charge
    db.prepare(`
      INSERT INTO invoice_lines (invoice_id, item_id, item_name, quantity, unit_price, discount, total)
      VALUES (?,NULL,?,1,?,0,?)
    `).run(invId, `صيانة — ${order.device_brand || ""} ${order.device_model || ""}`.trim(), finalCost, finalCost);

    // Update repair order
    db.prepare("UPDATE repair_orders SET invoice_id=?, final_cost=?, status='delivered', delivered_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(invId, finalCost, id);
    db.prepare("INSERT INTO repair_order_status_log (repair_order_id, from_status, to_status, changed_by, note) VALUES (?,?,?,?,?)").run(id, order.status, "delivered", req.user?.id || null, "فاتورة تسليم");

    return invId;
  });

  const invoiceId = tx();
  req.audit("add", "invoices", { invoiceId, repairOrderId: id }, `تسليم طلب صيانة #${order.order_number} وإنشاء فاتورة`);
  res.json({ success: true, data: { invoice_id: invoiceId, remaining_amount: remaining } });
});

// Delete (cancel only — soft)
router.delete("/:id", requirePagePermission("repair_orders", "delete"), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  db.prepare("UPDATE repair_orders SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(id);
  req.audit("delete", "repair_orders", { id }, `إلغاء طلب صيانة #${id}`);
  res.json({ success: true });
});

module.exports = router;
