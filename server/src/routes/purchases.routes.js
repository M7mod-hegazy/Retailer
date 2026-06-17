const express = require("express");
const { getDb } = require("../config/database");
const { adjustStock } = require("../services/stockService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");
const { recomputeWACCForItem } = require("../services/waccService");
const { hasTable, recordMovement } = require("../services/costLedger");
const { applyPurchaseLinePriceUpdates, revertPurchaseLinePriceUpdates } = require("../services/priceLockService");
const { capturePurchaseReturnLineOverrides } = require("../services/overrideTrackingService");
const { applyReturnAdjustment } = require("../services/returnService");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { isFeatureEnabled } = require("../utils/features");
const NotificationModel = require("../models/notification.model");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function ensurePurchaseReturnSettlementSchema(db) {
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'account'"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
}

function ensureAjalDebtPurchaseSchema(db) {
  const cols = db.prepare("PRAGMA table_info(ajal_debts)").all().map(c => c.name);
  if (!cols.includes("party_type"))  db.exec("ALTER TABLE ajal_debts ADD COLUMN party_type TEXT NOT NULL DEFAULT 'customer'");
  if (!cols.includes("supplier_id")) db.exec("ALTER TABLE ajal_debts ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)");
  if (!cols.includes("source_type")) db.exec("ALTER TABLE ajal_debts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'invoice'");
}

function getPurchaseWithLines(db, purchaseId) {
  const purchase = db.prepare(`
    SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone,
           u.username AS created_by_username, u.full_name AS created_by_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.id = ?
  `).get(purchaseId);
  if (!purchase) return null;
  const lines = db.prepare(`
    SELECT pl.*, i.name AS item_name, i.code AS item_code, i.barcode, i.purchase_price
           ,COALESCE((SELECT SUM(prl.quantity) FROM purchase_return_lines prl WHERE prl.purchase_line_id = pl.id), 0) AS returned_quantity
    FROM purchase_lines pl
    LEFT JOIN items i ON i.id = pl.item_id
    WHERE pl.purchase_id = ?
    ORDER BY pl.id ASC
  `).all(purchaseId);
  const ajalDebt = db.prepare(
    "SELECT original_amount, paid_amount FROM ajal_debts WHERE invoice_id = ? AND source_type = 'purchase' AND status != 'voided' ORDER BY id DESC LIMIT 1"
  ).get(purchaseId);
  const debt_remaining = ajalDebt
    ? Math.max(0, Number(ajalDebt.original_amount) - Number(ajalDebt.paid_amount || 0))
    : 0;

  const payments = db.prepare(`
    SELECT pp.amount, pp.method_id, pm.name AS method_name, pm.type AS method_type, pm.category AS method_category
    FROM purchase_payments pp
    LEFT JOIN payment_methods pm ON pm.id = pp.method_id
    WHERE pp.purchase_id = ?
    ORDER BY pp.id ASC
  `).all(purchaseId);

  return {
    ...purchase,
    lines: lines.map(l => ({ ...l, returnable_quantity: Math.max(0, l.quantity - (l.returned_quantity || 0)) })),
    debt_remaining,
    payments,
  };
}

function recordPurchaseLineCost(db, purchaseId, line, options = {}) {
  if (!hasTable(db, "cost_movements") || !line?.id) return;
  const quantity = Number(line.quantity || 0) * (options.reversal ? -1 : 1);
  if (!quantity) return;
  recordMovement(db, {
    item_id: line.item_id,
    warehouse_id: line.warehouse_id || options.warehouse_id || null,
    occurred_at: options.occurred_at || new Date().toISOString().replace("T", " ").slice(0, 19),
    movement_type: options.movement_type || (line.is_opening_balance ? "opening_balance" : "purchase"),
    quantity,
    unit_cost: line.unit_cost,
    source_table: "purchase_lines",
    source_id: purchaseId,
    source_line_id: options.reversal ? -Number(line.id) : Number(line.id),
  });
}

// A payment method counts as "credit/آجل" when EITHER its type or its category is
// 'credit'. The seeded "أجل" method is type='cash', category='credit', so checking
// only `type` silently treats it as cash — the root cause of multi/credit bugs.
function isCreditMethod(pm) {
  return !!pm && (pm.type === "credit" || pm.category === "credit");
}

// ── Shared purchase financial effects (used by create-equivalent re-apply on edit) ──
// Reverse ALL financial effects of an existing purchase: treasury / bank / supplier
// balance / ajal debt / purchase_payments. Mirrors the void handler exactly.
function reversePurchaseFinancials(db, purchase) {
  const paymentMethod = purchase.payment_method || "cash";
  if (paymentMethod === "cash") {
    const tid = purchase.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || 1;
    db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(purchase.total, tid);
  } else if (paymentMethod === "bank_transfer") {
    if (purchase.bank_id) db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(purchase.total, purchase.bank_id);
  } else if ((paymentMethod === "credit" || paymentMethod === "future_due") && purchase.supplier_id) {
    const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'purchase' AND status != 'voided'").get(purchase.id);
    if (debt) {
      const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
      if (remaining > 0) db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, purchase.supplier_id);
      db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
    } else {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(purchase.total, purchase.supplier_id);
    }
  } else if (paymentMethod === "multi") {
    const storedPayments = db.prepare("SELECT * FROM purchase_payments WHERE purchase_id = ?").all(purchase.id);
    for (const pmt of storedPayments) {
      const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(pmt.method_id);
      if (!pm || isCreditMethod(pm)) continue; // credit portion reversed via ajal below
      if (pm.type === "cash" && pm.target_id) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(pmt.amount, pm.target_id);
      else if (pm.type === "bank" && pm.target_id) db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(pmt.amount, pm.target_id);
    }
    if (purchase.supplier_id) {
      const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'purchase' AND status != 'voided'").get(purchase.id);
      if (debt) {
        const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
        if (remaining > 0) db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, purchase.supplier_id);
        db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
      }
    }
    db.prepare("DELETE FROM purchase_payments WHERE purchase_id = ?").run(purchase.id);
  }
}

// Apply financial effects for a purchase under a given payment method. Mirrors the
// create handler. Safe to call after reversePurchaseFinancials for clean re-apply.
function applyPurchaseFinancials(db, opts) {
  const { purchaseId, paymentMethod, total, supplierId } = opts;
  const payments = Array.isArray(opts.payments) ? opts.payments : [];
  const bankId = opts.bankId || null;
  const treasuryId = opts.treasuryId || null;
  const dueDate = opts.dueDate || null;
  const notes = opts.notes || null;
  const defaultTreasuryId = () => db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || 1;

  if (paymentMethod === "cash") {
    const tid = treasuryId ? Number(treasuryId) : defaultTreasuryId();
    db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(total, tid);
    try { db.prepare("UPDATE purchases SET treasury_id = ? WHERE id = ?").run(tid, purchaseId); } catch (_) {}
  } else if (paymentMethod === "bank_transfer") {
    if (bankId) {
      db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(total, Number(bankId));
      try { db.prepare("UPDATE purchases SET bank_id = ? WHERE id = ?").run(Number(bankId), purchaseId); } catch (_) {}
    }
  } else if ((paymentMethod === "credit" || paymentMethod === "future_due") && supplierId) {
    db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(total, supplierId);
    db.prepare(`
      INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
      VALUES (?, ?, 'supplier', 'purchase', ?, 0, ?, 'open', ?)
    `).run(purchaseId, supplierId, total, paymentMethod === "future_due" ? dueDate : (dueDate || null), notes);
  } else if (paymentMethod === "multi") {
    for (const pmt of payments) {
      const amount = Number(pmt.amount || 0);
      if (amount <= 0) continue;
      const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(Number(pmt.method_id));
      if (!pm) continue;
      if (isCreditMethod(pm)) { /* credit portion handled below — no cash/bank movement */ }
      else if (pm.type === "cash" && pm.target_id) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amount, pm.target_id);
      else if (pm.type === "bank" && pm.target_id) db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(amount, pm.target_id);
      try { db.prepare("INSERT INTO purchase_payments (purchase_id, method_id, amount) VALUES (?, ?, ?)").run(purchaseId, Number(pmt.method_id), amount); } catch (_) {}
    }
    let creditSum = 0;
    for (const pmt of payments) {
      const amt = Number(pmt.amount || 0);
      if (amt <= 0) continue;
      const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(Number(pmt.method_id));
      if (isCreditMethod(pm)) creditSum += amt;
    }
    if (creditSum > 0 && supplierId) {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(creditSum, supplierId);
      db.prepare(`
        INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
        VALUES (?, ?, 'supplier', 'purchase', ?, 0, ?, 'open', ?)
      `).run(purchaseId, supplierId, creditSum, dueDate, notes);
    }
  }
}

