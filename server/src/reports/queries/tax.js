const { getDb } = require("../../config/database");
const { addDateFilter, baseStatusClause } = require("../helpers");
const { paginateSql } = require("../pagination");

function tableColumns(db, table) {
  try { return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)); }
  catch { return new Set(); }
}

function pushFilter(parts, params, condition, value) {
  if (value === undefined || value === null || value === "") return;
  parts.push(condition);
  params.push(value);
}

function taxTypeLabel(expr) {
  return `CASE COALESCE(${expr}, 'exclusive')
    WHEN 'inclusive' THEN 'شاملة داخل السعر'
    WHEN 'exclusive' THEN 'مضافة خارج السعر'
    ELSE 'غير محدد'
  END`;
}

function statusLabel(expr) {
  return `CASE COALESCE(${expr}, '')
    WHEN 'paid' THEN 'مدفوع'
    WHEN 'unpaid' THEN 'غير مدفوع'
    WHEN 'partial' THEN 'مدفوع جزئيا'
    WHEN 'cancelled' THEN 'ملغي'
    ELSE COALESCE(${expr}, 'غير محدد')
  END`;
}

function salesTaxWhere(alias, startDate, endDate, opts, params) {
  const where = [baseStatusClause(alias, opts.status)];
  const dateClause = addDateFilter(`${alias}.created_at`, startDate, endDate, params).replace(/^ AND /, "");
  if (dateClause) where.push(dateClause);
  pushFilter(where, params, `${alias}.customer_id = ?`, opts.customer_id);
  pushFilter(where, params, `${alias}.status = ?`, opts.status);
  pushFilter(where, params, `${alias}.payment_type = ?`, opts.payment_type);
  pushFilter(where, params, `${alias}.tax_type = ?`, opts.tax_type);
  return where.join(" AND ");
}

function vat(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const where = salesTaxWhere("i", startDate, endDate, opts, params);
  return db.prepare(`
    SELECT
      i.tax_rate,
      COALESCE(i.tax_type, 'exclusive') AS tax_type,
      ${taxTypeLabel("i.tax_type")} AS tax_type_label,
      SUM(i.total - COALESCE(i.tax_amount, 0)) AS taxable_sales,
      SUM(COALESCE(i.tax_amount, 0)) AS vat_amount,
      COUNT(DISTINCT i.id) AS invoice_count,
      COUNT(DISTINCT i.customer_id) AS customer_count
    FROM invoices i
    WHERE ${where}
      AND COALESCE(i.tax_enabled, 0) = 1
      AND COALESCE(i.tax_amount, 0) > 0
    GROUP BY i.tax_rate, COALESCE(i.tax_type, 'exclusive')
    ORDER BY i.tax_rate DESC
  `).all(...params);
}

function outputVat(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const where = salesTaxWhere("i", startDate, endDate, opts, params);
  return db.prepare(`
    SELECT
      i.tax_rate,
      COALESCE(i.tax_type, 'exclusive') AS tax_type,
      ${taxTypeLabel("i.tax_type")} AS tax_type_label,
      SUM(i.total - COALESCE(i.tax_amount, 0)) AS taxable_amount,
      SUM(COALESCE(i.tax_amount, 0)) AS vat_amount,
      COUNT(DISTINCT i.id) AS invoice_count,
      COUNT(DISTINCT i.customer_id) AS customer_count
    FROM invoices i
    WHERE ${where}
      AND COALESCE(i.tax_enabled, 0) = 1
      AND COALESCE(i.tax_amount, 0) > 0
    GROUP BY i.tax_rate, COALESCE(i.tax_type, 'exclusive')
    ORDER BY i.tax_rate DESC
  `).all(...params);
}

