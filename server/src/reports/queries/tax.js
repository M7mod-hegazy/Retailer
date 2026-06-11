const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

// Sales-side tax report: group invoices by their stored tax_rate snapshot.
function vat(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  const custClause = customer_id ? " AND i.customer_id = ?" : "";
  const rows = db.prepare(`
    SELECT
      i.tax_rate,
      i.tax_type,
      SUM(i.total - COALESCE(i.tax_amount, 0)) AS taxable_sales,
      SUM(COALESCE(i.tax_amount, 0)) AS vat_amount,
      COUNT(DISTINCT i.id) AS invoice_count
    FROM invoices i
    WHERE i.status != 'cancelled'
      AND COALESCE(i.tax_enabled, 0) = 1
      AND COALESCE(i.tax_amount, 0) > 0
      ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${custClause}
    GROUP BY i.tax_rate, i.tax_type
    ORDER BY i.tax_rate DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
  return rows;
}

function outputVat(startDate, endDate, opts = {}) {
  // Same data as vat() but with the column names/metrics the output-vat report
  // catalog declares (taxable_amount + customer_count).
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  const custClause = customer_id ? " AND i.customer_id = ?" : "";
  return db.prepare(`
    SELECT
      i.tax_rate,
      SUM(i.total - COALESCE(i.tax_amount, 0)) AS taxable_amount,
      SUM(COALESCE(i.tax_amount, 0)) AS vat_amount,
      COUNT(DISTINCT i.id) AS invoice_count,
      COUNT(DISTINCT i.customer_id) AS customer_count
    FROM invoices i
    WHERE i.status != 'cancelled'
      AND COALESCE(i.tax_enabled, 0) = 1
      AND COALESCE(i.tax_amount, 0) > 0
      ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${custClause}
    GROUP BY i.tax_rate
    ORDER BY i.tax_rate DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function inputVat(startDate, endDate, opts = {}) {
  // Purchases do not currently track invoice-level tax; return empty.
  return [];
}

function vatFilingSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params1 = [], params2 = [];
  const { customer_id } = opts;
  const custClause = customer_id ? " AND i.customer_id = ?" : "";
  const custVals = customer_id ? [customer_id] : [];

  const salesTotal = db.prepare(`
    SELECT COALESCE(SUM(i.total), 0) AS v
    FROM invoices i
    WHERE i.status != 'cancelled'
      ${addDateFilter("i.created_at", startDate, endDate, params1)}
      ${custClause}
  `).get(...params1, ...custVals)?.v || 0;

  const outputVatTotal = db.prepare(`
    SELECT COALESCE(SUM(i.tax_amount), 0) AS v
    FROM invoices i
    WHERE i.status != 'cancelled'
      AND COALESCE(i.tax_enabled, 0) = 1
      ${addDateFilter("i.created_at", startDate, endDate, params2)}
      ${custClause}
  `).get(...params2, ...custVals)?.v || 0;

  return [{
    sales_total: salesTotal,
    output_vat: outputVatTotal,
    purchases_total: 0,
    input_vat: 0,
    net_vat: outputVatTotal,
  }];
}

function returnsTaxEffect(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  const custClause = customer_id ? " AND sr.customer_id = ?" : "";
  return db.prepare(`
    SELECT
      sr.doc_no AS return_ref,
      DATE(sr.created_at) AS date,
      sr.total AS return_amount,
      sr.customer_id,
      COALESCE(sr.tax_amount, 0) AS vat_reversed,
      COUNT(srl.id) AS items_returned
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    WHERE sr.status = 'active'
      AND COALESCE(sr.tax_amount, 0) > 0
      ${addDateFilter("sr.created_at", startDate, endDate, params)}
      ${custClause}
    GROUP BY sr.id
    ORDER BY sr.created_at DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

module.exports = {
  vat,
  outputVat,
  inputVat,
  vatFilingSummary,
  returnsTaxEffect,
};
