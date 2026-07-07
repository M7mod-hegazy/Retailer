import React, { useMemo, useRef, useEffect, useLayoutEffect } from "react";
import AccountStatementLedger from "./AccountStatementLedger";
import { formatNumber } from "../../../utils/currency";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";

function safeText(value) {
  if (value == null) return "";
  return String(value);
}

function formatDateEG(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return safeText(iso);
  return d.toLocaleDateString("ar-EG-u-nu-latn");
}

function isNumericLike(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  return !Number.isNaN(Number(s));
}

function getPageSizeMM(template) {
  if (template === "58mm") return { width: 58, height: 297 };
  if (template === "80mm") return { width: 80, height: 297 };
  if (template === "A5") return { width: 148, height: 210 };
  return { width: 210, height: 297 };
}

const HEADER_MM = 22;
const FOOTER_MM = 14;

function parseFontSize(val, fallback) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

const TEXT_WRAP_KEYS = new Set([
  "name","item_name","customer_name","supplier_name","description","label",
  "category_name","warehouse_name","cashier","full_name","reason","notes",
]);
const DATE_KEYS = new Set(["date","created_at","updated_at"]);
const CODE_KEYS = new Set(["item_code","code","sku","barcode","invoice_no","reference_id"]);

// Proportional column widths:
//   name/text cols → large share (long Arabic names need room to avoid wrapping)
//   numeric/money cols → small share (5-6 digit numbers)
//   date/code cols → medium share
// ── Column width weights ──────────────────────────────────────────────────────
// Unit abbreviations: "kg", "pcs", "box" — 2-3 chars, low importance
const UNIT_KEYS = new Set(["unit", "uom", "unit_type", "unit_name"]);
// Quantity/count: short integer, important
const QTY_KEYS = new Set(["qty", "quantity", "count", "item_count", "invoice_count", "transaction_count"]);
// Core money values: need enough room for readable numbers + currency
const MONEY_KEYS = new Set([
  "price", "unit_price", "cost", "rate",
  "total", "subtotal", "net", "net_total", "grand_total", "total_sales",
  "amount", "total_amount", "sales_total",
]);
// Secondary numeric: less critical, can be a bit narrower
const MINOR_NUM_KEYS = new Set([
  "discount", "tax", "balance", "paid", "remaining",
  "debit", "credit", "running_total", "avg_transaction", "points", "percentage",
  "returns_amount", "total_discount", "opening_cash", "closing_cash",
  "cash_variance", "expected_cash",
]);

function colWeight(c, customWeights) {
  const key = c.key || c.id;
  if (customWeights && customWeights[key] != null) return customWeights[key];
  // Primary name columns — most important, longest Arabic text
  if (key === "item_name" || key === "product_name") return 5;
  // Other long-text / name cols
  if (TEXT_WRAP_KEYS.has(key) || c.type === "name" || c.type === "text") return 3.5;
  // Unit abbreviations — barely any content needed
  if (UNIT_KEYS.has(key)) return 0.5;
  // Qty/count — short integer but important
  if (QTY_KEYS.has(key)) return 1.2;
  // Core money/price/total — important, needs readable width
  if (MONEY_KEYS.has(key)) return 1.5;
  // Secondary numeric
  if (MINOR_NUM_KEYS.has(key)) return 0.9;
  // Date columns
  if (c.type === "date" || DATE_KEYS.has(key) || key.endsWith("_date")) return 1.3;
  // Code/reference columns
  if (c.type === "code" || CODE_KEYS.has(key)) return 1.4;
  return 1;
}

function colGroupWidths(cols, customWeights) {
  const total = cols.reduce((s, c) => s + colWeight(c, customWeights), 0);
  return cols.map((c) => `${((colWeight(c, customWeights) / total) * 100).toFixed(1)}%`);
}

function hasWrapCols(visibleCols) {
  return visibleCols.some(
    (c) => c.type === "text" || c.type === "name" || TEXT_WRAP_KEYS.has(c.key || c.id)
  );
}

