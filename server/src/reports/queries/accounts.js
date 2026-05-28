const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumn, getReturnCostColumn } = require("../helpers");
const { getProfitLoss } = require("../../services/reportService");

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
      LEFT JOIN invoices i ON i.id = d.invoice_id AND d.source_type = 'invoice'
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
    SELECT c.name AS customer_name,
      c.phone,
      c.id AS customer_id,
      COALESCE(dt.invoice_count, 0) AS invoice_count,
      MAX(0, COALESCE(c.opening_balance, 0) - COALESCE(dt.debt_total, 0)) + COALESCE(dt.debt_total, 0) AS total_due,
      COALESCE(dt.aging_0_30, 0) AS aging_0_30,
      COALESCE(dt.aging_31_60, 0) AS aging_31_60,
      COALESCE(dt.aging_61_90, 0) AS aging_61_90,
      COALESCE(dt.aging_90_plus, 0) + MAX(0, COALESCE(c.opening_balance, 0) - COALESCE(dt.debt_total, 0)) AS aging_90_plus,
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
      LEFT JOIN purchases p ON p.id = d.invoice_id AND d.source_type = 'purchase'
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
    SELECT s.name AS supplier_name,
      s.phone,
      s.id AS supplier_id,
      COALESCE(dt.purchase_count, 0) AS purchase_count,
      MAX(0, COALESCE(s.opening_balance, 0) - COALESCE(dt.debt_total, 0)) + COALESCE(dt.debt_total, 0) AS total_due,
      COALESCE(dt.aging_0_30, 0) AS aging_0_30,
      COALESCE(dt.aging_31_60, 0) AS aging_31_60,
      COALESCE(dt.aging_61_90, 0) AS aging_61_90,
      COALESCE(dt.aging_90_plus, 0) + MAX(0, COALESCE(s.opening_balance, 0) - COALESCE(dt.debt_total, 0)) AS aging_90_plus,
      dt.last_purchase_date
    FROM suppliers s
    LEFT JOIN debt_totals dt ON dt.supplier_id = s.id
    WHERE 1=1 ${supplier_id ? " AND s.id = ?" : ""}
      AND (COALESCE(s.opening_balance, 0) != 0 OR COALESCE(dt.debt_total, 0) > 0)
    ORDER BY total_due DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
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

function customerStatement(startDate, endDate, opts = {}) {
  const db = getDb();
  const customerId = opts.customer_id;
  if (!customerId) return [];
  const customer = db.prepare("SELECT name, COALESCE(opening_balance, 0) AS opening_balance FROM customers WHERE id = ?").get(customerId);
  if (!customer) return [];
  const params = [];
  const txns = db.prepare(`
    SELECT i.invoice_no AS ref_no, DATE(i.created_at) AS date,
      'فاتورة' AS type, i.total AS amount, i.status
    FROM invoices i
    WHERE i.customer_id = ? AND i.status != 'cancelled'
      ${addDateFilter("i.created_at", startDate, endDate, params)}
    UNION ALL
    SELECT p.reference_number AS ref_no, DATE(p.created_at) AS date,
      'دفعة' AS type, -p.amount AS amount, 'paid' AS status
    FROM payments p
    WHERE p.party_type = 'customer' AND p.party_id = ?
      ${addDateFilter("p.created_at", startDate, endDate, [])}
    ORDER BY date ASC
  `).all(customerId, ...params, customerId);
  let running = customer.opening_balance;
  const rows = txns.map(t => {
    running += Number(t.amount);
    return { ...t, running_balance: running };
  });
  return {
    customer_name: customer.name,
    opening_balance: customer.opening_balance,
    closing_balance: running,
    transactions: rows,
  };
}

