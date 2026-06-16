import React from "react";
import { formatNumber } from "../../../utils/currency";

const fmt = (n) => formatNumber(n);

const STATUS_LABELS = { pending: "معلق", deposited: "مودع", cleared: "محصّل", bounced: "مرتجع", replaced: "مستبدل" };
const STATUS_COLORS = { pending: "#d97706", deposited: "#2563eb", cleared: "#16a34a", bounced: "#dc2626", replaced: "#7c3aed" };

export default function ChequeRegisterTemplate({ rows = [], settings = {} }) {
  const {
    company_name = "",
    accent_color = "#7c3aed",
    print_font = "Cairo",
    logo_url = "",
    show_logo = true,
    address = "",
    phone = "",
  } = settings;

  const totalPending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalCleared = rows.filter((r) => r.status === "cleared").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalBounced = rows.filter((r) => r.status === "bounced").reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div style={{ fontFamily: print_font, direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b" }}>
      <div style={{ borderBottom: `3px solid ${accent_color}`, paddingBottom: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {show_logo && logo_url && <img src={logo_url} alt="" style={{ maxHeight: 60, marginBottom: 8 }} />}
          <div style={{ fontSize: 18, fontWeight: 900, color: accent_color }}>{company_name}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>{address}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>{phone}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>سجل الشيكات</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>تاريخ: {new Date().toLocaleDateString("ar-EG-u-nu-latn")}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>إجمالي الشيكات: {rows.length}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "معلقة", val: fmt(totalPending), color: "#d97706" },
          { label: "محصّلة", val: fmt(totalCleared), color: "#16a34a" },
          { label: "مرتجعة", val: fmt(totalBounced), color: "#dc2626" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color }}>{val} ج.م</div>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: accent_color, color: "white" }}>
            {["رقم الشيك", "البنك", "الساحب", "تاريخ الاستحقاق", "المبلغ", "الحالة"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 900 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const color = STATUS_COLORS[row.status] || "#64748b";
            return (
              <tr key={row.id || i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 900 }}>{row.cheque_no}</td>
                <td style={{ padding: "8px 12px" }}>{row.bank_name}</td>
                <td style={{ padding: "8px 12px" }}>{row.drawer_name || "-"}</td>
                <td style={{ padding: "8px 12px" }}>{row.due_date ? new Date(row.due_date).toLocaleDateString("ar-EG-u-nu-latn") : "-"}</td>
                <td style={{ padding: "8px 12px", fontWeight: 900 }}>{fmt(row.amount)} ج.م</td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ background: `${color}22`, color, borderRadius: 12, padding: "2px 8px", fontWeight: 900 }}>
                    {STATUS_LABELS[row.status] || row.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
