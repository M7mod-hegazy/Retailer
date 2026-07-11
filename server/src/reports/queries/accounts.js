const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumn, getReturnCostColumn, stockCostJoin, itemsCostJoin } = require("../helpers");
const { paginateSql } = require("../pagination");
const { getProfitLoss } = require("../../services/reportService");

function flattenItemsIntoRows(rows) {
  const result = [];
  for (const row of rows) {
    const hasItems = row._items && row._items.length > 0;
    if (hasItems) {
      const summaryRow = { ...row, _has_items: true };
      delete summaryRow._items;
      result.push(summaryRow);
      for (const item of row._items) {
        result.push({
          _is_item: true,
          type: "item",
          date: row.date,
          ref_no: row.ref_no,
          item_name: item.item_name,
          item_code: item.code || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          barcode: item.barcode || null,
          debit: null,
          credit: null,
          running_balance: null,
          amount: null,
          status: null,
        });
      }
    } else {
      result.push(row);
    }
  }
  return result;
}

function profitLoss(startDate, endDate, opts = {}) {
  const result = getProfitLoss(startDate, endDate);
  if (!result || Array.isArray(result)) return result || [];
  return [{
    label: "الإيرادات",
    amount: result.revenue,
    pct: 100,
    section: "revenue",
  }, {
    label: "الخصومات",
    amount: result.discounts,
    pct: result.revenue > 0 ? Math.round((result.discounts / result.revenue) * 100) : 0,
    section: "revenue",
  }, {
    label: "تكلفة البضاعة المباعة",
    amount: result.cost_of_goods_sold,
    pct: result.revenue > 0 ? Math.round((result.cost_of_goods_sold / result.revenue) * 100) : 0,
    section: "cogs",
  }, {
    label: "إجمالي الربح",
    amount: result.gross_profit,
    pct: result.revenue > 0 ? Math.round((result.gross_profit / result.revenue) * 100) : 0,
    section: "gross_profit",
  }, {
    label: "المصروفات",
    amount: result.expenses,
    pct: result.revenue > 0 ? Math.round((result.expenses / result.revenue) * 100) : 0,
    section: "expenses",
  }, {
    label: "صافي الربح",
    amount: result.net_profit,
    pct: result.revenue > 0 ? Math.round((result.net_profit / result.revenue) * 100) : 0,
    section: "net_profit",
  }];
}

// Build a human-readable Arabic description for a ledger transaction.
function statementDescription(txn) {
  const ref = txn.ref_no ? ` رقم ${txn.ref_no}` : "";
  const orig = txn.orig_ref ? ` — أصل فاتورة ${txn.orig_ref}` : "";
  switch (txn.type) {
    case "invoice": return `فاتورة مبيعات${ref}`;
    case "purchase": return `فاتورة شراء${ref}`;
    case "sales_return": return `مرتجع مبيعات${ref}${orig}`;
    case "purchase_return": return `مرتجع مشتريات${ref}${orig}`;
    case "payment":
    case "ajal_payment": {
      const base = txn._party === "supplier" ? "دفعة إلى مورد" : "دفعة محصلة";
      return txn.ref_no ? `${base}${ref}` : base;
    }
    case "adjustment": return txn.note && String(txn.note).trim() ? String(txn.note).trim() : "تسوية يدوية للرصيد";
    default: return txn.ref_no || "";
  }
}

/**
 * Shared statement assembler.
 *
 * `opening_balance` on customers/suppliers is the LIVE current balance (it is
 * mutated by every transaction), NOT a historical opening. So we reconstruct the
 * true opening by back-computation:
 *   trueOpening   = liveBalance − Σ(all txns ever)
 *   periodOpening = trueOpening + Σ(txns strictly before `startDate`)   // رصيد أول المدة
 *   periodClosing = periodOpening + Σ(in-period txns)                   // رصيد الحركة
 * When `endDate` is today, periodClosing reconciles to the live balance.
 *
 * `txns` must include EVERY transaction (no date filter), ordered ASC by datetime,
 * each shaped { ref_id, ref_no, datetime, date, type, amount, status, note?, orig_ref? }.
 * Rows are enriched with their `_items` from `itemsByKey` (keyed by `type:ref_id`).
 */
