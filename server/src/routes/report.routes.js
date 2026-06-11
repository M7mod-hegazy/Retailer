const express = require("express");
const fs = require("fs");
const { getDb } = require("../config/database");
const { listRows, listRowsBySource } = require("../reports/index");
const { REPORT_REGISTRY, getSource, getSourceClassifications } = require("../reports/registry");
const { buildColumnsFromRows } = require("../reports/helpers");
const { getReportColumns, getReportTitle, getReportDescription, normalizeStructuredReport } = require("../reports/columns");
const { exportRowsToExcelV2, exportRowsToPdfV3, exportRowsToDocx } = require("../services/exportService");
const { getSalesSummary } = require("../services/reportService");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
router.use(authRequired);

function buildOpts(query = {}) {
  const {
    cost_method, q, status, payment_type, movement_type, action, resource, user_id,
    customer_id, supplier_id, period2_start, period2_end, warehouse_id, scope_type, scope_values,
    category_id, item_id, cashier_id, treasury_id, bank_id,
  } = query;

  // If caller didn't specify a cost method, fall back to the active setting
  let activeCostMethod = cost_method;
  if (!activeCostMethod) {
    try {
      const { getDb } = require("../config/database");
      const row = getDb().prepare("SELECT margin_alert_cost_method FROM settings WHERE id = 1").get();
      activeCostMethod = row?.margin_alert_cost_method || "wacc";
    } catch (_) {
      activeCostMethod = "wacc";
    }
  }

  return {
    q, status, payment_type, movement_type, action, resource, user_id,
    customer_id, supplier_id, period2_start, period2_end, warehouse_id, scope_type, scope_values,
    category_id, item_id, cashier_id, treasury_id, bank_id,
    cost_method: activeCostMethod,
  };
}

function applyRowFilters(rows, opts = {}) {
  const { category_id, item_id, customer_id, supplier_id, cashier_id } = opts;
  if (!category_id && !item_id && !customer_id && !supplier_id && !cashier_id) return rows;
  return rows.filter((row) => {
    let match = true;
    if (category_id) {
      const rowCat = row.category_id;
      if (rowCat !== undefined) {
        match = match && String(rowCat) === String(category_id);
      }
    }
    if (item_id) {
      if (row.item_id !== undefined) {
        match = match && String(row.item_id) === String(item_id);
      } else if (row.id !== undefined && row.item_code !== undefined) {
        match = match && (String(row.id) === String(item_id) || String(row.item_code) === String(item_id));
      }
    }
    if (customer_id && row.customer_id !== undefined) {
      match = match && String(row.customer_id) === String(customer_id);
    }
    if (supplier_id && row.supplier_id !== undefined) {
      match = match && String(row.supplier_id) === String(supplier_id);
    }
    if (cashier_id && row.cashier_id !== undefined) {
      match = match && String(row.cashier_id) === String(cashier_id);
    }
    return match;
  });
}

