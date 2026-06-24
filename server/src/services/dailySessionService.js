const { today: cairoToday } = require("../utils/datetime");

// Cairo wall-clock timestamp. Uses Date methods directly (not Intl) so it
// works reliably even when the Intl timeZone option is not available.
// process.env.TZ = "Africa/Cairo" is set before this module loads, so
// Date getHours/getMinutes etc. return Cairo local time on all platforms.
function cairoTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
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
           WHEN refund_method = 'split' THEN COALESCE(credit_amount, 0)
           ELSE total END
    ), 0) AS total
    FROM sales_returns
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'cancelled'
  `, [date]);
  const purchaseReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(settlement_type, 'account') = 'cash' THEN total
           WHEN settlement_type = 'split' THEN COALESCE(cash_amount, 0)
           ELSE 0 END
    ), 0) AS total
    FROM purchase_returns
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'cancelled'
  `, [date]);
  const purchaseReturnsAccount = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(settlement_type, 'account') = 'cash' THEN 0
           WHEN settlement_type = 'split' THEN COALESCE(credit_amount, 0)
           ELSE total END
    ), 0) AS total
    FROM purchase_returns
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'cancelled'
  `, [date]);
  const salesReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(
      CASE WHEN COALESCE(refund_method, 'cash_back') = 'cash_back' THEN total
           WHEN refund_method = 'split' THEN COALESCE(cash_amount, 0)
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
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL
  `, [date]);
  const customerPaymentsCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash' AND invoice_id IS NULL
  `, [date]);
  const supplierPayments = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'supplier' AND method = 'cash'
  `, [date]);
  const supplierPaymentsCount = countScalar(db, `
    SELECT COUNT(*) AS count
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
  // Cash in = all cash received from sales (including installment/multi cash portions) + collections + revenues + purchase returns
  const cashIn = posTotalCashReceived + customerCashCollections + revenuesCash + purchaseReturnsCash;
  const cashOut = expensesCash + supplierCashPayments + salesReturnsCash + withdrawals + purchasesCash;

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
    supplier_payments: supplierPayments,
    supplier_payments_count: supplierPaymentsCount,
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
    SELECT COALESCE(SUM(amount),0) AS total FROM payments
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
           WHEN settlement_type = 'split' THEN COALESCE(cash_amount, 0)
           ELSE 0 END
    ),0) AS total FROM purchase_returns
    WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(status,'') != 'cancelled'
  `, [since, date]);

  const expensesCash = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM expenses
    WHERE date(created_at) > ? AND date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'
  `, [since, date]);

  const supplierPayments = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM payments
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
           WHEN refund_method = 'split' THEN COALESCE(cash_amount, 0)
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

  const deltaCashIn = posCash + posInstallmentCash + posMultiCash + customerPayments + customerAjalPayments + revenuesCash + purchaseReturnsCash;
  const deltaCashOut = expensesCash + supplierPayments + supplierAjalPayments + salesReturnsCash + withdrawals + purchasesCash;
  return anchorBalance + deltaCashIn - deltaCashOut;
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
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
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
  calculateDailySummary,
  closeDailySession,
  ensureDailySessionSchema,
  ensureCashCountSchema,
  ensureSessionForDate,
  getSession,
  localDate,
  normalizeDate,
  listCashCounts,
  addCashCount,
  updateCashCount,
  deleteCashCount,
  setDayNote,
};
