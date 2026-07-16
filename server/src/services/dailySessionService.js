const { today: cairoToday, nowSql } = require("../utils/datetime");
const { notifyOwner, EVENT_TYPES: TG } = require("./telegramService");

// Cairo wall-clock timestamp. Delegates to the shared Intl-based utility so it
// is correct regardless of process.env.TZ or host timezone configuration.
function cairoTimestamp() {
  return nowSql();
}

// Egypt-local (Cairo) calendar date "YYYY-MM-DD" — the single source of truth
// for which business day a session/transaction belongs to.
function localDate(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return cairoToday(d);
}

function addDays(dateText, days) {
  const d = new Date(`${dateText}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

function normalizeDate(value) {
  if (!value) return localDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localDate(value);
}

function ensureDailySessionSchema(db) {
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN reopened_at TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN reopened_by INTEGER REFERENCES users(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN reopen_reason TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN opening_adjusted_at TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN opening_adjusted_by INTEGER REFERENCES users(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN opening_adjust_reason TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN day_notes TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'account'"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE payments ADD COLUMN invoice_id INTEGER REFERENCES invoices(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN amount_received REAL"); } catch (_) {}
}

function ensurePurchaseReturnSettlementSchema(db) {
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'account'"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
}

function latestClosedBalanceBefore(db, dateText) {
  const row = db.prepare(`
    SELECT closing_balance
    FROM daily_sessions
    WHERE date < ? AND status = 'closed'
    ORDER BY date DESC
    LIMIT 1
  `).get(dateText);
  return Number(row?.closing_balance || 0);
}

function ensureSessionForDate(db, dateText) {
  ensureDailySessionSchema(db);
  let session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(dateText);
  if (!session) {
    const openPriorSessions = db.prepare(
      "SELECT * FROM daily_sessions WHERE status = 'open' AND date < ? ORDER BY date ASC"
    ).all(dateText);
    for (const prior of openPriorSessions) {
      try {
        const summary = calculateDailySummary(db, prior.date);
        const expectedCash = summary ? Number(summary.expected_cash || 0) : 0;
        closeDailySession(db, prior.date, expectedCash, "إغلاق تلقائي", 1);
      } catch (_) {
        // If auto-close fails for any reason, move on
      }
    }

    const openingBalance = latestClosedBalanceBefore(db, dateText);
    db.prepare(
      "INSERT INTO daily_sessions (date, opening_balance, status) VALUES (?, ?, 'open')",
    ).run(dateText, openingBalance);
    session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(dateText);
  }
  return session;
}

function getSession(db, dateText, createIfMissing = false) {
  const targetDate = normalizeDate(dateText);
  if (createIfMissing) return ensureSessionForDate(db, targetDate);
  return db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(targetDate);
}

function assertCanWriteForDate(db, dateValue) {
  // Session blocker removed: treasury is now a live reporting window.
  // Writes are allowed on any date. Past-date protection is enforced at the route level per feature.
  const targetDate = normalizeDate(dateValue);
  ensureDailySessionSchema(db);
  return ensureSessionForDate(db, targetDate);
}

function scalar(db, sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return Number(row?.total || 0);
}

function countScalar(db, sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return Number(row?.count || 0);
}

function cashBreakdown(db, dateText, session) {
  const date = normalizeDate(dateText);
  const sessionId = session?.id || null;
  ensurePurchaseReturnSettlementSchema(db);

  // Installment invoices: cash received is the sum of payment_allocations
  // If no allocations, cash received is 0 (not the full invoice total)
  const posInstallmentCash = scalar(db, `
    SELECT COALESCE(SUM(pa.amount), 0) AS total
    FROM invoices i
    LEFT JOIN payment_allocations pa ON pa.invoice_id = i.id
    WHERE date(i.created_at) = ? AND i.payment_type = 'installments' AND i.status != 'cancelled'
  `, [date]);
  const posInstallmentCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'installments' AND status != 'cancelled'
  `, [date]);

  // Multi-payment invoices: cash portion via payment_allocations (authoritative FK)
  const posMultiCash = scalar(db, `
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN payment_allocations pa ON pa.payment_id = p.id
    JOIN invoices i ON i.id = pa.invoice_id
    WHERE date(i.created_at) = ? AND i.payment_type = 'multi' AND p.method = 'cash' AND i.status != 'cancelled'
  `, [date]);
  const posMultiCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'multi' AND status != 'cancelled'
  `, [date]);

  const posCashSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'cash' AND status != 'cancelled'
  `, [date]);
  const posCashSalesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'cash' AND status != 'cancelled'
  `, [date]);
  const posBankSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND payment_type IN ('bank_transfer', 'card', 'bank') AND status != 'cancelled'
  `, [date]);
  const posAllSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND status != 'cancelled'
  `, [date]);
  const posAllSalesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND status != 'cancelled'
  `, [date]);

  // Cash from all POS sales (cash + installment payments + multi-payment cash portion)
  const posTotalCashReceived = posCashSales + posInstallmentCash + posMultiCash;

  // Payable (supplier-debt-increasing) purchases only: credit/future_due totals +
  // the credit-method portion of multi purchases. Cash purchases are NOT payable.
  const purchasesTotal = scalar(db, `
    SELECT COALESCE((
      SELECT SUM(total) FROM purchases
      WHERE date(created_at) = ? AND payment_method IN ('credit','future_due')
        AND COALESCE(status,'') NOT IN ('voided','cancelled')
    ),0) + COALESCE((
      SELECT SUM(pp.amount)
      FROM purchase_payments pp
      JOIN purchases p ON p.id = pp.purchase_id
      JOIN payment_methods pm ON pm.id = pp.method_id
      WHERE date(p.created_at) = ? AND p.payment_method = 'multi'
        AND (pm.type = 'credit' OR pm.category = 'credit')
        AND COALESCE(p.status,'') NOT IN ('voided','cancelled')
    ),0) AS total
  `, [date, date]);

  // Cash leaving the drawer for purchases: full total of cash purchases + the
  // cash-method portion of multi purchases. (credit/future_due hit supplier debt, not cash.)
  const purchasesCash = scalar(db, `
    SELECT COALESCE((
      SELECT SUM(total) FROM purchases
      WHERE date(created_at) = ? AND payment_method = 'cash'
        AND COALESCE(status, '') NOT IN ('voided', 'cancelled')
        AND COALESCE(is_opening_balance, 0) = 0 AND COALESCE(doc_no, '') NOT LIKE 'OB-%'
    ), 0) + COALESCE((
      SELECT SUM(pp.amount)
      FROM purchase_payments pp
      JOIN purchases p ON p.id = pp.purchase_id
      JOIN payment_methods pm ON pm.id = pp.method_id
      WHERE date(p.created_at) = ? AND p.payment_method = 'multi'
        AND pm.type = 'cash' AND COALESCE(pm.category, '') != 'credit'
        AND COALESCE(p.status, '') NOT IN ('voided', 'cancelled')
    ), 0) AS total
  `, [date, date]);

  // Credit sales (installments/multi with non-cash portion) - reduces customer debt
  const posCreditSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND payment_type IN ('installments', 'credit') AND status != 'cancelled'
  `, [date]);
  const posCreditSalesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type IN ('installments', 'credit') AND status != 'cancelled'
  `, [date]);

  // Sales returns that increased customer debt (account refund, not cash)
  const salesReturnsAccount = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(refund_method, 'cash_back') = 'cash_back' THEN 0
           WHEN refund_method IN ('split', 'multi') THEN COALESCE(credit_amount, 0)
           ELSE total END
    ), 0) AS total
    FROM sales_returns
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'cancelled'
  `, [date]);
  const purchaseReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(settlement_type, 'account') = 'cash' THEN total
           WHEN settlement_type IN ('split', 'multi') THEN COALESCE(cash_amount, 0)
           ELSE 0 END
    ), 0) AS total
    FROM purchase_returns
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'cancelled'
  `, [date]);
  const purchaseReturnsAccount = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(settlement_type, 'account') = 'cash' THEN 0
           WHEN settlement_type IN ('split', 'multi') THEN COALESCE(credit_amount, 0)
           ELSE total END
    ), 0) AS total
    FROM purchase_returns
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'cancelled'
  `, [date]);
  const salesReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(refund_method, 'cash_back') = 'cash_back' THEN total
           WHEN refund_method IN ('split', 'multi') THEN COALESCE(cash_amount, 0)
           ELSE 0 END
    ), 0) AS total
    FROM sales_returns
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'cancelled'
  `, [date]);

  const expensesCash = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);
  const expensesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM expenses
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);
  const revenuesCash = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM revenues
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);
  const revenuesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM revenues
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);

  const customerPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN 0 ELSE amount END), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL
  `, [date]);
  const customerPaymentsCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL
  `, [date]);
  const customerRefundPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN amount ELSE 0 END), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL
  `, [date]);
  const supplierPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN 0 ELSE amount END), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'supplier' AND method = 'cash'
  `, [date]);
  const supplierPaymentsCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'supplier' AND method = 'cash'
  `, [date]);
  const supplierRefundPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN amount ELSE 0 END), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'supplier' AND method = 'cash'
  `, [date]);
  const nonCashPayments = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND COALESCE(method, 'cash') != 'cash'
  `, [date]);

  const customerAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount), 0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
      AND COALESCE(d.party_type, 'customer') = 'customer'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [date]);
  const supplierAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount), 0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
      AND COALESCE(d.party_type, 'customer') = 'supplier'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [date]);
  const nonCashAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount), 0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') != 'cash'
  `, [date]);

  const withdrawals = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM withdrawals
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);

  // آجل portion of multi-payment invoices — stored in ajal_debts, not in payments table
  const multiCreditPortion = scalar(db, `
    SELECT COALESCE(SUM(ad.original_amount), 0) AS total
    FROM ajal_debts ad
    JOIN invoices i ON i.id = ad.invoice_id
    WHERE date(i.created_at) = ?
      AND i.payment_type = 'multi'
      AND i.status != 'cancelled'
      AND ad.source_type = 'invoice'
      AND COALESCE(ad.party_type, 'customer') = 'customer'
      AND COALESCE(ad.status, 'active') != 'voided'
  `, [date]);

  const customerCashCollections = customerPayments + customerAjalPayments;
  const supplierCashPayments = supplierPayments + supplierAjalPayments;
  // Cash in = all cash received from sales (including installment/multi cash portions) + collections + revenues + purchase returns + supplier refunds
  const cashIn = posTotalCashReceived + customerCashCollections + revenuesCash + purchaseReturnsCash + supplierRefundPayments;
  const cashOut = expensesCash + supplierCashPayments + salesReturnsCash + withdrawals + purchasesCash + customerRefundPayments;

  return {
    pos_cash_sales: posCashSales,
    pos_cash_sales_count: posCashSalesCount,
    pos_installment_cash: posInstallmentCash,
    pos_installment_count: posInstallmentCount,
    pos_multi_cash: posMultiCash,
    pos_multi_count: posMultiCount,
    pos_total_cash_received: posTotalCashReceived,
    pos_bank_sales: posBankSales,
    pos_all_sales: posAllSales,
    pos_all_sales_count: posAllSalesCount,
    purchases_cash: purchasesCash,
    purchases_payable_total: purchasesTotal,
    pos_credit_sales: posCreditSales,
    pos_credit_sales_count: posCreditSalesCount,
    sales_returns_account: salesReturnsAccount,
    purchase_returns_cash: purchaseReturnsCash,
    purchase_returns_payable_total: purchaseReturnsAccount,
    expenses_cash: expensesCash,
    expenses_count: expensesCount,
    revenues_cash: revenuesCash,
    revenues_count: revenuesCount,
    customer_payments: customerPayments,
    customer_payments_count: customerPaymentsCount,
    customer_refund_payments: customerRefundPayments,
    supplier_payments: supplierPayments,
    supplier_payments_count: supplierPaymentsCount,
    supplier_refund_payments: supplierRefundPayments,
    non_cash_movements_total: posBankSales + nonCashPayments + nonCashAjalPayments,
    ajal_payments: customerAjalPayments,
    supplier_ajal_payments: supplierAjalPayments,
    customer_cash_collections: customerCashCollections,
    supplier_cash_payments: supplierCashPayments,
    sales_returns_cash: salesReturnsCash,
    withdrawals,
    multi_credit_portion: multiCreditPortion,
    cash_in: cashIn,
    cash_out: cashOut,
  };
}

