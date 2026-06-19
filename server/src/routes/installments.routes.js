const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { nowSql } = require("../utils/datetime");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

function ensureInstallmentColumns(db) {
  const columns = db.prepare("PRAGMA table_info(installments)").all();
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("invoice_id")) db.exec("ALTER TABLE installments ADD COLUMN invoice_id INTEGER");
  if (!names.has("installment_amount")) db.exec("ALTER TABLE installments ADD COLUMN installment_amount INTEGER DEFAULT 0");
  if (!names.has("due_date")) db.exec("ALTER TABLE installments ADD COLUMN due_date TEXT");
  if (!names.has("note")) db.exec("ALTER TABLE installments ADD COLUMN note TEXT");
  if (!names.has("status")) db.exec("ALTER TABLE installments ADD COLUMN status TEXT DEFAULT 'pending'");
  if (!names.has("paid_at")) db.exec("ALTER TABLE installments ADD COLUMN paid_at TEXT");
}

router.get("/", requirePagePermission("installments", "view"), (_req, res) => {
  ensureInstallmentColumns(getDb());
  res.json({
    success: true,
    data: getDb().prepare("SELECT * FROM installments ORDER BY id DESC").all(),
  });
});

router.post("/", requirePagePermission("installments", "add"), (req, res) => {
  ensureInstallmentColumns(getDb());
  const payload = req.body || {};
  const result = getDb()
    .prepare(
      `INSERT INTO installments
       (customer_id, invoice_id, total, remaining, down_payment, frequency, installment_count, next_due_date, installment_amount, due_date, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.customer_id || null,
      payload.invoice_id || null,
      Number(payload.total || payload.installment_amount || 0),
      Number(payload.remaining ?? payload.installment_amount ?? payload.total ?? 0),
      Number(payload.down_payment || 0),
      payload.frequency || "monthly",
      Number(payload.installment_count || 1),
      payload.next_due_date || payload.due_date || null,
      Number(payload.installment_amount || payload.total || 0),
      payload.due_date || payload.next_due_date || null,
      payload.note || null,
      "pending",
    );

  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM installments WHERE id = ?").get(result.lastInsertRowid),
  });
});

router.get("/:invoice_id", requirePagePermission("installments", "view"), (req, res, next) => {
  try {
    ensureInstallmentColumns(getDb());
    res.json({
      success: true,
      data: getDb().prepare("SELECT * FROM installments WHERE invoice_id = ? ORDER BY id DESC").all(req.params.invoice_id),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/pay", requirePagePermission("installments", "edit"), (req, res, next) => {
  const db = getDb();
  try {
    ensureInstallmentColumns(db);
    const installment = db.prepare("SELECT * FROM installments WHERE id = ?").get(req.params.id);
    if (!installment) {
      const error = new Error("Installment not found");
      error.status = 404;
      throw error;
    }
    const amount = Number(req.body?.amount || installment.installment_amount || installment.remaining || 0);
    const remaining = Math.max(0, installment.remaining - amount);
    db.prepare("UPDATE installments SET remaining = ?, status = ?, paid_at = ? WHERE id = ?").run(
      remaining,
      remaining === 0 ? "paid" : "partial",
      req.body?.paid_at || nowSql(),
      req.params.id,
    );
    res.json({ success: true, data: db.prepare("SELECT * FROM installments WHERE id = ?").get(req.params.id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
