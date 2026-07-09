import React from "react";
import { g } from "./blockUtils";

export default function BranchBlock({ settings: s, props = {}, family, editing }) {
  const showBranch = g(s, "show_branch") !== false;
  if (!showBranch) return null;
  // Realistic mock: main branch name with city
  const name = props.label !== undefined && props.label !== "" ? props.label : (s.branch_name || (editing ? "الفرع الرئيسي — الرياض" : ""));
  if (!name) return null;

  const phone = s.branch_phone || s.phone || s.company_phone || (editing ? "011-4567890" : "");
  const taxId = s.branch_tax_id || s.tax_id || (editing ? "300012345600003" : "");

  const showPhone = props.showPhone === true;
  const showTaxId = props.showTaxId === true;

  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  const renderExtra = () => {
    return (
      <div style={{ fontSize: "9px", fontWeight: 500, color: "#64748b", display: "flex", flexDirection: "column", gap: "1px", marginTop: "2px" }}>
        {showPhone && phone && (
          <div>الهاتف: <span style={{ fontFamily: "monospace" }}>{phone}</span></div>
        )}
        {showTaxId && taxId && (
          <div>الرقم الضريبي: <span style={{ fontFamily: "monospace" }}>{taxId}</span></div>
        )}
      </div>
    );
  };

  if (family === "page") {
    if (variant === "badge") {
      return (
        <div style={{
          display: "inline-flex",
          flexDirection: "column",
          gap: "2px",
          border: `1px solid ${accent}40`,
          background: `${accent}0d`,
          padding: "4px 10px",
          borderRadius: "6px",
          color: accent,
          fontSize: "11px",
          fontWeight: 700
        }}>
          <div>{name}</div>
          {renderExtra()}
        </div>
      );
    }

    if (variant === "inline") {
      return (
        <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 500, opacity: 0.85 }}>
          {name} {showPhone && phone ? ` (${phone})` : ""}
        </span>
      );
    }

    return (
      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
        <div>{name}</div>
        {renderExtra()}
      </div>
    );
  }

  if (variant === "badge") {
    return (
      <div style={{ border: "1px solid #000", padding: "4px 8px", margin: "2px 0", textAlign: "center", fontSize: "10px" }}>
        <div style={{ fontWeight: 800 }}>{name}</div>
        {renderExtra()}
      </div>
    );
  }

  return (
    <div>
      <div>{name}</div>
      {renderExtra()}
    </div>
  );
}