router.get("/", requirePagePermission("purchases", "view"), (req, res) => {
  const db = getDb();
  const { search = "", supplier_id, date_from, date_to, sort = "created_at", dir = "desc", user_id = "" } = req.query;
  const limit = req.query.limit ? Math.min(Math.max(Number(req.query.limit), 1), 200) : 100;
  const offset = req.query.offset ? Math.max(Number(req.query.offset), 0) : 0;
  const allowedSort = ["created_at", "total", "doc_no", "payment_method", "supplier_name"];
  const safeSort = allowedSort.includes(sort) ? sort : "created_at";
  const safeDir = dir === "asc" ? "ASC" : "DESC";
  const conditions = [
    "p.status != 'cancelled' AND p.status != 'voided'",
    // Hide import opening-balance purchases (OB-IMPORT-*): inventory-valuation rows, not real spend.
    "COALESCE(p.is_opening_balance, 0) = 0 AND COALESCE(p.doc_no, '') NOT LIKE 'OB-%'",
  ];
  const params = [];
  if (user_id) { conditions.push("p.created_by = ?"); params.push(user_id); }
  if (search) {
    conditions.push("(s.name LIKE ? OR CAST(p.id AS TEXT) LIKE ? OR p.doc_no LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (supplier_id) { conditions.push("p.supplier_id = ?"); params.push(supplier_id); }
  if (date_from) { conditions.push("date(p.created_at) >= date(?)"); params.push(date_from); }
  if (date_to) { conditions.push("date(p.created_at) <= date(?)"); params.push(date_to); }
  const orderBy = safeSort === "supplier_name" ? `s.name ${safeDir}` : `p.${safeSort} ${safeDir}`;
  const summary = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(p.total), 0) AS total
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE ${conditions.join(" AND ")}
  `).get(...params);
  const purchases = db.prepare(`
    SELECT p.*, s.name AS supplier_name, u.username AS created_by_username,
           (SELECT COUNT(*) FROM purchase_lines WHERE purchase_id = p.id) AS items_count,
           CASE
             WHEN p.payment_method = 'multi' THEN (
               SELECT GROUP_CONCAT(
                  (CASE WHEN pm.type = 'credit' OR pm.category = 'credit' THEN 'credit' ELSE pm.name END)
                 || ':' || CAST(ROUND(pp.amount, 2) AS TEXT), '|||')
               FROM purchase_payments pp
               LEFT JOIN payment_methods pm ON pm.id = pp.method_id
               WHERE pp.purchase_id = p.id
             )
             ELSE NULL
            END AS payment_splits,
            CASE
              WHEN p.payment_method IN ('cash', 'bank_transfer') THEN p.total
              WHEN p.payment_method = 'multi' THEN COALESCE((
                SELECT SUM(pp.amount) FROM purchase_payments pp
                LEFT JOIN payment_methods pm ON pm.id = pp.method_id
                WHERE pp.purchase_id = p.id
                  AND pm.type IS NOT NULL AND pm.type != 'credit'
                  AND COALESCE(pm.category, '') != 'credit'
              ), 0)
              WHEN p.payment_method IN ('credit', 'future_due') THEN COALESCE((
                SELECT paid_amount FROM ajal_debts
                WHERE invoice_id = p.id AND source_type = 'purchase' AND status != 'voided'
                ORDER BY id DESC LIMIT 1
              ), 0)
              ELSE 0
            END AS amount_paid
     FROM purchases p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.created_by
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  res.json({
    success: true,
    data: purchases,
    summary: { count: Number(summary?.count || 0), total: Number(summary?.total || 0), page_count: purchases.length },
    meta: { limit, offset, count: purchases.length, total: Number(summary?.count || 0), has_more: offset + purchases.length < Number(summary?.count || 0) },
  });
});

router.get("/returns/items-search", requirePagePermission("purchase_returns", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { q = "", supplier_id = "", date_from, date_to } = req.query;
    if (!q.trim()) return res.json({ success: true, data: [] });

    const conditions = [];
    const params = [];
    conditions.push("(it.name LIKE ? OR it.code LIKE ? OR it.barcode LIKE ?)");
    const like = `%${q.trim()}%`;
    params.push(like, like, like);
    if (supplier_id) { conditions.push("pr.supplier_id = ?"); params.push(supplier_id); }
    if (date_from && date_to) {
      conditions.push("date(pr.created_at) BETWEEN date(?) AND date(?)");
      params.push(date_from, date_to);
    } else if (date_from || date_to) {
      conditions.push("date(pr.created_at) = date(?)");
      params.push(date_from || date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT prl.id AS line_id, prl.purchase_return_id, pr.doc_no, pr.created_at,
             pr.supplier_id, s.name AS supplier_name,
             prl.item_id, it.name AS item_name, it.code AS item_code, it.barcode,
             prl.quantity, prl.unit_cost, prl.unit_price, prl.line_total
      FROM purchase_return_lines prl
      JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
      JOIN items it ON it.id = prl.item_id
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      ${where}
      ORDER BY pr.created_at DESC
      LIMIT 100
    `).all(...params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get("/returns", requirePagePermission("purchase_returns", "view"), (req, res) => {
  const db = getDb();
  ensurePurchaseReturnSettlementSchema(db);
  const { search = "", supplier_id, purchase_id, date_from, date_to, sort = "created_at", dir = "desc", user_id = "" } = req.query;
  const conditions = ["pr.status != 'cancelled'"];
  const params = [];
  if (search) {
    conditions.push("(s.name LIKE ? OR CAST(pr.id AS TEXT) LIKE ? OR CAST(pr.purchase_id AS TEXT) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (purchase_id) { conditions.push("pr.purchase_id = ?"); params.push(purchase_id); }
  if (supplier_id) { conditions.push("pr.supplier_id = ?"); params.push(supplier_id); }
  if (date_from) { conditions.push("date(pr.created_at) >= date(?)"); params.push(date_from); }
  if (date_to) { conditions.push("date(pr.created_at) <= date(?)"); params.push(date_to); }
  if (user_id) { conditions.push("pr.created_by = ?"); params.push(user_id); }
  const allowedSort = ["created_at", "total", "doc_no", "settlement_type", "status"];
  const safeSort = allowedSort.includes(sort) ? sort : "created_at";
  const safeDir = dir === "asc" ? "ASC" : "DESC";
  const returns = db.prepare(`
    SELECT pr.*, s.name AS supplier_name, u.username AS created_by_username,
           p.doc_no AS original_purchase_no
    FROM purchase_returns pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN users u ON u.id = pr.created_by
    LEFT JOIN purchases p ON p.id = pr.purchase_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${safeSort === "settlement_type" ? "pr.settlement_type" : `pr.${safeSort}`} ${safeDir}
  `).all(...params);
  const total = returns.reduce((s, x) => s + Number(x.total || 0), 0);
  res.json({ success: true, data: returns, summary: { count: returns.length, total } });
});

router.get("/returns/:id", requirePagePermission("purchase_returns", "view"), (req, res, next) => {
    try {
      const db = getDb();
      ensurePurchaseReturnSettlementSchema(db);
      const pr = db.prepare(`
        SELECT pr.*,
               s.name AS supplier_name,
               s.phone AS supplier_phone,
               p.doc_no AS original_purchase_no,
               t.name AS treasury_name,
               u.username AS created_by_username,
               u.full_name AS created_by_name
        FROM purchase_returns pr
        LEFT JOIN suppliers s ON s.id = pr.supplier_id
        LEFT JOIN purchases p ON p.id = pr.purchase_id
        LEFT JOIN treasuries t ON t.id = pr.treasury_id
        LEFT JOIN users u ON u.id = pr.created_by
        WHERE pr.id = ?
      `).get(req.params.id);
      if (!pr) throw new Error("Return not found");
      const lines = db.prepare(`
        SELECT prl.*,
               i.name as item_name,
               i.code as item_code,
               i.unit_id,
               i.purchase_price
        FROM purchase_return_lines prl
        LEFT JOIN items i ON i.id = prl.item_id
        WHERE prl.purchase_return_id = ?
      `).all(req.params.id);
      res.json({ success: true, data: { ...pr, lines } });
    } catch (e) { next(e); }
});

router.get("/items-search", requirePagePermission("purchases", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { q = "", doc_search = "", supplier_search = "", supplier_id = "", user_id = "", date_from, date_to } = req.query;
    if (!q.trim()) return res.json({ success: true, data: [] });

    const conditions = ["p.status != 'cancelled' AND p.status != 'voided'"];
    const params = [];

    conditions.push("(i.name LIKE ? OR i.code LIKE ? OR i.barcode LIKE ?)");
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);

    if (doc_search.trim()) {
      conditions.push("p.doc_no LIKE ?");
      params.push(`%${doc_search.trim()}%`);
    }
    if (supplier_search.trim()) {
      conditions.push("s.name LIKE ?");
      params.push(`%${supplier_search.trim()}%`);
    }
    if (supplier_id) { conditions.push("p.supplier_id = ?"); params.push(supplier_id); }
    if (user_id) { conditions.push("p.created_by = ?"); params.push(user_id); }
    if (date_from && date_to) {
      conditions.push("date(p.created_at) BETWEEN date(?) AND date(?)");
      params.push(date_from, date_to);
    } else if (date_from || date_to) {
      conditions.push("date(p.created_at) = date(?)");
      params.push(date_from || date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT pl.id AS line_id, pl.purchase_id, p.doc_no, p.created_at, p.status,
             p.supplier_id, s.name AS supplier_name,
             p.payment_method, p.created_by,
             u.username AS created_by_username,
             pl.item_id, i.name AS item_name, i.code AS item_code, i.barcode,
             pl.quantity, pl.unit_cost, pl.line_total, i.sale_price AS selling_price
      FROM purchase_lines pl
      JOIN purchases p ON p.id = pl.purchase_id
      JOIN items i ON i.id = pl.item_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN users u ON u.id = p.created_by
      ${where}
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all(...params);

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requirePagePermission("purchases", "view"), (req, res, next) => {
  try {
    const purchase = getPurchaseWithLines(getDb(), Number(req.params.id));
    if (!purchase) {
      const error = new Error("Purchase not found");
      error.status = 404;
      throw error;
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePagePermission("purchases", "add"), (req, res, next) => {
  const db = getDb();

  try {
    ensureAjalDebtPurchaseSchema(db);

    const purchase = db.transaction(() => {
      const payload = req.body || {};
      const createdDate = normalizeDate(payload.created_at || payload.date);
      assertCanWriteForDate(db, createdDate);

      const paymentMethod = payload.payment_method || "cash";
      const multiPayments = Array.isArray(payload.payments) ? payload.payments : [];

      // Supplier required only for credit/future_due
      if ((paymentMethod === "credit" || paymentMethod === "future_due") && !payload.supplier_id) {
        const err = new Error("طريقة الدفع الآجلة تتطلب تحديد المورد");
        err.status = 400;
        throw err;
      }

      let total = 0;
      for (const line of payload.lines || []) total += Number(line.quantity) * Number(line.unit_cost);
      const discount = Math.max(0, Number(payload.discount || 0));
      const increase = Math.max(0, Number(payload.increase || 0));
      total = Math.max(0, total - discount + increase);

      const docNo = generateDocNumber("purchase_receipt");
      const supplier = payload.supplier_id
        ? db.prepare("SELECT name FROM suppliers WHERE id = ?").get(payload.supplier_id)
        : null;
      const result = db
        .prepare("INSERT INTO purchases (doc_no, supplier_id, total, discount, increase, payment_method, created_at, created_by, notes, source_purchase_order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(docNo, payload.supplier_id || null, total, discount, increase, paymentMethod,
             `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
             payload.user_id || req.user?.id || null,
             payload.notes || null,
             payload.source_purchase_order_id || null);

      const purchaseId = result.lastInsertRowid;

      const newPurchaseLines = [];
      for (const line of payload.lines || []) {
        const qty         = Number(line.quantity);
        const cost        = Number(line.unit_cost);
        const warehouseId = Number(line.warehouse_id || payload.warehouse_id || 1);
        const itemRow     = db.prepare("SELECT name, name_en, barcode FROM items WHERE id = ?").get(line.item_id);
        const lockBuy     = line.update_master_purchase_price  !== false ? 1 : 0;
        const lockSell    = line.update_master_sale_price       !== false ? 1 : 0;
        const lockWhole   = line.update_master_wholesale_price  !== false ? 1 : 0;

        const lineResult = db.prepare(
          `INSERT INTO purchase_lines
            (purchase_id, item_id, quantity, unit_cost, line_total,
             item_name_ar, item_name_en, barcode, supplier_name,
             update_master_purchase_price, update_master_sale_price, update_master_wholesale_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          purchaseId, line.item_id, qty, cost, qty * cost,
          itemRow?.name    || null,
          itemRow?.name_en || null,
          itemRow?.barcode || null,
          supplier?.name   || null,
          lockBuy, lockSell, lockWhole,
        );

        newPurchaseLines.push({
          id: lineResult.lastInsertRowid,
          item_id: Number(line.item_id),
          warehouse_id: warehouseId,
          quantity: qty,
          unit_cost: cost,
          unit_price: Number(line.selling_price || line.unit_price || 0),
          wholesale_price: Number(line.wholesale_price || 0),
          update_master_purchase_price: lockBuy,
          update_master_sale_price:     lockSell,
          update_master_wholesale_price: lockWhole,
        });
        recordPurchaseLineCost(db, purchaseId, {
          id: lineResult.lastInsertRowid,
          item_id: Number(line.item_id),
          warehouse_id: warehouseId,
          quantity: qty,
          unit_cost: cost,
        }, { occurred_at: `${createdDate} ${new Date().toTimeString().slice(0, 8)}` });

        adjustStock({
          item_id: line.item_id,
          warehouse_id: warehouseId,
          quantityDelta: qty,
          movement_type: "purchase",
          reference_type: "purchase",
          reference_id: purchaseId,
        });

        // FEFO batch capture: insert into item_batches when expiry_date is provided for tracked items
        if (line.expiry_date && isFeatureEnabled(db, "feature_expiry")) {
          const trackRow = db.prepare("SELECT track_expiry FROM items WHERE id = ?").get(line.item_id);
          if (trackRow?.track_expiry) {
            db.prepare(
              "INSERT INTO item_batches (item_id, warehouse_id, batch_no, expiry_date, quantity, cost_price, source) VALUES (?, ?, ?, ?, ?, ?, 'purchase')"
            ).run(line.item_id, warehouseId, line.batch_no || null, line.expiry_date, qty, cost);
          }
        }
      }

      // ── Linked Purchase Order: advance received quantities + status ───────────
      if (payload.source_purchase_order_id) {
        const poId = Number(payload.source_purchase_order_id);
        const po = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(poId);
        if (!po) { const e = new Error("أمر التوريد غير موجود"); e.status = 404; throw e; }
        if (po.status === "cancelled" || po.status === "received") {
          const e = new Error("لا يمكن استلام أمر توريد ملغى أو مستلم بالكامل"); e.status = 400; throw e;
        }
        for (const line of payload.lines || []) {
          if (!line.purchase_order_line_id) continue;
          const pol = db.prepare("SELECT * FROM purchase_order_lines WHERE id = ? AND purchase_order_id = ?")
            .get(Number(line.purchase_order_line_id), poId);
          if (!pol) continue;
          const remaining = Number(pol.quantity) - Number(pol.received_quantity || 0);
          const qty = Number(line.quantity);
          if (qty > remaining + 1e-9) {
            const e = new Error("الكمية المستلمة تتجاوز المتبقي في أمر التوريد"); e.status = 400; throw e;
          }
          db.prepare("UPDATE purchase_order_lines SET received_quantity = received_quantity + ? WHERE id = ?")
            .run(qty, pol.id);
        }
        const updated = db.prepare("SELECT quantity, received_quantity FROM purchase_order_lines WHERE purchase_order_id = ?").all(poId);
        const allReceived = updated.every(l => Number(l.received_quantity || 0) >= Number(l.quantity || 0) - 1e-9);
        const anyReceived = updated.some(l => Number(l.received_quantity || 0) > 0);
        const nextStatus = allReceived ? "received" : anyReceived ? "partially_received" : po.status;
        db.prepare("UPDATE purchase_orders SET status = ? WHERE id = ?").run(nextStatus, poId);
      }

      // WACC replay after all lines are inserted (always-recompute pattern)
      const newPurchaseItemIds = [...new Set(newPurchaseLines.map(l => l.item_id))];
      for (const itemId of newPurchaseItemIds) recomputeWACCForItem(itemId, db);

      // ── Payment handling ──────────────────────────────────────────────────────
      const defaultTreasuryId = () => {
        const s = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get();
        return s?.default_treasury_id || 1;
      };

      if (paymentMethod === "cash") {
        const tid = payload.treasury_id ? Number(payload.treasury_id) : defaultTreasuryId();
        db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(total, tid);
        try { db.prepare("UPDATE purchases SET treasury_id = ? WHERE id = ?").run(tid, purchaseId); } catch (_) {}

      } else if (paymentMethod === "multi") {
        for (const pmt of multiPayments) {
          const amount = Number(pmt.amount || 0);
          if (amount <= 0) continue;
          const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(Number(pmt.method_id));
          if (!pm) continue;
          if (isCreditMethod(pm)) {
            /* credit portion handled below — no cash/bank movement */
          } else if (pm.type === "cash" && pm.target_id) {
            db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amount, pm.target_id);
          } else if (pm.type === "bank" && pm.target_id) {
            db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(amount, pm.target_id);
          }
          try {
            db.prepare("INSERT INTO purchase_payments (purchase_id, method_id, amount) VALUES (?, ?, ?)").run(purchaseId, Number(pmt.method_id), amount);
          } catch (_) {}
        }

        // ── Multi: credit portion → create ajal_debt ─────────────────────
        let creditSum = 0;
        for (const pmt of multiPayments) {
          const amt = Number(pmt.amount || 0);
          if (amt <= 0) continue;
          const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(Number(pmt.method_id));
          if (isCreditMethod(pm)) creditSum += amt;
        }
        if (creditSum > 0 && payload.supplier_id) {
          db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(creditSum, payload.supplier_id);
          db.prepare(`
            INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
            VALUES (?, ?, 'supplier', 'purchase', ?, 0, ?, 'open', ?)
          `).run(purchaseId, payload.supplier_id, creditSum, payload.due_date || null, payload.notes || null);
        }

      } else if (paymentMethod === "credit" && payload.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(total, payload.supplier_id);
        db.prepare(`
          INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'supplier', 'purchase', ?, 0, ?, 'open', ?)
        `).run(purchaseId, payload.supplier_id, total, null, payload.notes || null);

      } else if (paymentMethod === "future_due" && payload.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(total, payload.supplier_id);
        db.prepare(`
          INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'supplier', 'purchase', ?, 0, ?, 'open', ?)
        `).run(purchaseId, payload.supplier_id, total, payload.due_date || null, payload.notes || null);

      } else if (paymentMethod === "bank_transfer") {
        if (payload.bank_id) {
          db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(total, Number(payload.bank_id));
          try { db.prepare("UPDATE purchases SET bank_id = ? WHERE id = ?").run(Number(payload.bank_id), purchaseId); } catch (_) {}
        }
      }

      // ── Apply lock-controlled master price updates ────────────────────────────
      applyPurchaseLinePriceUpdates(newPurchaseLines, purchaseId, payload.user_id || req.user?.id || null, db);

      return getPurchaseWithLines(db, purchaseId);
    })();

    const purchaseAuditId = req.audit("create", "purchase", { id: purchase?.id, doc_no: purchase?.doc_no, total: purchase?.total }, `📦 تم استلام مشتريات #${purchase?.doc_no || purchase?.id} بمبلغ ${purchase?.total}`, purchase?.id ? `/purchases/${purchase.id}` : null);
    try {
      const purchaseId = purchase?.id;
      const supplierName = purchase?.supplier_name || 'غير محدد';
      const purchaseTotal = purchase?.total ?? 0;
      NotificationModel.create({
        title: "📦 تم استلام مشتريات",
        body: `مشتريات جديدة #${purchaseId} — المورد: ${supplierName} — المبلغ: ${purchaseTotal}`,
        type: "info",
        link: purchaseAuditId ? `/history?log_id=${purchaseAuditId}` : `/purchases/${purchaseId}`,
      });
    } catch (_) {}
    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/return", requirePagePermission("purchase_returns", "add"), (req, res, next) => {
  const db = getDb();
  ensurePurchaseReturnSettlementSchema(db);

  try {
    const purchaseReturn = db.transaction(() => {
      const purchase = getPurchaseWithLines(db, Number(req.params.id));
      if (!purchase) {
        const error = new Error("Purchase not found");
        error.status = 404;
        throw error;
      }

      const payload = req.body || {};
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      const settlementType = ["cash", "account", "split"].includes(payload.settlement_type) ? payload.settlement_type : "account";
      let total = 0;
      const preparedLines = [];

      for (const entry of payload.lines || []) {
        const purchaseLine = purchase.lines.find((line) => line.id === Number(entry.purchase_line_id));
        if (!purchaseLine) {
          const error = new Error("Purchase line not found");
          error.status = 404;
          throw error;
        }

        const returnedQty =
          db
            .prepare(
              "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM purchase_return_lines WHERE purchase_line_id = ?",
            )
            .get(purchaseLine.id).quantity || 0;

        const remaining = purchaseLine.quantity - returnedQty;
        const quantity = Number(entry.quantity || 0);
        if (quantity <= 0 || quantity > remaining) {
          const error = new Error("Invalid purchase return quantity");
          error.status = 400;
          throw error;
        }

        // Stock availability check
        const stockRow = db.prepare("SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(purchaseLine.item_id, warehouseId);
        const currentStock = Number(stockRow?.quantity || 0);
        if (quantity > currentStock) {
          const error = new Error(`المخزون غير كافٍ للصنف "${purchaseLine.item_name || purchaseLine.item_code || purchaseLine.item_id}" (المتاح ${currentStock})`);
          error.status = 400;
          throw error;
        }

        const lineTotal = quantity * purchaseLine.unit_cost;
        total += lineTotal;
        const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(purchaseLine.item_id);
        // warehouse from original purchase line (Option A)
        const warehouseId = Number(purchaseLine.warehouse_id || payload.warehouse_id || 1);
        preparedLines.push({
          purchase_line_id: purchaseLine.id,
          item_id: purchaseLine.item_id,
          quantity,
          unit_cost: purchaseLine.unit_cost,
          line_total: lineTotal,
          warehouse_id: warehouseId,
          item_name_ar: itemRow?.name    || purchaseLine.item_name_ar || null,
          item_name_en: itemRow?.name_en || purchaseLine.item_name_en || null,
        });
      }

      const returnDocNo = generateDocNumber("purchase_return");
      const { discount, increase, total: adjTotal } = applyReturnAdjustment(total, payload);
      const prCashAmt = settlementType === "cash" ? adjTotal
        : settlementType === "split" ? Math.max(0, Number(payload.cash_amount || 0))
        : 0;
      const prCreditAmt = settlementType === "account" ? adjTotal
        : settlementType === "split" ? Math.max(0, adjTotal - prCashAmt)
        : 0;
      const treasuryId = (settlementType === "cash" || settlementType === "split")
        ? payload.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id ||
          1
        : null;

      const purchaseReturnResult = db
        .prepare("INSERT INTO purchase_returns (doc_no, purchase_id, supplier_id, total, discount, increase, settlement_type, cash_amount, credit_amount, treasury_id, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)")
        .run(returnDocNo, purchase.id, purchase.supplier_id || null, adjTotal, discount, increase, settlementType, prCashAmt, prCreditAmt, treasuryId,
             payload.user_id || req.user?.id || null, `${createdDate} ${new Date().toTimeString().slice(0, 8)}`);

      const prId = purchaseReturnResult.lastInsertRowid;

      const returnSavedLines = [];
      for (const line of preparedLines) {
        const rl = db.prepare(
          `INSERT INTO purchase_return_lines
           (purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, line_total,
            warehouse_id, item_name_ar, item_name_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(prId, line.purchase_line_id, line.item_id, line.quantity,
              line.unit_cost, line.line_total, line.warehouse_id,
              line.item_name_ar, line.item_name_en);
        returnSavedLines.push({ id: rl.lastInsertRowid });

        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id,
          quantityDelta: -line.quantity,
          movement_type: "purchase_return",
          reference_type: "purchase_return",
          reference_id: prId,
        });
      }

      // Capture master_price_at_time for override tracking
      capturePurchaseReturnLineOverrides(returnSavedLines, db);

      if (prCashAmt > 0 && treasuryId) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(prCashAmt, treasuryId);
      }
      if (prCreditAmt > 0 && purchase.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(prCreditAmt, purchase.supplier_id);
      }

      // Recompute WACC after return reduces stock
      const returnItemIds = [...new Set(preparedLines.map(l => l.item_id))];
      for (const itemId of returnItemIds) recomputeWACCForItem(itemId, db);

      return db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(prId);
    })();

    req.audit("create", "purchase_return", { id: purchaseReturn?.id, purchase_id: Number(req.params.id), total: purchaseReturn?.total }, `↩️ تم معالجة مرتجع مشتريات للفاتورة #${req.params.id}`, purchaseReturn?.id ? `/purchases/returns/${purchaseReturn.id}` : null);
    res.status(201).json({ success: true, data: purchaseReturn });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requirePagePermission("purchases", "edit"), (req, res, next) => {
  const db = getDb();
  const userId = req.user?.id ? Number(req.user.id) : null;
  try {
    ensureAjalDebtPurchaseSchema(db);
    const updated = db.transaction(() => {
      const purchase = getPurchaseWithLines(db, Number(req.params.id));
      if (!purchase) { const e = new Error("Purchase not found"); e.status = 404; throw e; }
      if (purchase.status === "voided") { const e = new Error("Cannot edit a voided purchase"); e.status = 400; throw e; }

      const hasReturn = db.prepare("SELECT 1 FROM purchase_return_lines prl JOIN purchase_lines pl ON pl.id = prl.purchase_line_id WHERE pl.purchase_id = ? LIMIT 1").get(purchase.id);
      if (hasReturn) { const e = new Error("لا يمكن تعديل الفاتورة لوجود مرتجعات مرتبطة بها"); e.status = 400; throw e; }

      const payload = req.body || {};
      const oldPaymentMethod = purchase.payment_method || "cash";
      const newPaymentMethod = payload.payment_method || oldPaymentMethod;
      const newSupplierId = payload.supplier_id || purchase.supplier_id || null;

      if ((newPaymentMethod === "credit" || newPaymentMethod === "future_due") && !newSupplierId) {
        const e = new Error("طريقة الدفع الآجلة تتطلب تحديد المورد"); e.status = 400; throw e;
      }

      // 1. Reverse old stock
      for (const line of purchase.lines || []) {
        recordPurchaseLineCost(db, purchase.id, line, { reversal: true, movement_type: "purchase_reversal" });
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || 1,
          quantityDelta: -line.quantity,
          movement_type: "purchase_void",
          reference_type: "purchase",
          reference_id: purchase.id,
        });
      }

      // 2. Fully reverse old financial effects (treasury / bank / supplier / ajal / purchase_payments)
      reversePurchaseFinancials(db, purchase);

      // 3. Delete old lines and insert new
      db.prepare("DELETE FROM purchase_lines WHERE purchase_id = ?").run(purchase.id);
      const newLines = payload.lines || [];
      let lineSum = 0;
      const editDiscount = Math.max(0, Number(payload.discount ?? purchase.discount ?? 0));
      const editIncrease = Math.max(0, Number(payload.increase ?? purchase.increase ?? 0));
      const editInsertedLines = [];
      for (const line of newLines) {
        const qty       = Number(line.quantity);
        const cost      = Number(line.unit_cost);
        const lineTotal = qty * cost;
        lineSum += lineTotal;
        const lockBuy   = line.update_master_purchase_price  !== false ? 1 : 0;
        const lockSell  = line.update_master_sale_price       !== false ? 1 : 0;
        const lockWhole = line.update_master_wholesale_price  !== false ? 1 : 0;
        const lr = db.prepare(
          `INSERT INTO purchase_lines (purchase_id, item_id, quantity, unit_cost, line_total,
             update_master_purchase_price, update_master_sale_price, update_master_wholesale_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(purchase.id, line.item_id, qty, cost, lineTotal, lockBuy, lockSell, lockWhole);
        editInsertedLines.push({
          id: lr.lastInsertRowid,
          item_id: Number(line.item_id),
          warehouse_id: line.warehouse_id || payload.warehouse_id || 1,
          quantity: qty,
          unit_cost: cost,
          unit_price: Number(line.selling_price || line.unit_price || 0),
          wholesale_price: Number(line.wholesale_price || 0),
          update_master_purchase_price: lockBuy,
          update_master_sale_price:     lockSell,
          update_master_wholesale_price: lockWhole,
        });
        recordPurchaseLineCost(db, purchase.id, {
          id: lr.lastInsertRowid,
          item_id: Number(line.item_id),
          warehouse_id: line.warehouse_id || payload.warehouse_id || 1,
          quantity: qty,
          unit_cost: cost,
        });
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || payload.warehouse_id || 1,
          quantityDelta: qty,
          movement_type: "purchase",
          reference_type: "purchase",
          reference_id: purchase.id,
        });
      }

      const newTotal = Math.max(0, lineSum - editDiscount + editIncrease);

      // 4. Update purchase header (incl. payment_method + supplier) BEFORE applying financials
      db.prepare("UPDATE purchases SET total = ?, discount = ?, increase = ?, payment_method = ?, supplier_id = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?, notes = ? WHERE id = ?")
        .run(newTotal, editDiscount, editIncrease, newPaymentMethod, newSupplierId, userId,
             req.body.notes !== undefined ? (req.body.notes || null) : (purchase.notes || null),
             purchase.id);

      // 5. Apply the new payment method's financial effects (handles method switches + multi)
      applyPurchaseFinancials(db, {
        purchaseId: purchase.id,
        paymentMethod: newPaymentMethod,
        total: newTotal,
        supplierId: newSupplierId,
        payments: Array.isArray(payload.payments) ? payload.payments : [],
        bankId: payload.bank_id || null,
        treasuryId: payload.treasury_id || null,
        dueDate: payload.due_date || null,
        notes: payload.notes || null,
      });

      // 6. Recompute WACC from surviving history for all affected items (old + new)
      const editItemIds = [...new Set([
        ...(purchase.lines || []).map(l => l.item_id),
        ...newLines.map(l => Number(l.item_id)),
      ])];
      for (const itemId of editItemIds) recomputeWACCForItem(itemId, db);

      // 7. Apply lock-controlled master price updates
      applyPurchaseLinePriceUpdates(editInsertedLines, purchase.id, userId, db);

      return getPurchaseWithLines(db, purchase.id);
    })();
    req.audit("edit", "purchase", { id: Number(req.params.id), total: updated?.total }, `📦 تم تعديل مشتريات #${req.params.id}`, `/purchases/${req.params.id}`);
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

function generateAmendmentDocNo(originalDocNo, db, table) {
  const base = originalDocNo.replace(/-A\d+$/, "");
  const existing = db.prepare(
    `SELECT doc_no FROM ${table} WHERE doc_no LIKE ? ORDER BY doc_no DESC LIMIT 1`
  ).get(`${base}-A%`);
  if (!existing) return `${base}-A1`;
  const num = parseInt(existing.doc_no.match(/-A(\d+)$/)[1]) + 1;
  return `${base}-A${num}`;
}

function cancelPurchaseFn(db, purchaseId, reason, userId) {
  ensureAjalDebtPurchaseSchema(db);
  const purchase = getPurchaseWithLines(db, purchaseId);
  if (!purchase) { const e = new Error("الفاتورة غير موجودة"); e.status = 404; throw e; }
  if (purchase.status === "cancelled" || purchase.status === "voided") {
    const e = new Error("الفاتورة ملغاة بالفعل"); e.status = 400; throw e;
  }
  if (purchase.amended_by) { const e = new Error("هذه الفاتورة عُدِّلت بالفعل"); e.status = 400; throw e; }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Reverse stock
  for (const line of purchase.lines || []) {
    recordPurchaseLineCost(db, purchase.id, line, { reversal: true, movement_type: "purchase_cancel", occurred_at: now });
    adjustStock({
      item_id: line.item_id,
      warehouse_id: line.warehouse_id || 1,
      quantityDelta: -line.quantity,
      movement_type: "purchase_void",
      reference_type: "purchase",
      reference_id: purchase.id,
    });
  }

  // Reverse financial effects
  const paymentMethod = purchase.payment_method || "cash";
  if (paymentMethod === "cash") {
    const tid = purchase.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || 1;
    db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(purchase.total, tid);
  } else if (paymentMethod === "bank_transfer") {
    if (purchase.bank_id) db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(purchase.total, purchase.bank_id);
  } else if ((paymentMethod === "credit" || paymentMethod === "future_due") && purchase.supplier_id) {
    const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'purchase' AND status != 'voided'").get(purchase.id);
    if (debt) {
      const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
      if (remaining > 0)
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, purchase.supplier_id);
      db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
    } else {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(purchase.total, purchase.supplier_id);
    }
  } else if (paymentMethod === "multi") {
    const storedPayments = db.prepare("SELECT * FROM purchase_payments WHERE purchase_id = ?").all(purchase.id);
    for (const pmt of storedPayments) {
      const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(pmt.method_id);
      if (!pm) continue;
      if (pm.type === "cash" && pm.target_id) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(pmt.amount, pm.target_id);
      else if (pm.type === "bank" && pm.target_id) db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(pmt.amount, pm.target_id);
    }
    if (purchase.supplier_id) {
      const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'purchase' AND status != 'voided'").get(purchase.id);
      if (debt) {
        const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
        if (remaining > 0)
          db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, purchase.supplier_id);
        db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
      }
    }
  }

  db.prepare("UPDATE purchases SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?")
    .run(now, userId || null, reason || null, purchase.id);

  // Recompute WACC from surviving purchase history for all affected items
  const cancelledItemIds = [...new Set((purchase.lines || []).map(l => l.item_id))];
  for (const itemId of cancelledItemIds) recomputeWACCForItem(itemId, db);

  try {
    db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
      userId || 1, "purchase", purchase.id, "cancel", JSON.stringify({ reason })
    );
  } catch (_) {}

  return getPurchaseWithLines(db, purchase.id);
}

router.post("/:id/cancel", requirePagePermission("purchases", "add"), (req, res, next) => {
  const db = getDb();
  try {
    const { reason } = req.body || {};
    if (!reason || !reason.trim()) { const e = new Error("سبب الإلغاء مطلوب"); e.status = 400; throw e; }
    const result = db.transaction(() =>
      cancelPurchaseFn(db, Number(req.params.id), reason.trim(), req.body.user_id || req.user?.id || null)
    )();
    req.audit("cancel", "purchase", { id: Number(req.params.id), reason }, `📦 تم إلغاء مشتريات #${req.params.id}`, `/purchases/${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.put("/:id/amend", requirePagePermission("purchases", "edit"), (req, res, next) => {
  const db = getDb();
  try {
    ensureAjalDebtPurchaseSchema(db);
    const payload = req.body || {};
    if (!payload.reason || !payload.reason.trim()) { const e = new Error("سبب التعديل مطلوب"); e.status = 400; throw e; }

    const original = getPurchaseWithLines(db, Number(req.params.id));
    if (!original) { const e = new Error("الفاتورة غير موجودة"); e.status = 404; throw e; }
    if (original.status === "cancelled" || original.status === "voided") { const e = new Error("لا يمكن تعديل فاتورة ملغاة"); e.status = 400; throw e; }
    if (original.amended_by) { const e = new Error("هذه الفاتورة عُدِّلت بالفعل — انظر الفاتورة الجديدة"); e.status = 400; throw e; }

    const result = db.transaction(() => {
      // 1. Cancel original
      cancelPurchaseFn(db, original.id, `تعديل — ${payload.reason.trim()}`, payload.user_id || null);

      // 2. Generate amendment doc number
      const newDocNo = generateAmendmentDocNo(original.doc_no, db, "purchases");

      // 3. Create new purchase
      const supplier = original.supplier_id
        ? db.prepare("SELECT name FROM suppliers WHERE id = ?").get(original.supplier_id)
        : null;
      const paymentMethod = payload.payment_method || original.payment_method || "cash";
      const newLines = payload.lines || [];
      let newTotal = 0;
      for (const line of newLines) newTotal += Number(line.quantity) * Number(line.unit_cost);
      const amendDiscount = Math.max(0, Number(payload.discount || 0));
      const amendIncrease = Math.max(0, Number(payload.increase || 0));
      newTotal = Math.max(0, newTotal - amendDiscount + amendIncrease);

      const createdDate = normalizeDate(payload.created_at || new Date().toISOString().slice(0, 10));
      const newResult = db.prepare(
        "INSERT INTO purchases (doc_no, supplier_id, total, discount, increase, payment_method, created_at, created_by, amendment_of, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(newDocNo, payload.supplier_id || original.supplier_id || null, newTotal, amendDiscount, amendIncrease, paymentMethod,
            `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
            payload.user_id || req.user?.id || null, original.id,
            payload.notes !== undefined ? (payload.notes || null) : (original.notes || null));

      const newPurchaseId = newResult.lastInsertRowid;

      const amendInsertedLines = [];
      for (const line of newLines) {
        const qty         = Number(line.quantity);
        const cost        = Number(line.unit_cost);
        const warehouseId = Number(line.warehouse_id || 1);
        const itemRow     = db.prepare("SELECT name, name_en, barcode FROM items WHERE id = ?").get(line.item_id);
        const lockBuy     = line.update_master_purchase_price  !== false ? 1 : 0;
        const lockSell    = line.update_master_sale_price       !== false ? 1 : 0;
        const lockWhole   = line.update_master_wholesale_price  !== false ? 1 : 0;
        const lr = db.prepare(
          `INSERT INTO purchase_lines (purchase_id, item_id, quantity, unit_cost, line_total, item_name_ar, item_name_en, barcode, supplier_name,
             update_master_purchase_price, update_master_sale_price, update_master_wholesale_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(newPurchaseId, line.item_id, qty, cost, qty * cost,
              itemRow?.name || null, itemRow?.name_en || null, itemRow?.barcode || null, supplier?.name || null,
              lockBuy, lockSell, lockWhole);
        amendInsertedLines.push({
          id: lr.lastInsertRowid,
          item_id: Number(line.item_id),
          warehouse_id: warehouseId,
          quantity: qty,
          unit_cost: cost,
          unit_price: Number(line.selling_price || line.unit_price || 0),
          wholesale_price: Number(line.wholesale_price || 0),
          update_master_purchase_price: lockBuy,
          update_master_sale_price:     lockSell,
          update_master_wholesale_price: lockWhole,
        });
        recordPurchaseLineCost(db, newPurchaseId, {
          id: lr.lastInsertRowid,
          item_id: Number(line.item_id),
          warehouse_id: warehouseId,
          quantity: qty,
          unit_cost: cost,
        }, { occurred_at: `${createdDate} ${new Date().toTimeString().slice(0, 8)}` });
        adjustStock({ item_id: line.item_id, warehouse_id: warehouseId, quantityDelta: qty, movement_type: "purchase", reference_type: "purchase", reference_id: newPurchaseId });
      }
      // WACC replay after all lines inserted
      const amendItemIds = [...new Set(amendInsertedLines.map(l => l.item_id))];
      for (const itemId of amendItemIds) recomputeWACCForItem(itemId, db);

      // 4. Payment handling (same as create)
      if (paymentMethod === "cash") {
        const tid = payload.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || 1;
        db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(newTotal, tid);
        try { db.prepare("UPDATE purchases SET treasury_id = ? WHERE id = ?").run(tid, newPurchaseId); } catch (_) {}
      } else if (paymentMethod === "bank_transfer" && payload.bank_id) {
        db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(newTotal, Number(payload.bank_id));
        try { db.prepare("UPDATE purchases SET bank_id = ? WHERE id = ?").run(Number(payload.bank_id), newPurchaseId); } catch (_) {}
      } else if ((paymentMethod === "credit" || paymentMethod === "future_due") && (payload.supplier_id || original.supplier_id)) {
        const suppId = payload.supplier_id || original.supplier_id;
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(newTotal, suppId);
        db.prepare("INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status) VALUES (?, ?, 'supplier', 'purchase', ?, 0, ?, 'open')")
          .run(newPurchaseId, suppId, newTotal, payload.due_date || null);
      } else if (paymentMethod === "multi" && Array.isArray(payload.payments)) {
        for (const pmt of payload.payments) {
          const amount = Number(pmt.amount || 0);
          if (amount <= 0) continue;
          const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(Number(pmt.method_id));
          if (!pm) continue;
          if (pm.type === "cash" && pm.target_id) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amount, pm.target_id);
          else if (pm.type === "bank" && pm.target_id) db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(amount, pm.target_id);
          try { db.prepare("INSERT INTO purchase_payments (purchase_id, method_id, amount) VALUES (?, ?, ?)").run(newPurchaseId, Number(pmt.method_id), amount); } catch (_) {}
        }
      }

      // 5. Apply lock-controlled master price updates for amended lines
      applyPurchaseLinePriceUpdates(amendInsertedLines, newPurchaseId, payload.user_id || null, db);

      // 6. Link original → new
      db.prepare("UPDATE purchases SET amended_by = ? WHERE id = ?").run(newPurchaseId, original.id);

      try {
        db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
          payload.user_id || 1, "purchase", original.id, "amend", JSON.stringify({ new_purchase_id: newPurchaseId, reason: payload.reason })
        );
      } catch (_) {}

      return { original: getPurchaseWithLines(db, original.id), new_purchase: getPurchaseWithLines(db, newPurchaseId) };
    })();

    req.audit("amend", "purchase", { original_id: Number(req.params.id), new_id: result?.new_purchase?.id }, `📦 تم تعديل (أمندمنت) مشتريات #${req.params.id}`, result?.new_purchase?.id ? `/purchases/${result.new_purchase.id}` : `/purchases/${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.post("/:id/void", requirePagePermission("purchases", "delete"), (req, res, next) => {
  const db = getDb();
  try {
    db.transaction(() => {
      const purchase = getPurchaseWithLines(db, Number(req.params.id));
      if (!purchase) { const e = new Error("Purchase not found"); e.status = 404; throw e; }
      if (purchase.status === "voided") { const e = new Error("Purchase already voided"); e.status = 400; throw e; }

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      for (const line of purchase.lines || []) {
        recordPurchaseLineCost(db, purchase.id, line, { reversal: true, movement_type: "purchase_void", occurred_at: now });
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || 1,
          quantityDelta: -line.quantity,
          movement_type: "purchase_void",
          reference_type: "purchase",
          reference_id: purchase.id,
        });
      }

      // Reverse financial effects
      const paymentMethod = purchase.payment_method || "cash";
      if (paymentMethod === "cash") {
        const tid = purchase.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || 1;
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(purchase.total, tid);
      } else if (paymentMethod === "bank_transfer") {
        if (purchase.bank_id) {
          db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(purchase.total, purchase.bank_id);
        }
      } else if ((paymentMethod === "credit" || paymentMethod === "future_due") && purchase.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?")
          .run(purchase.total, purchase.supplier_id);
        try { db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE invoice_id = ? AND source_type = 'purchase'").run(purchase.id); } catch (_) {}
      } else if (paymentMethod === "multi") {
        const storedPayments = db.prepare("SELECT * FROM purchase_payments WHERE purchase_id = ?").all(purchase.id);
        for (const pmt of storedPayments) {
          const pm = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(pmt.method_id);
          if (!pm) continue;
          if (pm.type === "cash" && pm.target_id) {
            db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(pmt.amount, pm.target_id);
          } else if (pm.type === "bank" && pm.target_id) {
            db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(pmt.amount, pm.target_id);
          }
        }
        if (purchase.supplier_id) {
          const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'purchase' AND status != 'voided'").get(purchase.id);
          if (debt) {
            const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
            if (remaining > 0)
              db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, purchase.supplier_id);
            db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
          }
        }
      }

      db.prepare("UPDATE purchases SET status = 'voided' WHERE id = ?").run(purchase.id);

      // Recompute WACC from surviving history for all affected items
      const voidedItemIds = [...new Set((purchase.lines || []).map(l => l.item_id))];
      for (const itemId of voidedItemIds) recomputeWACCForItem(itemId, db);

      // Revert master price changes that were applied by this purchase's locked lines
      const voidUserId = req.user?.id ? Number(req.user.id) : null;
      revertPurchaseLinePriceUpdates(purchase.id, voidUserId, db);
    })();
    req.audit("void", "purchase", { id: Number(req.params.id) }, `📦 تم إلغاء (فويد) مشتريات #${req.params.id}`, `/purchases/${req.params.id}`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

function getPurchaseReturnWithLines(db, returnId) {
  const pr = db.prepare(`
    SELECT pr.*, s.name AS supplier_name,
           (SELECT doc_no FROM purchase_returns WHERE id = pr.amendment_of) AS amendment_of_no,
           (SELECT doc_no FROM purchase_returns WHERE id = pr.amended_by)   AS amended_by_no
    FROM purchase_returns pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    WHERE pr.id = ?
  `).get(returnId);
  if (!pr) return null;
  const lines = db.prepare(`
    SELECT prl.*, COALESCE(prl.item_name_ar, i.name) AS item_name, i.code AS item_code
    FROM purchase_return_lines prl
    LEFT JOIN items i ON i.id = prl.item_id
    WHERE prl.purchase_return_id = ?
  `).all(returnId);
  return { ...pr, lines };
}

router.post("/returns/:id/cancel", requirePagePermission("purchase_returns", "delete"), (req, res, next) => {
  const db = getDb();
  try {
    const { reason, user_id } = req.body || {};
    if (!reason || !reason.trim()) { const e = new Error("سبب الإلغاء مطلوب"); e.status = 400; throw e; }

    const result = db.transaction(() => {
      const pr = getPurchaseReturnWithLines(db, Number(req.params.id));
      if (!pr) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
      if (pr.status === 'cancelled') { const e = new Error("المرتجع ملغى بالفعل"); e.status = 400; throw e; }
      if (pr.amended_by) { const e = new Error("هذا المرتجع عُدِّل بالفعل"); e.status = 400; throw e; }

      // Reverse stock (put goods back)
      for (const line of pr.lines || []) {
        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || 1,
          quantityDelta: line.quantity,
          movement_type: "cancel_purchase_return",
          reference_type: "purchase_return",
          reference_id: pr.id,
        });
      }

      // Reverse financials
      const cancelPrCashAmt = Number(pr.cash_amount || 0);
      const cancelPrCreditAmt = Number(pr.credit_amount || 0);
      if (cancelPrCashAmt > 0) {
        const tId = pr.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(cancelPrCashAmt, tId);
      }
      if (cancelPrCreditAmt > 0 && pr.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(cancelPrCreditAmt, pr.supplier_id);
      }

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      db.prepare("UPDATE purchase_returns SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?")
        .run(now, user_id || null, reason.trim(), pr.id);

      try {
        db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
          user_id || 1, "purchase_return", pr.id, "cancel", JSON.stringify({ reason })
        );
      } catch (_) {}

      return getPurchaseReturnWithLines(db, pr.id);
    })();

    req.audit("cancel", "purchase_return", { id: Number(req.params.id), reason: req.body?.reason }, `↩️ تم إلغاء مرتجع مشتريات #${req.params.id}`, `/purchases/returns/${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

function editPurchaseReturn(db, returnId, payload) {
  return db.transaction(() => {
    const pr = db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(returnId);
    if (!pr) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
    if (pr.status === "cancelled") { const e = new Error("لا يمكن تعديل مرتجع ملغى"); e.status = 400; throw e; }

    const oldLines = db.prepare("SELECT * FROM purchase_return_lines WHERE purchase_return_id = ?").all(returnId);

    // 1. Reverse old stock (items go back to warehouse — purchase return took them away)
    for (const line of oldLines) {
      adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id || 1, quantityDelta: line.quantity, movement_type: "purchase", reference_type: "purchase_return", reference_id: returnId });
    }

    // 2. Reverse old financials
    const editPrDefaultTId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
    const oldPrCashAmt = Number(pr.cash_amount || 0);
    const oldPrCreditAmt = Number(pr.credit_amount || 0);
    if (oldPrCashAmt > 0) {
      const tId = pr.treasury_id || editPrDefaultTId;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(oldPrCashAmt, tId);
    }
    if (oldPrCreditAmt > 0 && pr.supplier_id) {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(oldPrCreditAmt, pr.supplier_id);
    }

    // 3. Build new lines
    const newLines = payload.lines || [];
    let newTotal = 0;
    const preparedLines = [];

    for (const requestedLine of newLines) {
      if (!pr.purchase_id) {
        const lineTotal = Number(requestedLine.quantity) * Number(requestedLine.unit_cost);
        newTotal += lineTotal;
        preparedLines.push({ purchase_line_id: null, item_id: requestedLine.item_id, quantity: Number(requestedLine.quantity), unit_cost: Number(requestedLine.unit_cost), line_total: lineTotal, warehouse_id: requestedLine.warehouse_id || payload.warehouse_id || 1 });
      } else {
        const purchaseLine = db.prepare("SELECT * FROM purchase_lines WHERE id = ? AND purchase_id = ?").get(requestedLine.purchase_line_id, pr.purchase_id);
        if (!purchaseLine) continue;
        const previousReturned = db.prepare(
          "SELECT COALESCE(SUM(prl.quantity), 0) AS quantity FROM purchase_return_lines prl JOIN purchase_returns pr2 ON pr2.id = prl.purchase_return_id WHERE prl.purchase_line_id = ? AND pr2.status != 'cancelled' AND pr2.id != ?"
        ).get(purchaseLine.id, returnId).quantity || 0;
        const remaining = purchaseLine.quantity - previousReturned;
        const qty = Math.min(Number(requestedLine.quantity), remaining);
        if (qty <= 0) continue;
        const lineTotal = purchaseLine.unit_cost * qty;
        newTotal += lineTotal;
        preparedLines.push({ purchase_line_id: purchaseLine.id, item_id: purchaseLine.item_id, quantity: qty, unit_cost: purchaseLine.unit_cost, line_total: lineTotal, warehouse_id: requestedLine.warehouse_id || purchaseLine.warehouse_id || payload.warehouse_id || 1 });
      }
    }

    // 4. Delete old lines, insert new
    db.prepare("DELETE FROM purchase_return_lines WHERE purchase_return_id = ?").run(returnId);
    for (const line of preparedLines) {
      db.prepare(
        "INSERT INTO purchase_return_lines (purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, line_total, warehouse_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(returnId, line.purchase_line_id, line.item_id, line.quantity, line.unit_cost, line.line_total, line.warehouse_id);
      adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id, quantityDelta: -line.quantity, movement_type: "purchase_return", reference_type: "purchase_return", reference_id: returnId });
    }

    // 5. Apply new financials
    const newSettlement = ["cash", "account", "split"].includes(payload.settlement_type) ? payload.settlement_type : (pr.settlement_type || "account");
    const newTreasuryId = payload.treasury_id || pr.treasury_id;
    const newSupplierId = payload.supplier_id || pr.supplier_id;
    const newPrCashAmt = newSettlement === "cash" ? newTotal
      : newSettlement === "split" ? Math.max(0, Number(payload.cash_amount || 0))
      : 0;
    const newPrCreditAmt = newSettlement === "account" ? newTotal
      : newSettlement === "split" ? Math.max(0, newTotal - newPrCashAmt)
      : 0;
    if (newPrCashAmt > 0) {
      const tId = newTreasuryId || editPrDefaultTId;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(newPrCashAmt, tId);
    }
    if (newPrCreditAmt > 0 && newSupplierId) {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(newPrCreditAmt, newSupplierId);
    }

    // 6. Update header — preserve doc_no and created_at
    db.prepare(
      "UPDATE purchase_returns SET total = ?, settlement_type = ?, cash_amount = ?, credit_amount = ?, treasury_id = ?, supplier_id = ?, warehouse_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(newTotal, newSettlement, newPrCashAmt, newPrCreditAmt, newTreasuryId || null, newSupplierId || pr.supplier_id, payload.warehouse_id || pr.warehouse_id, payload.notes || pr.notes, returnId);

    return db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(returnId);
  })();
}

router.put("/returns/:id", requirePagePermission("purchase_returns", "edit"), (req, res, next) => {
  const db = getDb();
  ensurePurchaseReturnSettlementSchema(db);
  try {
    const result = editPurchaseReturn(db, Number(req.params.id), req.body || {});
    req.audit("edit", "purchase_return", { id: Number(req.params.id) }, `↩️ تم تعديل مرتجع مشتريات #${req.params.id}`, `/purchases/returns/${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.put("/returns/:id/amend", requirePagePermission("purchase_returns", "edit"), (req, res, next) => {
  const db = getDb();
  try {
    const payload = req.body || {};
    if (!payload.reason || !payload.reason.trim()) { const e = new Error("سبب التعديل مطلوب"); e.status = 400; throw e; }

    const original = getPurchaseReturnWithLines(db, Number(req.params.id));
    if (!original) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
    if (original.status === 'cancelled') { const e = new Error("لا يمكن تعديل مرتجع ملغى"); e.status = 400; throw e; }
    if (original.amended_by) { const e = new Error("هذا المرتجع عُدِّل بالفعل — انظر المرتجع الجديد"); e.status = 400; throw e; }

    const result = db.transaction(() => {
      // 1. Cancel original (inline)
      for (const line of original.lines || []) {
        adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id || 1, quantityDelta: line.quantity, movement_type: "cancel_purchase_return", reference_type: "purchase_return", reference_id: original.id });
      }
      if (original.settlement_type === 'cash' && original.treasury_id) {
        db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(original.total, original.treasury_id);
      } else if (original.settlement_type === 'account' && original.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(original.total, original.supplier_id);
      }
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      db.prepare("UPDATE purchase_returns SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?")
        .run(now, payload.user_id || null, `تعديل — ${payload.reason.trim()}`, original.id);

      // 2. Create new return
      const newDocNo = generateAmendmentDocNo(original.doc_no, db, "purchase_returns");
      const settlementType = payload.settlement_type || original.settlement_type || "account";
      const newLines = payload.lines || [];
      let newSubtotal = 0;
      for (const l of newLines) newSubtotal += Number(l.quantity) * Number(l.unit_cost || l.unit_price || 0);
      const { discount: newDiscount, increase: newIncrease, total: newTotal } = applyReturnAdjustment(newSubtotal, {
        discount: payload.discount ?? original.discount,
        increase: payload.increase ?? original.increase,
        supervisor_override: payload.supervisor_override,
      });

      const treasuryId = settlementType === "cash"
        ? (payload.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || 1)
        : null;

      const createdDate = normalizeDate(payload.created_at || new Date().toISOString().slice(0, 10));
      const newPr = db.prepare(
        "INSERT INTO purchase_returns (doc_no, purchase_id, supplier_id, total, discount, increase, settlement_type, treasury_id, status, created_by, amendment_of, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)"
      ).run(newDocNo, payload.purchase_id || original.purchase_id || null,
            payload.supplier_id || original.supplier_id || null,
            newTotal, newDiscount, newIncrease, settlementType, treasuryId, payload.user_id || null, original.id,
            `${createdDate} ${new Date().toTimeString().slice(0, 8)}`);

      const newPrId = newPr.lastInsertRowid;

      for (const line of newLines) {
        const qty = Number(line.quantity);
        const cost = Number(line.unit_cost || line.unit_price || 0);
        const warehouseId = Number(line.warehouse_id || 1);
        const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(line.item_id);
        db.prepare(
          `INSERT INTO purchase_return_lines (purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, line_total, warehouse_id, item_name_ar, item_name_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(newPrId, line.purchase_line_id || null, line.item_id, qty, cost, qty * cost,
              warehouseId, itemRow?.name || null, itemRow?.name_en || null);
        adjustStock({ item_id: line.item_id, warehouse_id: warehouseId, quantityDelta: -qty, movement_type: "purchase_return", reference_type: "purchase_return", reference_id: newPrId });
      }

      if (settlementType === 'cash') {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(newTotal, treasuryId);
      } else if (payload.supplier_id || original.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(newTotal, payload.supplier_id || original.supplier_id);
      }

      // 3. Link original → new
      db.prepare("UPDATE purchase_returns SET amended_by = ? WHERE id = ?").run(newPrId, original.id);

      try {
        db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
          payload.user_id || 1, "purchase_return", original.id, "amend", JSON.stringify({ new_return_id: newPrId, reason: payload.reason })
        );
      } catch (_) {}

      return { original: getPurchaseReturnWithLines(db, original.id), new_return: getPurchaseReturnWithLines(db, newPrId) };
    })();

    req.audit("amend", "purchase_return", { original_id: Number(req.params.id), new_id: result?.new_return?.id }, `↩️ تم تعديل (أمندمنت) مرتجع مشتريات #${req.params.id}`, result?.new_return?.id ? `/purchases/returns/${result.new_return.id}` : `/purchases/returns/${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

module.exports = router;
