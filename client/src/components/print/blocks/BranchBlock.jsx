import React from "react";
import { g } from "./blockUtils";

export default function BranchBlock({ settings: s, props = {}, family, editing }) {
  const showBranch = g(s, "show_branch") !== false;
  if (!showBranch && !editing) return null;
  // Realistic mock: main branch name with city
  const name = props.label !== undefined && props.label !== "" ? props.label : (s.branch_name || (editing ? "الفرع الرئيسي — الرياض" : ""));
  if (!name) return null;

  const phone = s.branch_phone || s.phone || s.company_phone || (editing ? "011-4567890" : "");
  const taxId = s.branch_tax_id || s.tax_id || (editing ? "300012345600003" : "");

  const showPhone = props.showPhone === true;
  const showTaxId = props.showTaxId === true;

  const renderExtra = () => {
    return (
      <div style={{ fontSize: "9.5px", fontWeight: 500, color: "#64748b", display: "flex", flexDirection: "column", gap: "1px", marginTop: "2px" }}>
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
    return (
      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
        <div>{name}</div>
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
