import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";

function fmtDateEG(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("ar-EG");
}

function isNumericLike(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  return !Number.isNaN(Number(s));
}

const A4_WIDTH = 816;
const A4_HEIGHT = 1056;
const PAGE_PADDING = 48;
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 36;
const TABLE_TOP = PAGE_PADDING + HEADER_HEIGHT + 12;
const TABLE_AVAILABLE = A4_HEIGHT - PAGE_PADDING * 2 - HEADER_HEIGHT - FOOTER_HEIGHT - 24;
const ROW_HEIGHT = 32;
const HEADER_ROW_HEIGHT = 36;

function A4Sheet({
  rows,
  columns,
  title,
  subtitle,
  pageNum,
  totalPages,
  pageSize,
  totalRows,
  isLastPage,
  showTotals,
  columnTotals,
  accent = "#0f172a",
  currency = "",
  filters,
}) {
  const maxFitRows = Math.max(1, Math.floor((TABLE_AVAILABLE - HEADER_ROW_HEIGHT - (showTotals ? ROW_HEIGHT + 4 : 0)) / ROW_HEIGHT));
  const displayRows = rows.slice(0, maxFitRows);
  const hasMore = rows.length > maxFitRows;

  const fontScale = columns.length > 8 ? 0.75 : columns.length > 6 ? 0.85 : 1;
  const cellFontSize = Math.round(11 * fontScale);
  const headerFontSize = Math.round(12 * fontScale);

  return (
    <div
      className="relative overflow-hidden mx-auto"
      style={{
        width: A4_WIDTH,
        height: A4_HEIGHT,
        background: "#fff",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        borderRadius: 4,
        fontFamily: '"Tajawal", "Noto Sans Arabic", system-ui, sans-serif',
        direction: "rtl",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${PAGE_PADDING}px ${PAGE_PADDING}px 0 ${PAGE_PADDING}px`,
          borderBottom: `3px solid ${accent}`,
          paddingBottom: 12,
          margin: `0 ${PAGE_PADDING}px`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: accent, lineHeight: 1.3 }}>{title}</div>
            {subtitle ? <div style={{ marginTop: 2, color: "#64748b", fontSize: 11 }}>{subtitle}</div> : null}
          </div>
          <div style={{ textAlign: "left", color: "#64748b", fontSize: 10, minWidth: 200 }}>
            {filters?.from && filters?.to ? (
              <div>الفترة: {filters.from} إلى {filters.to}</div>
            ) : null}
            <div style={{ marginTop: 2 }}>طباعة: {new Date().toLocaleDateString("ar-EG")}</div>
            <div style={{ marginTop: 2, fontWeight: 800, color: accent }}>
              صفحة {pageNum.toLocaleString("ar-EG")} / {totalPages.toLocaleString("ar-EG")}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          flex: 1,
          margin: `12px ${PAGE_PADDING}px 0 ${PAGE_PADDING}px`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: cellFontSize }}>
          <thead>
            <tr style={{ background: accent, color: "#fff" }}>
              {columns.map((col) => (
                <th
                  key={col.id}
                  style={{
                    padding: "6px 8px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: headerFontSize,
                    height: HEADER_ROW_HEIGHT,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.header || col.label || col.key || col.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontWeight: 800, fontSize: 13 }}
                >
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              displayRows.map((row, idx) => {
                const bg = idx % 2 === 0 ? "#f8fafc" : "#fff";
                return (
                  <tr key={row?.id ?? idx} style={{ background: bg }}>
                    {columns.map((col) => {
                      const key = col.key || col.id;
                      const value = row?.[key];
                      const numeric = isNumericLike(value);
                      const codeCol = col.type === "code" || ["item_code", "code", "sku", "barcode", "invoice_no", "reference_id"].includes(key);
                      const dateCol = col.type === "date" || key === "date" || key.endsWith("_date");
                      let display;
                      if (dateCol) {
                        display = fmtDateEG(value);
                      } else if (numeric) {
                        display = `${col.type === "money" && currency ? `${currency} ` : ""}${Number(value).toLocaleString("ar-EG", { maximumFractionDigits: 2 })}${col.type === "percent" ? "%" : ""}`;
                      } else {
                        display = value == null ? "-" : String(value);
                      }
                      return (
                        <td
                          key={key}
                          title={String(value ?? "")}
                          style={{
                            padding: "4px 6px",
                            textAlign: "center",
                            color: "#0f172a",
                            fontFamily: codeCol ? "monospace" : undefined,
                            direction: codeCol ? "ltr" : undefined,
                            height: ROW_HEIGHT,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            borderBottom: "1px solid #e2e8f0",
                            fontSize: cellFontSize,
                          }}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Totals row - only on last data page */}
        {showTotals && columnTotals && Object.keys(columnTotals).length > 0 && (
          <div
            style={{
              marginTop: "auto",
              borderTop: `2px solid ${accent}`,
              background: "#f1f5f9",
              padding: "6px 0",
              display: "flex",
              width: "100%",
              fontSize: cellFontSize,
              fontWeight: 900,
            }}
          >
            {columns.map((col) => {
              const key = col.key || col.id;
              const val = columnTotals[key];
              const numeric = val != null && !isNaN(Number(val));
              return (
                <div
                  key={key}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "0 6px",
                    color: numeric ? accent : "#64748b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={numeric ? Number(val).toLocaleString("ar-EG", { maximumFractionDigits: 2 }) : undefined}
                >
                  {val != null
                    ? (numeric
                      ? `${col.type === "money" && currency ? `${currency} ` : ""}${Number(val).toLocaleString("ar-EG", { maximumFractionDigits: 2 })}${col.type === "percent" ? "%" : ""}`
                      : String(val))
                    : ""}
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div
            style={{
              textAlign: "center",
              padding: "8px 0",
              color: "#94a3b8",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            ... تابع الصفحة التالية
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: `8px ${PAGE_PADDING}px ${PAGE_PADDING}px ${PAGE_PADDING}px`,
          borderTop: "1px solid #e2e8f0",
          margin: `0 ${PAGE_PADDING}px`,
          display: "flex",
          justifyContent: "space-between",
          color: "#94a3b8",
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        <span>تم التصدير: {new Date().toLocaleDateString("ar-EG")}</span>
        <span>إجمالي الصفوف: {totalRows.toLocaleString("ar-EG")}</span>
        <span>صفحة {pageNum.toLocaleString("ar-EG")} من {totalPages.toLocaleString("ar-EG")}</span>
      </div>
    </div>
  );
}

function useContainerScale(ref) {
  const [scale, setScale] = useState(1);
  const update = useCallback(() => {
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    if (w > 0) setScale(Math.min(1, (w - 32) / A4_WIDTH));
  }, [ref]);
  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [update, ref]);
  return scale;
}

export default function A4PageView({
  data = [],
  columns = [],
  title = "",
  subtitle = "",
  filters,
  totalRows = 0,
  pageSize = 50,
  page = 1,
  totalPages = 1,
  columnTotals = {},
  currency = "",
}) {
  const sheetData = useMemo(() => {
    if (!data.length) return { rows: data, isLastPage: true };
    return { rows: data, isLastPage: page >= totalPages };
  }, [data, page, totalPages]);

  const containerRef = useRef(null);
  const scale = useContainerScale(containerRef);

  return (
    <div ref={containerRef} className="flex flex-col items-center py-6 overflow-hidden" style={{ background: "#e8ecf0", minHeight: "100%" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top center", flexShrink: 0 }}>
        <A4Sheet
          rows={sheetData.rows}
          columns={columns}
          title={title || "تقرير"}
          subtitle={subtitle}
          pageNum={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRows={totalRows}
          isLastPage={sheetData.isLastPage}
          showTotals={sheetData.isLastPage}
          columnTotals={columnTotals}
          filters={filters}
        />
      </div>
    </div>
  );
}
