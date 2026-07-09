import React from "react";
import { g } from "./blockUtils";
import { resolveDocNo } from "./DocNumberBlock";

export default function DocGridBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showBlock = g(s, "show_doc_grid") !== false || editing;
  if (!showBlock) return null;

  // Resolve values
  const rawNo = resolveDocNo(invoice);
  const docNo = rawNo || (editing ? "INV-2025-00847" : "");
  
  const d = invoice.created_at ? new Date(invoice.created_at) : new Date();
  const dateStr = d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn");
  const timeStr = d.toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateTime = `${dateStr} ${timeStr}`;

  const customer = invoice.customer_name || (editing ? "أحمد محمد الشمري" : "");
  const cashier = invoice.cashier_name || invoice.cashier || (editing ? "سارة الحربي" : "");
  const paymentMethod = invoice.payment_method || (editing ? "نقداً" : "");

  const gridCols = Number(props.cols) || 2;
  const border = props.border || "grid";
  const zebra = props.zebra !== false;
  const isRoll = family === "roll";
  
  const accent = g(s, "accent_color") || "#1e3a8a";
  const lineColor = isRoll ? "#000" : "#e2e8f0";
  const borderStyle = border === "grid" 
    ? `1px solid ${lineColor}` 
    : border === "lines" 
      ? `1px solid ${lineColor}` 
      : "none";

  const rows = [
    { label: "رقم المستند", value: docNo, ltr: true },
    { label: "تاريخ الإصدار", value: dateTime },
    ...(customer ? [{ label: "العميل", value: customer }] : []),
    ...(cashier ? [{ label: "الكاشير", value: cashier }] : []),
    ...(paymentMethod ? [{ label: "طريقة الدفع", value: paymentMethod }] : []),
  ];

  // Group into pairs/triplets based on gridCols
  const groupedRows = [];
  for (let i = 0; i < rows.length; i += gridCols) {
    groupedRows.push(rows.slice(i, i + gridCols));
  }

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: isRoll ? "10px" : "11px",
    marginTop: "6px",
    marginBottom: "6px",
  };

  return (
    <table style={tableStyle}>
      <tbody>
        {groupedRows.map((rowGroup, rIdx) => (
          <tr key={rIdx} style={{ background: zebra && rIdx % 2 === 0 ? (isRoll ? "#f1f5f9" : "#f8fafc") : "transparent" }}>
            {rowGroup.map((cell, cIdx) => (
              <td 
                key={cIdx} 
                style={{
                  border: borderStyle,
                  borderBottom: border === "lines" ? borderStyle : borderStyle,
                  padding: "4px 8px",
                  verticalAlign: "middle",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ color: isRoll ? "#000" : "#64748b", fontWeight: 700 }}>{cell.label}:</span>
                  <span style={{ fontWeight: 800, fontFamily: cell.ltr ? "monospace" : "inherit" }} dir={cell.ltr ? "ltr" : "rtl"}>
                    {cell.value}
                  </span>
                </div>
              </td>
            ))}
            {/* Pad remaining cells if row is not full */}
            {rowGroup.length < gridCols && Array.from({ length: gridCols - rowGroup.length }).map((_, i) => (
              <td key={`pad-${i}`} style={{ border: borderStyle }} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