function assembleStatement({ name, code, liveBalance, baseOpening, txns, itemsByKey, startDate, endDate, partyType }) {
  const totalAll = txns.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const trueOpening = baseOpening !== undefined && baseOpening !== null ? Number(baseOpening || 0) : Number(liveBalance || 0) - totalAll;
  const periodOpening = trueOpening + txns.reduce((acc, t) => {
    if (startDate && t.date < startDate) return acc + Number(t.amount || 0);
    return acc;
  }, 0);

  const inPeriod = txns.filter((t) => {
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    return true;
  });

  let running = periodOpening;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = inPeriod.map((txn) => {
    const amt = Number(txn.amount || 0);
    running += amt;
    if (amt > 0) totalDebit += amt; else totalCredit += -amt;
    const row = {
      ref_no: txn.ref_no,
      date: txn.date,
      datetime: txn.datetime,
      type: txn.type,
      description: statementDescription({ ...txn, _party: partyType }),
      amount: amt,
      debit: amt > 0 ? amt : 0,
      credit: amt < 0 ? -amt : 0,
      status: txn.status,
      running_balance: running,
      // Document-level financials so item totals reconcile with the ledger amount
      // (general discount/increase) and any cash-settled portion is visible.
      doc_discount: txn.doc_discount != null ? Number(txn.doc_discount) : null,
      doc_increase: txn.doc_increase != null ? Number(txn.doc_increase) : null,
      doc_total: txn.doc_total != null ? Number(txn.doc_total) : null,
      affects_balance: Math.abs(amt) > 0.005,
    };
    const items = itemsByKey[`${txn.type}:${txn.ref_id}`];
    if (items && items.length) row._items = items;
    return row;
  });
  const flatRows = flattenItemsIntoRows(rows);
  return {
    opening_balance: periodOpening,
    closing_balance: running,
    total_debit: totalDebit,
    total_credit: totalCredit,
    transactions: flatRows,
    party_name: name,
    party_code: code,
  };
}

