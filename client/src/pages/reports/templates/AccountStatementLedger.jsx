import React from "react";
import { AccountStatementLedgerBlock } from "../../../components/print/blocks/AccountStatementBlocks";
import { formatNumber } from "../../../utils/currency";

function fmtNum(n) {
  return formatNumber(n);
}

export function nestStatementRows(rows) {
  const groups = [];
  let current = null;
  for (const r of rows || []) {
    if (r._is_item) {
      if (current) current.items.push(r);
    } else {
      current = { ...r, items: [] };
      groups.push(current);
    }
  }
  return groups;
}

export default function AccountStatementLedger({ rows = [], summary = {}, partyType = "supplier", period = {}, settings = {}, columns }) {
  const partyLabel = partyType === "customer" ? "العميل" : "المورد";
  const codeLabel = partyType === "customer" ? "كود العميل" : "كود المورد";
  const accent = settings.accent_color || "#1e40af";
  const printFont = settings.print_font || "'Tajawal', 'Cairo', sans-serif";
  const bodyFontSize = (settings.body_font_size ? parseInt(settings.body_font_size, 10) : 11) + "px";
  const accentBg = accent + "0d";

  const invoice = {
    statement_rows: rows,
    statement_summary: summary,
    partyType,
    period,
  };

  /* Build props from settings + columns. Merges any preset-driven column
     definitions from the Studio layout into the block props so the printed
     output reflects the user's column customisation. */
  const stmtProps = {};
  if (columns) stmtProps.columns = columns;

  return (
    <div dir="rtl" style={{ fontFamily: printFont, color: "#0f172a" }}>
      {/* Party info band */}
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

      {/* Period info */}
      {(period.from || period.to) && (
        <div style={{ background: accentBg, border: `1px solid ${accent}20`, padding: "5px 12px", textAlign: "center", fontSize: bodyFontSize, fontWeight: 700, color: accent }}>
          عن الفترة من {period.from || "البداية"} إلى {period.to || "الآن"}
        </div>
      )}

      {/* Delegate the full table (opening + transactions + items + summary) to the block */}
      <AccountStatementLedgerBlock invoice={invoice} settings={settings} props={stmtProps} />
    </div>
  );
}
