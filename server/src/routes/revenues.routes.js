const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/categories", requirePagePermission("revenues", "view"), (_req, res) => {
  res.json({ success: true, data: getDb().prepare("SELECT * FROM revenue_categories ORDER BY name ASC").all() });
});

router.post("/categories", requirePagePermission("revenues", "add"), (req, res) => {
  const payload = req.body || {};
  const result = getDb()
    .prepare("INSERT INTO revenue_categories (name, parent_id) VALUES (?, ?)")
    .run(payload.name, payload.parent_id || null);
  req.audit("create", "revenueCategories", { id: result.lastInsertRowid }, `💰 تم إضافة فئة إيراد: ${payload.name || ''}`);
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM revenue_categories WHERE id = ?").get(result.lastInsertRowid),
  });
});

router.put("/categories/:id", requirePagePermission("revenues", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb().prepare("UPDATE revenue_categories SET name = ?, parent_id = ? WHERE id = ?").run(
    payload.name,
    payload.parent_id || null,
    req.params.id,
  );
  req.audit("update", "revenueCategories", { id: req.params.id }, `💰 تم تعديل فئة إيراد: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM revenue_categories WHERE id = ?").get(req.params.id) });
});

router.delete("/categories/:id", requirePagePermission("revenues", "delete"), (req, res) => {
  getDb().prepare("DELETE FROM revenue_categories WHERE id = ?").run(req.params.id);
  req.audit("delete", "revenueCategories", { id: req.params.id }, `💰 تم حذف فئة إيراد`);
  res.json({ success: true });
});

router.get("/", requirePagePermission("revenues", "view"), (req, res) => {
  const { date_from, date_to, category_id, search = "" } = req.query;
  const db = getDb();
  const conds = ["1=1"];
  const params = [];
  if (date_from) { conds.push("date(r.created_at) >= date(?)"); params.push(date_from); }
  if (date_to) { conds.push("date(r.created_at) <= date(?)"); params.push(date_to); }
  if (category_id) { conds.push("r.category_id = ?"); params.push(category_id); }
  if (search) { conds.push("(r.description LIKE ? OR r.notes LIKE ? OR c.name LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  res.json({
    success: true,
    data: db.prepare(`SELECT r.*, c.name AS category_name FROM revenues r LEFT JOIN revenue_categories c ON c.id = r.category_id WHERE ${conds.join(" AND ")} ORDER BY r.id DESC LIMIT 500`).all(...params),
  });
});

router.post("/", requirePagePermission("revenues", "add"), (req, res) => {
  const payload = req.body || {};
  const db = getDb();
  const result = db
    .transaction(() => {
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      const docNo = generateDocNumber('revenue');
      const created = db
        .prepare(
          `INSERT INTO revenues
           (doc_no, amount, category_id, notes, description, payment_method, treasury_id, bank_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          docNo,
          Number(payload.amount || 0),
          payload.category_id || null,
          payload.notes || null,
          payload.description || null,
          payload.payment_method || "cash",
          payload.treasury_id || null,
          payload.bank_id || null,
          `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
        );
      const amount = Number(payload.amount || 0);
      if ((payload.payment_method || "cash") === "cash") {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = 1").run(amount);
      }
      if ((payload.payment_method || "cash") === "bank_transfer" && payload.bank_id) {
        db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(amount, payload.bank_id);
      }
      return created;
    })();

  req.audit("create", "revenues", { id: result.lastInsertRowid }, `💰 تم إضافة إيراد بمبلغ ${Number(payload.amount || 0).toLocaleString('ar-EG')}${payload.description || payload.notes ? ` — ${payload.description || payload.notes}` : ''}`);
  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM revenues WHERE id = ?").get(result.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("revenues", "edit"), (req, res) => {
  try {
    const db = getDb();
    const payload = req.body || {};
    db.prepare(`UPDATE revenues SET amount = COALESCE(?, amount), category_id = COALESCE(?, category_id), notes = COALESCE(?, notes), description = COALESCE(?, description), payment_method = COALESCE(?, payment_method), updated_at = datetime('now') WHERE id = ?`)
      .run(payload.amount != null ? Number(payload.amount) : null, payload.category_id || null, payload.notes || null, payload.description || null, payload.payment_method || null, req.params.id);
    req.audit("update", "revenues", { id: req.params.id }, `💰 تم تعديل إيراد #${req.params.id}${payload.amount != null ? ` — المبلغ: ${Number(payload.amount).toLocaleString('ar-EG')}` : ''}`);
    res.json({ success: true, data: db.prepare("SELECT * FROM revenues WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", requirePagePermission("revenues", "delete"), (req, res) => {
  try {
    getDb().prepare("DELETE FROM revenues WHERE id = ?").run(req.params.id);
    req.audit("delete", "revenues", { id: req.params.id }, `💰 تم حذف إيراد`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