function topCustomers(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT COALESCE(c.name, 'نقدي') AS customer_name,
      c.phone,
      c.id AS customer_id,
      COUNT(i.id) AS invoice_count,
      SUM(i.total) AS total_spent,
      ROUND(AVG(i.total), 2) AS avg_order_value,
      MAX(DATE(i.created_at)) AS last_purchase_date,
      c.loyalty_points, c.loyalty_tier
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY total_spent DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function collectionEfficiency(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT c.name AS customer_name,
      c.id AS customer_id,
      COUNT(DISTINCT i.id) AS total_invoices,
      SUM(i.total) AS total_billed,
      SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) AS collected,
      SUM(CASE WHEN i.status != 'paid' THEN i.total ELSE 0 END) AS outstanding,
      CASE WHEN SUM(i.total) > 0
        THEN ROUND((SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) / SUM(i.total)) * 100, 1)
        ELSE 0 END AS collection_rate,
      ROUND(AVG(CASE WHEN i.status = 'paid' AND i.paid_at IS NOT NULL THEN julianday(i.paid_at) - julianday(i.created_at) ELSE NULL END), 1) AS days_to_collect
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'cancelled'
      AND DATE(i.created_at) >= ? AND DATE(i.created_at) <= ?
    WHERE 1=1 ${customer_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    HAVING total_billed > 0
    ORDER BY collection_rate ASC
  `).all(startDate || "", endDate || "", ...(customer_id ? [customer_id] : []));
}

function supplierStatement(startDate, endDate, opts = {}) {
  const db = getDb();
  const supplierId = opts.supplier_id;
  if (!supplierId) return [];
  const supplier = db.prepare("SELECT name, COALESCE(opening_balance, 0) AS opening_balance FROM suppliers WHERE id = ?").get(supplierId);
  if (!supplier) return [];
  const params = [];
  const txns = db.prepare(`
    SELECT p.purchase_no AS ref_no, DATE(p.created_at) AS date,
      'مشتريات' AS type, p.total AS amount, p.status
    FROM purchases p
    WHERE p.supplier_id = ? AND p.status != 'cancelled'
      ${addDateFilter("p.created_at", startDate, endDate, params)}
    ORDER BY date ASC
  `).all(supplierId, ...params);
  let running = supplier.opening_balance;
  const rows = txns.map(t => {
    running += Number(t.amount);
    return { ...t, running_balance: running };
  });
  return {
    supplier_name: supplier.name,
    opening_balance: supplier.opening_balance,
    closing_balance: running,
    transactions: rows,
  };
}

function customerLoyalty(startDate, endDate, opts = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT c.name AS customer_name, c.phone,
      COALESCE(c.loyalty_points, 0) AS loyalty_points,
      COALESCE(c.loyalty_tier, 'عادي') AS loyalty_tier,
      COALESCE(SUM(i.total), 0) AS total_spent,
      COUNT(i.id) AS invoice_count,
      MAX(DATE(i.created_at)) AS last_purchase_date
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'cancelled'
    GROUP BY c.id
    ORDER BY loyalty_points DESC
  `).all();
}