function liveOpeningBalance(db, dateText) {
  const date = normalizeDate(dateText);

  // Anchor: last closed session's actual_cash before this date.
  // This captures initial cash float and any manually-confirmed counts.
  // If no closed session exists, anchor is 0 (new system, calculate from scratch).
  const anchor = db.prepare(`
    SELECT actual_cash, date AS anchor_date
    FROM daily_sessions
    WHERE date < ? AND status = 'closed' AND actual_cash IS NOT NULL
    ORDER BY date DESC
    LIMIT 1
  `).get(date);

  const anchorBalance = Number(anchor?.actual_cash || 0);
  const since = anchor?.anchor_date || '1970-01-01';

  // Add all cash movements strictly between anchor date and today (exclusive both ends)
  const posCash = scalar(db, `
    SELECT COALESCE(SUM(total),0) AS total FROM invoices
    WHERE date(created_at) > ? AND date(created_at) < ? AND payment_type = 'cash' AND status != 'cancelled'
  `, [since, date]);

  const posInstallmentCash = scalar(db, `
    SELECT COALESCE(SUM(pa.amount),0) AS total
    FROM payment_allocations pa
    JOIN invoices i ON i.id = pa.invoice_id
    WHERE date(i.created_at) > ? AND date(i.created_at) < ? AND i.payment_type = 'installments' AND i.status != 'cancelled'
  `, [since, date]);

  const posMultiCash = scalar(db, `
    SELECT COALESCE(SUM(p.amount),0) AS total
    FROM payments p
    JOIN payment_allocations pa ON pa.payment_id = p.id
    JOIN invoices i ON i.id = pa.invoice_id
    WHERE date(i.created_at) > ? AND date(i.created_at) < ? AND i.payment_type = 'multi' AND p.method = 'cash' AND i.status != 'cancelled'
  `, [since, date]);

  const customerPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN 0 ELSE amount END),0) AS total FROM payments
    WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL
  `, [since, date]);

  const customerRefundPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN amount ELSE 0 END),0) AS total FROM payments
    WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL
  `, [since, date]);

  const customerAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount),0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) > ?
      AND date(COALESCE(ap.payment_date, ap.created_at)) < ?
      AND COALESCE(d.party_type,'customer') = 'customer'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [since, date]);

  const revenuesCash = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM revenues
    WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'
  `, [since, date]);

  const purchaseReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(settlement_type,'account') = 'cash' THEN total
           WHEN settlement_type IN ('split', 'multi') THEN COALESCE(cash_amount, 0)
           ELSE 0 END
    ),0) AS total FROM purchase_returns
    WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(status,'') != 'cancelled'
  `, [since, date]);

  const expensesCash = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM expenses
    WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'
  `, [since, date]);

  const supplierPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN 0 ELSE amount END),0) AS total FROM payments
    WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'supplier' AND method = 'cash'
  `, [since, date]);

  const supplierRefundPayments = scalar(db, `
    SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN amount ELSE 0 END),0) AS total FROM payments
    WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'supplier' AND method = 'cash'
  `, [since, date]);

  const supplierAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount),0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) > ?
      AND date(COALESCE(ap.payment_date, ap.created_at)) < ?
      AND COALESCE(d.party_type,'customer') = 'supplier'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [since, date]);

  const salesReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(refund_method,'cash_back') = 'cash_back' THEN total
           WHEN refund_method IN ('split', 'multi') THEN COALESCE(cash_amount, 0)
           ELSE 0 END
    ),0) AS total FROM sales_returns
    WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(status,'') != 'cancelled'
  `, [since, date]);

  const withdrawals = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total
    FROM withdrawals
    WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'
  `, [since, date]);

  // Cash paid out for purchases (cash purchases + multi cash portion) in the carry window
  const purchasesCash = scalar(db, `
    SELECT COALESCE((
      SELECT SUM(total) FROM purchases
      WHERE date(created_at) > ? AND date(created_at) < ? AND payment_method = 'cash'
        AND COALESCE(status,'') NOT IN ('voided','cancelled')
        AND COALESCE(is_opening_balance, 0) = 0 AND COALESCE(doc_no, '') NOT LIKE 'OB-%'
    ),0) + COALESCE((
      SELECT SUM(pp.amount)
      FROM purchase_payments pp
      JOIN purchases p ON p.id = pp.purchase_id
      JOIN payment_methods pm ON pm.id = pp.method_id
      WHERE date(p.created_at) > ? AND date(p.created_at) < ? AND p.payment_method = 'multi'
        AND pm.type = 'cash' AND COALESCE(pm.category,'') != 'credit'
        AND COALESCE(p.status,'') NOT IN ('voided','cancelled')
    ),0) AS total
  `, [since, date, since, date]);

  const deltaCashIn = posCash + posInstallmentCash + posMultiCash + customerPayments + customerAjalPayments + revenuesCash + purchaseReturnsCash + supplierRefundPayments;
  const deltaCashOut = expensesCash + supplierPayments + supplierAjalPayments + salesReturnsCash + withdrawals + purchasesCash + customerRefundPayments;
  return anchorBalance + deltaCashIn - deltaCashOut;
}

