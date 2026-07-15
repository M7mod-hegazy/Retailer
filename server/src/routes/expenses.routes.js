const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");
const { requirePagePermission, userHasPagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, buildImpact } = require("../utils/relatedRecords");
const { recordBankMovement } = require("../services/bankService");
const NotificationModel = require("../models/notification.model");
const { toSql, nowSql } = require("../utils/datetime");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/categories", requirePagePermission("expenses", "view"), (_req, res) => {
  res.json({ success: true, data: getDb().prepare("SELECT * FROM expense_categories ORDER BY name ASC").all() });
});

router.post("/categories", requirePagePermission("expenses", "add"), (req, res) => {
  const payload = req.body || {};
  try {
    const result = getDb()
      .prepare("INSERT INTO expense_categories (name, parent_id) VALUES (?, ?)")
      .run(payload.name, payload.parent_id || null);
    req.audit("create", "expenseCategories", { id: result.lastInsertRowid }, `💰 تم إضافة فئة مصروف: ${payload.name || ''}`);
    res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM expense_categories WHERE id = ?").get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/categories/:id", requirePagePermission("expenses", "edit"), (req, res) => {
  const payload = req.body || {};
  try {
    getDb().prepare("UPDATE expense_categories SET name = ?, parent_id = ? WHERE id = ?").run(payload.name, payload.parent_id || null, req.params.id);
    req.audit("update", "expenseCategories", { id: req.params.id }, `💰 تم تعديل فئة مصروف: ${payload.name || ''}`);
    res.json({ success: true, data: getDb().prepare("SELECT * FROM expense_categories WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Expense categories have no soft-delete, so a category that is in use is BLOCKED, not archived.
router.get("/categories/:id/delete-impact", requirePagePermission("expenses", "delete"), (req, res) => {
  const c = countSafe(getDb(), "SELECT COUNT(*) AS c FROM expenses WHERE category_id = ?", req.params.id);
  const inUse = c === null || Number(c) > 0;
  res.json({ success: true, data: inUse
    ? buildImpact([], { blocked: "لا يمكن حذف الفئة لأنها مرتبطة بمصروفات مسجلة" })
    : buildImpact([]) });
});

router.delete("/categories/:id", requirePagePermission("expenses", "delete"), (req, res) => {
  try {
    const c = countSafe(getDb(), "SELECT COUNT(*) AS c FROM expenses WHERE category_id = ?", req.params.id);
    if (c === null || Number(c) > 0) {
      return res.status(409).json({ success: false, message: "لا يمكن حذف الفئة لأنها مرتبطة بمصروفات مسجلة" });
    }
    getDb().prepare("DELETE FROM expense_categories WHERE id = ?").run(req.params.id);
    req.audit("delete", "expenseCategories", { id: req.params.id }, `💰 تم حذف فئة مصروف`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الفئة لأنها مرتبطة بمصروفات" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
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

router.post("/", requirePagePermission("expenses", "add"), async (req, res) => {
  const payload = req.body || {};
  const createdDate = normalizeDate(payload.created_at);
  const todayDate = toSql(new Date()).slice(0, 10);
  if (createdDate < todayDate && !userHasPagePermission(req.user, "expenses", "backdate_records")) {
    return res.status(403).json({ error: "permission_denied", page: "expenses", action: "backdate_records" });
  }
  const db = getDb();
  const result = db
    .transaction(() => {
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      const docNo = generateDocNumber('expense');
      const created = db
        .prepare(
          `INSERT INTO expenses
           (doc_no, amount, category_id, notes, description, payment_method, employee_id, receipt_image, is_recurring, recurring_frequency, treasury_id, bank_id, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
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
          `${createdDate} ${toSql(new Date()).slice(11)}`,
          req.user?.id || null,
        );
      const amount = Number(payload.amount || 0);
      // Only cash reduces the treasury drawer. Record-only methods (فيزا / محافظ
      // رقمية) are stored under their method name and move no balance.
      if ((payload.payment_method || "cash") === "cash") {
        db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = 1").run(amount);
      }
      return created;
    })();

    const expenseAuditId = req.audit("create", "expenses", { id: result.lastInsertRowid }, `💰 تم إضافة مصروف بمبلغ ${Number(payload.amount || 0).toLocaleString('en-US')} ${payload.description || payload.notes ? `— ${payload.description || payload.notes}` : ''}`.trimEnd(), `/expenses`);
  let _tgStatus = null;
  try {
    const expenseAmount = Number(payload.amount || 0);
    if (expenseAmount > 500) {
      const description = payload.description || payload.notes || '';
      NotificationModel.create({
        title: "💸 مصروف بمبلغ كبير",
        body: `مصروف بمبلغ ${expenseAmount}${description ? ' — ' + description : ''}`,
        type: "warning",
        link: expenseAuditId ? `/history?log_id=${expenseAuditId}` : `/expenses`,
      });
    }
    const categoryRow = db.prepare("SELECT name FROM expense_categories WHERE id=?").get(payload.category_id || null);
    _tgStatus = await notifyOwner(TG.EXPENSE_CREATED, {
      category: categoryRow?.name || "غير مصنف",
      amount: expenseAmount,
      date: createdDate,
      notes: payload.description || payload.notes || null,
    });
  } catch (_) {}
  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM expenses WHERE id = ?").get(result.lastInsertRowid),
    telegramStatus: _tgStatus,
  });
});

router.put("/:id", requirePagePermission("expenses", "edit"), async (req, res) => {
  try {
    const db = getDb();
    const payload = req.body || {};
    const existing = db.prepare("SELECT e.*, c.name AS category_name FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id WHERE e.id = ?").get(req.params.id);
    if (existing) {
      const recordDate = (existing.created_at || "").slice(0, 10);
      if (recordDate < toSql(new Date()).slice(0, 10) && !userHasPagePermission(req.user, "expenses", "backdate_records")) {
        return res.status(403).json({ error: "permission_denied", page: "expenses", action: "backdate_records" });
      }
    }
    db.prepare(`UPDATE expenses SET amount = COALESCE(?, amount), category_id = COALESCE(?, category_id), notes = COALESCE(?, notes), description = COALESCE(?, description), payment_method = COALESCE(?, payment_method), updated_at = ? WHERE id = ?`)
      .run(payload.amount != null ? Number(payload.amount) : null, payload.category_id || null, payload.notes || null, payload.description || null, payload.payment_method || null, nowSql(), req.params.id);
    req.audit("update", "expenses", { id: req.params.id }, `💰 تم تعديل مصروف #${req.params.id}${payload.amount != null ? ` — المبلغ: ${Number(payload.amount).toLocaleString('en-US')}` : ''}`, `/expenses`);
    // Telegram notification
    let _tgStatus = null;
    try {
      const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
      const catRow = (payload.category_id || existing?.category_id) ? db.prepare("SELECT name FROM expense_categories WHERE id = ?").get(payload.category_id || existing?.category_id) : null;
      _tgStatus = await notifyOwner(TG.EXPENSE_EDITED, {
        expenseId: req.params.id,
        docNo: existing?.doc_no || null,
        category: catRow?.name || existing?.category_name || null,
        oldAmount: existing ? Number(existing.amount || 0) : null,
        newAmount: payload.amount != null ? Number(payload.amount) : (existing ? Number(existing.amount || 0) : null),
        oldDescription: existing?.description || existing?.notes || null,
        newDescription: payload.description || payload.notes || null,
        paymentMethod: payload.payment_method || existing?.payment_method || "cash",
        userName: userRow?.name || null,
        createdAt: new Date().toISOString(),
      }, db);
    } catch (_) { /* non-critical */ }
    res.json({ success: true, data: db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id), telegramStatus: _tgStatus });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", requirePagePermission("expenses", "delete"), async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare("SELECT e.*, c.name AS category_name FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id WHERE e.id = ?").get(req.params.id);
    if (existing) {
      const recordDate = (existing.created_at || "").slice(0, 10);
      if (recordDate < toSql(new Date()).slice(0, 10) && !userHasPagePermission(req.user, "expenses", "backdate_records")) {
        return res.status(403).json({ error: "permission_denied", page: "expenses", action: "backdate_records" });
      }
    }
    db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
    req.audit("delete", "expenses", { id: req.params.id }, `💰 تم حذف مصروف`, `/expenses`);
    // Telegram notification
    let _tgStatus = null;
    try {
      const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
      _tgStatus = await notifyOwner(TG.EXPENSE_DELETED, {
        expenseId: req.params.id,
        docNo: existing?.doc_no || null,
        category: existing?.category_name || null,
        amount: existing ? Number(existing.amount || 0) : null,
        description: existing?.description || existing?.notes || null,
        paymentMethod: existing?.payment_method || "cash",
        date: (existing?.created_at || "").slice(0, 10),
        userName: userRow?.name || null,
        deletedAt: new Date().toISOString(),
      }, db);
    } catch (_) { /* non-critical */ }
    return res.json({ success: true, telegramStatus: _tgStatus });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