function customerStatementV2(startDate, endDate, opts = {}) {
  const db = getDb();
  const customerId = opts.customer_id;
  if (!customerId) return [];
  const customer = db.prepare("SELECT name, code, COALESCE(opening_balance, 0) AS opening_balance, base_opening_balance FROM customers WHERE id = ?").get(customerId);
  if (!customer) return [];

  // All account transactions ever (no date filter) — back-computation needs the
  // full history. The DEBIT side is the on-account (آجل) portion recorded in
  // ajal_debts.original_amount (cash sales never touch the account balance), so
  // this set's running sum reconciles to the live `opening_balance`.
  const txns = db.prepare(`
    SELECT i.id AS ref_id, i.invoice_no AS ref_no, i.created_at AS datetime, DATE(i.created_at) AS date,
      'invoice' AS type, MAX(0, COALESCE(i.total, 0) - COALESCE(i.amount_received, 0)) AS amount, i.status, NULL AS note, NULL AS orig_ref,
      i.discount AS doc_discount, i.increase AS doc_increase, i.total AS doc_total
    FROM invoices i
    WHERE i.customer_id = ? AND i.status != 'cancelled'
    UNION ALL
    SELECT sr.id, sr.doc_no, sr.created_at, DATE(sr.created_at),
      'sales_return', -CASE
        WHEN sr.refund_method = 'split' THEN COALESCE(sr.credit_amount, 0)
        WHEN sr.refund_method = 'cash_back' THEN 0
        ELSE COALESCE(sr.total, 0)
      END, sr.status, NULL, inv.invoice_no,
      sr.discount, sr.increase, sr.total
    FROM sales_returns sr
    LEFT JOIN invoices inv ON inv.id = sr.invoice_id
    WHERE sr.customer_id = ? AND sr.status = 'active'
    UNION ALL
    SELECT p.id, p.reference_number, p.created_at, DATE(p.created_at),
      'payment', -p.amount, 'paid', p.notes, NULL,
      NULL, NULL, NULL
    FROM payments p
    WHERE p.party_type = 'customer' AND p.party_id = ? AND p.invoice_id IS NULL
    UNION ALL
    SELECT ap.id, COALESCE(inv.invoice_no, 'AJAL-' || ad.id), COALESCE(ap.created_at, ap.payment_date), DATE(COALESCE(ap.payment_date, ap.created_at)),
      'ajal_payment', -ap.amount, 'paid', ap.notes, inv.invoice_no,
      NULL, NULL, NULL
    FROM ajal_payments ap
    JOIN ajal_debts ad ON ad.id = ap.debt_id
    LEFT JOIN invoices inv ON inv.id = ad.invoice_id
    WHERE COALESCE(ad.party_type, 'customer') = 'customer'
      AND ad.customer_id = ?
    UNION ALL
    SELECT n.id, NULL, n.created_at, DATE(n.created_at),
      'adjustment', COALESCE(n.amount, 0), 'adjustment', n.note, NULL,
      NULL, NULL, NULL
    FROM customer_notes n
    WHERE n.customer_id = ? AND n.type = 'adjustment'
    ORDER BY datetime ASC
  `).all(customerId, customerId, customerId, customerId, customerId);

  const itemsByKey = {};
  const invoiceIds = txns.filter(t => t.type === 'invoice').map(t => t.ref_id);
  if (invoiceIds.length > 0) {
    const ph = invoiceIds.map(() => '?').join(',');
    db.prepare(`
      SELECT il.invoice_id AS doc_id, il.quantity, il.unit_price, il.line_total,
        COALESCE(it.name, '') AS item_name, it.code, it.barcode
      FROM invoice_lines il LEFT JOIN items it ON it.id = il.item_id
      WHERE il.invoice_id IN (${ph})
    `).all(...invoiceIds).forEach(l => {
      const k = `invoice:${l.doc_id}`;
      (itemsByKey[k] || (itemsByKey[k] = [])).push({ item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, line_total: l.line_total, code: l.code, barcode: l.barcode });
    });
  }
  const returnIds = txns.filter(t => t.type === 'sales_return').map(t => t.ref_id);
  if (returnIds.length > 0) {
    const ph = returnIds.map(() => '?').join(',');
    db.prepare(`
      SELECT srl.sales_return_id AS doc_id, srl.quantity, srl.unit_price, srl.line_total,
        COALESCE(it.name, srl.item_name_ar, '') AS item_name, it.code, it.barcode
      FROM sales_return_lines srl LEFT JOIN items it ON it.id = srl.item_id
      WHERE srl.sales_return_id IN (${ph})
    `).all(...returnIds).forEach(l => {
      const k = `sales_return:${l.doc_id}`;
      (itemsByKey[k] || (itemsByKey[k] = [])).push({ item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, line_total: l.line_total, code: l.code, barcode: l.barcode });
    });
  }

  const result = assembleStatement({
    name: customer.name, code: customer.code, liveBalance: customer.opening_balance, baseOpening: customer.base_opening_balance,
    txns, itemsByKey, startDate, endDate, partyType: 'customer',
  });
  // Backward-compatible alias kept alongside the generic party_name.
  return { ...result, customer_name: customer.name };
}

