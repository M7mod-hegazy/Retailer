const { getDb } = require("../config/database");

function valueOf(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function dateWhere(column, startDate, endDate, params) {
  const parts = [];
  if (startDate) {
    parts.push(`date(${column}) >= date(?)`);
    params.push(startDate);
  }
  if (endDate) {
    parts.push(`date(${column}) <= date(?)`);
    params.push(endDate);
  }
  return parts.length ? ` AND ${parts.join(" AND ")}` : "";
}

function methodExpr(rawColumn) {
  return `
    SELECT pm.id
    FROM payment_methods pm
    WHERE pm.name = ${rawColumn}
       OR pm.type = ${rawColumn}
       OR pm.category = ${rawColumn}
    ORDER BY
      CASE
        WHEN pm.name = ${rawColumn} THEN 0
        WHEN pm.type = ${rawColumn} THEN 1
        ELSE 2
      END,
      pm.id ASC
    LIMIT 1
  `;
}

function selectWithResolvedMethod(sourceSql) {
  return `
    SELECT x.*,
      pm.id AS method_id,
      COALESCE(pm.name, x.raw_method, 'غير محدد') AS method_name,
      COALESCE(pm.category, x.raw_method, 'other') AS method_category,
      COALESCE(pm.type, x.raw_method, 'other') AS method_type,
      pm.icon AS method_icon,
      COALESCE(pm.excludes_from_treasury, 0) AS excludes_from_treasury
    FROM (${sourceSql}) x
    LEFT JOIN payment_methods pm ON pm.id = x.resolved_method_id OR pm.name = x.raw_method OR pm.type = x.raw_method OR pm.category = x.raw_method
  `;
}

function docTypeLabel(type) {
  return {
    pos_invoice: "فاتورة بيع",
    installment_invoice: "فاتورة تقسيط",
    credit_invoice: "فاتورة آجلة",
    payment_allocation: "تسوية فاتورة",
    customer_payment: "تحصيل عميل",
    supplier_payment: "سداد مورد",
    ajal_payment: "حركة آجل",
    expense: "مصروف",
    revenue: "إيراد",
    purchase: "مشتريات",
    purchase_payment: "دفعة مشتريات",
    withdrawal: "مسحوبات",
    sales_return: "مرتجع مبيعات",
    purchase_return: "مرتجع مشتريات",
  }[type] || type || "غير محدد";
}

function directionLabel(direction) {
  return direction === "out" ? "خارج" : "داخل";
}

function buildLedgerSql(startDate, endDate) {
  const params = [];
  const invoiceDate = dateWhere("i.created_at", startDate, endDate, params);
  const invoiceCreditDate = dateWhere("i.created_at", startDate, endDate, params);
  const allocationDate = dateWhere("p.created_at", startDate, endDate, params);
  const paymentDate = dateWhere("p.created_at", startDate, endDate, params);
  const ajalDate = dateWhere("COALESCE(ap.payment_date, ap.created_at)", startDate, endDate, params);
  const expenseDate = dateWhere("e.created_at", startDate, endDate, params);
  const revenueDate = dateWhere("r.created_at", startDate, endDate, params);
  const purchaseDate = dateWhere("pu.created_at", startDate, endDate, params);
  const purchasePaymentDate = dateWhere("pp.created_at", startDate, endDate, params);
  const purchaseCreditDate = dateWhere("pu.created_at", startDate, endDate, params);
  const withdrawalDate = dateWhere("w.created_at", startDate, endDate, params);
  const salesReturnDate = dateWhere("sr.created_at", startDate, endDate, params);
  const purchaseReturnDate = dateWhere("pr.created_at", startDate, endDate, params);

  const invoiceSimple = `
    SELECT
      i.id,
      i.invoice_no AS doc_no,
      CASE
        WHEN i.payment_type IN ('credit', 'future_due') THEN 'credit_invoice'
        ELSE 'pos_invoice'
      END AS doc_type,
      'sales' AS source_group,
      'customer' AS party_type,
      COALESCE(c.name, 'عميل نقدي') AS party,
      i.payment_type AS raw_method,
      NULL AS resolved_method_id,
      i.total AS amount,
      'in' AS direction,
      i.created_at,
      i.payment_type AS description
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE COALESCE(i.status, '') != 'cancelled'
      AND COALESCE(i.payment_type, 'cash') NOT IN ('multi', 'installments')
      ${invoiceDate}
  `;

  const invoiceCreditRemainder = `
    SELECT
      i.id,
      i.invoice_no AS doc_no,
      CASE WHEN i.payment_type = 'installments' THEN 'installment_invoice' ELSE 'credit_invoice' END AS doc_type,
      'sales' AS source_group,
      'customer' AS party_type,
      COALESCE(c.name, 'عميل نقدي') AS party,
      'credit' AS raw_method,
      NULL AS resolved_method_id,
      CASE
        WHEN i.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0) > 0
        THEN i.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0)
        ELSE 0
      END AS amount,
      'in' AS direction,
      i.created_at,
      'رصيد آجل من فاتورة' AS description
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE COALESCE(i.status, '') != 'cancelled'
      AND COALESCE(i.payment_type, 'cash') IN ('multi', 'installments')
      AND i.total - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0) > 0
      ${invoiceCreditDate}
  `;

  const invoiceAllocations = `
    SELECT
      p.id,
      COALESCE(p.reference_number, i.invoice_no, '#' || p.id) AS doc_no,
      'payment_allocation' AS doc_type,
      'payments' AS source_group,
      COALESCE(p.party_type, 'customer') AS party_type,
      COALESCE(c.name, s.name, 'عميل نقدي') AS party,
      p.method AS raw_method,
      NULL AS resolved_method_id,
      pa.amount AS amount,
      CASE WHEN p.party_type = 'supplier' THEN 'out' ELSE 'in' END AS direction,
      COALESCE(p.created_at, i.created_at) AS created_at,
      COALESCE(p.notes, 'تسوية على فاتورة') AS description
    FROM payment_allocations pa
    JOIN payments p ON p.id = pa.payment_id
    LEFT JOIN invoices i ON i.id = pa.invoice_id
    LEFT JOIN customers c ON p.party_type = 'customer' AND c.id = p.party_id
    LEFT JOIN suppliers s ON p.party_type = 'supplier' AND s.id = p.party_id
    WHERE COALESCE(i.status, '') != 'cancelled'
      ${allocationDate}
  `;

  const standalonePayments = `
    SELECT
      p.id,
      COALESCE(p.reference_number, '#' || p.id) AS doc_no,
      CASE WHEN p.party_type = 'supplier' THEN 'supplier_payment' ELSE 'customer_payment' END AS doc_type,
      'payments' AS source_group,
      p.party_type,
      COALESCE(c.name, s.name) AS party,
      p.method AS raw_method,
      NULL AS resolved_method_id,
      p.amount AS amount,
      CASE WHEN p.party_type = 'supplier' THEN 'out' ELSE 'in' END AS direction,
      p.created_at,
      p.notes AS description
    FROM payments p
    LEFT JOIN customers c ON p.party_type = 'customer' AND c.id = p.party_id
    LEFT JOIN suppliers s ON p.party_type = 'supplier' AND s.id = p.party_id
    WHERE NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)
      ${paymentDate}
  `;

  const ajalPayments = `
    SELECT
      ap.id,
      'AJAL-' || ap.debt_id AS doc_no,
      'ajal_payment' AS doc_type,
      'installments' AS source_group,
      COALESCE(d.party_type, 'customer') AS party_type,
      COALESCE(c.name, s.name) AS party,
      COALESCE(pm.name, pm.type, pm.category, 'cash') AS raw_method,
      ap.payment_method_id AS resolved_method_id,
      ap.amount AS amount,
      CASE WHEN COALESCE(d.party_type, 'customer') = 'supplier' THEN 'out' ELSE 'in' END AS direction,
      COALESCE(ap.payment_date, ap.created_at) AS created_at,
      ap.notes AS description
    FROM ajal_payments ap
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN suppliers s ON s.id = d.supplier_id
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    WHERE 1=1 ${ajalDate}
  `;

  const expenses = `
    SELECT
      e.id,
      e.doc_no,
      'expense' AS doc_type,
      'expenses' AS source_group,
      'general' AS party_type,
      ec.name AS party,
      COALESCE(NULLIF(e.payment_method, ''), 'cash') AS raw_method,
      NULL AS resolved_method_id,
      e.amount AS amount,
      'out' AS direction,
      e.created_at,
      COALESCE(e.description, e.notes) AS description
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE 1=1 ${expenseDate}
  `;

  const revenues = `
    SELECT
      r.id,
      r.doc_no,
      'revenue' AS doc_type,
      'revenues' AS source_group,
      'general' AS party_type,
      rc.name AS party,
      COALESCE(NULLIF(r.payment_method, ''), 'cash') AS raw_method,
      NULL AS resolved_method_id,
      r.amount AS amount,
      'in' AS direction,
      r.created_at,
      COALESCE(r.description, r.notes) AS description
    FROM revenues r
    LEFT JOIN revenue_categories rc ON rc.id = r.category_id
    WHERE 1=1 ${revenueDate}
  `;

  const purchases = `
    SELECT
      pu.id,
      pu.doc_no,
      'purchase' AS doc_type,
      'purchases' AS source_group,
      'supplier' AS party_type,
      s.name AS party,
      'cash' AS raw_method,
      NULL AS resolved_method_id,
      pu.total AS amount,
      'out' AS direction,
      pu.created_at,
      pu.notes AS description
    FROM purchases pu
    LEFT JOIN suppliers s ON s.id = pu.supplier_id
    WHERE COALESCE(pu.status, '') NOT IN ('voided', 'cancelled')
      AND COALESCE(pu.is_opening_balance, 0) = 0
      AND COALESCE(pu.doc_no, '') NOT LIKE 'OB-%'
      ${purchaseDate}
  `;

  const purchasePayments = `
    SELECT
      pp.id,
      COALESCE(pu.doc_no, '#' || pp.id) AS doc_no,
      'purchase_payment' AS doc_type,
      'purchases' AS source_group,
      'supplier' AS party_type,
      s.name AS party,
      COALESCE(pm.name, pm.type, pm.category, 'cash') AS raw_method,
      pp.method_id AS resolved_method_id,
      pp.amount AS amount,
      'out' AS direction,
      pp.created_at,
      pu.notes AS description
    FROM purchase_payments pp
    LEFT JOIN purchases pu ON pu.id = pp.purchase_id
    LEFT JOIN suppliers s ON s.id = pu.supplier_id
    LEFT JOIN payment_methods pm ON pm.id = pp.method_id
    WHERE COALESCE(pu.status, '') NOT IN ('voided', 'cancelled')
      ${purchasePaymentDate}
  `;

  const purchaseCreditRemainder = `
    SELECT
      pu.id,
      pu.doc_no,
      'purchase' AS doc_type,
      'purchases' AS source_group,
      'supplier' AS party_type,
      s.name AS party,
      'credit' AS raw_method,
      NULL AS resolved_method_id,
      CASE
        WHEN pu.total - COALESCE((SELECT SUM(pp.amount) FROM purchase_payments pp WHERE pp.purchase_id = pu.id), 0) > 0
        THEN pu.total - COALESCE((SELECT SUM(pp.amount) FROM purchase_payments pp WHERE pp.purchase_id = pu.id), 0)
        ELSE 0
      END AS amount,
      'out' AS direction,
      pu.created_at,
      'رصيد آجل على المشتريات' AS description
    FROM purchases pu
    LEFT JOIN suppliers s ON s.id = pu.supplier_id
    WHERE COALESCE(pu.status, '') NOT IN ('voided', 'cancelled')
      AND COALESCE(pu.is_opening_balance, 0) = 0
      AND COALESCE(pu.doc_no, '') NOT LIKE 'OB-%'
      AND 0 = 1
      AND pu.total - COALESCE((SELECT SUM(pp.amount) FROM purchase_payments pp WHERE pp.purchase_id = pu.id), 0) > 0
      ${purchaseCreditDate}
  `;

  const withdrawals = `
    SELECT
      w.id,
      w.doc_no,
      'withdrawal' AS doc_type,
      'withdrawals' AS source_group,
      'general' AS party_type,
      wc.name AS party,
      'cash' AS raw_method,
      NULL AS resolved_method_id,
      w.amount AS amount,
      'out' AS direction,
      w.created_at,
      w.note AS description
    FROM withdrawals w
    LEFT JOIN withdrawal_categories wc ON wc.id = w.category_id
    WHERE 1=1 ${withdrawalDate}
  `;

  const salesReturns = `
    SELECT
      sr.id,
      sr.doc_no,
      'sales_return' AS doc_type,
      'sales_returns' AS source_group,
      'customer' AS party_type,
      c.name AS party,
      'credit' AS raw_method,
      NULL AS resolved_method_id,
      sr.total AS amount,
      'out' AS direction,
      sr.created_at,
      sr.reason AS description
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    WHERE COALESCE(sr.status, 'active') != 'cancelled'
      ${salesReturnDate}
  `;

  const purchaseReturns = `
    SELECT
      pr.id,
      pr.doc_no,
      'purchase_return' AS doc_type,
      'purchase_returns' AS source_group,
      'supplier' AS party_type,
      s.name AS party,
      'credit' AS raw_method,
      NULL AS resolved_method_id,
      pr.total AS amount,
      'in' AS direction,
      pr.created_at,
      pr.reason AS description
    FROM purchase_returns pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    WHERE COALESCE(pr.status, 'active') != 'cancelled'
      ${purchaseReturnDate}
  `;

  const sql = selectWithResolvedMethod([
    invoiceSimple,
    invoiceCreditRemainder,
    invoiceAllocations,
    standalonePayments,
    ajalPayments,
    expenses,
    revenues,
    purchases,
    purchasePayments,
    purchaseCreditRemainder,
    withdrawals,
    salesReturns,
    purchaseReturns,
  ].join("\nUNION ALL\n"));

  return { sql, params };
}

function normalizeRow(row) {
  const amount = valueOf(row.amount);
  const direction = row.direction === "out" ? "out" : "in";
  return {
    ...row,
    amount,
    signed_amount: direction === "out" ? -amount : amount,
    total_in: direction === "in" ? amount : 0,
    total_out: direction === "out" ? amount : 0,
    net_amount: direction === "in" ? amount : -amount,
    date: row.created_at ? String(row.created_at).slice(0, 10) : null,
    doc_type_label: docTypeLabel(row.doc_type),
    direction_label: directionLabel(direction),
    method_key: row.method_id != null ? `id:${row.method_id}` : `raw:${row.raw_method || row.method_name || "unknown"}`,
  };
}

function applyFilters(rows, opts = {}) {
  const q = String(opts.q || opts.search || "").trim().toLowerCase();
  const methodId = opts.method_id || opts.payment_method_id || "";
  const methodType = opts.payment_type || opts.method_type || "";
  const direction = opts.direction || opts.type || "";
  const docType = opts.doc_type || "";
  const partyType = opts.party_type || "";
  const min = opts.amount_min !== undefined && opts.amount_min !== "" ? Number(opts.amount_min) : null;
  const max = opts.amount_max !== undefined && opts.amount_max !== "" ? Number(opts.amount_max) : null;

  return rows.filter((row) => {
    if (methodId && String(row.method_id || "") !== String(methodId)) return false;
    if (methodType && ![row.method_type, row.method_category, row.raw_method, row.method_name].some((v) => String(v || "") === String(methodType))) return false;
    if (direction && row.direction !== direction) return false;
    if (docType && row.doc_type !== docType) return false;
    if (partyType && row.party_type !== partyType) return false;
    if (min != null && !Number.isNaN(min) && Number(row.amount || 0) < min) return false;
    if (max != null && !Number.isNaN(max) && Number(row.amount || 0) > max) return false;
    if (q) {
      const haystack = [row.doc_no, row.doc_type_label, row.party, row.description, row.method_name, row.raw_method]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function paymentFlowLedger(startDate, endDate, opts = {}) {
  const db = getDb();
  const { sql, params } = buildLedgerSql(startDate, endDate);
  const rows = db.prepare(`SELECT * FROM (${sql}) ledger ORDER BY datetime(ledger.created_at) DESC, ledger.id DESC`).all(...params)
    .map(normalizeRow)
    .filter((row) => Number(row.amount || 0) > 0);
  return applyFilters(rows, opts);
}

function groupRows(rows, keyFn, seedFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, seedFn(row));
    const entry = map.get(key);
    entry.transaction_count += 1;
    entry.total_in = valueOf(entry.total_in + row.total_in);
    entry.total_out = valueOf(entry.total_out + row.total_out);
    entry.net_amount = valueOf(entry.total_in - entry.total_out);
    if (!entry.last_movement_at || String(row.created_at || "") > String(entry.last_movement_at || "")) {
      entry.last_movement_at = row.created_at;
    }
  }
  return Array.from(map.values());
}

function paymentFlowSummary(startDate, endDate, opts = {}) {
  const rows = paymentFlowLedger(startDate, endDate, opts);
  return groupRows(rows, (row) => row.method_key, (row) => ({
    method_id: row.method_id,
    method_name: row.method_name,
    method_category: row.method_category,
    method_type: row.method_type,
    method_icon: row.method_icon,
    excludes_from_treasury: row.excludes_from_treasury,
    transaction_count: 0,
    total_in: 0,
    total_out: 0,
    net_amount: 0,
    last_movement_at: null,
  })).sort((a, b) => Math.abs(b.net_amount) - Math.abs(a.net_amount));
}

function paymentFlowByDocType(startDate, endDate, opts = {}) {
  const rows = paymentFlowLedger(startDate, endDate, opts);
  return groupRows(rows, (row) => row.doc_type, (row) => ({
    doc_type: row.doc_type,
    doc_type_label: row.doc_type_label,
    transaction_count: 0,
    total_in: 0,
    total_out: 0,
    net_amount: 0,
    last_movement_at: null,
  })).sort((a, b) => Math.abs(b.net_amount) - Math.abs(a.net_amount));
}

function paymentFlowByDirection(startDate, endDate, opts = {}) {
  const rows = paymentFlowLedger(startDate, endDate, opts);
  return groupRows(rows, (row) => row.direction, (row) => ({
    direction: row.direction,
    direction_label: row.direction_label,
    transaction_count: 0,
    total_in: 0,
    total_out: 0,
    net_amount: 0,
    total_amount: 0,
    last_movement_at: null,
  })).map((row) => ({
    ...row,
    total_amount: valueOf(row.total_in + row.total_out),
  })).sort((a, b) => b.total_amount - a.total_amount);
}

function paymentFlowRunning(startDate, endDate, opts = {}) {
  const rows = paymentFlowLedger(startDate, endDate, opts)
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")) || Number(a.id || 0) - Number(b.id || 0));
  const running = new Map();
  const withRunning = rows.map((row) => {
    const key = row.method_key;
    const next = valueOf((running.get(key) || 0) + row.net_amount);
    running.set(key, next);
    return { ...row, running_total: next };
  });
  return withRunning.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || Number(b.id || 0) - Number(a.id || 0));
}

function paymentFlowTotals(rows) {
  const totalIn = valueOf(rows.reduce((sum, row) => sum + Number(row.total_in || 0), 0));
  const totalOut = valueOf(rows.reduce((sum, row) => sum + Number(row.total_out || 0), 0));
  return {
    total_in: totalIn,
    total_out: totalOut,
    net_amount: valueOf(totalIn - totalOut),
    transaction_count: rows.length,
  };
}

function paymentFlowPayload(startDate, endDate, opts = {}) {
  const rows = paymentFlowLedger(startDate, endDate, opts);
  return {
    rows,
    totals: paymentFlowTotals(rows),
    by_method: paymentFlowSummary(startDate, endDate, opts),
    by_doc_type: paymentFlowByDocType(startDate, endDate, opts),
    by_direction: paymentFlowByDirection(startDate, endDate, opts),
  };
}

module.exports = {
  paymentFlowLedger,
  paymentFlowSummary,
  paymentFlowByDocType,
  paymentFlowByDirection,
  paymentFlowRunning,
  paymentFlowTotals,
  paymentFlowPayload,
};
