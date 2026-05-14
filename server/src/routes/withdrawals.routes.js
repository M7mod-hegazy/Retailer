const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");
const { normalizeDate } = require("../services/dailySessionService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

// ── Categories ─────────────────────────────────────────────────────────────

router.get("/categories", requirePagePermission("withdrawals", "view"), (_req, res) => {
  res.json({ success: true, data: getDb().prepare("SELECT * FROM withdrawal_categories ORDER BY name ASC").all() });
});

router.post("/categories", requirePagePermission("withdrawals", "add"), (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ success: false, message: "الاسم مطلوب" });
  try {
    const result = getDb().prepare("INSERT INTO withdrawal_categories (name, description) VALUES (?, ?)").run(name.trim(), description || null);
    req.audit("create", "withdrawalCategories", { id: result.lastInsertRowid }, `💰 تم إضافة فئة سحب: ${name.trim()}`);
    res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM withdrawal_categories WHERE id = ?").get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/categories/:id", requirePagePermission("withdrawals", "edit"), (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ success: false, message: "الاسم مطلوب" });
  try {
    getDb().prepare("UPDATE withdrawal_categories SET name = ?, description = ? WHERE id = ?").run(name.trim(), description || null, req.params.id);
    req.audit("update", "withdrawalCategories", { id: req.params.id }, `💰 تم تعديل فئة سحب: ${name.trim()}`);
    res.json({ success: true, data: getDb().prepare("SELECT * FROM withdrawal_categories WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/categories/:id", requirePagePermission("withdrawals", "delete"), (req, res) => {
  try {
    const inUse = getDb().prepare("SELECT COUNT(*) AS c FROM withdrawals WHERE category_id = ?").get(req.params.id);
    if (inUse.c > 0) return res.status(409).json({ success: false, message: "لا يمكن حذف التصنيف لأنه مستخدم في مسحوبات مسجلة" });
    getDb().prepare("DELETE FROM withdrawal_categories WHERE id = ?").run(req.params.id);
    req.audit("delete", "withdrawalCategories", { id: req.params.id }, `💰 تم حذف فئة سحب`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Withdrawals ────────────────────────────────────────────────────────────

router.get("/", requirePagePermission("withdrawals", "view"), (req, res) => {
  const { date_from, date_to, category_id, search = "" } = req.query;
  const db = getDb();
  const conds = ["1=1"];
  const params = [];
  if (date_from) { conds.push("date(w.created_at) >= date(?)"); params.push(date_from); }
  if (date_to)   { conds.push("date(w.created_at) <= date(?)"); params.push(date_to); }
  if (category_id) { conds.push("w.category_id = ?"); params.push(category_id); }
  if (search) { conds.push("(w.note LIKE ? OR wc.name LIKE ? OR w.doc_no LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  res.json({
    success: true,
    data: db.prepare(`
      SELECT w.*, wc.name AS category_name, u.username AS created_by_name
      FROM withdrawals w
      LEFT JOIN withdrawal_categories wc ON wc.id = w.category_id
      LEFT JOIN users u ON u.id = w.created_by
      WHERE ${conds.join(" AND ")}
      ORDER BY w.id DESC LIMIT 500
    `).all(...params),
  });
});

router.post("/", requirePagePermission("withdrawals", "add"), (req, res) => {
  const payload = req.body || {};
  const db = getDb();
  if (!payload.amount || Number(payload.amount) <= 0)
    return res.status(400).json({ success: false, message: "المبلغ مطلوب" });
  try {
    const createdDate = normalizeDate(payload.created_at);
    const docNo = generateDocNumber("withdrawal", "WD");
    const result = db.prepare(
      `INSERT INTO withdrawals (doc_no, amount, category_id, note, payment_method, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      docNo,
      Number(payload.amount),
      payload.category_id || null,
      payload.note || null,
      payload.payment_method || "cash",
      `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
      req.user?.id || 1,
    );
    req.audit("create", "withdrawals", { id: result.lastInsertRowid }, `💰 تم تسجيل سحب بمبلغ: ${payload.amount}`);
    res.status(201).json({ success: true, data: db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/:id", requirePagePermission("withdrawals", "edit"), (req, res) => {
  const payload = req.body || {};
  const db = getDb();
  try {
    db.prepare(`UPDATE withdrawals SET amount = ?, category_id = ?, note = ?, payment_method = ? WHERE id = ?`)
      .run(Number(payload.amount), payload.category_id || null, payload.note || null, payload.payment_method || "cash", req.params.id);
    req.audit("update", "withdrawals", { id: req.params.id }, `💰 تم تعديل سحب`);
    res.json({ success: true, data: db.prepare("SELECT w.*, wc.name AS category_name FROM withdrawals w LEFT JOIN withdrawal_categories wc ON wc.id = w.category_id WHERE w.id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", requirePagePermission("withdrawals", "delete"), (req, res) => {
  try {
    getDb().prepare("DELETE FROM withdrawals WHERE id = ?").run(req.params.id);
    req.audit("delete", "withdrawals", { id: req.params.id }, `💰 تم حذف سحب`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