function supplierStatementV2(startDate, endDate, opts = {}) {
  const db = getDb();
  const supplierId = opts.supplier_id;
  if (!supplierId) return [];
  const supplier = db.prepare("SELECT name, code, COALESCE(opening_balance, 0) AS opening_balance, base_opening_balance FROM suppliers WHERE id = ?").get(supplierId);
  if (!supplier) return [];

  // DEBIT side = on-account (آجل) portion from ajal_debts.original_amount; cash
  // purchases never touch the supplier balance. This reconciles to the live
  // `opening_balance` (verified against base_opening_balance).
  const txns = db.prepare(`
    SELECT pur.id AS ref_id, pur.doc_no AS ref_no, pur.created_at AS datetime, DATE(pur.created_at) AS date,
      'purchase' AS type, MAX(0, COALESCE(pur.total, 0) - CASE
        WHEN pur.payment_method IN ('cash', 'bank_transfer') THEN COALESCE(pur.total, 0)
        WHEN pur.payment_method = 'multi' THEN COALESCE((
          SELECT SUM(pp.amount) FROM purchase_payments pp
          LEFT JOIN payment_methods pm ON pm.id = pp.method_id
          WHERE pp.purchase_id = pur.id
            AND pm.type IS NOT NULL AND pm.type != 'credit'
            AND COALESCE(pm.category, '') != 'credit'
        ), 0)
        WHEN pur.payment_method IN ('credit', 'future_due') THEN COALESCE((
          SELECT paid_amount FROM ajal_debts
          WHERE invoice_id = pur.id AND source_type = 'purchase' AND status != 'voided'
          ORDER BY id DESC LIMIT 1
        ), 0)
        ELSE 0
      END) AS amount, pur.status, NULL AS note, NULL AS orig_ref,
      pur.discount AS doc_discount, pur.increase AS doc_increase, pur.total AS doc_total
    FROM purchases pur
    WHERE pur.supplier_id = ? AND pur.status != 'cancelled'
    UNION ALL
    SELECT pr.id, pr.doc_no, pr.created_at, DATE(pr.created_at),
      'purchase_return', -CASE
        WHEN pr.settlement_type = 'split' THEN COALESCE(pr.credit_amount, 0)
        WHEN pr.settlement_type = 'cash' THEN 0
        ELSE COALESCE(pr.total, 0)
      END, pr.status, NULL, pur.doc_no,
      pr.discount, pr.increase, pr.total
    FROM purchase_returns pr
    LEFT JOIN purchases pur ON pur.id = pr.purchase_id
    WHERE pr.supplier_id = ? AND pr.status = 'active'
    UNION ALL
    SELECT p.id, p.reference_number, p.created_at, DATE(p.created_at),
      'payment', -p.amount, 'paid', p.notes, NULL,
      NULL, NULL, NULL
    FROM payments p
    WHERE p.party_type = 'supplier' AND p.party_id = ? AND p.invoice_id IS NULL
    UNION ALL
    SELECT ap.id, COALESCE(pur.doc_no, 'AJAL-' || ad.id), COALESCE(ap.created_at, ap.payment_date), DATE(COALESCE(ap.payment_date, ap.created_at)),
      'ajal_payment', -ap.amount, 'paid', ap.notes, pur.doc_no,
      NULL, NULL, NULL
    FROM ajal_payments ap
    JOIN ajal_debts ad ON ad.id = ap.debt_id
    LEFT JOIN purchases pur ON pur.id = ad.invoice_id
    WHERE COALESCE(ad.party_type, 'customer') = 'supplier'
      AND ad.supplier_id = ?
    UNION ALL
    SELECT n.id, NULL, n.created_at, DATE(n.created_at),
      'adjustment', COALESCE(n.amount, 0), 'adjustment', n.note, NULL,
      NULL, NULL, NULL
    FROM supplier_notes n
    WHERE n.supplier_id = ? AND n.type = 'adjustment'
    ORDER BY datetime ASC
  `).all(supplierId, supplierId, supplierId, supplierId, supplierId);

  const itemsByKey = {};
  const purchaseIds = txns.filter(t => t.type === 'purchase').map(t => t.ref_id);
  if (purchaseIds.length > 0) {
    const ph = purchaseIds.map(() => '?').join(',');
    db.prepare(`
      SELECT pl.purchase_id AS doc_id, pl.quantity, pl.unit_cost AS unit_price, pl.line_total,
        COALESCE(it.name, '') AS item_name, it.code, it.barcode
      FROM purchase_lines pl LEFT JOIN items it ON it.id = pl.item_id
      WHERE pl.purchase_id IN (${ph})
    `).all(...purchaseIds).forEach(l => {
      const k = `purchase:${l.doc_id}`;
      (itemsByKey[k] || (itemsByKey[k] = [])).push({ item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, line_total: l.line_total, code: l.code, barcode: l.barcode });
    });
  }
  const returnIds = txns.filter(t => t.type === 'purchase_return').map(t => t.ref_id);
  if (returnIds.length > 0) {
    const ph = returnIds.map(() => '?').join(',');
    db.prepare(`
      SELECT prl.purchase_return_id AS doc_id, prl.quantity, prl.unit_price, prl.line_total,
        COALESCE(it.name, prl.item_name_ar, '') AS item_name, it.code, it.barcode
      FROM purchase_return_lines prl LEFT JOIN items it ON it.id = prl.item_id
      WHERE prl.purchase_return_id IN (${ph})
    `).all(...returnIds).forEach(l => {
      const k = `purchase_return:${l.doc_id}`;
      (itemsByKey[k] || (itemsByKey[k] = [])).push({ item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, line_total: l.line_total, code: l.code, barcode: l.barcode });
    });
  }

  const result = assembleStatement({
    name: supplier.name, code: supplier.code, liveBalance: supplier.opening_balance, baseOpening: supplier.base_opening_balance,
    txns, itemsByKey, startDate, endDate, partyType: 'supplier',
  });
  return { ...result, supplier_name: supplier.name };
}

