import React, { useMemo } from "react";
import { formatNumber } from "../../../utils/currency";
import { g } from "./blockUtils";

const fmt = (n) => formatNumber(n);
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};
const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const TYPE_META = {
  invoice: { label: "فاتورة مبيعات" },
  purchase: { label: "فاتورة شراء" },
  payment: { label: "دفعة" },
  sales_return: { label: "مرتجع مبيعات" },
  purchase_return: { label: "مرتجع مشتريات" },
  adjustment: { label: "تسوية" },
};

function nestStatementRows(rows) {
  const groups = [];
  let current = null;
  for (const r of rows || []) {
    if (r._is_item && current) {
      current.items.push(r);
    } else {
      current = { ...r, items: [] };
      groups.push(current);
    }
  }
  return groups;
}

function BalanceCell({ value, bold, accent }) {
  const v = Number(value || 0);
  const neg = v < -0.005;
  return (
    <span style={{ fontWeight: bold ? 900 : 700, fontVariantNumeric: "tabular-nums", direction: "ltr", display: "inline-block", color: neg ? "#dc2626" : "#0f172a" }}>
      {fmt(v)}
    </span>
  );
}

function SummaryLine({ label, value, strong, tone }) {
  const bgColor = tone === "amber" ? "#fef3c7" : strong ? "#e2e8f0" : "#f1f5f9";
  const toneText = {
    amber: "#92400e", emerald: "#047857", rose: "#be123c", blue: "#1d4ed8", zinc: "#475569",
  }[tone] || (strong ? "#334155" : "#64748b");
  return (
    <tr style={{ background: bgColor }}>
      <td colSpan={4} style={{ padding: "3px 6px", fontSize: "10px", border: "1px solid #e2e8f0", textAlign: "left", fontWeight: strong ? 900 : 700, color: toneText }}>{label}</td>
      <td style={{ padding: "3px 6px", fontSize: "11px", textAlign: "center", border: "1px solid #e2e8f0", fontVariantNumeric: "tabular-nums", fontWeight: strong ? 900 : 700, color: toneText, direction: "ltr" }}>{value}</td>
    </tr>
  );
}

const DEFAULT_COLS = [
  { key: "index", label: "م", align: "center", width: "4%" },
  { key: "date", label: "التاريخ", align: "center", width: "14%" },
  { key: "debit", label: "مدين", align: "center", width: "12%" },
  { key: "credit", label: "دائن", align: "center", width: "12%" },
  { key: "running_balance", label: "الرصيد", align: "center", width: "14%" },
  { key: "description", label: "الوصف", align: "right", width: "44%" },
];

/* ── Internal: summary footer rows shared by ledger & standalone blocks ── */
function StatementSummaryRows({ cols, accent, printFont, currency, totalDebit, totalCredit, closing, cellBorder }) {
  const smallFont = "10px";
  const renderFooterCell = (colKey) => {
    switch (colKey) {
      case "index": case "date": case "description": return null;
      case "debit":
        return <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr", fontWeight: 900 }}>{fmt(totalDebit)}</span>;
      case "credit":
        return <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr", fontWeight: 900, color: "#86efac" }}>{fmt(totalCredit)}</span>;
      case "running_balance":
        return <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr", fontWeight: 900 }}>{fmt(closing)}</span>;
      case "amount":
        return <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr", fontWeight: 900 }}>{fmt(closing)}</span>;
      default:
        return "—";
    }
  };
  const isFooterMerged = (colKey) => colKey === "index" || colKey === "date" || colKey === "description";
  const mergedCount = cols.filter((c) => isFooterMerged(c.key)).length;
  const closingNeg = closing < -0.005;

  return (
    <>
      <tr style={{ background: accent, color: "#fff" }}>
        {cols.map((c, ci) => {
          if (isFooterMerged(c.key) && mergedCount > 0) {
            if (ci === 0) {
              return (
                <td key={c.key} colSpan={mergedCount} style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 900, border: `1px solid ${accent}`, textAlign: "center" }}>
                  الإجمالي
                </td>
              );
            }
            return null;
          }
          return (
            <td key={c.key} style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 900, border: `1px solid ${accent}`, textAlign: "center", fontVariantNumeric: "tabular-nums", direction: "ltr" }}>
              {renderFooterCell(c.key)}
            </td>
          );
        })}
      </tr>
      <tr style={{ background: accent, color: "#fff" }}>
        <td colSpan={cols.length - 1} style={{ padding: "4px 12px", fontSize: "11px", fontWeight: 700, border: `1px solid ${accent}`, textAlign: "left", opacity: 0.8 }}>
          <span>رصيد الحركة</span>
        </td>
        <td style={{ padding: "4px 12px", fontSize: "13px", fontWeight: 900, border: `1px solid ${accent}`, textAlign: "center", fontVariantNumeric: "tabular-nums", direction: "ltr", color: closingNeg ? "#fca5a5" : "#fff" }}>
          {fmt(closing)} {currency}
        </td>
      </tr>
    </>
  );
}

