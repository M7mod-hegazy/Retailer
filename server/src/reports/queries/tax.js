const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function vat(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT it.tax_rate,
      SUM(il.line_total) AS taxable_sales,
      SUM(il.line_total * it.tax_rate / 100) AS vat_amount,
      COUNT(DISTINCT i.id) AS invoice_count
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
    GROUP BY it.tax_rate
    ORDER BY it.tax_rate DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function outputVat(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT it.tax_rate,
      SUM(il.line_total) AS taxable_amount,
      SUM(il.line_total * it.tax_rate / 100) AS vat_amount,
      COUNT(DISTINCT i.id) AS invoice_count,
      COUNT(DISTINCT i.customer_id) AS customer_count
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
    GROUP BY it.tax_rate
    ORDER BY it.tax_rate DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function inputVat(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT it.tax_rate,
      SUM(pl.line_total) AS taxable_amount,
      SUM(pl.line_total * it.tax_rate / 100) AS vat_amount,
      COUNT(DISTINCT p.id) AS purchase_count,
      COUNT(DISTINCT p.supplier_id) AS supplier_count
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    JOIN items it ON it.id = pl.item_id
    WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, params)}
    GROUP BY it.tax_rate
    ORDER BY it.tax_rate DESC
  `).all(...params);
}

function vatFilingSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const { customer_id } = opts;
  const custClause = customer_id ? " AND i.customer_id = ?" : "";
  const custVals = customer_id ? [customer_id] : [];
  const invParams1 = [], invParams2 = [], prchParams1 = [], prchParams2 = [];
  return db.prepare(`
    SELECT *, (output_vat - input_vat) AS net_vat FROM (
    SELECT
      (SELECT COALESCE(SUM(il.line_total), 0)
       FROM invoice_lines il
       JOIN invoices i ON i.id = il.invoice_id
       JOIN items it ON it.id = il.item_id
       WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, invParams1)} ${custClause}) AS sales_total,
      (SELECT COALESCE(SUM(il.line_total * it.tax_rate / 100), 0)
       FROM invoice_lines il
       JOIN invoices i ON i.id = il.invoice_id
       JOIN items it ON it.id = il.item_id
       WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, invParams2)} ${custClause}) AS output_vat,
      (SELECT COALESCE(SUM(pl.line_total), 0)
       FROM purchase_lines pl
       JOIN purchases p ON p.id = pl.purchase_id
       JOIN items it ON it.id = pl.item_id
       WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, prchParams1)}) AS purchases_total,
      (SELECT COALESCE(SUM(pl.line_total * it.tax_rate / 100), 0)
       FROM purchase_lines pl
       JOIN purchases p ON p.id = pl.purchase_id
       JOIN items it ON it.id = pl.item_id
       WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, prchParams2)}) AS input_vat
    )
  `).all(...invParams1, ...custVals, ...invParams2, ...custVals, ...prchParams1, ...prchParams2);
}

function returnsTaxEffect(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT sr.doc_no AS return_ref,
      DATE(sr.created_at) AS date,
      sr.total AS return_amount,
      sr.customer_id,
      SUM(srl.line_total * COALESCE(it.tax_rate, 0) / 100) AS vat_reversed,
      COUNT(srl.id) AS items_returned
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    LEFT JOIN items it ON it.id = srl.item_id
    WHERE sr.status = 'active' ${addDateFilter("sr.created_at", startDate, endDate, params)}
      ${customer_id ? " AND sr.customer_id = ?" : ""}
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
