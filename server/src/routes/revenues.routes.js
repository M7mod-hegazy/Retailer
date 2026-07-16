const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");
const { requirePagePermission, userHasPagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, buildImpact } = require("../utils/relatedRecords");
const { recordBankMovement } = require("../services/bankService");
const { toSql, nowSql } = require("../utils/datetime");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

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

// Revenue categories have no soft-delete, so a category that is in use is BLOCKED, not archived.
router.get("/categories/:id/delete-impact", requirePagePermission("revenues", "delete"), (req, res) => {
  const c = countSafe(getDb(), "SELECT COUNT(*) AS c FROM revenues WHERE category_id = ?", req.params.id);
  const inUse = c === null || Number(c) > 0;
  res.json({ success: true, data: inUse
    ? buildImpact([], { blocked: "لا يمكن حذف الفئة لأنها مرتبطة بإيرادات مسجلة" })
    : buildImpact([]) });
});

router.delete("/categories/:id", requirePagePermission("revenues", "delete"), (req, res) => {
  try {
    const c = countSafe(getDb(), "SELECT COUNT(*) AS c FROM revenues WHERE category_id = ?", req.params.id);
    if (c === null || Number(c) > 0) {
      return res.status(409).json({ success: false, message: "لا يمكن حذف الفئة لأنها مرتبطة بإيرادات مسجلة" });
    }
    getDb().prepare("DELETE FROM revenue_categories WHERE id = ?").run(req.params.id);
    req.audit("delete", "revenueCategories", { id: req.params.id }, `💰 تم حذف فئة إيراد`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الفئة لأنها مرتبطة بإيرادات" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
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
  const createdDate = normalizeDate(payload.created_at);
  const todayDate = toSql(new Date()).slice(0, 10);
  if (createdDate < todayDate && !userHasPagePermission(req.user, "revenues", "backdate_records")) {
    return res.status(403).json({ error: "permission_denied", page: "revenues", action: "backdate_records" });
  }
  const db = getDb();
  const result = db
    .transaction(() => {
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      const docNo = generateDocNumber('revenue');
      const created = db
        .prepare(
          `INSERT INTO revenues
           (doc_no, amount, category_id, notes, description, payment_method, treasury_id, bank_id, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          `${createdDate} ${toSql(new Date()).slice(11)}`,
          req.user?.id || null,
        );
      const amount = Number(payload.amount || 0);
      // Only cash increases the treasury drawer. Record-only methods (فيزا / محافظ
      // رقمية) are stored under their method name and move no balance.
      if ((payload.payment_method || "cash") === "cash") {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = 1").run(amount);
      }
      return created;
    })();

  req.audit("create", "revenues", { id: result.lastInsertRowid }, `💰 تم إضافة إيراد بمبلغ ${Number(payload.amount || 0).toLocaleString('en-US')}${payload.description || payload.notes ? ` — ${payload.description || payload.notes}` : ''}`);

  // Telegram notification
  try {
    const db2 = getDb();
    const catRow = payload.category_id ? db2.prepare("SELECT name FROM revenue_categories WHERE id = ?").get(payload.category_id) : null;
    const userRow = req.user?.id ? db2.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    // doc_no is generated inside the transaction closure above — read it back
    // from the created row rather than referencing the out-of-scope local.
    const revRow = db2.prepare("SELECT doc_no FROM revenues WHERE id = ?").get(result.lastInsertRowid);
    notifyOwner(TG.REVENUE_CREATED, {
      docNo: revRow?.doc_no || null,
      amount: Number(payload.amount || 0),
      category: catRow?.name || null,
      description: payload.description || payload.notes || null,
      paymentMethod: payload.payment_method || "cash",
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, db2);
  } catch (_) { /* non-critical */ }

  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM revenues WHERE id = ?").get(result.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("revenues", "edit"), (req, res) => {
  try {
    const db = getDb();
    const payload = req.body || {};
    const existing = db.prepare("SELECT r.*, c.name AS category_name FROM revenues r LEFT JOIN revenue_categories c ON c.id = r.category_id WHERE r.id = ?").get(req.params.id);
    if (existing) {
      const recordDate = (existing.created_at || "").slice(0, 10);
      if (recordDate < toSql(new Date()).slice(0, 10) && !userHasPagePermission(req.user, "revenues", "backdate_records")) {
        return res.status(403).json({ error: "permission_denied", page: "revenues", action: "backdate_records" });
      }
    }
    db.prepare(`UPDATE revenues SET amount = COALESCE(?, amount), category_id = COALESCE(?, category_id), notes = COALESCE(?, notes), description = COALESCE(?, description), payment_method = COALESCE(?, payment_method), updated_at = ? WHERE id = ?`)
      .run(payload.amount != null ? Number(payload.amount) : null, payload.category_id || null, payload.notes || null, payload.description || null, payload.payment_method || null, nowSql(), req.params.id);
    req.audit("update", "revenues", { id: req.params.id }, `💰 تم تعديل إيراد #${req.params.id}${payload.amount != null ? ` — المبلغ: ${Number(payload.amount).toLocaleString('en-US')}` : ''}`);
    // Telegram notification
    try {
      const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
      const catRow = (payload.category_id || existing?.category_id) ? db.prepare("SELECT name FROM revenue_categories WHERE id = ?").get(payload.category_id || existing?.category_id) : null;
      notifyOwner(TG.REVENUE_EDITED, {
        revenueId: req.params.id,
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
    res.json({ success: true, data: db.prepare("SELECT * FROM revenues WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", requirePagePermission("revenues", "delete"), (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare("SELECT r.*, c.name AS category_name FROM revenues r LEFT JOIN revenue_categories c ON c.id = r.category_id WHERE r.id = ?").get(req.params.id);
    if (existing) {
      const recordDate = (existing.created_at || "").slice(0, 10);
      if (recordDate < toSql(new Date()).slice(0, 10) && !userHasPagePermission(req.user, "revenues", "backdate_records")) {
        return res.status(403).json({ error: "permission_denied", page: "revenues", action: "backdate_records" });
      }
    }
    db.prepare("DELETE FROM revenues WHERE id = ?").run(req.params.id);
    req.audit("delete", "revenues", { id: req.params.id }, `💰 تم حذف إيراد`);
    // Telegram notification
    try {
      const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
      notifyOwner(TG.REVENUE_DELETED, {
        revenueId: req.params.id,
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
    return res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
