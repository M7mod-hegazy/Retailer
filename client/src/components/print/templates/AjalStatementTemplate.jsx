import React from "react";
import { formatNumber } from "../../../utils/currency";

const fmt = (n) => formatNumber(n);

export default function AjalStatementTemplate({ debt, settings = {} }) {
  const {
    company_name = "",
    address = "",
    phone = "",
    logo_url = "",
    accent_color = "#7c3aed",
    print_font = "Cairo",
    show_logo = true,
  } = settings;
  const payments = debt?.payments || [];

  return (
    <div style={{ fontFamily: print_font, direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b" }}>
      <div style={{ borderBottom: `3px solid ${accent_color}`, paddingBottom: 16, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <div>
          {show_logo && logo_url && <img src={logo_url} alt="" style={{ maxHeight: 60, marginBottom: 8 }} />}
          <div style={{ fontSize: 18, fontWeight: 900, color: accent_color }}>{company_name}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>{address}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>{phone}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>كشف دين آجل</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>فاتورة: {debt?.invoice_no}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>تاريخ: {new Date().toLocaleDateString("ar-EG-u-nu-latn")}</div>
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 8, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>العميل: </span><strong>{debt?.customer_name}</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>الهاتف: </span><strong>{debt?.customer_phone || debt?.phone || "-"}</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>إجمالي الدين: </span><strong style={{ color: "#dc2626" }}>{fmt(debt?.original_amount)} ج.م</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>تاريخ الاستحقاق: </span><strong>{debt?.due_date ? new Date(debt.due_date).toLocaleDateString("ar-EG-u-nu-latn") : "-"}</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>المدفوع: </span><strong style={{ color: "#16a34a" }}>{fmt(debt?.paid_amount)} ج.م</strong></div>
        <div><span style={{ color: "#64748b", fontSize: 10 }}>المتبقي: </span><strong style={{ color: accent_color, fontSize: 14 }}>{fmt(debt?.remaining)} ج.م</strong></div>
      </div>

      {payments.length > 0 && (
        <>
          <div style={{ fontWeight: 900, marginBottom: 8, color: accent_color }}>سجل المدفوعات</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: accent_color, color: "white" }}>
                {["التاريخ", "وسيلة الدفع", "المبلغ"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 900 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, i) => (
                <tr key={payment.id || i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 12px" }}>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString("ar-EG-u-nu-latn") : "-"}</td>
                  <td style={{ padding: "8px 12px" }}>{payment.method_name || "-"}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 900, color: "#16a34a" }}>{fmt(payment.amount)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 32 }}>
        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, textAlign: "center", fontSize: 11, color: "#64748b" }}>توقيع المسؤول</div>
        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, textAlign: "center", fontSize: 11, color: "#64748b" }}>توقيع العميل</div>
      </div>
    </div>
  );
}
