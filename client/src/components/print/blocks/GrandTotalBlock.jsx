import React from "react";
import { g, computeTotals, smartFormat } from "./blockUtils";

export default function GrandTotalBlock({ invoice = {}, settings: s, family }) {
  const { grandTotal } = computeTotals(invoice, s);
  const currency = g(s, "currency_symbol");
  const accent = g(s, "accent_color");
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 6px", background: accent, color: "#fff", borderRadius: "2px", marginTop: "3px" }}>
        <span style={{ fontWeight: 900 }}>الإجمالي</span>
        <span style={{ fontWeight: 900 }}>{currency} {smartFormat(grandTotal, s)}</span>
      </div>
    );
  }
  const size = `${Math.max(13, Number(g(s, "body_font_size")) + 1)}px`;
  return (
    <div style={{
      background: "#000", color: "#fff",
      padding: "7px 5px",
      marginTop: "6px",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: size, fontWeight: 900,
      }}>
        <span>
          <span style={{ marginLeft: "5px", fontSize: "11px" }}>✦</span>
          الإجمالي
          <span style={{ marginRight: "5px", fontSize: "11px" }}>✦</span>
        </span>
        <span style={{ fontFamily: "monospace" }}>{currency} {smartFormat(grandTotal, s)}</span>
      </div>
    </div>
  );
}