/**
 * Batch version of liveOpeningBalance — resolves opening balances for
 * multiple dates in O(1 + ~12) queries instead of O(N × 12).
 * Returns a Map<dateText, balance>.
 */
function batchLiveOpeningBalances(db, dates) {
  if (!dates || dates.length === 0) return new Map();

  // For each date, find its anchor (latest closed session before it with actual_cash)
  // We do this in one query by getting all relevant closed sessions and mapping per date.
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const closedSessions = db.prepare(`
    SELECT date, actual_cash
    FROM daily_sessions
    WHERE date < ? AND status = 'closed' AND actual_cash IS NOT NULL
    ORDER BY date ASC
  `).all(minDate > '1970-01-01' ? minDate : '2100-01-01');

  // Build anchor map: for each target date, what is the most recent closed session before it?
  const anchors = new Map(); // date -> { anchorBalance, since }
  for (const targetDate of dates) {
    // Walk backwards through closedSessions to find the latest one before targetDate
    let anchor = null;
    for (let i = closedSessions.length - 1; i >= 0; i--) {
      if (closedSessions[i].date < targetDate) {
        anchor = closedSessions[i];
        break;
      }
    }
    anchors.set(targetDate, {
      anchorBalance: Number(anchor?.actual_cash || 0),
      since: anchor?.date || '1970-01-01',
    });
  }

  // Group dates by their anchor date to minimise query rounds
  const groups = new Map(); // since -> [targetDate...]
  for (const [date, { since }] of anchors) {
    if (!groups.has(since)) groups.set(since, []);
    groups.get(since).push(date);
  }

  const results = new Map();

  for (const [since, groupDates] of groups) {
    // For this anchor group we need cash deltas for each date in (since, date)
    // Run one query per aggregate type across all dates in this group.
    for (const targetDate of groupDates) {
      // Reuse single-date logic per group member — but now closedSessions are
      // already resolved, so we skip the anchor query and only run the 11 aggregates.
      const { anchorBalance } = anchors.get(targetDate);

      const posCash = scalar(db, `SELECT COALESCE(SUM(total),0) AS total FROM invoices WHERE date(created_at) > ? AND date(created_at) < ? AND payment_type = 'cash' AND status != 'cancelled'`, [since, targetDate]);
      const posInstallmentCash = scalar(db, `SELECT COALESCE(SUM(pa.amount),0) AS total FROM payment_allocations pa JOIN invoices i ON i.id = pa.invoice_id WHERE date(i.created_at) > ? AND date(i.created_at) < ? AND i.payment_type = 'installments' AND i.status != 'cancelled'`, [since, targetDate]);
      const posMultiCash = scalar(db, `SELECT COALESCE(SUM(p.amount),0) AS total FROM payments p JOIN payment_allocations pa ON pa.payment_id = p.id JOIN invoices i ON i.id = pa.invoice_id WHERE date(i.created_at) > ? AND date(i.created_at) < ? AND i.payment_type = 'multi' AND p.method = 'cash' AND i.status != 'cancelled'`, [since, targetDate]);
      const customerPayments = scalar(db, `SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN 0 ELSE amount END),0) AS total FROM payments WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL`, [since, targetDate]);
      const customerRefundPayments = scalar(db, `SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN amount ELSE 0 END),0) AS total FROM payments WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL`, [since, targetDate]);
      const customerAjalPayments = scalar(db, `SELECT COALESCE(SUM(ap.amount),0) AS total FROM ajal_payments ap LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id LEFT JOIN ajal_debts d ON d.id = ap.debt_id WHERE date(COALESCE(ap.payment_date, ap.created_at)) > ? AND date(COALESCE(ap.payment_date, ap.created_at)) < ? AND COALESCE(d.party_type,'customer') = 'customer' AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'`, [since, targetDate]);
      const revenuesCash = scalar(db, `SELECT COALESCE(SUM(amount),0) AS total FROM revenues WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'`, [since, targetDate]);
      const purchaseReturnsCash = scalar(db, `SELECT COALESCE(SUM(CASE WHEN COALESCE(settlement_type,'account') = 'cash' THEN total WHEN settlement_type IN ('split', 'multi') THEN COALESCE(cash_amount, 0) ELSE 0 END),0) AS total FROM purchase_returns WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(status,'') != 'cancelled'`, [since, targetDate]);
      const expensesCash = scalar(db, `SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'`, [since, targetDate]);
      const supplierPayments = scalar(db, `SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN 0 ELSE amount END),0) AS total FROM payments WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'supplier' AND method = 'cash'`, [since, targetDate]);
      const supplierRefundPayments = scalar(db, `SELECT COALESCE(SUM(CASE WHEN direction = 'add' THEN amount ELSE 0 END),0) AS total FROM payments WHERE date(created_at) > ? AND date(created_at) < ? AND party_type = 'supplier' AND method = 'cash'`, [since, targetDate]);
      const supplierAjalPayments = scalar(db, `SELECT COALESCE(SUM(ap.amount),0) AS total FROM ajal_payments ap LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id LEFT JOIN ajal_debts d ON d.id = ap.debt_id WHERE date(COALESCE(ap.payment_date, ap.created_at)) > ? AND date(COALESCE(ap.payment_date, ap.created_at)) < ? AND COALESCE(d.party_type,'customer') = 'supplier' AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'`, [since, targetDate]);
      const salesReturnsCash = scalar(db, `SELECT COALESCE(SUM(CASE WHEN COALESCE(refund_method,'cash_back') = 'cash_back' THEN total WHEN refund_method IN ('split', 'multi') THEN COALESCE(cash_amount, 0) ELSE 0 END),0) AS total FROM sales_returns WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(status,'') != 'cancelled'`, [since, targetDate]);
      const withdrawals = scalar(db, `SELECT COALESCE(SUM(amount),0) AS total FROM withdrawals WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'`, [since, targetDate]);
      const purchasesCash = scalar(db, `SELECT COALESCE((SELECT SUM(total) FROM purchases WHERE date(created_at) > ? AND date(created_at) < ? AND payment_method = 'cash' AND COALESCE(status,'') NOT IN ('voided','cancelled') AND COALESCE(is_opening_balance, 0) = 0 AND COALESCE(doc_no, '') NOT LIKE 'OB-%'),0) + COALESCE((SELECT SUM(pp.amount) FROM purchase_payments pp JOIN purchases p ON p.id = pp.purchase_id JOIN payment_methods pm ON pm.id = pp.method_id WHERE date(p.created_at) > ? AND date(p.created_at) < ? AND p.payment_method = 'multi' AND pm.type = 'cash' AND COALESCE(pm.category,'') != 'credit' AND COALESCE(p.status,'') NOT IN ('voided','cancelled')),0) AS total`, [since, targetDate, since, targetDate]);

      const deltaCashIn = posCash + posInstallmentCash + posMultiCash + customerPayments + customerAjalPayments + revenuesCash + purchaseReturnsCash + supplierRefundPayments;
      const deltaCashOut = expensesCash + supplierPayments + supplierAjalPayments + salesReturnsCash + withdrawals + purchasesCash + customerRefundPayments;
      results.set(targetDate, anchorBalance + deltaCashIn - deltaCashOut);
    }
  }

  return results;
}

