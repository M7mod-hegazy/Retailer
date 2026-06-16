import React from "react";
import { formatNumber } from "../../../utils/currency";

const fmt = (n) => formatNumber(n);

const STATUS_COLORS = {
  open: { background: "#dbeafe", color: "#1d4ed8" },
  partial: { background: "#ffedd5", color: "#c2410c" },
  overdue: { background: "#fee2e2", color: "#b91c1c" },
  paid: { background: "#dcfce7", color: "#15803d" },
};

const STATUS_LABELS = {
  open: "مفتوح",
  partial: "جزئي",
  overdue: "متأخر",
  paid: "مسدد",
};

export default function AjalFullStatementTemplate({ party, debts = [], settings = {} }) {
  const {
    company_name = "",
    address = "",
    phone = "",
    logo_url = "",
    accent_color = "#7c3aed",
    print_font = "Cairo",
    show_logo = true,
  } = settings;

  const totalOriginal = debts.reduce((s, d) => s + Number(d.original_amount || 0), 0);
  const totalPaid = debts.reduce((s, d) => s + Number(d.paid_amount || 0), 0);
  const totalRemaining = debts.reduce((s, d) => s + Number(d.remaining || 0), 0);

  const printDate = new Date().toLocaleDateString("ar-EG-u-nu-latn");

  return (
    <div style={{ fontFamily: print_font, direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b" }}>
      {/* Header */}
      <div style={{ borderBottom: `3px solid ${accent_color}`, paddingBottom: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {show_logo && logo_url && <img src={logo_url} alt="" style={{ maxHeight: 60, marginBottom: 8 }} />}
          <div style={{ fontSize: 18, fontWeight: 900, color: accent_color }}>{company_name}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>{address}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>{phone}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>كشف حساب أقساط</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>تاريخ الطباعة: {printDate}</div>
        </div>
      </div>

      {/* Party info */}
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>الاسم: </span><strong>{party?.name || "-"}</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>الهاتف: </span><strong>{party?.phone || "-"}</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>الكود: </span><strong>{party?.code || "-"}</strong></div>
      </div>

      {/* Grand total summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "#fef2f2", borderRadius: 8, padding: 12, textAlign: "center" }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>إجمالي الديون</div>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#dc2626" }}>{fmt(totalOriginal)} ج.م</div>
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 12, textAlign: "center" }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>إجمالي المدفوع</div>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#16a34a" }}>{fmt(totalPaid)} ج.م</div>
        </div>
        <div style={{ background: "#faf5ff", borderRadius: 8, padding: 12, textAlign: "center" }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>إجمالي المتبقي</div>
          <div style={{ fontWeight: 900, fontSize: 14, color: accent_color }}>{fmt(totalRemaining)} ج.م</div>
        </div>
      </div>

      {/* Per-debt table */}
      <div style={{ fontWeight: 900, marginBottom: 8, color: accent_color }}>تفاصيل الديون</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 20 }}>
        <thead>
          <tr style={{ background: accent_color, color: "white" }}>
            {["رقم الفاتورة", "الإجمالي", "المدفوع", "المتبقي", "تاريخ الاستحقاق", "الحالة"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 900 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {debts.map((debt, i) => {
            const statusStyle = STATUS_COLORS[debt.status] || STATUS_COLORS.open;
            const payments = debt.payments || [];
            return (
              <React.Fragment key={debt.invoice_no || i}>
                <tr style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{debt.invoice_no || "-"}</td>
                  <td style={{ padding: "8px 10px", color: "#dc2626", fontWeight: 700 }}>{fmt(debt.original_amount)} ج.م</td>
                  <td style={{ padding: "8px 10px", color: "#16a34a", fontWeight: 700 }}>{fmt(debt.paid_amount)} ج.م</td>
                  <td style={{ padding: "8px 10px", color: accent_color, fontWeight: 700 }}>{fmt(debt.remaining)} ج.م</td>
                  <td style={{ padding: "8px 10px" }}>{debt.due_date ? new Date(debt.due_date).toLocaleDateString("ar-EG-u-nu-latn") : "-"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ ...statusStyle, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, display: "inline-block" }}>
                      {STATUS_LABELS[debt.status] || debt.status || "-"}
                    </span>
                  </td>
                </tr>
                {payments.length > 0 && (
                  <tr style={{ background: "#f1f5f9" }}>
                    <td colSpan={6} style={{ padding: "4px 24px 8px" }}>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 700 }}>سجل المدفوعات لفاتورة {debt.invoice_no}:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {payments.map((p, pi) => (
                          <div key={p.id || pi} style={{ background: "white", borderRadius: 4, padding: "3px 10px", border: "1px solid #e2e8f0", fontSize: 10 }}>
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>{fmt(p.amount)} ج.م</span>
                            {" — "}
                            <span>{p.method_name || "-"}</span>
                            {" — "}
                            <span style={{ color: "#64748b" }}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString("ar-EG-u-nu-latn") : "-"}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, marginTop: 8, textAlign: "center", color: "#94a3b8", fontSize: 10 }}>
        تم الإنشاء بواسطة النظام — {printDate}
      </div>
    </div>
  );
}
