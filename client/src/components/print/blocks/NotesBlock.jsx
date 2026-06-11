import React from "react";
import { g } from "./blockUtils";

export default function NotesBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_notes") === false) return null;
  const notes = invoice.notes;
  if (!notes || !String(notes).trim()) return null;
  if (family === "page") {
    return (
      <div style={{ marginTop: 4, padding: "4px 0", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>ملاحظات</div>
        <div style={{ fontSize: "11px", color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{notes}</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 3, paddingTop: 3, borderTop: "1px dashed #ccc", fontSize: "10px" }}>
      <div style={{ fontWeight: 700 }}>ملاحظات:</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{notes}</div>
    </div>
  );
}