function supplierPurchasesHistory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id } = opts;
  return db.prepare(`
    SELECT p.purchase_no, DATE(p.created_at) AS date,
      s.name AS supplier_name,
      p.total, p.status, p.payment_type,
      COUNT(pl.id) AS item_count,
      u.full_name AS created_by
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
}

function supplierReturnsHistory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id } = opts;
  return db.prepare(`
    SELECT pr.doc_no AS return_ref, DATE(pr.created_at) AS date,
      s.name AS supplier_name,
      pr.total AS return_total, pr.reason, pr.refund_method,
      COUNT(prl.id) AS items_returned
    FROM purchase_returns pr
    JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN purchase_return_lines prl ON prl.purchase_return_id = pr.id
    WHERE pr.status = 'active' ${addDateFilter("pr.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND pr.supplier_id = ?" : ""}
    GROUP BY pr.id
    ORDER BY pr.created_at DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
}

function customerStatementV2(startDate, endDate, opts = {}) {
  const db = getDb();
  const customerId = opts.customer_id;
  if (!customerId) return [];
  const customer = db.prepare("SELECT name, COALESCE(opening_balance, 0) AS opening_balance FROM customers WHERE id = ?").get(customerId);
  if (!customer) return [];

  const invoiceParams = [];
  const returnParams = [];
  const paymentParams = [];
  const txns = db.prepare(`
    SELECT i.invoice_no AS ref_no, DATE(i.created_at) AS date,
      'invoice' AS type, i.total AS amount, i.status
    FROM invoices i
    WHERE i.customer_id = ? AND i.status != 'cancelled'
      ${addDateFilter("i.created_at", startDate, endDate, invoiceParams)}
    UNION ALL
    SELECT sr.doc_no AS ref_no, DATE(sr.created_at) AS date,
      'sales_return' AS type, -sr.total AS amount, sr.status
    FROM sales_returns sr
    WHERE sr.customer_id = ? AND sr.status = 'active'
      ${addDateFilter("sr.created_at", startDate, endDate, returnParams)}
    UNION ALL
    SELECT p.reference_number AS ref_no, DATE(p.created_at) AS date,
      'payment' AS type, -p.amount AS amount, 'paid' AS status
    FROM payments p
    WHERE p.party_type = 'customer' AND p.party_id = ?
      ${addDateFilter("p.created_at", startDate, endDate, paymentParams)}
    ORDER BY date ASC
  `).all(
    customerId,
    ...invoiceParams,
    customerId,
    ...returnParams,
    customerId,
    ...paymentParams,
  );

  let running = Number(customer.opening_balance || 0);
  const rows = txns.map((txn) => {
    running += Number(txn.amount || 0);
    return { ...txn, running_balance: running };
  });
  return {
    customer_name: customer.name,
    opening_balance: customer.opening_balance,
    closing_balance: running,
    transactions: rows,
  };
}

function topCustomersV2(startDate, endDate, opts = {}) {
  const db = getDb();
  const invoiceParams = [];
  const returnParams = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT COALESCE(c.name, 'cash') AS customer_name,
      c.phone,
      c.id AS customer_id,
      COUNT(i.id) AS invoice_count,
      COALESCE(SUM(i.total), 0) AS gross_spent,
      COALESCE(MAX(ret.returns_amount), 0) AS returns_amount,
      COALESCE(SUM(i.total), 0) - COALESCE(MAX(ret.returns_amount), 0) AS total_spent,
      ROUND(AVG(i.total), 2) AS avg_order_value,
      MAX(DATE(i.created_at)) AS last_purchase_date,
      c.loyalty_points, c.loyalty_tier
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN (
      SELECT customer_id, COALESCE(SUM(total), 0) AS returns_amount
      FROM sales_returns
      WHERE status = 'active' ${addDateFilter("created_at", startDate, endDate, returnParams)}
      GROUP BY customer_id
    ) ret ON ret.customer_id = c.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, invoiceParams)}
      ${customer_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY total_spent DESC
  `).all(...returnParams, ...invoiceParams, ...(customer_id ? [customer_id] : []));
}

function collectionEfficiencyV2(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    WITH invoice_scope AS (
      SELECT i.id, i.customer_id, i.total, i.status, i.amount_received, i.paid_at, i.created_at
      FROM invoices i
      WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
    ),
    invoice_debt AS (
      SELECT d.invoice_id,
        COALESCE(SUM(MAX(0, COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0))), 0) AS outstanding
      FROM ajal_debts d
      WHERE d.source_type = 'invoice' AND d.status != 'voided'
      GROUP BY d.invoice_id
    ),
    invoice_balances AS (
      SELECT s.*,
        CASE
          WHEN idb.invoice_id IS NOT NULL THEN idb.outstanding
          WHEN s.status = 'paid' THEN 0
          ELSE MAX(0, COALESCE(s.total, 0) - COALESCE(s.amount_received, 0))
        END AS outstanding_amount
      FROM invoice_scope s
      LEFT JOIN invoice_debt idb ON idb.invoice_id = s.id
    )
    SELECT c.name AS customer_name,
      c.id AS customer_id,
      COUNT(DISTINCT ib.id) AS total_invoices,
      COALESCE(SUM(ib.total), 0) AS total_billed,
      COALESCE(SUM(MAX(0, COALESCE(ib.total, 0) - COALESCE(ib.outstanding_amount, 0))), 0) AS collected,
      COALESCE(SUM(ib.outstanding_amount), 0) AS outstanding,
      CASE WHEN COALESCE(SUM(ib.total), 0) > 0
        THEN ROUND((COALESCE(SUM(MAX(0, COALESCE(ib.total, 0) - COALESCE(ib.outstanding_amount, 0))), 0) / SUM(ib.total)) * 100, 1)
        ELSE 0 END AS collection_rate,
      ROUND(AVG(CASE WHEN ib.status = 'paid' AND ib.paid_at IS NOT NULL THEN julianday(ib.paid_at) - julianday(ib.created_at) ELSE NULL END), 1) AS days_to_collect
    FROM customers c
    LEFT JOIN invoice_balances ib ON ib.customer_id = c.id
    WHERE 1=1 ${customer_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    HAVING total_billed > 0
    ORDER BY collection_rate ASC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function customerLoyaltyV2(startDate, endDate, opts = {}) {
  const db = getDb();
  const invoiceParams = [];
  const returnParams = [];
  return db.prepare(`
    SELECT c.name AS customer_name, c.phone,
      COALESCE(c.loyalty_points, 0) AS loyalty_points,
      COALESCE(c.loyalty_tier, '') AS loyalty_tier,
      COALESCE(inv.gross_spent, 0) AS gross_spent,
      COALESCE(ret.returns_amount, 0) AS returns_amount,
      COALESCE(inv.gross_spent, 0) - COALESCE(ret.returns_amount, 0) AS total_spent,
      COALESCE(inv.invoice_count, 0) AS invoice_count,
      inv.last_purchase_date
    FROM customers c
    LEFT JOIN (
      SELECT customer_id,
        COALESCE(SUM(total), 0) AS gross_spent,
        COUNT(id) AS invoice_count,
        MAX(DATE(created_at)) AS last_purchase_date
      FROM invoices
      WHERE status != 'cancelled' ${addDateFilter("created_at", startDate, endDate, invoiceParams)}
      GROUP BY customer_id
    ) inv ON inv.customer_id = c.id
    LEFT JOIN (
      SELECT customer_id, COALESCE(SUM(total), 0) AS returns_amount
      FROM sales_returns
      WHERE status = 'active' ${addDateFilter("created_at", startDate, endDate, returnParams)}
      GROUP BY customer_id
    ) ret ON ret.customer_id = c.id
    ORDER BY loyalty_points DESC
  `).all(...invoiceParams, ...returnParams);
}

function customerProfitabilityReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const invoiceParams = [];
  const returnParams = [];
  const { customer_id } = opts;
  const costCol = getCostColumn(opts.cost_method);
  const returnCostCol = getReturnCostColumn(opts.cost_method);
  return db.prepare(`
    SELECT COALESCE(c.name, 'cash') AS customer_name,
      c.phone,
      c.id AS customer_id,
      COALESCE(inv.invoice_count, 0) AS invoice_count,
      COALESCE(inv.revenue, 0) AS gross_revenue,
      COALESCE(ret.returns_amount, 0) AS returns_amount,
      COALESCE(inv.revenue, 0) - COALESCE(ret.returns_amount, 0) AS net_revenue,
      COALESCE(inv.cost, 0) - COALESCE(ret.return_cost, 0) AS cost,
      COALESCE(inv.revenue, 0) - COALESCE(ret.returns_amount, 0)
        - COALESCE(inv.cost, 0) + COALESCE(ret.return_cost, 0) AS gross_profit,
      CASE WHEN COALESCE(inv.revenue, 0) - COALESCE(ret.returns_amount, 0) > 0
        THEN ROUND(((COALESCE(inv.revenue, 0) - COALESCE(ret.returns_amount, 0)
          - COALESCE(inv.cost, 0) + COALESCE(ret.return_cost, 0))
          / (COALESCE(inv.revenue, 0) - COALESCE(ret.returns_amount, 0))) * 100, 1)
        ELSE 0 END AS margin_percent,
      CASE WHEN COALESCE(inv.revenue, 0) > 0
        THEN ROUND(COALESCE(ret.returns_amount, 0) / inv.revenue * 100, 1)
        ELSE 0 END AS return_rate_percent,
      CAST(julianday('now') - julianday(inv.last_purchase_date) AS INTEGER) AS days_since_last_purchase
    FROM customers c
    LEFT JOIN (
      SELECT i.customer_id,
        COUNT(DISTINCT i.id) AS invoice_count,
        SUM(i.total) AS revenue,
        SUM(cost_agg.cost) AS cost,
        MAX(DATE(i.created_at)) AS last_purchase_date
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(quantity * ${costCol}) AS cost
        FROM invoice_lines
        GROUP BY invoice_id
      ) cost_agg ON cost_agg.invoice_id = i.id
      WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, invoiceParams)}
      GROUP BY i.customer_id
    ) inv ON inv.customer_id = c.id
    LEFT JOIN (
      SELECT sr.customer_id,
        SUM(sr.total) AS returns_amount,
        SUM(srl.quantity * ${returnCostCol}) AS return_cost
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE sr.status = 'active' ${addDateFilter("sr.created_at", startDate, endDate, returnParams)}
      GROUP BY sr.customer_id
    ) ret ON ret.customer_id = c.id
    WHERE (COALESCE(inv.invoice_count, 0) > 0 OR COALESCE(ret.returns_amount, 0) > 0)
      ${customer_id ? " AND c.id = ?" : ""}
    ORDER BY gross_profit DESC
  `).all(...invoiceParams, ...returnParams, ...(customer_id ? [customer_id] : []));
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
      COALESCE(SUM(i.discount), 0) AS discounts,
      COALESCE(SUM(cost_agg.cogs), 0) AS cogs,
      COUNT(DISTINCT i.id) AS invoice_count
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(quantity * ${costCol}) AS cogs
      FROM invoice_lines
      GROUP BY invoice_id
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

module.exports = {
  arAging,
  apAging,
  profitLoss,
  customerStatement: customerStatementV2,
  topCustomers: topCustomersV2,
  collectionEfficiency: collectionEfficiencyV2,
  supplierStatement,
  customerLoyalty: customerLoyaltyV2,
  customerProfitabilityReport,
  dailyOwnerSnapshot,
  supplierPurchasesHistory,
  supplierReturnsHistory,
};
