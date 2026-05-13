import React from "react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });

export default function BankStatementTemplate({ bank, transactions = [], from, to, settings = {} }) {
  const {
    company_name = "",
    address = "",
    phone = "",
    logo_url = "",
    accent_color = "#1e40af",
    print_font = "Cairo",
    show_logo = true,
    show_address = true,
    show_phone = true,
  } = settings;

  const totalIn = transactions.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalOut = transactions.filter((t) => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount || 0), 0);

  return (
    <div style={{ fontFamily: print_font, direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b", minHeight: "100%" }}>
      <div style={{ borderBottom: `3px solid ${accent_color}`, paddingBottom: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {show_logo && logo_url && <img src={logo_url} alt="logo" style={{ maxHeight: 60, marginBottom: 8 }} />}
          <div style={{ fontSize: 18, fontWeight: 900, color: accent_color }}>{company_name}</div>
          {show_address && <div style={{ color: "#64748b", fontSize: 11 }}>{address}</div>}
          {show_phone && <div style={{ color: "#64748b", fontSize: 11 }}>{phone}</div>}
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>كشف حساب بنكي</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>حساب: {bank?.name}</div>
          {from && to && <div style={{ color: "#64748b", fontSize: 11 }}>الفترة: {from} - {to}</div>}
          <div style={{ color: "#64748b", fontSize: 11 }}>تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "إجمالي الإيداعات", val: fmt(totalIn), color: "#16a34a" },
          { label: "إجمالي السحوبات", val: fmt(totalOut), color: "#dc2626" },
          { label: "الرصيد الحالي", val: fmt(bank?.balance), color: accent_color },
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
            {["التاريخ", "النوع", "المرجع", "ملاحظات", "المبلغ", "الحالة"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 900 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => (
            <tr key={tx.id || i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "8px 12px" }}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString("ar-EG") : "-"}</td>
              <td style={{ padding: "8px 12px" }}>
                <span style={{ background: tx.type === "deposit" ? "#dcfce7" : "#fee2e2", color: tx.type === "deposit" ? "#16a34a" : "#dc2626", borderRadius: 12, padding: "2px 8px", fontWeight: 900 }}>
                  {tx.type === "deposit" ? "إيداع" : "سحب"}
                </span>
              </td>
              <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{tx.reference || "-"}</td>
              <td style={{ padding: "8px 12px", color: "#64748b" }}>{tx.notes || "-"}</td>
              <td style={{ padding: "8px 12px", fontWeight: 900, color: tx.type === "deposit" ? "#16a34a" : "#dc2626" }}>{fmt(tx.amount)} ج.م</td>
              <td style={{ padding: "8px 12px" }}>{tx.reconciled ? "✓ مسوّى" : "○"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 12, color: "#94a3b8", fontSize: 10, textAlign: "center" }}>
        {settings.receipt_footer || company_name}
      </div>
    </div>
  );
}
