import React, { useLayoutEffect, useMemo } from "react";
import LayoutRenderer from "../LayoutRenderer";
import { formatNumber } from "../../../utils/currency";

const HEADER_MM = 22;
const FOOTER_MM = 14;

function parseFontSize(val, fallback) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function getPageSizeMM(template) {
  if (template === "58mm") return { width: 58, height: 297 };
  if (template === "80mm") return { width: 80, height: 297 };
  if (template === "A5") return { width: 148, height: 210 };
  return { width: 210, height: 297 };
}

const TEXT_WRAP_KEYS = new Set([
  "name","item_name","customer_name","supplier_name","description","label",
  "category_name","warehouse_name","cashier","full_name","reason","notes",
]);

function hasWrapCols(visibleCols) {
  return visibleCols.some(
    (c) => c.type === "text" || c.type === "name" || TEXT_WRAP_KEYS.has(c.key || c.id)
  );
}

function getRowsPerPage(visibleCols, pageSizeMM, marginMM) {
  const usableHeight = pageSizeMM.height - marginMM * 2 - HEADER_MM - FOOTER_MM - 15;
  const baseRowH = visibleCols.length > 8 ? 5.5 : visibleCols.length > 6 ? 6 : 7;
  const rowH = hasWrapCols(visibleCols) ? baseRowH * 1.3 : baseRowH;
  const headerRowH = 8;
  const totalRowH = 7;
  return Math.max(1, Math.floor((usableHeight - headerRowH - totalRowH) / rowH));
}

/**
 * ReportViaLayout — replaces ReportPrintTemplate with LayoutRenderer.
 *
 * This component:
 * 1. Handles pagination (slicing rows per page)
 * 2. Injects dynamic data (title, subtitle, filters) into perBlock overrides
 * 3. Renders via LayoutRenderer so Studio design settings are respected
 */
export default function ReportViaLayout({
  title,
  subtitle,
  rows = [],
  columns = [],
  noteColumns = [],
  filters,
  settings = {},
  totals = {},
  currentPage = 1,
  onPageCount,
  onRowsPerPage,
  forcedRowsPerPage,
  statement,
}) {
  const stmtMode = !!statement;
  const template = settings.template || "A4";
  const pageSizeMM = getPageSizeMM(template);
  const marginMM = parseFontSize(settings.page_padding, 2);
  const accent = settings.accent_color || "#0f172a";

  // Normalize columns to { key, label, type } objects
  const normalizedColumns = useMemo(() => {
    return columns.map((c) => ({
      key: c.key || c.id,
      label: c.label || c.header || c.key || c.id,
      type: c.type,
      printPriority: c.printPriority,
    }));
  }, [columns]);

  // Filter to selected print columns
  const visibleColumns = useMemo(() => {
    const selectedKeys = Array.isArray(settings.report_print_column_keys)
      ? settings.report_print_column_keys
      : null;
    if (!selectedKeys?.length) return normalizedColumns;
    const selected = new Set(selectedKeys);
    return normalizedColumns.filter((c) => selected.has(c.key));
  }, [normalizedColumns, settings.report_print_column_keys]);

  // Rows per page: an explicit caller override wins, then the print modal's
  // measured fit-to-page ceiling (settings.report_rows_per_page — shared by
  // every page so all instances slice identical row ranges), then the
  // geometric estimate.
  const heuristicRows = getRowsPerPage(visibleColumns, pageSizeMM, marginMM);
  const fitCap = Number(settings.report_rows_per_page) || 0;
  const baseRows = forcedRowsPerPage || heuristicRows;
  // The fit cap ALWAYS wins when smaller — it comes from measuring real
  // rendered pages against the paper height, so exceeding it means rows get
  // clipped off the sheet.
  const rowsPerPage = Math.max(1, fitCap > 0 ? Math.min(baseRows, fitCap) : baseRows);
  const totalPrintPages = Math.max(1, Math.ceil((rows.length || 1) / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageRows = rows.slice(pageStart, pageStart + rowsPerPage);

  useLayoutEffect(() => {
    if (onPageCount) onPageCount(stmtMode ? 1 : totalPrintPages);
    if (stmtMode) return;
    // Feedback channels: the print modal's fit measurement + the hosting
    // page's screen-pagination mirror (SourceWorkspacePage keeps its table
    // page size in lockstep with the printed page).
    if (typeof settings.onReportRowsPerPage === "function") settings.onReportRowsPerPage(rowsPerPage);
    if (typeof onRowsPerPage === "function") onRowsPerPage(rowsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPrintPages, onPageCount, stmtMode, rowsPerPage]);

  // Build the invoice object for LayoutRenderer
  const invoice = useMemo(() => {
    const inv = {
      rows: pageRows,
      columns: visibleColumns,
      _allRows: rows,
      _totals: totals,
      _currentPage: currentPage,
      _totalPages: totalPrintPages,
      _title: title,
      _subtitle: subtitle,
      _filters: filters,
      _noteColumns: noteColumns,
    };
    // Statement-specific data — must match AccountStatementBlocks expectations
    if (stmtMode && statement) {
      inv.statement_rows = statement.rows || [];
      inv.statement_summary = statement.summary || {};
      inv.partyType = statement.partyType || "customer";
      inv.period = statement.period || {};
      inv.customer_name = statement.summary?.party_name || statement.summary?.customer_name || statement.summary?.supplier_name || "";
      inv.customer_phone = statement.summary?.customer_phone || "";
      inv.doc_number = statement.summary?.party_code || "";
      inv.debt = { ...statement.summary, schedule: statement.summary?.schedule || [] };
    }
    return inv;
  }, [pageRows, visibleColumns, rows, totals, currentPage, totalPrintPages, title, subtitle, filters, noteColumns, stmtMode, statement]);

  // Build perBlock overrides for dynamic data that blocks can't read from settings alone
  const effectiveLayout = useMemo(() => {
    const layout = settings.layout || {};
    const pageLayout = layout.page || {};
    const existingPerBlock = pageLayout.perBlock || {};
    const existingOrder = pageLayout.order || null;

    // Merge dynamic overrides into perBlock
    const perBlock = { ...existingPerBlock };

    // doc_title: inject the report title
    perBlock.doc_title = {
      ...perBlock.doc_title,
      text: title || perBlock.doc_title?.text || "تقرير",
    };

    // doc_number: hide for reports (they don't have invoice numbers)
    perBlock.doc_number = {
      ...perBlock.doc_number,
      show: false,
    };

    // doc_date: show print date with label
    perBlock.doc_date = {
      ...perBlock.doc_date,
      label: "تاريخ الطباعة",
      showTime: false,
    };

    // footer_text: inject the receipt footer from settings if not overridden
    if (!perBlock.footer_text?.text) {
      perBlock.footer_text = {
        ...perBlock.footer_text,
        text: settings.receipt_footer || "",
      };
    }

    // report_table: pass rows, columns, and table styling
    perBlock.report_table = {
      ...perBlock.report_table,
      // The rows and columns are passed via invoice, not perBlock
      // But ensure zebra/tableBorder defaults align with Studio
    };

    return {
      ...layout,
      page: {
        ...pageLayout,
        order: existingOrder,
        perBlock,
      },
    };
  }, [settings.layout, title, settings.receipt_footer]);

  // For statement mode, use the account_statement scope so the right blocks render
  const scope = stmtMode ? "account_statement" : "reports_generic";

  return (
    <LayoutRenderer
      family="page"
      invoice={invoice}
      settings={settings}
      layout={effectiveLayout}
      size={template}
      scope={scope}
    />
  );
}
