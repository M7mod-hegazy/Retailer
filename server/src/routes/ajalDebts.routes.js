const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");
const { today, nowSql } = require("../utils/datetime");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const NotificationModel = require("../models/notification.model");
const { recordBankMovement } = require("../services/bankService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function ensureAjalSchema(db) {
  try { db.exec("ALTER TABLE ajal_debts ADD COLUMN party_type TEXT NOT NULL DEFAULT 'customer'"); } catch (_) {}
  try { db.exec("ALTER TABLE ajal_debts ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE ajal_debts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'invoice'"); } catch (_) {}
}

router.use((_req, _res, next) => {
  try {
    ensureAjalSchema(getDb());
    next();
  } catch (error) {
    next(error);
  }
});

function normalizePartyType(value) {
  return value === "supplier" ? "supplier" : "customer";
}

function partyWhere(alias, partyType) {
  const cond = [`COALESCE(${alias}.party_type, 'customer') = ?`];
  return cond.join(" AND ");
}

function partyIdColumn(partyType) {
  return partyType === "supplier" ? "supplier_id" : "customer_id";
}

function partySelect() {
  return `
    COALESCE(d.party_type, 'customer') AS party_type,
    COALESCE(c.name, s.name) AS party_name,
    COALESCE(c.phone, s.phone) AS party_phone,
    c.name AS customer_name,
    c.phone AS customer_phone,
    s.name AS supplier_name,
    s.phone AS supplier_phone
  `;
}

// Helper to recalc debt status
function recalcDebt(db, debtId) {
  const d = db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(debtId);
  if (!d) return;
  const remaining = d.original_amount - d.paid_amount;
  let status = "open";
  if (remaining <= 0) status = "paid";
  else if (d.due_date && new Date(d.due_date) < new Date()) status = "overdue";
  else if (d.paid_amount > 0) status = "partial";
  db.prepare("UPDATE ajal_debts SET status = ?, updated_at = ? WHERE id = ?").run(status, nowSql(), debtId);
}