function getRowsPerPage(visibleCols, pageSizeMM, marginMM) {
  const usableHeight = pageSizeMM.height - marginMM * 2 - HEADER_MM - FOOTER_MM - 15;
  const baseRowH = visibleCols.length > 8 ? 5.5 : visibleCols.length > 6 ? 6 : 7;
  // Name cols get 3× width share → typically fit on 1 line; use 1.3× as light safety margin
  const rowH = hasWrapCols(visibleCols) ? baseRowH * 1.3 : baseRowH;
  const headerRowH = 8;
  const totalRowH = 7;
  return Math.max(1, Math.floor((usableHeight - headerRowH - totalRowH) / rowH));
}

function renderCustomBlocks(blocks, position) {
  if (!blocks) return null;
  const parsed = typeof blocks === "string" ? (() => { try { return JSON.parse(blocks); } catch { return []; } })() : blocks;
  if (!Array.isArray(parsed)) return null;
  const matches = parsed.filter((b) => b.position === position && b.enabled !== false && b.text?.trim());
  if (!matches.length) return null;
  return matches.map((b, i) => (
    <div
      key={i}
      style={{
        textAlign: b.alignment === "left" ? "left" : b.alignment === "center" ? "center" : "right",
        fontSize: parseFontSize(b.font_size, 9) + "px",
        fontWeight: b.bold ? 900 : 700,
        fontStyle: b.italic ? "italic" : "normal",
        margin: "2mm 0",
        color: "#334155",
      }}
    >
      {b.text}
    </div>
  ));
}

