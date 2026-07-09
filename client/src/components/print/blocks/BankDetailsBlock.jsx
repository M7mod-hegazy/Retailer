import React from "react";
import { g } from "./blockUtils";

export default function BankDetailsBlock({ settings: s, props = {}, family, editing }) {
  const showBlock = g(s, "show_bank_details") !== false || editing;
  if (!showBlock) return null;

  // Custom bank accounts
  const bankName = props.bankName || s.bank_name || (editing ? "مصرف الراجحي" : "");
  const accountName = props.accountName || s.bank_account_name || (editing ? "مؤسسة النجم الذهبي للتجارة" : "");
  const iban = props.iban || s.bank_iban || (editing ? "SA8080000001234567890123" : "");

  if (!bankName && !iban) return null;

  const isRoll = family === "roll";
  const accent = g(s, "accent_color") || "#1e3a8a";

  const cardStyle = {
    marginTop: "6px",
    marginBottom: "6px",
    border: `1.5px dashed ${isRoll ? "#000" : accent}`,
    borderRadius: "6px",
    padding: isRoll ? "5px" : "8px 12px",
    background: isRoll ? "transparent" : `${accent}03`,
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: isRoll ? "10px" : "11px", fontWeight: 900, color: isRoll ? "#000" : accent, borderBottom: `1px solid ${isRoll ? "#000" : `${accent}22`}`, paddingBottom: "3px", marginBottom: "4px" }}>
        معلومات التحويل البنكي
      </div>
      <div style={{ fontSize: isRoll ? "9px" : "10px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {bankName && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>البنك:</span>
            <span style={{ fontWeight: 800 }}>{bankName}</span>
          </div>
        )}
        {accountName && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>المستفيد:</span>
            <span style={{ fontWeight: 800 }}>{accountName}</span>
          </div>
        )}
        {iban && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "4px" }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>الآيبان IBAN:</span>
            <span style={{ fontWeight: 900, fontFamily: "monospace", letterSpacing: "0.5px" }} dir="ltr">
              {iban}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
