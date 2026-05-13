const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

router.get("/categories", requirePagePermission("expenses", "view"), (_req, res) => {
  res.json({ success: true, data: getDb().prepare("SELECT * FROM expense_categories ORDER BY name ASC").all() });
});

router.post("/categories", requirePagePermission("expenses", "add"), (req, res) => {
  const payload = req.body || {};
  try {
    const result = getDb()
      .prepare("INSERT INTO expense_categories (name, parent_id) VALUES (?, ?)")
      .run(payload.name, payload.parent_id || null);
    res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM expense_categories WHERE id = ?").get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/categories/:id", requirePagePermission("expenses", "edit"), (req, res) => {
  const payload = req.body || {};
  try {
    getDb().prepare("UPDATE expense_categories SET name = ?, parent_id = ? WHERE id = ?").run(payload.name, payload.parent_id || null, req.params.id);
    res.json({ success: true, data: getDb().prepare("SELECT * FROM expense_categories WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/categories/:id", requirePagePermission("expenses", "delete"), (req, res) => {
  getDb().prepare("DELETE FROM expense_categories WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.get("/", requirePagePermission("expenses", "view"), (req, res) => {
  const { date_from, date_to, category_id, search = "" } = req.query;
  const db = getDb();
  const conds = ["1=1"];
  const params = [];
  if (date_from) { conds.push("date(e.created_at) >= date(?)"); params.push(date_from); }
  if (date_to) { conds.push("date(e.created_at) <= date(?)"); params.push(date_to); }
  if (category_id) { conds.push("e.category_id = ?"); params.push(category_id); }
  if (search) { conds.push("(e.description LIKE ? OR e.notes LIKE ? OR c.name LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  res.json({
    success: true,
    data: db.prepare(`SELECT e.*, c.name AS category_name FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id WHERE ${conds.join(" AND ")} ORDER BY e.id DESC LIMIT 500`).all(...params),
  });
});

router.post("/", requirePagePermission("expenses", "add"), (req, res) => {
  const payload = req.body || {};
  const db = getDb();
  const result = db
    .transaction(() => {
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      const docNo = generateDocNumber('expense');
      const created = db
        .prepare(
          `INSERT INTO expenses
           (doc_no, amount, category_id, notes, description, payment_method, employee_id, receipt_image, is_recurring, recurring_frequency, treasury_id, bank_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          docNo,
          Number(payload.amount || 0),
          payload.category_id || null,
          payload.notes || null,
          payload.description || null,
          payload.payment_method || "cash",
          payload.employee_id || null,
          payload.receipt_image || null,
          payload.is_recurring ? 1 : 0,
          payload.recurring_frequency || null,
          payload.bank_id || null,
          `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
        );
      const amount = Number(payload.amount || 0);
      if ((payload.payment_method || "cash") === "cash") {
        db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = 1").run(amount);
      }
      if ((payload.payment_method || "cash") === "bank_transfer" && payload.bank_id) {
        db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(amount, payload.bank_id);
      }
      return created;
    })();

  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM expenses WHERE id = ?").get(result.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("expenses", "edit"), (req, res) => {
  try {
    const db = getDb();
    const payload = req.body || {};
    db.prepare(`UPDATE expenses SET amount = COALESCE(?, amount), category_id = COALESCE(?, category_id), notes = COALESCE(?, notes), description = COALESCE(?, description), payment_method = COALESCE(?, payment_method), updated_at = datetime('now') WHERE id = ?`)
      .run(payload.amount != null ? Number(payload.amount) : null, payload.category_id || null, payload.notes || null, payload.description || null, payload.payment_method || null, req.params.id);
    res.json({ success: true, data: db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", requirePagePermission("expenses", "delete"), (req, res) => {
  try {
    getDb().prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
