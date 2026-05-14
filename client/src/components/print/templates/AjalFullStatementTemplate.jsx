import React from "react";

export default function AjalFullStatementTemplate({ party, debts = [], settings = {} }) {
  return (
    <div style={{ fontFamily: settings.print_font || "Cairo", direction: "rtl", padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>كشف حساب كامل</div>
      <div style={{ marginBottom: 8 }}>{party?.name || ""}</div>
      <div style={{ color: "#64748b", fontSize: 12 }}>سيتم تحسين هذا التقرير قريباً</div>
    </div>
  );
}
