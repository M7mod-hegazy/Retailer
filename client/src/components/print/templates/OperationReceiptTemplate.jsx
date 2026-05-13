import React from "react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });

export default function OperationReceiptTemplate({ title = "إيصال عملية", operation = {}, settings = {} }) {
  const {
    company_name = "",
    address = "",
    phone = "",
    logo_url = "",
    accent_color = "#0f172a",
    print_font = "Cairo",
    show_logo = true,
  } = settings;
  const payments = operation.payments || [];

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
          <div style={{ fontSize: 20, fontWeight: 900 }}>{title}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>المرجع: {operation.reference || operation.doc_no || "-"}</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>التاريخ: {operation.created_at ? new Date(operation.created_at).toLocaleDateString("ar-EG") : new Date().toLocaleDateString("ar-EG")}</div>
        </div>
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><span style={{ color: "#64748b", fontSize: 10 }}>الطرف: </span><strong>{operation.party || operation.party_name || "-"}</strong></div>
          <div><span style={{ color: "#64748b", fontSize: 10 }}>النوع: </span><strong>{operation.type || operation.doc_type || "-"}</strong></div>
          <div><span style={{ color: "#64748b", fontSize: 10 }}>المبلغ: </span><strong style={{ color: accent_color }}>{fmt(operation.amount)} ج.م</strong></div>
          <div><span style={{ color: "#64748b", fontSize: 10 }}>ملاحظات: </span><strong>{operation.notes || operation.description || "-"}</strong></div>
        </div>
      </div>

      {payments.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: accent_color, color: "white" }}>
              {["وسيلة الدفع", "المبلغ"].map((h) => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 900 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, i) => (
              <tr key={payment.method_id || i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "8px 12px" }}>{payment.method_name || payment.method || "-"}</td>
                <td style={{ padding: "8px 12px", fontWeight: 900 }}>{fmt(payment.amount)} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 40 }}>
        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, textAlign: "center", fontSize: 11, color: "#64748b" }}>توقيع المستلم</div>
        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, textAlign: "center", fontSize: 11, color: "#64748b" }}>توقيع المسؤول</div>
      </div>
    </div>
  );
}