function dailyOwnerSnapshot(startDate, endDate, opts = {}) {
  const db = getDb();
  const invoiceParams = [];
  const returnParams = [];
  const expenseParams = [];
  const revenueParams = [];
  const withdrawalParams = [];
  const costCol = getCostColumn(opts.cost_method);
  const returnCostCol = getReturnCostColumn(opts.cost_method);
  const sales = db.prepare(`
    SELECT COALESCE(SUM(i.total), 0) AS revenue,
      COALESCE(SUM(i.subtotal), 0) AS selling_total,
      COALESCE(SUM(i.discount), 0) AS discounts,
      COALESCE(SUM(i.increase), 0) AS additions_amount,
      COALESCE(SUM(cost_agg.cogs), 0) AS cogs,
      COUNT(DISTINCT i.id) AS invoice_count
    FROM invoices i
    LEFT JOIN (
      SELECT il.invoice_id, SUM(il.quantity * ${costCol}) AS cogs
      FROM invoice_lines il
      ${itemsCostJoin("il")}
      ${stockCostJoin("il")}
      GROUP BY il.invoice_id
    ) cost_agg ON cost_agg.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, invoiceParams)}
  `).get(...invoiceParams);
  const returns = db.prepare(`
    SELECT COALESCE(SUM(sr.total), 0) AS returns_amount,
      COALESCE(SUM(srl.quantity * ${returnCostCol}), 0) AS return_cost,
      COUNT(DISTINCT sr.id) AS return_count
    FROM sales_returns sr
    LEFT JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
    LEFT JOIN items it ON it.id = srl.item_id
    WHERE sr.status = 'active' ${addDateFilter("sr.created_at", startDate, endDate, returnParams)}
  `).get(...returnParams);
  const expenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
    WHERE 1=1 ${addDateFilter("created_at", startDate, endDate, expenseParams)}
  `).get(...expenseParams).total;
  const revenues = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM revenues
    WHERE 1=1 ${addDateFilter("created_at", startDate, endDate, revenueParams)}
  `).get(...revenueParams).total;
  const withdrawals = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawals
    WHERE 1=1 ${addDateFilter("created_at", startDate, endDate, withdrawalParams)}
  `).get(...withdrawalParams).total;
  const overdue = db.prepare(`
    SELECT COUNT(*) AS count
    FROM ajal_debts
    WHERE source_type = 'invoice' AND status NOT IN ('paid', 'voided')
      AND due_date IS NOT NULL AND DATE(due_date) < DATE('now')
  `).get().count;
  const lowStock = db.prepare(`
    SELECT COUNT(*) AS count
    FROM items it
    JOIN stock_levels sl ON sl.item_id = it.id
    WHERE it.deleted_at IS NULL AND COALESCE(sl.quantity, 0) <= COALESCE(it.min_stock_qty, 0)
  `).get().count;
  const netSales = Number(sales.revenue || 0) - Number(returns.returns_amount || 0);
  const grossProfit = netSales - Number(sales.cogs || 0) + Number(returns.return_cost || 0);
  const netProfit = grossProfit + Number(revenues || 0) - Number(expenses || 0) - Number(withdrawals || 0);
  return [{
    period_start: startDate || null,
    period_end: endDate || null,
    invoice_count: sales.invoice_count,
    selling_total: sales.selling_total,
    total_discount: sales.discounts,
    additions_amount: sales.additions_amount,
    gross_sales: sales.revenue,
    returns_amount: returns.returns_amount,
    net_sales: netSales,
    cogs: sales.cogs,
    gross_profit: grossProfit,
    expenses,
    other_revenues: revenues,
    withdrawals,
    net_profit: netProfit,
    overdue_receivables_count: overdue,
    low_stock_alerts_count: lowStock,
  }];
}

function arAging(startDate, endDate, opts = {}) {
  const db = getDb();
  const { customer_id } = opts;
  const params = [];
  const asOfClause = endDate ? " AND DATE(COALESCE(i.created_at, d.created_at)) <= ?" : "";
  if (endDate) params.push(endDate);
  return db.prepare(`
    WITH debt_rows AS (
      SELECT d.customer_id,
        d.invoice_id,
        COALESCE(i.created_at, d.created_at) AS debt_date,
        MAX(0, COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0)) AS outstanding
      FROM ajal_debts d
      LEFT JOIN invoices i ON i.id = d.invoice_id AND d.source_type = 'invoice' AND i.status != 'cancelled'
      WHERE d.source_type = 'invoice'
        AND COALESCE(d.party_type, 'customer') = 'customer'
        AND d.status != 'voided'
        ${asOfClause}
    ),
    debt_totals AS (
      SELECT customer_id,
        COUNT(DISTINCT invoice_id) AS invoice_count,
        COALESCE(SUM(outstanding), 0) AS debt_total,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) <= 30 THEN outstanding ELSE 0 END), 0) AS aging_0_30,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) BETWEEN 31 AND 60 THEN outstanding ELSE 0 END), 0) AS aging_31_60,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) BETWEEN 61 AND 90 THEN outstanding ELSE 0 END), 0) AS aging_61_90,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) > 90 THEN outstanding ELSE 0 END), 0) AS aging_90_plus,
        MAX(DATE(debt_date)) AS last_invoice_date
      FROM debt_rows
      WHERE outstanding > 0
      GROUP BY customer_id
    )
    SELECT c.id AS customer_id, c.name AS customer_name,
      c.phone,
      c.id AS customer_id,
      COALESCE(dt.invoice_count, 0) AS invoice_count,
      MAX(0, COALESCE(c.opening_balance, 0) - COALESCE(dt.debt_total, 0)) + COALESCE(dt.debt_total, 0) AS total_due,
      COALESCE(dt.aging_0_30, 0) AS aging_0_30,
      COALESCE(dt.aging_31_60, 0) AS aging_31_60,
      COALESCE(dt.aging_61_90, 0) AS aging_61_90,
      COALESCE(dt.aging_90_plus, 0) + MAX(0, COALESCE(c.opening_balance, 0) - COALESCE(dt.debt_total, 0)) AS aging_90_plus,
      COALESCE(dt.aging_31_60, 0) + COALESCE(dt.aging_61_90, 0)
        + COALESCE(dt.aging_90_plus, 0) + MAX(0, COALESCE(c.opening_balance, 0) - COALESCE(dt.debt_total, 0)) AS overdue_amount,
      dt.last_invoice_date
    FROM customers c
    LEFT JOIN debt_totals dt ON dt.customer_id = c.id
    WHERE 1=1 ${customer_id ? " AND c.id = ?" : ""}
      AND (COALESCE(c.opening_balance, 0) != 0 OR COALESCE(dt.debt_total, 0) > 0)
    ORDER BY total_due DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function apAging(startDate, endDate, opts = {}) {
  const db = getDb();
  const { supplier_id } = opts;
  const params = [];
  const asOfClause = endDate ? " AND DATE(COALESCE(p.created_at, d.created_at)) <= ?" : "";
  if (endDate) params.push(endDate);
  return db.prepare(`
    WITH debt_rows AS (
      SELECT d.supplier_id,
        d.invoice_id AS purchase_id,
        COALESCE(p.created_at, d.created_at) AS debt_date,
        MAX(0, COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0)) AS outstanding
      FROM ajal_debts d
      LEFT JOIN purchases p ON p.id = d.invoice_id AND d.source_type = 'purchase' AND p.status != 'cancelled'
      WHERE d.source_type = 'purchase'
        AND COALESCE(d.party_type, 'supplier') = 'supplier'
        AND d.status != 'voided'
        ${asOfClause}
    ),
    debt_totals AS (
      SELECT supplier_id,
        COUNT(DISTINCT purchase_id) AS purchase_count,
        COALESCE(SUM(outstanding), 0) AS debt_total,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) <= 30 THEN outstanding ELSE 0 END), 0) AS aging_0_30,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) BETWEEN 31 AND 60 THEN outstanding ELSE 0 END), 0) AS aging_31_60,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) BETWEEN 61 AND 90 THEN outstanding ELSE 0 END), 0) AS aging_61_90,
        COALESCE(SUM(CASE WHEN julianday('now') - julianday(debt_date) > 90 THEN outstanding ELSE 0 END), 0) AS aging_90_plus,
        MAX(DATE(debt_date)) AS last_purchase_date
      FROM debt_rows
      WHERE outstanding > 0
      GROUP BY supplier_id
    )
    SELECT s.id AS supplier_id, s.name AS supplier_name,
      s.phone,
      s.id AS supplier_id,
      COALESCE(dt.purchase_count, 0) AS purchase_count,
      MAX(0, COALESCE(s.opening_balance, 0) - COALESCE(dt.debt_total, 0)) + COALESCE(dt.debt_total, 0) AS total_due,
      COALESCE(dt.aging_0_30, 0) AS aging_0_30,
      COALESCE(dt.aging_31_60, 0) AS aging_31_60,
      COALESCE(dt.aging_61_90, 0) AS aging_61_90,
      COALESCE(dt.aging_90_plus, 0) + MAX(0, COALESCE(s.opening_balance, 0) - COALESCE(dt.debt_total, 0)) AS aging_90_plus,
      COALESCE(dt.aging_31_60, 0) + COALESCE(dt.aging_61_90, 0)
        + COALESCE(dt.aging_90_plus, 0) + MAX(0, COALESCE(s.opening_balance, 0) - COALESCE(dt.debt_total, 0)) AS overdue_amount,
      dt.last_purchase_date
    FROM suppliers s
    LEFT JOIN debt_totals dt ON dt.supplier_id = s.id
    WHERE 1=1 ${supplier_id ? " AND s.id = ?" : ""}
      AND (COALESCE(s.opening_balance, 0) != 0 OR COALESCE(dt.debt_total, 0) > 0)
    ORDER BY total_due DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
}

function customerBalanceList(startDate, endDate, opts = {}) {
  const db = getDb();
  const { customer_id } = opts;
  let sql = `
    SELECT id, name AS customer_name, phone, opening_balance AS balance,
      CASE WHEN COALESCE(opening_balance, 0) > 0 THEN 'مديون' ELSE 'دائن' END AS balance_label
    FROM customers
    WHERE COALESCE(opening_balance, 0) != 0
    ${customer_id ? " AND id = ?" : ""}
    ORDER BY ABS(opening_balance) DESC
  `;
  const allParams = [...(customer_id ? [customer_id] : [])];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

function supplierBalanceList(startDate, endDate, opts = {}) {
  const db = getDb();
  const { supplier_id } = opts;
  let sql = `
    SELECT id, name AS supplier_name, phone, opening_balance AS balance,
      CASE WHEN COALESCE(opening_balance, 0) > 0 THEN 'دائن' ELSE 'مديون' END AS balance_label
    FROM suppliers
    WHERE COALESCE(opening_balance, 0) != 0
    ${supplier_id ? " AND id = ?" : ""}
    ORDER BY ABS(opening_balance) DESC
  `;
  const allParams = [...(supplier_id ? [supplier_id] : [])];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

function arTotalBalance(startDate, endDate, opts = {}) {
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(SUM(opening_balance), 0) AS total FROM customers").get();
  return Number(row?.total || 0);
}

function apTotalBalance(startDate, endDate, opts = {}) {
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(SUM(opening_balance), 0) AS total FROM suppliers").get();
  return Number(row?.total || 0);
}

module.exports = {
  arAging,
  apAging,
  profitLoss,
  customerStatement: customerStatementV2,
  supplierStatement: supplierStatementV2,
  dailyOwnerSnapshot,
  customerBalanceList,
  supplierBalanceList,
  arTotalBalance,
  apTotalBalance,
};
