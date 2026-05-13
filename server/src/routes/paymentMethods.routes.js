const express = require("express");
const { requirePagePermission } = require("../middleware/permission");
const router = express.Router();
const { getDb } = require("../config/database");
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

router.get("/", requirePagePermission("payment_methods", "view"), (_req, res) => {
  try {
    const db = getDb();
    let rows = db.prepare("SELECT * FROM payment_methods ORDER BY id ASC").all();
    const monthStart = new Date();
    monthStart.setDate(1);
    const from = monthStart.toISOString().slice(0, 10);
    const stats = {};

    try {
      db.prepare(`
        SELECT payment_method_id, COUNT(*) AS monthly_count, COALESCE(SUM(amount), 0) AS monthly_total
        FROM ajal_payments
        WHERE payment_method_id IS NOT NULL AND date(payment_date) >= ?
        GROUP BY payment_method_id
      `).all(from).forEach((row) => {
        stats[row.payment_method_id] = {
          monthly_count: Number(row.monthly_count || 0),
          monthly_total: Number(row.monthly_total || 0),
        };
      });
    } catch (_) {}

    try {
      db.prepare(`
        SELECT pm.id AS payment_method_id, COUNT(p.id) AS monthly_count, COALESCE(SUM(p.amount), 0) AS monthly_total
        FROM payments p
        JOIN payment_methods pm ON pm.type = p.method OR pm.category = p.method OR pm.name = p.method
        WHERE date(p.created_at) >= ?
        GROUP BY pm.id
      `).all(from).forEach((row) => {
        const current = stats[row.payment_method_id] || { monthly_count: 0, monthly_total: 0 };
        stats[row.payment_method_id] = {
          monthly_count: current.monthly_count + Number(row.monthly_count || 0),
          monthly_total: current.monthly_total + Number(row.monthly_total || 0),
        };
      });
    } catch (_) {}

    rows = rows.map((method) => ({
      ...method,
      monthly_count: stats[method.id]?.monthly_count || 0,
      monthly_total: stats[method.id]?.monthly_total || 0,
    }));
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/transactions", requirePagePermission("payment_methods", "view"), (req, res) => {
  try {
    const db = getDb();
    const { from, to, method_id, type, search } = req.query;
    const filters = [];
    const params = [];

    if (from) { filters.push("date(created_at) >= ?"); params.push(from); }
    if (to) { filters.push("date(created_at) <= ?"); params.push(to); }
    if (method_id) { filters.push("method_id = ?"); params.push(Number(method_id)); }
    if (type) { filters.push("direction = ?"); params.push(type); }
    if (search) {
      filters.push("(COALESCE(doc_no, '') LIKE ? OR COALESCE(party, '') LIKE ? OR COALESCE(description, '') LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT *
      FROM (
        SELECT
          p.id,
          COALESCE(p.reference_number, '#' || p.id) AS doc_no,
          'payment' AS doc_type,
          p.amount,
          CASE WHEN p.party_type = 'supplier' THEN 'out' ELSE 'in' END AS direction,
          COALESCE(c.name, s.name) AS party,
          p.notes AS description,
          p.created_at,
          pm.name AS method_name,
          pm.id AS method_id
        FROM payments p
        LEFT JOIN customers c ON p.party_type = 'customer' AND c.id = p.party_id
        LEFT JOIN suppliers s ON p.party_type = 'supplier' AND s.id = p.party_id
        LEFT JOIN payment_methods pm ON pm.type = p.method OR pm.category = p.method OR pm.name = p.method

        UNION ALL

        SELECT
          ap.id,
          'AJAL-' || ap.debt_id AS doc_no,
          'ajal_payment' AS doc_type,
          ap.amount,
          CASE WHEN COALESCE(d.party_type, 'customer') = 'supplier' THEN 'out' ELSE 'in' END AS direction,
          COALESCE(c.name, s.name) AS party,
          ap.notes AS description,
          COALESCE(ap.payment_date, ap.created_at) AS created_at,
          pm.name AS method_name,
          pm.id AS method_id
        FROM ajal_payments ap
        LEFT JOIN ajal_debts d ON d.id = ap.debt_id
        LEFT JOIN customers c ON c.id = d.customer_id
        LEFT JOIN suppliers s ON s.id = d.supplier_id
        LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id

        UNION ALL

        SELECT
          i.id,
          i.invoice_no AS doc_no,
          'pos_invoice' AS doc_type,
          i.total AS amount,
          'in' AS direction,
          COALESCE(c.name, 'زبون نقدي') AS party,
          i.payment_type AS description,
          i.created_at,
          pm.name AS method_name,
          pm.id AS method_id
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN payment_methods pm ON pm.type = i.payment_type OR pm.category = i.payment_type OR pm.name = i.payment_type
        WHERE i.status != 'cancelled'

        UNION ALL

        SELECT
          e.id,
          e.doc_no,
          'expense' AS doc_type,
          e.amount,
          'out' AS direction,
          ec.name AS party,
          e.description,
          e.created_at,
          pm.name AS method_name,
          pm.id AS method_id
        FROM expenses e
        LEFT JOIN expense_categories ec ON ec.id = e.category_id
        LEFT JOIN payment_methods pm ON pm.type = e.payment_method OR pm.category = e.payment_method OR pm.name = e.payment_method
      ) tx
      ${where}
      ORDER BY created_at DESC
      LIMIT 500
    `).all(...params);

    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/", requirePagePermission("payment_methods", "add"), (req, res) => {
  try {
    const db = getDb();
    const { name, category = "digital_wallet", icon = "💳", description = "", excludes_from_treasury = 1 } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: "الاسم مطلوب" });
    const result = db.prepare(
      "INSERT INTO payment_methods (name, category, icon, description, is_system, excludes_from_treasury, type) VALUES (?, ?, ?, ?, 0, ?, ?)"
    ).run(name, category, icon, description, excludes_from_treasury ? 1 : 0, category);
    const created = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/:id", requirePagePermission("payment_methods", "edit"), (req, res) => {
  try {
    const db = getDb();
    const method = db.prepare("SELECT is_system FROM payment_methods WHERE id = ?").get(req.params.id);
    if (!method) return res.status(404).json({ success: false, message: "وسيلة الدفع غير موجودة" });
    const { name, category, icon, description, excludes_from_treasury } = req.body || {};
    db.prepare(
      "UPDATE payment_methods SET name = COALESCE(?, name), category = COALESCE(?, category), icon = COALESCE(?, icon), description = COALESCE(?, description), excludes_from_treasury = COALESCE(?, excludes_from_treasury) WHERE id = ?"
    ).run(method.is_system ? undefined : name, category, icon, description, excludes_from_treasury != null ? (excludes_from_treasury ? 1 : 0) : undefined, req.params.id);
    res.json({ success: true, data: db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", requirePagePermission("payment_methods", "delete"), (req, res) => {
  try {
    const db = getDb();
    const method = db.prepare("SELECT is_system, name FROM payment_methods WHERE id = ?").get(req.params.id);
    if (!method) return res.status(404).json({ success: false, message: "وسيلة الدفع غير موجودة" });
    if (method.is_system) return res.status(403).json({ success: false, message: `لا يمكن حذف "${method.name}" — وسيلة دفع محمية من النظام` });
    db.prepare("DELETE FROM payment_methods WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