function computeTotals(rows, columns) {
  const totals = {};
  if (!rows.length || !columns.length) return totals;
  columns.forEach((col) => {
    if (col.type === "money" || col.type === "number" || col.type === "percent") {
      const sum = rows.reduce((acc, row) => {
        const val = Number(row[col.key]);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      totals[col.key] = Math.round(sum * 100) / 100;
    }
  });
  return totals;
}

function normalizeReportPayload(data) {
  const structured = normalizeStructuredReport(data);
  const rows = structured ? structured.rows : (Array.isArray(data) ? data : (data ? [data] : []));
  return {
    rows,
    sections: structured?.sections || [],
    summary: structured?.summary || null,
  };
}

function parseColumnsParam(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hydrateReportDefinition(report) {
  if (!report) return report;
  return {
    ...report,
    title: getReportTitle(report.slug, report.title || report.title_key),
    desc: getReportDescription(report.slug) || report.desc || "",
    columns: getReportColumns(report.slug),
  };
}

// GET /api/reports/registry — return all report definitions
router.get("/registry", requirePagePermission("reports", "view"), (_req, res) => {
  res.json({
    success: true,
    data: {
      ...REPORT_REGISTRY,
      reports: REPORT_REGISTRY.reports.map(hydrateReportDefinition),
    },
  });
});

// GET /api/reports/registry/:slug — return single report definition
router.get("/registry/:slug", requirePagePermission("reports", "view"), (req, res) => {
  const report = REPORT_REGISTRY.reports.find((r) => r.slug === req.params.slug);
  if (!report) return res.status(404).json({ success: false, message: "Report not found" });
  res.json({ success: true, data: hydrateReportDefinition(report) });
});

// GET /api/reports/run/:slug — execute a report with optional filters
// Query params: start_date, end_date, page, pageSize, cost_method, plus per-report filters
router.get("/run/:slug", requirePagePermission("reports", "view"), (req, res, next) => {
  try {
    const { start_date, end_date, page, pageSize } = req.query;
    const slug = req.params.slug;
    const reportDef = REPORT_REGISTRY.reports.find(r => r.slug === slug);
    if (!reportDef) return res.status(404).json({ success: false, message: "Report not found" });

    const opts = buildOpts(req.query);
    let data = listRows(slug, start_date, end_date, opts);
    const normalized = normalizeReportPayload(data);
    let rows = normalized.rows;

    // Post-query row filtering for filters not supported at SQL level
    rows = applyRowFilters(rows, opts);

    const total = rows.length;
    const p = Math.max(1, parseInt(page) || 1);
    // Allow up to 10,000 rows for print preview / full-export requests
    const ps = Math.min(10000, Math.max(1, parseInt(pageSize) || 50));
    const paginated = rows.slice((p - 1) * ps, p * ps);
    const columns = getReportColumns(slug, rows.length ? rows : paginated);

    // Compute full-dataset aggregates for totals row
    const totals = computeTotals(rows, columns);

    res.json({
      success: true,
      data: paginated,
      columns,
      sections: normalized.sections,
      summary: normalized.summary,
      total,
      page: p,
      pageSize: ps,
      totals,
      title: getReportTitle(slug, reportDef.title_key),
      desc: getReportDescription(slug),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/export-slug/:slug — export any report by slug
router.get("/export-slug/:slug", requirePagePermission("reports", "print"), async (req, res, next) => {
  try {
    const { start_date, end_date, format } = req.query;
    const slug = String(req.params.slug || "");
    const opts = buildOpts(req.query);
    let data = listRows(slug, start_date, end_date, opts);
    let rows = normalizeReportPayload(data).rows;
    const requestedColumns = parseColumnsParam(req.query.columns);
    const columns = requestedColumns?.length ? requestedColumns : getReportColumns(slug, rows);
    const reportDef = REPORT_REGISTRY.reports.find(r => r.slug === slug);
    const reportTitle = getReportTitle(slug, reportDef?.title_key || slug);
    const filters = start_date && end_date ? { from: start_date, to: end_date } : null;

    let filePath, contentType, extension;
    const fmt = (format || "excel").toLowerCase();

    if (fmt === "word" || fmt === "docx") {
      const totals = computeTotals(rows, columns);
      filePath = await exportRowsToDocx({ rows, title: reportTitle, columns, rtl: true, filters, totals, companyName: "ElHegazi Retailer" });
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      extension = "docx";
    } else if (fmt === "pdf") {
      const pdfOpts = {
        orientation: req.query.orientation || "portrait",
        paperSize: req.query.paperSize || "A4",
        fontSize: req.query.fontSize || "medium",
        showTotals: req.query.showTotals !== "false",
        showPageNumbers: req.query.showPageNumbers !== "false",
      };
      const totals = computeTotals(rows, columns);
      filePath = await exportRowsToPdfV3({ rows, title: reportTitle, columns, filters, totals, ...pdfOpts });
      contentType = "application/pdf";
      extension = "pdf";
    } else {
      filePath = await exportRowsToExcelV2({ rows, worksheetName: reportTitle, columns, rtl: true });
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    }

    const buffer = fs.readFileSync(filePath);
    const filename = `${slug}-${Date.now()}.${extension}`;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.send(buffer);

    res.on("finish", () => { try { fs.unlinkSync(filePath); } catch {} });
    res.on("error", () => { try { fs.unlinkSync(filePath); } catch {} });
  } catch (error) {
    console.error(`[EXPORT] ERROR ${req.params.slug}:`, error);
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/export-rows-stream — direct stream export (backward compat)
router.get("/export-rows-stream", requirePagePermission("reports", "print"), async (req, res, next) => {
  try {
    const { rows: rawRows, format, title, columns } = req.query;
    const rows = rawRows ? JSON.parse(rawRows) : [];
    const cols = columns ? JSON.parse(columns) : buildColumnsFromRows(rows);
    const fmt = (format || "excel").toLowerCase();
    let filePath;
    if (fmt === "pdf") {
      filePath = await exportRowsToPdfV3({ rows, title: title || "Export", columns: cols });
    } else if (fmt === "docx") {
      filePath = await exportRowsToDocx({ rows, title: title || "Export", columns: cols, rtl: true });
    } else {
      filePath = await exportRowsToExcelV2({ rows, worksheetName: title || "Export", columns: cols, rtl: true });
    }
    const buffer = fs.readFileSync(filePath);
    const ext = fmt === "pdf" ? "pdf" : fmt === "docx" ? "docx" : "xlsx";
    const contentType = fmt === "pdf" ? "application/pdf" : fmt === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="export-${Date.now()}.${ext}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
    res.on("finish", () => { try { fs.unlinkSync(filePath); } catch {} });
  } catch (error) { next(error); }
});

// GET /api/reports/source/:sourceKey/run — run a specific classification within a source
// Query params: classification (required), dataMode (detailed|summary), start_date, end_date, plus per-classification filters
router.get("/source/:sourceKey/run", requirePagePermission("reports", "view"), (req, res, next) => {
  try {
    const { sourceKey } = req.params;
    const { classification, dataMode, start_date, end_date, page, pageSize, ...rest } = req.query;

    const source = getSource(sourceKey);
    if (!source) return res.status(404).json({ success: false, message: `Source '${sourceKey}' not found` });

    const classes = getSourceClassifications(sourceKey);
    const clsDef = classes.find((c) => c.id === classification);
    if (!clsDef) return res.status(404).json({ success: false, message: `Classification '${classification}' not found in source '${sourceKey}'` });

    const mode = dataMode === "summary" ? "summary" : "detailed";
    if (!clsDef.availableModes.includes(mode)) {
      return res.status(400).json({ success: false, message: `Data mode '${mode}' not available for this classification` });
    }

    const opts = buildOpts(req.query);

    // Handle multi-select filters (comma-separated values)
    if (clsDef.multiSelectFilters) {
      clsDef.multiSelectFilters.forEach((msf) => {
        const raw = req.query[msf.key];
        if (raw) opts[msf.key] = raw.split(",").map((v) => v.trim()).filter(Boolean);
      });
    }

    let data = listRowsBySource(sourceKey, classification, mode, start_date, end_date, opts);
    const normalized = normalizeReportPayload(data);
    let rows = normalized.rows;
    rows = applyRowFilters(rows, opts);

    const total = rows.length;
    const p = Math.max(1, parseInt(page) || 1);
    // Allow up to 10,000 rows for print preview / full-export requests
    const ps = Math.min(10000, Math.max(1, parseInt(pageSize) || 50));
    const paginated = rows.slice((p - 1) * ps, p * ps);
    const columns = getReportColumns(clsDef.detailedQuery || clsDef.summaryQuery, rows.length ? rows : paginated);
    const totals = computeTotals(rows, columns);

    const querySlug = clsDef.detailedQuery || clsDef.summaryQuery;
    res.json({
      success: true,
      data: paginated,
      columns,
      sections: normalized.sections,
      summary: normalized.summary,
      total,
      page: p,
      pageSize: ps,
      totals,
      title: getReportTitle(querySlug, classification),
      desc: getReportDescription(querySlug),
      source: sourceKey,
      classification,
      dataMode: mode,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/source/:sourceKey/classifications — list classifications for a source
router.get("/source/:sourceKey/classifications", requirePagePermission("reports", "view"), (req, res) => {
  const { sourceKey } = req.params;
  const source = getSource(sourceKey);
  if (!source) return res.status(404).json({ success: false, message: `Source '${sourceKey}' not found` });
  const classes = getSourceClassifications(sourceKey);
  const enriched = classes.map((c) => ({
    ...c,
    desc: getReportDescription(c.detailedQuery || c.summaryQuery || ""),
  }));
  res.json({ success: true, data: { source, classifications: enriched } });
});

// GET /api/reports/payment-type-options — dynamic payment type filter options
router.get("/payment-type-options", requirePagePermission("reports", "view"), (_req, res) => {
  try {
    const db = getDb();
    const SPECIAL_LABELS = { multi: "متعدد", cash: "نقداً", card: "بطاقة", credit: "آجل", wallet: "محفظة", installments: "تقسيط", bank_transfer: "تحويل بنكي" };

    // Build options map: value → label
    const optionsMap = new Map();

    // 1. Seed from all active payment_methods rows — one entry per distinct category
    try {
      const methods = db.prepare("SELECT name, category FROM payment_methods WHERE is_active = 1 ORDER BY id ASC").all();
      for (const m of methods) {
        const key = m.category;
        if (!key || key === "multi") continue;
        if (!optionsMap.has(key)) optionsMap.set(key, m.name || SPECIAL_LABELS[key] || key);
      }
    } catch (_e) { /* payment_methods may not exist */ }

    // 2. Overlay with distinct values actually present in transactions
    const txTables = [
      { table: "invoices",  col: "payment_type" },
      { table: "purchases", col: "payment_method" },
      { table: "expenses",  col: "payment_method" },
      { table: "revenues",  col: "payment_method" },
    ];
    let hasMulti = false;
    for (const { table, col } of txTables) {
      try {
        db.prepare(`SELECT DISTINCT ${col} FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != ''`).all()
          .forEach(({ [col]: v }) => {
            if (v === "multi") { hasMulti = true; return; }
            if (!optionsMap.has(v)) optionsMap.set(v, SPECIAL_LABELS[v] || v);
          });
      } catch (_e) { /* table may not exist */ }
    }

    // 3. Build sorted list (standard types first, then alphabetical)
    const PRIORITY = ["cash", "نقدي", "نقداً", "credit", "أجل", "card", "بطاقة", "wallet", "bank_transfer", "installments"];
    const entries = Array.from(optionsMap.entries()).filter(([v]) => v !== "multi");
    entries.sort(([a], [b]) => {
      const ai = PRIORITY.indexOf(a), bi = PRIORITY.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b, "ar");
    });

    const options = entries.map(([value, label]) => ({ value, label }));

    // 4. متعدد always last — means invoice was split across multiple payment methods
    if (hasMulti || optionsMap.has("multi")) {
      options.push({ value: "multi", label: "متعدد (أكثر من طريقة دفع)" });
    }

    res.json({ success: true, data: options });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Items currently below their minimum stock quantity (used by dashboard + suggested PO)
router.get("/low-stock", requirePagePermission("reports", "view"), (_req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT i.id, i.name, i.code AS item_code, i.min_stock_qty, i.purchase_price,
             COALESCE(SUM(sl.quantity), 0) AS quantity,
             (
               SELECT p.supplier_id FROM purchase_lines pl
               JOIN purchases p ON p.id = pl.purchase_id
               WHERE pl.item_id = i.id AND p.supplier_id IS NOT NULL
                 AND COALESCE(p.status,'active') NOT IN ('cancelled','voided')
               ORDER BY p.created_at DESC LIMIT 1
             ) AS last_supplier_id,
             (
               SELECT s.name FROM purchase_lines pl
               JOIN purchases p ON p.id = pl.purchase_id
               JOIN suppliers s ON s.id = p.supplier_id
               WHERE pl.item_id = i.id AND p.supplier_id IS NOT NULL
                 AND COALESCE(p.status,'active') NOT IN ('cancelled','voided')
               ORDER BY p.created_at DESC LIMIT 1
             ) AS last_supplier_name
      FROM items i
      LEFT JOIN stock_levels sl ON sl.item_id = i.id
      WHERE i.is_active = 1 AND COALESCE(i.min_stock_qty, 0) > 0
      GROUP BY i.id
      HAVING quantity <= i.min_stock_qty
      ORDER BY (i.min_stock_qty - quantity) DESC
    `).all();
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Margin alerts (items whose WACC > sale_price)
router.get("/margin-alerts", requirePagePermission("reports", "view"), (_req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT i.id, i.name, i.code AS item_code, i.sale_price,
             COALESCE(sl.wacc, i.purchase_price, 0) AS cost
      FROM items i
      LEFT JOIN (
        SELECT item_id, AVG(wacc) AS wacc FROM stock_levels GROUP BY item_id
      ) sl ON sl.item_id = i.id
      WHERE i.is_active = 1 AND i.sale_price > 0
        AND COALESCE(sl.wacc, i.purchase_price, 0) >= i.sale_price
      ORDER BY (COALESCE(sl.wacc, i.purchase_price, 0) - i.sale_price) DESC
      LIMIT 20
    `).all();
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Items expiring within 30 days (for FEFO dashboard alert)
router.get("/expiring-soon", requirePagePermission("reports", "view"), (req, res) => {
  try {
    const db = getDb();
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    const items = db.prepare(`
      SELECT ib.id, ib.item_id, ib.batch_no, ib.expiry_date, ib.quantity, ib.warehouse_id,
             i.name AS item_name, i.code AS item_code,
             w.name AS warehouse_name,
             julianday(ib.expiry_date) - julianday('now') AS days_remaining
      FROM item_batches ib
      JOIN items i ON i.id = ib.item_id
      LEFT JOIN warehouses w ON w.id = ib.warehouse_id
      WHERE ib.quantity > 0
        AND ib.expiry_date IS NOT NULL
        AND ib.expiry_date <= date('now', '+' || ? || ' days')
        AND ib.expiry_date >= date('now')
      ORDER BY ib.expiry_date ASC
      LIMIT 50
    `).all(days);
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Sales summary grouped by date (used by AnalyticsPage chart)
router.get("/sales-summary", requirePagePermission("reports", "view"), (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const data = getSalesSummary(start_date || null, end_date || null);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