// GET /api/ajal-debts/summary
router.get("/summary", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const partyType = normalizePartyType(req.query.party_type);
    const idCol = partyIdColumn(partyType);
    const today = require("../utils/datetime").today();

    // Optional per-party filtering
    const partyId = partyType === "supplier" ? req.query.supplier_id : req.query.customer_id;

    const baseConds = ["COALESCE(party_type, 'customer') = ?"];
    const baseParams = [partyType];
    if (partyId) {
      baseConds.push(`${idCol} = ?`);
      baseParams.push(partyId);
    }
    const base = `FROM ajal_debts WHERE ${baseConds.join(" AND ")}`;

    const open = db.prepare(`SELECT COALESCE(SUM(original_amount - paid_amount),0) AS total, COUNT(*) AS count ${base} AND status NOT IN ('paid','voided')`).get(...baseParams);
    const overdue = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(original_amount - paid_amount),0) AS amount ${base} AND status NOT IN ('paid','voided') AND (due_date < ? OR due_date IS NULL)`).get(...baseParams, today);
    const dueToday = db.prepare(`SELECT COUNT(*) AS count ${base} AND due_date = ? AND status NOT IN ('paid','voided')`).get(...baseParams, today);
    const parties = db.prepare(`SELECT COUNT(DISTINCT ${idCol}) AS count ${base} AND status NOT IN ('paid','voided')`).get(...baseParams);

    // missed_schedule_count: schedules past due and not paid, for debts matching the party filter
    const schedBaseConds = ["COALESCE(d.party_type, 'customer') = ?", "sch.due_date < ?", "sch.status != 'paid'"];
    const schedParams = [partyType, today];
    if (partyId) {
      schedBaseConds.push(`d.${idCol} = ?`);
      schedParams.push(partyId);
    }
    const missedRow = db.prepare(
      `SELECT COUNT(*) AS count FROM ajal_schedules sch JOIN ajal_debts d ON d.id = sch.debt_id WHERE ${schedBaseConds.join(" AND ")}`
    ).get(...schedParams);

    res.json({
      success: true,
      data: {
        total_owed: open.total,
        open_count: open.count,
        overdue_count: overdue.count,
        overdue_amount: overdue.amount,
        due_today: dueToday.count,
        debtors: parties.count,
        missed_schedule_count: missedRow.count,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/due-parties — parties with unpaid installments due today / overdue.
// Powers the customer-accounts list badges + the "installments due" filter.
router.get("/due-parties", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const partyType = normalizePartyType(req.query.party_type);
    const idCol = partyIdColumn(partyType);
    const today = require("../utils/datetime").today();
    const rows = db.prepare(`
      SELECT d.${idCol} AS party_id,
        SUM(CASE WHEN date(sch.due_date) < date(?) THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN date(sch.due_date) = date(?) THEN 1 ELSE 0 END) AS due_today,
        SUM(CASE WHEN date(sch.due_date) > date(?) THEN 1 ELSE 0 END) AS upcoming
      FROM ajal_schedules sch
      JOIN ajal_debts d ON d.id = sch.debt_id
      JOIN invoices inv ON inv.id = d.invoice_id AND inv.payment_type = 'installments'
      WHERE sch.status != 'paid'
        AND d.status NOT IN ('paid','voided')
        AND COALESCE(d.party_type,'customer') = ?
      GROUP BY d.${idCol}
    `).all(today, today, today, partyType).filter((r) => r.party_id != null);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts
router.get("/", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const today = require("../utils/datetime").today();
    const partyType = normalizePartyType(req.query.party_type);
    const idCol = partyIdColumn(partyType);
    const { status, customer_id, supplier_id, search = "", overdue } = req.query;
    const partyId = partyType === "supplier" ? supplier_id : customer_id;
    const conds = [partyWhere("d", partyType), "d.status != 'voided'"];
    const params = [partyType];

    if (status && status !== "all") { conds.push("d.status = ?"); params.push(status); }
    if (overdue === "1") { conds.push("(d.due_date < ? AND d.status NOT IN ('paid','voided'))"); params.push(today); }
    if (partyId) { conds.push(`d.${idCol} = ?`); params.push(partyId); }
    if (search) { conds.push("(c.name LIKE ? OR s.name LIKE ? OR i.invoice_no LIKE ? OR p.doc_no LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }

    const rows = db.prepare(`
      SELECT d.*, ${partySelect()},
             COALESCE(i.invoice_no, p.doc_no) AS invoice_no,
             (d.original_amount - d.paid_amount) AS remaining
      FROM ajal_debts d
      LEFT JOIN customers c ON c.id = d.customer_id
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      LEFT JOIN invoices i ON i.id = d.invoice_id AND d.source_type = 'invoice'
      LEFT JOIN purchases p ON p.id = d.invoice_id AND d.source_type = 'purchase'
      WHERE ${conds.join(" AND ")}
      ORDER BY d.created_at DESC
      LIMIT 200
    `).all(...params);

    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/customer/:customerId
router.get("/customer/:customerId", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT d.*, i.invoice_no, (d.original_amount - d.paid_amount) AS remaining
      FROM ajal_debts d LEFT JOIN invoices i ON i.id = d.invoice_id
      WHERE d.customer_id = ? AND d.status != 'voided' ORDER BY d.created_at DESC
    `).all(req.params.customerId);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/supplier/:supplierId
