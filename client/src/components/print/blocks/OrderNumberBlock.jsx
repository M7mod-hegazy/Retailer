import React from "react";
import { resolveDocNo } from "./DocNumberBlock";

// Order-ticket style: the document number huge and unmissable — meant for
// kitchen/counter tickets where staff need to match a physical slip to an
// order at a glance. No settings toggle: visibility is controlled purely by
// whether the designer/preset places this block in the layout.
export default function OrderNumberBlock({ invoice = {}, props = {}, family }) {
  const number = resolveDocNo(invoice);
  if (!number) return null;

  const fontSize = props.fontSize != null ? props.fontSize : 34;
  const label = props.label !== undefined ? props.label : "رقم الطلب";

  return (
    <div style={{ textAlign: "center", margin: family === "page" ? "4mm 0" : "3mm 0" }}>
      {label ? (
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#000", marginBottom: "2px" }}>{label}</div>
      ) : null}
      <div
        dir="ltr"
        style={{ fontSize: `${fontSize}px`, fontWeight: 900, color: "#000", lineHeight: 1.1, fontFamily: "monospace" }}
      >
        {number}
      </div>
    </div>
  );
}
