const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function ensureChequeColumns(db) {
  const columns = db.prepare("PRAGMA table_info(cheques)").all().map((column) => column.name);
  if (!columns.includes("cheque_no")) db.exec("ALTER TABLE cheques ADD COLUMN cheque_no TEXT");
  if (!columns.includes("bank_name")) db.exec("ALTER TABLE cheques ADD COLUMN bank_name TEXT");
  if (!columns.includes("amount")) db.exec("ALTER TABLE cheques ADD COLUMN amount REAL NOT NULL DEFAULT 0");
  if (!columns.includes("type")) db.exec("ALTER TABLE cheques ADD COLUMN type TEXT NOT NULL DEFAULT 'received'");
  if (!columns.includes("drawer_name")) db.exec("ALTER TABLE cheques ADD COLUMN drawer_name TEXT");
  if (!columns.includes("notes")) db.exec("ALTER TABLE cheques ADD COLUMN notes TEXT");
  if (!columns.includes("replaced_by")) db.exec("ALTER TABLE cheques ADD COLUMN replaced_by INTEGER");
}

router.get("/", requirePagePermission("cheques", "view"), (req, res) => {
  const db = getDb();
  ensureChequeColumns(db);
  const { party_id, party_type } = req.query;
  const conds = [];
  const params = [];
  if (party_id) { conds.push("p.party_id = ?"); params.push(Number(party_id)); }
  if (party_type) { conds.push("p.party_type = ?"); params.push(party_type); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  res.json({
    success: true,
    data: db.prepare(
      `SELECT c.*, p.party_type, p.party_id, COALESCE(NULLIF(c.amount, 0), p.amount, 0) AS amount
       FROM cheques c
       LEFT JOIN payments p ON p.id = c.payment_id
       ${where}
       ORDER BY c.id DESC`,
    ).all(...params),
  });
});

router.post("/", requirePagePermission("cheques", "add"), (req, res, next) => {
  const db = getDb();
  try {
    ensureChequeColumns(db);
    const payload = req.body || {};
    const result = db
      .prepare(
        `INSERT INTO cheques 
        (payment_id, cheque_no, bank_name, amount, due_date, status, type, drawer_name, notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        payload.payment_id || null,
        payload.cheque_no,
        payload.bank_name,
        Number(payload.amount || 0),
        payload.due_date,
        payload.status || "pending",
        payload.type || "received",
        payload.drawer_name || null,
        payload.notes || null,
      );

    if (payload.replaces_id) {
      db.prepare("UPDATE cheques SET status = 'replaced', replaced_by = ? WHERE id = ?")
        .run(result.lastInsertRowid, payload.replaces_id);
    }

    req.audit("create", "cheques", { id: result.lastInsertRowid }, `💰 تم إضافة شيك: ${payload.cheque_no || ''}`);
    res.status(201).json({
      success: true,
      data: db.prepare("SELECT * FROM cheques WHERE id = ?").get(result.lastInsertRowid),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", requirePagePermission("cheques", "edit"), (req, res, next) => {
  const db = getDb();
  try {
    ensureChequeColumns(db);
    const cheque = db.prepare("SELECT * FROM cheques WHERE id = ?").get(req.params.id);
    if (!cheque) {
      const error = new Error("Cheque not found");
      error.status = 404;
      throw error;
    }
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(cheque.payment_id);
    const nextStatus = req.body?.status;
    db.prepare("UPDATE cheques SET status = ? WHERE id = ?").run(nextStatus, req.params.id);

    if (payment && nextStatus === "cleared" && payment.bank_id) {
      const sign = payment.party_type === "supplier" ? -1 : 1;
      db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(sign * payment.amount, payment.bank_id);
    }

    if (payment && nextStatus === "bounced") {
      if (payment.party_type === "customer") {
        db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(
          payment.amount,
          payment.party_id,
        );
      } else {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(
          payment.amount,
          payment.party_id,
        );
      }
    }

    req.audit("update", "cheques", { id: req.params.id }, `💰 تم تغيير حالة شيك إلى: ${nextStatus}`);
    res.json({ success: true, data: db.prepare("SELECT * FROM cheques WHERE id = ?").get(req.params.id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