router.get("/supplier/:supplierId", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT d.*, s.name AS supplier_name, s.phone AS supplier_phone, p.doc_no AS invoice_no,
             (d.original_amount - d.paid_amount) AS remaining
      FROM ajal_debts d
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      LEFT JOIN purchases p ON p.id = d.invoice_id
      WHERE COALESCE(d.party_type, 'customer') = 'supplier' AND d.supplier_id = ? AND d.status != 'voided'
      ORDER BY d.created_at DESC
    `).all(req.params.supplierId);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/customer/:customerId/payments — all ajal payments for a customer's debts
router.get("/customer/:customerId/payments", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT ap.id, ap.debt_id, ap.amount, ap.payment_date, ap.created_at,
             pm.name AS method_name,
             d.status AS debt_status,
             d.invoice_id, d.original_amount, d.paid_amount,
             inv.invoice_no AS invoice_no
      FROM ajal_payments ap
      JOIN ajal_debts d ON d.id = ap.debt_id
      LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
      LEFT JOIN invoices inv ON inv.id = d.invoice_id
      WHERE d.customer_id = ? AND COALESCE(d.party_type, 'customer') = 'customer'
      ORDER BY ap.created_at DESC
    `).all(req.params.customerId);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/supplier/:supplierId/payments — all ajal payments for a supplier's debts
