import React from "react";
import { formatNumber } from "../../../utils/currency";

const fmt = (n) => formatNumber(n);

export default function AjalScheduleTemplate({ debt, settings = {} }) {
  const { company_name = "", accent_color = "#7c3aed", print_font = "Cairo" } = settings;
  const schedule = debt?.schedule || [];

  return (
    <div style={{ fontFamily: print_font, direction: "rtl", padding: 24, fontSize: 12 }}>
      <div style={{ textAlign: "center", borderBottom: `3px solid ${accent_color}`, paddingBottom: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>جدول سداد الأقساط</div>
        <div style={{ color: "#64748b" }}>{company_name}</div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, marginBottom: 16, display: "flex", gap: 24, justifyContent: "center" }}>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>العميل: </span><strong>{debt?.customer_name}</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>إجمالي: </span><strong style={{ color: "#dc2626" }}>{fmt(debt?.original_amount)} ج.م</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>المتبقي: </span><strong style={{ color: accent_color }}>{fmt(debt?.remaining)} ج.م</strong></div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: accent_color, color: "white" }}>
            {["رقم القسط", "تاريخ الاستحقاق", "المبلغ", "الحالة", "توقيع الاستلام"].map((h) => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((row, i) => (
            <tr key={row.id || i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "10px 12px", fontWeight: 900 }}>{row.installment_no}</td>
              <td style={{ padding: "10px 12px" }}>{row.due_date ? new Date(row.due_date).toLocaleDateString("ar-EG-u-nu-latn") : "-"}</td>
              <td style={{ padding: "10px 12px", fontWeight: 900, color: accent_color }}>{fmt(row.amount)} ج.م</td>
              <td style={{ padding: "10px 12px" }}>
                <span style={{
                  background: row.status === "paid" ? "#dcfce7" : "#fef3c7",
                  color: row.status === "paid" ? "#16a34a" : "#d97706",
                  borderRadius: 12,
                  padding: "2px 8px",
                  fontWeight: 900,
                }}>
                  {row.status === "paid" ? "مدفوع" : "معلق"}
                </span>
              </td>
              <td style={{ padding: "10px 12px", borderBottom: "1px solid #94a3b8", minWidth: 100 }} />
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 40 }}>
        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, textAlign: "center", fontSize: 11, color: "#64748b" }}>توقيع المسؤول</div>
        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, textAlign: "center", fontSize: 11, color: "#64748b" }}>توقيع العميل / إقرار بالاستلام</div>
      </div>
    </div>
  );
}