/* ──────────────────────────────────────────────
   1. ACCOUNT STATEMENT PARTY INFO BLOCK
   ────────────────────────────────────────────── */
export function AccountStatementPartyBlock({ invoice = {}, settings }) {
  const summary = invoice.statement_summary || {};
  const partyType = invoice.partyType || "customer";
  const period = invoice.period || {};
  const accent = g(settings, "accent_color") || "#1e40af";
  const printFont = g(settings, "print_font") || "'Tajawal', 'Cairo', sans-serif";
  const bodyFontSize = `${parseInt(g(settings, "body_font_size") || 11, 10)}px`;
  const partyLabel = partyType === "customer" ? "العميل" : "المورد";
  const codeLabel = partyType === "customer" ? "كود العميل" : "كود المورد";
  const accentBg = accent + "0d";

  return (
    <div style={{ fontFamily: printFont, marginBottom: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#e2e8f0", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
        <div style={{ background: accent, color: "#fff", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8 }}>{partyLabel}</span>
          <span style={{ fontSize: "14px", fontWeight: 900 }}>{summary.party_name || summary.supplier_name || summary.customer_name || "—"}</span>
        </div>
        <div style={{ background: "#f1f5f9", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>{codeLabel}</span>
          <span style={{ fontSize: "14px", fontWeight: 900, color: "#0f172a" }}>{summary.party_code || "—"}</span>
        </div>
      </div>

      {(period.from || period.to) && (
        <div style={{ background: accentBg, border: `1px solid ${accent}20`, padding: "5px 12px", textAlign: "center", fontSize: bodyFontSize, fontWeight: 700, color: accent }}>
          عن الفترة من {period.from || "البداية"} إلى {period.to || "الآن"}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   2. ACCOUNT STATEMENT LEDGER TABLE BLOCK
   ──────────────────────────────────────────────
   Renders the full statement table with opening
   balance, transaction rows, nested items, and
   summary footer. Column layout driven by props.
   ────────────────────────────────────────────── */
export function AccountStatementLedgerBlock({ invoice = {}, settings, props = {} }) {
  const rows = invoice.statement_rows || [];
  const summary = invoice.statement_summary || {};
  const partyType = invoice.partyType || "customer";

  const groups = useMemo(() => nestStatementRows(rows), [rows]);

  const paymentLabel = partyType === "customer" ? "دفعة محصلة" : "دفعة إلى مورد";

  const accent = props.accentColor || g(settings, "accent_color") || "#1e40af";
  const printFont = g(settings, "print_font") || "'Tajawal', 'Cairo', sans-serif";
  const bodyFontSize = `${parseInt(g(settings, "body_font_size") || 11, 10)}px`;
  const itemFontSize = `${parseInt(g(settings, "item_font_size") || 10, 10)}px`;
  const smallFont = `${parseInt(itemFontSize, 10) - 1}px`;
  const currency = g(settings, "currency_symbol") || "";
  const accentLight = accent + "18";

  const opening = Number(summary.opening_balance || 0);
  const closing = Number(summary.closing_balance || 0);
  const totalDebit = Number(summary.total_debit || 0);
  const totalCredit = Number(summary.total_credit || 0);

  // ── Column definitions from props ──
  const designerCols = Array.isArray(props.columns) && props.columns.length
    ? props.columns.filter((c) => c.visible !== false)
    : null;

  const cols = designerCols || DEFAULT_COLS;
  const colCount = cols.length;

  // ── Styling knobs ──
  const border = props.tableBorder || "lines";
  const headerVariant = props.headerVariant || "dark";
  const lw = Math.max(1, Math.min(4, Number(props.lineWidth) || 1));
  const lineColor = props.lineColor || "#e2e8f0";
  const cellBorder = border === "grid"
    ? { border: `${lw}px solid ${lineColor}` }
    : border === "lines"
    ? { borderBottom: `${lw}px solid ${lineColor}` }
    : {};
  const zebra = props.zebra !== false;

  const headBg = headerVariant === "dark" ? (props.headerBg || accent) : "#f8fafc";
  const headColor = headerVariant === "dark" ? "#fff" : "#475569";
  const headBorder = headerVariant === "light" ? { borderBottom: `2px solid ${accent}` } : {};

  const headStyle = {
    padding: "6px 8px",
    fontSize: "11px",
    fontWeight: 900,
    color: headColor,
    background: headBg,
    textAlign: "center",
    ...cellBorder,
    ...headBorder,
  };

  const cellStyleBase = {
    padding: "6px 8px",
    fontSize: bodyFontSize,
    verticalAlign: "middle",
    ...cellBorder,
  };

  // ── Render helpers for each column key ──
  function renderCol(key, group, idx) {
    switch (key) {
      case "index": {
        const noImpact = group.affects_balance === false;
        return (
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: noImpact ? "#a16207" : "#94a3b8" }}>
            {fmt(idx + 1, { decimals: 0 })}
          </span>
        );
      }
      case "date": {
        const noImpact = group.affects_balance === false;
        return (
          <div style={{ whiteSpace: "nowrap", opacity: noImpact ? 0.7 : 1 }}>
            <div style={{ fontWeight: 700, color: "#334155", fontVariantNumeric: "tabular-nums", direction: "ltr", lineHeight: 1.3 }}>{fmtDate(group.datetime || group.date)}</div>
            {fmtTime(group.datetime) && <div style={{ fontSize: smallFont, color: "#94a3b8", fontVariantNumeric: "tabular-nums", direction: "ltr", lineHeight: 1.3 }}>{fmtTime(group.datetime)}</div>}
          </div>
        );
      }
      case "debit":
        return group.debit > 0.005
          ? <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, color: "#dc2626", direction: "ltr" }}>{fmt(group.debit)}</span>
          : <span style={{ color: "#d1d5db" }}>—</span>;
      case "credit":
        return group.credit > 0.005
          ? <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, color: "#059669", direction: "ltr" }}>{fmt(group.credit)}</span>
          : <span style={{ color: "#d1d5db" }}>—</span>;
      case "running_balance": {
        const noImpact = group.affects_balance === false;
        if (noImpact) {
          return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.2, gap: "2px" }}>
              <span style={{ fontSize: "9px", fontWeight: 900, color: "#92400e", whiteSpace: "nowrap" }}>= بدون تغيير</span>
              <span style={{ fontSize: "11px", fontVariantNumeric: "tabular-nums", color: "#94a3b8", direction: "ltr" }}>{fmt(group.running_balance)}</span>
            </div>
          );
        }
        return <BalanceCell value={group.running_balance} accent={accent} />;
      }
      case "description": {
        const meta = TYPE_META[group.type] || { label: group.type };
        const isPayment = group.type === "payment";
        const noImpact = group.affects_balance === false;
        const desc = group.description || (isPayment ? paymentLabel : meta.label);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: smallFont, fontWeight: 900, padding: "1px 8px", borderRadius: "4px", border: "1px solid", opacity: noImpact ? 0.7 : 1, background: accentLight, color: accent, borderColor: accent + "40" }}>{meta.label}</span>
            <span style={{ fontWeight: 700, wordBreak: "break-word", color: noImpact ? "#737373" : "#334155" }}>{desc}</span>
            {noImpact && (
              <span style={{ fontSize: smallFont, fontWeight: 900, padding: "1px 6px", borderRadius: "4px", border: "1px solid #f59e0b", background: "#fef3c7", color: "#92400e", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} /> لم يؤثر على الرصيد
              </span>
            )}
          </div>
        );
      }
      case "amount":
        return <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, color: "#0f172a", direction: "ltr" }}>{fmt(group.debit || group.credit || 0)}</span>;
      default:
        return group[key] || "—";
    }
  }

  /* Render the opening balance row — each column shows
     content appropriate to its key */
  function renderOpeningCell(colKey) {
    switch (colKey) {
      case "index": return "—";
      case "date": return null; // will use colSpan
      case "debit": return null;
      case "credit": return null;
      case "running_balance": return <BalanceCell value={opening} bold accent={accent} />;
      case "description": return <span style={{ fontWeight: 700, color: "#57534e" }}>الرصيد المرحّل من الفترات السابقة</span>;
      case "amount": return <BalanceCell value={opening} bold accent={accent} />;
      default: return "—";
    }
  }

  function isOpeningMerged(colKey) {
    return colKey === "date" || colKey === "debit" || colKey === "credit";
  }

  return (
    <div style={{ fontFamily: printFont }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", tableLayout: "fixed" }}>
        {cols.length > 0 && (
          <colgroup>
            {cols.map((c, i) => (
              <col key={c.key || i} style={{ width: c.width || undefined }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} style={{ ...headStyle, textAlign: c.align || "center" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Opening balance row */}
          <tr style={{ background: "#fffbeb" }}>
            {cols.map((c, ci) => {
              if (isOpeningMerged(c.key)) {
                if (ci === 0) {
                  const mergedCount = cols.filter((_, i) => isOpeningMerged(cols[i].key)).length;
                  return (
                    <td key={c.key} colSpan={mergedCount} style={{ ...cellStyleBase, textAlign: "center", fontWeight: 700, color: "#92400e" }}>
                      رصيد أول المدة
                    </td>
                  );
                }
                return null; // skip — handled by colSpan on first merged col
              }
              return (
                <td key={c.key} style={{ ...cellStyleBase, textAlign: c.align || "center" }}>
                  {renderOpeningCell(c.key)}
                </td>
              );
            })}
          </tr>

          {/* Transaction rows */}
          {groups.map((group, idx) => {
            const noImpact = group.affects_balance === false;
            const zebraBg = zebra && idx % 2 === 1 ? "#f8fafc" : "#fff";
            const rowBg = noImpact ? "#fffbeb" : zebraBg;
            const ribbonBorder = noImpact ? `3px solid #f59e0b` : "3px solid transparent";

            const itemsTotal = group.items.reduce((s, it) => s + Number(it.line_total || 0), 0);
            const discount = Number(group.doc_discount || 0);
            const increase = Number(group.doc_increase || 0);
            const docTotal = group.doc_total != null ? Number(group.doc_total) : null;
            const ledgerAmt = group.debit > 0.005 ? Number(group.debit) : Number(group.credit || 0);
            const cashPortion = docTotal != null ? Math.max(0, docTotal - ledgerAmt) : 0;
            const hasFinancials = group.items.length > 0 && (discount > 0.005 || increase > 0.005 || cashPortion > 0.005);
            const onAccountLabel = group.type === "sales_return" || group.type === "purchase_return"
              ? "دائن على الحساب" : "محمّل على الحساب (آجل)";
            const cashLabel = group.type === "sales_return" || group.type === "purchase_return"
              ? "مسترد نقداً" : "مسدّد نقداً عند الإنشاء";

            return (
              <React.Fragment key={`${group.type}-${group.ref_no || idx}-${idx}`}>
                {/* Main row */}
                <tr style={{ background: rowBg, breakInside: "avoid" }}>
                  {cols.map((c) => (
                    <td key={c.key} style={{
                      ...cellStyleBase,
                      textAlign: c.align || "center",
                      borderRight: c.key === "index" ? ribbonBorder : cellBorder.borderRight || cellBorder.borderBottom || undefined,
                      ...(c.key === "index" ? { borderRight: ribbonBorder } : {}),
                    }}>
                      {renderCol(c.key, group, idx)}
                    </td>
                  ))}
                </tr>

                {/* Item sub-table row */}
                {group.items.length > 0 && (
                  <tr style={{ breakInside: "avoid" }}>
                    <td style={{ border: "1px solid #e2e8f0", background: noImpact ? "#fef3c7" : "#f1f5f9", borderRight: ribbonBorder, padding: "4px 6px" }} colSpan={colCount}>
                      <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: "6px", overflow: "hidden", opacity: noImpact ? 0.6 : 1, tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "52%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "16%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={{ padding: "4px 6px", fontSize: "10px", fontWeight: 900, color: "#475569", border: "1px solid #e2e8f0", background: "#e2e8f0" }}>الصنف</th>
                            <th style={{ padding: "4px 6px", fontSize: "10px", fontWeight: 900, color: "#475569", border: "1px solid #e2e8f0", background: "#e2e8f0" }}>الكمية</th>
                            <th style={{ padding: "4px 6px", fontSize: "10px", fontWeight: 900, color: "#475569", border: "1px solid #e2e8f0", background: "#e2e8f0" }}>السعر</th>
                            <th style={{ padding: "4px 6px", fontSize: "10px", fontWeight: 900, color: "#475569", border: "1px solid #e2e8f0", background: "#e2e8f0" }}>الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((it, i) => (
                            <tr key={i} style={{ background: "#fff" }}>
                              <td style={{ padding: "3px 6px", fontSize: "10px", fontWeight: 600, color: "#334155", border: "1px solid #e2e8f0", wordBreak: "break-word" }}>
                                {it.item_name || "—"}{it.item_code ? <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {it.item_code}</span> : null}
                              </td>
                              <td style={{ padding: "3px 6px", fontSize: "10px", textAlign: "center", color: "#334155", border: "1px solid #e2e8f0", fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{fmt(it.quantity)}</td>
                              <td style={{ padding: "3px 6px", fontSize: "10px", textAlign: "center", color: "#334155", border: "1px solid #e2e8f0", fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{fmt(it.unit_price)}</td>
                              <td style={{ padding: "3px 6px", fontSize: "10px", textAlign: "center", fontWeight: 700, color: "#0f172a", border: "1px solid #e2e8f0", fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{fmt(it.line_total)}</td>
                            </tr>
                          ))}
                          {(group.items.length > 1 || hasFinancials) && (
                            <SummaryLine label="إجمالي الأصناف" value={fmt(itemsTotal)} />
                          )}
                          {discount > 0.005 && <SummaryLine label="خصم عام على المستند" value={`(${fmt(discount)})`} tone="rose" />}
                          {increase > 0.005 && <SummaryLine label="إضافة / مصاريف على المستند" value={`+${fmt(increase)}`} tone="blue" />}
                          {hasFinancials && docTotal != null && (
                            <SummaryLine label="صافي المستند" value={fmt(docTotal)} strong />
                          )}
                          {cashPortion > 0.005 && <SummaryLine label={cashLabel} value={fmt(cashPortion)} tone="zinc" />}
                          {noImpact ? (
                            <SummaryLine label="الأثر على رصيد الحساب" value="بدون تغيير" strong tone="amber" />
                          ) : hasFinancials ? (
                            <SummaryLine label={onAccountLabel} value={fmt(ledgerAmt)} strong tone={group.type === "sales_return" || group.type === "purchase_return" ? "emerald" : "rose"} />
                          ) : null}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          {/* Empty state */}
          {groups.length === 0 && (
            <tr>
              <td style={{ ...cellStyleBase, textAlign: "center", color: "#94a3b8", padding: "24px" }} colSpan={colCount}>
                لا توجد حركات خلال هذه الفترة
              </td>
            </tr>
          )}
        </tbody>

        {/* Summary footer */}
        <tfoot>
          <StatementSummaryRows cols={cols} accent={accent} printFont={printFont} currency={currency}
            totalDebit={totalDebit} totalCredit={totalCredit} closing={closing} cellBorder={cellBorder} />
        </tfoot>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────────────
   3. ACCOUNT STATEMENT SUMMARY FOOTER BLOCK
   ──────────────────────────────────────────────
   Standalone summary block that can be positioned
   independently in the block order. Renders the
   same two-row footer as the ledger block.
   ────────────────────────────────────────────── */
export function AccountStatementSummaryBlock({ invoice = {}, settings, props = {} }) {
  const summary = invoice.statement_summary || {};
  const accent = props.accentColor || g(settings, "accent_color") || "#1e40af";
  const printFont = g(settings, "print_font") || "'Tajawal', 'Cairo', sans-serif";
  const currency = g(settings, "currency_symbol") || "";

  const designerCols = Array.isArray(props.columns) && props.columns.length
    ? props.columns.filter((c) => c.visible !== false)
    : null;
  const cols = designerCols || DEFAULT_COLS;

  const totalDebit = Number(summary.total_debit || 0);
  const totalCredit = Number(summary.total_credit || 0);
  const closing = Number(summary.closing_balance || 0);

  const border = props.tableBorder || "lines";
  const lw = Math.max(1, Math.min(4, Number(props.lineWidth) || 1));
  const lineColor = props.lineColor || "#e2e8f0";
  const cellBorder = border === "grid"
    ? { border: `${lw}px solid ${lineColor}` }
    : border === "lines"
    ? { borderBottom: `${lw}px solid ${lineColor}` }
    : {};

  return (
    <div style={{ fontFamily: printFont }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", tableLayout: "fixed" }}>
        <colgroup>
          {cols.map((c, i) => (
            <col key={c.key || i} style={{ width: c.width || undefined }} />
          ))}
        </colgroup>
        <tbody>
          <StatementSummaryRows cols={cols} accent={accent} printFont={printFont} currency={currency}
            totalDebit={totalDebit} totalCredit={totalCredit} closing={closing} cellBorder={cellBorder} />
        </tbody>
      </table>
    </div>
  );
}