export default function ReportPrintTemplate({
  title,
  subtitle,
  rows = [],
  columns = [],
  noteColumns = [],
  filters,
  settings = {},
  totalRows = 0,
  currentPage = 1,
  totals = {},
  onPageCount,
  onRowsPerPage,
  forcedRowsPerPage,   // parent passes measured value so hidden print container uses same count
  statement,           // when set → render the dedicated account-statement ledger
}) {
  const stmtMode = !!statement;
  const accent = settings.accent_color || "#0f172a";
  const currency = settings.currency_symbol || "";
  const template = settings.template || "A4";

  const pageSizeMM = getPageSizeMM(template);
  const pageWidthMM = pageSizeMM.width;
  const marginMM = parseFontSize(settings.page_padding, 2);
  const marginTopMM = 2;

  const printFont = settings.print_font || "sans-serif";
  const headerFontSize = parseFontSize(settings.header_font_size, 18) + "px";
  const bodyFontSize = parseFontSize(settings.body_font_size, 11) + "px";
  const itemFontSize = parseFontSize(settings.item_font_size, 9) + "px";
  const footerFontSize = parseFontSize(settings.footer_font_size, 8) + "px";
  const logoMaxHeight = parseFontSize(settings.logo_max_height, 40) + "px";
  const logoAlignment = settings.logo_alignment || "center";
  const showLogo = settings.show_logo !== false;
  const showBranch = settings.show_branch !== false;
  const showAddress = settings.show_address !== false;
  const showPhone = settings.show_phone !== false;
  const showTaxId = settings.show_tax_id !== false;
  const headerText = settings.receipt_header || "";
  const footerText = settings.receipt_footer || "";
  const customBlocks = settings.custom_text_blocks;

  // ── Preset-driven table style knobs ──────────────────────────────────────────
  // table_zebra: true → alternate row shading; false → plain white rows
  const tableZebra = settings.table_zebra !== false;
  // table_border: "grid" → full cell borders; "rows" → row-only; "none" → no borders
  const tableBorder = settings.table_border || "rows";
  // table_header_style: "filled" (accent bg + white text), "light" (tint), "line" (border only), "minimal" (bold text, no bg)
  const tableHeaderStyle = settings.table_header_style || "filled";
  // table_row_pad: per-cell padding in px
  const tableRowPad = parseFontSize(settings.table_row_pad, 3);
  // header_style for the report title block: "band" | "strip" | "classic" | "minimal"
  const headerStyle = settings.header_style || "band";

  // Derived styles from the knobs
  const accentLight = accent + "18"; // ~10% opacity tint for light header style
  const theadBg =
    tableHeaderStyle === "filled"  ? accent
    : tableHeaderStyle === "light" ? accentLight
    : "transparent";
  const theadColor =
    tableHeaderStyle === "filled"  ? "#fff"
    : tableHeaderStyle === "light" ? accent
    : accent;
  const theadBorderBottom =
    tableHeaderStyle === "line" || tableHeaderStyle === "minimal"
      ? `2px solid ${accent}`
      : undefined;
  const cellBorderRight =
    tableBorder === "grid" ? `1px solid #e2e8f0` : undefined;
  const rowBorderBottom =
    tableBorder === "none" ? undefined : "1px solid #e2e8f0";
  const rowBorderStyle =
    tableBorder === "grid" || tableBorder === "rows" ? "solid" : "dashed";

  const customWeights = settings.columnWeights;
  const visibleColumns = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    const selectedKeys = Array.isArray(settings.report_print_column_keys) ? settings.report_print_column_keys : null;
    if (!selectedKeys?.length) return columns;
    const selected = new Set(selectedKeys);
    return columns.filter((column) => selected.has(column.key || column.id));
  }, [columns, settings.report_print_column_keys]);

  const [measuredRowsPerPage, setMeasuredRowsPerPage] = React.useState(null);
  const tbodyRef = useRef(null);

  // Priority: parent-forced (exact, from prior measurement) → locally measured → formula estimate
  const rowsPerPage = forcedRowsPerPage || measuredRowsPerPage || getRowsPerPage(visibleColumns, pageSizeMM, marginMM);
  const totalPrintPages = Math.max(1, Math.ceil((rows.length || 1) / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageRows = rows.slice(pageStart, pageStart + rowsPerPage);
  const isLastPage = currentPage >= totalPrintPages;

  const tableFontSize = visibleColumns.length > 8 ? "9px" : visibleColumns.length > 6 ? "10px" : itemFontSize;

  // DOM measurement: measure actual rendered tr heights to get exact rows-per-page.
  // Uses offsetHeight (not getBoundingClientRect) so CSS scale() transforms on ancestors
  // (e.g. the 55% zoom in PrintPreviewModal) do NOT distort the result.
  // Skip when forcedRowsPerPage is already provided — avoids remeasure loops.
  useLayoutEffect(() => {
    if (forcedRowsPerPage) return;
    if (!tbodyRef.current || visibleColumns.length === 0) return;
    const trs = tbodyRef.current.querySelectorAll("tr");
    if (trs.length < 2) return;
    let total = 0;
    trs.forEach((tr) => { total += tr.offsetHeight; });
    const avgRowPx = total / trs.length;
    if (avgRowPx < 1) return; // element is not laid out (display:none parent)
    // Convert usable page height to CSS pixels at 96 DPI (1mm = 3.7795px)
    const MM_TO_PX = 3.7795;
    const usableHeightPx =
      (pageSizeMM.height - marginMM * 2 - HEADER_MM - FOOTER_MM - 15) * MM_TO_PX;
    const headerRowPx = 8 * MM_TO_PX;
    const totalRowPx = 7 * MM_TO_PX;
    const measured = Math.max(1, Math.floor((usableHeightPx - headerRowPx - totalRowPx) / avgRowPx));
    setMeasuredRowsPerPage(measured);
    if (onRowsPerPage) onRowsPerPage(measured);
  }, [forcedRowsPerPage, pageRows.length, visibleColumns.length, pageSizeMM.height, marginMM]);

  useLayoutEffect(() => {
    if (onPageCount) onPageCount(stmtMode ? 1 : totalPrintPages);
  }, [totalPrintPages, onPageCount, stmtMode]);

  const isThermal = template === "58mm" || template === "80mm";

  const logoEl = showLogo && settings.logo_url ? (
    <div style={{ textAlign: logoAlignment, marginBottom: "3mm" }}>
      <img
        src={resolveImageUrl(settings.logo_url)}
        alt=""
        style={{
          maxHeight: logoMaxHeight,
          maxWidth: "80%",
          objectFit: "contain",
        }}
      />
    </div>
  ) : null;

  const companyInfoEl = (
    <div style={{ textAlign: "center", marginBottom: "3mm" }}>
      <div style={{ fontWeight: 900, fontSize: headerFontSize, color: accent }}>
        {safeText(settings.company_name || "")}
      </div>
      {showBranch && settings.branch_name ? (
        <div style={{ fontSize: bodyFontSize, color: "#475569", marginTop: "1mm" }}>
          {safeText(settings.branch_name)}
        </div>
      ) : null}
      {showAddress && settings.address ? (
        <div style={{ fontSize: bodyFontSize, color: "#64748b", marginTop: "0.5mm" }}>
          {safeText(settings.address)}
        </div>
      ) : null}
      {showPhone && settings.phone ? (
        <div style={{ fontSize: bodyFontSize, color: "#64748b", marginTop: "0.5mm" }}>
          {safeText(settings.phone)}
        </div>
      ) : null}
      {showTaxId && settings.vat_number ? (
        <div style={{ fontSize: bodyFontSize, color: "#64748b", marginTop: "0.5mm" }}>
          الرقم الضريبي: {safeText(settings.vat_number)}
        </div>
      ) : null}
    </div>
  );

  const pageSizeCSS = template === "58mm" ? "58mm auto"
    : template === "80mm" ? "80mm auto"
    : template === "A5" ? "148mm 210mm"
    : "210mm 297mm";

  // Thermal paper has no fixed height (continuous roll)
  const fixedPageHeight = isThermal ? undefined : `${pageSizeMM.height}mm`;

  // ── Account statement ledger: single continuous flow, CSS-driven page breaks ──
  if (stmtMode) {
    return (
      <div
        dir="rtl"
        className="rpt-page-outer"
        style={{
          background: "#fff",
          color: "#0f172a",
          padding: `${marginTopMM}mm ${marginMM}mm ${marginMM}mm ${marginMM}mm`,
          fontFamily: printFont,
          width: `${pageSizeMM.width}mm`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          fontSize: bodyFontSize,
        }}
      >
        {logoEl}
        {companyInfoEl}
        <div style={{ textAlign: "center", margin: "2mm 0 3mm", borderBottom: `2px solid ${accent}`, paddingBottom: "2mm" }}>
          <div style={{ fontWeight: 900, fontSize: headerFontSize, color: accent }}>{safeText(title)}</div>
          {(statement.period?.from || statement.period?.to) && (
            <div style={{ fontSize: bodyFontSize, color: "#475569", marginTop: "1mm" }}>
              عن الفترة من {statement.period?.from || "البداية"} إلى {statement.period?.to || "الآن"}
            </div>
          )}
        </div>
        <AccountStatementLedger
          rows={statement.rows}
          summary={statement.summary}
          partyType={statement.partyType}
        />
        <style>{`@media print { .rpt-page-outer { width: auto; } tr { break-inside: avoid; } }`}</style>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="rpt-page-outer"
      style={{
        background: "#fff",
        color: "#0f172a",
        padding: `${marginTopMM}mm ${marginMM}mm ${marginMM}mm ${marginMM}mm`,
        fontFamily: printFont,
        width: `${pageSizeMM.width}mm`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontSize: bodyFontSize,
        // height + overflow applied via @media screen in <style> below
      }}
    >
      {/* Logo */}
      {logoEl}

      {/* Company Info */}
      {companyInfoEl}

      {/* Custom blocks: after_header */}
      {renderCustomBlocks(customBlocks, "after_header")}

      {/* Report Title & Meta — style driven by headerStyle preset knob */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8mm",
          // "band": full accent band; "strip": bottom border only; "classic" / "minimal": plain
          background:
            headerStyle === "band" ? accent
            : headerStyle === "strip" ? `linear-gradient(135deg, ${accent}10 0%, transparent 100%)`
            : "transparent",
          color: headerStyle === "band" ? "#fff" : "inherit",
          borderBottom:
            headerStyle === "band" ? `2px solid ${accent}`
            : headerStyle === "strip" ? `3px solid ${accent}`
            : `1px solid #e2e8f0`,
          padding: headerStyle === "band" ? "4mm 4mm" : "0 0 4mm 0",
          marginBottom: "4mm",
          borderRadius: headerStyle === "band" ? "3px" : undefined,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontWeight: 900,
            fontSize: headerFontSize,
            color: headerStyle === "band" ? "#fff" : accent,
          }}>{safeText(title)}</div>
          {subtitle ? (
            <div style={{
              marginTop: "3px",
              color: headerStyle === "band" ? "rgba(255,255,255,0.8)" : "#475569",
              fontSize: bodyFontSize,
            }}>{safeText(subtitle)}</div>
          ) : null}
        </div>
        <div style={{
          textAlign: "left",
          color: headerStyle === "band" ? "rgba(255,255,255,0.85)" : "#64748b",
          fontSize: footerFontSize,
          minWidth: "160px",
        }}>
          {filters?.from && filters?.to ? (
            <div style={{ marginTop: "2px" }}>
              الفترة: {safeText(filters.from)} إلى {safeText(filters.to)}
            </div>
          ) : null}
          <div style={{ marginTop: "2px" }}>
            طباعة: {new Date().toLocaleDateString("ar-EG-u-nu-latn")}
          </div>
          <div style={{ marginTop: "2px" }}>
            صفحة {formatNumber(currentPage, { decimals: 0 })} من {formatNumber(totalPrintPages, { decimals: 0 })}
          </div>
        </div>
      </div>

      {/* Header text */}
      {headerText && currentPage === 1 ? (
        <div
          style={{
            marginBottom: "3mm",
            fontSize: bodyFontSize,
            color: "#475569",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          {safeText(headerText)}
        </div>
      ) : null}

      {/* Custom blocks: before_items */}
      {renderCustomBlocks(customBlocks, "before_items")}


      {/* Table — flex:1 so it fills space between header and footer */}
      {pageRows.length === 0 || visibleColumns.length === 0 ? (
        <div
          style={{
            flex: 1,
            padding: "10mm 0",
            textAlign: "center",
            color: "#64748b",
            fontWeight: 800,
            fontSize: bodyFontSize,
          }}
        >
          لا توجد بيانات للطباعة.
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: isThermal || tableBorder === "none" ? "none" : "1px solid #e2e8f0",
            borderRadius: isThermal ? "0" : "4px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: tableBorder === "grid" ? "collapse" : "collapse",
              fontSize: tableFontSize,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              {colGroupWidths(visibleColumns, customWeights).map((w, i) => (
                <col key={visibleColumns[i]?.key || i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{
                background: theadBg,
                color: theadColor,
                borderBottom: theadBorderBottom,
              }}>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key || column.id}
                    style={{
                      padding: isThermal ? "2px 4px" : `${tableRowPad}px 6px`,
                      textAlign: "center",
                      fontWeight: 900,
                      fontSize: tableFontSize,
                      borderRight: cellBorderRight,
                    }}
                  >
                    {column.label || column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {pageRows.flatMap((row, idx) => {
                const zebraEven = tableZebra ? "#f8fafc" : "#fff";
                const zebraOdd = "#fff";
                const mainRow = (
                  <tr
                    key={row?.id ?? idx}
                    style={{
                      background: idx % 2 === 0 ? zebraEven : zebraOdd,
                      borderBottom: isThermal
                        ? "1px dashed #e2e8f0"
                        : rowBorderBottom
                          ? `1px ${rowBorderStyle} #e2e8f0`
                          : undefined,
                    }}
                  >
                    {visibleColumns.map((column) => {
                      const key = column.key || column.id;
                      // If column is an _id field, try to show the _name counterpart
                      const nameKey = key.endsWith("_id") ? key.replace("_id", "_name") : null;
                      const value = nameKey && row?.[nameKey] != null ? row[nameKey] : (row?.[key]);
                      const numeric = isNumericLike(value);
                      const isCode =
                        column.type === "code" ||
                        ["item_code", "code", "sku", "barcode", "invoice_no", "reference_id"].includes(key);
                      const content =
                        isCode
                          ? safeText(value)
                          : column.type === "date" || key === "date" || key.endsWith("_date")
                            ? formatDateEG(value)
                            : numeric
                              ? `${column.type === "money" && currency ? `${currency} ` : ""}${formatNumber(value)}${column.type === "percent" ? "%" : ""}`
                              : safeText(value);

                      return (
                        <td
                          key={key}
                          style={{
                            padding: isThermal ? "2px 3px" : `${tableRowPad}px 5px`,
                            textAlign: "center",
                            color: "#0f172a",
                            fontFamily: isCode ? "monospace" : undefined,
                            direction: isCode ? "ltr" : undefined,
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            overflow: "hidden",
                            fontSize: tableFontSize,
                            borderRight: cellBorderRight,
                          }}
                          title={String(value ?? "")}
                        >
                          {content || "-"}
                        </td>
                      );
                    })}
                  </tr>
                );
                const rows = [mainRow];
                if (row._items?.length > 0) {
                  row._items.forEach((item, i) => {
                    rows.push(
                      <tr key={`${row?.id ?? idx}-item-${i}`}
                        style={{ background: "#f1f5f9", borderBottom: "1px dashed #e2e8f0" }}>
                        {visibleColumns.map((column, colIdx) => {
                          const key = column.key || column.id;
                          let display = "";
                          if (colIdx === 0) {
                            display = `└ ${item.item_name || ""}`;
                          } else if (key === "quantity" || key === "qty") {
                            display = item.quantity != null ? String(item.quantity) : "";
                          } else if (key === "unit_price" || key === "price") {
                            display = item.unit_price != null ? formatNumber(item.unit_price) : "";
                          } else if (key === "line_total" || key === "total" || key === "amount") {
                            display = item.line_total != null ? formatNumber(item.line_total) : "";
                          }
                          return (
                            <td key={key}
                              style={{
                                padding: isThermal ? "1px 3px" : "2px 5px",
                                textAlign: colIdx === 0 ? "right" : "center",
                                color: "#475569",
                                fontSize: `calc(${tableFontSize} - 1px)`,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}>
                              {display || ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                }
                return rows;
              })}
            </tbody>
          </table>

          {/* Totals row - only on last page */}
          {isLastPage && totals && Object.keys(totals).length > 0 && (
            <div
              style={{
                background: "#f1f5f9",
                borderTop: `2px solid ${accent}`,
                padding: "3px 0",
                display: "flex",
                width: "100%",
                fontWeight: 900,
                fontSize: tableFontSize,
              }}
            >
              {visibleColumns.map((col) => {
                const key = col.key || col.id;
                const val = totals[key];
                const hasVal = val != null && !isNaN(Number(val));
                return (
                  <div
                    key={key}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "2px 4px",
                      color: hasVal ? accent : "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hasVal
                      ? formatNumber(val)
                      : ""}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes section — shown outside the table for rows that have note values */}
      {isLastPage && noteColumns.length > 0 && (() => {
        const noteRows = pageRows.filter((row) => noteColumns.some((nc) => row?.[nc.key]));
        if (!noteRows.length) return null;
        return (
          <div style={{ marginTop: "4mm", borderTop: "1px dashed #e2e8f0", paddingTop: "3mm" }}>
            <div style={{ fontWeight: 900, fontSize: footerFontSize, color: "#475569", marginBottom: "2mm", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ملاحظات
            </div>
            {noteRows.map((row, i) => {
              const id = row?.invoice_no || row?.doc_no || row?.id || (i + 1);
              const noteTexts = noteColumns.map((nc) => {
                const val = row?.[nc.key];
                if (!val) return null;
                return `${nc.label}: ${val}`;
              }).filter(Boolean);
              if (!noteTexts.length) return null;
              return (
                <div key={i} style={{ display: "flex", gap: "4mm", fontSize: footerFontSize, marginBottom: "1.5mm", color: "#334155" }}>
                  <span style={{ fontWeight: 900, color: "#64748b", whiteSpace: "nowrap" }}>{id}</span>
                  <span>{noteTexts.join(" | ")}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Custom blocks: after_items */}
      {renderCustomBlocks(customBlocks, "after_items")}

      {/* Footer */}
      <div
        style={{
          marginTop: "5mm",
          paddingTop: "3mm",
          borderTop: isThermal ? "1px dashed #e2e8f0" : "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          color: "#94a3b8",
          fontSize: footerFontSize,
          fontWeight: 700,
        }}
      >
        <span>تم التصدير: {new Date().toLocaleDateString("ar-EG-u-nu-latn")}</span>
        {footerText ? <span>{safeText(footerText)}</span> : null}
        <span>صفحة {formatNumber(currentPage, { decimals: 0 })} من {formatNumber(totalPrintPages, { decimals: 0 })}</span>
      </div>

      <style>{`
        @media screen {
          /* Lock page to exact physical dimensions so preview looks like a real sheet */
          .rpt-page-outer {
            height: ${fixedPageHeight || "auto"};
            overflow: hidden;
          }
        }
        @media print {
          @page { size: ${pageSizeCSS}; margin: ${marginMM}mm; }
          /* On real print the browser lays out pages — let content flow, never clip */
          .rpt-page-outer { height: auto !important; overflow: visible !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
