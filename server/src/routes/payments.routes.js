const express = require("express");
const { getDb } = require("../config/database");
const { recalculateInvoiceStatus } = require("../services/invoiceService");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const NotificationModel = require("../models/notification.model");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function getOpenInvoices(db, partyType, partyId) {
  if (partyType !== "customer") return [];

  const rows = db
    .prepare(
      `SELECT i.*,
              COALESCE((SELECT SUM(amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0) AS allocated
       FROM invoices i
       WHERE i.customer_id = ?
       ORDER BY i.created_at ASC, i.id ASC`,
    )
    .all(partyId);

  return rows
    .map((invoice) => ({
      ...invoice,
      outstanding: Math.max(0, invoice.total - invoice.allocated),
    }))
    .filter((invoice) => invoice.outstanding > 0);
}

router.get("/", requirePagePermission("payment_methods", "view"), (req, res) => {
  const db = getDb();
  const { party_type, party_id, from, to } = req.query;
  const conds = [];
  const params = [];
  if (party_type) { conds.push("party_type = ?"); params.push(party_type); }
  if (party_id) { conds.push("party_id = ?"); params.push(Number(party_id)); }
  if (from) { conds.push("date(created_at) >= ?"); params.push(from); }
  if (to) { conds.push("date(created_at) <= ?"); params.push(to); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM payments ${where} ORDER BY id DESC LIMIT 500`).all(...params);
  res.json({ success: true, data: rows });
});

router.get("/context", requirePagePermission("payment_methods", "view"), (req, res) => {
  const db = getDb();
  const partyType = req.query.party_type || "customer";
  const partyId = Number(req.query.party_id || 0);

  const party =
    partyType === "supplier"
      ? db.prepare("SELECT * FROM suppliers WHERE id = ?").get(partyId)
      : db.prepare("SELECT * FROM customers WHERE id = ?").get(partyId);

  res.json({
    success: true,
    data: {
      party,
      open_invoices: getOpenInvoices(db, partyType, partyId),
      treasuries: db.prepare("SELECT * FROM treasuries ORDER BY id DESC").all(),
      banks: db.prepare("SELECT * FROM banks ORDER BY id DESC").all(),
    },
  });
});

router.post("/", requirePagePermission("payment_methods", "add"), (req, res, next) => {
  const db = getDb();
  const payload = req.body || {};

  try {
    const payment = db.transaction(() => {
      const amount = Number(payload.amount || 0);
      const partyType = payload.party_type || "customer";
      const partyId = Number(payload.party_id || 0);
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      let method = payload.method || "cash";
      if (payload.method_id) {
        const pm = db.prepare("SELECT type, category FROM payment_methods WHERE id = ?").get(payload.method_id);
        if (pm) method = pm.type || pm.category || "cash";
      }

      if (amount <= 0) {
        const err = new Error("Payment amount must be positive");
        err.status = 400;
        throw err;
      }

      const openInvoices = getOpenInvoices(db, partyType, partyId);
      let allocations = Array.isArray(payload.allocations) ? payload.allocations : [];

      if (partyType === "customer" && allocations.length === 0) {
        let remaining = amount;
        allocations = [];
        for (const invoice of openInvoices) {
          if (remaining <= 0) break;
          const allocated = Math.min(remaining, invoice.outstanding);
          allocations.push({ invoice_id: invoice.id, amount: allocated });
          remaining -= allocated;
        }
      }

      const requestedAllocated = allocations.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      if (requestedAllocated > amount) {
        const err = new Error("Allocated amount cannot exceed payment amount");
        err.status = 400;
        throw err;
      }

      const paymentResult = db
        .prepare(
          `INSERT INTO payments
           (party_type, party_id, amount, method, reference_number, notes, treasury_id, bank_id, allocated_amount, unallocated_amount, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          partyType,
          partyId,
          amount,
          method,
          payload.reference_number || null,
          payload.notes || null,
          payload.treasury_id || null,
          payload.bank_id || null,
          requestedAllocated,
          amount - requestedAllocated,
          `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
        );

      if (method === "cash") {
        const treasuryId =
          payload.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (treasuryId) {
          const sign = partyType === "supplier" ? -1 : 1;
          db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(sign * amount, treasuryId);
        }
      }

      if (method === "bank_transfer" || method === "cheque" || method === "card") {
        if (payload.bank_id) {
          const sign = partyType === "supplier" ? -1 : 1;
          db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(sign * amount, payload.bank_id);
        }
      }

      for (const entry of allocations) {
        const invoice = openInvoices.find((candidate) => candidate.id === Number(entry.invoice_id));
        const allocateAmount = Number(entry.amount || 0);
        if (!invoice || allocateAmount <= 0 || allocateAmount > invoice.outstanding) {
          const err = new Error("Invalid invoice allocation");
          err.status = 400;
          throw err;
        }

        db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)").run(
          paymentResult.lastInsertRowid,
          invoice.id,
          allocateAmount,
        );
        recalculateInvoiceStatus(db, invoice.id);
      }

      if (partyType === "customer") {
        db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(amount, partyId);
      } else if (partyType === "supplier") {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(amount, partyId);
      }

      if (method === "cheque") {
        db.prepare("INSERT INTO cheques (payment_id, status, due_date) VALUES (?, 'pending', ?)").run(
          paymentResult.lastInsertRowid,
          payload.due_date || null,
        );
      }

      return db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentResult.lastInsertRowid);
    })();

    const paymentAuditId = req.audit("create", "payment", { id: payment?.id, amount: payment?.amount, party_type: payment?.party_type, party_id: payment?.party_id }, `💰 تم تسجيل دفعة بمبلغ ${payment?.amount} (${payment?.party_type === "supplier" ? "مورد" : "عميل"} #${payment?.party_id})`);
    try {
      const db = getDb();
      const pType = payload.party_type || "customer";
      const pId = Number(payload.party_id || 0);
      const partyRow = pType === "supplier"
        ? db.prepare("SELECT name FROM suppliers WHERE id = ?").get(pId)
        : db.prepare("SELECT name FROM customers WHERE id = ?").get(pId);
      const partyName = partyRow?.name || '';
      NotificationModel.create({
        title: "💰 تم تسجيل دفعة",
        body: `دفعة بمبلغ ${payment?.amount || 0}${partyName ? ' — ' + partyName : ''}`,
        type: "info",
        link: paymentAuditId ? `/history?log_id=${paymentAuditId}` : `/payments`,
      });
    } catch (_) {}
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