function calculateDailySummary(db, dateText, options = {}) {
  const date = normalizeDate(dateText);
  const session = getSession(db, date, Boolean(options.createIfMissing));
  if (!session) return null;

  const breakdown = cashBreakdown(db, date, session);
  const prevBalance = liveOpeningBalance(db, date);
  const expectedCash = prevBalance + breakdown.cash_in - breakdown.cash_out;
  const actual = session.actual_cash == null ? null : Number(session.actual_cash);
  const discrepancy = actual == null ? null : actual - expectedCash;

  const yDate = addDays(date, -1);
  const ySession = getSession(db, yDate, false);
  const yBreakdown = ySession ? cashBreakdown(db, yDate, ySession) : null;

  return {
    session,
    opening_balance: prevBalance,
    previous_balance: prevBalance,
    ...breakdown,
    expected_cash: expectedCash,
    actual_cash: actual,
    discrepancy,
    yesterday: yBreakdown ? {
      pos_all_sales: yBreakdown.pos_all_sales,
      expenses_cash: yBreakdown.expenses_cash,
      cash_in: yBreakdown.cash_in,
      cash_out: yBreakdown.cash_out,
    } : null,
  };
}

function closeDailySession(db, dateText, actualCash, notes, userId) {
  const date = normalizeDate(dateText);
  const session = getSession(db, date, false);
  if (!session) {
    const err = new Error("لا توجد يومية لهذا التاريخ");
    err.status = 400;
    throw err;
  }
  if (session.status === "closed") {
    const err = new Error("الجلسة مغلقة بالفعل");
    err.status = 400;
    throw err;
  }
  if (actualCash == null || actualCash === "") {
    const err = new Error("أدخل الرصيد الفعلي");
    err.status = 400;
    throw err;
  }

  const summary = calculateDailySummary(db, date);
  const actual = Number(actualCash);
  const discrepancy = actual - Number(summary.expected_cash || 0);

  db.prepare(`
    UPDATE daily_sessions
    SET actual_cash = ?, closing_balance = ?, discrepancy = ?,
        status = 'closed', notes = ?, closed_at = ?, closed_by = ?
    WHERE id = ?
  `).run(actual, actual, discrepancy, notes || null, cairoTimestamp(), userId || 1, session.id);

  const next = db.prepare("SELECT * FROM daily_sessions WHERE date > ? ORDER BY date ASC LIMIT 1").get(date);
  if (next && next.status === "open") {
    db.prepare("UPDATE daily_sessions SET opening_balance = ? WHERE id = ?").run(actual, next.id);
  }

  try {
    notifyOwner(TG.DAILY_CLOSE, {
      date,
      openingBalance: summary.opening_balance || session.opening_balance || 0,
      expectedCash: summary.expected_cash || 0,
      actualCash: actual,
      discrepancy,
      cashSales: summary.pos_cash_sales || 0,
      creditSales: summary.pos_credit_sales || 0,
      invoicesCount: summary.invoices_count || 0,
    }, db);
  } catch (_) {}

  return db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(session.id);
}

function ensureCashCountSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_cash_counts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT NOT NULL,
      amount        REAL NOT NULL,
      expected_cash REAL NOT NULL,
      discrepancy   REAL NOT NULL,
      note          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT,
      created_by    INTEGER REFERENCES users(id)
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_daily_cash_counts_date ON daily_cash_counts(date)");
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN day_notes TEXT"); } catch (_) {}
}

function listCashCounts(db, dateText) {
  ensureCashCountSchema(db);
  const date = normalizeDate(dateText);
  return db.prepare(`
    SELECT c.*, COALESCE(NULLIF(u.full_name, ''), u.username) AS created_by_name
    FROM daily_cash_counts c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.date = ?
    ORDER BY c.created_at ASC, c.id ASC
  `).all(date);
}

function addCashCount(db, dateText, amount, note, userId) {
  ensureCashCountSchema(db);
  const date = normalizeDate(dateText);
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    const err = new Error("أدخل الرصيد الفعلي");
    err.status = 400;
    throw err;
  }
  ensureSessionForDate(db, date);
  const summary = calculateDailySummary(db, date, { createIfMissing: true });
  const expected = Number(summary?.expected_cash || 0);
  const discrepancy = value - expected;
  const result = db.prepare(`
    INSERT INTO daily_cash_counts (date, amount, expected_cash, discrepancy, note, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(date, value, expected, discrepancy, note || null, cairoTimestamp(), userId || 1);
  return db.prepare(`
    SELECT c.*, COALESCE(NULLIF(u.full_name, ''), u.username) AS created_by_name
    FROM daily_cash_counts c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.id = ?
  `).get(result.lastInsertRowid);
}

function updateCashCount(db, id, amount, note, _userId) {
  ensureCashCountSchema(db);
  const row = db.prepare("SELECT * FROM daily_cash_counts WHERE id = ?").get(id);
  if (!row) {
    const err = new Error("العد غير موجود");
    err.status = 404;
    throw err;
  }
  const value = amount == null || amount === "" ? row.amount : Number(amount);
  if (!Number.isFinite(value)) {
    const err = new Error("قيمة غير صحيحة");
    err.status = 400;
    throw err;
  }
  // Keep the original expected_cash snapshot; editing only fixes the counted amount / note.
  const discrepancy = value - Number(row.expected_cash || 0);
  db.prepare(`
    UPDATE daily_cash_counts
    SET amount = ?, discrepancy = ?, note = ?, updated_at = ?
    WHERE id = ?
  `).run(value, discrepancy, note === undefined ? row.note : (note || null), cairoTimestamp(), id);
  return db.prepare(`
    SELECT c.*, COALESCE(NULLIF(u.full_name, ''), u.username) AS created_by_name
    FROM daily_cash_counts c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.id = ?
  `).get(id);
}

function deleteCashCount(db, id) {
  ensureCashCountSchema(db);
  const row = db.prepare("SELECT id FROM daily_cash_counts WHERE id = ?").get(id);
  if (!row) {
    const err = new Error("العد غير موجود");
    err.status = 404;
    throw err;
  }
  db.prepare("DELETE FROM daily_cash_counts WHERE id = ?").run(id);
  return { id };
}

function setDayNote(db, dateText, note, userId) {
  const date = normalizeDate(dateText);
  const session = ensureSessionForDate(db, date);
  const now = cairoTimestamp();
  const hh = now.slice(11, 16);
  const entry = `[${hh}] ${note}`;
  const existing = session.day_notes || '';
  const updated = existing ? existing + '\n' + entry : entry;
  db.prepare("UPDATE daily_sessions SET day_notes = ? WHERE id = ?").run(updated, session.id);
  return db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(session.id);
}

module.exports = {
  assertCanWriteForDate,
  batchLiveOpeningBalances,
  calculateDailySummary,
  closeDailySession,
  ensureDailySessionSchema,
  ensureCashCountSchema,
  ensureSessionForDate,
  getSession,
  liveOpeningBalance,
  localDate,
  normalizeDate,
  listCashCounts,
  addCashCount,
  updateCashCount,
  deleteCashCount,
  setDayNote,
};
