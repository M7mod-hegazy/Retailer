import React from "react";
import { formatNumber } from "../../../utils/currency";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";

const fmt = (n) => formatNumber(n);

export default function PaymentMethodsReportTemplate({ rows = [], filters = {}, totalIn = 0, totalOut = 0, byMethod = [], settings = {} }) {
  const {
    company_name = "",
    accent_color = "#7c3aed",
    print_font = "Cairo",
    logo_url = "",
    show_logo = true,
    address = "",
  } = settings;

  return (
    <div style={{ fontFamily: print_font, direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b" }}>
      <div style={{ borderBottom: `3px solid ${accent_color}`, paddingBottom: 16, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <div>
          {show_logo && logo_url && <img src={resolveImageUrl(logo_url)} alt="" style={{ maxHeight: 60, marginBottom: 8 }} />}
          <div style={{ fontSize: 18, fontWeight: 900, color: accent_color }}>{company_name}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>{address}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>تقرير وسائل الدفع</div>
          {filters.from && <div style={{ color: "#64748b", fontSize: 11 }}>من: {filters.from}</div>}
          {filters.to && <div style={{ color: "#64748b", fontSize: 11 }}>إلى: {filters.to}</div>}
          <div style={{ color: "#64748b", fontSize: 11 }}>تاريخ: {new Date().toLocaleDateString("ar-EG-u-nu-latn")}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "إجمالي الداخل", val: fmt(totalIn), color: "#16a34a" },
          { label: "إجمالي الخارج", val: fmt(totalOut), color: "#dc2626" },
          { label: "الصافي", val: fmt(totalIn - totalOut), color: accent_color },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color }}>{val} ج.م</div>
          </div>
        ))}
      </div>

      {byMethod.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>ملخص حسب وسيلة الدفع</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#334155" }}>
                {["وسيلة الدفع", "عدد الحركات", "داخل", "خارج", "صافي"].map((h) => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontWeight: 900, border: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byMethod.map((m, i) => (
                <tr key={m.method_id || m.method_name || i}>
                  <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", fontWeight: 900 }}>{m.method_name || "-"}</td>
                  <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0" }}>{m.transaction_count || 0}</td>
                  <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", color: "#16a34a", fontWeight: 900 }}>{fmt(m.total_in)} ج.م</td>
                  <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", color: "#dc2626", fontWeight: 900 }}>{fmt(m.total_out)} ج.م</td>
                  <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", fontWeight: 900 }}>{fmt(m.net_amount)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: accent_color, color: "white" }}>
            {["الكود", "النوع", "المبلغ", "الاتجاه", "الطرف", "وسيلة الدفع", "التاريخ"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 900 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{row.doc_no || `#${row.id}`}</td>
              <td style={{ padding: "8px 12px" }}>{row.doc_type_label || row.doc_type || "-"}</td>
              <td style={{ padding: "8px 12px", fontWeight: 900 }}>{fmt(row.amount)} ج.م</td>
              <td style={{ padding: "8px 12px" }}>
                <span style={{ background: row.direction === "out" ? "#fee2e2" : "#dcfce7", color: row.direction === "out" ? "#dc2626" : "#16a34a", borderRadius: 12, padding: "2px 8px", fontWeight: 900 }}>
                  {row.direction === "out" ? "خارج" : "داخل"}
                </span>
              </td>
              <td style={{ padding: "8px 12px", color: "#64748b" }}>{row.party || row.description || "-"}</td>
              <td style={{ padding: "8px 12px" }}>{row.method_name || "-"}</td>
              <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{row.created_at ? new Date(row.created_at).toLocaleDateString("ar-EG-u-nu-latn") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
