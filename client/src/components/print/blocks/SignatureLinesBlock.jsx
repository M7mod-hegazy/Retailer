import React from "react";
import { g } from "./blockUtils";

const DEFAULT_LABELS_2 = ["توقيع البائع", "توقيع المستلم"];
const DEFAULT_LABELS_3 = ["توقيع البائع", "توقيع المستلم", "توقيع المدير"];

// Page-only footer row of signature slots: a label with a blank 40mm line
// underneath it to sign on. Count is 2 or 3 (designer-overridable), labels
// default to seller/recipient(/manager).
export default function SignatureLinesBlock({ settings: s, props = {}, family, editing }) {
  if (family !== "page") return null;
  const showSignatures = g(s, "show_signature_lines") === true;
  if (!showSignatures) return null;

  const count = props.count === 3 ? 3 : 2;
  const labels = Array.isArray(props.labels) && props.labels.length
    ? props.labels
    : (count === 3 ? DEFAULT_LABELS_3 : DEFAULT_LABELS_2);
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (variant === "boxed") {
    return (
      <div style={{
        display: "flex",
        justifyContent: "space-around",
        gap: "10mm",
        marginTop: "16mm"
      }}>
        {labels.slice(0, count).map((label, i) => (
          <div key={i} style={{
            textAlign: "center",
            flex: 1,
            border: `1px solid ${accent}30`,
            background: `${accent}03`,
            borderRadius: "8px",
            padding: "8px 12px 20px 12px",
          }}>
            <div style={{ fontSize: "10px", fontWeight: 800, color: accent, marginBottom: "12mm" }}>{label}</div>
            <div style={{ borderTop: `1px dashed ${accent}60`, width: "40mm", margin: "0 auto" }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "dotted-ruled") {
    return (
      <div style={{
        display: "flex",
        justifyContent: "space-around",
        gap: "8mm",
        marginTop: "16mm",
        borderTop: `2px dotted ${accent}`,
        paddingTop: "8px",
      }}>
        {labels.slice(0, count).map((label, i) => (
          <div key={i} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: accent, marginBottom: "10mm" }}>{label}</div>
            <div style={{ borderTop: `1px dotted ${accent}`, width: "40mm", margin: "0 auto" }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "split") {
    return (
      <div style={{
        display: "flex",
        justifyContent: "space-around",
        gap: "0mm",
        marginTop: "16mm"
      }}>
        {labels.slice(0, count).map((label, i) => (
          <div key={i} style={{
            textAlign: "center",
            flex: 1,
            borderRight: i > 0 ? "1px solid #e2e8f0" : "none",
            padding: "0 10px"
          }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#475569", marginBottom: "10mm" }}>{label}</div>
            <div style={{ borderTop: "1px solid #94a3b8", width: "40mm", margin: "0 auto" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "space-around", 
      gap: "8mm", 
      marginTop: "16mm",
      opacity: showSignatures ? 1 : 0.4,
      border: showSignatures ? "none" : "1px dashed #7c3aed"
    }}>
      {labels.slice(0, count).map((label, i) => (
        <div key={i} style={{ textAlign: "center", flex: 1, padding: showSignatures ? 0 : "4px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#334155", marginBottom: "10mm" }}>{label}</div>
          <div style={{ borderTop: "1px solid #334155", width: "40mm", margin: "0 auto" }} />
        </div>
      ))}
    </div>
  );
}
