import React from "react";
import { g } from "./blockUtils";

const DEFAULT_LABELS_2 = ["توقيع البائع", "توقيع المستلم"];
const DEFAULT_LABELS_3 = ["توقيع البائع", "توقيع المستلم", "توقيع المدير"];

// Page-only footer row of signature slots: a label with a blank 40mm line
// underneath it to sign on. Count is 2 or 3 (designer-overridable), labels
// default to seller/recipient(/manager).
export default function SignatureLinesBlock({ settings: s, props = {}, family }) {
  if (family !== "page") return null;
  if (g(s, "show_signature_lines") !== true) return null;

  const count = props.count === 3 ? 3 : 2;
  const labels = Array.isArray(props.labels) && props.labels.length
    ? props.labels
    : (count === 3 ? DEFAULT_LABELS_3 : DEFAULT_LABELS_2);

  return (
    <div style={{ display: "flex", justifyContent: "space-around", gap: "8mm", marginTop: "16mm" }}>
      {labels.slice(0, count).map((label, i) => (
        <div key={i} style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#334155", marginBottom: "10mm" }}>{label}</div>
          <div style={{ borderTop: "1px solid #334155", width: "40mm", margin: "0 auto" }} />
        </div>
      ))}
    </div>
  );
}