function inputVat(startDate, endDate, opts = {}) {
  const db = getDb();
  const cols = tableColumns(db, "purchases");
  if (!cols.has("tax_amount")) return [];
  const taxRateExpr = cols.has("tax_rate") ? "COALESCE(p.tax_rate, 0)" : "0";
  const taxTypeExpr = cols.has("tax_type") ? "COALESCE(p.tax_type, 'exclusive')" : "'exclusive'";
  const taxableExpr = cols.has("subtotal") ? "COALESCE(p.subtotal, p.total - COALESCE(p.tax_amount, 0))" : "(p.total - COALESCE(p.tax_amount, 0))";
  const params = [];
  const where = [baseStatusClause("p", opts.status)];
  const dateClause = addDateFilter("p.created_at", startDate, endDate, params).replace(/^ AND /, "");
  if (dateClause) where.push(dateClause);
  pushFilter(where, params, "p.supplier_id = ?", opts.supplier_id);
  pushFilter(where, params, "p.status = ?", opts.status);
  if (cols.has("payment_type")) pushFilter(where, params, "p.payment_type = ?", opts.payment_type);
  if (cols.has("tax_type")) pushFilter(where, params, "p.tax_type = ?", opts.tax_type);
  return db.prepare(`
    SELECT
      ${taxRateExpr} AS tax_rate,
      ${taxTypeExpr} AS tax_type,
      ${taxTypeLabel(taxTypeExpr)} AS tax_type_label,
      SUM(${taxableExpr}) AS taxable_amount,
      SUM(COALESCE(p.tax_amount, 0)) AS vat_amount,
      COUNT(DISTINCT p.id) AS purchase_count,
      COUNT(DISTINCT p.supplier_id) AS supplier_count
    FROM purchases p
    WHERE ${where.join(" AND ")}
      AND COALESCE(p.tax_amount, 0) > 0
    GROUP BY ${taxRateExpr}, ${taxTypeExpr}
    ORDER BY tax_rate DESC
  `).all(...params);
}

function vatFilingSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params1 = [], params2 = [];
  const salesWhere = salesTaxWhere("i", startDate, endDate, opts, params1);
  const outputWhere = salesTaxWhere("i", startDate, endDate, opts, params2);

  const salesTotal = db.prepare(`
    SELECT COALESCE(SUM(i.total), 0) AS v
    FROM invoices i
    WHERE ${salesWhere}
      AND COALESCE(i.tax_enabled, 0) = 1
      AND COALESCE(i.tax_amount, 0) > 0
  `).get(...params1)?.v || 0;

  const outputVatTotal = db.prepare(`
    SELECT COALESCE(SUM(i.tax_amount), 0) AS v
    FROM invoices i
    WHERE ${outputWhere}
      AND COALESCE(i.tax_enabled, 0) = 1
  `).get(...params2)?.v || 0;

  const inputRows = inputVat(startDate, endDate, opts);
  const inputVatTotal = inputRows.reduce((sum, row) => sum + Number(row.vat_amount || 0), 0);
  const purchasesTotal = inputRows.reduce((sum, row) => sum + Number(row.taxable_amount || 0) + Number(row.vat_amount || 0), 0);

  return [{
    period_label: startDate || endDate ? `${startDate || 'البداية'} إلى ${endDate || 'اليوم'}` : 'كل الفترات',
    basis_label: 'الفواتير التي تحتوي على ضريبة فقط',
    sales_total: salesTotal,
    output_vat: outputVatTotal,
    purchases_total: purchasesTotal,
    input_vat: inputVatTotal,
    net_vat: outputVatTotal - inputVatTotal,
  }];
}

function returnsTaxEffect(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const cols = tableColumns(db, "sales_returns");
  const taxTypeExpr = cols.has("tax_type") ? "COALESCE(sr.tax_type, 'exclusive')" : "'exclusive'";
  const where = ["sr.status = 'active'", "COALESCE(sr.tax_amount, 0) > 0"];
  const dateClause = addDateFilter("sr.created_at", startDate, endDate, params).replace(/^ AND /, "");
  if (dateClause) where.push(dateClause);
  pushFilter(where, params, "sr.customer_id = ?", opts.customer_id);
  let sql = `
    SELECT
      sr.doc_no AS return_ref,
      DATE(sr.created_at) AS date,
      sr.total AS return_amount,
      sr.customer_id,
      ${taxTypeExpr} AS tax_type,
      ${taxTypeLabel(taxTypeExpr)} AS tax_type_label,
      ${statusLabel("sr.status")} AS status_label,
      COALESCE(sr.tax_amount, 0) AS vat_reversed,
      COUNT(srl.id) AS items_returned
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    WHERE ${where.join(" AND ")}
    GROUP BY sr.id
    ORDER BY sr.created_at DESC
  `;
  const allParams = [...params];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

module.exports = {
  vat,
  outputVat,
  inputVat,
  vatFilingSummary,
  returnsTaxEffect,
};
