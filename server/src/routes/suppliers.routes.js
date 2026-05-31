const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function ensureNotesSchema(db) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS supplier_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    )`);
  } catch (_) {}
  try { db.exec("ALTER TABLE supplier_notes ADD COLUMN type TEXT DEFAULT 'note'"); } catch (_) {}
  try { db.exec("ALTER TABLE supplier_notes ADD COLUMN amount REAL"); } catch (_) {}
}

router.get("/balance-summary", requirePagePermission("suppliers", "view"), (req, res) => {
  try {
    const row = getDb().prepare(
      "SELECT COALESCE(SUM(opening_balance), 0) AS net_balance FROM suppliers WHERE is_active = 1 OR is_active IS NULL"
    ).get();
    res.json({ success: true, data: { net_balance: row.net_balance } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/", requirePagePermission("suppliers", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const search = String(req.query.search || "").trim();
  const limit = req.query.limit ? Math.min(Math.max(Number(req.query.limit), 1), 500) : null;
  const offset = req.query.offset ? Math.max(Number(req.query.offset), 0) : 0;
  const params = [];
  const clauses = [showArchived ? "is_active = 0" : "(is_active = 1 OR is_active IS NULL)"];

  if (search) {
    clauses.push("(name LIKE ? OR phone LIKE ? OR code LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = `WHERE ${clauses.join(" AND ")}`;
  let query = `SELECT * FROM suppliers ${where} ORDER BY id DESC`;
  const total = limit
    ? getDb().prepare(`SELECT COUNT(*) AS total FROM suppliers ${where}`).get(...params).total
    : null;

  if (limit) {
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);
  }

  const rows = getDb().prepare(query).all(...params);
  res.json({ success: true, data: rows, meta: { offset, limit, count: rows.length, total: total ?? rows.length } });
});

router.post("/", requirePagePermission("suppliers", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare(
      `INSERT INTO suppliers
       (name, phone, additional_phones, addresses, code, opening_balance, base_opening_balance, payment_terms, bank_details, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.additional_phones || null,
      payload.addresses || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      Number(payload.opening_balance || 0),
      payload.payment_terms || null,
      payload.bank_details || null,
      payload.is_active === false ? 0 : 1,
    );
  req.audit("create", "suppliers", { id: info.lastInsertRowid }, `👤 تم إضافة مورد: ${payload.name || ''}`, `/definitions/suppliers/${info.lastInsertRowid}`);
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("suppliers", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare(
      `UPDATE suppliers
       SET name = ?, phone = ?, additional_phones = ?, addresses = ?, code = ?, opening_balance = ?, payment_terms = ?, bank_details = ?, is_active = ?
       WHERE id = ?`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.additional_phones || null,
      payload.addresses || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      payload.payment_terms || null,
      payload.bank_details || null,
      payload.is_active === false ? 0 : 1,
      req.params.id,
    );
  req.audit("update", "suppliers", { id: req.params.id }, `👤 تم تعديل مورد: ${payload.name || ''}`, `/definitions/suppliers/${req.params.id}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requirePagePermission("suppliers", "delete"), (req, res) => {
  try {
    const db = getDb();
    
    // Check for related records (purchases)
    const purchaseCount = db.prepare("SELECT COUNT(*) AS c FROM purchases WHERE supplier_id = ?").get(req.params.id);
    const purchaseOrderCount = db.prepare("SELECT COUNT(*) AS c FROM purchase_orders WHERE supplier_id = ?").get(req.params.id);
    
    const hasTransactions = 
      Number(purchaseCount?.c || 0) > 0 ||
      Number(purchaseOrderCount?.c || 0) > 0;
    
    if (hasTransactions) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE suppliers SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "suppliers", { id: req.params.id }, `👤 تم أرشفة مورد`, `/definitions/suppliers/${req.params.id}`);
      return res.json({ success: true, archived: true, message: "تم أرشفة المورد لأنه مرتبط بفواتير مشتريات" });
    }

    // Hard delete if no transactions
    db.prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
    req.audit("delete", "suppliers", { id: req.params.id }, `👤 تم حذف مورد`, `/definitions/suppliers`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف المورد لأنه مرتبط ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

router.get("/:id", requirePagePermission("suppliers", "view"), (req, res) => {
  const supplier = getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id);
  if (!supplier) return res.status(404).json({ success: false, message: "المورد غير موجود" });
  res.json({ success: true, data: supplier });
});

router.post("/:id/adjust", requirePagePermission("suppliers", "add"), (req, res) => {
  const { amount, reason, direction } = req.body || {};
  const delta = direction === 'subtract' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
  try {
    const db = getDb();
    ensureNotesSchema(db);
    db.transaction(() => {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(delta, req.params.id);
      db.prepare("INSERT INTO supplier_notes (supplier_id, note, type, amount, created_by) VALUES (?, ?, 'adjustment', ?, ?)")
        .run(req.params.id, `تسوية رصيد بقيمة ${delta > 0 ? '+' : ''}${delta}: ${reason || 'بدون سبب'}`, delta, req.user?.id || null);
    })();
    res.json({ success: true, data: db.prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id) });
  } catch (e) {
    res.status(500).json({ success: false, message: "خطأ أثناء التسوية" });
  }
});

router.get("/:id/notes", requirePagePermission("suppliers", "view"), (req, res) => {
  try {
    const db = getDb();
    ensureNotesSchema(db);
    const { type } = req.query;
    const cond = type ? "WHERE n.supplier_id = ? AND COALESCE(n.type,'note') = ?" : "WHERE n.supplier_id = ?";
    const params = type ? [req.params.id, type] : [req.params.id];
    const notes = db.prepare(`SELECT n.*, u.username as user_name FROM supplier_notes n LEFT JOIN users u ON u.id = n.created_by ${cond} ORDER BY n.created_at DESC`).all(...params);
    res.json({ success: true, data: notes });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/:id/notes", requirePagePermission("suppliers", "add"), (req, res) => {
  const { note } = req.body || {};
  if (!note) return res.status(400).json({ success: false, message: "الملاحظة مطلوبة" });
  const result = getDb().prepare("INSERT INTO supplier_notes (supplier_id, note, created_by) VALUES (?, ?, ?)")
    .run(req.params.id, note, req.user?.id || null);
  const newNote = getDb().prepare("SELECT n.*, u.username as user_name FROM supplier_notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: newNote });
});

module.exports = router;