router.get("/supplier/:supplierId/payments", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT ap.id, ap.debt_id, ap.amount, ap.payment_date, ap.created_at,
             pm.name AS method_name,
             d.status AS debt_status,
             d.invoice_id, d.original_amount, d.paid_amount,
             COALESCE(inv.invoice_no, pur.doc_no) AS invoice_no
      FROM ajal_payments ap
      JOIN ajal_debts d ON d.id = ap.debt_id
      LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
      LEFT JOIN invoices inv ON inv.id = d.invoice_id AND d.source_type = 'invoice'
      LEFT JOIN purchases pur ON pur.id = d.invoice_id AND d.source_type = 'purchase'
      WHERE d.supplier_id = ? AND COALESCE(d.party_type, 'customer') = 'supplier'
      ORDER BY ap.created_at DESC
    `).all(req.params.supplierId);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/:id
router.get("/:id", requirePagePermission("installments", "view"), (req, res) => {
  try {
     const db = getDb();
     const paymentSplitsExpr = `
       CASE
         WHEN i.payment_type = 'multi' THEN (
           COALESCE((
             SELECT GROUP_CONCAT(p.method || ':' || CAST(ROUND(p.amount, 2) AS TEXT), '|||')
             FROM payments p
             JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
             WHERE p.method != 'credit'
           ), '') ||
           COALESCE((
             SELECT '|||credit:' || CAST(ROUND(ad.original_amount, 2) AS TEXT)
             FROM ajal_debts ad
             WHERE ad.invoice_id = i.id AND ad.source_type = 'invoice'
             LIMIT 1
           ), '')
         )
         WHEN i.payment_type = 'installments' THEN (
           SELECT 'cash:' || CAST(ROUND(COALESCE(SUM(pa.amount), 0), 2) AS TEXT) ||
                  CASE WHEN i.total > COALESCE(SUM(pa.amount), 0)
                    THEN '|||credit:' || CAST(ROUND(i.total - COALESCE(SUM(pa.amount), 0), 2) AS TEXT)
                    ELSE ''
                  END
           FROM payment_allocations pa WHERE pa.invoice_id = i.id
         )
         ELSE NULL
       END`;
     const debt = db.prepare(`
       SELECT d.*, ${partySelect()},
              COALESCE(i.invoice_no, p.doc_no) AS invoice_no,
              i.total AS invoice_total, ${paymentSplitsExpr} AS payment_splits, i.created_at AS invoice_date,
              p.total AS purchase_total, p.created_at AS purchase_date,
             (d.original_amount - d.paid_amount) AS remaining
      FROM ajal_debts d
      LEFT JOIN customers c ON c.id = d.customer_id
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      LEFT JOIN invoices i ON i.id = d.invoice_id AND d.source_type = 'invoice'
      LEFT JOIN purchases p ON p.id = d.invoice_id AND d.source_type = 'purchase'
      WHERE d.id = ?
    `).get(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: "الدين غير موجود" });
    const payments = db.prepare(`
      SELECT ap.*, pm.name AS method_name FROM ajal_payments ap
      LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
      WHERE ap.debt_id = ? ORDER BY ap.created_at DESC
    `).all(req.params.id);
    const schedule = db.prepare("SELECT * FROM ajal_schedules WHERE debt_id = ? ORDER BY installment_no").all(req.params.id);
    res.json({ success: true, data: { ...debt, payments, schedule } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/ajal-debts/:id/pay
router.post("/:id/pay", requirePagePermission("installments", "add"), (req, res) => {
  try {
    const db = getDb();
    const { amount, payments, payment_method_id, notes, payment_date } = req.body || {};
    const createdDate = normalizeDate(payment_date);
    assertCanWriteForDate(db, createdDate);
    const paymentLines = Array.isArray(payments) && payments.length
      ? payments.map((p) => ({ method_id: p.method_id || p.payment_method_id, amount: Number(p.amount || 0) })).filter((p) => p.method_id && p.amount > 0)
      : [{ method_id: payment_method_id || 1, amount: Number(amount || 0) }];
    const totalAmount = paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    if (totalAmount <= 0) return res.status(400).json({ success: false, message: "المبلغ مطلوب" });

    const debt = db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: "الدين غير موجود" });
    if (debt.status === "paid") return res.status(400).json({ success: false, message: "تم سداد هذا الدين بالكامل" });

    const remaining = Math.max(0, debt.original_amount - debt.paid_amount);
    if (totalAmount > remaining) return res.status(400).json({ success: false, message: "المبلغ أكبر من المتبقي" });

    db.transaction(() => {
      for (const line of paymentLines) {
        db.prepare(`INSERT INTO ajal_payments (debt_id, amount, payment_method_id, payment_date, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(debt.id, line.amount, line.method_id || 1, createdDate, notes || null, req.user?.id || 1, nowSql());

        const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(line.method_id || 1);
        const methodType = pm?.type || "cash";
        if (!pm?.excludes_from_treasury) {
          const sign = normalizePartyType(debt.party_type) === "supplier" ? -1 : 1;
          if (methodType === "cash" && pm?.target_id) {
            db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(sign * line.amount, pm.target_id);
          } else if (methodType === "bank" && pm?.target_id) {
            recordBankMovement(db, {
              bankId: pm.target_id, type: sign > 0 ? "deposit" : "withdrawal", amount: line.amount,
              reference: debt.invoice_id ? `فاتورة #${debt.invoice_id}` : null,
              notes: `سداد قسط - ${notes || ""}`, userId: req.user?.id || 1, source: "ajal", refType: "ajal_debt", refId: debt.id,
            });
          } else if (methodType === "cash" && !pm?.target_id) {
            db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = 1").run(sign * line.amount);
          }
        }
      }
      db.prepare("UPDATE ajal_debts SET paid_amount = paid_amount + ? WHERE id = ?").run(totalAmount, debt.id);
      recalcDebt(db, debt.id);

      if (normalizePartyType(debt.party_type) === "supplier") {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(totalAmount, debt.supplier_id);
      } else {
        db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(totalAmount, debt.customer_id);
      }
    })();

    req.audit("update", "ajalDebts", { id: req.params.id }, `💰 تم تسوية دين آجل بمبلغ: ${totalAmount}`);
    try {
      NotificationModel.create({
        title: "💰 تم سداد دين آجل",
        body: `سداد #${req.params.id} — المبلغ: ${totalAmount}`,
        type: "info",
        link: `/ajal`,
      });
    } catch (_) {}
    res.json({ success: true, data: db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/ajal-debts/:id/schedule
router.post("/:id/schedule", requirePagePermission("installments", "add"), (req, res) => {
  try {
    const db = getDb();
    const { installments, frequency = "monthly", start_date, custom_days } = req.body || {};
    if (!installments || installments < 1) return res.status(400).json({ success: false, message: "عدد الأقساط مطلوب" });

    const debt = db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: "الدين غير موجود" });

    const remaining = debt.original_amount - debt.paid_amount;
    const perInstallment = Math.ceil((remaining / installments) * 100) / 100;
    const start = start_date ? new Date(start_date) : new Date();
    let freqDays;
    if (frequency === "weekly") freqDays = 7;
    else if (frequency === "biweekly") freqDays = 14;
    else if (frequency === "quarterly") freqDays = 90;
    else if (frequency === "custom_days") {
      const parsed = Number(custom_days);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return res.status(400).json({ success: false, message: "عدد الأيام غير صحيح" });
      }
      freqDays = Math.max(1, parsed);
    }
    else freqDays = 30; // monthly default

    // Delete existing schedule
    db.prepare("DELETE FROM ajal_schedules WHERE debt_id = ?").run(debt.id);

    db.transaction(() => {
      for (let i = 1; i <= installments; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + freqDays * i);
        db.prepare("INSERT INTO ajal_schedules (debt_id, installment_no, due_date, amount, status) VALUES (?, ?, ?, ?, 'pending')")
          .run(debt.id, i, today(d), i === installments ? remaining - perInstallment * (i - 1) : perInstallment);
      }
    })();

    const schedule = db.prepare("SELECT * FROM ajal_schedules WHERE debt_id = ? ORDER BY installment_no").all(debt.id);
    req.audit("update", "ajalDebts", { id: req.params.id }, `💰 تم جدولة أقساط دين آجل`);
    res.json({ success: true, data: schedule });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-schedules/by-party/:partyType/:partyId
router.get("/by-party/:partyType/:partyId", requirePagePermission("installments", "view"), (req, res) => {
  try {
    const db = getDb();
    const paymentSplitsExpr = `
      CASE
        WHEN i.payment_type = 'multi' THEN (
          COALESCE((
            SELECT GROUP_CONCAT(p.method || ':' || CAST(ROUND(p.amount, 2) AS TEXT), '|||')
            FROM payments p
            JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
            WHERE p.method != 'credit'
          ), '') ||
          COALESCE((
            SELECT '|||credit:' || CAST(ROUND(ad.original_amount, 2) AS TEXT)
            FROM ajal_debts ad
            WHERE ad.invoice_id = i.id AND ad.source_type = 'invoice'
            LIMIT 1
          ), '')
        )
        WHEN i.payment_type = 'installments' THEN (
          SELECT 'cash:' || CAST(ROUND(COALESCE(SUM(pa.amount), 0), 2) AS TEXT) ||
                 CASE WHEN i.total > COALESCE(SUM(pa.amount), 0)
                   THEN '|||credit:' || CAST(ROUND(i.total - COALESCE(SUM(pa.amount), 0), 2) AS TEXT)
                   ELSE ''
                 END
          FROM payment_allocations pa WHERE pa.invoice_id = i.id
        )
        ELSE NULL
      END`;
    const partyType = normalizePartyType(req.params.partyType);
    const idCol = partyIdColumn(partyType);
    const rows = db.prepare(`
      SELECT
        COALESCE(sch.id, -d.id) AS id,
        d.id AS debt_id,
        COALESCE(sch.installment_no, 1) AS installment_no,
        COALESCE(sch.due_date, d.due_date) AS due_date,
        COALESCE(sch.amount, d.original_amount - d.paid_amount) AS amount,
        COALESCE(sch.status, CASE WHEN d.paid_amount >= d.original_amount THEN 'paid' ELSE 'pending' END) AS status,
        sch.paid_at,
        COALESCE(sch.created_at, d.created_at) AS created_at,
        d.original_amount, d.paid_amount, d.status AS debt_status,
        COALESCE(i.invoice_no, p.doc_no) AS invoice_no,
        i.total AS invoice_total, ${paymentSplitsExpr} AS payment_splits, i.created_at AS invoice_date,
        p.total AS purchase_total, p.created_at AS purchase_date,
        (SELECT COUNT(*) FROM ajal_schedules WHERE debt_id = d.id) AS schedule_count
      FROM ajal_debts d
      LEFT JOIN ajal_schedules sch ON sch.debt_id = d.id
      LEFT JOIN invoices i ON i.id = d.invoice_id AND d.source_type = 'invoice'
      LEFT JOIN purchases p ON p.id = d.invoice_id AND d.source_type = 'purchase'
      WHERE d.${idCol} = ?
        AND d.status NOT IN ('paid','voided')
        AND (d.source_type != 'invoice' OR i.payment_type = 'installments')
      ORDER BY COALESCE(sch.due_date, d.due_date) DESC, COALESCE(sch.installment_no, 1) ASC
    `).all(req.params.partyId);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/ajal-schedules/:id
router.patch("/schedules/:id", requirePagePermission("installments", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { due_date, amount, status } = req.body || {};
    const s = db.prepare("SELECT * FROM ajal_schedules WHERE id = ?").get(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: "القسط غير موجود" });

    const updates = [];
    const params = [];
    if (due_date) { updates.push("due_date = ?"); params.push(due_date); }
    if (amount !== undefined) { updates.push("amount = ?"); params.push(Number(amount)); }
    if (status) { updates.push("status = ?"); params.push(status); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: "لا توجد تغييرات" });

    params.push(req.params.id);
    params.push(nowSql(), req.params.id);
    db.prepare(`UPDATE ajal_schedules SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`).run(...params);
    res.json({ success: true, data: db.prepare("SELECT * FROM ajal_schedules WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/ajal-schedules/:id/pay
router.post("/schedules/:id/pay", requirePagePermission("installments", "add"), (req, res) => {
  try {
    const db = getDb();
    const { payment_method_id, notes, payment_date } = req.body || {};
    const schedule = db.prepare("SELECT * FROM ajal_schedules WHERE id = ?").get(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: "القسط غير موجود" });
    if (schedule.status === "paid") return res.status(400).json({ success: false, message: "القسط مدفوع بالفعل" });

    const debt = db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(schedule.debt_id);
    if (!debt) return res.status(404).json({ success: false, message: "الدين المرتبط غير موجود" });

    const remaining = Math.max(0, debt.original_amount - debt.paid_amount);
    const payAmount = Math.min(schedule.amount, remaining);
    if (payAmount <= 0) return res.status(400).json({ success: false, message: "لا يوجد مبلغ متبقي للدفع" });

    const createdDate = normalizeDate(payment_date);
    assertCanWriteForDate(db, createdDate);

    db.transaction(() => {
      const pmId = payment_method_id || 1;
      db.prepare("INSERT INTO ajal_payments (debt_id, amount, payment_method_id, payment_date, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(schedule.debt_id, payAmount, pmId, createdDate, notes || null, req.user?.id || 1, nowSql());
      db.prepare("UPDATE ajal_schedules SET status = 'paid', paid_at = ? WHERE id = ?").run(nowSql(), schedule.id);
      db.prepare("UPDATE ajal_debts SET paid_amount = paid_amount + ? WHERE id = ?").run(payAmount, schedule.debt_id);
      recalcDebt(db, schedule.debt_id);

      const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(pmId);
      const methodType = pm?.type || "cash";
      if (!pm?.excludes_from_treasury) {
        const sign = normalizePartyType(debt.party_type) === "supplier" ? -1 : 1;
        if (methodType === "cash" && pm?.target_id) {
          db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(sign * payAmount, pm.target_id);
        } else if (methodType === "bank" && pm?.target_id) {
          recordBankMovement(db, {
            bankId: pm.target_id, type: sign > 0 ? "deposit" : "withdrawal", amount: payAmount,
            reference: `قسط #${schedule.installment_no}`,
            notes: `سداد قسط - ${notes || ""}`, userId: req.user?.id || 1, source: "ajal", refType: "ajal_schedule", refId: schedule.id,
          });
        } else if (methodType === "cash" && !pm?.target_id) {
          db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = 1").run(sign * payAmount);
        }
      }
      if (normalizePartyType(debt.party_type) === "supplier") {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(payAmount, debt.supplier_id);
      } else {
        db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(payAmount, debt.customer_id);
      }
    })();

    req.audit("update", "ajalSchedules", { id: req.params.id }, `💰 تم سداد قسط بقيمة: ${payAmount}`);
    res.json({ success: true, data: db.prepare("SELECT * FROM ajal_schedules WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
